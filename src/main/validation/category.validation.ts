import { z } from 'zod'

export const CreateCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required').max(100),
  description: z.string().max(500).optional(),
  parentCategoryId: z.string().optional()
})

export const UpdateCategorySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, 'Category name is required').max(100),
  description: z.string().max(500).optional(),
  parentCategoryId: z.string().optional().nullable()
})

export type CreateCategoryPayload = z.infer<typeof CreateCategorySchema>
export type UpdateCategoryPayload = z.infer<typeof UpdateCategorySchema>
