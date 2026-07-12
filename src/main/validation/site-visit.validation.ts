import { z } from 'zod'

export const CreateSiteVisitSchema = z.object({
  projectId: z.string().min(1, 'Project is required'),
  visitDate: z.string().min(1, 'Visit date is required'),
  visitType: z.string().optional(),
  findings: z.string().optional(),
  weatherConditions: z.string().optional(),
  recordedById: z.string().optional(),
})

export const UpdateSiteVisitSchema = z.object({
  id: z.string().min(1, 'Site visit ID is required'),
  visitDate: z.string().optional(),
  visitType: z.string().optional(),
  findings: z.string().nullable().optional(),
  weatherConditions: z.string().nullable().optional(),
})

export const DeleteSiteVisitSchema = z.object({
  id: z.string().min(1, 'Site visit ID is required'),
})

export type CreateSiteVisitPayload = z.infer<typeof CreateSiteVisitSchema>
export type UpdateSiteVisitPayload = z.infer<typeof UpdateSiteVisitSchema>
export type DeleteSiteVisitPayload = z.infer<typeof DeleteSiteVisitSchema>
