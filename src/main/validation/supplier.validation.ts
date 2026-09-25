import { z } from 'zod'
import { CustomFieldValuesSchema } from './custom-field.validation'

// Phase 61 — vendor record depth: bank details for making a payment, PAN for
// TDS/1099-equivalent compliance paperwork, and an opening balance for
// onboarding a supplier who already has real outstanding dues on day one.
const supplierBankFields = {
  bankAccountNumber: z.string().max(30).optional(),
  bankIfscCode: z.string().max(20).optional(),
  bankName: z.string().max(100).optional(),
  panNumber: z.string().max(20).optional(),
}

// Phase 62 — MSME Samadhaan Act 45-day statutory payment due-date rule
// applies only to suppliers who declare themselves MSME-registered.
const supplierMsmeFields = {
  isMsmeRegistered: z.boolean().default(false),
  msmeCategory: z.enum(['MICRO', 'SMALL', 'MEDIUM']).optional(),
  paymentTermsDays: z.number().int().min(0).max(365).nullable().optional(),
  creditLimit: z.number().min(0, 'Credit limit cannot be negative').optional(),
  contactPerson: z.string().trim().max(100).optional(),
  supplierCategory: z.string().trim().max(60).optional(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
}

export const CreateSupplierSchema = z.object({
  supplierName: z.string().min(1, 'Supplier name is required').max(200),
  phone: z.string().max(30).optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  taxNumber: z.string().max(50).optional(),
  notes: z.string().max(500).optional(),
  // Negative means the supplier holds an advance we paid (they owe us); positive is what we owe them.
  openingBalance: z.number().default(0),
  // Phase 63 — formal Price List assignment (vendor-specific pricing).
  priceListId: z.string().min(1).optional(),
  customFields: CustomFieldValuesSchema,
  ...supplierBankFields,
  ...supplierMsmeFields
})

export const UpdateSupplierSchema = z.object({
  id: z.string().min(1),
  supplierName: z.string().min(1, 'Supplier name is required').max(200),
  phone: z.string().max(30).optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  taxNumber: z.string().max(50).optional(),
  notes: z.string().max(500).optional(),
  priceListId: z.string().min(1).optional(),
  customFields: CustomFieldValuesSchema,
  ...supplierBankFields,
  ...supplierMsmeFields
})

export type CreateSupplierPayload = z.infer<typeof CreateSupplierSchema>
export type UpdateSupplierPayload = z.infer<typeof UpdateSupplierSchema>
