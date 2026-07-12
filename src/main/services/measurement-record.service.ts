import { getPrisma } from '../database/db'

// MeasurementRecord has 15 Prisma Decimal fields (chest, waist, hips,
// shoulder, neck, sleeve, inseam, outseam, thigh, height, plus Phase 48's
// armhole/frontNeckDepth/backNeckDepth/garmentLength/cuff) — Electron's IPC
// (structured clone) cannot serialize a Decimal instance and throws "An
// object could not be cloned" on every response that includes one. Applied
// to every function below that returns a record.
function serializeMeasurementRecord<T extends {
  chest: unknown; waist: unknown; hips: unknown; shoulder: unknown; neck: unknown
  sleeve: unknown; inseam: unknown; outseam: unknown; thigh: unknown; height: unknown
  armhole: unknown; frontNeckDepth: unknown; backNeckDepth: unknown; garmentLength: unknown; cuff: unknown
}>(r: T): T {
  const n = (v: unknown) => v == null ? null : Number(v)
  return {
    ...r,
    chest: n(r.chest), waist: n(r.waist), hips: n(r.hips), shoulder: n(r.shoulder), neck: n(r.neck),
    sleeve: n(r.sleeve), inseam: n(r.inseam), outseam: n(r.outseam), thigh: n(r.thigh), height: n(r.height),
    armhole: n(r.armhole), frontNeckDepth: n(r.frontNeckDepth), backNeckDepth: n(r.backNeckDepth),
    garmentLength: n(r.garmentLength), cuff: n(r.cuff),
  }
}

export async function listMeasurementRecords(clientId: string) {
  const db = getPrisma()
  const records = await db.measurementRecord.findMany({
    where: { clientId },
    include: { takenBy: { select: { id: true, fullName: true } } },
    orderBy: { recordDate: 'desc' },
  })
  return { success: true, data: records.map(serializeMeasurementRecord) }
}

export async function getMeasurementRecord(id: string) {
  const db = getPrisma()
  const record = await db.measurementRecord.findUnique({
    where: { id },
    include: { takenBy: { select: { id: true, fullName: true } } },
  })
  if (!record) return { success: false, error: { code: 'MR-001', message: 'Measurement record not found.' } }
  return { success: true, data: serializeMeasurementRecord(record) }
}

export async function createMeasurementRecord(payload: {
  clientId: string
  chest?: number
  waist?: number
  hips?: number
  shoulder?: number
  neck?: number
  sleeve?: number
  inseam?: number
  outseam?: number
  thigh?: number
  height?: number
  armhole?: number
  frontNeckDepth?: number
  backNeckDepth?: number
  garmentLength?: number
  cuff?: number
  notes?: string
  takenById?: string
  recordDate?: string
}) {
  const db = getPrisma()
  const record = await db.measurementRecord.create({
    data: {
      clientId: payload.clientId,
      chest: payload.chest ?? null,
      waist: payload.waist ?? null,
      hips: payload.hips ?? null,
      shoulder: payload.shoulder ?? null,
      neck: payload.neck ?? null,
      sleeve: payload.sleeve ?? null,
      inseam: payload.inseam ?? null,
      outseam: payload.outseam ?? null,
      thigh: payload.thigh ?? null,
      height: payload.height ?? null,
      armhole: payload.armhole ?? null,
      frontNeckDepth: payload.frontNeckDepth ?? null,
      backNeckDepth: payload.backNeckDepth ?? null,
      garmentLength: payload.garmentLength ?? null,
      cuff: payload.cuff ?? null,
      notes: payload.notes ?? null,
      takenById: payload.takenById ?? null,
      recordDate: payload.recordDate ? new Date(payload.recordDate) : new Date(),
    },
    include: { takenBy: { select: { id: true, fullName: true } } },
  })
  await db.auditLog.create({ data: { action: 'CREATE', entityType: 'MeasurementRecord', entityId: record.id, newValue: JSON.stringify({ clientId: record.clientId }) } }).catch(() => {})
  return { success: true, data: serializeMeasurementRecord(record) }
}

export async function updateMeasurementRecord(payload: {
  id: string
  chest?: number | null
  waist?: number | null
  hips?: number | null
  shoulder?: number | null
  neck?: number | null
  sleeve?: number | null
  inseam?: number | null
  outseam?: number | null
  thigh?: number | null
  height?: number | null
  armhole?: number | null
  frontNeckDepth?: number | null
  backNeckDepth?: number | null
  garmentLength?: number | null
  cuff?: number | null
  notes?: string | null
  takenById?: string | null
  recordDate?: string
}) {
  const db = getPrisma()
  const { id, recordDate, ...rest } = payload
  const data: Record<string, unknown> = { ...rest }
  if (recordDate !== undefined) data.recordDate = new Date(recordDate)

  const record = await db.measurementRecord.update({
    where: { id },
    data,
    include: { takenBy: { select: { id: true, fullName: true } } },
  })
  await db.auditLog.create({ data: { action: 'UPDATE', entityType: 'MeasurementRecord', entityId: record.id } }).catch(() => {})
  return { success: true, data: serializeMeasurementRecord(record) }
}

export async function deleteMeasurementRecord(id: string) {
  const db = getPrisma()
  await db.measurementRecord.delete({ where: { id } })
  await db.auditLog.create({ data: { action: 'DELETE', entityType: 'MeasurementRecord', entityId: id } }).catch(() => {})
  return { success: true }
}
