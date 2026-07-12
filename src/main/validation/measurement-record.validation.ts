import { z } from 'zod'

const measurementField = z.number().nonnegative('Measurement cannot be negative').finite()

export const CreateMeasurementRecordSchema = z.object({
  clientId: z.string().min(1, 'Client ID is required'),
  chest: measurementField.optional(),
  waist: measurementField.optional(),
  hips: measurementField.optional(),
  shoulder: measurementField.optional(),
  neck: measurementField.optional(),
  sleeve: measurementField.optional(),
  inseam: measurementField.optional(),
  outseam: measurementField.optional(),
  thigh: measurementField.optional(),
  height: measurementField.optional(),
  armhole: measurementField.optional(),
  frontNeckDepth: measurementField.optional(),
  backNeckDepth: measurementField.optional(),
  garmentLength: measurementField.optional(),
  cuff: measurementField.optional(),
  notes: z.string().max(2000).optional(),
  takenById: z.string().optional(),
  recordDate: z.string().optional(),
})

export const UpdateMeasurementRecordSchema = z.object({
  id: z.string().min(1, 'Record ID is required'),
  chest: measurementField.nullable().optional(),
  waist: measurementField.nullable().optional(),
  hips: measurementField.nullable().optional(),
  shoulder: measurementField.nullable().optional(),
  neck: measurementField.nullable().optional(),
  sleeve: measurementField.nullable().optional(),
  inseam: measurementField.nullable().optional(),
  outseam: measurementField.nullable().optional(),
  thigh: measurementField.nullable().optional(),
  height: measurementField.nullable().optional(),
  armhole: measurementField.nullable().optional(),
  frontNeckDepth: measurementField.nullable().optional(),
  backNeckDepth: measurementField.nullable().optional(),
  garmentLength: measurementField.nullable().optional(),
  cuff: measurementField.nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  takenById: z.string().nullable().optional(),
  recordDate: z.string().optional(),
})

export type CreateMeasurementRecordPayload = z.infer<typeof CreateMeasurementRecordSchema>
export type UpdateMeasurementRecordPayload = z.infer<typeof UpdateMeasurementRecordSchema>
