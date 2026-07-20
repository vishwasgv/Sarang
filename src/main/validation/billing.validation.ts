import { z } from 'zod'

const InvoiceItemSchema = z.object({
  productId: z.string().min(1, 'Product is required'),
  quantity: z.number().positive('Quantity must be greater than zero'),
  unitPrice: z.number().min(0, 'Unit price cannot be negative'),
  discountAmount: z.number().min(0).default(0),
  taxRate: z.number().min(0).max(100).optional(),
  variantId: z.string().optional(),
  variantInfo: z.string().max(100).optional(),
  serialId: z.string().optional(),
  // Phase 38: snapshot of the unit this line was billed in (e.g. "kg") — null/absent
  // for a normal pack-quantity line. See PHASE_38_TECHNICAL_SPEC.md Section 1.2.
  weightUnit: z.string().optional(),
  // Fresh-audit fix (2026-07-12): the purity/weight/making-charge breakdown a
  // jewellery cart line was actually priced from — snapshotted from the
  // renderer (which already computed it against today's metal rate at
  // add-to-cart time) rather than re-derived server-side, since the rate may
  // have since changed and this must reflect what the customer was actually
  // charged, not today's current rate at submit time.
  jewelleryMetalType: z.string().optional(),
  jewelleryPurity: z.string().optional(),
  jewelleryNetWeight: z.number().min(0).optional(),
  jewelleryRatePerGram: z.number().min(0).optional(),
  jewelleryMakingCharge: z.number().min(0).optional(),
  // Phase 58 §2 — hallmark/HUID number, same snapshot-at-sale-time reasoning
  // as the other jewellery fields above.
  jewelleryHallmarkNumber: z.string().max(100).optional(),
  // Phase 58 §2 — Pharmacy Schedule H/H1 prescription capture, snapshotted
  // from the renderer at sale time — billing.service.ts requires these to
  // be present (non-empty) when the underlying product has
  // isPrescriptionRequired set, same enforcement shape as the loose/pack/
  // jewellery per-line superRefine checks elsewhere in this codebase.
  prescriptionPatientName: z.string().max(200).optional(),
  prescriptionDoctorName: z.string().max(200).optional(),
  prescriptionDate: z.string().optional(),
})

export const CreateInvoiceSchema = z.object({
  customerId: z.string().optional(),
  paymentMethod: z.enum(['CASH', 'UPI', 'CARD', 'WALLET', 'CREDIT', 'SPLIT']),
  items: z.array(InvoiceItemSchema).min(1, 'At least one item is required'),
  globalDiscount: z.number().min(0).default(0),
  notes: z.string().max(500).optional(),
  referenceNumber: z.string().max(100).optional(),
  gstType: z.enum(['CGST_SGST', 'IGST']).optional().default('CGST_SGST'),
  buyerState: z.string().max(50).optional(),
  // Phase 58 §2 — Jewellery old-metal exchange, applied ATOMICALLY as part of
  // this same invoice-creation transaction (see billing.service.ts) instead
  // of the old two-step "type the same number into globalDiscount, then
  // separately call metalExchange.linkToInvoice" manual process.
  metalExchangeId: z.string().optional(),
  // Phase 58 §2 — optional payment due date for CREDIT sales (e.g. Agri
  // Inputs' harvest-tied credit terms). Invoice.dueDate already existed in
  // the schema and report.service.ts's aging already reads it — this was
  // the only missing piece (nothing ever wrote it).
  dueDate: z.string().optional(),
})

export const CancelInvoiceSchema = z.object({
  invoiceId: z.string().min(1, 'Invoice ID is required'),
  reason: z.string().min(1, 'Cancellation reason is required').max(500),
})

export type CreateInvoicePayload = z.input<typeof CreateInvoiceSchema>
export type CancelInvoicePayload = z.infer<typeof CancelInvoiceSchema>
