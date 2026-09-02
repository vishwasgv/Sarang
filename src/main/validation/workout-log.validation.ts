import { z } from 'zod'

export const CreateWorkoutLogSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  trainerId: z.string().min(1).optional().nullable(),
  exerciseName: z.string().min(1, 'Exercise name is required').max(200),
  machineName: z.string().max(200).optional().nullable(),
  weight: z.number().min(0).optional().nullable(),
  reps: z.number().int().min(0).optional().nullable(),
  sets: z.number().int().min(0).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  loggedAt: z.string().optional(),
})

export const CustomerIdQuerySchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
})

export const WorkoutLogIdSchema = z.object({
  id: z.string().min(1, 'Workout log ID is required'),
})
