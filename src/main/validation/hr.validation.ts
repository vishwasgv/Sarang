import { z } from 'zod'

const AllowanceSchema = z.object({
  name: z.string().min(1),
  amount: z.number().finite().nonnegative('Allowance amount cannot be negative'),
})

export const CreateEmployeeSchema = z.object({
  employeeNumber: z.string().max(50).optional(),
  fullName: z.string().min(1, 'Full name is required'),
  phone: z.string().max(20).optional(),
  email: z.string().max(255).optional(),
  department: z.string().max(100).optional(),
  designation: z.string().max(100).optional(),
  employeeType: z.string().max(50).optional(),
  joinDate: z.string().min(1, 'Join date is required'),
  salaryType: z.string().max(20).optional(),
  basicSalary: z.number().finite().nonnegative('Basic salary cannot be negative').optional(),
  allowances: z.array(AllowanceSchema).optional(),
  notes: z.string().max(2000).optional(),
})

export const UpdateEmployeeSchema = z.object({
  id: z.string().min(1, 'Employee ID is required'),
  employeeNumber: z.string().max(50).optional(),
  fullName: z.string().min(1).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().max(255).optional(),
  department: z.string().max(100).optional(),
  designation: z.string().max(100).optional(),
  employeeType: z.string().max(50).optional(),
  joinDate: z.string().optional(),
  exitDate: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  salaryType: z.string().max(20).optional(),
  basicSalary: z.number().finite().nonnegative('Basic salary cannot be negative').optional(),
  allowances: z.array(AllowanceSchema).optional(),
  notes: z.string().max(2000).optional(),
})

export const DeactivateEmployeeSchema = z.object({
  id: z.string().min(1, 'Employee ID is required'),
})

export const MarkAttendanceSchema = z.object({
  employeeId: z.string().min(1, 'Employee is required'),
  date: z.string().min(1, 'Date is required'),
  status: z.string().min(1, 'Status is required'),
  checkIn: z.string().max(20).optional(),
  checkOut: z.string().max(20).optional(),
  notes: z.string().max(2000).optional(),
})

export const BulkMarkAttendanceSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  records: z.array(z.object({
    employeeId: z.string().min(1),
    status: z.string().min(1),
  })).min(1, 'At least one attendance record is required'),
})

export const CreateLeaveTypeSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  maxDays: z.number().finite().nonnegative('Max days cannot be negative').optional(),
  isPaid: z.boolean().optional(),
})

export const CreateLeaveRequestSchema = z.object({
  employeeId: z.string().min(1, 'Employee is required'),
  leaveTypeId: z.string().min(1, 'Leave type is required'),
  fromDate: z.string().min(1, 'From date is required'),
  toDate: z.string().min(1, 'To date is required'),
  days: z.number().finite().positive('Days must be greater than zero'),
  reason: z.string().max(500).optional(),
})

export const UpdateLeaveStatusSchema = z.object({
  id: z.string().min(1, 'Leave request ID is required'),
  status: z.enum(['APPROVED', 'REJECTED']),
  approvedBy: z.string().optional(),
  notes: z.string().max(2000).optional(),
})

export type CreateEmployeePayload = z.infer<typeof CreateEmployeeSchema>
export type UpdateEmployeePayload = z.infer<typeof UpdateEmployeeSchema>
export type MarkAttendancePayload = z.infer<typeof MarkAttendanceSchema>
export type BulkMarkAttendancePayload = z.infer<typeof BulkMarkAttendanceSchema>
export type CreateLeaveTypePayload = z.infer<typeof CreateLeaveTypeSchema>
export type CreateLeaveRequestPayload = z.infer<typeof CreateLeaveRequestSchema>
export type UpdateLeaveStatusPayload = z.infer<typeof UpdateLeaveStatusSchema>
