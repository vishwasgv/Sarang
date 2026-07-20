import { getPrisma } from '../database/db'

export async function listRunOfShow(eventId: string) {
  const db = getPrisma()
  const items = await db.eventRunOfShowItem.findMany({
    where: { eventId },
    orderBy: { scheduledTime: 'asc' },
  })
  return { success: true, data: items }
}

export async function createRunOfShowItem(payload: {
  eventId: string
  scheduledTime: string
  activity: string
  responsibleParty?: string
  notes?: string
}) {
  if (!payload.activity || !payload.activity.trim()) {
    return { success: false, error: { code: 'ROS-001', message: 'Activity is required.' } }
  }
  if (!payload.scheduledTime) {
    return { success: false, error: { code: 'ROS-002', message: 'Scheduled time is required.' } }
  }
  const db = getPrisma()
  const event = await db.eventBooking.findUnique({ where: { id: payload.eventId } })
  if (!event) return { success: false, error: { code: 'ROS-003', message: 'Event not found.' } }
  const item = await db.eventRunOfShowItem.create({
    data: {
      eventId: payload.eventId,
      scheduledTime: new Date(payload.scheduledTime),
      activity: payload.activity.trim(),
      responsibleParty: payload.responsibleParty || null,
      notes: payload.notes || null,
    },
  })
  return { success: true, data: item }
}

export async function updateRunOfShowItem(payload: {
  id: string
  scheduledTime?: string
  activity?: string
  responsibleParty?: string | null
  isDone?: boolean
  notes?: string | null
}) {
  const db = getPrisma()
  const { id, scheduledTime, ...rest } = payload
  const item = await db.eventRunOfShowItem.update({
    where: { id },
    data: {
      ...rest,
      ...(scheduledTime !== undefined ? { scheduledTime: new Date(scheduledTime) } : {}),
    },
  })
  return { success: true, data: item }
}

export async function deleteRunOfShowItem(id: string) {
  const db = getPrisma()
  await db.eventRunOfShowItem.delete({ where: { id } })
  return { success: true, data: { id } }
}
