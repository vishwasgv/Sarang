import { z } from 'zod'

export const CreateJobOrderSchema = z.object({
  clientId: z.string().min(1, 'Client is required'),
  jobTitle: z.string().min(1, 'Job title is required'),
  jobDescription: z.string().max(5000).optional(),
  requiredSkills: z.array(z.string()).optional(),
  experienceMin: z.number().finite().nonnegative('Experience cannot be negative').optional(),
  experienceMax: z.number().finite().nonnegative('Experience cannot be negative').optional(),
  salaryBudgetMin: z.number().finite().nonnegative('Salary budget cannot be negative').optional(),
  salaryBudgetMax: z.number().finite().nonnegative('Salary budget cannot be negative').optional(),
  location: z.string().max(255).optional(),
  numberOfPositions: z.number().finite().positive('Number of positions must be greater than zero').optional(),
  targetDate: z.string().optional(),
  commissionType: z.string().max(20).optional(),
  commissionValue: z.number().finite().nonnegative('Commission value cannot be negative').optional(),
  feeAgreementTerms: z.string().max(2000).optional(),
  replacementGuaranteeDays: z.number().int().nonnegative('Replacement guarantee days cannot be negative').optional(),
  notes: z.string().max(2000).optional(),
})

export const UpdateJobOrderSchema = z.object({
  id: z.string().min(1, 'Job order ID is required'),
  jobTitle: z.string().min(1).optional(),
  jobDescription: z.string().max(5000).nullable().optional(),
  requiredSkills: z.array(z.string()).optional(),
  experienceMin: z.number().finite().nonnegative('Experience cannot be negative').nullable().optional(),
  experienceMax: z.number().finite().nonnegative('Experience cannot be negative').nullable().optional(),
  salaryBudgetMin: z.number().finite().nonnegative('Salary budget cannot be negative').nullable().optional(),
  salaryBudgetMax: z.number().finite().nonnegative('Salary budget cannot be negative').nullable().optional(),
  location: z.string().max(255).nullable().optional(),
  numberOfPositions: z.number().finite().positive('Number of positions must be greater than zero').optional(),
  targetDate: z.string().nullable().optional(),
  status: z.string().max(20).optional(),
  commissionType: z.string().max(20).optional(),
  commissionValue: z.number().finite().nonnegative('Commission value cannot be negative').optional(),
  feeAgreementTerms: z.string().max(2000).nullable().optional(),
  replacementGuaranteeDays: z.number().int().nonnegative('Replacement guarantee days cannot be negative').nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
})

export const JobOrderIdSchema = z.string().min(1, 'Job order ID is required')

export type CreateJobOrderPayload = z.infer<typeof CreateJobOrderSchema>
export type UpdateJobOrderPayload = z.infer<typeof UpdateJobOrderSchema>
