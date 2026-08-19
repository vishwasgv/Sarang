import { z } from 'zod'

export const CreatePriceMarkdownSchema = z.object({
  productId: z.string().min(1, 'Product is required'),
  markdownPrice: z.number().min(0, 'Markdown price cannot be negative'),
  endDate: z.string().min(1, 'End date is required'),
})

export const CancelPriceMarkdownSchema = z.object({
  id: z.string().min(1),
})

export type CreatePriceMarkdownPayload = z.infer<typeof CreatePriceMarkdownSchema>
export type CancelPriceMarkdownPayload = z.infer<typeof CancelPriceMarkdownSchema>
