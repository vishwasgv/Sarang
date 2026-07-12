import { z } from 'zod'

export const CreateServiceProjectSchema = z.object({
  clientId: z.string().min(1, 'Client ID is required'),
  projectName: z.string().min(1, 'Project name is required'),
  projectType: z.string().optional(),
  stage: z.string().optional(),
  status: z.string().optional(),
  totalContractValue: z.number().nonnegative('Total contract value cannot be negative').finite().optional(),
  startDate: z.string().optional(),
  expectedEndDate: z.string().optional(),
  assignedToId: z.string().optional(),
  notes: z.string().optional(),
  targetChannel: z.string().optional(),
  deliverableType: z.string().optional(),
  adSpendBudget: z.number().nonnegative('Ad spend budget cannot be negative').finite().optional(),
})

export const UpdateServiceProjectSchema = z.object({
  id: z.string().min(1, 'Project ID is required'),
  projectName: z.string().min(1).optional(),
  projectType: z.string().optional(),
  stage: z.string().nullable().optional(),
  status: z.string().optional(),
  totalContractValue: z.number().nonnegative('Total contract value cannot be negative').finite().nullable().optional(),
  startDate: z.string().nullable().optional(),
  expectedEndDate: z.string().nullable().optional(),
  completedDate: z.string().nullable().optional(),
  assignedToId: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  targetChannel: z.string().nullable().optional(),
  deliverableType: z.string().nullable().optional(),
  adSpendBudget: z.number().nonnegative('Ad spend budget cannot be negative').finite().nullable().optional(),
})

export const ServiceProjectIdSchema = z.object({ id: z.string().min(1, 'Project ID is required') })

export type CreateServiceProjectPayload = z.infer<typeof CreateServiceProjectSchema>
export type UpdateServiceProjectPayload = z.infer<typeof UpdateServiceProjectSchema>
