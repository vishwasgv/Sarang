import { z } from 'zod'

export const CreatePestContractSchema = z.object({
  clientId: z.string().min(1, 'Client is required'),
  propertyAddress: z.string().min(1, 'Property address is required'),
  propertyType: z.string().max(30).optional(),
  pestTypes: z.array(z.string()).optional(),
  serviceFrequency: z.string().max(30).optional(),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().optional(),
  contractValue: z.number().nonnegative('Contract value cannot be negative').finite(),
  status: z.string().max(20).optional(),
  assignedToId: z.string().optional(),
  notes: z.string().max(2000).optional(),
})

export const UpdatePestContractSchema = z.object({
  id: z.string().min(1, 'Contract ID is required'),
  propertyAddress: z.string().min(1).optional(),
  propertyType: z.string().max(30).optional(),
  pestTypes: z.array(z.string()).optional(),
  serviceFrequency: z.string().max(30).optional(),
  startDate: z.string().optional(),
  endDate: z.string().nullable().optional(),
  contractValue: z.number().nonnegative('Contract value cannot be negative').finite().optional(),
  status: z.string().max(20).optional(),
  assignedToId: z.string().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
})

export const GenerateContractInvoiceSchema = z.object({
  id: z.string().min(1, 'Contract ID is required'),
  period: z.string().optional(),
})

export type CreatePestContractPayload = z.infer<typeof CreatePestContractSchema>
export type UpdatePestContractPayload = z.infer<typeof UpdatePestContractSchema>
export type GenerateContractInvoicePayload = z.infer<typeof GenerateContractInvoiceSchema>
