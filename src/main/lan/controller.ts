import { app, BrowserWindow, dialog } from 'electron'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import { networkInterfaces } from 'os'
import { readConfig, writeConfig, generateSecret, type LanConfig } from './config'
import { LanServer } from './server'
import { LanClient } from './client'
import { getSeatLimit } from './seats'
import { setLanClient, setLanServer, getLanServer, getLanClient, type ClientEffects } from './router'

let pollTimer: NodeJS.Timeout | null = null
let lastSeq = -1

function userDataDir(): string {
  return app.getPath('userData')
}

export function currentConfig(): LanConfig {
  return readConfig(userDataDir())
}

/** Addresses other PCs can use to reach this one. */
export function localAddresses(): string[] {
  const out: string[] = []
  for (const list of Object.values(networkInterfaces())) {
    for (const i of list ?? []) if (i.family === 'IPv4' && !i.internal) out.push(i.address)
  }
  return out
}

// What a client PC does with the extras that come back with a result: files to save and pages to print here.
const clientEffects: ClientEffects = async ({ result, downloads }) => {
  let text: string | null = null
  const saved: Array<{ from: string; to: string }> = []
  for (const d of downloads) {
    const { filePath, canceled } = await dialog.showSaveDialog({ defaultPath: d.suggestedName })
    if (!canceled && filePath) {
      await writeFile(filePath, Buffer.from(d.base64, 'base64'))
      saved.push({ from: d.tempName, to: filePath })
    }
  }
  if (saved.length) {
    text = JSON.stringify(result)
    for (const s of saved) text = text.split(JSON.stringify(s.from).slice(1, -1)).join(JSON.stringify(s.to).slice(1, -1))
  }
  const out = (text ? JSON.parse(text) : result) as { success?: boolean; data?: { __printHtml?: string; __printOptions?: Electron.WebContentsPrintOptions } }
  const html = out?.data?.__printHtml
  if (out?.success && typeof html === 'string') {
    const tmp = join(app.getPath('temp'), `sarang_lan_${Date.now()}.html`)
    await writeFile(tmp, html, 'utf-8')
    return new Promise((resolve) => {
      const win = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true, sandbox: true } })
      win.loadFile(tmp)
      win.webContents.once('did-finish-load', () => {
        win.webContents.print(out.data?.__printOptions ?? { silent: false, printBackground: true }, (success: boolean) => {
          win.close()
          resolve({ success, data: { printed: success } })
        })
      })
    })
  }
  return out
}

function startPolling(client: LanClient): void {
  stopPolling()
  lastSeq = -1
  pollTimer = setInterval(async () => {
    const p = await client.poll()
    if (!p) return
    if (lastSeq >= 0 && p.seq !== lastSeq) {
      for (const w of BrowserWindow.getAllWindows()) w.webContents.send('lan:changed', { by: p.by, at: p.at })
    }
    lastSeq = p.seq
  }, 4000)
  pollTimer.unref()
}

function stopPolling(): void {
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = null
}

export function isLanClientConfigured(): boolean {
  const c = currentConfig()
  return c.mode === 'client' && !!c.host && !!c.secret
}

/** Applies the saved settings: starts or stops the server, or points this PC at the server PC. */
export async function applyLanConfig(log: (m: string) => void = () => {}): Promise<void> {
  const cfg = currentConfig()
  const running = getLanServer()
  if (running) {
    await running.stop()
    setLanServer(null)
  }
  stopPolling()
  setLanClient(null)
  if (cfg.mode === 'server' && cfg.secret) {
    const server = new LanServer({ port: cfg.port, secret: cfg.secret, seatLimit: getSeatLimit, log })
    try {
      await server.start()
      setLanServer(server)
    } catch (e) {
      log(`[LAN] Could not start the server on port ${cfg.port}: ${(e as Error).message}`)
    }
  } else if (cfg.mode === 'client' && cfg.host && cfg.secret) {
    const client = new LanClient({ host: cfg.host, port: cfg.port, secret: cfg.secret })
    setLanClient(client, clientEffects)
    startPolling(client)
  }
}

export async function stopLan(): Promise<void> {
  const s = getLanServer()
  if (s) await s.stop()
  setLanServer(null)
  stopPolling()
}

export function saveLanConfig(next: Partial<LanConfig>): LanConfig {
  const cur = currentConfig()
  const cfg: LanConfig = {
    mode: next.mode ?? cur.mode,
    port: next.port ?? cur.port,
    secret: next.secret ?? cur.secret,
    host: next.host ?? cur.host
  }
  if (cfg.mode === 'server' && !cfg.secret) cfg.secret = generateSecret()
  writeConfig(userDataDir(), cfg)
  return cfg
}

export function lanStatus(): { mode: string; port: number; running: boolean; addresses: string[]; connections: ReturnType<LanServer['listConnections']>; connectedTo: string | null } {
  const cfg = currentConfig()
  const server = getLanServer()
  const client = getLanClient()
  return {
    mode: cfg.mode,
    port: cfg.port,
    running: !!server?.running,
    addresses: localAddresses(),
    connections: server?.listConnections() ?? [],
    connectedTo: client ? client.address : null
  }
}
