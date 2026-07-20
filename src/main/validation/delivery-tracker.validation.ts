import { z } from 'zod'

export const UpsertDeliveryTrackerSchema = z.object({
  shootBookingId: z.string().min(1, 'Shoot booking ID is required'),
  proofsSentDate: z.string().nullable().optional(),
  selectionReceivedDate: z.string().nullable().optional(),
  editingStartedDate: z.string().nullable().optional(),
  albumProofSentDate: z.string().nullable().optional(),
  finalDeliveredDate: z.string().nullable().optional(),
  deliveryFormat: z.string().max(100).nullable().optional(),
  deliveredPhotosCount: z.number().int().nonnegative().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
})

export type UpsertDeliveryTrackerPayload = z.infer<typeof UpsertDeliveryTrackerSchema>
