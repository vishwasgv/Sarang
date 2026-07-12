import { getPrisma } from '../database/db'

function todayMidnight(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export async function getTodayQueue(date?: string) {
  try {
    const db = getPrisma()
    const queueDate = date ? new Date(date) : todayMidnight()
    queueDate.setHours(0, 0, 0, 0)
    const nextDay = new Date(queueDate.getTime() + 24 * 60 * 60 * 1000)

    const items = await db.tokenQueue.findMany({
      where: { queueDate: { gte: queueDate, lt: nextDay } },
      include: {
        appointment: { select: { id: true, appointmentNumber: true, serviceTitle: true, scheduledTime: true } },
      },
      orderBy: { tokenNumber: 'asc' },
    })

    return { success: true, data: items }
  } catch (err) {
    return { success: false, error: { code: 'TQ-001', message: err instanceof Error ? err.message : 'Could not fetch queue.' } }
  }
}

export async function createToken(payload: {
  patientName: string
  age?: string
  gender?: string
  phone?: string
  appointmentId?: string
  notes?: string
  date?: string
}) {
  try {
    const db = getPrisma()
    const queueDate = payload.date ? new Date(payload.date) : todayMidnight()
    queueDate.setHours(0, 0, 0, 0)
    const nextDay = new Date(queueDate.getTime() + 24 * 60 * 60 * 1000)

    // Reading the last token number and creating the new row must happen in
    // the same transaction — otherwise two near-simultaneous calls (two
    // front-desk terminals, or a fast double-submit) can both read the same
    // "last" number before either commits, and the second create() crashes on
    // the (queueDate, tokenNumber) unique constraint instead of the walk-in
    // getting a token. Same fix as createAppointment's numbering race.
    const token = await db.$transaction(async (tx) => {
      const last = await tx.tokenQueue.findFirst({
        where: { queueDate: { gte: queueDate, lt: nextDay } },
        orderBy: { tokenNumber: 'desc' },
        select: { tokenNumber: true },
      })
      const tokenNumber = (last?.tokenNumber ?? 0) + 1

      return tx.tokenQueue.create({
        data: {
          queueDate,
          tokenNumber,
          patientName: payload.patientName,
          age: payload.age ?? null,
          gender: payload.gender ?? null,
          phone: payload.phone ?? null,
          appointmentId: payload.appointmentId ?? null,
          notes: payload.notes ?? null,
          status: 'WAITING',
        },
      })
    })

    return { success: true, data: token }
  } catch (err) {
    return { success: false, error: { code: 'TQ-002', message: err instanceof Error ? err.message : 'Could not create token.' } }
  }
}

export async function callToken(id: string) {
  try {
    const db = getPrisma()
    const token = await db.tokenQueue.update({
      where: { id },
      data: { status: 'CALLED', calledAt: new Date() },
    })
    return { success: true, data: token }
  } catch (err) {
    return { success: false, error: { code: 'TQ-003', message: err instanceof Error ? err.message : 'Could not call token.' } }
  }
}

export async function markSeen(id: string) {
  try {
    const db = getPrisma()
    const token = await db.tokenQueue.update({
      where: { id },
      data: { status: 'SEEN', seenAt: new Date() },
    })
    return { success: true, data: token }
  } catch (err) {
    return { success: false, error: { code: 'TQ-004', message: err instanceof Error ? err.message : 'Could not mark token as seen.' } }
  }
}

export async function skipToken(id: string) {
  try {
    const db = getPrisma()
    const token = await db.tokenQueue.update({
      where: { id },
      data: { status: 'SKIPPED' },
    })
    return { success: true, data: token }
  } catch (err) {
    return { success: false, error: { code: 'TQ-005', message: err instanceof Error ? err.message : 'Could not skip token.' } }
  }
}

export async function resetToken(id: string) {
  try {
    const db = getPrisma()
    const token = await db.tokenQueue.update({
      where: { id },
      data: { status: 'WAITING', calledAt: null, seenAt: null },
    })
    return { success: true, data: token }
  } catch (err) {
    return { success: false, error: { code: 'TQ-006', message: err instanceof Error ? err.message : 'Could not reset token.' } }
  }
}

export async function getQueueStats(date?: string) {
  try {
    const db = getPrisma()
    const queueDate = date ? new Date(date) : todayMidnight()
    queueDate.setHours(0, 0, 0, 0)
    const nextDay = new Date(queueDate.getTime() + 24 * 60 * 60 * 1000)

    const [waiting, called, seen, skipped] = await Promise.all([
      db.tokenQueue.count({ where: { queueDate: { gte: queueDate, lt: nextDay }, status: 'WAITING' } }),
      db.tokenQueue.count({ where: { queueDate: { gte: queueDate, lt: nextDay }, status: 'CALLED' } }),
      db.tokenQueue.count({ where: { queueDate: { gte: queueDate, lt: nextDay }, status: 'SEEN' } }),
      db.tokenQueue.count({ where: { queueDate: { gte: queueDate, lt: nextDay }, status: 'SKIPPED' } }),
    ])

    const currentToken = await db.tokenQueue.findFirst({
      where: { queueDate: { gte: queueDate, lt: nextDay }, status: 'CALLED' },
      orderBy: { calledAt: 'desc' },
      select: { tokenNumber: true, patientName: true },
    })

    return { success: true, data: { waiting, called, seen, skipped, currentToken } }
  } catch (err) {
    return { success: false, error: { code: 'TQ-007', message: err instanceof Error ? err.message : 'Could not fetch queue stats.' } }
  }
}
