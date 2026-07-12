import { z } from 'zod'

const ShipmentItemSchema = z.object({
  productId: z.string().optional(),
  productName: z.string().min(1, 'Item product name is required'),
  quantity: z.number().positive('Item quantity must be greater than zero'),
  unit: z.string().max(20).optional(),
  unitValue: z.number().nonnegative('Item value cannot be negative').finite().optional(),
  batchNumber: z.string().max(100).optional(),
  serialNumber: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),
})

export const CreateShipmentSchema = z.object({
  shipmentType: z.string().max(30).optional(),
  referenceType: z.string().max(30).optional(),
  referenceId: z.string().optional(),
  referenceNumber: z.string().max(100).optional(),
  originAddress: z.string().max(500).optional(),
  destinationAddress: z.string().min(1, 'Destination address is required'),
  customerId: z.string().optional(),
  customerName: z.string().max(255).optional(),
  supplierId: z.string().optional(),
  supplierName: z.string().max(255).optional(),
  carrierId: z.string().optional(),
  vehicleId: z.string().optional(),
  trackingNumber: z.string().max(100).optional(),
  freightAmount: z.number().nonnegative('Freight amount cannot be negative').finite().optional(),
  freightPaidBy: z.string().max(20).optional(),
  weight: z.number().nonnegative('Weight cannot be negative').finite().optional(),
  weightUnit: z.string().max(10).optional(),
  packages: z.number().int().positive('Packages must be at least 1').optional(),
  scheduledDate: z.string().optional(),
  expectedDelivery: z.string().optional(),
  challanNumber: z.string().max(100).optional(),
  ewayBillNumber: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
  items: z.array(ShipmentItemSchema).optional(),
})

export const UpdateShipmentSchema = z.object({
  id: z.string().min(1, 'Shipment ID is required'),
  shipmentType: z.string().max(30).optional(),
  referenceType: z.string().max(30).optional(),
  referenceNumber: z.string().max(100).optional(),
  originAddress: z.string().max(500).optional(),
  destinationAddress: z.string().min(1).optional(),
  customerId: z.string().optional(),
  customerName: z.string().max(255).optional(),
  supplierId: z.string().optional(),
  supplierName: z.string().max(255).optional(),
  carrierId: z.string().nullable().optional(),
  vehicleId: z.string().nullable().optional(),
  trackingNumber: z.string().max(100).optional(),
  freightAmount: z.number().nonnegative('Freight amount cannot be negative').finite().optional(),
  freightPaidBy: z.string().max(20).optional(),
  weight: z.number().nonnegative('Weight cannot be negative').finite().optional(),
  packages: z.number().int().positive('Packages must be at least 1').optional(),
  scheduledDate: z.string().optional(),
  expectedDelivery: z.string().optional(),
  challanNumber: z.string().max(100).optional(),
  ewayBillNumber: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
  items: z.array(ShipmentItemSchema).optional(),
})

export const UpdateShipmentStatusSchema = z.object({
  id: z.string().min(1, 'Shipment ID is required'),
  status: z.string().min(1, 'Status is required'),
})

export type CreateShipmentPayload = z.infer<typeof CreateShipmentSchema>
export type UpdateShipmentPayload = z.infer<typeof UpdateShipmentSchema>
export type UpdateShipmentStatusPayload = z.infer<typeof UpdateShipmentStatusSchema>
