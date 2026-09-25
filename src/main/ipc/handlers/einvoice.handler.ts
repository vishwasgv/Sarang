import { einvoiceService } from '../../services/einvoice.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { z } from 'zod'

const EwayBillSchema = z.object({
  invoiceId: z.string().min(1, 'Invoice is required'),
  mode: z.enum(['ROAD', 'RAIL', 'AIR', 'SHIP']),
  vehicleNumber: z.string().max(20).optional(),
  transporterId: z.string().max(20).optional(),
  transporterName: z.string().max(100).optional(),
  transportDocNo: z.string().max(30).optional(),
  transportDocDate: z.string().optional(),
  distanceKm: z.number().min(0).max(4000).optional()
})

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('einvoice:exportJson', async (payload) => {
    const deny = await requirePermission('reports.tax'); if (deny) return deny
    const { invoiceId } = (payload ?? {}) as { invoiceId?: string }
    if (!invoiceId) return { success: false, error: { code: 'VAL-001', message: 'Invoice is required.' } }
    return einvoiceService.exportJson(invoiceId)
  })

  handle('einvoice:exportEwayBill', async (payload) => {
    const deny = await requirePermission('reports.tax'); if (deny) return deny
    const parsed = EwayBillSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload.' } }
    const { invoiceId, ...transport } = parsed.data
    return einvoiceService.exportEwayBill(invoiceId, transport)
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
