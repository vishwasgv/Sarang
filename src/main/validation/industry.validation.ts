import { z } from 'zod'

export const ChangeBusinessTypeSchema = z.object({
  businessType: z.string().min(1, 'businessType is required'),
})

export const UpdateModulesSchema = z.object({
  modules: z.array(z.string()),
})

export const CreateRestaurantTableSchema = z.object({
  tableNumber: z.string().min(1, 'Table number is required'),
  tableName: z.string().max(100).optional(),
})

export const UpdateTableStatusSchema = z.object({
  tableId: z.string().min(1, 'tableId is required'),
  status: z.enum(['AVAILABLE', 'OCCUPIED', 'RESERVED']),
})

export const DeleteTableSchema = z.object({
  tableId: z.string().min(1, 'tableId is required'),
})

export const CreateKOTSchema = z.object({
  invoiceId: z.string().min(1, 'invoiceId is required'),
  tableId: z.string().optional(),
})

export const UpdateKOTStatusSchema = z.object({
  kotId: z.string().min(1, 'kotId is required'),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'DONE', 'CANCELLED']),
})

// Phase 58 §2 (2026-07-21) — ad-hoc table merge, mid-service.
export const MergeTableIntoInvoiceSchema = z.object({
  tableId: z.string().min(1, 'tableId is required'),
  invoiceId: z.string().min(1, 'invoiceId is required'),
})

export const UpsertRecipeSchema = z.object({
  productId: z.string().min(1, 'productId is required'),
  recipeName: z.string().min(1, 'recipeName is required'),
  items: z.array(z.object({
    ingredientProductId: z.string().min(1),
    quantity: z.number().finite().positive('Ingredient quantity must be greater than zero'),
  })).optional(),
})

export const DeleteRecipeSchema = z.object({
  recipeId: z.string().min(1, 'recipeId is required'),
})

// 2026-09-02 — accepting an order only sends it to the kitchen now (no
// longer bills it immediately, see restaurant-order.service.ts's
// acceptOrderRequest header comment) — paymentMethod/customerId moved to
// CheckoutTableSchema below, the one place billing actually happens.
export const AcceptOrderRequestSchema = z.object({
  requestId: z.string().min(1, 'requestId is required'),
})

export const CheckoutTableSchema = z.object({
  tableId: z.string().min(1, 'tableId is required'),
  paymentMethod: z.enum(['CASH', 'UPI', 'CARD', 'WALLET', 'CREDIT', 'SPLIT']),
  customerId: z.string().optional(),
})

// 2026-09-02 — staff-facing "send this round to the kitchen" from
// BillingScreen's dine-in flow, mirroring the QR path: creates a KOT with
// no invoice yet, added to the table's running tab. Billing happens once,
// later, via CheckoutTableSchema above.
export const SendTableOrderSchema = z.object({
  tableId: z.string().min(1, 'tableId is required'),
  items: z.array(z.object({
    productId: z.string().min(1),
    quantity: z.number().positive(),
    unitPrice: z.number().min(0),
    taxRate: z.number().min(0).optional(),
  })).min(1, 'At least one item is required'),
})

export const RejectOrderRequestSchema = z.object({
  requestId: z.string().min(1, 'requestId is required'),
})

export const GenerateTableQrSchema = z.object({
  tableId: z.string().min(1, 'tableId is required'),
})

export const SetWifiConfigSchema = z.object({
  ssid: z.string().max(32, 'Network name is too long').optional(),
  password: z.string().max(63, 'Password is too long').optional(),
  open: z.boolean().optional(),
})

export type ChangeBusinessTypePayload = z.infer<typeof ChangeBusinessTypeSchema>
export type UpdateModulesPayload = z.infer<typeof UpdateModulesSchema>
export type UpsertRecipePayload = z.infer<typeof UpsertRecipeSchema>
