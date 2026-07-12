import { z } from 'zod'

export const SetupPayloadSchema = z.object({
  businessName: z.string().min(1, 'Business name is required').max(200),
  businessType: z.string().min(1, 'Business type is required'),
  ownerName: z.string().max(200).optional(),
  country: z.string().min(1, 'Country is required').max(100),
  currencyCode: z.string().length(3, 'Currency code must be 3 characters'),
  currencySymbol: z.string().min(1),
  taxModel: z.enum(['GST', 'VAT', 'SALES_TAX', 'CUSTOM', 'NONE'], { errorMap: () => ({ message: 'Invalid tax model' }) }),
  phone: z.string().max(30).optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  taxNumber: z.string().max(50).optional(),
  upiId: z.string().max(100).optional(),
  logoPath: z.string().optional(),
  adminFullName: z.string().min(1, 'Full name is required').max(200),
  adminUsername: z.string().min(3, 'Username must be at least 3 characters').max(50).regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers, underscores'),
  adminPassword: z.string().min(6, 'Password must be at least 6 characters')
})

export type SetupPayload = z.infer<typeof SetupPayloadSchema>
