import { z } from 'zod'

export const UpsertLoyaltyProgramSchema = z.object({
  isActive: z.boolean().optional(),
  punchesRequired: z.number().int().min(1, 'Punches required must be at least 1'),
  rewardDescription: z.string().min(1, 'Reward description is required').max(200),
  minPurchaseAmount: z.number().min(0, 'Minimum purchase amount cannot be negative').optional(),
})

export const RedeemLoyaltyRewardSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
})

export type UpsertLoyaltyProgramPayload = z.infer<typeof UpsertLoyaltyProgramSchema>
export type RedeemLoyaltyRewardPayload = z.infer<typeof RedeemLoyaltyRewardSchema>
