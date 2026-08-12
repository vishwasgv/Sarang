import { z } from 'zod'

// Line-item payloads, deliberately narrower than the live CreateInvoiceSchema
// (which assumes a live-checkout paymentMethod) — an auto-generated
// recurring invoice is always a CREDIT-shaped billed document, built inline
// by recurring-profile.service.ts rather than routed through
// billing.service.ts's own live-checkout createInvoice.
const RecurringInvoiceItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().min(0),
  taxRate: z.number().min(0).max(100).default(0),
})

const RecurringBillItemSchema = z.object({
  productId: z.string().min(1).optional(),
  serviceDescription: z.string().min(1).max(300).optional(),
  serviceCategoryId: z.string().min(1).optional(),
  quantity: z.number().positive(),
  unitCost: z.number().min(0),
  taxRate: z.number().min(0).max(100).default(0),
}).refine((item) => !!item.productId || !!item.serviceDescription, {
  message: 'Each line must be either a product or a service description.'
})

export const CreateRecurringProfileSchema = z.discriminatedUnion('documentType', [
  z.object({
    documentType: z.literal('INVOICE'),
    customerId: z.string().min(1, 'Customer is required'),
    items: z.array(RecurringInvoiceItemSchema).min(1, 'At least one item is required'),
    notes: z.string().max(500).optional(),
    cadence: z.enum(['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']).default('MONTHLY'),
    dayOfPeriod: z.number().int().min(1).max(31).default(1),
    startDate: z.string().min(1, 'Start date is required'),
    endDate: z.string().optional(),
  }),
  z.object({
    documentType: z.literal('BILL'),
    supplierId: z.string().min(1, 'Supplier is required'),
    items: z.array(RecurringBillItemSchema).min(1, 'At least one item is required'),
    isReverseCharge: z.boolean().default(false),
    notes: z.string().max(500).optional(),
    cadence: z.enum(['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']).default('MONTHLY'),
    dayOfPeriod: z.number().int().min(1).max(31).default(1),
    startDate: z.string().min(1, 'Start date is required'),
    endDate: z.string().optional(),
  }),
  z.object({
    documentType: z.literal('EXPENSE'),
    categoryId: z.string().min(1, 'Category is required'),
    expenseName: z.string().min(1, 'Expense name is required'),
    amount: z.number().positive('Amount must be greater than zero'),
    paymentMethod: z.string().max(50).optional(),
    supplierId: z.string().min(1).optional(),
    remarks: z.string().max(2000).optional(),
    cadence: z.enum(['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']).default('MONTHLY'),
    dayOfPeriod: z.number().int().min(1).max(31).default(1),
    startDate: z.string().min(1, 'Start date is required'),
    endDate: z.string().optional(),
  }),
])

export const UpdateRecurringProfileSchema = z.object({
  id: z.string().min(1),
  active: z.boolean().optional(),
  cadence: z.enum(['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']).optional(),
  dayOfPeriod: z.number().int().min(1).max(31).optional(),
  endDate: z.string().nullable().optional(),
})

export type CreateRecurringProfilePayload = z.infer<typeof CreateRecurringProfileSchema>
export type UpdateRecurringProfilePayload = z.infer<typeof UpdateRecurringProfileSchema>
