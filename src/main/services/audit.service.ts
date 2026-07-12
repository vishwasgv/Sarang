import { createHash } from 'crypto'
import { getPrisma } from '../database/db'

type LogActionParams = {
  userId?: string
  action: string
  entityType?: string
  entityId?: string
  oldValue?: unknown
  newValue?: unknown
}

// Setting key holding the hash of the most recently written AuditLog row —
// the chain "tip". Claiming it inside the same $transaction as the insert is
// the exact atomic-claim pattern sequence.service.ts already established for
// document numbering: a plain SELECT on AuditLog itself doesn't acquire a
// write lock in SQLite, so two concurrent logAction calls could both read the
// same "latest row" before either commits; claiming this Setting row's own
// write is what forces them to serialize instead of both computing a hash
// against the same stale prevHash.
const CHAIN_TIP_KEY = 'audit_log_chain_tip'
const LAST_FAILURE_KEY = 'audit_log_last_failure_at'

function computeHash(row: {
  prevHash: string | null
  action: string
  entityType?: string | null
  entityId?: string | null
  oldValue?: string | null
  newValue?: string | null
  createdAt: string
  userId?: string | null
}): string {
  const material = [
    row.prevHash ?? '',
    row.action,
    row.entityType ?? '',
    row.entityId ?? '',
    row.oldValue ?? '',
    row.newValue ?? '',
    row.createdAt,
    row.userId ?? '',
  ].join('|')
  return createHash('sha256').update(material).digest('hex')
}

export async function logAction(
  userIdOrParams: string | undefined | LogActionParams,
  action?: string,
  entityType?: string,
  entityId?: string,
  oldValue?: unknown,
  newValue?: unknown
): Promise<void> {
  // Accept both object form and positional form
  const params: LogActionParams =
    typeof userIdOrParams === 'object' && userIdOrParams !== null
      ? userIdOrParams
      : {
          userId: userIdOrParams,
          action: action ?? '',
          entityType,
          entityId,
          oldValue,
          newValue,
        }

  const oldValueStr = params.oldValue ? JSON.stringify(params.oldValue) : undefined
  const newValueStr = params.newValue ? JSON.stringify(params.newValue) : undefined

  try {
    const db = getPrisma()
    const MAX_CHAIN_CLAIM_ATTEMPTS = 5
    for (let attempt = 1; ; attempt++) {
      try {
        await db.$transaction(async (tx) => {
          // Fresh-audit fix (2026-07-12): captured per-attempt, right where
          // the tip is read, not once at the top of the function. Under
          // real contention (09-stress.js's concurrent-invoice burst
          // surfaced this live) the row that actually wins the tip claim
          // and gets chained first can carry a LATER wall-clock timestamp
          // than the row chained immediately after it, if `createdAt` were
          // captured before the retry loop instead of at commit time — that
          // decouples createdAt ordering from true chain order, which
          // verifyAuditLogChain used to rely on (now fixed separately to
          // walk real hash links instead, but this is the actual root cause
          // worth closing too).
          const createdAt = new Date()
          const createdAtIso = createdAt.toISOString()
          const tip = await tx.setting.findUnique({ where: { settingKey: CHAIN_TIP_KEY } })
          const prevHash = tip?.settingValue ?? null
          const hash = computeHash({
            prevHash, action: params.action, entityType: params.entityType, entityId: params.entityId,
            oldValue: oldValueStr, newValue: newValueStr, createdAt: createdAtIso, userId: params.userId,
          })

          await tx.auditLog.create({
            data: {
              userId: params.userId,
              action: params.action,
              entityType: params.entityType,
              entityId: params.entityId,
              oldValue: oldValueStr,
              newValue: newValueStr,
              createdAt,
              prevHash,
              hash,
            }
          })

          // Atomic-claim pattern (matches appointment.service.ts's
          // APPT_CLAIM_SENTINEL use of updateMany): a plain read-then-write
          // of the tip Setting doesn't serialize concurrent logAction calls,
          // since SQLite's DEFERRED transactions don't take a write lock on
          // the read. Claiming via a conditional updateMany forces a second
          // concurrent writer to detect the tip moved since it read prevHash
          // and roll back (including its own just-inserted AuditLog row)
          // rather than silently overwrite the tip with a hash chained off a
          // stale prevHash.
          if (tip) {
            const claim = await tx.setting.updateMany({
              where: { settingKey: CHAIN_TIP_KEY, settingValue: tip.settingValue },
              data: { settingValue: hash },
            })
            if (claim.count === 0) throw new Error('AUDIT_CHAIN_TIP_CONTENDED')
          } else {
            try {
              await tx.setting.create({ data: { settingKey: CHAIN_TIP_KEY, settingValue: hash, settingType: 'STRING' } })
            } catch {
              // Concurrent first-ever logAction calls both hit the
              // "never initialized" bootstrap path — the loser's create
              // hits the unique constraint on settingKey.
              throw new Error('AUDIT_CHAIN_TIP_CONTENDED')
            }
          }
        })
        break
      } catch (err) {
        const contended = err instanceof Error && err.message === 'AUDIT_CHAIN_TIP_CONTENDED'
        if (contended && attempt < MAX_CHAIN_CLAIM_ATTEMPTS) continue
        throw err
      }
    }

    // Clear a previously-recorded failure now that a write has succeeded —
    // best-effort, must never throw past this point since the actual log
    // write above already succeeded.
    try {
      const db = getPrisma()
      const flagged = await db.setting.findUnique({ where: { settingKey: LAST_FAILURE_KEY } })
      if (flagged) await db.setting.delete({ where: { settingKey: LAST_FAILURE_KEY } })
    } catch { /* non-fatal */ }
  } catch {
    console.error('[Audit] Failed to log action:', params.action)
    // Surface the failure on the Dashboard (getDashboardAlerts) instead of
    // only a console line nobody watches — same mechanism F.5/F.8/F.9 already
    // use for "something silently didn't happen" conditions.
    try {
      const db = getPrisma()
      await db.setting.upsert({
        where: { settingKey: LAST_FAILURE_KEY },
        create: { settingKey: LAST_FAILURE_KEY, settingValue: new Date().toISOString(), settingType: 'STRING' },
        update: { settingValue: new Date().toISOString() },
      })
    } catch { /* genuinely nothing more we can do */ }
  }
}

