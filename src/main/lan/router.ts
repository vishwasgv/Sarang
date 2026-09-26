import type { LanClient } from './client'
import type { LanServer } from './server'
import { changesData, isServerOnlyChannel } from './registry'
import { readSession } from '../security/session-context'

// Where a call from this PC's own window goes: to the local handler, or (on a client PC) to the server PC.
let client: LanClient | null = null
let server: LanServer | null = null

export type ClientEffects = (outcome: { result: unknown; downloads: Array<{ tempName: string; suggestedName: string; base64: string }> }) => Promise<unknown>
let effects: ClientEffects | null = null

export function setLanClient(c: LanClient | null, applyEffects?: ClientEffects): void {
  client = c
  effects = applyEffects ?? null
}

export function setLanServer(s: LanServer | null): void {
  server = s
}

export function getLanClient(): LanClient | null { return client }
export function getLanServer(): LanServer | null { return server }

export function isClientMode(): boolean { return client !== null }

// Returns a result when the call was sent to the server PC, or undefined when the local handler should run.
export async function forwardIfClient(channel: string, payload: unknown): Promise<unknown | undefined> {
  if (!client || isServerOnlyChannel(channel)) return undefined
  const outcome = await client.call(channel, payload)
  return effects ? effects(outcome) : outcome.result
}

// After a local call succeeds on a server PC, tell the other PCs the data changed.
export function noteLocalCall(channel: string, result: unknown): void {
  if (!server || !changesData(channel)) return
  const failed = typeof result === 'object' && result !== null && (result as { success?: boolean }).success === false
  if (!failed) server.noteLocalChange(readSession()?.username ?? null)
}
