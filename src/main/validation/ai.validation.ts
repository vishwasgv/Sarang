import { z } from 'zod'

export const AskQuestionSchema = z.object({
  question: z.string().min(1, 'Question is required').max(500, 'Question is too long')
})
