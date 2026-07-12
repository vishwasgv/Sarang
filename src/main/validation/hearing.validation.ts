import { z } from 'zod'

export const CreateHearingSchema = z.object({
  caseId: z.string().min(1, 'Case is required'),
  hearingDate: z.string().min(1, 'Hearing date is required'),
  hearingTime: z.string().max(20).optional(),
  courtRoom: z.string().max(100).optional(),
  purpose: z.string().max(255).optional(),
  notes: z.string().max(2000).optional(),
})

export const UpdateHearingSchema = z.object({
  id: z.string().min(1, 'Hearing ID is required'),
  hearingDate: z.string().optional(),
  hearingTime: z.string().max(20).nullable().optional(),
  courtRoom: z.string().max(100).nullable().optional(),
  purpose: z.string().max(255).nullable().optional(),
  status: z.string().max(50).optional(),
  outcome: z.string().max(500).nullable().optional(),
  nextDate: z.string().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
})

export const DeleteHearingSchema = z.object({
  id: z.string().min(1, 'Hearing ID is required'),
})

export type CreateHearingPayload = z.infer<typeof CreateHearingSchema>
export type UpdateHearingPayload = z.infer<typeof UpdateHearingSchema>
