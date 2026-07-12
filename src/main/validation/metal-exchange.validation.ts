import { z } from 'zod'

export const CreateMetalExchangeSchema = z.object({
  customerId: z.string().optional(),
  customerName: z.string().max(255).optional(),
  metalType: z.string().min(1, 'Metal type is required'),
  purity: z.string().min(1, 'Purity is required'),
  grossWeight: z.number().positive('Gross weight must be greater than zero'),
  deductionWeight: z.number().nonnegative('Deduction weight cannot be negative').finite().optional(),
  notes: z.string().max(2000).optional(),
})

export const LinkMetalExchangeToInvoiceSchema = z.object({
  exchangeId: z.string().min(1, 'Exchange ID is required'),
  invoiceId: z.string().min(1, 'Invoice ID is required'),
})

export type CreateMetalExchangePayload = z.infer<typeof CreateMetalExchangeSchema>
export type LinkMetalExchangeToInvoicePayload = z.infer<typeof LinkMetalExchangeToInvoiceSchema>
