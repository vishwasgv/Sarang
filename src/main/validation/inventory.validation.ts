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
  // REAL BUG found+fixed (pre-launch audit): this unconditionally rejected
  // any negative quantity at the validation layer, BEFORE inventory.service.ts's
  // adjustStock() ever ran — making its own `if (payload.quantity < 0)` /
  // getAllowNegative() / INV-005 branch permanently dead code. A business
  // that explicitly enabled "allow negative inventory" (Settings) still could
  // never set an absolute stock count below zero via a manual stock
  // adjustment (recount/correction) through any real path (UI, IPC) —
  // the one setting-gated case this schema itself was clearly written to
  // support. The service is the single source of truth for this business
  // rule (and returns a friendly INV-005 message either way) — the schema
  // now only needs to guarantee a real, finite number.
  quantity: z.number().finite('Quantity must be a valid number'),
  reason: z.string().min(1, 'Reason is required for stock adjustment').max(255),
  reasonCategory: AdjustStockReasonCategory,
  unitCost: z.number().min(0).optional(),
})

// Phase 64 — multi-location stock transfer.
export const TransferStockSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  quantity: z.number().positive('Quantity must be greater than zero'),
  fromLocationId: z.string().min(1, 'Source location is required'),
  toLocationId: z.string().min(1, 'Destination location is required'),
  reason: z.string().max(255).optional(),
})

export type AddStockPayload = z.infer<typeof AddStockSchema>
export type AdjustStockPayload = z.infer<typeof AdjustStockSchema>
export type TransferStockPayload = z.infer<typeof TransferStockSchema>
