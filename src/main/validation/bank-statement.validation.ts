import { z } from 'zod'

const StatementLineInputSchema = z.object({
  transactionDate: z.string().min(1, 'Transaction date is required'),
  description: z.string().min(1, 'Description is required').max(300),
  referenceNumber: z.string().max(100).optional(),
  debitAmount: z.number().min(0).default(0),
  creditAmount: z.number().min(0).default(0),
}).refine((line) => line.debitAmount > 0 || line.creditAmount > 0, {
  message: 'Each statement line needs a non-zero debit or credit amount.'
})

export const ImportStatementLinesSchema = z.object({
  bankAccountId: z.string().min(1, 'Bank account is required'),
  lines: z.array(StatementLineInputSchema).min(1, 'At least one statement line is required').max(2000),
})

export const ReconcileLineSchema = z.object({
  lineId: z.string().min(1),
  matchedType: z.enum(['PAYMENT', 'EXPENSE', 'SUPPLIER_PAYMENT', 'JOURNAL_ENTRY']),
  matchedId: z.string().min(1),
})

export type ImportStatementLinesPayload = z.infer<typeof ImportStatementLinesSchema>
export type ReconcileLinePayload = z.infer<typeof ReconcileLineSchema>
