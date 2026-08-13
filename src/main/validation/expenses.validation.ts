import { z } from 'zod'

// Phase 61 — an expense can optionally be tied to a Supplier (e.g. a
// professional-fee invoice paid outside the Bill/PO flow), carry a
// mileage breakdown (km + rate/km — amount is server-recomputed from these
// when both are present, see expense.service.ts), and be marked
// billable-to-customer (reimbursable client expense, e.g. travel a
// consultant bills back to the client).
export const CreateExpenseSchema = z.object({
  categoryId: z.string().min(1, 'Category is required'),
  expenseName: z.string().min(1, 'Expense name is required'),
  amount: z.number().finite().positive('Amount must be greater than zero'),
  expenseDate: z.string().optional(),
  paymentMethod: z.string().max(50).optional(),
  remarks: z.string().max(2000).optional(),
  supplierId: z.string().min(1).optional(),
  mileageKm: z.number().finite().positive().optional(),
  mileageRatePerKm: z.number().finite().min(0).optional(),
  billableCustomerId: z.string().min(1).optional(),
  // Phase 62 — Reverse Charge Mechanism, same meaning as Bill/PurchaseOrder's
  // own. Doesn't change this expense's own math (Expense never computes a
  // separate tax line), but feeds GSTR-3B Table 3.1(d)'s real disclosure —
  // was schema-only until now, unsettable by any real caller.
  isReverseCharge: z.boolean().default(false),
  // Phase 65 — Reporting Tags / Cost & Profit Centres.
  costCentreId: z.string().min(1).optional(),
})

export const UpdateExpenseSchema = z.object({
  id: z.string().min(1, 'Expense ID is required'),
  categoryId: z.string().min(1, 'Category is required'),
  expenseName: z.string().min(1, 'Expense name is required'),
  amount: z.number().finite().positive('Amount must be greater than zero'),
  expenseDate: z.string().optional(),
  paymentMethod: z.string().max(50).optional(),
  remarks: z.string().max(2000).optional(),
  supplierId: z.string().min(1).optional(),
  mileageKm: z.number().finite().positive().optional(),
  mileageRatePerKm: z.number().finite().min(0).optional(),
  billableCustomerId: z.string().min(1).optional(),
  isReverseCharge: z.boolean().optional(),
  // Phase 65 — Reporting Tags / Cost & Profit Centres.
  costCentreId: z.string().min(1).optional(),
})

export const CreateExpenseCategorySchema = z.object({
  categoryName: z.string().min(1, 'categoryName is required'),
  description: z.string().max(500).optional(),
})

export type CreateExpensePayload = z.infer<typeof CreateExpenseSchema>
export type UpdateExpensePayload = z.infer<typeof UpdateExpenseSchema>
export type CreateExpenseCategoryPayload = z.infer<typeof CreateExpenseCategorySchema>
