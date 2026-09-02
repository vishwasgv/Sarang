import { z } from 'zod'

export const CheckInCustomerSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  notes: z.string().max(2000).optional(),
})

export const CheckInIdSchema = z.object({
  checkInId: z.string().min(1, 'Check-in ID is required'),
})

export const ListCheckInsSchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  customerId: z.string().optional(),
})
