import { z } from 'zod'

export const CreateRawMaterialSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  unit: z.string().optional(),
  currentStock: z.number().nonnegative('Current stock cannot be negative').finite().optional(),
  reorderLevel: z.number().nonnegative('Reorder level cannot be negative').finite().optional(),
  unitCost: z.number().nonnegative('Unit cost cannot be negative').finite().optional(),
  supplierId: z.string().optional(),
})

export const UpdateRawMaterialSchema = z.object({
  id: z.string().min(1, 'Raw material ID is required'),
  name: z.string().min(1).optional(),
  unit: z.string().optional(),
  reorderLevel: z.number().nonnegative('Reorder level cannot be negative').finite().optional(),
  unitCost: z.number().nonnegative('Unit cost cannot be negative').finite().optional(),
  supplierId: z.string().nullable().optional(),
})

export const RawMaterialIdSchema = z.object({ id: z.string().min(1, 'Raw material ID is required') })

export const AdjustRawMaterialStockSchema = z.object({
  id: z.string().min(1, 'Raw material ID is required'),
  type: z.enum(['PURCHASE', 'ADJUSTMENT', 'RETURN']),
  quantity: z.number().nonnegative('Quantity cannot be negative').finite(),
  unitCost: z.number().nonnegative('Unit cost cannot be negative').finite().optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
})

// Phase 58 §2 — raw-material lot/batch traceability
export const ReceiveRawMaterialBatchSchema = z.object({
  rawMaterialId: z.string().min(1, 'Raw material ID is required'),
  batchNumber: z.string().min(1, 'Batch/lot number is required').max(50),
  quantity: z.number().positive('Quantity must be greater than zero').finite(),
  unitCost: z.number().nonnegative('Unit cost cannot be negative').finite().optional(),
  supplierId: z.string().optional(),
})

export const ListRawMaterialBatchesSchema = z.object({
  rawMaterialId: z.string().optional(),
})

export type CreateRawMaterialPayload = z.infer<typeof CreateRawMaterialSchema>
export type UpdateRawMaterialPayload = z.infer<typeof UpdateRawMaterialSchema>
export type AdjustRawMaterialStockPayload = z.infer<typeof AdjustRawMaterialStockSchema>
export type ReceiveRawMaterialBatchPayload = z.infer<typeof ReceiveRawMaterialBatchSchema>
