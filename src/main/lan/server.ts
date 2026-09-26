import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'http'
import { randomBytes } from 'crypto'
import { existsSync, readFileSync, statSync, unlinkSync } from 'fs'
import { createSessionHolder, runWithSession, readSession, type SessionHolder } from '../security/session-context'
import { getChannel, isServerOnlyChannel, changesData } from './registry'
import { runAsRemote, type RemoteContext } from './context'
import { open, seal, type PollResponse, type RpcRequest, type RpcResponse, type RpcDownload } from './protocol'

const MAX_BODY = 30 * 1024 * 1024
const MAX_DOWNLOAD = 40 * 1024 * 1024
const IDLE_MS = 12 * 60 * 60 * 1000

interface Connection {
  id: string
  holder: SessionHolder
  ip: string
  since: number
  lastSeen: number
}

export interface ConnectionInfo { id: string; user: string | null; ip: string; since: number; lastSeen: number }

export interface LanServerOptions {
  port: number
  secret: string
  /** How many PCs may be signed in at once, the server PC's own window included. */
  seatLimit: () => Promise<number>
  log?: (message: string) => void
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (c: Buffer) => {
      size += c.length
      if (size > MAX_BODY) { reject(new Error('too large')); req.destroy(); return }
      chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function collectDownloads(ctx: RemoteContext): RpcDownload[] {
  const out: RpcDownload[] = []
  for (const d of ctx.downloads) {
    try {
      if (existsSync(d.tempPath) && statSync(d.tempPath).size <= MAX_DOWNLOAD) {
        out.push({ tempName: d.tempPath, suggestedName: d.suggestedName, base64: readFileSync(d.tempPath).toString('base64') })
      }
    } catch { /* the file could not be read; the caller gets the normal result without it */ }
    try { unlinkSync(d.tempPath) } catch { /* already gone */ }
  }
  return out
}

export class LanServer {
  private server: Server | null = null
  private connections = new Map<string, Connection>()
  private seq = 0
  private lastBy: string | null = null
  private lastAt = 0
  private sweeper: NodeJS.Timeout | null = null

  constructor(private readonly opts: LanServerOptions) {}

  get running(): boolean { return this.server !== null }

  async start(): Promise<number> {
    if (this.server) return (this.server.address() as { port: number }).port
    const server = createServer((req, res) => { void this.handle(req, res) })
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(this.opts.port, '0.0.0.0', () => resolve())
    })
    this.server = server
    this.sweeper = setInterval(() => this.dropIdle(), 60_000)
    this.sweeper.unref()
    return (server.address() as { port: number }).port
  }

  async stop(): Promise<void> {
    if (this.sweeper) clearInterval(this.sweeper)
    this.sweeper = null
    this.connections.clear()
    const s = this.server
    this.server = null
    if (s) await new Promise<void>((resolve) => { s.close(() => resolve()); s.closeAllConnections?.() })
  }

  listConnections(): ConnectionInfo[] {
    return [...this.connections.values()].map((c) => ({ id: c.id, user: c.holder.session?.username ?? null, ip: c.ip, since: c.since, lastSeen: c.lastSeen }))
  }

  disconnect(id: string): boolean {
    return this.connections.delete(id)
  }

  private dropIdle(): void {
    const cutoff = Date.now() - IDLE_MS
    for (const [id, c] of this.connections) if (c.lastSeen < cutoff) this.connections.delete(id)
  }

  private signedInRemotes(except?: string): number {
    let n = 0
    for (const c of this.connections.values()) if (c.id !== except && c.holder.session) n++
    return n
  }

  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (req.method === 'GET' && req.url === '/sarang/hello') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ app: 'Sarang' }))
      return
    }
    if (req.method !== 'POST' || req.url !== '/sarang/rpc') {
      res.writeHead(404).end()
      return
    }
    let request: RpcRequest
    try {
      request = open<RpcRequest>(this.opts.secret, await readBody(req))
    } catch {
      res.writeHead(401).end()
      return
    }
    const ip = req.socket.remoteAddress ?? ''
    let conn = request.conn ? this.connections.get(request.conn) : undefined
    if (!conn) {
      conn = { id: randomBytes(12).toString('hex'), holder: createSessionHolder(), ip, since: Date.now(), lastSeen: Date.now() }
      this.connections.set(conn.id, conn)
    }
    conn.lastSeen = Date.now()
    const ctx: RemoteContext = { user: conn.holder.session?.username ?? null, downloads: [] }
    let result: unknown
    try {
      result = await this.dispatch(conn, request, ctx)
    } catch (err) {
      this.opts.log?.(`[LAN] ${request.channel} failed: ${(err as Error).message}`)
      result = { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
    }
    const body: RpcResponse = { conn: conn.id, result, downloads: ctx.downloads.length ? collectDownloads(ctx) : undefined }
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end(seal(this.opts.secret, body))
  }

  private async dispatch(conn: Connection, request: RpcRequest, ctx: RemoteContext): Promise<unknown> {
    const { channel, payload } = request
    if (channel === 'lan:ping') return { success: true, data: { app: 'Sarang' } }
    if (channel === 'lan:poll') {
      const data: PollResponse = { seq: this.seq, by: this.lastBy, at: this.lastAt }
      return { success: true, data }
    }
    if (isServerOnlyChannel(channel)) {
      return { success: false, error: { code: 'LAN-002', message: 'This needs a file or folder on the server PC. Please do it on the PC where Sarang keeps the data.' } }
    }
    const handler = getChannel(channel)
    if (!handler) return { success: false, error: { code: 'LAN-004', message: 'This action is not available from another PC.' } }

    if (channel === 'auth:login' && !conn.holder.session) {
      const limit = await this.opts.seatLimit()
      const inUse = (readSession() ? 1 : 0) + this.signedInRemotes(conn.id)
      if (inUse >= limit) {
        return { success: false, error: { code: 'LAN-003', message: `All ${limit} seat${limit === 1 ? ' is' : 's are'} in use. Sign out on another PC, or add seats in Settings > License.` } }
      }
    }

    // A PC that signs in remotely never leaves a remembered sign-in on this PC.
    const input = channel === 'auth:login' && typeof payload === 'object' && payload !== null ? { ...(payload as object), rememberMe: false } : payload
    const result = await runWithSession(conn.holder, () => runAsRemote(ctx, () => handler(input)))
    ctx.user = conn.holder.session?.username ?? null
    if (channel === 'auth:logout') conn.holder.session = null
    const failed = typeof result === 'object' && result !== null && (result as { success?: boolean }).success === false
    if (!failed && changesData(channel)) this.noteChange(conn.holder.session?.username ?? null)
    return result
  }

  private noteChange(user: string | null): void {
    this.seq++
    this.lastBy = user
    this.lastAt = Date.now()
  }

  /** Called when the server PC's own window changes data, so the other PCs are told too. */
  noteLocalChange(user: string | null): void {
    this.noteChange(user)
  }
}
