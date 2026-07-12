import { z } from 'zod'

export const LoginSchema = z.object({
  username: z.string().min(1, 'Username is required').max(50),
  password: z.string().min(1, 'Password is required')
})

export const ChangePasswordSchema = z.object({
  userId: z.string().min(1),
  oldPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters')
})

export type LoginPayload = z.infer<typeof LoginSchema>
export type ChangePasswordPayload = z.infer<typeof ChangePasswordSchema>
