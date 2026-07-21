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
import {
  loginWithToken, getPasswordMinLength, checkPasswordLength, changePassword,
  generateRecoveryCode, resetPasswordWithRecoveryCode, regenerateRecoveryCode
} from '../auth.service'

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
  //
  // Both tests below do 6 real (unmocked) bcrypt.compare calls, matching
  // production behavior — comfortably fast standalone, but the default 5s
  // test timeout can be tight under full-suite parallel CPU contention.
  // An explicit longer timeout costs nothing when the test is fast, and
  // avoids flaking a correctness assertion for reasons unrelated to
  // correctness.
  it('locks out after 5 failed attempts for the same userId (AUTH-004), matching login', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeChangePasswordDb() as never)

    let lastResult
    for (let i = 0; i < 6; i++) {
      lastResult = await changePassword('user-lockout-test', 'WrongPassword', 'NewLongEnoughPassword1')
    }

    expect(lastResult!.success).toBe(false)
    expect((lastResult as { error: { code: string } }).error.code).toBe('AUTH-004')
  }, 15000)

  it('does not lock out a different userId sharing no attempts with the failing one', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeChangePasswordDb() as never)

    for (let i = 0; i < 6; i++) {
      await changePassword('user-a-lockout', 'WrongPassword', 'NewLongEnoughPassword1')
    }
    const result = await changePassword('user-b-unaffected', OLD_PASSWORD, 'NewLongEnoughPassword1')

    expect(result.success).toBe(true)
  }, 15000)
})

describe('generateRecoveryCode', () => {
  it('produces a 19-character code in 4 groups of 4 separated by dashes, from an unambiguous alphabet', () => {
    const code = generateRecoveryCode()
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/)
  })

  it('produces different codes on successive calls (not a fixed/predictable value)', () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateRecoveryCode()))
    expect(codes.size).toBe(20)
  })
})

describe('resetPasswordWithRecoveryCode', () => {
  const RECOVERY_CODE = 'AB3D-EFGH-JK4M-N9PQ'
  const codeHash = bcrypt.hashSync(RECOVERY_CODE, 12)

  function makeRecoveryDb(overrides: Record<string, unknown> = {}) {
    return {
      setting: { findUnique: vi.fn().mockResolvedValue({ settingKey: 'recovery_code_hash', settingValue: codeHash }) },
      user: {
        findUnique: vi.fn().mockResolvedValue({ id: 'user-1', username: 'admin', isActive: true, passwordHash: 'irrelevant' }),
        update: vi.fn().mockResolvedValue({}),
      },
      ...overrides
    }
  }

  it('returns AUTH-005 when no recovery code has ever been generated for this install', async () => {
    vi.mocked(getPrisma).mockReturnValue({ setting: { findUnique: vi.fn().mockResolvedValue(null) } } as never)

    const result = await resetPasswordWithRecoveryCode('admin', RECOVERY_CODE, 'NewLongEnoughPassword1')

    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('AUTH-005')
  })

  it('rejects an unknown username with a generic error (no user enumeration)', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeRecoveryDb({ user: { findUnique: vi.fn().mockResolvedValue(null) } }) as never)

    const result = await resetPasswordWithRecoveryCode('nobody', RECOVERY_CODE, 'NewLongEnoughPassword1')

    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('AUTH-001')
  })

  it('rejects a deactivated user even with the correct code', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeRecoveryDb({
      user: { findUnique: vi.fn().mockResolvedValue({ id: 'user-1', username: 'admin', isActive: false, passwordHash: 'x' }) }
    }) as never)

    const result = await resetPasswordWithRecoveryCode('admin', RECOVERY_CODE, 'NewLongEnoughPassword1')

    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('AUTH-001')
  })

  it('rejects an incorrect recovery code', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeRecoveryDb() as never)

    const result = await resetPasswordWithRecoveryCode('admin', 'WRONG-CODE-0000-0000', 'NewLongEnoughPassword1')

    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('AUTH-001')
  })

  it('accepts the code regardless of case/spacing (normalized before comparison)', async () => {
    const db = makeRecoveryDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await resetPasswordWithRecoveryCode('accept-case-test-user', 'ab3d efgh jk4m n9pq', 'NewLongEnoughPassword1')

    expect(result.success).toBe(true)
  })

  it('succeeds with the correct code, hashes the new password, and clears any session token', async () => {
    const db = makeRecoveryDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await resetPasswordWithRecoveryCode('succeeds-test-user', RECOVERY_CODE, 'NewLongEnoughPassword1')

    expect(result.success).toBe(true)
    const updateCall = vi.mocked(db.user.update).mock.calls[0][0] as { data: { passwordHash: string; sessionToken: null; tokenExpiresAt: null } }
    expect(bcrypt.compareSync('NewLongEnoughPassword1', updateCall.data.passwordHash)).toBe(true)
    expect(updateCall.data.sessionToken).toBeNull()
    expect(updateCall.data.tokenExpiresAt).toBeNull()
  })

  it('rejects a new password shorter than the configured minimum', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeRecoveryDb() as never)

    const result = await resetPasswordWithRecoveryCode('short-pw-test-user', RECOVERY_CODE, 'short')

    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('VAL-001')
  })

  it('locks out after 5 failed attempts for the same username (AUTH-004)', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeRecoveryDb() as never)

    let lastResult
    for (let i = 0; i < 6; i++) {
      lastResult = await resetPasswordWithRecoveryCode('lockout-test-user', 'WRONG-CODE-0000-0000', 'NewLongEnoughPassword1')
    }

    expect(lastResult!.success).toBe(false)
    expect((lastResult as { error: { code: string } }).error.code).toBe('AUTH-004')
  }, 15000)
})

describe('regenerateRecoveryCode', () => {
  const CURRENT_PASSWORD = 'CurrentAdminPassword1'
  const currentHash = bcrypt.hashSync(CURRENT_PASSWORD, 12)

  function makeRegenDb() {
    return {
      user: { findUnique: vi.fn().mockResolvedValue({ id: 'user-1', passwordHash: currentHash }) },
      setting: { upsert: vi.fn().mockResolvedValue({}) },
    }
  }

  it('rejects an incorrect current password and does not rotate the code', async () => {
    const db = makeRegenDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await regenerateRecoveryCode('user-1', 'WrongPassword')

    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('AUTH-001')
    expect(db.setting.upsert).not.toHaveBeenCalled()
  })

  it('succeeds with the correct current password, storing only the hash and returning the plaintext code once', async () => {
    const db = makeRegenDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await regenerateRecoveryCode('user-1', CURRENT_PASSWORD)

    expect(result.success).toBe(true)
    const returnedCode = (result.data as { recoveryCode: string }).recoveryCode
    expect(returnedCode).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/)
    const upsertCall = vi.mocked(db.setting.upsert).mock.calls[0][0] as { update: { settingValue: string } }
    expect(upsertCall.update.settingValue).not.toBe(returnedCode)
    expect(bcrypt.compareSync(returnedCode, upsertCall.update.settingValue)).toBe(true)
  })
})
