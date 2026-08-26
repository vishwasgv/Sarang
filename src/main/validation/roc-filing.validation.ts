import { z } from 'zod'

export const CreateROCFilingSchema = z.object({
  clientId: z.string().min(1, 'Client ID is required'),
  staffId: z.string().optional(),
  formType: z.string().min(1, 'Form type is required'),
  financialYear: z.string().optional(),
  purpose: z.string().optional(),
  dueDate: z.string().optional(),
  govtFee: z.number().nonnegative('Government fee cannot be negative').finite().optional(),
  notes: z.string().optional(),
})

export const UpdateROCFilingSchema = z.object({
  id: z.string().min(1, 'Filing ID is required'),
  staffId: z.string().nullable().optional(),
  formType: z.string().optional(),
  financialYear: z.string().nullable().optional(),
  purpose: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  filedOn: z.string().nullable().optional(),
  srn: z.string().nullable().optional(),
  status: z.string().optional(),
  govtFee: z.number().nonnegative('Government fee cannot be negative').finite().nullable().optional(),
  notes: z.string().nullable().optional(),
})

export const ROCFilingIdSchema = z.object({ id: z.string().min(1, 'Filing ID is required') })

export const GenerateFilingsFromAGMSchema = z.object({
  clientId: z.string().min(1, 'Client ID is required'),
  agmDate: z.string().min(1, 'AGM date is required'),
  financialYear: z.string().min(1, 'Financial year is required'),
})

export type CreateROCFilingPayload = z.infer<typeof CreateROCFilingSchema>
export type UpdateROCFilingPayload = z.infer<typeof UpdateROCFilingSchema>
export type GenerateFilingsFromAGMPayload = z.infer<typeof GenerateFilingsFromAGMSchema>
