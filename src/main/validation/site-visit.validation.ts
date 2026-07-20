import { z } from 'zod'

export const CreateSiteVisitSchema = z.object({
  projectId: z.string().min(1, 'Project is required'),
  visitDate: z.string().min(1, 'Visit date is required'),
  visitType: z.string().optional(),
  findings: z.string().optional(),
  weatherConditions: z.string().optional(),
  recordedById: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  locationAccuracy: z.number().nonnegative().optional(),
})

export const UpdateSiteVisitSchema = z.object({
  id: z.string().min(1, 'Site visit ID is required'),
  visitDate: z.string().optional(),
  visitType: z.string().optional(),
  findings: z.string().nullable().optional(),
  weatherConditions: z.string().nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  locationAccuracy: z.number().nonnegative().nullable().optional(),
})

export const DeleteSiteVisitSchema = z.object({
  id: z.string().min(1, 'Site visit ID is required'),
})

export const AddMaterialTestResultSchema = z.object({
  siteVisitId: z.string().min(1, 'Site visit is required'),
  testType: z.string().min(1, 'Test type is required'),
  materialDescription: z.string().max(500).optional(),
  testValue: z.number().finite().optional(),
  unit: z.string().max(50).optional(),
  requiredMinValue: z.number().finite().optional(),
  testedDate: z.string().optional(),
  notes: z.string().max(2000).optional(),
})

export const UpdateMaterialTestResultSchema = z.object({
  id: z.string().min(1, 'Material test result ID is required'),
  testType: z.string().min(1).optional(),
  materialDescription: z.string().max(500).nullable().optional(),
  testValue: z.number().finite().nullable().optional(),
  unit: z.string().max(50).nullable().optional(),
  requiredMinValue: z.number().finite().nullable().optional(),
  result: z.string().max(20).optional(),
  testedDate: z.string().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
})

export const DeleteMaterialTestResultSchema = z.object({
  id: z.string().min(1, 'Material test result ID is required'),
})

export const ListMaterialTestResultsSchema = z.object({
  siteVisitId: z.string().min(1, 'Site visit is required'),
})

export type CreateSiteVisitPayload = z.infer<typeof CreateSiteVisitSchema>
export type UpdateSiteVisitPayload = z.infer<typeof UpdateSiteVisitSchema>
export type DeleteSiteVisitPayload = z.infer<typeof DeleteSiteVisitSchema>
export type AddMaterialTestResultPayload = z.infer<typeof AddMaterialTestResultSchema>
export type UpdateMaterialTestResultPayload = z.infer<typeof UpdateMaterialTestResultSchema>
