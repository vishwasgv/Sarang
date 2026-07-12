import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))
vi.mock('../../security/session-persistence', () => ({
  generateSessionToken: vi.fn().mockReturnValue('new-raw-token'),
  saveSession: vi.fn(),
  loadSavedSession: vi.fn(),
  clearSavedSession: vi.fn(),
}))

import bcrypt from 'bcryptjs'
import { getPrisma } from '../../database/db'
import { loadSavedSession, clearSavedSession, saveSession } from '../../security/session-persistence'
import { loginWithToken, getPasswordMinLength, checkPasswordLength, changePassword } from '../auth.service'

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1', username: 'admin', fullName: 'Admin', email: null,
    isActive: true, roleId: 'role-1',
    tokenExpiresAt: new Date(Date.now() + 86400 * 1000),
    role: { id: 'role-1', roleName: 'Admin' },
    ...overrides
  }
}

function makeMockDb(user: ReturnType<typeof makeUser> | null = makeUser()) {
  return {
    user: {
      findFirst: vi.fn().mockResolvedValue(user),
      update: vi.fn().mockResolvedValue({}),
    },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('loginWithToken', () => {
  it('returns AUTH-003 when no saved session exists', async () => {
    vi.mocked(loadSavedSession).mockResolvedValue(null)

    const res = await loginWithToken()

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('AUTH-003')
  })

  it('returns AUTH-003 and clears session when user not found in DB', async () => {
    vi.mocked(loadSavedSession).mockResolvedValue({ userId: 'user-1', token: 'stale-token' })
    vi.mocked(getPrisma).mockReturnValue(makeMockDb(null) as never)

    const res = await loginWithToken()

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('AUTH-003')
    expect(clearSavedSession).toHaveBeenCalledOnce()
  })

  it('returns AUTH-003 and clears session when token is expired', async () => {
    vi.mocked(loadSavedSession).mockResolvedValue({ userId: 'user-1', token: 'old-token' })
    vi.mocked(getPrisma).mockReturnValue(
      makeMockDb(makeUser({ tokenExpiresAt: new Date(Date.now() - 1000) })) as never
    )

    const res = await loginWithToken()

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('AUTH-003')
    expect(clearSavedSession).toHaveBeenCalledOnce()
  })

  it('succeeds and rotates the session token on valid auto-login', async () => {
    vi.mocked(loadSavedSession).mockResolvedValue({ userId: 'user-1', token: 'valid-token' })
    const db = makeMockDb(makeUser())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await loginWithToken()

    expect(res.success).toBe(true)
    // Token rotation: new token saved to store and DB updated
    expect(db.user.update).toHaveBeenCalledOnce()
    expect(saveSession).toHaveBeenCalledWith('user-1', 'new-raw-token')
  })

  it('returns user data on successful auto-login', async () => {
    vi.mocked(loadSavedSession).mockResolvedValue({ userId: 'user-1', token: 'valid-token' })
    vi.mocked(getPrisma).mockReturnValue(makeMockDb(makeUser({ fullName: 'Store Owner' })) as never)

    const res = await loginWithToken()

    expect(res.success).toBe(true)
    const d = res.data as { fullName: string }
    expect(d.fullName).toBe('Store Owner')
  })
})

describe('getPasswordMinLength / checkPasswordLength', () => {
  it('falls back to the default (10) when no Setting row exists', async () => {
    vi.mocked(getPrisma).mockReturnValue({ setting: { findUnique: vi.fn().mockResolvedValue(null) } } as never)

    const minLen = await getPasswordMinLength()

    expect(minLen).toBe(10)
  })

  it('reads the live Setting value when present', async () => {
    vi.mocked(getPrisma).mockReturnValue({
      setting: { findUnique: vi.fn().mockResolvedValue({ settingKey: 'password_min_length', settingValue: '14', settingType: 'NUMBER' }) },
    } as never)

    const minLen = await getPasswordMinLength()

    expect(minLen).toBe(14)
  })

  it('falls back to the default on a corrupt/non-numeric Setting value', async () => {
    vi.mocked(getPrisma).mockReturnValue({
      setting: { findUnique: vi.fn().mockResolvedValue({ settingKey: 'password_min_length', settingValue: 'not-a-number', settingType: 'NUMBER' }) },
    } as never)

    const minLen = await getPasswordMinLength()

    expect(minLen).toBe(10)
  })

  it('checkPasswordLength rejects a password shorter than the configured minimum', async () => {
    vi.mocked(getPrisma).mockReturnValue({
      setting: { findUnique: vi.fn().mockResolvedValue({ settingKey: 'password_min_length', settingValue: '10', settingType: 'NUMBER' }) },
    } as never)

    const result = await checkPasswordLength('short')

    expect(result).not.toBeNull()
    expect(result?.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('VAL-001')
  })

  it('checkPasswordLength returns null (no error) when the password meets the minimum', async () => {
    vi.mocked(getPrisma).mockReturnValue({
      setting: { findUnique: vi.fn().mockResolvedValue({ settingKey: 'password_min_length', settingValue: '10', settingType: 'NUMBER' }) },
    } as never)

    const result = await checkPasswordLength('LongEnoughPassword1')

    expect(result).toBeNull()
  })
})

describe('changePassword', () => {
  const OLD_PASSWORD = 'CorrectOldPassword1'
  const oldHash = bcrypt.hashSync(OLD_PASSWORD, 12)

  function makeChangePasswordDb(overrides: Record<string, unknown> = {}) {
    return {
      user: {
        findUnique: vi.fn().mockResolvedValue({ id: 'user-1', passwordHash: oldHash }),
        update: vi.fn().mockResolvedValue({}),
      },
      setting: { findUnique: vi.fn().mockResolvedValue({ settingKey: 'password_min_length', settingValue: '10', settingType: 'NUMBER' }) },
      ...overrides
    }
  }

  it('rejects an incorrect current password', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeChangePasswordDb() as never)

    const result = await changePassword('user-1', 'WrongPassword', 'NewLongEnoughPassword1')

    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('AUTH-001')
  })

  it('rejects a new password shorter than the configured minimum', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeChangePasswordDb() as never)

    const result = await changePassword('user-1', OLD_PASSWORD, 'short')

    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('VAL-001')
  })

  it('succeeds with the correct current password and a valid new password', async () => {
    const db = makeChangePasswordDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await changePassword('user-1', OLD_PASSWORD, 'NewLongEnoughPassword1')

    expect(result.success).toBe(true)
    const updateCall = vi.mocked(db.user.update).mock.calls[0][0] as { data: { passwordHash: string } }
    expect(bcrypt.compareSync('NewLongEnoughPassword1', updateCall.data.passwordHash)).toBe(true)
    expect(clearSavedSession).toHaveBeenCalled()
  })

  // Was previously the one auth path with no lockout at all — an incorrect
  // oldPassword could be retried unlimited times, unlike login's AUTH-004 cap.
  it('locks out after 5 failed attempts for the same userId (AUTH-004), matching login', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeChangePasswordDb() as never)

    let lastResult
    for (let i = 0; i < 6; i++) {
      lastResult = await changePassword('user-lockout-test', 'WrongPassword', 'NewLongEnoughPassword1')
    }

    expect(lastResult!.success).toBe(false)
    expect((lastResult as { error: { code: string } }).error.code).toBe('AUTH-004')
  })

  it('does not lock out a different userId sharing no attempts with the failing one', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeChangePasswordDb() as never)

    for (let i = 0; i < 6; i++) {
      await changePassword('user-a-lockout', 'WrongPassword', 'NewLongEnoughPassword1')
    }
    const result = await changePassword('user-b-unaffected', OLD_PASSWORD, 'NewLongEnoughPassword1')

    expect(result.success).toBe(true)
  })
})
