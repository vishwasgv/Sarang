import { z } from 'zod'

export const PayrollPeriodSchema = z.object({
  year: z.number().int().min(2000, 'Year must be valid').max(2200, 'Year must be valid'),
  month: z.number().int().min(1, 'Month must be between 1 and 12').max(12, 'Month must be between 1 and 12'),
})

export const UpdateDeductionsSchema = z.object({
  id: z.string().min(1, 'Payroll record ID is required'),
  deductions: z.array(z.object({
    name: z.string().min(1, 'Deduction name is required'),
    amount: z.number().nonnegative('Deduction amount cannot be negative').finite(),
  })),
  notes: z.string().max(2000).optional(),
})

export const MarkSalaryPaidSchema = z.object({
  id: z.string().min(1, 'Payroll record ID is required'),
  paymentMethod: z.string().min(1, 'Payment method is required'),
  paidDate: z.string().optional(),
})

export type PayrollPeriodPayload = z.infer<typeof PayrollPeriodSchema>
export type UpdateDeductionsPayload = z.infer<typeof UpdateDeductionsSchema>
export type MarkSalaryPaidPayload = z.infer<typeof MarkSalaryPaidSchema>
