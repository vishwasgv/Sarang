import { z } from 'zod'

export const CreateAppointmentSchema = z.object({
  customerId: z.string().optional(),
  customerName: z.string().optional(),
  providerId: z.string().optional(),
  serviceCatalogId: z.string().optional(),
  serviceTitle: z.string().min(1, 'Service title is required'),
  scheduledDate: z.string().min(1, 'Scheduled date is required'),
  scheduledTime: z.string().min(1, 'Scheduled time is required'),
  durationMinutes: z.number().positive('Duration must be greater than zero').optional(),
  notes: z.string().optional(),
  totalAmount: z.number().nonnegative('Total amount cannot be negative').optional(),
  depositPaid: z.number().nonnegative('Deposit paid cannot be negative').optional(),
  chairAssignment: z.string().optional(),
  createdBy: z.string().optional(),
  services: z.string().optional(),
  referredFromVisitNoteId: z.string().optional(),
  // Phase 58 §2 — Vet Clinic: which pet this visit is for.
  petId: z.string().optional(),
})

export const UpdateAppointmentSchema = z.object({
  id: z.string().min(1, 'Appointment ID is required'),
  customerId: z.string().nullable().optional(),
  customerName: z.string().nullable().optional(),
  providerId: z.string().nullable().optional(),
  serviceCatalogId: z.string().nullable().optional(),
  serviceTitle: z.string().min(1).optional(),
  scheduledDate: z.string().optional(),
  scheduledTime: z.string().optional(),
  durationMinutes: z.number().positive('Duration must be greater than zero').optional(),
  notes: z.string().nullable().optional(),
  privateNotes: z.string().nullable().optional(),
  totalAmount: z.number().nonnegative('Total amount cannot be negative').optional(),
  depositPaid: z.number().nonnegative('Deposit paid cannot be negative').optional(),
  chairAssignment: z.string().nullable().optional(),
  petId: z.string().nullable().optional(),
})

export const UpdateAppointmentStatusSchema = z.object({
  id: z.string().min(1, 'Appointment ID is required'),
  status: z.enum(['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW']),
  cancellationReason: z.string().optional(),
})

export const AppointmentIdSchema = z.object({
  id: z.string().min(1, 'Appointment ID is required'),
})

export const GenerateAppointmentBatchInvoiceSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, 'Select at least one appointment to invoice'),
})

// Phase 58 §2 — Beauty Salon: unify a retail product upsell into the same
// appointment checkout, plus a real payment-method choice (previously
// hardcoded to CREDIT with no override).
export const GenerateAppointmentInvoiceSchema = z.object({
  id: z.string().min(1, 'Appointment ID is required'),
  retailItems: z.array(z.object({
    productId: z.string().min(1),
    quantity: z.number().positive('Quantity must be greater than zero'),
  })).max(50).optional(),
  paymentMethod: z.enum(['CASH', 'UPI', 'CARD', 'WALLET', 'CREDIT', 'SPLIT']).optional(),
})

export type CreateAppointmentPayload = z.infer<typeof CreateAppointmentSchema>
export type UpdateAppointmentPayload = z.infer<typeof UpdateAppointmentSchema>
export type UpdateAppointmentStatusPayload = z.infer<typeof UpdateAppointmentStatusSchema>
