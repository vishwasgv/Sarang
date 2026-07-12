import { z } from 'zod'

export const CreateBoardResolutionSchema = z.object({
  boardMeetingId: z.string().min(1, 'Board meeting is required'),
  resolutionNumber: z.string().min(1, 'Resolution number is required'),
  resolutionType: z.string().optional(),
  resolutionText: z.string().min(1, 'Resolution text is required'),
  passedUnanimously: z.boolean().optional(),
})

export const UpdateBoardResolutionSchema = z.object({
  id: z.string().min(1, 'Resolution ID is required'),
  resolutionNumber: z.string().min(1).optional(),
  resolutionType: z.string().optional(),
  resolutionText: z.string().min(1).optional(),
  passedUnanimously: z.boolean().optional(),
})

export const BoardResolutionIdSchema = z.object({
  id: z.string().min(1, 'Resolution ID is required'),
})

export type CreateBoardResolutionPayload = z.infer<typeof CreateBoardResolutionSchema>
export type UpdateBoardResolutionPayload = z.infer<typeof UpdateBoardResolutionSchema>
