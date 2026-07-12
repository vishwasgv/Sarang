import { z } from 'zod'

export const GenerateWhatsAppLinkSchema = z.object({
  phone: z.string().min(1, 'Phone is required'),
  message: z.string().min(1, 'Message is required'),
  notificationType: z.string().min(1, 'Notification type is required'),
  appointmentId: z.string().optional(),
  customerId: z.string().optional(),
  customerName: z.string().max(255).optional(),
})

export const CreateAppointmentReminderSchema = z.object({
  appointmentId: z.string().min(1, 'Appointment ID is required'),
})

export const NotificationIdSchema = z.object({
  id: z.string().min(1, 'Notification ID is required'),
})

export type GenerateWhatsAppLinkPayload = z.infer<typeof GenerateWhatsAppLinkSchema>
export type CreateAppointmentReminderPayload = z.infer<typeof CreateAppointmentReminderSchema>
export type NotificationIdPayload = z.infer<typeof NotificationIdSchema>
