import { z } from 'zod'

export const SaveNormalRangeSchema = z.object({
  testName: z.string().min(1, 'Test name is required'),
  unit: z.string().max(20).nullable().optional(),
  minValue: z.number().finite().nullable().optional(),
  maxValue: z.number().finite().nullable().optional(),
  gender: z.enum(['ALL', 'MALE', 'FEMALE']).optional(),
  notes: z.string().max(2000).nullable().optional(),
}).refine(
  (v) => v.minValue == null || v.maxValue == null || v.minValue <= v.maxValue,
  { message: 'Minimum value cannot be greater than maximum value.', path: ['minValue'] }
)

export type SaveNormalRangePayload = z.infer<typeof SaveNormalRangeSchema>
