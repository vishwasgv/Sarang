import { z } from 'zod'

export const CreatePropertyDealSchema = z.object({
  propertyId: z.string().min(1, 'Property ID is required'),
  buyerClientId: z.string().min(1, 'Buyer client ID is required'),
  sellerClientId: z.string().min(1, 'Seller client ID is required'),
  dealValue: z.number().positive('Deal value must be greater than zero').finite(),
  brokeragePercent: z.number().nonnegative('Brokerage percent cannot be negative').max(100, 'Brokerage percent cannot exceed 100').finite(),
  expectedRegistrationDate: z.string().optional(),
  notes: z.string().optional(),
  coBrokerName: z.string().max(200).optional(),
  coBrokerSharePercent: z.number().nonnegative('Co-broker share percent cannot be negative').max(100, 'Co-broker share percent cannot exceed 100').finite().optional(),
})

export const UpdatePropertyDealSchema = z.object({
  id: z.string().min(1, 'Deal ID is required'),
  dealValue: z.number().positive('Deal value must be greater than zero').finite().optional(),
  brokeragePercent: z.number().nonnegative('Brokerage percent cannot be negative').max(100, 'Brokerage percent cannot exceed 100').finite().optional(),
  expectedRegistrationDate: z.string().nullable().optional(),
  status: z.string().optional(),
  invoiceId: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  coBrokerName: z.string().max(200).nullable().optional(),
  coBrokerSharePercent: z.number().nonnegative('Co-broker share percent cannot be negative').max(100, 'Co-broker share percent cannot exceed 100').finite().nullable().optional(),
})

export const PropertyDealIdSchema = z.string().min(1, 'Deal ID is required')

export type CreatePropertyDealPayload = z.infer<typeof CreatePropertyDealSchema>
export type UpdatePropertyDealPayload = z.infer<typeof UpdatePropertyDealSchema>
