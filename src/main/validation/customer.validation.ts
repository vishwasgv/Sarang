import { z } from 'zod'
import { CustomFieldValuesSchema } from './custom-field.validation'

// Phase 61 — Individual vs Business customer distinction (a real field-note
// gap: a distributor/B2B seller's customer is a company, not a person, and
// needs a registration number + a named contact rather than an ID proof).
const customerKindFields = {
  customerKind: z.enum(['INDIVIDUAL', 'BUSINESS']).default('INDIVIDUAL'),
  companyRegistrationNumber: z.string().max(50).optional(),
  contactPersonName: z.string().max(200).optional(),
  idProofType: z.string().max(50).optional(),
  idProofNumber: z.string().max(50).optional(),
}

export const CreateCustomerSchema = z.object({
  customerName: z.string().min(1, 'Customer name is required').max(200),
  phone: z.string().min(1, 'Phone number is required').max(30),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  taxNumber: z.string().max(50).optional(),
  taxExempt: z.boolean().default(false),
  taxExemptReason: z.string().max(200).optional(),
  creditLimit: z.number().min(0, 'Credit limit cannot be negative').default(0),
  // Phase 58 §2 — Distributor customer-class/negotiated pricing. Free text,
  // not a Prisma enum — matches this schema's own convention (see
  // taxExemptReason above) of validating category-style fields as plain
  // strings rather than a DB-level enum.
  customerClass: z.string().max(50).optional(),
  notes: z.string().max(500).optional(),
  // Phase 63 — formal Price List assignment, additive alongside customerClass.
  priceListId: z.string().min(1).optional(),
  customFields: CustomFieldValuesSchema,
  ...customerKindFields
})

export const UpdateCustomerSchema = z.object({
  id: z.string().min(1),
  customerName: z.string().min(1, 'Customer name is required').max(200),
  phone: z.string().min(1, 'Phone number is required').max(30),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  taxNumber: z.string().max(50).optional(),
  taxExempt: z.boolean().default(false),
  taxExemptReason: z.string().max(200).optional(),
  creditLimit: z.number().min(0, 'Credit limit cannot be negative').default(0),
  // Phase 58 §2 — Distributor customer-class/negotiated pricing. Free text,
  // not a Prisma enum — matches this schema's own convention (see
  // taxExemptReason above) of validating category-style fields as plain
  // strings rather than a DB-level enum.
  customerClass: z.string().max(50).optional(),
  notes: z.string().max(500).optional(),
  // Phase 63 — formal Price List assignment, additive alongside customerClass.
  priceListId: z.string().min(1).optional(),
  customFields: CustomFieldValuesSchema,
  ...customerKindFields
})

export type CreateCustomerPayload = z.infer<typeof CreateCustomerSchema>
export type UpdateCustomerPayload = z.infer<typeof UpdateCustomerSchema>
