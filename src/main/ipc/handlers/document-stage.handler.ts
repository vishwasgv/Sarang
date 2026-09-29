import { z } from 'zod'
import { documentStageService } from '../../services/document-stage.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

const GetCurrentSchema = z.object({ documentType: z.string().min(1), documentId: z.string().min(1) })
const AdvanceSchema = z.object({ documentType: z.string().min(1), documentId: z.string().min(1), stageId: z.string().min(1) })

// Advancing a stage is a status-only change (no money/stock effect) — gated on the same
// permission that already lets someone create/edit that document type, not a new key.
// Unrecognized document types deny by default rather than falling back to something looser.
const EDIT_PERMISSION_BY_DOCUMENT_TYPE: Record<string, string> = {
  SALES_ORDER: 'salesOrders.create',
  PURCHASE_ORDER: 'purchaseOrders.create'
}

export function register(handle: HandleFn): void {
  handle('documentStage:getCurrent', async (payload) => {
    const parsed = GetCurrentSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: 'Invalid request.' } }
    const permKey = EDIT_PERMISSION_BY_DOCUMENT_TYPE[parsed.data.documentType]
    const deny = await requirePermission(permKey ?? 'settings.view'); if (deny) return deny
    return documentStageService.getCurrent(parsed.data.documentType, parsed.data.documentId)
  })

  handle('documentStage:advance', async (payload) => {
    const parsed = AdvanceSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: 'Invalid request.' } }
    const permKey = EDIT_PERMISSION_BY_DOCUMENT_TYPE[parsed.data.documentType]
    if (!permKey) return { success: false, error: { code: 'DSA-002', message: 'Blueprints are not available for this document type.' } }
    const deny = await requirePermission(permKey); if (deny) return deny
    return documentStageService.advance(parsed.data, getCurrentSession()?.userId)
  })
}
