import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))

import { getPrisma } from '../../database/db'
import { pruneOldAuditLogs, logAction, verifyAuditLogChain } from '../audit.service'

// Phase 54D — AuditLog previously had no retention policy at all and grew
// unbounded forever. pruneOldAuditLogs mirrors the existing
// backup_retention_count Setting pattern (backup.service.ts).

describe('audit.service — pruneOldAuditLogs', () => {
  beforeEach(() => vi.clearAllMocks())

  function makeDb(settingValue?: string) {
    return {
      setting: { findUnique: vi.fn().mockResolvedValue(settingValue !== undefined ? { settingValue } : null) },
      auditLog: { deleteMany: vi.fn().mockResolvedValue({ count: 3 }) },
    }
  }

  it('defaults to a 730-day retention window when no setting is configured', async () => {
    const db = makeDb(undefined)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await pruneOldAuditLogs()

    const call = db.auditLog.deleteMany.mock.calls[0][0] as { where: { createdAt: { lt: Date } } }
    const daysAgo = (Date.now() - call.where.createdAt.lt.getTime()) / 86400000
    expect(daysAgo).toBeCloseTo(730, 0)
  })

  it('honors a configured audit_log_retention_days setting', async () => {
    const db = makeDb('30')
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await pruneOldAuditLogs()

    const call = db.auditLog.deleteMany.mock.calls[0][0] as { where: { createdAt: { lt: Date } } }
    const daysAgo = (Date.now() - call.where.createdAt.lt.getTime()) / 86400000
    expect(daysAgo).toBeCloseTo(30, 0)
  })

  it('falls back to the default when the setting is not a valid positive number', async () => {
    const db = makeDb('not-a-number')
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await pruneOldAuditLogs()

    const call = db.auditLog.deleteMany.mock.calls[0][0] as { where: { createdAt: { lt: Date } } }
    const daysAgo = (Date.now() - call.where.createdAt.lt.getTime()) / 86400000
    expect(daysAgo).toBeCloseTo(730, 0)
  })

  it('returns the deleted count and never throws even if the DB call fails', async () => {
    const db = { setting: { findUnique: vi.fn().mockRejectedValue(new Error('boom')) }, auditLog: { deleteMany: vi.fn() } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await pruneOldAuditLogs()

    expect(result).toEqual({ deletedCount: 0 })
  })

  it('reports the actual deleted count on success', async () => {
    const db = makeDb('365')
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await pruneOldAuditLogs()

    expect(result).toEqual({ deletedCount: 3 })
  })
})

// Phase 54F.15 — tamper-evident hash chain. Mocks a real, mutable in-memory
// Setting/AuditLog store so logAction's atomic chain-tip-claim transaction
// and verifyAuditLogChain's walk can be exercised end-to-end, the same way a
// real SQLite-backed $transaction would behave.
describe('audit.service — hash chain (logAction / verifyAuditLogChain)', () => {
  beforeEach(() => vi.clearAllMocks())

  function makeChainDb() {
    const settings = new Map<string, string>()
    const logs: Array<Record<string, unknown>> = []
    let idCounter = 0

    const settingApi = {
      findUnique: vi.fn(async ({ where }: { where: { settingKey: string } }) =>
        settings.has(where.settingKey) ? { settingKey: where.settingKey, settingValue: settings.get(where.settingKey) } : null),
      update: vi.fn(async ({ where, data }: { where: { settingKey: string }; data: { settingValue: string } }) => {
        settings.set(where.settingKey, data.settingValue); return {}
      }),
      updateMany: vi.fn(async ({ where, data }: { where: { settingKey: string; settingValue: string | null }; data: { settingValue: string } }) => {
        const current = settings.has(where.settingKey) ? settings.get(where.settingKey) : null
        if ((current ?? null) !== (where.settingValue ?? null)) return { count: 0 }
        settings.set(where.settingKey, data.settingValue)
        return { count: 1 }
      }),
      create: vi.fn(async ({ data }: { data: { settingKey: string; settingValue: string } }) => {
        settings.set(data.settingKey, data.settingValue); return {}
      }),
      delete: vi.fn(async ({ where }: { where: { settingKey: string } }) => { settings.delete(where.settingKey); return {} }),
      upsert: vi.fn(async ({ where, create, update }: { where: { settingKey: string }; create: { settingValue: string }; update: { settingValue: string } }) => {
        settings.set(where.settingKey, settings.has(where.settingKey) ? update.settingValue : create.settingValue); return {}
      }),
    }
    const auditLogApi = {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: 'row-' + (idCounter++), ...data }
        logs.push(row)
        return row
      }),
      findMany: vi.fn(async () => logs.filter((r) => r.hash !== null && r.hash !== undefined)),
    }
    const tx = { setting: settingApi, auditLog: auditLogApi }
    const db = {
      setting: settingApi,
      auditLog: auditLogApi,
      // Simulates real rollback-on-throw so a contended chain-tip claim
      // (which throws to abort the attempt) doesn't leave its own
      // already-pushed AuditLog row behind — matching what a real
      // db.$transaction does when its callback throws.
      $transaction: vi.fn(async (fn: (txArg: typeof tx) => Promise<unknown>) => {
        const logsSnapshotLength = logs.length
        const settingsSnapshot = new Map(settings)
        try {
          return await fn(tx)
        } catch (err) {
          logs.length = logsSnapshotLength
          settings.clear()
          for (const [k, v] of settingsSnapshot) settings.set(k, v)
          throw err
        }
      }),
    }
    return { db, settings, logs }
  }

  it('logAction writes the first row as a genesis (null prevHash) with a real computed hash', async () => {
    const { db, logs } = makeChainDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await logAction({ action: 'USER_LOGIN', userId: 'u1' })

    expect(logs).toHaveLength(1)
    expect(logs[0].prevHash).toBeNull()
    expect(typeof logs[0].hash).toBe('string')
    expect((logs[0].hash as string).length).toBe(64) // sha256 hex digest
  })

  it('logAction chains each subsequent row to the previous row\'s hash', async () => {
    const { db, logs } = makeChainDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await logAction({ action: 'USER_LOGIN', userId: 'u1' })
    await logAction({ action: 'PASSWORD_CHANGED', userId: 'u1' })
    await logAction({ action: 'USER_LOGOUT', userId: 'u1' })

    expect(logs[1].prevHash).toBe(logs[0].hash)
    expect(logs[2].prevHash).toBe(logs[1].hash)
  })

  it('verifyAuditLogChain reports a clean chain as intact', async () => {
    const { db } = makeChainDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    await logAction({ action: 'A' }); await logAction({ action: 'B' }); await logAction({ action: 'C' })

    const result = await verifyAuditLogChain()

    expect(result).toEqual({ ok: true, verifiedCount: 3 })
  })

  it('verifyAuditLogChain detects a hand-edited row (hash mismatch)', async () => {
    const { db, logs } = makeChainDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    await logAction({ action: 'A' }); await logAction({ action: 'B' }); await logAction({ action: 'C' })
    logs[1].action = 'TAMPERED' // edited in place, hash not recomputed — exactly what a direct SQL edit would do

    const result = await verifyAuditLogChain()

    expect(result.ok).toBe(false)
    expect(result.brokenAt?.reason).toBe('hash_mismatch')
    expect(result.brokenAt?.id).toBe(logs[1].id)
    expect(result.verifiedCount).toBe(1) // row 0 verified clean before hitting the tampered row
  })

  it('verifyAuditLogChain detects a deleted middle row (chain break)', async () => {
    const { db, logs } = makeChainDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    await logAction({ action: 'A' }); await logAction({ action: 'B' }); await logAction({ action: 'C' })
    logs.splice(1, 1) // remove the middle row — row C's prevHash now points at a hash that no longer exists in the surviving set

    const result = await verifyAuditLogChain()

    expect(result.ok).toBe(false)
    expect(result.brokenAt?.reason).toBe('chain_break')
  })

  it('does not false-positive after routine pruning removes the oldest rows', async () => {
    const { db, logs } = makeChainDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    await logAction({ action: 'A' }); await logAction({ action: 'B' }); await logAction({ action: 'C' })
    logs.splice(0, 1) // simulate pruneOldAuditLogs deleting the oldest row — a real, expected operation, not tampering

    const result = await verifyAuditLogChain()

    // The oldest surviving row's own prevHash is trusted as a boundary rather
    // than re-derived, so this must report a clean chain over the 2 remaining rows.
    expect(result).toEqual({ ok: true, verifiedCount: 2 })
  })

  it('logAction retries the whole write when the chain-tip claim is contended, and still produces a correctly-chained row', async () => {
    const { db, logs, settings } = makeChainDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    await logAction({ action: 'A' })
    const tipAfterA = settings.get('audit_log_chain_tip')

    // Simulate a concurrent writer winning the claim on the first attempt
    // (the exact scenario bug #2 hit: two transactions both read the same
    // stale tip). The real updateMany would return count:0 here because the
    // tip Setting's current value no longer matches the `where` clause's
    // expected prevHash-derived value.
    db.setting.updateMany.mockImplementationOnce(async () => ({ count: 0 }))

    await logAction({ action: 'B' })

    expect(db.setting.updateMany).toHaveBeenCalledTimes(2) // 1 contended + 1 successful retry
    expect(logs).toHaveLength(2) // the contended attempt's AuditLog insert was rolled back, not left orphaned
    expect(logs[1].prevHash).toBe(tipAfterA)
    expect(settings.get('audit_log_chain_tip')).toBe(logs[1].hash)

    const result = await verifyAuditLogChain()
    expect(result).toEqual({ ok: true, verifiedCount: 2 })
  })

  it('verifies a correctly-chained set of rows even when findMany returns them out of chain order (the 2026-07-12 fresh-audit fix)', async () => {
    // Reproduces the real bug found live under 09-stress.js's concurrent-
    // invoice burst: logAction() used to capture `createdAt` once at the top
    // of the function, before its atomic tip-claim retry loop — so under
    // contention, the row that actually won the tip claim and got chained
    // FIRST could carry a LATER createdAt than the row chained after it.
    // The old verifyAuditLogChain sorted by createdAt/id and treated that
    // sort as chain order, so it reported a false "chain_break" on a
    // provably intact chain. This test doesn't rely on createdAt/id at all —
    // it directly simulates findMany returning genuinely correctly-chained
    // rows in a scrambled array order (exactly what a createdAt-based sort
    // would produce for the real bug's timestamps) and asserts the walk-by-
    // hash-links implementation is immune to it.
    const { db, logs } = makeChainDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    await logAction({ action: 'A' }); await logAction({ action: 'B' }); await logAction({ action: 'C' })
    expect(logs.map(l => l.action)).toEqual(['A', 'B', 'C']) // sanity: real chain order is A -> B -> C

    // Scramble the array order findMany returns — the fixed implementation
    // must reconstruct A -> B -> C by following prevHash/hash links, not by
    // trusting array order (which stood in for the old createdAt sort).
    const scrambled = [logs[2], logs[0], logs[1]]
    db.auditLog.findMany.mockResolvedValueOnce(scrambled as never)

    const result = await verifyAuditLogChain()

    expect(result).toEqual({ ok: true, verifiedCount: 3 })
  })

  it('logAction failure sets the last-failure Setting; a subsequent success clears it', async () => {
    const { db, settings } = makeChainDb()
    // failingDb shares the same underlying `settings` Map (via the same
    // `setting` API object) so the catch block's own getPrisma() call still
    // writes to state we can assert on, while the write itself fails.
    const failingDb = { ...db, $transaction: vi.fn().mockRejectedValue(new Error('disk full')) }
    vi.mocked(getPrisma).mockReturnValue(failingDb as never)
    await logAction({ action: 'WILL_FAIL' })
    expect(settings.get('audit_log_last_failure_at')).toBeDefined()

    // Second call against the real (working) mock db clears the flag
    vi.mocked(getPrisma).mockReturnValue(db as never)
    await logAction({ action: 'WILL_SUCCEED' })
    expect(settings.has('audit_log_last_failure_at')).toBe(false)
  })
})
