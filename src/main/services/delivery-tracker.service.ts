import { getPrisma } from '../database/db'
import { parseLocalDateStart } from '../utils/date.util'

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
  deliveredPhotosCount?: number | null
  notes?: string | null
}) {
  const db = getPrisma()
  const { shootBookingId, ...rest } = payload

  // Real bug found live (2026-08-27 Phase 68 audit): a bare
  // `new Date('YYYY-MM-DD')` parses as UTC midnight — inconsistent with
  // this app's own parseLocalDateStart convention used everywhere else.
  const data = {
    ...(rest.proofsSentDate !== undefined ? { proofsSentDate: rest.proofsSentDate ? parseLocalDateStart(rest.proofsSentDate) : null } : {}),
    ...(rest.selectionReceivedDate !== undefined ? { selectionReceivedDate: rest.selectionReceivedDate ? parseLocalDateStart(rest.selectionReceivedDate) : null } : {}),
    ...(rest.editingStartedDate !== undefined ? { editingStartedDate: rest.editingStartedDate ? parseLocalDateStart(rest.editingStartedDate) : null } : {}),
    ...(rest.albumProofSentDate !== undefined ? { albumProofSentDate: rest.albumProofSentDate ? parseLocalDateStart(rest.albumProofSentDate) : null } : {}),
    ...(rest.finalDeliveredDate !== undefined ? { finalDeliveredDate: rest.finalDeliveredDate ? parseLocalDateStart(rest.finalDeliveredDate) : null } : {}),
    ...(rest.deliveryFormat !== undefined ? { deliveryFormat: rest.deliveryFormat } : {}),
    ...(rest.deliveredPhotosCount !== undefined ? { deliveredPhotosCount: rest.deliveredPhotosCount } : {}),
    ...(rest.notes !== undefined ? { notes: rest.notes } : {}),
  }

  const tracker = await db.deliveryTracker.upsert({
    where: { shootBookingId },
    create: { shootBookingId, ...data },
    update: data,
  })
  return { success: true, data: tracker }
}

// Phase 68 §9.1 — Photo Studio item 5: revision-round tracker. A real,
// incrementing counter (never guessed/derived) — bumped explicitly each
// time the client sends the album/edits back for another round of changes.
export async function incrementRevisionRound(shootBookingId: string) {
  try {
    const db = getPrisma()
    const tracker = await db.deliveryTracker.upsert({
      where: { shootBookingId },
      create: { shootBookingId, revisionRounds: 1 },
      update: { revisionRounds: { increment: 1 } },
    })
    return { success: true, data: tracker }
  } catch (err) {
    return { success: false, error: { code: 'DLV-001', message: err instanceof Error ? err.message : 'Could not record a revision round.' } }
  }
}
