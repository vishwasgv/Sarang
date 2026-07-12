import { randomBytes } from 'crypto'
import type Store from 'electron-store'

// Lazy-load electron-store to avoid issues during early main process startup.
// electron-store is pure ESM (no CJS export) — electron-vite compiles the
// main process to CommonJS, so this must be a dynamic import(), not require().
let _store: Store | undefined
async function getStore(): Promise<Store> {
  if (!_store) {
    const { default: ElectronStore } = await import('electron-store')
    // Encrypts the session file on disk so a raw session token cannot be replayed
    // even if an attacker reads the AppData directory.
    _store = new ElectronStore({ name: 'sarang-session', encryptionKey: 'sbos-session-key-v1' }) as Store
  }
  return _store
}

const SESSION_KEY = 'saved_session'
const TOKEN_EXPIRY_DAYS = 30

export function generateSessionToken(): string {
  return randomBytes(32).toString('hex')
}

export async function saveSession(userId: string, token: string): Promise<void> {
  (await getStore()).set(SESSION_KEY, { userId, token, savedAt: Date.now() })
}

export async function loadSavedSession(): Promise<{ userId: string; token: string } | null> {
  const s = (await getStore()).get(SESSION_KEY) as { userId: string; token: string; savedAt: number } | undefined
  if (!s) return null
  const ageMs = Date.now() - (s.savedAt ?? 0)
  if (ageMs > TOKEN_EXPIRY_DAYS * 86400 * 1000) {
    await clearSavedSession()
    return null
  }
  return { userId: s.userId, token: s.token }
}

export async function clearSavedSession(): Promise<void> {
  (await getStore()).delete(SESSION_KEY)
}
