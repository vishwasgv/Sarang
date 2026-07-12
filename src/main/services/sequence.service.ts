import { getPrisma } from '../database/db'

type PrismaTx = Parameters<Parameters<ReturnType<typeof getPrisma>['$transaction']>[0]>[0]

// Thrown when a concurrent caller claimed the tip Setting row first — see
// the atomic-claim comment below. Callers don't need to catch this
// specifically: it propagates up through their own $transaction() (rolling
// it back entirely, including their own record insert) and the IPC layer's
// generic handler converts it to a normal "please try again" response —
// exactly the same user-visible outcome as the pre-existing @unique
// constraint safety net already produced under this race, just reached via
// an explicit, controlled, early throw instead of a late DB-level collision.
export class SequenceContendedError extends Error {
  constructor(seqKey: string) {
    super(`Sequence "${seqKey}" was claimed by a concurrent transaction.`)
    this.name = 'SequenceContendedError'
  }
}

// Atomic, gap-tolerant document-number generator backed by a `Setting` row —
// same mechanism billing.service.ts's generateInvoiceNumber already uses.
// Must be called with a `tx` that is already inside the same $transaction as
// the record being created. A plain SELECT on the target table does not
// acquire a write lock in SQLite, so two concurrent transactions can both
// read the same "last number" before either commits; claiming the tip via a
// conditional `updateMany` (matching audit.service.ts's logAction and
// appointment.service.ts's APPT_CLAIM_SENTINEL) is what actually closes
// that race — a plain unconditional `update` (the old approach here) still
// let both transactions "successfully" write, just with the second one
// silently overwriting the first's claim with a value computed from the
// same stale read, relying entirely on the target table's own @unique
// constraint to catch the resulting collision instead of preventing it.
//
// `bootstrapFromExisting` only runs the first time this seqKey is ever used
// — existing installs already have rows numbered by the old
// findFirst+increment scheme, so this must resolve to the highest number
// already in use rather than restart at 1 and collide with legacy data.
export async function generateSequenceNumber(
  tx: PrismaTx,
  seqKey: string,
  prefix: string,
  padLength: number,
  bootstrapFromExisting: () => Promise<number>
): Promise<string> {
  const existing = await tx.setting.findUnique({ where: { settingKey: seqKey } })

  let nextNum: number
  if (existing) {
    nextNum = parseInt(existing.settingValue, 10) + 1
    const claim = await tx.setting.updateMany({
      where: { settingKey: seqKey, settingValue: existing.settingValue },
      data: { settingValue: String(nextNum) }
    })
    if (claim.count === 0) throw new SequenceContendedError(seqKey)
  } else {
    const currentMax = await bootstrapFromExisting()
    nextNum = currentMax + 1
    try {
      await tx.setting.create({ data: { settingKey: seqKey, settingValue: String(nextNum), settingType: 'NUMBER' } })
    } catch {
      // Two transactions both hit the "never initialized" bootstrap path at
      // once (only possible on the very first call for this seqKey) — the
      // loser's create hits the unique constraint. Treated the same as a
      // contended claim (roll back and let the caller retry) rather than
      // the old graceful-fallback update, which was itself just a smaller,
      // rarer instance of the exact same unconditional-write race.
      throw new SequenceContendedError(seqKey)
    }
  }

  return `${prefix}-${String(nextNum).padStart(padLength, '0')}`
}
