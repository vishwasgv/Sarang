import { z } from 'zod'

// 2026-09 §12 — Tours & Travels.
export const CreateVehicleSchema = z.object({
  registrationNumber: z.string().min(1, 'Registration number is required').max(50),
  vehicleType: z.enum(['SEDAN', 'SUV', 'TEMPO_TRAVELLER', 'MINI_BUS', 'BUS']),
  seatingCapacity: z.number().int().positive('Seating capacity must be at least 1'),
  notes: z.string().max(2000).optional(),
})

export const UpdateVehicleStatusSchema = z.object({
  id: z.string().min(1, 'Vehicle ID is required'),
  status: z.enum(['ACTIVE', 'IN_SERVICE', 'INACTIVE']),
})

export const CreateVehicleServiceLogSchema = z.object({
  vehicleId: z.string().min(1, 'Vehicle is required'),
  serviceDate: z.string().min(1, 'Service date is required'),
  serviceType: z.enum(['SERVICE', 'REPAIR', 'MAINTENANCE']),
  odometerAtService: z.number().nonnegative('Odometer reading cannot be negative'),
  cost: z.number().nonnegative().optional(),
  nextServiceDueKm: z.number().nonnegative().optional(),
  nextServiceDueDate: z.string().optional(),
  vendorName: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
})

export type CreateVehiclePayload = z.infer<typeof CreateVehicleSchema>
export type CreateVehicleServiceLogPayload = z.infer<typeof CreateVehicleServiceLogSchema>
