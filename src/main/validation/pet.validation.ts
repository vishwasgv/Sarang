import { z } from 'zod'

export const CreatePetSchema = z.object({
  customerId: z.string().min(1).optional(),
  petName: z.string().min(1, 'Pet name is required'),
  species: z.string().min(1, 'Species is required'),
  breed: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.string().optional(),
  color: z.string().optional(),
  weight: z.number().nonnegative('Weight cannot be negative').finite().optional(),
  microchipId: z.string().optional(),
  notes: z.string().optional(),
})

export const UpdatePetSchema = z.object({
  id: z.string().min(1, 'Pet ID is required'),
  customerId: z.string().nullable().optional(),
  petName: z.string().min(1).optional(),
  species: z.string().min(1).optional(),
  breed: z.string().nullable().optional(),
  dateOfBirth: z.string().nullable().optional(),
  gender: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  weight: z.number().nonnegative('Weight cannot be negative').finite().nullable().optional(),
  microchipId: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
})

export const PetIdSchema = z.object({ id: z.string().min(1, 'Pet ID is required') })

export const AddWeightEntrySchema = z.object({
  petId: z.string().min(1, 'Pet ID is required'),
  weightKg: z.number().positive('Weight must be greater than zero').finite(),
  notes: z.string().optional(),
  recordedAt: z.string().optional(),
})

export type CreatePetPayload = z.infer<typeof CreatePetSchema>
export type UpdatePetPayload = z.infer<typeof UpdatePetSchema>
export type AddWeightEntryPayload = z.infer<typeof AddWeightEntrySchema>
