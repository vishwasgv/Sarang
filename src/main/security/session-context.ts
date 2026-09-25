import { AsyncLocalStorage } from 'async_hooks'

export interface Session {
  userId: string
  username: string
  roleId: string
}

export interface SessionHolder {
  session: Session | null
}

// The desktop window's own session. Remote (LAN client) requests never touch it:
// they run inside runWithSession() with their own per-connection holder.
const localHolder: SessionHolder = { session: null }
const storage = new AsyncLocalStorage<SessionHolder>()

export function createSessionHolder(): SessionHolder {
  return { session: null }
}

export function runWithSession<T>(holder: SessionHolder, fn: () => T): T {
  return storage.run(holder, fn)
}

function activeHolder(): SessionHolder {
  return storage.getStore() ?? localHolder
}

export function readSession(): Session | null {
  return activeHolder().session
}

export function writeSession(session: Session | null): void {
  activeHolder().session = session
}
