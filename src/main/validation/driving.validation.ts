import { z } from 'zod'

// ── LearnerProfile ────────────────────────────────────────────────────────────

export const UpsertLearnerProfileSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  dlApplicationNumber: z.string().max(100).nullable().optional(),
  learnerLicenseNumber: z.string().max(100).nullable().optional(),
  learnerLicenseDate: z.string().nullable().optional(),
  permanentLicenseNumber: z.string().max(100).nullable().optional(),
  permanentLicenseDate: z.string().nullable().optional(),
  licenseClass: z.string().max(50).optional(),
  vehicleClassPreference: z.string().max(50).nullable().optional(),
})

// ── DrivingVehicle ────────────────────────────────────────────────────────────

export const CreateDrivingVehicleSchema = z.object({
  registrationNumber: z.string().min(1, 'Registration number is required'),
  make: z.string().min(1, 'Make is required'),
  model: z.string().min(1, 'Model is required'),
  vehicleClass: z.string().min(1, 'Vehicle class is required'),
  instructorId: z.string().optional(),
  status: z.string().max(50).optional(),
})

export const UpdateDrivingVehicleSchema = z.object({
  id: z.string().min(1, 'Vehicle ID is required'),
  registrationNumber: z.string().min(1).optional(),
  make: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  vehicleClass: z.string().min(1).optional(),
  instructorId: z.string().nullable().optional(),
  status: z.string().max(50).optional(),
})

export const DeleteDrivingVehicleSchema = z.object({
  id: z.string().min(1, 'Vehicle ID is required'),
})

// ── DrivingSession ────────────────────────────────────────────────────────────

export const CreateDrivingSessionSchema = z.object({
  learnerId: z.string().min(1, 'Learner is required'),
  instructorId: z.string().min(1, 'Instructor is required'),
  vehicleId: z.string().min(1, 'Vehicle is required'),
  sessionDate: z.string().min(1, 'Session date is required'),
  sessionTime: z.string().min(1, 'Session time is required'),
  durationMinutes: z.number().finite().positive().optional(),
  pickupPoint: z.string().max(255).optional(),
  sessionNumber: z.number().finite().positive().optional(),
  sessionFee: z.number().finite().nonnegative('Session fee cannot be negative').optional(),
  packageEnrollmentId: z.string().optional(),
})

export const UpdateDrivingSessionSchema = z.object({
  id: z.string().min(1, 'Session ID is required'),
  status: z.string().max(50).optional(),
  instructorNotes: z.string().max(2000).optional(),
  sessionDate: z.string().optional(),
  sessionTime: z.string().optional(),
  durationMinutes: z.number().finite().positive().optional(),
  pickupPoint: z.string().max(255).nullable().optional(),
  sessionFee: z.number().finite().nonnegative('Session fee cannot be negative').nullable().optional(),
})

export const GenerateDrivingSessionInvoiceSchema = z.object({
  id: z.string().min(1, 'Session ID is required'),
})

// ── DrivingTest ────────────────────────────────────────────────────────────────

export const CreateDrivingTestSchema = z.object({
  learnerId: z.string().min(1, 'Learner is required'),
  testType: z.string().min(1, 'Test type is required'),
  testDate: z.string().min(1, 'Test date is required'),
  testCenter: z.string().min(1, 'Test center is required'),
  notes: z.string().max(2000).optional(),
})

export const UpdateDrivingTestSchema = z.object({
  id: z.string().min(1, 'Test ID is required'),
  result: z.string().max(50).optional(),
  retestDate: z.string().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
})

// ── DrivingPackage ────────────────────────────────────────────────────────────

export const CreateDrivingPackageSchema = z.object({
  packageName: z.string().min(1, 'Package name is required'),
  totalSessions: z.number().finite().positive('Total sessions must be greater than zero'),
  price: z.number().finite().nonnegative('Package price cannot be negative'),
  vehicleClass: z.string().max(50).optional(),
  isActive: z.boolean().optional(),
})

export const UpdateDrivingPackageSchema = z.object({
  id: z.string().min(1, 'Package ID is required'),
  packageName: z.string().min(1).optional(),
  totalSessions: z.number().finite().positive('Total sessions must be greater than zero').optional(),
  price: z.number().finite().nonnegative('Package price cannot be negative').optional(),
  vehicleClass: z.string().max(50).optional(),
  isActive: z.boolean().optional(),
})

export const DeleteDrivingPackageSchema = z.object({
  id: z.string().min(1, 'Package ID is required'),
})

// ── DrivingPackageEnrollment ─────────────────────────────────────────────────

export const CreateDrivingPackageEnrollmentSchema = z.object({
  learnerId: z.string().min(1, 'Learner is required'),
  packageId: z.string().min(1, 'Package is required'),
  purchaseDate: z.string().optional(),
  notes: z.string().max(2000).optional(),
})

export const DeleteDrivingPackageEnrollmentSchema = z.object({
  id: z.string().min(1, 'Enrollment ID is required'),
})

export const GenerateDrivingPackageInvoiceSchema = z.object({
  id: z.string().min(1, 'Enrollment ID is required'),
})

export type UpsertLearnerProfilePayload = z.infer<typeof UpsertLearnerProfileSchema>
export type CreateDrivingVehiclePayload = z.infer<typeof CreateDrivingVehicleSchema>
export type UpdateDrivingVehiclePayload = z.infer<typeof UpdateDrivingVehicleSchema>
export type CreateDrivingSessionPayload = z.infer<typeof CreateDrivingSessionSchema>
export type UpdateDrivingSessionPayload = z.infer<typeof UpdateDrivingSessionSchema>
export type CreateDrivingTestPayload = z.infer<typeof CreateDrivingTestSchema>
export type UpdateDrivingTestPayload = z.infer<typeof UpdateDrivingTestSchema>
export type CreateDrivingPackagePayload = z.infer<typeof CreateDrivingPackageSchema>
export type UpdateDrivingPackagePayload = z.infer<typeof UpdateDrivingPackageSchema>
export type CreateDrivingPackageEnrollmentPayload = z.infer<typeof CreateDrivingPackageEnrollmentSchema>
