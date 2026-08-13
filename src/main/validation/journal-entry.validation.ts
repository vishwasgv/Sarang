import { z } from 'zod'

// Each line is either a debit or a credit, never both (a line trying to be
// both is almost always a data-entry mistake, not a legitimate use case —
// the actual debit=credit balance check across the whole entry happens in
// the service layer using the Decimal-safe currency engine, not here, since
// that comparison needs rounding-aware arithmetic this schema shouldn't own).
const JournalEntryLineSchema = z.object({
  accountId: z.string().min(1, 'Account is required'),
  bankAccountId: z.string().min(1).optional(),
  // Phase 65 — Reporting Tags / Cost & Profit Centres, optional on a manual
  // entry the same as on every automated posting.
  costCentreId: z.string().min(1).optional(),
  debitAmount: z.number().min(0).default(0),
  creditAmount: z.number().min(0).default(0),
  remarks: z.string().max(300).optional(),
}).refine((line) => (line.debitAmount > 0) !== (line.creditAmount > 0), {
  message: 'Each journal line must have either a debit or a credit amount, not both and not neither.'
})

export const CreateJournalEntrySchema = z.object({
  entryDate: z.string().optional(),
  narration: z.string().max(500).optional(),
  lines: z.array(JournalEntryLineSchema).min(2, 'A journal entry needs at least two lines (one debit, one credit).'),
})

export const ReverseJournalEntrySchema = z.object({
  id: z.string().min(1),
  reason: z.string().min(1, 'Reversal reason is required').max(500),
})

export type CreateJournalEntryPayload = z.infer<typeof CreateJournalEntrySchema>
export type ReverseJournalEntryPayload = z.infer<typeof ReverseJournalEntrySchema>
