import { z } from 'zod'

export const CarJobCardIdSchema = z.string().min(1, 'Job card ID is required')

const ServiceItemSchema = z.object({
  name: z.string().min(1, 'Service item name is required'),
  quantity: z.number().positive('Quantity must be greater than zero'),
  unitPrice: z.number().nonnegative('Unit price cannot be negative'),
})

const PartItemSchema = z.object({
  name: z.string().min(1, 'Part name is required'),
  partNumber: z.string().optional(),
  quantity: z.number().positive('Quantity must be greater than zero'),
  unitPrice: z.number().nonnegative('Unit price cannot be negative'),
  productId: z.string().optional(),
})

export const CreateCarJobCardSchema = z.object({
  clientId: z.string().min(1, 'Client is required'),
  vehicleNumber: z.string().min(1, 'Vehicle number is required'),
  vehicleMake: z.string().min(1, 'Vehicle make is required'),
  vehicleModel: z.string().min(1, 'Vehicle model is required'),
  vehicleYear: z.number().int().positive('Vehicle year must be valid').optional(),
  vehicleType: z.string().optional(),
  kmIn: z.number().nonnegative('KM in cannot be negative').optional(),
  serviceAdvisorId: z.string().optional(),
  technicianIds: z.array(z.string()).optional(),
  serviceItems: z.array(ServiceItemSchema).optional(),
  partsItems: z.array(PartItemSchema).optional(),
  estimatedDelivery: z.string().optional(),
  notes: z.string().optional(),
  internalNotes: z.string().optional(),
})

export const UpdateCarJobCardSchema = z.object({
  id: z.string().min(1, 'Job card ID is required'),
  vehicleNumber: z.string().min(1).optional(),
  vehicleMake: z.string().min(1).optional(),
  vehicleModel: z.string().min(1).optional(),
  vehicleYear: z.number().int().positive('Vehicle year must be valid').nullable().optional(),
  vehicleType: z.string().optional(),
  kmIn: z.number().nonnegative('KM in cannot be negative').nullable().optional(),
  kmOut: z.number().nonnegative('KM out cannot be negative').nullable().optional(),
  serviceAdvisorId: z.string().nullable().optional(),
  technicianIds: z.array(z.string()).optional(),
  serviceItems: z.array(ServiceItemSchema).optional(),
  partsItems: z.array(PartItemSchema).optional(),
  estimatedDelivery: z.string().nullable().optional(),
  deliveredDate: z.string().nullable().optional(),
  status: z.string().optional(),
  invoiceId: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  internalNotes: z.string().nullable().optional(),
})

export type CreateCarJobCardPayload = z.infer<typeof CreateCarJobCardSchema>
export type UpdateCarJobCardPayload = z.infer<typeof UpdateCarJobCardSchema>
