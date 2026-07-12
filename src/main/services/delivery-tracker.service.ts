import { getPrisma } from '../database/db'

export async function getDeliveryTracker(shootBookingId: string) {
  const db = getPrisma()
  const tracker = await db.deliveryTracker.findUnique({ where: { shootBookingId } })
  return { success: true, data: tracker ?? null }
}

export async function upsertDeliveryTracker(payload: {
  shootBookingId: string
  proofsSentDate?: string | null
  selectionReceivedDate?: string | null
  editingStartedDate?: string | null
  albumProofSentDate?: string | null
  finalDeliveredDate?: string | null
  deliveryFormat?: string | null
  notes?: string | null
}) {
  const db = getPrisma()
  const { shootBookingId, ...rest } = payload

  const data = {
    ...(rest.proofsSentDate !== undefined ? { proofsSentDate: rest.proofsSentDate ? new Date(rest.proofsSentDate) : null } : {}),
    ...(rest.selectionReceivedDate !== undefined ? { selectionReceivedDate: rest.selectionReceivedDate ? new Date(rest.selectionReceivedDate) : null } : {}),
    ...(rest.editingStartedDate !== undefined ? { editingStartedDate: rest.editingStartedDate ? new Date(rest.editingStartedDate) : null } : {}),
    ...(rest.albumProofSentDate !== undefined ? { albumProofSentDate: rest.albumProofSentDate ? new Date(rest.albumProofSentDate) : null } : {}),
    ...(rest.finalDeliveredDate !== undefined ? { finalDeliveredDate: rest.finalDeliveredDate ? new Date(rest.finalDeliveredDate) : null } : {}),
    ...(rest.deliveryFormat !== undefined ? { deliveryFormat: rest.deliveryFormat } : {}),
    ...(rest.notes !== undefined ? { notes: rest.notes } : {}),
  }

  const tracker = await db.deliveryTracker.upsert({
    where: { shootBookingId },
    create: { shootBookingId, ...data },
    update: data,
  })
  return { success: true, data: tracker }
}
