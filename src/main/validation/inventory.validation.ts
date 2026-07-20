import { z } from 'zod'

export const AddStockSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  quantity: z.number().positive('Quantity must be greater than zero'),
  reason: z.string().min(1, 'Reason is required').max(255),
  unitCost: z.number().min(0).optional(),
  referenceType: z.string().max(50).optional(),
  referenceId: z.string().optional(),
})

// Phase 58 §2 — Hardware's damage/breakage write-off as its own reportable
// reason, distinct from a generic recount/correction. Free-standing
// optional field (not a Prisma enum — this schema has none anywhere,
// matching every other "why did this happen" field like
// RentalBooking.cancelReason) — omitting it entirely preserves the exact
// pre-existing movementType:'ADJUSTMENT' behavior for every existing caller.
export const AdjustStockReasonCategory = z.enum(['DAMAGE', 'RECOUNT', 'THEFT', 'EXPIRY', 'OTHER']).optional()

export const AdjustStockSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  quantity: z.number().min(0, 'Quantity cannot be negative'),
  reason: z.string().min(1, 'Reason is required for stock adjustment').max(255),
  reasonCategory: AdjustStockReasonCategory,
  unitCost: z.number().min(0).optional(),
})

export type AddStockPayload = z.infer<typeof AddStockSchema>
export type AdjustStockPayload = z.infer<typeof AdjustStockSchema>
