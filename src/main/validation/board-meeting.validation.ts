import { z } from 'zod'

export const CreateBoardMeetingSchema = z.object({
  clientId: z.string().min(1, 'Client is required'),
  meetingType: z.string().optional(),
  meetingDate: z.string().min(1, 'Meeting date is required'),
  meetingTime: z.string().optional(),
  venue: z.string().optional(),
  agenda: z.string().optional(),
  notes: z.string().optional(),
})

export const UpdateBoardMeetingSchema = z.object({
  id: z.string().min(1, 'Meeting ID is required'),
  meetingType: z.string().optional(),
  meetingDate: z.string().optional(),
  meetingTime: z.string().nullable().optional(),
  venue: z.string().nullable().optional(),
  agenda: z.string().nullable().optional(),
  quorumMet: z.boolean().optional(),
  minutesDone: z.boolean().optional(),
  minutesText: z.string().nullable().optional(),
  noticesSent: z.boolean().optional(),
  notes: z.string().nullable().optional(),
})

export const BoardMeetingIdSchema = z.object({
  id: z.string().min(1, 'Meeting ID is required'),
})

export type CreateBoardMeetingPayload = z.infer<typeof CreateBoardMeetingSchema>
export type UpdateBoardMeetingPayload = z.infer<typeof UpdateBoardMeetingSchema>
