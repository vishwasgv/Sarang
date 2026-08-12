import { z } from 'zod'

const ApprovalStepSchema = z.object({
  sequenceOrder: z.number().int().positive(),
  approverRoleId: z.string().min(1).optional(),
  approverUserId: z.string().min(1).optional(),
  minAmountThreshold: z.number().min(0).default(0),
}).refine((s) => !!s.approverRoleId || !!s.approverUserId, {
  message: 'Each step needs either an approver role or a specific approver user.'
})

export const CreateApprovalWorkflowSchema = z.object({
  documentType: z.enum(['SALES_ORDER', 'PURCHASE_ORDER']),
  name: z.string().min(1, 'Name is required').max(200),
  steps: z.array(ApprovalStepSchema).min(1, 'At least one approval step is required'),
})

export const UpdateApprovalWorkflowSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200).optional(),
  isActive: z.boolean().optional(),
})

export const SubmitForApprovalSchema = z.object({
  documentType: z.enum(['SALES_ORDER', 'PURCHASE_ORDER']),
  documentId: z.string().min(1),
  amount: z.number().min(0),
})

export const ActOnApprovalStepSchema = z.object({
  instanceId: z.string().min(1),
  stepId: z.string().min(1),
  action: z.enum(['APPROVED', 'REJECTED']),
  comment: z.string().max(500).optional(),
})

export type CreateApprovalWorkflowPayload = z.infer<typeof CreateApprovalWorkflowSchema>
export type UpdateApprovalWorkflowPayload = z.infer<typeof UpdateApprovalWorkflowSchema>
export type SubmitForApprovalPayload = z.infer<typeof SubmitForApprovalSchema>
export type ActOnApprovalStepPayload = z.infer<typeof ActOnApprovalStepSchema>
