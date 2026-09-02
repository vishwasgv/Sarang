import { z } from 'zod'

// 2026-09-02 — raised from 100. The new Ed25519 key format (SARANG2-...)
// carries a full, unfruncated 128-hex-char signature (unlike the old
// HMAC format's 12-char truncated one) and runs ~165-180 chars total.
// 220 leaves comfortable margin without being so loose it stops catching
// genuinely garbled input.
export const ActivateLicenseKeySchema = z.object({
  key: z.string().trim().min(1, 'Enter your license key.').max(220)
})

export type ActivateLicenseKeyPayload = z.infer<typeof ActivateLicenseKeySchema>
