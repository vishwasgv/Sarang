import { z } from 'zod'

// 2026-09 §12 — Tours & Travels.
export const StartDutySchema = z.object({
  tripBookingId: z.string().min(1, 'Trip booking is required'),
  driverId: z.string().min(1, 'Driver is required'),
  dutyDate: z.string().min(1, 'Duty date is required'),
  startOdometer: z.number().nonnegative('Start odometer cannot be negative'),
  dutyStartTime: z.string().min(1, 'Duty start time is required'),
  driverBataAmount: z.number().nonnegative().optional(),
  nightHaltCharge: z.number().nonnegative().optional(),
  nightDrivingAllowance: z.number().nonnegative().optional(),
  notes: z.string().max(2000).optional(),
})

export const CloseDutySchema = z.object({
  id: z.string().min(1, 'Duty log ID is required'),
  endOdometer: z.number().nonnegative('End odometer cannot be negative'),
  dutyEndTime: z.string().min(1, 'Duty end time is required'),
})

export type StartDutyPayload = z.infer<typeof StartDutySchema>
export type CloseDutyPayload = z.infer<typeof CloseDutySchema>
