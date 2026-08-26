import { z } from 'zod'

export const CreateLegalCaseSchema = z.object({
  caseNumber: z.string().min(1, 'Case number is required'),
  caseTitle: z.string().min(1, 'Case title is required'),
  caseType: z.string().max(50).optional(),
  courtName: z.string().min(1, 'Court name is required'),
  courtDistrict: z.string().max(100).optional(),
  courtState: z.string().max(100).optional(),
  eCourtId: z.string().max(100).optional(),
  clientId: z.string().min(1, 'Client is required'),
  advocateId: z.string().optional(),
  filingDate: z.string().optional(),
  opposingPartyName: z.string().max(200).optional(),
  limitationDate: z.string().optional(),
  feeAgreed: z.number().nonnegative('Fee agreed cannot be negative').finite().optional(),
  notes: z.string().max(2000).optional(),
})

export const UpdateLegalCaseSchema = z.object({
  id: z.string().min(1, 'Case ID is required'),
  caseNumber: z.string().min(1).optional(),
  caseTitle: z.string().min(1).optional(),
  caseType: z.string().max(50).optional(),
  courtName: z.string().min(1).optional(),
  courtDistrict: z.string().max(100).nullable().optional(),
  courtState: z.string().max(100).nullable().optional(),
  eCourtId: z.string().max(100).nullable().optional(),
  advocateId: z.string().nullable().optional(),
  status: z.string().max(50).optional(),
  filingDate: z.string().nullable().optional(),
  nextHearingDate: z.string().nullable().optional(),
  opposingPartyName: z.string().max(200).nullable().optional(),
  limitationDate: z.string().nullable().optional(),
  feeAgreed: z.number().nonnegative('Fee agreed cannot be negative').finite().nullable().optional(),
  feeCollected: z.number().nonnegative('Fee collected cannot be negative').finite().optional(),
  notes: z.string().max(2000).nullable().optional(),
})

export const CheckConflictOfInterestSchema = z.object({
  clientId: z.string().optional(),
  opposingPartyName: z.string().max(200).optional(),
  excludeCaseId: z.string().optional(),
})

// Phase 68 §9.1 — Lawyer item 3: case-stage tracker.
export const UpdateCaseStageSchema = z.object({
  id: z.string().min(1, 'Case ID is required'),
  caseStage: z.string().min(1, 'Stage is required'),
})

// Phase 68 §9.1 — Lawyer item 5: court-fee/disbursement tracking.
export const ListCaseDisbursementsSchema = z.object({
  caseId: z.string().min(1, 'Case is required'),
})

export const CreateCaseDisbursementSchema = z.object({
  caseId: z.string().min(1, 'Case is required'),
  description: z.string().min(1, 'Description is required').max(500),
  amount: z.coerce.number().positive('Amount must be greater than zero'),
  paidDate: z.string().min(1, 'Paid date is required'),
  notes: z.string().max(2000).optional(),
})

export const MarkDisbursementBilledSchema = z.object({
  id: z.string().min(1, 'Disbursement ID is required'),
  isBilledToClient: z.boolean(),
})

export const DeleteCaseDisbursementSchema = z.object({
  id: z.string().min(1, 'Disbursement ID is required'),
})

export type CreateLegalCasePayload = z.infer<typeof CreateLegalCaseSchema>
export type UpdateLegalCasePayload = z.infer<typeof UpdateLegalCaseSchema>
export type CheckConflictOfInterestPayload = z.infer<typeof CheckConflictOfInterestSchema>
export type CreateCaseDisbursementPayload = z.infer<typeof CreateCaseDisbursementSchema>
