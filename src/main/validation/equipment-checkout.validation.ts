import { z } from 'zod'

export const CheckOutEquipmentSchema = z.object({
  fixedAssetId: z.string().min(1, 'Equipment is required'),
  shootBookingId: z.string().optional(),
  checkedOutToId: z.string().optional(),
  checkedOutDate: z.string().min(1, 'Checkout date is required'),
  expectedReturnDate: z.string().optional(),
  notes: z.string().optional(),
})

export const ReturnEquipmentSchema = z.object({
  id: z.string().min(1, 'Checkout ID is required'),
  actualReturnDate: z.string().min(1, 'Return date is required'),
  notes: z.string().optional(),
})

export const EquipmentCheckoutIdSchema = z.object({ id: z.string().min(1, 'Checkout ID is required') })

export type CheckOutEquipmentPayload = z.infer<typeof CheckOutEquipmentSchema>
export type ReturnEquipmentPayload = z.infer<typeof ReturnEquipmentSchema>
