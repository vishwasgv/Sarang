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

// Floor-level sanity check only — the real, live-configurable minimum is
// enforced by auth.service.ts's checkPasswordLength() (see F.15's fix for
// why this schema deliberately doesn't hardcode the actual policy minimum).
export const ResetPasswordWithRecoveryCodeSchema = z.object({
  username: z.string().min(1, 'Username is required').max(50),
  recoveryCode: z.string().min(1, 'Recovery code is required').max(64),
  newPassword: z.string().min(6, 'New password must be at least 6 characters')
})

export const RegenerateRecoveryCodeSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required')
})

export type LoginPayload = z.infer<typeof LoginSchema>
export type ChangePasswordPayload = z.infer<typeof ChangePasswordSchema>
export type ResetPasswordWithRecoveryCodePayload = z.infer<typeof ResetPasswordWithRecoveryCodeSchema>
export type RegenerateRecoveryCodePayload = z.infer<typeof RegenerateRecoveryCodeSchema>
