import { getPrisma } from '../database/db'

export async function listBatchClasses(filters?: { status?: string; instructorId?: string }) {
  try {
    const db = getPrisma()
    const where: Record<string, unknown> = {}
    if (filters?.status) where.status = filters.status
    if (filters?.instructorId) where.instructorId = filters.instructorId

    const classes = await db.batchClass.findMany({
      where,
      include: { instructor: { select: { id: true, fullName: true } } },
      orderBy: { startDate: 'desc' },
    })
    return { success: true, data: classes }
  } catch (err) {
    return { success: false, error: { code: 'BC27-001', message: err instanceof Error ? err.message : 'Could not list classes.' } }
  }
}

export async function getBatchClass(id: string) {
  try {
    const db = getPrisma()
    const cls = await db.batchClass.findUnique({
      where: { id },
      include: { instructor: { select: { id: true, fullName: true } } },
    })
    if (!cls) return { success: false, error: { code: 'BC27-NOT-FOUND', message: 'Class not found.' } }
    return { success: true, data: cls }
  } catch (err) {
    return { success: false, error: { code: 'BC27-002', message: err instanceof Error ? err.message : 'Could not get class.' } }
  }
}

export async function createBatchClass(payload: {
  className: string
  instructorId?: string
  maxCapacity: number
  scheduleDays: string
  scheduleTime: string
  startDate: string
  endDate?: string
  roomOrLocation?: string
}) {
  try {
    const db = getPrisma()
    const cls = await db.batchClass.create({
      data: {
        className: payload.className,
        instructorId: payload.instructorId ?? null,
        maxCapacity: payload.maxCapacity,
        scheduleDays: payload.scheduleDays,
        scheduleTime: payload.scheduleTime,
        startDate: new Date(payload.startDate),
        endDate: payload.endDate ? new Date(payload.endDate) : null,
        roomOrLocation: payload.roomOrLocation ?? null,
        enrolledMemberIds: '[]',
        status: 'ACTIVE',
      },
    })
    await db.auditLog.create({ data: { action: 'CREATE', entityType: 'BatchClass', entityId: cls.id, newValue: JSON.stringify({ className: cls.className }) } }).catch(() => {})
    return { success: true, data: cls }
  } catch (err) {
    return { success: false, error: { code: 'BC27-003', message: err instanceof Error ? err.message : 'Could not create class.' } }
  }
}

export async function updateBatchClass(payload: {
  id: string
  className?: string
  instructorId?: string | null
  maxCapacity?: number
  scheduleDays?: string
  scheduleTime?: string
  startDate?: string
  endDate?: string | null
  roomOrLocation?: string | null
  status?: string
}) {
  try {
    const db = getPrisma()
    const { id, startDate, endDate, ...rest } = payload
    const cls = await db.batchClass.update({
      where: { id },
      data: {
        ...rest,
        ...(startDate !== undefined ? { startDate: new Date(startDate) } : {}),
        ...(endDate !== undefined ? { endDate: endDate ? new Date(endDate) : null } : {}),
      },
    })
    await db.auditLog.create({ data: { action: 'UPDATE', entityType: 'BatchClass', entityId: cls.id } }).catch(() => {})
    return { success: true, data: cls }
  } catch (err) {
    return { success: false, error: { code: 'BC27-004', message: err instanceof Error ? err.message : 'Could not update class.' } }
  }
}

