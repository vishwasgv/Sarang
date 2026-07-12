import { z } from 'zod'

export const UpsertProviderScheduleSchema = z.object({
  providerId: z.string().min(1, 'Provider ID is required'),
  dayOfWeek: z.number().int().min(0).max(6),
  isWorking: z.boolean(),
  startTime: z.string().min(1, 'Start time is required'),
  endTime: z.string().min(1, 'End time is required'),
  breakStart: z.string().nullable().optional(),
  breakEnd: z.string().nullable().optional(),
  slotDuration: z.number().positive('Slot duration must be greater than zero').finite().optional(),
})

export const AddHolidaySchema = z.object({
  date: z.string().min(1, 'Date is required'),
  name: z.string().min(1, 'Name is required'),
  isGlobal: z.boolean().optional(),
  providerId: z.string().optional(),
})

export const DeleteHolidaySchema = z.object({ id: z.string().min(1, 'Holiday ID is required') })

export const UpsertCancellationPolicySchema = z.object({
  noticePeriodHours: z.number().nonnegative('Notice period cannot be negative').finite().optional(),
  cancellationFeeType: z.string().optional(),
  cancellationFeeValue: z.number().nonnegative('Cancellation fee cannot be negative').finite().optional(),
  notes: z.string().nullable().optional(),
})

export type UpsertProviderSchedulePayload = z.infer<typeof UpsertProviderScheduleSchema>
export type AddHolidayPayload = z.infer<typeof AddHolidaySchema>
export type UpsertCancellationPolicyPayload = z.infer<typeof UpsertCancellationPolicySchema>
