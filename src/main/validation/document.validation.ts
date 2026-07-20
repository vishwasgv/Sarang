import { z } from 'zod'

export const DocumentEntityTypeSchema = z.enum([
  'INVOICE',
  'PURCHASE_ORDER',
  'CUSTOMER',
  'SUPPLIER',
  'EXPENSE',
  'PRODUCTION_ORDER',
  'DRAWING_REVISION',
  'SITE_VISIT',
  'LEGAL_CASE',
  'COMPLIANCE_TASK',
  'ENGAGEMENT',
  'ROC_FILING',
  'BOARD_MEETING',
  'VISIT_NOTE',
  'TREATMENT_PLAN',
  'LAB_TEST_ORDER',
  'RENTAL_BOOKING_ITEM',
  // Phase 58 §2 — Beauty Salon before/after photo attachment per appointment.
  'APPOINTMENT',
  // Phase 58 §2 — Placement Agency resume/CV attachment.
  'CANDIDATE',
])

export const AttachDocumentSchema = z.object({
  sourcePath: z.string().min(1, 'sourcePath is required'),
  fileName: z.string().min(1, 'fileName is required'),
  entityType: DocumentEntityTypeSchema,
  entityId: z.string().min(1, 'entityId is required'),
  notes: z.string().max(2000).optional(),
})

export const DeleteDocumentSchema = z.object({
  id: z.string().min(1, 'id is required'),
})

export type AttachDocumentPayload = z.infer<typeof AttachDocumentSchema>
export type DeleteDocumentPayload = z.infer<typeof DeleteDocumentSchema>