export interface AuditChainVerifyResult {
  ok: boolean
  verifiedCount: number
  brokenAt?: { id: string; reason: 'hash_mismatch' | 'chain_break' }
}

// On-demand only (a Settings/Audit Log screen button), not run automatically
// on launch — walking a potentially large table is real work, and this
// project's own convention (F.8, F.10) is a manual click over background
// cost for anything that isn't itself time-sensitive.
//
// Only rows with a non-null `hash` are chained (pre-migration rows, and any
// row written before this feature shipped, are skipped — they were never
// designed to have one). The oldest surviving chained row's own `prevHash` is
// trusted as a boundary rather than re-derived, so routine pruning
// (pruneOldAuditLogs) never looks like tampering — this chain defends
// against silent edits/deletes of rows that still exist, not against "delete
// the whole tail and claim nothing happened before the new genesis".
export async function verifyAuditLogChain(): Promise<AuditChainVerifyResult> {
  const db = getPrisma()
  const rows = await db.auditLog.findMany({ where: { hash: { not: null } } })

  if (rows.length === 0) return { ok: true, verifiedCount: 0 }

  // Fresh-audit fix (2026-07-12): chain order must be reconstructed by
  // following prevHash → hash links, not by sorting rows on createdAt/id.
  // `createdAt` is captured in logAction() BEFORE it enters its atomic
  // tip-claim retry loop (see there), so under real contention the row that
  // actually wins the tip claim and gets chained first can carry a LATER
  // createdAt than the row chained immediately after it. Sorting by
  // createdAt then produces a false "chain_break" on a provably intact
  // chain — confirmed live under 09-stress.js's concurrent-invoice burst: a
  // "broken" row's prevHash exactly matched another row's hash, just one
  // with a later timestamp, proving the chain itself was never actually
  // broken. Walking the real prevHash → hash links is immune to this.
  type AuditRow = (typeof rows)[number]
  const byHash = new Map<string, AuditRow>(rows.map(r => [r.hash as string, r]))
  const byPrevHash = new Map<string, AuditRow[]>()
  for (const r of rows) {
    const key = r.prevHash ?? ''
    const list = byPrevHash.get(key) ?? []
    list.push(r)
    byPrevHash.set(key, list)
  }

  // Genesis: the surviving row whose prevHash doesn't resolve to any
  // surviving row's hash — either the true first-ever row (prevHash null)
  // or the oldest survivor after pruning (prevHash points to a
  // since-deleted row — the explicitly-tolerated pruning boundary, see the
  // comment above this function).
  const genesisCandidates = rows.filter(r => r.prevHash === null || !byHash.has(r.prevHash))
  if (genesisCandidates.length !== 1) {
    // Zero candidates (every row's prevHash resolves to another surviving
    // row — a cycle, impossible under honest writes) or more than one (a
    // fork — two rows both claiming no valid parent) are real integrity
    // failures, not a sort-order artifact.
    const first = genesisCandidates[0] ?? rows[0]
    return { ok: false, verifiedCount: 0, brokenAt: { id: first.id, reason: 'chain_break' } }
  }

  let current: AuditRow | undefined = genesisCandidates[0]
  let verifiedCount = 0
  const visited = new Set<string>()
  while (current) {
    visited.add(current.id)

    const expectedHash = computeHash({
      prevHash: current.prevHash, action: current.action, entityType: current.entityType, entityId: current.entityId,
      oldValue: current.oldValue, newValue: current.newValue, createdAt: current.createdAt.toISOString(), userId: current.userId,
    })
    if (expectedHash !== current.hash) {
      return { ok: false, verifiedCount, brokenAt: { id: current.id, reason: 'hash_mismatch' } }
    }
    verifiedCount++

    const children: AuditRow[] = byPrevHash.get(current.hash as string) ?? []
    if (children.length > 1) {
      // Two rows both claim the same parent hash as their prevHash — a
      // fork. logAction()'s atomic tip-claim should make this impossible
      // under honest writes.
      return { ok: false, verifiedCount, brokenAt: { id: children[1].id, reason: 'chain_break' } }
    }
    current = children[0]
  }

  if (verifiedCount !== rows.length) {
    // Rows exist that were never reached walking forward from genesis —
    // orphaned by a broken or rewritten link somewhere in the chain.
    const orphan = rows.find(r => !visited.has(r.id))!
    return { ok: false, verifiedCount, brokenAt: { id: orphan.id, reason: 'chain_break' } }
  }

  return { ok: true, verifiedCount }
}

