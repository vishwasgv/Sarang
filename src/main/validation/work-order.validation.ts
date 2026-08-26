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
  // Phase 67 §9.1 — Manufacturing item 3: optional per-stage rejection counts.
  qtyInspected: z.number().nonnegative().optional(),
  qtyRejected: z.number().nonnegative().optional(),
})

// Phase 67 §9.1 — Manufacturing item 1: machine/labour downtime capture.
export const LogDowntimeSchema = z.object({
  workOrderId: z.string().min(1, 'Work order is required'),
  reason: z.string().min(1, 'Downtime reason is required').max(200),
  minutes: z.number().positive('Minutes must be greater than zero'),
  notes: z.string().max(1000).optional(),
})

export type UpsertWorkOrdersPayload = z.infer<typeof UpsertWorkOrdersSchema>
export type UpdateWorkOrderStatusPayload = z.infer<typeof UpdateWorkOrderStatusSchema>
export type LogDowntimePayload = z.infer<typeof LogDowntimeSchema>
