import { z } from 'zod'

export const CreateJobSiteAccountSchema = z.object({
  accountName: z.string().min(1, 'Account name is required'),
  contractorId: z.string().min(1, 'Contractor is required'),
  siteAddress: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
})

export const UpdateJobSiteAccountSchema = z.object({
  id: z.string().min(1, 'Account ID is required'),
  accountName: z.string().min(1).optional(),
  siteAddress: z.string().max(500).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
})

export type CreateJobSiteAccountPayload = z.infer<typeof CreateJobSiteAccountSchema>
export type UpdateJobSiteAccountPayload = z.infer<typeof UpdateJobSiteAccountSchema>
