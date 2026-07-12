import { z } from 'zod'

const ChallanItemSchema = z.object({
  productId: z.string().optional(),
  productName: z.string().min(1, 'Item product name is required'),
  quantity: z.number().positive('Item quantity must be greater than zero'),
  unit: z.string().max(20).optional(),
  unitValue: z.number().nonnegative('Item value cannot be negative').finite().optional(),
  notes: z.string().max(500).optional(),
})

export const CreateChallanSchema = z.object({
  challanType: z.string().max(30).optional(),
  customerId: z.string().optional(),
  customerName: z.string().min(1, 'Customer name is required'),
  customerAddress: z.string().max(500).optional(),
  shipmentId: z.string().optional(),
  invoiceId: z.string().optional(),
  vehicleId: z.string().optional(),
  driverName: z.string().max(100).optional(),
  driverPhone: z.string().max(30).optional(),
  dispatchDate: z.string().optional(),
  expectedReturn: z.string().optional(),
  notes: z.string().max(2000).optional(),
  items: z.array(ChallanItemSchema).min(1, 'At least one item is required'),
})

export const UpdateChallanSchema = z.object({
  id: z.string().min(1, 'Challan ID is required'),
  challanType: z.string().max(30).optional(),
  customerName: z.string().min(1).optional(),
  customerAddress: z.string().max(500).optional(),
  vehicleId: z.string().nullable().optional(),
  driverName: z.string().max(100).optional(),
  driverPhone: z.string().max(30).optional(),
  dispatchDate: z.string().optional(),
  expectedReturn: z.string().optional(),
  notes: z.string().max(2000).optional(),
  items: z.array(ChallanItemSchema).optional(),
})

export const UpdateChallanStatusSchema = z.object({
  id: z.string().min(1, 'Challan ID is required'),
  status: z.string().min(1, 'Status is required'),
})

export const RecordChallanReturnSchema = z.object({
  id: z.string().min(1, 'Challan ID is required'),
  items: z.array(z.object({
    itemId: z.string().min(1, 'Item ID is required'),
    returnedQty: z.number().nonnegative('Returned quantity cannot be negative').finite(),
  })).min(1, 'At least one item is required'),
})

export type CreateChallanPayload = z.infer<typeof CreateChallanSchema>
export type UpdateChallanPayload = z.infer<typeof UpdateChallanSchema>
export type UpdateChallanStatusPayload = z.infer<typeof UpdateChallanStatusSchema>
export type RecordChallanReturnPayload = z.infer<typeof RecordChallanReturnSchema>
