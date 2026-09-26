import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { randomBytes } from 'crypto'
import { LAN_DEFAULT_PORT } from './protocol'

export type LanMode = 'off' | 'server' | 'client'

export interface LanConfig {
  mode: LanMode
  port: number
  /** Shared secret set on the server PC and typed on every client PC. */
  secret: string
  /** Client only: the server PC's address. */
  host: string
}

export function defaultConfig(): LanConfig {
  return { mode: 'off', port: LAN_DEFAULT_PORT, secret: '', host: '' }
}

export function generateSecret(): string {
  return randomBytes(9).toString('base64url')
}

export function configPath(userDataDir: string): string {
  return join(userDataDir, 'lan-config.json')
}

export function readConfig(userDataDir: string): LanConfig {
  try {
    const p = configPath(userDataDir)
    if (!existsSync(p)) return defaultConfig()
    const raw = JSON.parse(readFileSync(p, 'utf8')) as Partial<LanConfig>
    const mode: LanMode = raw.mode === 'server' || raw.mode === 'client' ? raw.mode : 'off'
    const port = Number.isInteger(raw.port) && (raw.port as number) >= 1024 && (raw.port as number) <= 65535 ? (raw.port as number) : LAN_DEFAULT_PORT
    return { mode, port, secret: typeof raw.secret === 'string' ? raw.secret : '', host: typeof raw.host === 'string' ? raw.host.trim() : '' }
  } catch {
    return defaultConfig()
  }
}

export function writeConfig(userDataDir: string, cfg: LanConfig): void {
  const p = configPath(userDataDir)
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, JSON.stringify(cfg, null, 2), 'utf8')
}
