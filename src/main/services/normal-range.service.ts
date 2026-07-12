import { getPrisma } from '../database/db'

// Phase 54B — a single reusable "what's normal for this test" library shared
// by structured vitals (VisitNote) and lab test result parameters
// (LabTestOrderItem.resultParameters) so a doctor/lab saves a normal range
// once instead of re-typing/re-selecting it on every single result.

export async function listNormalRanges(filters?: { testName?: string }) {
  try {
    const db = getPrisma()
    const where: Record<string, unknown> = { isActive: true }
    if (filters?.testName) where.testName = { contains: filters.testName }
    const ranges = await db.normalRangeReference.findMany({ where, orderBy: { testName: 'asc' } })
    return { success: true, data: ranges }
  } catch (err) {
    return { success: false, error: { code: 'NRM-001', message: err instanceof Error ? err.message : 'Could not list normal ranges.' } }
  }
}

export async function saveNormalRange(payload: {
  testName: string
  unit?: string | null
  minValue?: number | null
  maxValue?: number | null
  gender?: 'ALL' | 'MALE' | 'FEMALE'
  notes?: string | null
}) {
  try {
    const db = getPrisma()
    const testName = payload.testName.trim()
    const gender = payload.gender ?? 'ALL'
    const range = await db.normalRangeReference.upsert({
      where: { testName_gender: { testName, gender } },
      create: {
        testName, gender,
        unit: payload.unit ?? null,
        minValue: payload.minValue ?? null,
        maxValue: payload.maxValue ?? null,
        notes: payload.notes ?? null,
      },
      update: {
        unit: payload.unit ?? null,
        minValue: payload.minValue ?? null,
        maxValue: payload.maxValue ?? null,
        notes: payload.notes ?? null,
        isActive: true,
      },
    })
    return { success: true, data: range }
  } catch (err) {
    return { success: false, error: { code: 'NRM-002', message: err instanceof Error ? err.message : 'Could not save normal range.' } }
  }
}

export async function deleteNormalRange(id: string) {
  try {
    const db = getPrisma()
    await db.normalRangeReference.update({ where: { id }, data: { isActive: false } })
    return { success: true, data: { id } }
  } catch (err) {
    return { success: false, error: { code: 'NRM-003', message: err instanceof Error ? err.message : 'Could not delete normal range.' } }
  }
}

export type RangeFlag = 'LOW' | 'NORMAL' | 'HIGH'

// Looks up the saved range itself (not just a flag) so a caller can prefill
// a human-readable "90-120 mmHg" reference string, falling back from a
// gender-specific row to the ALL row exactly like evaluateAgainstNormalRange.
export async function findNormalRange(testName: string, gender: 'ALL' | 'MALE' | 'FEMALE' = 'ALL') {
  const db = getPrisma()
  let range = await db.normalRangeReference.findUnique({ where: { testName_gender: { testName, gender } } })
  if ((!range || !range.isActive) && gender !== 'ALL') {
    range = await db.normalRangeReference.findUnique({ where: { testName_gender: { testName, gender: 'ALL' } } })
  }
  return range && range.isActive ? range : null
}

// Falls back from a gender-specific range to the ALL range — a lab that only
// ever saved one "Hemoglobin" reference (gender: ALL) still gets auto-flagged
// even though the request came in for a specific patient's gender.
export async function evaluateAgainstNormalRange(
  testName: string, value: number, gender: 'ALL' | 'MALE' | 'FEMALE' = 'ALL'
): Promise<RangeFlag | null> {
  const db = getPrisma()
  let range = await db.normalRangeReference.findUnique({ where: { testName_gender: { testName, gender } }, select: { minValue: true, maxValue: true, isActive: true } })
  if ((!range || !range.isActive) && gender !== 'ALL') {
    range = await db.normalRangeReference.findUnique({ where: { testName_gender: { testName, gender: 'ALL' } }, select: { minValue: true, maxValue: true, isActive: true } })
  }
  if (!range || !range.isActive || (range.minValue == null && range.maxValue == null)) return null
  if (range.minValue != null && value < range.minValue) return 'LOW'
  if (range.maxValue != null && value > range.maxValue) return 'HIGH'
  return 'NORMAL'
}

// Canonical vital test names — shared between VisitNote vitals and any future
// caller, so a saved NormalRangeReference row and the vitals form always
// agree on what a given field is called.
export const VITAL_TEST_NAMES = {
  bpSystolic: 'Blood Pressure - Systolic',
  bpDiastolic: 'Blood Pressure - Diastolic',
  pulseRate: 'Pulse Rate',
  temperatureF: 'Body Temperature',
} as const

// Universal medical reference values, not vertical-specific — seeded once on
// fresh setup regardless of business type (any clinic/lab that later turns
// on appointments/lab_orders benefits immediately, without needing its own
// per-type seed map the way ServiceCatalog's starter services do).
const DEFAULT_RANGES: Array<{ testName: string; unit: string; minValue: number; maxValue: number }> = [
  { testName: 'Blood Pressure - Systolic', unit: 'mmHg', minValue: 90, maxValue: 120 },
  { testName: 'Blood Pressure - Diastolic', unit: 'mmHg', minValue: 60, maxValue: 80 },
  { testName: 'Pulse Rate', unit: 'bpm', minValue: 60, maxValue: 100 },
  { testName: 'Body Temperature', unit: '°F', minValue: 97.0, maxValue: 99.0 },
  { testName: 'Fasting Blood Sugar (FBS)', unit: 'mg/dL', minValue: 70, maxValue: 100 },
  { testName: 'Post Prandial Blood Sugar (PPBS)', unit: 'mg/dL', minValue: 70, maxValue: 140 },
  { testName: 'HbA1c', unit: '%', minValue: 4, maxValue: 5.6 },
  { testName: 'Total Cholesterol', unit: 'mg/dL', minValue: 125, maxValue: 200 },
]

export async function seedDefaultNormalRanges(): Promise<void> {
  const db = getPrisma()
  const existing = await db.normalRangeReference.count()
  if (existing > 0) return
  for (const r of DEFAULT_RANGES) {
    await db.normalRangeReference.create({ data: { testName: r.testName, unit: r.unit, minValue: r.minValue, maxValue: r.maxValue, gender: 'ALL' } })
  }
}

export async function computeVitalsFlags(vitals: {
  bpSystolic?: number | null; bpDiastolic?: number | null
  pulseRate?: number | null; temperatureF?: number | null
}, gender: 'ALL' | 'MALE' | 'FEMALE' = 'ALL'): Promise<Record<string, RangeFlag>> {
  const flags: Record<string, RangeFlag> = {}
  const entries: [keyof typeof VITAL_TEST_NAMES, number | null | undefined][] = [
    ['bpSystolic', vitals.bpSystolic], ['bpDiastolic', vitals.bpDiastolic],
    ['pulseRate', vitals.pulseRate], ['temperatureF', vitals.temperatureF],
  ]
  for (const [key, value] of entries) {
    if (value == null) continue
    const flag = await evaluateAgainstNormalRange(VITAL_TEST_NAMES[key], value, gender)
    if (flag) flags[key] = flag
  }
  return flags
}
