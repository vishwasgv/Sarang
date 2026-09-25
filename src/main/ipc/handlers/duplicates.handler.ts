import { findCustomerDuplicateGroups, findSupplierDuplicateGroups } from '../../services/customer-checks'
import { mergePartiesService } from '../../services/merge-parties.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

const kindOf = (payload: unknown): 'Customer' | 'Supplier' | null => {
  const k = (payload as { kind?: string } | undefined)?.kind
  return k === 'Customer' || k === 'Supplier' ? k : null
}

export function register(handle: HandleFn): void {
  handle('duplicates:find', async (payload) => {
    const kind = kindOf(payload)
    if (!kind) return { success: false, error: { code: 'VAL-001', message: 'Choose customers or suppliers.' } }
    const deny = await requirePermission(kind === 'Customer' ? 'customers.view' : 'suppliers.view'); if (deny) return deny
    return { success: true, data: kind === 'Customer' ? await findCustomerDuplicateGroups() : await findSupplierDuplicateGroups() }
  })

  handle('duplicates:merge', async (payload) => {
    const kind = kindOf(payload)
    const { keepId, removeId } = (payload ?? {}) as { keepId?: string; removeId?: string }
    if (!kind || !keepId || !removeId) return { success: false, error: { code: 'VAL-001', message: 'Choose the record to keep and the one to merge.' } }
    const deny = await requirePermission(kind === 'Customer' ? 'customers.update' : 'suppliers.update'); if (deny) return deny
    const archive = await requirePermission(kind === 'Customer' ? 'customers.archive' : 'suppliers.archive'); if (archive) return archive
    return mergePartiesService.merge(kind, keepId, removeId, getCurrentSession()?.userId)
  })
}
