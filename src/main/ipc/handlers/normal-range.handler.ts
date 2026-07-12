import { requirePermission } from '../permission-guard'
import { listNormalRanges, saveNormalRange, deleteNormalRange, evaluateAgainstNormalRange, findNormalRange } from '../../services/normal-range.service'
import { SaveNormalRangeSchema } from '../../validation/normal-range.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('normalRange:list', async (payload) => {
    const deny = await requirePermission('clinicalNotes.view'); if (deny) return deny
    return listNormalRanges(payload as Parameters<typeof listNormalRanges>[0])
  })

  handle('normalRange:save', async (payload) => {
    const deny = await requirePermission('clinicalNotes.write'); if (deny) return deny
    const parsed = SaveNormalRangeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return saveNormalRange(parsed.data)
  })

  handle('normalRange:delete', async (payload) => {
    const deny = await requirePermission('clinicalNotes.write'); if (deny) return deny
    const { id } = payload as { id: string }
    return deleteNormalRange(id)
  })

  handle('normalRange:evaluate', async (payload) => {
    const deny = await requirePermission('clinicalNotes.view'); if (deny) return deny
    const p = payload as { testName?: string; value?: number; gender?: 'ALL' | 'MALE' | 'FEMALE' }
    if (!p?.testName || typeof p.value !== 'number' || Number.isNaN(p.value)) {
      return { success: false, error: { code: 'VAL-001', message: 'testName and a numeric value are required.' } }
    }
    const flag = await evaluateAgainstNormalRange(p.testName, p.value, p.gender ?? 'ALL')
    return { success: true, data: { flag } }
  })

  handle('normalRange:find', async (payload) => {
    const deny = await requirePermission('clinicalNotes.view'); if (deny) return deny
    const p = payload as { testName?: string; gender?: 'ALL' | 'MALE' | 'FEMALE' }
    if (!p?.testName) return { success: false, error: { code: 'VAL-001', message: 'testName is required.' } }
    const range = await findNormalRange(p.testName, p.gender ?? 'ALL')
    return { success: true, data: range }
  })
}
