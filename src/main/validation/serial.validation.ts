import { z } from 'zod'

export const CreateSerialSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  serialNumber: z.string().min(1, 'Serial number is required'),
  imeiNumber: z.string().optional(),
  imei2Number: z.string().optional(),
  warrantyMonths: z.number().nonnegative('Warranty months cannot be negative').finite().optional(),
  purchaseDate: z.string().optional(),
  unitCost: z.number().nonnegative('Unit cost cannot be negative').finite().optional(),
})

export const BulkCreateSerialsSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  serials: z.array(z.object({
    serialNumber: z.string().min(1, 'Serial number is required'),
    imeiNumber: z.string().optional(),
    imei2Number: z.string().optional(),
    warrantyMonths: z.number().nonnegative('Warranty months cannot be negative').finite().optional(),
    unitCost: z.number().nonnegative('Unit cost cannot be negative').finite().optional(),
  })).min(1, 'At least one serial is required'),
  purchaseDate: z.string().optional(),
})

export const UpdateSerialStatusSchema = z.object({
  id: z.string().min(1, 'Serial ID is required'),
  status: z.enum(['AVAILABLE', 'SOLD', 'RETURNED', 'DEFECTIVE']),
  invoiceId: z.string().optional(),
  soldDate: z.string().optional(),
})

export type CreateSerialPayload = z.infer<typeof CreateSerialSchema>
export type BulkCreateSerialsPayload = z.infer<typeof BulkCreateSerialsSchema>
export type UpdateSerialStatusPayload = z.infer<typeof UpdateSerialStatusSchema>
