import { getPrisma } from '../database/db'

export async function listShootChecklist(shootBookingId: string) {
  const db = getPrisma()
  const items = await db.shootChecklistItem.findMany({
    where: { shootBookingId },
    orderBy: [{ category: 'asc' }, { createdAt: 'asc' }],
  })
  return { success: true, data: items }
}

export async function addShootChecklistItem(payload: { shootBookingId: string; label: string; category?: string }) {
  if (!payload.label || !payload.label.trim()) {
    return { success: false, error: { code: 'SCL-001', message: 'Checklist item label is required.' } }
  }
  const db = getPrisma()
  const booking = await db.shootBooking.findUnique({ where: { id: payload.shootBookingId } })
  if (!booking) return { success: false, error: { code: 'SCL-002', message: 'Shoot booking not found.' } }
  const item = await db.shootChecklistItem.create({
    data: {
      shootBookingId: payload.shootBookingId,
      label: payload.label.trim(),
      category: payload.category ?? 'EQUIPMENT',
    },
  })
  return { success: true, data: item }
}

export async function toggleShootChecklistItem(payload: { id: string; isDone: boolean }) {
  const db = getPrisma()
  const item = await db.shootChecklistItem.update({
    where: { id: payload.id },
    data: { isDone: payload.isDone },
  })
  return { success: true, data: item }
}

export async function deleteShootChecklistItem(id: string) {
  const db = getPrisma()
  await db.shootChecklistItem.delete({ where: { id } })
  return { success: true, data: { id } }
}
