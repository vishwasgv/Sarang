import { describe, it, expect, vi, beforeEach } from 'vitest'

// In-memory fake for electron-store — enough surface for get/set/delete.
const fakeStoreData: Record<string, unknown> = {}
vi.mock('electron-store', () => ({
  default: class FakeStore {
    get(key: string) { return fakeStoreData[key] }
    set(key: string, value: unknown) { fakeStoreData[key] = value }
    delete(key: string) { delete fakeStoreData[key] }
  }
}))

let encryptionAvailable = true
// Deliberately reversible "encryption" — real safeStorage behavior isn't
// under test here (that's Electron's own responsibility), only that this
// module calls it correctly and never persists a plaintext token.
vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => encryptionAvailable),
    encryptString: vi.fn((s: string) => Buffer.from(`ENC(${s})`)),
    decryptString: vi.fn((b: Buffer) => {
      const str = b.toString()
      const m = /^ENC\((.*)\)$/.exec(str)
      if (!m) throw new Error('bad ciphertext')
      return m[1]
    })
  }
}))

import { saveSession, loadSavedSession, clearSavedSession, generateSessionToken } from '../session-persistence'

beforeEach(() => {
  vi.clearAllMocks()
  encryptionAvailable = true
  for (const k of Object.keys(fakeStoreData)) delete fakeStoreData[k]
})

describe('session-persistence', () => {
  it('round-trips a saved session through safeStorage, not as plaintext', async () => {
    await saveSession('user-1', 'raw-token-abc')

    // Regression for the hardcoded-encryption-key bug: the stored payload
    // must never contain the raw token in the clear.
    const stored = fakeStoreData['saved_session'] as { encryptedToken: string }
    expect(stored.encryptedToken).toBeDefined()
    expect(JSON.stringify(stored)).not.toContain('raw-token-abc')

    const loaded = await loadSavedSession()
    expect(loaded).toEqual({ userId: 'user-1', token: 'raw-token-abc' })
  })

  it('does not persist anything when OS-backed encryption is unavailable (fail closed)', async () => {
    encryptionAvailable = false
    await saveSession('user-1', 'raw-token-abc')
    expect(fakeStoreData['saved_session']).toBeUndefined()
  })

  it('returns null instead of throwing when encryption becomes unavailable after a session was saved', async () => {
    await saveSession('user-1', 'raw-token-abc')
    encryptionAvailable = false

    const loaded = await loadSavedSession()
    expect(loaded).toBeNull()
  })

  it('expires a session older than 30 days', async () => {
    await saveSession('user-1', 'raw-token-abc')
    const stored = fakeStoreData['saved_session'] as { savedAt: number }
    stored.savedAt = Date.now() - 31 * 86400 * 1000

    const loaded = await loadSavedSession()
    expect(loaded).toBeNull()
    expect(fakeStoreData['saved_session']).toBeUndefined()
  })

  it('clearSavedSession removes the stored session', async () => {
    await saveSession('user-1', 'raw-token-abc')
    await clearSavedSession()
    expect(await loadSavedSession()).toBeNull()
  })

  it('generateSessionToken produces a 64-char hex string (256-bit)', () => {
    const token = generateSessionToken()
    expect(token).toMatch(/^[0-9a-f]{64}$/)
  })
})
