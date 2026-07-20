import { z } from 'zod'

export const ListSyllabusTopicsSchema = z.object({
  batchId: z.string().min(1, 'Batch is required'),
})

export const CreateSyllabusTopicSchema = z.object({
  batchId: z.string().min(1, 'Batch is required'),
  topicName: z.string().min(1, 'Topic name is required'),
  sequenceOrder: z.number().int().optional(),
  plannedDate: z.string().optional(),
  notes: z.string().optional(),
})

export const UpdateSyllabusTopicSchema = z.object({
  id: z.string().min(1, 'Topic ID is required'),
  topicName: z.string().min(1).optional(),
  sequenceOrder: z.number().int().optional(),
  plannedDate: z.string().nullable().optional(),
  status: z.string().optional(),
  notes: z.string().nullable().optional(),
})

export const SyllabusTopicIdSchema = z.object({
  id: z.string().min(1, 'Topic ID is required'),
})

export type CreateSyllabusTopicPayload = z.infer<typeof CreateSyllabusTopicSchema>
export type UpdateSyllabusTopicPayload = z.infer<typeof UpdateSyllabusTopicSchema>
