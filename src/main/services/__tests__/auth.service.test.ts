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
  generateRecoveryCode, resetPasswordWithRecoveryCode, regenerateRecoveryCode,
  getPasswordExpiryDays, getPasswordHistoryCount, isPasswordExpired, checkPasswordNotReused
} from '../auth.service'

// Real Setting-table-shaped mock — needed because the rate limiter
// (2026-08-03 fix, now DB-backed instead of an in-memory Map) reads its own
// counter via db.setting.findUnique and writes it back via upsert/update,
// and must genuinely persist across the repeated calls a single "locks out
// after N attempts" test makes. A static mockResolvedValue (the previous
// pattern here) would return the SAME canned row regardless of which
// settingKey was actually queried — silently feeding e.g. the
// password_min_length fixture into the rate limiter's own lookup.
function makeSettingStore(initial: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(initial))
  return {
    findUnique: vi.fn(({ where }: { where: { settingKey: string } }) => {
      const v = store.get(where.settingKey)
      return Promise.resolve(v === undefined ? null : { settingKey: where.settingKey, settingValue: v })
    }),
    upsert: vi.fn(({ where, create, update }: { where: { settingKey: string }; create?: { settingValue: string }; update?: { settingValue: string } }) => {
      const value = store.has(where.settingKey) ? (update?.settingValue ?? '') : (create?.settingValue ?? '')
      store.set(where.settingKey, value)
      return Promise.resolve({ settingKey: where.settingKey, settingValue: value })
    }),
    update: vi.fn(({ where, data }: { where: { settingKey: string }; data: { settingValue: string } }) => {
      store.set(where.settingKey, data.settingValue)
      return Promise.resolve({ settingKey: where.settingKey, settingValue: data.settingValue })
    }),
    // Real Prisma rejects create() on a @unique collision — the rate
    // limiter's atomic-claim CAS (2026-08 fix) relies on that rejection to
    // detect a concurrent caller that created the row first.
    create: vi.fn(({ data }: { data: { settingKey: string; settingValue: string } }) => {
      if (store.has(data.settingKey)) {
        return Promise.reject(Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }))
      }
      store.set(data.settingKey, data.settingValue)
      return Promise.resolve({ settingKey: data.settingKey, settingValue: data.settingValue })
    }),
    // Real Prisma's updateMany only touches rows matching the full `where`
    // clause and reports how many it changed — the rate limiter's CAS keys
    // `where.settingValue` on the previously-read value so a concurrent
    // writer that already changed it causes `count: 0` (contention) instead
    // of silently overwriting a newer value.
    updateMany: vi.fn(({ where, data }: { where: { settingKey: string; settingValue?: string }; data: { settingValue: string } }) => {
      const current = store.get(where.settingKey)
      if (current === undefined) return Promise.resolve({ count: 0 })
      if (where.settingValue !== undefined && where.settingValue !== current) return Promise.resolve({ count: 0 })
      store.set(where.settingKey, data.settingValue)
      return Promise.resolve({ count: 1 })
    }),
    delete: vi.fn(({ where }: { where: { settingKey: string } }) => {
      store.delete(where.settingKey)
      return Promise.resolve({})
    }),
  }
}

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
      setting: makeSettingStore({ password_min_length: '10' }),
      passwordHistory: { create: vi.fn().mockResolvedValue({}), findMany: vi.fn().mockResolvedValue([]) },
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

  // REAL BUG regression (found in this session's pre-release audit): the
  // rate limiter's old findUnique-then-upsert/update was not atomic — a
  // scripted burst of concurrent calls (Promise.all, as a malicious/buggy
  // renderer could fire via repeated IPC calls) could all read the same
  // pre-increment count and all proceed as blocked:false, letting far more
  // than maxAttempts guesses through per window. Fixed via a claim-and-retry
  // compare-and-swap (see makeRateLimiter). This test fires 10 concurrent
  // wrong-password attempts for one userId and asserts AT MOST 5 of them
  // report blocked:false — i.e. the 6th-through-10th genuinely serialize
  // behind the CAS and correctly see themselves as the 6th+ attempt, rather
  // than all racing past on stale reads.
  it('serializes concurrent attempts correctly — a 10-way burst never allows more than 5 through (AUTH-004 race fix)', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeChangePasswordDb() as never)

    const results = await Promise.all(
      Array.from({ length: 10 }, () => changePassword('user-concurrent-burst', 'WrongPassword', 'NewLongEnoughPassword1'))
    )

    const unlocked = results.filter((r) => (r as { error?: { code: string } }).error?.code !== 'AUTH-004')
    expect(unlocked.length).toBeLessThanOrEqual(5)
  }, 15000)

  it('does not lock out a different userId sharing no attempts with the failing one', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeChangePasswordDb() as never)

    for (let i = 0; i < 6; i++) {
      await changePassword('user-a-lockout', 'WrongPassword', 'NewLongEnoughPassword1')
    }
    const result = await changePassword('user-b-unaffected', OLD_PASSWORD, 'NewLongEnoughPassword1')

    expect(result.success).toBe(true)
  }, 15000)

  // REAL BUG found+fixed 2026-08-03 (security audit): the rate limiter used
  // to be a plain in-memory Map local to the main process — anyone with
  // local access could reset the attempt counter to zero simply by closing
  // and relaunching the app, making the lockout purely cosmetic. Now
  // persisted via db.setting, so it must survive the limiter's own module
  // being freshly re-imported (vi.resetModules simulates the app-restart
  // scenario the bug was about) as long as the underlying DB row persists.
  it('lockout survives a fresh re-import of the module (simulated app restart) as long as the DB row persists', async () => {
    const db = makeChangePasswordDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    for (let i = 0; i < 5; i++) {
      await changePassword('user-restart-test', 'WrongPassword', 'NewLongEnoughPassword1')
    }

    vi.resetModules()
    const fresh = await import('../auth.service')
    const freshGetPrisma = (await import('../../database/db')).getPrisma
    vi.mocked(freshGetPrisma).mockReturnValue(db as never)

    const result = await fresh.changePassword('user-restart-test', OLD_PASSWORD, 'NewLongEnoughPassword1')

    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('AUTH-004')
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
      setting: makeSettingStore({ recovery_code_hash: codeHash, password_min_length: '10' }),
      user: {
        findUnique: vi.fn().mockResolvedValue({ id: 'user-1', username: 'admin', isActive: true, passwordHash: 'irrelevant' }),
        update: vi.fn().mockResolvedValue({}),
      },
      passwordHistory: { create: vi.fn().mockResolvedValue({}), findMany: vi.fn().mockResolvedValue([]) },
      ...overrides
    }
  }

  it('returns AUTH-005 when no recovery code has ever been generated for this install', async () => {
    vi.mocked(getPrisma).mockReturnValue({ setting: makeSettingStore() } as never)

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

describe('Password Policy — expiry', () => {
  it('getPasswordExpiryDays defaults to 0 (disabled) with no Setting row', async () => {
    vi.mocked(getPrisma).mockReturnValue({ setting: { findUnique: vi.fn().mockResolvedValue(null) } } as never)
    expect(await getPasswordExpiryDays()).toBe(0)
  })

  it('isPasswordExpired is always false when expiry is disabled, regardless of age', async () => {
    vi.mocked(getPrisma).mockReturnValue({ setting: { findUnique: vi.fn().mockResolvedValue(null) } } as never)
    const tenYearsAgo = new Date(Date.now() - 10 * 365 * 24 * 60 * 60 * 1000)
    expect(await isPasswordExpired(tenYearsAgo)).toBe(false)
  })

  it('isPasswordExpired is true once the password is older than the configured number of days', async () => {
    vi.mocked(getPrisma).mockReturnValue({
      setting: { findUnique: vi.fn().mockResolvedValue({ settingKey: 'password_expiry_days', settingValue: '90' }) },
    } as never)
    const ninetyOneDaysAgo = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000)
    expect(await isPasswordExpired(ninetyOneDaysAgo)).toBe(true)
  })

  it('isPasswordExpired is false when the password is younger than the configured number of days', async () => {
    vi.mocked(getPrisma).mockReturnValue({
      setting: { findUnique: vi.fn().mockResolvedValue({ settingKey: 'password_expiry_days', settingValue: '90' }) },
    } as never)
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
    expect(await isPasswordExpired(tenDaysAgo)).toBe(false)
  })
})

describe('Password Policy — history (reuse prevention)', () => {
  const currentHash = bcrypt.hashSync('CurrentPassword1', 12)

  it('getPasswordHistoryCount defaults to 0 (disabled) with no Setting row', async () => {
    vi.mocked(getPrisma).mockReturnValue({ setting: { findUnique: vi.fn().mockResolvedValue(null) } } as never)
    expect(await getPasswordHistoryCount()).toBe(0)
  })

  it('never checks history at all when disabled — a repeat of the current password is allowed through', async () => {
    const db = { setting: { findUnique: vi.fn().mockResolvedValue(null) }, passwordHistory: { findMany: vi.fn() } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await checkPasswordNotReused('user-1', 'CurrentPassword1', currentHash)

    expect(result).toBeNull()
    expect(db.passwordHistory.findMany).not.toHaveBeenCalled()
  })

  it('rejects re-using the current live password when history checking is enabled', async () => {
    const db = {
      setting: { findUnique: vi.fn().mockResolvedValue({ settingKey: 'password_history_count', settingValue: '3' }) },
      passwordHistory: { findMany: vi.fn().mockResolvedValue([]) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await checkPasswordNotReused('user-1', 'CurrentPassword1', currentHash)

    expect(result?.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('AUTH-006')
  })

  it('rejects re-using a password found among the most recent N history rows', async () => {
    const oldHash = bcrypt.hashSync('OldPassword2', 12)
    const db = {
      setting: { findUnique: vi.fn().mockResolvedValue({ settingKey: 'password_history_count', settingValue: '3' }) },
      passwordHistory: { findMany: vi.fn().mockResolvedValue([{ passwordHash: oldHash }]) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await checkPasswordNotReused('user-1', 'OldPassword2', currentHash)

    expect(result?.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('AUTH-006')
  })

  it('allows a genuinely new password not found in the current hash or recent history', async () => {
    const oldHash = bcrypt.hashSync('OldPassword2', 12)
    const db = {
      setting: { findUnique: vi.fn().mockResolvedValue({ settingKey: 'password_history_count', settingValue: '3' }) },
      passwordHistory: { findMany: vi.fn().mockResolvedValue([{ passwordHash: oldHash }]) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await checkPasswordNotReused('user-1', 'GenuinelyNewPassword9', currentHash)

    expect(result).toBeNull()
  })

  it('only queries the configured N most recent history rows', async () => {
    const db = {
      setting: { findUnique: vi.fn().mockResolvedValue({ settingKey: 'password_history_count', settingValue: '5' }) },
      passwordHistory: { findMany: vi.fn().mockResolvedValue([]) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await checkPasswordNotReused('user-1', 'GenuinelyNewPassword9', currentHash)

    expect(db.passwordHistory.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 5 }))
  })
})
