import { getPrisma } from '../database/db'

export async function getActiveProgram(patientId: string) {
  try {
    const db = getPrisma()
    const program = await db.exerciseProgram.findFirst({
      where: { patientId, isActive: true },
      include: { createdBy: { select: { id: true, fullName: true } } },
      orderBy: { updatedAt: 'desc' },
    })
    return { success: true, data: program }
  } catch (err) {
    return { success: false, error: { code: 'EP-001', message: err instanceof Error ? err.message : 'Could not fetch exercise program.' } }
  }
}

export async function listPrograms(patientId: string) {
  try {
    const db = getPrisma()
    const programs = await db.exerciseProgram.findMany({
      where: { patientId },
      include: { createdBy: { select: { id: true, fullName: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return { success: true, data: programs }
  } catch (err) {
    return { success: false, error: { code: 'EP-002', message: err instanceof Error ? err.message : 'Could not list exercise programs.' } }
  }
}

export async function upsertProgram(payload: {
  patientId: string
  title?: string
  exercises: string  // JSON string
  createdById?: string
  userId?: string
}) {
  try {
    const db = getPrisma()

    // Find active program to update; otherwise create new
    const existing = await db.exerciseProgram.findFirst({
      where: { patientId: payload.patientId, isActive: true },
      orderBy: { updatedAt: 'desc' },
    })

    let program
    if (existing) {
      program = await db.exerciseProgram.update({
        where: { id: existing.id },
        data: {
          title: payload.title ?? existing.title,
          exercises: payload.exercises,
        },
      })
    } else {
      program = await db.exerciseProgram.create({
        data: {
          patientId: payload.patientId,
          title: payload.title ?? 'Home Exercise Program',
          exercises: payload.exercises,
          isActive: true,
          createdById: payload.createdById ?? null,
        },
      })
    }

    await db.auditLog.create({
      data: { userId: payload.userId ?? null, action: existing ? 'UPDATE' : 'CREATE', entityType: 'ExerciseProgram', entityId: program.id },
    }).catch(() => {})

    return { success: true, data: program }
  } catch (err) {
    return { success: false, error: { code: 'EP-003', message: err instanceof Error ? err.message : 'Could not save exercise program.' } }
  }
}

export async function markProgramPrinted(id: string) {
  try {
    const db = getPrisma()
    const program = await db.exerciseProgram.update({
      where: { id },
      data: { printedAt: new Date() },
    })
    return { success: true, data: program }
  } catch (err) {
    return { success: false, error: { code: 'EP-004', message: err instanceof Error ? err.message : 'Could not mark as printed.' } }
  }
}
