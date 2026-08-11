import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))

import { getPrisma } from '../../database/db'
import { assertNotLocked, assertNotLockedOrThrow, transactionLockService } from '../transaction-lock.service'

function makeDb(lockDate: Date | null) {
  const profile = { id: 'bp-1', lockDate }
  return {
    businessProfile: {
      findFirst: vi.fn().mockResolvedValue(profile),
      update: vi.fn().mockImplementation(({ data }: { data: { lockDate: Date | null } }) => Promise.resolve({ ...profile, lockDate: data.lockDate })),
    },
  }
}

beforeEach(() => vi.clearAllMocks())

describe('transactionLockService.getLockDate', () => {
  // Real bug found live 2026-08-12 (LedgerSettingsScreen UAT against the
  // real app — a mocked-IPC unit test couldn't have caught this on its own,
  // since the test author's mock would just match whatever shape they
  // assumed): the service used to return the raw Prisma Date object, which
  // crossed the Electron contextBridge as a real JS Date, but the renderer
  // calls `lockDate.slice(0, 10)` assuming an ISO string — crashing
  // LedgerSettingsScreen's ErrorBoundary the instant a lock date was ever
  // set. This test locks in the actual contract: an ISO string, or null.
  it('returns lockDate as an ISO string, not a raw Date object', async () => {
    const d = new Date(2025, 11, 31)
    vi.mocked(getPrisma).mockReturnValue(makeDb(d) as never)

    const res = await transactionLockService.getLockDate()

    expect(res.success).toBe(true)
    expect(typeof (res as { data: { lockDate: unknown } }).data.lockDate).toBe('string')
    expect((res as { data: { lockDate: string } }).data.lockDate).toBe(d.toISOString())
  })

  it('returns null when no lock date is set', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeDb(null) as never)

    const res = await transactionLockService.getLockDate()

    expect(res.success).toBe(true)
    expect((res as { data: { lockDate: string | null } }).data.lockDate).toBeNull()
  })
})

describe('transactionLockService.setLockDate', () => {
  it('sets a lock date and returns it as an ISO string', async () => {
    const db = makeDb(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await transactionLockService.setLockDate('2025-12-31')

    expect(res.success).toBe(true)
    expect(typeof (res as { data: { lockDate: unknown } }).data.lockDate).toBe('string')
    expect(db.businessProfile.update).toHaveBeenCalledWith({ where: { id: 'bp-1' }, data: { lockDate: new Date(2025, 11, 31) } })
  })

  it('clears the lock date when passed null', async () => {
    const db = makeDb(new Date(2025, 11, 31))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await transactionLockService.setLockDate(null)

    expect(res.success).toBe(true)
    expect((res as { data: { lockDate: string | null } }).data.lockDate).toBeNull()
    expect(db.businessProfile.update).toHaveBeenCalledWith({ where: { id: 'bp-1' }, data: { lockDate: null } })
  })

  it('returns BP-001 when no business profile exists', async () => {
    const db = { businessProfile: { findFirst: vi.fn().mockResolvedValue(null), update: vi.fn() } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await transactionLockService.setLockDate('2025-12-31')

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('BP-001')
  })
})

describe('assertNotLocked', () => {
  it('allows a transaction dated after the lock date', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeDb(new Date(2025, 11, 31)) as never)

    const res = await assertNotLocked(new Date(2026, 0, 1))

    expect(res).toBeNull()
  })

  it('blocks a transaction dated exactly on the lock date', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeDb(new Date(2025, 11, 31)) as never)

    const res = await assertNotLocked(new Date(2025, 11, 31))

    expect(res).not.toBeNull()
    expect(res?.error.code).toBe('LOCK-001')
  })

  it('blocks a transaction dated before the lock date', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeDb(new Date(2025, 11, 31)) as never)

    const res = await assertNotLocked(new Date(2025, 5, 1))

    expect(res).not.toBeNull()
    expect(res?.error.code).toBe('LOCK-001')
  })

  it('allows anything when no lock date is set', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeDb(null) as never)

    const res = await assertNotLocked(new Date(2000, 0, 1))

    expect(res).toBeNull()
  })
})

describe('assertNotLockedOrThrow', () => {
  it('throws a ServiceError with code LOCK-001 for a locked date', async () => {
    const tx = makeDb(new Date(2025, 11, 31))

    await expect(assertNotLockedOrThrow(tx as never, new Date(2025, 11, 31))).rejects.toMatchObject({ code: 'LOCK-001' })
  })

  it('resolves without throwing for a date after the lock', async () => {
    const tx = makeDb(new Date(2025, 11, 31))

    await expect(assertNotLockedOrThrow(tx as never, new Date(2026, 0, 1))).resolves.toBeUndefined()
  })

  it('falls back to getPrisma() when no tx is passed', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeDb(null) as never)

    await expect(assertNotLockedOrThrow(undefined, new Date(2000, 0, 1))).resolves.toBeUndefined()
  })
})
