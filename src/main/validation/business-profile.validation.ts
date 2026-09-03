import { z } from 'zod'

export const BusinessProfileUpdateSchema = z.object({
  businessName: z.string().min(1, 'Business name is required').max(200).optional(),
  ownerName: z.string().max(200).nullable().optional(),
  // Deliberately NOT z.string().email() — this is an update path for an already-existing
  // record. A business that saved a non-RFC email (or free text) before this schema
  // existed must still be able to save an unrelated field (e.g. toggle the watermark)
  // without the whole request failing on stale email content it didn't touch. Length
  // cap only; format is enforced at initial setup (setup.validation.ts), not here.
  email: z.string().max(200).nullable().optional(),
  phone: z.string().max(30).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  state: z.string().max(100).nullable().optional(),
  country: z.string().max(100).optional(),
  postalCode: z.string().max(20).nullable().optional(),
  currencyCode: z.string().length(3, 'Currency code must be 3 characters').optional(),
  currencySymbol: z.string().max(5).optional(),
  taxModel: z.enum(['GST', 'VAT', 'SALES_TAX', 'CUSTOM', 'NONE'], { errorMap: () => ({ message: 'Invalid tax model' }) }).optional(),
  // Phase 62 — Composition Scheme dealers cannot charge GST at all; billing.service.ts's
  // createInvoice reads this to force a 0% tax invoice, and print.service.ts reads it to
  // print "Bill of Supply" instead of "Tax Invoice".
  gstScheme: z.enum(['REGULAR', 'COMPOSITION'], { errorMap: () => ({ message: 'Invalid GST scheme' }) }).optional(),
  taxNumber: z.string().max(50).nullable().optional(),
  upiId: z.string().max(100).nullable().optional(),
  website: z.string().max(200).nullable().optional(),
  logoPath: z.string().max(1000).nullable().optional(),
  showLogoOnDashboard: z.boolean().optional(),
  enableDocumentWatermark: z.boolean().optional(),
  timezone: z.string().max(100).optional(),
  clinicSpecialty: z.string().max(100).nullable().optional(),
  // Phase 58 §2 — Pharmacy regulatory identifier
  drugLicenseNumber: z.string().max(100).nullable().optional(),
  // Phase 64 — job costing overhead allocation, applied at production-order
  // completion (production-order.service.ts's completeProductionOrder). Real
  // gap found via a fresh Phase 64 audit: the backend read these fields but
  // no update path ever accepted them, so a business had no way to actually
  // set a non-zero rate short of direct DB access.
  overheadAllocationBasis: z.enum(['PER_LABOR_HOUR', 'PER_UNIT_PRODUCED']).nullable().optional(),
  overheadAllocationRate: z.number().min(0, 'Overhead rate cannot be negative').optional(),
  // Phase 65 — statutory PF/ESI/Professional Tax suggest-and-review engine
  // (payroll.service.ts's suggestStatutoryDeductions). Owner-entered rates
  // only, never a hardcoded government table — see that function's own
  // comment for why. All optional/nullable; unset means the suggestion
  // engine returns nothing for that head.
  statutoryPfPercent: z.number().min(0).max(100).nullable().optional(),
  statutoryEsiPercent: z.number().min(0).max(100).nullable().optional(),
  statutoryEsiWageCeiling: z.number().min(0).nullable().optional(),
  statutoryProfessionalTax: z.number().min(0).nullable().optional(),
  // 2026-09 §13 — printed on an invoice's optional Bank Details block
  // (InvoiceTemplateConfig.showBankDetails), see print.service.ts.
  bankAccountName: z.string().max(200).nullable().optional(),
  bankAccountNumber: z.string().max(50).nullable().optional(),
  bankName: z.string().max(200).nullable().optional(),
  bankBranch: z.string().max(200).nullable().optional(),
  bankIfscCode: z.string().max(20).nullable().optional()
})

export type BusinessProfileUpdatePayload = z.infer<typeof BusinessProfileUpdateSchema>
