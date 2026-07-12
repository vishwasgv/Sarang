import { z } from 'zod'

export const CreatePestJobSheetSchema = z.object({
  contractId: z.string().min(1).optional(),
  clientId: z.string().min(1, 'Client ID is required'),
  visitDate: z.string().min(1, 'Visit date is required'),
  scheduledTime: z.string().optional(),
  technicianIds: z.array(z.string()).optional(),
  pesticideUsed: z.string().optional(),
  areasServiced: z.array(z.string()).optional(),
  treatmentType: z.string().optional(),
  jobAmount: z.number().nonnegative('Job amount cannot be negative').finite().optional(),
  clientSignature: z.boolean().optional(),
  followUpDate: z.string().optional(),
  notes: z.string().optional(),
})

export const UpdatePestJobSheetSchema = z.object({
  id: z.string().min(1, 'Job sheet ID is required'),
  visitDate: z.string().optional(),
  scheduledTime: z.string().nullable().optional(),
  technicianIds: z.array(z.string()).optional(),
  pesticideUsed: z.string().nullable().optional(),
  areasServiced: z.array(z.string()).optional(),
  treatmentType: z.string().optional(),
  jobAmount: z.number().nonnegative('Job amount cannot be negative').finite().optional(),
  status: z.string().optional(),
  completedDate: z.string().nullable().optional(),
  followUpDate: z.string().nullable().optional(),
  clientSignature: z.boolean().optional(),
  invoiceId: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
})

export const PestJobSheetIdSchema = z.string().min(1, 'Job sheet ID is required')

export type CreatePestJobSheetPayload = z.infer<typeof CreatePestJobSheetSchema>
export type UpdatePestJobSheetPayload = z.infer<typeof UpdatePestJobSheetSchema>
