import { z } from 'zod'

const SampleTypeSchema = z.enum(['BLOOD', 'URINE', 'STOOL', 'SWAB', 'IMAGING', 'OTHER'])

const CreateLabTestOrderItemSchema = z.object({
  serviceCatalogId: z.string().optional(),
  testName: z.string().min(1, 'Test name is required'),
  category: z.string().max(100).optional(),
  sampleType: SampleTypeSchema.optional(),
  price: z.number().finite().nonnegative('Price cannot be negative').optional(),
})

export const CreateLabTestOrderSchema = z.object({
  customerId: z.string().optional(),
  patientName: z.string().min(1, 'Patient name is required'),
  patientAge: z.string().max(20).optional(),
  appointmentId: z.string().optional(),
  referredByProviderId: z.string().optional(),
  referringNotes: z.string().max(2000).optional(),
  notes: z.string().max(2000).optional(),
  items: z.array(CreateLabTestOrderItemSchema).min(1, 'Select at least one test or panel.'),
})

export const UpdateLabTestOrderSchema = z.object({
  id: z.string().min(1, 'Lab test order ID is required'),
  customerId: z.string().nullable().optional(),
  patientName: z.string().min(1).optional(),
  patientAge: z.string().max(20).nullable().optional(),
  referredByProviderId: z.string().nullable().optional(),
  referringNotes: z.string().max(2000).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
})

export const AddTestItemSchema = CreateLabTestOrderItemSchema.extend({
  labTestOrderId: z.string().min(1, 'Lab test order ID is required'),
})

export const RemoveTestItemSchema = z.object({
  itemId: z.string().min(1, 'itemId is required'),
})

export const MarkSampleCollectedSchema = z.object({
  id: z.string().min(1, 'Lab test order ID is required'),
  collectedById: z.string().optional(),
})

const ResultParameterSchema = z.object({
  parameter: z.string().min(1),
  value: z.string().min(1),
  unit: z.string().max(50).optional(),
  referenceRange: z.string().max(100).optional(),
  flag: z.enum(['LOW', 'NORMAL', 'HIGH', 'ABNORMAL']).optional(),
})

export const UpdateTestResultSchema = z.object({
  itemId: z.string().min(1, 'itemId is required'),
  resultParameters: z.array(ResultParameterSchema).optional(),
  resultSummary: z.string().max(5000).nullable().optional(),
})

export const FinalizeReportSchema = z.object({
  id: z.string().min(1, 'Lab test order ID is required'),
  reportedById: z.string().optional(),
})

export const LabTestOrderIdSchema = z.object({
  id: z.string().min(1, 'Lab test order ID is required'),
})

export const CancelLabTestOrderSchema = z.object({
  id: z.string().min(1, 'Lab test order ID is required'),
  reason: z.string().max(2000).optional(),
})

export type CreateLabTestOrderPayload = z.infer<typeof CreateLabTestOrderSchema>
export type UpdateLabTestOrderPayload = z.infer<typeof UpdateLabTestOrderSchema>
export type AddTestItemPayload = z.infer<typeof AddTestItemSchema>
export type UpdateTestResultPayload = z.infer<typeof UpdateTestResultSchema>
