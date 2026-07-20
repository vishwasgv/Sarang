import { z } from 'zod'

export const SaveNormalRangeSchema = z.object({
  testName: z.string().min(1, 'Test name is required'),
  unit: z.string().max(20).nullable().optional(),
  minValue: z.number().finite().nullable().optional(),
  maxValue: z.number().finite().nullable().optional(),
  // Phase 58 §2 — Diagnostic Lab panic-value tier, distinct from min/max —
  // must sit OUTSIDE the normal range (criticalLow <= minValue, criticalHigh >= maxValue).
  criticalLow: z.number().finite().nullable().optional(),
  criticalHigh: z.number().finite().nullable().optional(),
  gender: z.enum(['ALL', 'MALE', 'FEMALE']).optional(),
  // Phase 58 §2 — Vet Clinic species dimension. Free text (not a fixed enum
  // — Pet.species is already free text "Dog | Cat | Bird | Rabbit | Reptile
  // | Other", so a saved range must be able to name any of those), defaults
  // to "ALL" (generic/human) server-side when omitted.
  species: z.string().max(30).optional(),
  notes: z.string().max(2000).nullable().optional(),
}).refine(
  (v) => v.minValue == null || v.maxValue == null || v.minValue <= v.maxValue,
  { message: 'Minimum value cannot be greater than maximum value.', path: ['minValue'] }
).refine(
  (v) => v.criticalLow == null || v.minValue == null || v.criticalLow <= v.minValue,
  { message: 'Critical low must be at or below the normal minimum.', path: ['criticalLow'] }
).refine(
  (v) => v.criticalHigh == null || v.maxValue == null || v.criticalHigh >= v.maxValue,
  { message: 'Critical high must be at or above the normal maximum.', path: ['criticalHigh'] }
)

export type SaveNormalRangePayload = z.infer<typeof SaveNormalRangeSchema>
