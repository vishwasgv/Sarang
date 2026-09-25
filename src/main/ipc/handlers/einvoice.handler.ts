import { einvoiceService } from '../../services/einvoice.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('einvoice:exportJson', async (payload) => {
    const deny = await requirePermission('reports.tax'); if (deny) return deny
    const { invoiceId } = (payload ?? {}) as { invoiceId?: string }
    if (!invoiceId) return { success: false, error: { code: 'VAL-001', message: 'Invoice is required.' } }
    return einvoiceService.exportJson(invoiceId)
  })

  handle('einvoice:saveIrn', async (payload) => {
    const deny = await requirePermission('reports.tax'); if (deny) return deny
    const p = (payload ?? {}) as { invoiceId?: string; irn?: string; ackNo?: string; ackDate?: string; signedQr?: string }
    if (!p.invoiceId || !p.irn) return { success: false, error: { code: 'VAL-001', message: 'Invoice and IRN are required.' } }
    return einvoiceService.saveIrn({ invoiceId: p.invoiceId, irn: p.irn, ackNo: p.ackNo, ackDate: p.ackDate, signedQr: p.signedQr }, getCurrentSession()?.userId)
  })

  handle('einvoice:clearIrn', async (payload) => {
    const deny = await requirePermission('reports.tax'); if (deny) return deny
    const { invoiceId } = (payload ?? {}) as { invoiceId?: string }
    if (!invoiceId) return { success: false, error: { code: 'VAL-001', message: 'Invoice is required.' } }
    return einvoiceService.clearIrn(invoiceId, getCurrentSession()?.userId)
  })
}
