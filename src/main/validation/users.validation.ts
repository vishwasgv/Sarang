import { z } from 'zod'

export const CreateUserSchema = z.object({
  fullName: z.string().min(1, 'Full name is required').max(200),
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers, underscores'),
  // Deliberately no hardcoded minimum here — the real, live-configurable
  // minimum (password_min_length Setting) is enforced in the users:create
  // handler, the same way changePassword/adminResetPassword already do it,
  // so all three password-setting paths can never drift out of sync again.
  password: z.string().min(1, 'Password is required'),
  roleId: z.string().min(1, 'Role is required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().max(30).optional()
})

export const UpdateUserSchema = z.object({
  id: z.string().min(1),
  fullName: z.string().min(1).max(200),
  roleId: z.string().min(1),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(30).optional()
})

export const DeactivateUserSchema = z.object({
  userId: z.string().min(1)
})

export type CreateUserPayload = z.infer<typeof CreateUserSchema>
export type UpdateUserPayload = z.infer<typeof UpdateUserSchema>
