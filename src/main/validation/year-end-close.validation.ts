import { z } from 'zod'

export const CloseFinancialYearSchema = z.object({
  closingDate: z.string().min(1, 'Closing date is required'),
})

export type CloseFinancialYearPayload = z.infer<typeof CloseFinancialYearSchema>
