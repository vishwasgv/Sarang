import { z } from 'zod'

export const CreateVehicleSchema = z.object({
  vehicleNumber: z.string().min(1, 'Vehicle number is required'),
  vehicleType: z.string().min(1, 'Vehicle type is required'),
  ownerType: z.string().max(20).optional(),
  driverName: z.string().max(100).optional(),
  driverPhone: z.string().max(30).optional(),
  capacity: z.number().nonnegative('Capacity cannot be negative').finite().optional(),
  capacityUnit: z.string().max(10).optional(),
  notes: z.string().max(2000).optional(),
})

export const UpdateVehicleSchema = z.object({
  id: z.string().min(1, 'Vehicle ID is required'),
  vehicleNumber: z.string().min(1).optional(),
  vehicleType: z.string().min(1).optional(),
  ownerType: z.string().max(20).optional(),
  driverName: z.string().max(100).optional(),
  driverPhone: z.string().max(30).optional(),
  capacity: z.number().nonnegative('Capacity cannot be negative').finite().optional(),
  capacityUnit: z.string().max(10).optional(),
  notes: z.string().max(2000).optional(),
  status: z.string().max(20).optional(),
})

export const UpdateVehicleStatusSchema = z.object({
  id: z.string().min(1, 'Vehicle ID is required'),
  status: z.string().min(1, 'Status is required'),
})

export type CreateVehiclePayload = z.infer<typeof CreateVehicleSchema>
export type UpdateVehiclePayload = z.infer<typeof UpdateVehicleSchema>
export type UpdateVehicleStatusPayload = z.infer<typeof UpdateVehicleStatusSchema>
