import { z } from 'zod'

export const CandidateIdSchema = z.string().min(1, 'Candidate ID is required')

export const CreateCandidateSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  email: z.string().optional(),
  phone: z.string().optional(),
  currentJobTitle: z.string().optional(),
  currentEmployer: z.string().optional(),
  totalExperience: z.number().nonnegative('Total experience cannot be negative').optional(),
  skills: z.array(z.string()).optional(),
  preferredLocations: z.array(z.string()).optional(),
  educationSummary: z.string().optional(),
  resumeNotes: z.string().optional(),
  expectedSalary: z.number().nonnegative('Expected salary cannot be negative').optional(),
  currentSalary: z.number().nonnegative('Current salary cannot be negative').optional(),
  availableFrom: z.string().optional(),
  source: z.string().optional(),
  notes: z.string().optional(),
})

export const UpdateCandidateSchema = z.object({
  id: z.string().min(1, 'Candidate ID is required'),
  fullName: z.string().min(1).optional(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  currentJobTitle: z.string().nullable().optional(),
  currentEmployer: z.string().nullable().optional(),
  totalExperience: z.number().nonnegative('Total experience cannot be negative').nullable().optional(),
  skills: z.array(z.string()).optional(),
  preferredLocations: z.array(z.string()).optional(),
  educationSummary: z.string().nullable().optional(),
  resumeNotes: z.string().nullable().optional(),
  expectedSalary: z.number().nonnegative('Expected salary cannot be negative').nullable().optional(),
  currentSalary: z.number().nonnegative('Current salary cannot be negative').nullable().optional(),
  availableFrom: z.string().nullable().optional(),
  status: z.string().optional(),
  source: z.string().optional(),
  notes: z.string().nullable().optional(),
})

export type CreateCandidatePayload = z.infer<typeof CreateCandidateSchema>
export type UpdateCandidatePayload = z.infer<typeof UpdateCandidateSchema>
