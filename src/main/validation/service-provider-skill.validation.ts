import { z } from 'zod'

export const SetProviderSkillsSchema = z.object({
  employeeId: z.string().min(1, 'employeeId is required'),
  serviceCatalogIds: z.array(z.string().min(1)).max(200),
})

export const EmployeeIdSchema = z.object({
  employeeId: z.string().min(1, 'employeeId is required'),
})

export const ServiceCatalogIdSchema = z.object({
  serviceCatalogId: z.string().min(1, 'serviceCatalogId is required'),
})

export type SetProviderSkillsPayload = z.infer<typeof SetProviderSkillsSchema>
