import { z } from 'zod'

export const CreateGoldSavingsSchemeSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  metalType: z.string().min(1, 'Metal type is required'),
  monthlyAmount: z.number().positive('Monthly amount must be greater than zero'),
  tenureMonths: z.number().int('Tenure must be a whole number of months').positive('Tenure must be greater than zero'),
  startDate: z.string().min(1, 'Start date is required'),
  notes: z.string().max(2000).optional(),
})

export const RecordGoldSavingsInstallmentSchema = z.object({
  schemeId: z.string().min(1, 'Scheme ID is required'),
  amount: z.number().positive('Installment amount must be greater than zero'),
  paymentMethod: z.string().max(50).optional(),
  notes: z.string().max(2000).optional(),
})

export const RedeemGoldSavingsSchemeSchema = z.object({
  schemeId: z.string().min(1, 'Scheme ID is required'),
  bonusAmount: z.number().nonnegative('Bonus amount cannot be negative').optional(),
})

export const LinkGoldSavingsSchemeToInvoiceSchema = z.object({
  schemeId: z.string().min(1, 'Scheme ID is required'),
  invoiceId: z.string().min(1, 'Invoice ID is required'),
})

export type CreateGoldSavingsSchemePayload = z.infer<typeof CreateGoldSavingsSchemeSchema>
export type RecordGoldSavingsInstallmentPayload = z.infer<typeof RecordGoldSavingsInstallmentSchema>
export type RedeemGoldSavingsSchemePayload = z.infer<typeof RedeemGoldSavingsSchemeSchema>
export type LinkGoldSavingsSchemeToInvoicePayload = z.infer<typeof LinkGoldSavingsSchemeToInvoiceSchema>
