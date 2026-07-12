import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))
vi.mock('../../security/session-persistence', () => ({
  generateSessionToken: vi.fn().mockReturnValue('tok-abc'),
  saveSession: vi.fn(),
  loadSavedSession: vi.fn().mockReturnValue(null),
  clearSavedSession: vi.fn()
}))

import { getPrisma } from '../../database/db'

// Must re-import after mocks to get a fresh module with clean rate-limit state
// Vitest isolates module state per file, so rate limit Map starts empty

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1', username: 'admin', fullName: 'Admin User', email: 'admin@example.com',
    isActive: true, passwordHash: '$2a$12$fakehash', roleId: 'role-owner',
    role: { id: 'role-owner', roleName: 'Owner' },
    sessionToken: null, tokenExpiresAt: null, lastLogin: null,
    ...overrides
  }
}

function makeDb(overrides: Record<string, unknown> = {}) {
  return {
    user: {
      findUnique: vi.fn().mockResolvedValue(makeUser()),
      update: vi.fn().mockResolvedValue(makeUser())
    },
    ...overrides
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  // Re-import the module fresh to reset the in-memory rate-limit Map
  vi.resetModules()
})

describe('auth rate limiting', () => {
  it('allows login when under the 5-attempt threshold', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeDb() as never)
    const { login } = await import('../auth.service')

    // Bcrypt comparison will fail because hash is fake — but rate limit should NOT block
    const result = await login('admin', 'wrongpassword')

    // Should get an AUTH-001 (wrong password) not AUTH-004 (rate limited)
    expect((result as { error: { code: string } }).error?.code).not.toBe('AUTH-004')
  })

  it('blocks after 5 failed attempts with AUTH-004', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeDb() as never)
    const { login } = await import('../auth.service')

    // Make 5 failed attempts (wrong password, each one increments counter)
    for (let i = 0; i < 5; i++) {
      await login('blocked-user', 'wrongpwd')
    }

    // 6th attempt should be rate limited
    const result = await login('blocked-user', 'anypwd')

    expect((result as { error: { code: string } }).error.code).toBe('AUTH-004')
  })

  it('resets rate limit on successful login', async () => {
    const bcrypt = await import('bcryptjs')
    const hash = await bcrypt.hash('correct', 10)
    const db = makeDb()
    db.user.findUnique = vi.fn().mockResolvedValue(makeUser({ passwordHash: hash }))
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const { login } = await import('../auth.service')

    // 4 failed attempts
    for (let i = 0; i < 4; i++) {
      await login('admin', 'wrongpwd')
    }

    // Successful login resets counter
    await login('admin', 'correct')

    // Can now attempt again without being blocked
    const result = await login('admin', 'wrongpwd')
    expect((result as { error: { code: string } }).error?.code).not.toBe('AUTH-004')
  })
})

describe('auth.changePassword', () => {
  it('rejects wrong current password', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeDb() as never)
    const { changePassword } = await import('../auth.service')

    const result = await changePassword('user-1', 'wrongOld', 'newPass123')

    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('AUTH-001')
  })

  it('enforces minimum password length', async () => {
    const bcrypt = await import('bcryptjs')
    const hash = await bcrypt.hash('oldpass', 10)
    const db = makeDb()
    db.user.findUnique = vi.fn().mockResolvedValue(makeUser({ passwordHash: hash }))
    const dbWithSetting = { ...db, setting: { findUnique: vi.fn().mockResolvedValue({ settingKey: 'password_min_length', settingValue: '8', settingType: 'NUMBER' }) } }
    vi.mocked(getPrisma).mockReturnValue(dbWithSetting as never)
    const { changePassword } = await import('../auth.service')

    const result = await changePassword('user-1', 'oldpass', 'short')

    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('VAL-001')
  })
})