// AuditLog previously had no retention policy at all — every mutation (and
// even some VIEWs) logs a row forever, so the table grows unbounded for the
// life of the install. Mirrors the existing backup_retention_count Setting
// pattern (backup.service.ts) rather than inventing a new mechanism. Default
// is deliberately generous (2 years) since audit trails carry compliance/
// dispute value — this prunes genuinely old rows, it isn't a space-saving
// measure aggressive enough to risk deleting anything a business might still
// need.
const DEFAULT_AUDIT_LOG_RETENTION_DAYS = 730

export async function pruneOldAuditLogs(): Promise<{ deletedCount: number }> {
  try {
    const db = getPrisma()
    const setting = await db.setting.findUnique({ where: { settingKey: 'audit_log_retention_days' } })
    const parsed = setting ? Number(setting.settingValue) : NaN
    const retentionDays = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_AUDIT_LOG_RETENTION_DAYS
    const cutoff = new Date(Date.now() - retentionDays * 86400000)
    const { count } = await db.auditLog.deleteMany({ where: { createdAt: { lt: cutoff } } })
    return { deletedCount: count }
  } catch {
    return { deletedCount: 0 }
  }
}

export async function getAuditLogs(params?: {
  userId?: string
  entityType?: string
  limit?: number
  offset?: number
}) {
  const db = getPrisma()
  return db.auditLog.findMany({
    where: {
      userId: params?.userId,
      entityType: params?.entityType
    },
    include: { user: { select: { fullName: true, username: true } } },
    orderBy: { createdAt: 'desc' },
    take: params?.limit ?? 100,
    skip: params?.offset ?? 0
  })
}
