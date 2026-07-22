import { randomBytes } from 'crypto'
import { safeStorage } from 'electron'
import type Store from 'electron-store'

// Lazy-load electron-store to avoid issues during early main process startup.
// electron-store is pure ESM (no CJS export) — electron-vite compiles the
// main process to CommonJS, so this must be a dynamic import(), not require().
let _store: Store | undefined
async function getStore(): Promise<Store> {
  if (!_store) {
    const { default: ElectronStore } = await import('electron-store')
    // BUG FOUND 2026-07-22: this used to pass a hardcoded, static
    // `encryptionKey: 'sbos-session-key-v1'` string to electron-store. That
    // key ships identically in every installed copy of the app (extractable
    // from the ASAR), so it isn't really encryption for this threat model —
    // anyone who can read a user's session file can decrypt it with a key
    // that's the same for every Sarang install, recover the raw session
    // token, and fully authenticate as that user for up to 30 days with no
    // password. Fixed below: the file on disk is now just plain JSON (no
    // false security claim), and the actual session token is separately
    // encrypted with Electron's `safeStorage`, which is backed by the OS's
    // own per-machine/per-user credential store (DPAPI on Windows) — a key
    // that isn't shipped in the app and isn't the same across installs.
    _store = new ElectronStore({
      name: 'sarang-session',
      // An existing install upgrading from before this fix has a session
      // file that's ciphertext under the OLD static-key scheme, which is
      // not valid JSON when read without an encryptionKey — clearInvalidConfig
      // makes that a graceful reset to an empty store (silently invalidating
      // any previously "remembered" session, so the user just logs in again
      // once) instead of a SyntaxError thrown at every app startup.
      clearInvalidConfig: true
    }) as Store
  }
  return _store
}

const SESSION_KEY = 'saved_session'
const TOKEN_EXPIRY_DAYS = 30

export function generateSessionToken(): string {
  return randomBytes(32).toString('hex')
}

export async function saveSession(userId: string, token: string): Promise<void> {
  // Fail closed: if the OS-backed encryption isn't available for some reason
  // (e.g. no credential store on this machine), don't fall back to storing
  // the raw token — simply don't offer "remember me" rather than persist it
  // insecurely. The user can still log in normally with their password.
  if (!safeStorage.isEncryptionAvailable()) return
  const encryptedToken = safeStorage.encryptString(token).toString('base64')
  ;(await getStore()).set(SESSION_KEY, { userId, encryptedToken, savedAt: Date.now() })
}

export async function loadSavedSession(): Promise<{ userId: string; token: string } | null> {
  const s = (await getStore()).get(SESSION_KEY) as { userId: string; encryptedToken: string; savedAt: number } | undefined
  if (!s) return null
  const ageMs = Date.now() - (s.savedAt ?? 0)
  if (ageMs > TOKEN_EXPIRY_DAYS * 86400 * 1000) {
    await clearSavedSession()
    return null
  }
  if (!safeStorage.isEncryptionAvailable()) return null
  try {
    const token = safeStorage.decryptString(Buffer.from(s.encryptedToken, 'base64'))
    return { userId: s.userId, token }
  } catch {
    // Undecryptable (e.g. the OS credential store changed/reset since this
    // was written) — treat as no saved session rather than crashing login.
    await clearSavedSession()
    return null
  }
}

export async function clearSavedSession(): Promise<void> {
  (await getStore()).delete(SESSION_KEY)
}
