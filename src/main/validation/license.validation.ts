import { z } from 'zod'

export const ActivateLicenseKeySchema = z.object({
  key: z.string().trim().min(1, 'Enter your license key.').max(100)
})

export type ActivateLicenseKeyPayload = z.infer<typeof ActivateLicenseKeySchema>
