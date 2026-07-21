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

export const AcceptOrderRequestSchema = z.object({
  requestId: z.string().min(1, 'requestId is required'),
  paymentMethod: z.enum(['CASH', 'UPI', 'CARD', 'WALLET', 'CREDIT', 'SPLIT']),
  customerId: z.string().optional(),
})

export const RejectOrderRequestSchema = z.object({
  requestId: z.string().min(1, 'requestId is required'),
})

export const GenerateTableQrSchema = z.object({
  tableId: z.string().min(1, 'tableId is required'),
})

export type ChangeBusinessTypePayload = z.infer<typeof ChangeBusinessTypeSchema>
export type UpdateModulesPayload = z.infer<typeof UpdateModulesSchema>
export type UpsertRecipePayload = z.infer<typeof UpsertRecipeSchema>
