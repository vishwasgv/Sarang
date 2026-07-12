import { getPrisma } from '../database/db'

export async function listProviderSchedules(providerId: string) {
  try {
    const db = getPrisma()
    const items = await db.providerSchedule.findMany({
      where: { providerId },
      orderBy: { dayOfWeek: 'asc' },
    })
    return { success: true, data: items }
  } catch (err) {
    return { success: false, error: { code: 'PSC-001', message: err instanceof Error ? err.message : 'Could not list schedules.' } }
  }
}

export async function upsertProviderSchedule(payload: {
  providerId: string
  dayOfWeek: number
  isWorking: boolean
  startTime: string
  endTime: string
  breakStart?: string | null
  breakEnd?: string | null
  slotDuration?: number
}) {
  try {
    const db = getPrisma()

    const existing = await db.providerSchedule.findUnique({
      where: { providerId_dayOfWeek: { providerId: payload.providerId, dayOfWeek: payload.dayOfWeek } },
    })

    const data = {
      isWorking: payload.isWorking,
      startTime: payload.startTime,
      endTime: payload.endTime,
      breakStart: payload.breakStart ?? null,
      breakEnd: payload.breakEnd ?? null,
      slotDuration: payload.slotDuration ?? 30,
    }

    const item = existing
      ? await db.providerSchedule.update({ where: { id: existing.id }, data })
      : await db.providerSchedule.create({ data: { ...data, providerId: payload.providerId, dayOfWeek: payload.dayOfWeek } })

    return { success: true, data: item }
  } catch (err) {
    return { success: false, error: { code: 'PSC-002', message: err instanceof Error ? err.message : 'Could not upsert schedule.' } }
  }
}

export async function getProviderAvailability(payload: { providerId: string; date: string; durationMinutes?: number }) {
  try {
    const db = getPrisma()
    const date = new Date(payload.date)
    const dayOfWeek = date.getDay()

    const [schedule, holiday, existingAppts] = await Promise.all([
      db.providerSchedule.findUnique({
        where: { providerId_dayOfWeek: { providerId: payload.providerId, dayOfWeek } },
      }),
      db.clinicHoliday.findFirst({
        where: {
          date: { gte: date, lt: new Date(date.getTime() + 86400000) },
          OR: [{ isGlobal: true }, { providerId: payload.providerId }],
        },
      }),
      db.appointment.findMany({
        where: {
          providerId: payload.providerId,
          scheduledDate: { gte: date, lt: new Date(date.getTime() + 86400000) },
          status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        },
        select: { scheduledTime: true, durationMinutes: true },
      }),
    ])

    if (holiday) {
      return { success: true, data: { available: false, reason: `Holiday: ${holiday.name}`, slots: [] } }
    }

    if (!schedule || !schedule.isWorking) {
      return { success: true, data: { available: false, reason: 'Provider is not working on this day.', slots: [] } }
    }

    const slots = generateTimeSlots(schedule.startTime, schedule.endTime, schedule.slotDuration, schedule.breakStart ?? null, schedule.breakEnd ?? null)
    // Duration-aware: a slot is "booked" if picking it — for the appointment
    // about to be created, not just the slot's own width — would overlap an
    // existing appointment. Without this, the picker could show a slot as free
    // that the server-side conflict check in createAppointment would then
    // correctly reject, confusing the user after they've already clicked it.
    const newDuration = payload.durationMinutes ?? schedule.slotDuration
    const availableSlots = slots.map((slot) => {
      const slotStart = toMins(slot)
      const slotEnd = slotStart + newDuration
      const isBooked = existingAppts.some((a) => {
        const start = toMins(a.scheduledTime)
        const end = start + a.durationMinutes
        return slotStart < end && start < slotEnd
      })
      return { time: slot, isBooked }
    })

    return { success: true, data: { available: true, slots: availableSlots, schedule } }
  } catch (err) {
    return { success: false, error: { code: 'PSC-003', message: err instanceof Error ? err.message : 'Could not get availability.' } }
  }
}

