import { z } from 'zod'

export const ListInterviewRoundsSchema = z.object({
  candidateId: z.string().optional(),
  jobOrderId: z.string().optional(),
})

export const EntityIdSchema = z.object({ id: z.string().min(1, 'ID is required') })

export const CreateInterviewRoundSchema = z.object({
  candidateId: z.string().min(1, 'Candidate is required'),
  jobOrderId: z.string().min(1, 'Job order is required'),
  roundNumber: z.number().int().positive().optional(),
  roundType: z.enum(['PHONE_SCREEN', 'TECHNICAL', 'HR', 'FINAL', 'OTHER']).optional(),
  scheduledDate: z.string().optional(),
  interviewerName: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
})

export const UpdateInterviewRoundSchema = z.object({
  id: z.string().min(1, 'ID is required'),
  roundType: z.enum(['PHONE_SCREEN', 'TECHNICAL', 'HR', 'FINAL', 'OTHER']).optional(),
  scheduledDate: z.string().nullable().optional(),
  status: z.enum(['SCHEDULED', 'COMPLETED', 'PASSED', 'REJECTED', 'NO_SHOW']).optional(),
  interviewerName: z.string().max(200).nullable().optional(),
  clientFeedback: z.string().max(2000).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
})
