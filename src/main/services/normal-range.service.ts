import { getPrisma } from '../database/db'

// Phase 54B — a single reusable "what's normal for this test" library shared
// by structured vitals (VisitNote) and lab test result parameters
// (LabTestOrderItem.resultParameters) so a doctor/lab saves a normal range
// once instead of re-typing/re-selecting it on every single result.
//
// Phase 58 §2 — species dimension added alongside gender (see schema comment
// on NormalRangeReference): a dog's real body-temperature range is nothing
// like a human's, so Vet Clinic needs its own rows, falling back to the
// generic "ALL" species exactly like gender already falls back to "ALL".

type Gender = 'ALL' | 'MALE' | 'FEMALE'

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
  // Phase 58 §2 — Diagnostic Lab: panic/critical-value thresholds
  criticalLow?: number | null
  criticalHigh?: number | null
  gender?: Gender
  species?: string
  notes?: string | null
}) {
  try {
    const db = getPrisma()
    const testName = payload.testName.trim()
    const gender = payload.gender ?? 'ALL'
    const species = payload.species?.trim() || 'ALL'
    const range = await db.normalRangeReference.upsert({
      where: { testName_gender_species: { testName, gender, species } },
      create: {
        testName, gender, species,
        unit: payload.unit ?? null,
        minValue: payload.minValue ?? null,
        maxValue: payload.maxValue ?? null,
        criticalLow: payload.criticalLow ?? null,
        criticalHigh: payload.criticalHigh ?? null,
        notes: payload.notes ?? null,
      },
      update: {
        unit: payload.unit ?? null,
        minValue: payload.minValue ?? null,
        maxValue: payload.maxValue ?? null,
        criticalLow: payload.criticalLow ?? null,
        criticalHigh: payload.criticalHigh ?? null,
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

// Phase 58 §2 — Diagnostic Lab: CRITICAL is a real panic-value tier, distinct
// from HIGH/LOW — it sits OUTSIDE the normal-abnormal boundary, not at it.
export type RangeFlag = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL'

// Looks up the saved range itself (not just a flag) so a caller can prefill
// a human-readable "90-120 mmHg" reference string. Falls back species-first
// (a species-specific row is the more specific match), then gender, then the
// fully generic ALL/ALL row — same cascading-specificity reasoning
// evaluateAgainstNormalRange already uses for gender alone.
export async function findNormalRange(testName: string, gender: Gender = 'ALL', species: string = 'ALL') {
  const db = getPrisma()
  let range = await db.normalRangeReference.findUnique({ where: { testName_gender_species: { testName, gender, species } } })
  if ((!range || !range.isActive) && species !== 'ALL') {
    range = await db.normalRangeReference.findUnique({ where: { testName_gender_species: { testName, gender, species: 'ALL' } } })
  }
  if ((!range || !range.isActive) && gender !== 'ALL') {
    range = await db.normalRangeReference.findUnique({ where: { testName_gender_species: { testName, gender: 'ALL', species: 'ALL' } } })
  }
  return range && range.isActive ? range : null
}

// Falls back species -> gender -> fully generic, exactly like findNormalRange.
export async function evaluateAgainstNormalRange(
  testName: string, value: number, gender: Gender = 'ALL', species: string = 'ALL'
): Promise<RangeFlag | null> {
  const db = getPrisma()
  const select = { minValue: true, maxValue: true, criticalLow: true, criticalHigh: true, isActive: true } as const
  let range = await db.normalRangeReference.findUnique({ where: { testName_gender_species: { testName, gender, species } }, select })
  if ((!range || !range.isActive) && species !== 'ALL') {
    range = await db.normalRangeReference.findUnique({ where: { testName_gender_species: { testName, gender, species: 'ALL' } }, select })
  }
  if ((!range || !range.isActive) && gender !== 'ALL') {
    range = await db.normalRangeReference.findUnique({ where: { testName_gender_species: { testName, gender: 'ALL', species: 'ALL' } }, select })
  }
  if (!range || !range.isActive || (range.minValue == null && range.maxValue == null)) return null
  // Checked FIRST, before the ordinary LOW/HIGH bounds — a panic value is
  // always also outside the normal range, so it would otherwise just report HIGH/LOW.
  if (range.criticalLow != null && value < range.criticalLow) return 'CRITICAL'
  if (range.criticalHigh != null && value > range.criticalHigh) return 'CRITICAL'
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
// per-type seed map the way ServiceCatalog's starter services do). Phase 58
// §2 adds real Dog/Cat rows for the two vitals that differ meaningfully by
// species (temperature, pulse) — a vet clinic gets working auto-flagging out
// of the box instead of every dog silently being compared against a human's
// 97-99°F range.
// Phase 58 §2 — Diagnostic Lab: real panic-value thresholds on the tests
// where a critical tier is actually clinically meaningful (a lab's "call the
// doctor now" list) — deliberately not added to every row; most tests
// (HbA1c, Total Cholesterol) don't have a recognized acute panic value.
const DEFAULT_RANGES: Array<{ testName: string; unit: string; minValue: number; maxValue: number; criticalLow?: number; criticalHigh?: number; species?: string }> = [
  { testName: 'Blood Pressure - Systolic', unit: 'mmHg', minValue: 90, maxValue: 120, criticalLow: 70, criticalHigh: 180 },
  { testName: 'Blood Pressure - Diastolic', unit: 'mmHg', minValue: 60, maxValue: 80, criticalLow: 40, criticalHigh: 120 },
  { testName: 'Pulse Rate', unit: 'bpm', minValue: 60, maxValue: 100, criticalLow: 40, criticalHigh: 150 },
  { testName: 'Body Temperature', unit: '°F', minValue: 97.0, maxValue: 99.0, criticalLow: 95.0, criticalHigh: 104.0 },
  { testName: 'Fasting Blood Sugar (FBS)', unit: 'mg/dL', minValue: 70, maxValue: 100, criticalLow: 40, criticalHigh: 400 },
  { testName: 'Post Prandial Blood Sugar (PPBS)', unit: 'mg/dL', minValue: 70, maxValue: 140, criticalLow: 40, criticalHigh: 400 },
  { testName: 'HbA1c', unit: '%', minValue: 4, maxValue: 5.6 },
  { testName: 'Total Cholesterol', unit: 'mg/dL', minValue: 125, maxValue: 200 },
  { testName: 'Body Temperature', unit: '°F', minValue: 101.0, maxValue: 102.5, species: 'Dog' },
  { testName: 'Body Temperature', unit: '°F', minValue: 100.5, maxValue: 102.5, species: 'Cat' },
  { testName: 'Pulse Rate', unit: 'bpm', minValue: 70, maxValue: 120, species: 'Dog' },
  { testName: 'Pulse Rate', unit: 'bpm', minValue: 140, maxValue: 220, species: 'Cat' },
]

// Phase 58 §2 fix: this used to bail out entirely if the table had ANY row,
// which meant an install that was already seeded (with only the original
// human-only rows) would never receive newly-added DEFAULT_RANGES entries
// on a later version — e.g. the Dog/Cat rows added in this same phase
// silently never reached any pre-existing database. Upsert per-row instead,
// keyed on the same testName+gender+species uniqueness the table enforces,
// so re-running this on every startup only ever fills gaps, never
// overwrites a value the owner may have since edited.
//
// A second, subtler version of the same class of bug (found live building
// the Diagnostic Lab critical-value tier): `update: {}` fixed missing ROWS
// but does nothing for a NEW FIELD added onto an ALREADY-EXISTING row — the
// FBS row on a real install predates criticalLow/criticalHigh entirely, so
// an empty update left it permanently null even after this function "ran".
// Fixed by explicitly backfilling ONLY the null critical-threshold fields
// on an existing row (never touching minValue/maxValue/notes, which really
// might be an owner's deliberate edit) — a real read-then-conditionally-
// update, not a blind upsert.
export async function seedDefaultNormalRanges(): Promise<void> {
  const db = getPrisma()
  for (const r of DEFAULT_RANGES) {
    const species = r.species ?? 'ALL'
    const where = { testName_gender_species: { testName: r.testName, gender: 'ALL', species } }
    const existing = await db.normalRangeReference.findUnique({ where, select: { criticalLow: true, criticalHigh: true } })
    if (existing) {
      const backfill: Record<string, number> = {}
      if (existing.criticalLow == null && r.criticalLow != null) backfill.criticalLow = r.criticalLow
      if (existing.criticalHigh == null && r.criticalHigh != null) backfill.criticalHigh = r.criticalHigh
      if (Object.keys(backfill).length > 0) {
        await db.normalRangeReference.update({ where, data: backfill })
      }
      continue
    }
    await db.normalRangeReference.create({
      data: { testName: r.testName, unit: r.unit, minValue: r.minValue, maxValue: r.maxValue, criticalLow: r.criticalLow ?? null, criticalHigh: r.criticalHigh ?? null, gender: 'ALL', species },
    })
  }
}

export async function computeVitalsFlags(vitals: {
  bpSystolic?: number | null; bpDiastolic?: number | null
  pulseRate?: number | null; temperatureF?: number | null
}, gender: Gender = 'ALL', species: string = 'ALL'): Promise<Record<string, RangeFlag>> {
  const flags: Record<string, RangeFlag> = {}
  const entries: [keyof typeof VITAL_TEST_NAMES, number | null | undefined][] = [
    ['bpSystolic', vitals.bpSystolic], ['bpDiastolic', vitals.bpDiastolic],
    ['pulseRate', vitals.pulseRate], ['temperatureF', vitals.temperatureF],
  ]
  for (const [key, value] of entries) {
    if (value == null) continue
    const flag = await evaluateAgainstNormalRange(VITAL_TEST_NAMES[key], value, gender, species)
    if (flag) flags[key] = flag
  }
  return flags
}