function toMins(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function generateTimeSlots(start: string, end: string, slotMinutes: number, breakStart: string | null, breakEnd: string | null): string[] {
  const slots: string[] = []
  let current = toMins(start)
  const endMinutes = toMins(end)
  const breakStartMin = breakStart ? toMins(breakStart) : null
  const breakEndMin = breakEnd ? toMins(breakEnd) : null

  while (current + slotMinutes <= endMinutes) {
    if (breakStartMin !== null && breakEndMin !== null) {
      if (current >= breakStartMin && current < breakEndMin) {
        current = breakEndMin
        continue
      }
    }
    const hh = String(Math.floor(current / 60)).padStart(2, '0')
    const mm = String(current % 60).padStart(2, '0')
    slots.push(`${hh}:${mm}`)
    current += slotMinutes
  }
  return slots
}

export async function listHolidays(filters?: { providerId?: string; year?: number }) {
  try {
    const db = getPrisma()
    const where: Record<string, unknown> = {}
    if (filters?.providerId) {
      where.OR = [{ isGlobal: true }, { providerId: filters.providerId }]
    } else {
      where.isGlobal = true
    }
    if (filters?.year) {
      const start = new Date(filters.year, 0, 1)
      const end = new Date(filters.year + 1, 0, 1)
      where.date = { gte: start, lt: end }
    }
    const items = await db.clinicHoliday.findMany({ where, orderBy: { date: 'asc' } })
    return { success: true, data: items }
  } catch (err) {
    return { success: false, error: { code: 'PSC-004', message: err instanceof Error ? err.message : 'Could not list holidays.' } }
  }
}

export async function addHoliday(payload: { date: string; name: string; isGlobal?: boolean; providerId?: string }) {
  try {
    const db = getPrisma()
    const item = await db.clinicHoliday.create({
      data: {
        date: new Date(payload.date),
        name: payload.name,
        isGlobal: payload.isGlobal ?? true,
        providerId: payload.providerId ?? null,
      },
    })
    return { success: true, data: item }
  } catch (err) {
    return { success: false, error: { code: 'PSC-005', message: err instanceof Error ? err.message : 'Could not add holiday.' } }
  }
}

export async function deleteHoliday(id: string) {
  try {
    const db = getPrisma()
    await db.clinicHoliday.delete({ where: { id } })
    return { success: true }
  } catch (err) {
    return { success: false, error: { code: 'PSC-006', message: err instanceof Error ? err.message : 'Could not delete holiday.' } }
  }
}

export async function getCancellationPolicy() {
  try {
    const db = getPrisma()
    const policy = await db.cancellationPolicy.findFirst({ where: { isActive: true } })
    return { success: true, data: policy ?? null }
  } catch (err) {
    return { success: false, error: { code: 'PSC-007', message: err instanceof Error ? err.message : 'Could not get cancellation policy.' } }
  }
}

export async function upsertCancellationPolicy(payload: {
  noticePeriodHours?: number
  cancellationFeeType?: string
  cancellationFeeValue?: number
  notes?: string | null
}) {
  try {
    const db = getPrisma()
    const existing = await db.cancellationPolicy.findFirst({ where: { isActive: true } })
    const data = {
      noticePeriodHours: payload.noticePeriodHours ?? 24,
      cancellationFeeType: payload.cancellationFeeType ?? 'NONE',
      cancellationFeeValue: payload.cancellationFeeValue ?? 0,
      notes: payload.notes ?? null,
    }
    const item = existing
      ? await db.cancellationPolicy.update({ where: { id: existing.id }, data })
      : await db.cancellationPolicy.create({ data: { ...data, isActive: true } })
    return { success: true, data: item }
  } catch (err) {
    return { success: false, error: { code: 'PSC-008', message: err instanceof Error ? err.message : 'Could not update cancellation policy.' } }
  }
}
