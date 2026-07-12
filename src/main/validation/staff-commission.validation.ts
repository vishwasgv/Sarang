import { z } from 'zod'

export const CalculateCommissionSchema = z.object({
  appointmentId: z.string().min(1, 'Appointment is required'),
  staffId: z.string().min(1, 'Staff member is required'),
  serviceRevenue: z.number().nonnegative('Service revenue cannot be negative').finite(),
  commissionType: z.enum(['PERCENT', 'FLAT']),
  commissionRate: z.number().nonnegative('Commission rate cannot be negative').finite(),
  tipAmount: z.number().nonnegative('Tip amount cannot be negative').finite().optional(),
  period: z.string().optional(),
})

export const MarkCommissionsPaidSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, 'At least one commission is required'),
  paidDate: z.string().optional(),
})

export type CalculateCommissionPayload = z.infer<typeof CalculateCommissionSchema>
export type MarkCommissionsPaidPayload = z.infer<typeof MarkCommissionsPaidSchema>
