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
  taxNumber: z.string().max(50).nullable().optional(),
  upiId: z.string().max(100).nullable().optional(),
  website: z.string().max(200).nullable().optional(),
  logoPath: z.string().max(1000).nullable().optional(),
  showLogoOnDashboard: z.boolean().optional(),
  enableDocumentWatermark: z.boolean().optional(),
  timezone: z.string().max(100).optional(),
  clinicSpecialty: z.string().max(100).nullable().optional()
})

export type BusinessProfileUpdatePayload = z.infer<typeof BusinessProfileUpdateSchema>