export async function enrollMember(batchClassId: string, memberId: string) {
  try {
    const db = getPrisma()

    // The read (existing enrollment / capacity check) and the write used to
    // run as separate statements outside any transaction — a TOCTOU race.
    // Two near-simultaneous enroll calls could both read the same
    // under-capacity enrolledMemberIds, both pass the capacity check, and
    // then the second write would silently overwrite the first (a plain
    // JSON-string replace, not an atomic append), losing the first
    // member's enrollment even though their call reported success. Now the
    // whole check-then-write runs inside one interactive transaction.
    const result = await db.$transaction(async (tx): Promise<
      | { status: 'not-found' }
      | { status: 'already-enrolled' }
      | { status: 'full' }
      | { status: 'ok'; cls: Awaited<ReturnType<typeof tx.batchClass.update>> }
    > => {
      const cls = await tx.batchClass.findUnique({ where: { id: batchClassId } })
      if (!cls) return { status: 'not-found' }

      const enrolled: string[] = JSON.parse(cls.enrolledMemberIds || '[]')
      if (enrolled.includes(memberId)) return { status: 'already-enrolled' }
      if (enrolled.length >= cls.maxCapacity) return { status: 'full' }

      enrolled.push(memberId)
      const updated = await tx.batchClass.update({
        where: { id: batchClassId },
        data: { enrolledMemberIds: JSON.stringify(enrolled) },
      })
      return { status: 'ok', cls: updated }
    })

    if (result.status === 'not-found') return { success: false, error: { code: 'BC27-NOT-FOUND', message: 'Class not found.' } }
    if (result.status === 'already-enrolled') return { success: false, error: { code: 'BC27-ALREADY-ENROLLED', message: 'Member is already enrolled in this class.' } }
    if (result.status === 'full') return { success: false, error: { code: 'BC27-FULL', message: 'Class is at full capacity.' } }

    await db.auditLog.create({ data: { action: 'ENROLLED', entityType: 'BatchClass', entityId: batchClassId, newValue: JSON.stringify({ memberId }) } }).catch(() => {})
    return { success: true, data: result.cls }
  } catch (err) {
    return { success: false, error: { code: 'BC27-005', message: err instanceof Error ? err.message : 'Could not enroll member.' } }
  }
}

export async function unenrollMember(batchClassId: string, memberId: string) {
  try {
    const db = getPrisma()

    // Same TOCTOU fix as enrollMember — read and write in one transaction
    // so a concurrent enroll/unenroll pair can't clobber each other.
    const result = await db.$transaction(async (tx): Promise<
      | { status: 'not-found' }
      | { status: 'ok'; cls: Awaited<ReturnType<typeof tx.batchClass.update>> }
    > => {
      const cls = await tx.batchClass.findUnique({ where: { id: batchClassId } })
      if (!cls) return { status: 'not-found' }

      const enrolled: string[] = JSON.parse(cls.enrolledMemberIds || '[]')
      const updated = enrolled.filter((id) => id !== memberId)
      const cls2 = await tx.batchClass.update({
        where: { id: batchClassId },
        data: { enrolledMemberIds: JSON.stringify(updated) },
      })
      return { status: 'ok', cls: cls2 }
    })

    if (result.status === 'not-found') return { success: false, error: { code: 'BC27-NOT-FOUND', message: 'Class not found.' } }
    return { success: true, data: result.cls }
  } catch (err) {
    return { success: false, error: { code: 'BC27-006', message: err instanceof Error ? err.message : 'Could not unenroll member.' } }
  }
}

export async function markBatchClassAttendance(classId: string, memberIds: string[], sessionDate: string) {
  try {
    const db = getPrisma()
    const date = new Date(sessionDate)

    await db.$transaction([
      // Remove attendance for members now marked absent (not in present list)
      db.batchClassAttendance.deleteMany({
        where: {
          classId,
          sessionDate: date,
          ...(memberIds.length > 0 ? { memberId: { notIn: memberIds } } : {}),
        },
      }),
      // Upsert present members
      ...memberIds.map((memberId) =>
        db.batchClassAttendance.upsert({
          where: { classId_memberId_sessionDate: { classId, memberId, sessionDate: date } },
          create: { classId, memberId, sessionDate: date },
          update: {},
        })
      ),
    ])

    return { success: true, data: { count: memberIds.length } }
  } catch (err) {
    return { success: false, error: { code: 'BC27-007', message: err instanceof Error ? err.message : 'Could not mark attendance.' } }
  }
}

export async function getBatchClassAttendance(classId: string, sessionDate?: string) {
  try {
    const db = getPrisma()
    const where: Record<string, unknown> = { classId }
    if (sessionDate) where.sessionDate = new Date(sessionDate)

    const records = await db.batchClassAttendance.findMany({
      where,
      include: { member: { select: { id: true, customerName: true, phone: true } } },
      orderBy: [{ sessionDate: 'desc' }, { createdAt: 'asc' }],
    })
    return { success: true, data: records }
  } catch (err) {
    return { success: false, error: { code: 'BC27-008', message: err instanceof Error ? err.message : 'Could not get attendance.' } }
  }
}
