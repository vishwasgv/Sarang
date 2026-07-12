import { z } from 'zod'

export const CreateDrawingRevisionSchema = z.object({
  projectId: z.string().min(1, 'Project is required'),
  drawingNumber: z.string().min(1, 'Drawing number is required'),
  title: z.string().min(1, 'Title is required'),
  discipline: z.string().max(100).optional(),
  revisionNumber: z.string().max(20).optional(),
  status: z.string().max(50).optional(),
  issuedDate: z.string().optional(),
  notes: z.string().max(2000).optional(),
})

export const UpdateDrawingRevisionSchema = z.object({
  id: z.string().min(1, 'Drawing revision ID is required'),
  drawingNumber: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  discipline: z.string().max(100).optional(),
  revisionNumber: z.string().max(20).optional(),
  status: z.string().max(50).optional(),
  issuedDate: z.string().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
})

export const DeleteDrawingRevisionSchema = z.object({
  id: z.string().min(1, 'Drawing revision ID is required'),
})

export type CreateDrawingRevisionPayload = z.infer<typeof CreateDrawingRevisionSchema>
export type UpdateDrawingRevisionPayload = z.infer<typeof UpdateDrawingRevisionSchema>
export type DeleteDrawingRevisionPayload = z.infer<typeof DeleteDrawingRevisionSchema>
