import { z } from 'zod'

export const SchedulePropertySiteVisitSchema = z.object({
  inquiryId: z.string().min(1, 'Inquiry is required'),
  scheduledDate: z.string().min(1, 'Scheduled date is required'),
  scheduledTime: z.string().optional(),
})

export const UpdatePropertySiteVisitSchema = z.object({
  id: z.string().min(1, 'Site visit ID is required'),
  scheduledDate: z.string().optional(),
  scheduledTime: z.string().nullable().optional(),
  status: z.string().optional(),
  feedback: z.string().nullable().optional(),
  interestLevel: z.string().nullable().optional(),
})

export const PropertySiteVisitIdSchema = z.object({
  id: z.string().min(1, 'Site visit ID is required'),
})

export const ListPropertySiteVisitsSchema = z.object({
  inquiryId: z.string().min(1, 'Inquiry is required'),
})

export type SchedulePropertySiteVisitPayload = z.infer<typeof SchedulePropertySiteVisitSchema>
export type UpdatePropertySiteVisitPayload = z.infer<typeof UpdatePropertySiteVisitSchema>
