import { z } from 'zod'

export const RepairTicketIdSchema = z.string().min(1, 'Repair ticket ID is required')

const RepairTicketStatusEnum = z.enum([
  'RECEIVED', 'DIAGNOSED', 'SENT_TO_VENDOR', 'AWAITING_PARTS',
  'REPAIRED', 'REPLACED', 'RETURNED_TO_CUSTOMER', 'CANCELLED'
])

export const CreateRepairTicketSchema = z.object({
  serialId: z.string().min(1, 'Serial/IMEI is required'),
  customerId: z.string().optional(),
  issueDescription: z.string().min(1, 'Issue description is required').max(2000),
  vendorId: z.string().optional(),
  notes: z.string().max(2000).optional(),
})

export const ListRepairTicketsSchema = z.object({
  status: RepairTicketStatusEnum.optional(),
  productId: z.string().optional(),
  customerId: z.string().optional(),
  search: z.string().optional(),
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().optional(),
})

export const UpdateRepairTicketStatusSchema = z.object({
  id: z.string().min(1, 'Repair ticket ID is required'),
  status: RepairTicketStatusEnum,
  vendorId: z.string().optional(),
  vendorRmaNumber: z.string().max(100).optional(),
  replacementSerialId: z.string().optional(),
  repairCost: z.number().nonnegative('Repair cost cannot be negative').optional(),
  notes: z.string().max(2000).optional(),
})

export type CreateRepairTicketPayload = z.infer<typeof CreateRepairTicketSchema>
export type ListRepairTicketsPayload = z.infer<typeof ListRepairTicketsSchema>
export type UpdateRepairTicketStatusPayload = z.infer<typeof UpdateRepairTicketStatusSchema>
