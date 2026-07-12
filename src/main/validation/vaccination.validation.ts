import { z } from 'zod'

export const CreateVaccinationRecordSchema = z.object({
  petId: z.string().min(1, 'Pet is required'),
  vaccineName: z.string().min(1, 'Vaccine name is required'),
  vaccineType: z.string().optional(),
  batchNumber: z.string().optional(),
  manufacturer: z.string().optional(),
  administeredAt: z.string().min(1, 'Administered date is required'),
  administeredBy: z.string().optional(),
  nextDueDate: z.string().optional(),
  notes: z.string().optional(),
})

export const UpdateVaccinationRecordSchema = z.object({
  id: z.string().min(1, 'Vaccination record ID is required'),
  vaccineName: z.string().min(1).optional(),
  vaccineType: z.string().nullable().optional(),
  batchNumber: z.string().nullable().optional(),
  manufacturer: z.string().nullable().optional(),
  administeredAt: z.string().optional(),
  administeredBy: z.string().nullable().optional(),
  nextDueDate: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  certificatePrinted: z.boolean().optional(),
})

export const DeleteVaccinationRecordSchema = z.object({
  id: z.string().min(1, 'Vaccination record ID is required'),
})

export const CreateVaccineReminderSchema = z.object({
  vaccinationRecordId: z.string().min(1, 'Vaccination record is required'),
})

export type CreateVaccinationRecordPayload = z.infer<typeof CreateVaccinationRecordSchema>
export type UpdateVaccinationRecordPayload = z.infer<typeof UpdateVaccinationRecordSchema>
export type DeleteVaccinationRecordPayload = z.infer<typeof DeleteVaccinationRecordSchema>
export type CreateVaccineReminderPayload = z.infer<typeof CreateVaccineReminderSchema>
