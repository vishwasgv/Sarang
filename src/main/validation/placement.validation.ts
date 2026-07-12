import { z } from 'zod'

export const CreatePlacementSchema = z.object({
  candidateId: z.string().min(1, 'Candidate ID is required'),
  jobOrderId: z.string().min(1, 'Job order ID is required'),
  clientId: z.string().min(1, 'Client ID is required'),
  joiningDate: z.string().min(1, 'Joining date is required'),
  offeredSalary: z.number().nonnegative('Offered salary cannot be negative').finite(),
  commissionAmount: z.number().nonnegative('Commission amount cannot be negative').finite(),
  notes: z.string().optional(),
})

export const UpdatePlacementSchema = z.object({
  id: z.string().min(1, 'Placement ID is required'),
  joiningDate: z.string().optional(),
  offeredSalary: z.number().nonnegative('Offered salary cannot be negative').finite().optional(),
  commissionAmount: z.number().nonnegative('Commission amount cannot be negative').finite().optional(),
  status: z.string().optional(),
  invoiceId: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
})

export const PlacementIdSchema = z.string().min(1, 'Placement ID is required')

export type CreatePlacementPayload = z.infer<typeof CreatePlacementSchema>
export type UpdatePlacementPayload = z.infer<typeof UpdatePlacementSchema>
