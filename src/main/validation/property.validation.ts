import { z } from 'zod'

export const CreatePropertySchema = z.object({
  propertyType: z.string().min(1, 'Property type is required'),
  listingType: z.string().min(1, 'Listing type is required'),
  location: z.string().min(1, 'Location is required'),
  area: z.number().positive('Area must be greater than zero').finite(),
  ownerClientId: z.string().min(1, 'Owner client ID is required'),
  floorNumber: z.number().finite().optional(),
  totalFloors: z.number().finite().optional(),
  askingPrice: z.number().nonnegative('Asking price cannot be negative').finite().optional(),
  monthlyRent: z.number().nonnegative('Monthly rent cannot be negative').finite().optional(),
  securityDeposit: z.number().nonnegative('Security deposit cannot be negative').finite().optional(),
  brokeragePercent: z.number().nonnegative('Brokerage percent cannot be negative').max(100, 'Brokerage percent cannot exceed 100').finite().optional(),
  photos: z.array(z.string()).optional(),
  amenities: z.array(z.string()).optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
})

export const UpdatePropertySchema = z.object({
  id: z.string().min(1, 'Property ID is required'),
  propertyType: z.string().optional(),
  listingType: z.string().optional(),
  status: z.string().optional(),
  location: z.string().optional(),
  area: z.number().positive('Area must be greater than zero').finite().optional(),
  floorNumber: z.number().finite().nullable().optional(),
  totalFloors: z.number().finite().nullable().optional(),
  askingPrice: z.number().nonnegative('Asking price cannot be negative').finite().nullable().optional(),
  monthlyRent: z.number().nonnegative('Monthly rent cannot be negative').finite().nullable().optional(),
  securityDeposit: z.number().nonnegative('Security deposit cannot be negative').finite().nullable().optional(),
  ownerClientId: z.string().optional(),
  brokeragePercent: z.number().nonnegative('Brokerage percent cannot be negative').max(100, 'Brokerage percent cannot exceed 100').finite().nullable().optional(),
  photos: z.array(z.string()).optional(),
  amenities: z.array(z.string()).optional(),
  description: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
})

export const PropertyIdSchema = z.string().min(1, 'Property ID is required')

export type CreatePropertyPayload = z.infer<typeof CreatePropertySchema>
export type UpdatePropertyPayload = z.infer<typeof UpdatePropertySchema>
