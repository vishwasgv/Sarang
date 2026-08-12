import { z } from 'zod'

const InvoiceTemplateConfigSchema = z.object({
  accentColor: z.string().max(20).optional(),
  footerText: z.string().max(300).optional(),
  density: z.enum(['comfortable', 'compact']).optional(),
})

export const CreateInvoiceTemplateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  config: InvoiceTemplateConfigSchema,
})

export const UpdateInvoiceTemplateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200).optional(),
  config: InvoiceTemplateConfigSchema.optional(),
})

export const SetDefaultTemplateSchema = z.object({
  id: z.string().min(1).nullable(),
})

export type CreateInvoiceTemplatePayload = z.infer<typeof CreateInvoiceTemplateSchema>
export type UpdateInvoiceTemplatePayload = z.infer<typeof UpdateInvoiceTemplateSchema>
