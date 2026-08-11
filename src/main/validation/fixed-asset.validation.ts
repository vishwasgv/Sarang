import { z } from 'zod'

export const CreateFixedAssetSchema = z.object({
  assetCode: z.string().min(1, 'Asset code is required').max(30),
  assetName: z.string().min(1, 'Asset name is required').max(150),
  category: z.string().max(100).optional(),
  purchaseDate: z.string().min(1, 'Purchase date is required'),
  purchaseCost: z.number().positive('Purchase cost must be greater than zero'),
  usefulLifeMonths: z.number().int().positive('Useful life must be a positive number of months'),
  depreciationMethod: z.enum(['STRAIGHT_LINE', 'WDV']).default('STRAIGHT_LINE'),
  salvageValue: z.number().min(0).default(0),
  notes: z.string().max(500).optional(),
})

export const RunDepreciationSchema = z.object({
  fixedAssetId: z.string().min(1),
  periodStart: z.string().min(1),
  periodEnd: z.string().min(1),
})

export const DisposeFixedAssetSchema = z.object({
  id: z.string().min(1),
  disposalDate: z.string().min(1),
  disposalAmount: z.number().min(0),
})

export type CreateFixedAssetPayload = z.infer<typeof CreateFixedAssetSchema>
export type RunDepreciationPayload = z.infer<typeof RunDepreciationSchema>
export type DisposeFixedAssetPayload = z.infer<typeof DisposeFixedAssetSchema>
