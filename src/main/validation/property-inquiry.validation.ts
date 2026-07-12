import { z } from 'zod'

export const CreatePropertyInquirySchema = z.object({
  propertyId: z.string().min(1, 'Property ID is required'),
  buyerClientId: z.string().min(1, 'Buyer client ID is required'),
  notes: z.string().optional(),
  nextFollowUpDate: z.string().optional(),
})

export const UpdatePropertyInquirySchema = z.object({
  id: z.string().min(1, 'Inquiry ID is required'),
  status: z.string().optional(),
  notes: z.string().nullable().optional(),
  nextFollowUpDate: z.string().nullable().optional(),
})

export const PropertyInquiryIdSchema = z.string().min(1, 'Inquiry ID is required')

export type CreatePropertyInquiryPayload = z.infer<typeof CreatePropertyInquirySchema>
export type UpdatePropertyInquiryPayload = z.infer<typeof UpdatePropertyInquirySchema>
