import { z } from 'zod'

export const EventIdParamSchema = z.object({ eventId: z.string().min(1, 'Event ID is required') })
export const EntityIdSchema = z.object({ id: z.string().min(1, 'ID is required') })

export const CreateRunOfShowItemSchema = z.object({
  eventId: z.string().min(1, 'Event ID is required'),
  scheduledTime: z.string().min(1, 'Scheduled time is required'),
  activity: z.string().min(1, 'Activity is required').max(300),
  responsibleParty: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
})

export const UpdateRunOfShowItemSchema = z.object({
  id: z.string().min(1, 'ID is required'),
  scheduledTime: z.string().optional(),
  activity: z.string().min(1).max(300).optional(),
  responsibleParty: z.string().max(200).nullable().optional(),
  isDone: z.boolean().optional(),
  notes: z.string().max(2000).nullable().optional(),
})
