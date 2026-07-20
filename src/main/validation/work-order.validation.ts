import { z } from 'zod'

const WorkOrderStepSchema = z.object({
  id: z.string().optional(),
  stepNumber: z.number().nonnegative('Step number cannot be negative').int(),
  taskName: z.string().min(1, 'Task name is required'),
  notes: z.string().optional(),
  // Phase 58 §2 — QC/inspection checkpoint flag.
  isQcStep: z.boolean().optional(),
})

export const UpsertWorkOrdersSchema = z.object({
  productionOrderId: z.string().min(1, 'Production order is required'),
  steps: z.array(WorkOrderStepSchema).min(1, 'At least one step is required'),
})

export const UpdateWorkOrderStatusSchema = z.object({
  id: z.string().min(1, 'Work order ID is required'),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'DONE', 'SKIPPED']),
  // Phase 58 §2 — required server-side (work-order.service.ts) when marking
  // a QC-flagged step DONE.
  qcResult: z.enum(['PASS', 'FAIL']).optional(),
  qcNotes: z.string().optional(),
})

export type UpsertWorkOrdersPayload = z.infer<typeof UpsertWorkOrdersSchema>
export type UpdateWorkOrderStatusPayload = z.infer<typeof UpdateWorkOrderStatusSchema>
