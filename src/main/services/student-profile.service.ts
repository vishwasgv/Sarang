import { getPrisma } from '../database/db'

export async function listStudents(filters?: { isActive?: boolean; search?: string }) {
  const db = getPrisma()
  const where: Record<string, unknown> = {}
  if (filters?.isActive !== undefined) where.isActive = filters.isActive
  if (filters?.search) {
    where.customer = {
      OR: [
        { customerName: { contains: filters.search } },
        { phone: { contains: filters.search } },
      ],
    }
  }
  const profiles = await db.studentProfile.findMany({
    where,
    include: { customer: true },
    orderBy: { customer: { customerName: 'asc' } },
  })
  return { success: true, data: profiles }
}

export async function getStudent(id: string) {
  const db = getPrisma()
  const profile = await db.studentProfile.findUnique({
    where: { id },
    include: { customer: true },
  })
  if (!profile) return { success: false, error: { code: 'STU-001', message: 'Student not found.' } }
  return { success: true, data: profile }
}

export async function createStudent(payload: {
  customerId?: string
  customerName: string
  phone?: string
  email?: string
  address?: string
  rollNumber?: string
  classOrGrade: string
  schoolName?: string
  parentPhone?: string
  enrollmentDate?: string
}) {
  const db = getPrisma()
  const profile = await db.$transaction(async (tx) => {
    // Find-or-create by phone — a student enrolling here may already be a
    // Customer from an unrelated purchase/booking elsewhere in the app.
    // Without this check every enrollment created a brand-new Customer row
    // unconditionally, silently duplicating anyone billed more than once.
    // A caller that already resolved a specific customer (the CustomerPicker
    // UI) passes customerId directly and skips the lookup entirely.
    const existing = payload.customerId
      ? await tx.customer.findUnique({ where: { id: payload.customerId } })
      : payload.phone
        ? await tx.customer.findFirst({ where: { phone: payload.phone, isActive: true } })
        : null
    const customer = existing ?? await tx.customer.create({
      data: {
        customerName: payload.customerName,
        phone: payload.phone || null,
        email: payload.email || null,
        address: payload.address || null,
      },
    })
    return tx.studentProfile.create({
      data: {
        customerId: customer.id,
        rollNumber: payload.rollNumber || null,
        classOrGrade: payload.classOrGrade,
        schoolName: payload.schoolName || null,
        parentPhone: payload.parentPhone || null,
        enrollmentDate: payload.enrollmentDate ? new Date(payload.enrollmentDate) : new Date(),
      },
      include: { customer: true },
    })
  })
  await db.auditLog.create({ data: { action: 'CREATE', entityType: 'StudentProfile', entityId: profile.id, newValue: JSON.stringify({ customerName: payload.customerName }) } }).catch(() => {})
  return { success: true, data: profile }
}

export async function updateStudent(payload: {
  id: string
  customerName?: string
  phone?: string | null
  email?: string | null
  rollNumber?: string | null
  classOrGrade?: string
  schoolName?: string | null
  parentPhone?: string | null
  isActive?: boolean
}) {
  const db = getPrisma()
  const existing = await db.studentProfile.findUnique({ where: { id: payload.id } })
  if (!existing) return { success: false, error: { code: 'STU-001', message: 'Student not found.' } }

  const profile = await db.$transaction(async (tx) => {
    if (payload.customerName !== undefined || payload.phone !== undefined || payload.email !== undefined) {
      await tx.customer.update({
        where: { id: existing.customerId },
        data: {
          ...(payload.customerName ? { customerName: payload.customerName } : {}),
          ...(payload.phone !== undefined ? { phone: payload.phone } : {}),
          ...(payload.email !== undefined ? { email: payload.email } : {}),
        },
      })
    }
    return tx.studentProfile.update({
      where: { id: payload.id },
      data: {
        ...(payload.rollNumber !== undefined ? { rollNumber: payload.rollNumber } : {}),
        ...(payload.classOrGrade ? { classOrGrade: payload.classOrGrade } : {}),
        ...(payload.schoolName !== undefined ? { schoolName: payload.schoolName } : {}),
        ...(payload.parentPhone !== undefined ? { parentPhone: payload.parentPhone } : {}),
        ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
      },
      include: { customer: true },
    })
  })
  await db.auditLog.create({ data: { action: 'UPDATE', entityType: 'StudentProfile', entityId: profile.id } }).catch(() => {})
  return { success: true, data: profile }
}

export async function deleteStudent(id: string) {
  const db = getPrisma()
  const existing = await db.studentProfile.findUnique({ where: { id } })
  if (!existing) return { success: false, error: { code: 'STU-001', message: 'Student not found.' } }
  await db.studentProfile.delete({ where: { id } })
  await db.auditLog.create({ data: { action: 'DELETE', entityType: 'StudentProfile', entityId: id } }).catch(() => {})
  return { success: true }
}
