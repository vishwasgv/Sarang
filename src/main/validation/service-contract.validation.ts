import { z } from 'zod'

export const CreateServiceContractSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  scope: z.string().max(2000).optional(),
  serviceFrequency: z.string().max(30).optional(),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().optional(),
  contractValue: z.number().positive('Contract value must be greater than zero').finite(),
  notes: z.string().max(2000).optional(),
})

export const UpdateServiceContractSchema = z.object({
  id: z.string().min(1, 'Contract ID is required'),
  status: z.string().max(20).optional(),
  endDate: z.string().nullable().optional(),
  contractValue: z.number().positive('Contract value must be greater than zero').finite().optional(),
  notes: z.string().max(2000).nullable().optional(),
})

export const GenerateServiceContractInvoiceSchema = z.object({
  id: z.string().min(1, 'Contract ID is required'),
  period: z.string().optional(),
})

export type CreateServiceContractPayload = z.infer<typeof CreateServiceContractSchema>
export type UpdateServiceContractPayload = z.infer<typeof UpdateServiceContractSchema>
export type GenerateServiceContractInvoicePayload = z.infer<typeof GenerateServiceContractInvoiceSchema>
