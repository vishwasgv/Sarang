import { z } from 'zod'

export const CreateIssueSchema = z.object({
  projectId: z.string().min(1, 'Project is required'),
  title: z.string().min(1, 'Title is required'),
  description: z.string().max(5000).optional(),
  priority: z.string().max(20).optional(),
  status: z.string().max(20).optional(),
  assignedToId: z.string().optional(),
  sprintId: z.string().optional(),
  storyPoints: z.number().int().nonnegative().max(1000).optional(),
})

export const UpdateIssueSchema = z.object({
  id: z.string().min(1, 'Issue ID is required'),
  title: z.string().min(1).optional(),
  description: z.string().max(5000).nullable().optional(),
  priority: z.string().max(20).optional(),
  status: z.string().max(20).optional(),
  assignedToId: z.string().nullable().optional(),
  sprintId: z.string().nullable().optional(),
  resolvedDate: z.string().nullable().optional(),
  storyPoints: z.number().int().nonnegative().max(1000).nullable().optional(),
})

export const DeleteIssueSchema = z.object({
  id: z.string().min(1, 'Issue ID is required'),
})

export type CreateIssuePayload = z.infer<typeof CreateIssueSchema>
export type UpdateIssuePayload = z.infer<typeof UpdateIssueSchema>

// Phase 58 §2 — Software Agency: comments + subtasks

export const IssueIdParamSchema = z.object({ issueId: z.string().min(1, 'Issue ID is required') })
export const EntityIdSchema = z.object({ id: z.string().min(1, 'ID is required') })

export const AddIssueCommentSchema = z.object({
  issueId: z.string().min(1, 'Issue ID is required'),
  body: z.string().min(1, 'Comment cannot be empty').max(5000),
})

export const CreateIssueSubtaskSchema = z.object({
  issueId: z.string().min(1, 'Issue ID is required'),
  title: z.string().min(1, 'Subtask title is required').max(300),
})

export const ToggleIssueSubtaskSchema = z.object({
  id: z.string().min(1, 'Subtask ID is required'),
  isDone: z.boolean(),
})
