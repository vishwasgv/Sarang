import { z } from 'zod'

export const AddCampaignPerformanceEntrySchema = z.object({
  projectId: z.string().min(1, 'Campaign is required'),
  periodStart: z.string().min(1, 'Period start is required'),
  periodEnd: z.string().min(1, 'Period end is required'),
  impressions: z.number().int().nonnegative().optional(),
  clicks: z.number().int().nonnegative().optional(),
  conversions: z.number().int().nonnegative().optional(),
  actualSpend: z.number().nonnegative().finite().optional(),
  notes: z.string().max(2000).optional(),
})

export const UpdateCampaignPerformanceEntrySchema = z.object({
  id: z.string().min(1, 'Entry ID is required'),
  periodStart: z.string().optional(),
  periodEnd: z.string().optional(),
  impressions: z.number().int().nonnegative().nullable().optional(),
  clicks: z.number().int().nonnegative().nullable().optional(),
  conversions: z.number().int().nonnegative().nullable().optional(),
  actualSpend: z.number().nonnegative().finite().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
})

export const CreateContentCalendarItemSchema = z.object({
  projectId: z.string().min(1, 'Campaign is required'),
  scheduledDate: z.string().min(1, 'Scheduled date is required'),
  contentType: z.string().optional(),
  title: z.string().min(1, 'Title is required'),
  platform: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
})

export const UpdateContentCalendarItemSchema = z.object({
  id: z.string().min(1, 'Item ID is required'),
  scheduledDate: z.string().optional(),
  contentType: z.string().optional(),
  title: z.string().min(1).optional(),
  platform: z.string().max(100).nullable().optional(),
  status: z.string().optional(),
  notes: z.string().max(2000).nullable().optional(),
})

export const ProjectIdSchema = z.object({
  projectId: z.string().min(1, 'Campaign is required'),
})

export const EntityIdSchema = z.object({
  id: z.string().min(1, 'ID is required'),
})

export type AddCampaignPerformanceEntryPayload = z.infer<typeof AddCampaignPerformanceEntrySchema>
export type UpdateCampaignPerformanceEntryPayload = z.infer<typeof UpdateCampaignPerformanceEntrySchema>
export type CreateContentCalendarItemPayload = z.infer<typeof CreateContentCalendarItemSchema>
export type UpdateContentCalendarItemPayload = z.infer<typeof UpdateContentCalendarItemSchema>
