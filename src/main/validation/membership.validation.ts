import { z } from 'zod'

export const CreateMembershipPlanSchema = z.object({
  planName: z.string().min(1, 'Plan name is required'),
  durationDays: z.number().int().positive('Duration days must be greater than zero'),
  price: z.number().nonnegative('Price cannot be negative').finite(),
  sessionsIncluded: z.number().int().nonnegative('Sessions included cannot be negative').optional(),
  allowedClasses: z.string().max(2000).optional(),
  isActive: z.boolean().optional(),
})

export const UpdateMembershipPlanSchema = z.object({
  id: z.string().min(1, 'Plan ID is required'),
  planName: z.string().min(1).optional(),
  durationDays: z.number().int().positive('Duration days must be greater than zero').optional(),
  price: z.number().nonnegative('Price cannot be negative').finite().optional(),
  sessionsIncluded: z.number().int().nonnegative('Sessions included cannot be negative').nullable().optional(),
  allowedClasses: z.string().max(2000).nullable().optional(),
  isActive: z.boolean().optional(),
})

export const CreateMembershipSchema = z.object({
  clientId: z.string().min(1, 'Client is required'),
  planId: z.string().min(1, 'Plan is required'),
  startDate: z.string().min(1, 'Start date is required'),
  paymentStatus: z.string().max(20).optional(),
  notes: z.string().max(2000).optional(),
})

export const UpdateMembershipSchema = z.object({
  id: z.string().min(1, 'Membership ID is required'),
  status: z.string().max(20).optional(),
  paymentStatus: z.string().max(20).optional(),
  freezeHistory: z.string().max(4000).optional(),
  notes: z.string().max(2000).optional(),
  sessionsUsed: z.number().int().nonnegative('Sessions used cannot be negative').optional(),
})

export const CheckInMemberSchema = z.object({
  clientId: z.string().min(1, 'Client ID is required'),
  membershipId: z.string().min(1, 'Membership ID is required'),
})

// Phase 58 §2 — Gym/Studio: real freeze/resume date math (endDate push-out).
export const FreezeMembershipSchema = z.object({
  id: z.string().min(1, 'Membership ID is required'),
  reason: z.string().max(500).optional(),
})

export const ResumeMembershipSchema = z.object({
  id: z.string().min(1, 'Membership ID is required'),
})

export type CreateMembershipPlanPayload = z.infer<typeof CreateMembershipPlanSchema>
export type UpdateMembershipPlanPayload = z.infer<typeof UpdateMembershipPlanSchema>
export type CreateMembershipPayload = z.infer<typeof CreateMembershipSchema>
export type UpdateMembershipPayload = z.infer<typeof UpdateMembershipSchema>
export type CheckInMemberPayload = z.infer<typeof CheckInMemberSchema>
export type FreezeMembershipPayload = z.infer<typeof FreezeMembershipSchema>
export type ResumeMembershipPayload = z.infer<typeof ResumeMembershipSchema>
