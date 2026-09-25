import { Prisma } from '@prisma/client'
import { getPrisma } from '../database/db'
import { ServiceError } from '../errors/service-error'
import { logAction } from './audit.service'

// Merge two records of the same customer (or supplier) into one: every record that points at the duplicate is
// moved to the one you keep, the balances are added, and the duplicate is archived with a note. The list of
// tables to move comes from the database model itself, so a table added later is included automatically.
// If a table allows only one row per party and both already have one, or moving rows would create a duplicate,
// nothing is changed and the merge stops.

export type PartyKind = 'Customer' | 'Supplier'

export interface MergeStep { model: string; delegate: string; field: string; unique: boolean }

interface DmmfField { name: string; kind: string; type: string; relationFromFields?: readonly string[]; isUnique?: boolean; isId?: boolean }
interface DmmfModel { name: string; fields: readonly DmmfField[]; uniqueFields?: readonly (readonly string[])[]; primaryKey?: { fields: readonly string[] } | null }

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)

/** Every table column that holds a customer (or supplier) id, and whether that column can hold only one row per party. */
export function planMerge(models: readonly DmmfModel[], kind: PartyKind): MergeStep[] {
  const steps: MergeStep[] = []
  for (const model of models) {
    for (const f of model.fields) {
      if (f.kind !== 'object' || f.type !== kind || !f.relationFromFields || f.relationFromFields.length !== 1) continue
      const fk = f.relationFromFields[0]
      const fkField = model.fields.find((x) => x.name === fk)
      const single = model.uniqueFields?.some((u) => u.length === 1 && u[0] === fk) ?? false
      steps.push({ model: model.name, delegate: lowerFirst(model.name), field: fk, unique: !!fkField?.isUnique || single })
    }
  }
  return steps
}

export const mergePartiesService = {
  async merge(kind: PartyKind, keepId: string, removeId: string, userId?: string) {
    try {
      if (keepId === removeId) throw new ServiceError('MERGE-001', 'Choose two different records.')
      const db = getPrisma() as unknown as Record<string, any>
      const delegateName = lowerFirst(kind)
      const [keep, remove] = await Promise.all([db[delegateName].findUnique({ where: { id: keepId } }), db[delegateName].findUnique({ where: { id: removeId } })])
      if (!keep || !remove) throw new ServiceError('MERGE-002', `${kind} not found.`)
      const steps = planMerge(Prisma.dmmf.datamodel.models as unknown as DmmfModel[], kind)

      const moved: Record<string, number> = {}
      await (getPrisma() as any).$transaction(async (tx: Record<string, any>) => {
        for (const step of steps) {
          const table = tx[step.delegate]
          if (!table) continue
          if (step.unique) {
            const [a, b] = await Promise.all([table.findFirst({ where: { [step.field]: keepId } }), table.findFirst({ where: { [step.field]: removeId } })])
            if (a && b) throw new ServiceError('MERGE-003', `Both records already have an entry in ${step.model}, which allows only one. Nothing was merged.`)
          }
          const result = await table.updateMany({ where: { [step.field]: removeId }, data: { [step.field]: keepId } })
          if (result.count > 0) moved[step.model] = (moved[step.model] ?? 0) + result.count
        }
        // A customer's running balance is kept on the row; the moved entries now belong to the kept record.
        const extra = kind === 'Customer' ? { outstandingBalance: (keep.outstandingBalance ?? 0) + (remove.outstandingBalance ?? 0) } : {}
        await tx[delegateName].update({ where: { id: keepId }, data: extra })
        const stamp = `Merged into ${kind === 'Customer' ? keep.customerName : keep.supplierName} (${keep.customerCode ?? keep.supplierCode ?? keepId}).`
        await tx[delegateName].update({
          where: { id: removeId },
          data: { isActive: false, notes: [remove.notes, stamp].filter(Boolean).join('\n'), ...(kind === 'Customer' ? { outstandingBalance: 0, phone: null } : {}) }
        })
      })
      await logAction({ userId, action: 'PARTY_MERGED', entityType: kind, entityId: keepId, newValue: { removedId: removeId, moved } })
      return { success: true, data: { moved } }
    } catch (err) {
      if (err instanceof ServiceError) return { success: false, error: { code: err.code, message: err.message } }
      if ((err as { code?: string } | null)?.code === 'P2002') return { success: false, error: { code: 'MERGE-003', message: 'Moving the records would create a duplicate entry, so nothing was merged.' } }
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Could not merge the records.' } }
    }
  }
}
