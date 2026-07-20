import { z } from 'zod'

export const CreateTicketSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  category: z.string().optional(),
  customerId: z.string().optional(),
  assignedToId: z.string().optional(),
})

export const UpdateTicketSchema = z.object({
  id: z.string().min(1, 'Ticket ID is required'),
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  category: z.string().optional(),
  customerId: z.string().nullable().optional(),
  assignedToId: z.string().nullable().optional(),
  resolution: z.string().optional(),
})

export const DeleteTicketSchema = z.object({
  id: z.string().min(1, 'Ticket ID is required'),
})

export const GenerateTicketInvoiceSchema = z.object({
  id: z.string().min(1, 'Ticket ID is required'),
  amount: z.number().positive('Enter a billable amount greater than zero.').finite(),
})

export type CreateTicketPayload = z.infer<typeof CreateTicketSchema>
export type UpdateTicketPayload = z.infer<typeof UpdateTicketSchema>
export type DeleteTicketPayload = z.infer<typeof DeleteTicketSchema>
export type GenerateTicketInvoicePayload = z.infer<typeof GenerateTicketInvoiceSchema>
