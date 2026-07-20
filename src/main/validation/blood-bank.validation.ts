import { z } from 'zod'

const BloodGroupEnum = z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])
const ComponentTypeEnum = z.enum(['WHOLE_BLOOD', 'PACKED_RBC', 'PLATELETS', 'PLASMA', 'CRYOPRECIPITATE'])
const ScreeningStatusEnum = z.enum(['PENDING', 'PASSED', 'FAILED'])

export const CreateDonorSchema = z.object({
  fullName: z.string().min(1, 'Donor name is required'),
  phone: z.string().optional(),
  email: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.string().optional(),
  bloodGroup: BloodGroupEnum.optional(),
  weightKg: z.number().positive('Weight must be greater than zero').optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
})

export const UpdateDonorSchema = z.object({
  id: z.string().min(1, 'Donor ID is required'),
  fullName: z.string().min(1).optional(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  bloodGroup: BloodGroupEnum.nullable().optional(),
  weightKg: z.number().positive('Weight must be greater than zero').nullable().optional(),
  address: z.string().nullable().optional(),
  isDeferred: z.boolean().optional(),
  deferralReason: z.string().nullable().optional(),
  deferredUntil: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
})

export const DonorIdSchema = z.object({
  id: z.string().min(1, 'Donor ID is required'),
})

export const SendDonorRecallSchema = z.object({
  donorId: z.string().min(1, 'Donor ID is required'),
})

export const CreateDonationCampSchema = z.object({
  campName: z.string().min(1, 'Camp name is required'),
  location: z.string().optional(),
  campDate: z.string().min(1, 'Camp date is required'),
  organizer: z.string().optional(),
  notes: z.string().optional(),
})

export const CreateDonationRecordSchema = z.object({
  donorId: z.string().min(1, 'Donor is required'),
  campId: z.string().optional(),
  bloodGroup: BloodGroupEnum,
  componentType: ComponentTypeEnum.optional(),
  volumeMl: z.number().positive('Volume must be greater than zero').optional(),
  notes: z.string().optional(),
})

export const UpdateScreeningStatusSchema = z.object({
  id: z.string().min(1, 'Donation record ID is required'),
  screeningStatus: ScreeningStatusEnum,
  screeningNotes: z.string().optional(),
})

export const CreateBloodIssueSchema = z.object({
  customerId: z.string().optional(),
  recipientName: z.string().min(1, 'Recipient name is required'),
  recipientBloodGroup: BloodGroupEnum.optional(),
  purpose: z.string().optional(),
  donationRecordIds: z.array(z.string().min(1)).min(1, 'Select at least one blood unit to issue'),
  price: z.number().nonnegative('Price cannot be negative').optional(),
  // Phase 58 §2 — documented emergency-release override for an incompatible unit.
  overrideIncompatibility: z.boolean().optional(),
  overrideReason: z.string().max(2000).optional(),
})

export const BloodIssueIdSchema = z.object({
  id: z.string().min(1, 'Blood issue ID is required'),
})

export type CreateDonorPayload = z.infer<typeof CreateDonorSchema>
export type UpdateDonorPayload = z.infer<typeof UpdateDonorSchema>
export type CreateDonationCampPayload = z.infer<typeof CreateDonationCampSchema>
export type CreateDonationRecordPayload = z.infer<typeof CreateDonationRecordSchema>
export type UpdateScreeningStatusPayload = z.infer<typeof UpdateScreeningStatusSchema>
export type CreateBloodIssuePayload = z.infer<typeof CreateBloodIssueSchema>
