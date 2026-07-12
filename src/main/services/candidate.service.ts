import { getPrisma } from '../database/db'
import { generateSequenceNumber } from './sequence.service'

type TxClient = Parameters<Parameters<ReturnType<typeof getPrisma>['$transaction']>[0]>[0]

// Candidate.totalExperience/expectedSalary/currentSalary are Prisma Decimal
// fields — Electron's IPC (structured clone) cannot serialize a Decimal
// instance and throws "An object could not be cloned" on every response
// that includes one. Applied to every function below that returns a
// candidate.
function serializeCandidate<T extends { totalExperience: unknown; expectedSalary: unknown; currentSalary: unknown }>(c: T): T {
  const n = (v: unknown) => v == null ? null : Number(v)
  return { ...c, totalExperience: n(c.totalExperience), expectedSalary: n(c.expectedSalary), currentSalary: n(c.currentSalary) }
}

// Was a plain findFirst(orderBy desc)+increment called OUTSIDE any
// transaction — see sequence.service.ts's header comment for the race this
// closes (both under concurrency and after any hard-delete).
async function generateCandidateNumber(tx: TxClient): Promise<string> {
  return generateSequenceNumber(
    tx, 'candidate_number_sequence', 'CND', 5,
    async () => {
      const last = await tx.candidate.findFirst({ orderBy: { createdAt: 'desc' }, select: { candidateNumber: true } })
      return last ? parseInt(last.candidateNumber.replace('CND-', ''), 10) : 0
    }
  )
}

export async function listCandidates(filters?: { status?: string; search?: string }) {
  const db = getPrisma()
  const where: Record<string, unknown> = {}
  if (filters?.status) where.status = filters.status
  if (filters?.search) {
    where.OR = [
      { candidateNumber: { contains: filters.search } },
      { fullName: { contains: filters.search } },
      { phone: { contains: filters.search } },
      { email: { contains: filters.search } },
      { currentJobTitle: { contains: filters.search } },
      { currentEmployer: { contains: filters.search } },
      { skills: { contains: filters.search } },
    ]
  }
  const candidates = await db.candidate.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  })
  return { success: true, data: candidates.map(serializeCandidate) }
}

export async function getCandidate(id: string) {
  const db = getPrisma()
  const candidate = await db.candidate.findUnique({ where: { id } })
  if (!candidate) return { success: false, error: { code: 'CND-001', message: 'Candidate not found.' } }
  return { success: true, data: serializeCandidate(candidate) }
}

export async function createCandidate(payload: {
  fullName: string
  email?: string
  phone?: string
  currentJobTitle?: string
  currentEmployer?: string
  totalExperience?: number
  skills?: string[]
  preferredLocations?: string[]
  educationSummary?: string
  resumeNotes?: string
  expectedSalary?: number
  currentSalary?: number
  availableFrom?: string
  source?: string
  notes?: string
}) {
  const db = getPrisma()
  const candidate = await db.$transaction(async (tx) => {
    const candidateNumber = await generateCandidateNumber(tx)
    return tx.candidate.create({
      data: {
        candidateNumber,
        fullName: payload.fullName,
        email: payload.email ?? null,
        phone: payload.phone ?? null,
        currentJobTitle: payload.currentJobTitle ?? null,
        currentEmployer: payload.currentEmployer ?? null,
        totalExperience: payload.totalExperience ?? null,
        skills: JSON.stringify(payload.skills ?? []),
        preferredLocations: JSON.stringify(payload.preferredLocations ?? []),
        educationSummary: payload.educationSummary ?? null,
        resumeNotes: payload.resumeNotes ?? null,
        expectedSalary: payload.expectedSalary ?? null,
        currentSalary: payload.currentSalary ?? null,
        availableFrom: payload.availableFrom ? new Date(payload.availableFrom) : null,
        source: payload.source ?? 'WALKIN',
        notes: payload.notes ?? null,
      },
    })
  })
  await db.auditLog.create({
    data: { action: 'CREATE', entityType: 'Candidate', entityId: candidate.id, newValue: JSON.stringify({ candidateNumber: candidate.candidateNumber, fullName: payload.fullName }) },
  }).catch(() => {})
  return { success: true, data: serializeCandidate(candidate) }
}

export async function updateCandidate(payload: {
  id: string
  fullName?: string
  email?: string | null
  phone?: string | null
  currentJobTitle?: string | null
  currentEmployer?: string | null
  totalExperience?: number | null
  skills?: string[]
  preferredLocations?: string[]
  educationSummary?: string | null
  resumeNotes?: string | null
  expectedSalary?: number | null
  currentSalary?: number | null
  availableFrom?: string | null
  status?: string
  source?: string
  notes?: string | null
}) {
  const db = getPrisma()
  const { id, skills, preferredLocations, availableFrom, ...rest } = payload
  const data: Record<string, unknown> = { ...rest }
  if (skills !== undefined) data.skills = JSON.stringify(skills)
  if (preferredLocations !== undefined) data.preferredLocations = JSON.stringify(preferredLocations)
  if (availableFrom !== undefined) data.availableFrom = availableFrom ? new Date(availableFrom) : null
  const candidate = await db.candidate.update({ where: { id }, data })
  await db.auditLog.create({
    data: { action: 'UPDATE', entityType: 'Candidate', entityId: id },
  }).catch(() => {})
  return { success: true, data: serializeCandidate(candidate) }
}

export async function deleteCandidate(id: string) {
  const db = getPrisma()
  const count = await db.placement.count({ where: { candidateId: id } })
  if (count > 0) {
    return { success: false, error: { code: 'CND-002', message: `Cannot delete candidate with ${count} placement record(s). Remove placements first.` } }
  }
  await db.candidate.delete({ where: { id } })
  await db.auditLog.create({
    data: { action: 'DELETE', entityType: 'Candidate', entityId: id },
  }).catch(() => {})
  return { success: true }
}
