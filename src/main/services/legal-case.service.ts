import { getPrisma } from '../database/db'
import { serializeTimeEntry } from './time-entry.service'

// LegalCase.feeAgreed/feeCollected are Prisma Decimal fields — Electron's
// IPC (structured clone) cannot serialize a Decimal instance and throws
// "An object could not be cloned" on every response that includes one.
// Applied to every function below that returns a case.
function serializeCase<T extends { feeAgreed: unknown; feeCollected: unknown }>(c: T): T {
  return { ...c, feeAgreed: c.feeAgreed == null ? null : Number(c.feeAgreed), feeCollected: Number(c.feeCollected) }
}

export async function listLegalCases(filters?: {
  status?: string
  clientId?: string
  advocateId?: string
  search?: string
}) {
  try {
    const db = getPrisma()
    const where: Record<string, unknown> = {}
    if (filters?.status) where.status = filters.status
    if (filters?.clientId) where.clientId = filters.clientId
    if (filters?.advocateId) where.advocateId = filters.advocateId
    if (filters?.search) {
      where.OR = [
        { caseNumber: { contains: filters.search } },
        { caseTitle: { contains: filters.search } },
        { courtName: { contains: filters.search } },
      ]
    }

    const cases = await db.legalCase.findMany({
      where,
      include: {
        client: { select: { id: true, customerName: true, phone: true } },
        advocate: { select: { id: true, fullName: true } },
        _count: { select: { hearings: true, timeEntries: true } },
      },
      orderBy: [{ status: 'asc' }, { nextHearingDate: 'asc' }, { createdAt: 'desc' }],
    })
    return { success: true, data: cases.map(serializeCase) }
  } catch (err) {
    return { success: false, error: { code: 'LC28-001', message: err instanceof Error ? err.message : 'Could not list cases.' } }
  }
}

export async function getLegalCase(id: string) {
  try {
    const db = getPrisma()
    const legalCase = await db.legalCase.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, customerName: true, phone: true, email: true } },
        advocate: { select: { id: true, fullName: true } },
        hearings: { orderBy: { hearingDate: 'desc' } },
        timeEntries: {
          include: { employee: { select: { id: true, fullName: true } } },
          orderBy: { date: 'desc' },
        },
      },
    })
    if (!legalCase) return { success: false, error: { code: 'LC28-NOT-FOUND', message: 'Case not found.' } }
    return {
      success: true,
      data: serializeCase({ ...legalCase, timeEntries: legalCase.timeEntries.map(serializeTimeEntry) }),
    }
  } catch (err) {
    return { success: false, error: { code: 'LC28-002', message: err instanceof Error ? err.message : 'Could not get case.' } }
  }
}

export async function createLegalCase(payload: {
  caseNumber: string
  caseTitle: string
  caseType?: string
  courtName: string
  courtDistrict?: string
  courtState?: string
  eCourtId?: string
  clientId: string
  advocateId?: string
  filingDate?: string
  feeAgreed?: number
  notes?: string
}) {
  try {
    const db = getPrisma()
    const legalCase = await db.legalCase.create({
      data: {
        caseNumber: payload.caseNumber.trim(),
        caseTitle: payload.caseTitle.trim(),
        caseType: payload.caseType ?? 'CIVIL',
        courtName: payload.courtName.trim(),
        courtDistrict: payload.courtDistrict ?? null,
        courtState: payload.courtState ?? null,
        eCourtId: payload.eCourtId ?? null,
        clientId: payload.clientId,
        advocateId: payload.advocateId ?? null,
        filingDate: payload.filingDate ? new Date(payload.filingDate) : null,
        feeAgreed: payload.feeAgreed ?? null,
        feeCollected: 0,
        status: 'ACTIVE',
        notes: payload.notes ?? null,
      },
      include: {
        client: { select: { id: true, customerName: true, phone: true } },
        advocate: { select: { id: true, fullName: true } },
      },
    })
    await db.auditLog.create({
      data: { action: 'CREATE', entityType: 'LegalCase', entityId: legalCase.id, newValue: JSON.stringify({ caseNumber: payload.caseNumber, caseTitle: payload.caseTitle }) },
    }).catch(() => {})
    return { success: true, data: serializeCase(legalCase) }
  } catch (err) {
    return { success: false, error: { code: 'LC28-003', message: err instanceof Error ? err.message : 'Could not create case.' } }
  }
}

export async function updateLegalCase(payload: {
  id: string
  caseNumber?: string
  caseTitle?: string
  caseType?: string
  courtName?: string
  courtDistrict?: string | null
  courtState?: string | null
  eCourtId?: string | null
  advocateId?: string | null
  status?: string
  filingDate?: string | null
  nextHearingDate?: string | null
  feeAgreed?: number | null
  feeCollected?: number
  notes?: string | null
}) {
  try {
    const db = getPrisma()
    const { id, filingDate, nextHearingDate, ...rest } = payload
    const legalCase = await db.legalCase.update({
      where: { id },
      data: {
        ...rest,
        ...(filingDate !== undefined ? { filingDate: filingDate ? new Date(filingDate) : null } : {}),
        ...(nextHearingDate !== undefined ? { nextHearingDate: nextHearingDate ? new Date(nextHearingDate) : null } : {}),
      },
    })
    const auditAction = payload.status === 'CLOSED' ? 'CLOSED' : 'UPDATE'
    await db.auditLog.create({
      data: { action: auditAction, entityType: 'LegalCase', entityId: id },
    }).catch(() => {})
    return { success: true, data: serializeCase(legalCase) }
  } catch (err) {
    return { success: false, error: { code: 'LC28-004', message: err instanceof Error ? err.message : 'Could not update case.' } }
  }
}

export async function deleteLegalCase(id: string) {
  try {
    const db = getPrisma()
    await db.legalCase.delete({ where: { id } })
    await db.auditLog.create({
      data: { action: 'DELETE', entityType: 'LegalCase', entityId: id },
    }).catch(() => {})
    return { success: true, data: { id } }
  } catch (err) {
    return { success: false, error: { code: 'LC28-005', message: err instanceof Error ? err.message : 'Could not delete case.' } }
  }
}
