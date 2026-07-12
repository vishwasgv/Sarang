import { z } from 'zod'

export const UpsertMetalRateSchema = z.object({
  metalType: z.string().min(1, 'Metal type is required'),
  purity: z.string().min(1, 'Purity is required'),
  ratePerGram: z.number().positive('Rate per gram must be greater than zero'),
})

export type UpsertMetalRatePayload = z.infer<typeof UpsertMetalRateSchema>
