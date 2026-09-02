import { z } from 'zod'

// 2026-09 §12 — Tours & Travels.
export const CreateTourPackageSchema = z.object({
  packageName: z.string().min(1, 'Package name is required').max(200),
  itineraryDescription: z.string().max(2000).optional(),
  durationDays: z.number().int().positive('Duration must be at least 1 day'),
  defaultTotalSeats: z.number().int().positive('Default total seats must be greater than zero'),
  farePerSeat: z.number().nonnegative('Fare per seat cannot be negative'),
})

export const UpdateTourPackageStatusSchema = z.object({
  id: z.string().min(1, 'Tour package ID is required'),
  isActive: z.boolean(),
})

export const CreateTourDepartureSchema = z.object({
  tourPackageId: z.string().min(1, 'Tour package is required'),
  departureDate: z.string().min(1, 'Departure date is required'),
  vehicleId: z.string().optional(),
  totalSeats: z.number().int().positive().optional(),
})

export const UpdateTourDepartureStatusSchema = z.object({
  id: z.string().min(1, 'Tour departure ID is required'),
  status: z.enum(['SCHEDULED', 'COMPLETED', 'CANCELLED']),
})

export type CreateTourPackagePayload = z.infer<typeof CreateTourPackageSchema>
export type CreateTourDeparturePayload = z.infer<typeof CreateTourDepartureSchema>
