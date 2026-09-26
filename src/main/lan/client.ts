import { request } from 'http'
import { open, seal, type PollResponse, type RpcRequest, type RpcResponse } from './protocol'

export interface LanClientOptions {
  host: string
  port: number
  secret: string
}

export interface CallOutcome {
  result: unknown
  downloads: NonNullable<RpcResponse['downloads']>
}

const UNREACHABLE = { success: false, error: { code: 'LAN-001', message: 'Cannot reach the server PC. Check that it is switched on, Sarang is open on it and both PCs are on the same network.' } }
const WRONG_SECRET = { success: false, error: { code: 'LAN-005', message: 'The server PC did not accept the shared secret. Ask the owner for the current secret (Settings > Multi-user).' } }

// Sends one sealed request to the server PC. Never throws: a network problem comes back as a normal failed result.
export class LanClient {
  private conn: string | undefined

  constructor(private readonly opts: LanClientOptions) {}

  get address(): string { return `${this.opts.host}:${this.opts.port}` }

  private post(body: string, timeoutMs: number): Promise<{ status: number; text: string }> {
    return new Promise((resolve, reject) => {
      const req = request({ host: this.opts.host, port: this.opts.port, path: '/sarang/rpc', method: 'POST', headers: { 'Content-Type': 'text/plain', 'Content-Length': Buffer.byteLength(body) }, timeout: timeoutMs }, (res) => {
        const chunks: Buffer[] = []
        res.on('data', (c: Buffer) => chunks.push(c))
        res.on('end', () => resolve({ status: res.statusCode ?? 0, text: Buffer.concat(chunks).toString('utf8') }))
      })
      req.on('timeout', () => { req.destroy(new Error('timeout')) })
      req.on('error', reject)
      req.end(body)
    })
  }

  async call(channel: string, payload: unknown, timeoutMs = 60_000): Promise<CallOutcome> {
    const message: RpcRequest = { channel, payload, conn: this.conn }
    try {
      const res = await this.post(seal(this.opts.secret, message), timeoutMs)
      if (res.status === 401) return { result: WRONG_SECRET, downloads: [] }
      if (res.status !== 200) return { result: UNREACHABLE, downloads: [] }
      const body = open<RpcResponse>(this.opts.secret, res.text)
      this.conn = body.conn
      return { result: body.result, downloads: body.downloads ?? [] }
    } catch {
      return { result: UNREACHABLE, downloads: [] }
    }
  }

  async poll(): Promise<PollResponse | null> {
    const { result } = await this.call('lan:poll', null, 8000)
    const r = result as { success?: boolean; data?: PollResponse }
    return r?.success ? (r.data ?? null) : null
  }

  async ping(): Promise<{ ok: boolean; message: string }> {
    const { result } = await this.call('lan:ping', null, 8000)
    const r = result as { success?: boolean; error?: { message: string } }
    return r?.success ? { ok: true, message: 'Connected to the server PC.' } : { ok: false, message: r?.error?.message ?? 'Could not connect.' }
  }

  /** Forgets the server-side connection (used after the server PC restarts or on sign-out of the app). */
  reset(): void { this.conn = undefined }
}
