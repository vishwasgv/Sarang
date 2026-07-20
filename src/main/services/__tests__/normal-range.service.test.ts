import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))

import { getPrisma } from '../../database/db'
import { evaluateAgainstNormalRange, computeVitalsFlags, seedDefaultNormalRanges } from '../normal-range.service'

function makeDb(ranges: Record<string, { minValue: number | null; maxValue: number | null; isActive: boolean; criticalLow?: number | null; criticalHigh?: number | null }>) {
  return {
    normalRangeReference: {
      findUnique: vi.fn().mockImplementation(({ where }: { where: { testName_gender_species: { testName: string; gender: string; species: string } } }) => {
        const { testName, gender, species } = where.testName_gender_species
        const key = `${testName}|${gender}|${species}`
        return Promise.resolve(ranges[key] ?? null)
      }),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      upsert: vi.fn().mockResolvedValue({}),
    },
  }
}

describe('normal-range.service — evaluateAgainstNormalRange', () => {
  beforeEach(() => vi.clearAllMocks())

  it('flags a value below minValue as LOW', async () => {
    const db = makeDb({ 'Fasting Blood Sugar (FBS)|ALL|ALL': { minValue: 70, maxValue: 100, isActive: true } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const flag = await evaluateAgainstNormalRange('Fasting Blood Sugar (FBS)', 55)

    expect(flag).toBe('LOW')
  })

  it('flags a value above maxValue as HIGH', async () => {
    const db = makeDb({ 'Fasting Blood Sugar (FBS)|ALL|ALL': { minValue: 70, maxValue: 100, isActive: true } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const flag = await evaluateAgainstNormalRange('Fasting Blood Sugar (FBS)', 180)

    expect(flag).toBe('HIGH')
  })

  it('flags a value within range as NORMAL', async () => {
    const db = makeDb({ 'Fasting Blood Sugar (FBS)|ALL|ALL': { minValue: 70, maxValue: 100, isActive: true } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const flag = await evaluateAgainstNormalRange('Fasting Blood Sugar (FBS)', 85)

    expect(flag).toBe('NORMAL')
  })

  it('returns null when no range has been saved for this test', async () => {
    const db = makeDb({})
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const flag = await evaluateAgainstNormalRange('Some Unsaved Test', 42)

    expect(flag).toBeNull()
  })

  it('falls back from a gender-specific lookup to the ALL range when no gender-specific row exists', async () => {
    const db = makeDb({ 'Hemoglobin|ALL|ALL': { minValue: 12, maxValue: 16, isActive: true } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const flag = await evaluateAgainstNormalRange('Hemoglobin', 10, 'FEMALE')

    expect(flag).toBe('LOW')
    expect(db.normalRangeReference.findUnique).toHaveBeenCalledTimes(2)
  })
})

// Phase 58 §2 — Diagnostic Lab: CRITICAL is a real panic-value tier, checked
// BEFORE the ordinary LOW/HIGH bounds since a panic value is always also
// outside the normal range (it would otherwise just report HIGH/LOW).
describe('normal-range.service — Phase 58 §2 critical/panic-value tier (Diagnostic Lab)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('flags a value below criticalLow as CRITICAL, not LOW', async () => {
    const db = makeDb({ 'Fasting Blood Sugar (FBS)|ALL|ALL': { minValue: 70, maxValue: 100, criticalLow: 40, criticalHigh: 400, isActive: true } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const flag = await evaluateAgainstNormalRange('Fasting Blood Sugar (FBS)', 35)

    expect(flag).toBe('CRITICAL')
  })

  it('flags a value above criticalHigh as CRITICAL, not HIGH', async () => {
    const db = makeDb({ 'Fasting Blood Sugar (FBS)|ALL|ALL': { minValue: 70, maxValue: 100, criticalLow: 40, criticalHigh: 400, isActive: true } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const flag = await evaluateAgainstNormalRange('Fasting Blood Sugar (FBS)', 450)

    expect(flag).toBe('CRITICAL')
  })

  it('a value outside the normal range but inside the critical thresholds still reports plain HIGH/LOW', async () => {
    const db = makeDb({ 'Fasting Blood Sugar (FBS)|ALL|ALL': { minValue: 70, maxValue: 100, criticalLow: 40, criticalHigh: 400, isActive: true } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const flag = await evaluateAgainstNormalRange('Fasting Blood Sugar (FBS)', 150)

    expect(flag).toBe('HIGH')
  })

  it('a test with no critical thresholds configured never reports CRITICAL, even far outside the normal range', async () => {
    const db = makeDb({ 'HbA1c|ALL|ALL': { minValue: 4, maxValue: 5.6, isActive: true } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const flag = await evaluateAgainstNormalRange('HbA1c', 20)

    expect(flag).toBe('HIGH')
  })
})

describe('normal-range.service — Phase 58 §2 species fallback (Vet Clinic)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('uses a species-specific range when one exists (a dog\'s real body temperature is nothing like a human\'s)', async () => {
    const db = makeDb({
      'Body Temperature|ALL|ALL': { minValue: 97.0, maxValue: 99.0, isActive: true },
      'Body Temperature|ALL|Dog': { minValue: 101.0, maxValue: 102.5, isActive: true },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    // 101.5°F would be HIGH against the human range but NORMAL for a dog.
    const flag = await evaluateAgainstNormalRange('Body Temperature', 101.5, 'ALL', 'Dog')

    expect(flag).toBe('NORMAL')
  })

  it('falls back species -> generic ALL when no species-specific row exists', async () => {
    const db = makeDb({ 'Pulse Rate|ALL|ALL': { minValue: 60, maxValue: 100, isActive: true } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const flag = await evaluateAgainstNormalRange('Pulse Rate', 150, 'ALL', 'Rabbit')

    expect(flag).toBe('HIGH')
  })

  it('computeVitalsFlags threads species through to every vital lookup', async () => {
    const db = makeDb({
      'Body Temperature|ALL|Dog': { minValue: 101.0, maxValue: 102.5, isActive: true },
      'Pulse Rate|ALL|Dog': { minValue: 70, maxValue: 120, isActive: true },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const flags = await computeVitalsFlags({ temperatureF: 103, pulseRate: 90, bpSystolic: null, bpDiastolic: null }, 'ALL', 'Dog')

    expect(flags).toEqual({ temperatureF: 'HIGH', pulseRate: 'NORMAL' })
  })
})

describe('normal-range.service — computeVitalsFlags', () => {
  beforeEach(() => vi.clearAllMocks())

  it('computes a flag per vital and omits vitals that were not provided', async () => {
    const db = makeDb({
      'Blood Pressure - Systolic|ALL|ALL': { minValue: 90, maxValue: 120, isActive: true },
      'Blood Pressure - Diastolic|ALL|ALL': { minValue: 60, maxValue: 80, isActive: true },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const flags = await computeVitalsFlags({ bpSystolic: 150, bpDiastolic: 70, pulseRate: null, temperatureF: null })

    expect(flags).toEqual({ bpSystolic: 'HIGH', bpDiastolic: 'NORMAL' })
  })

  it('returns an empty object when no vitals are provided', async () => {
    const db = makeDb({})
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const flags = await computeVitalsFlags({})

    expect(flags).toEqual({})
  })
})

describe('normal-range.service — seedDefaultNormalRanges', () => {
  beforeEach(() => vi.clearAllMocks())

  // Phase 58 §2 fix: this used to bail out entirely once the table had ANY
  // row, which meant an already-seeded install (with only the original
  // human-only rows) would never receive newly-added DEFAULT_RANGES entries
  // shipped in a later version — the Dog/Cat rows added in this same phase
  // silently never reached any pre-existing database. Rewritten to upsert
  // per-row (keyed on the same testName+gender+species uniqueness the table
  // enforces) so it only ever fills gaps, tolerating a partially-seeded
  // table instead of requiring an all-or-nothing empty one.

  it('creates every default range on a fresh table, keyed on testName+gender+species', async () => {
    const db = makeDb({})
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await seedDefaultNormalRanges()

    expect(db.normalRangeReference.create).toHaveBeenCalled()
    const calledWithSystolic = vi.mocked(db.normalRangeReference.create).mock.calls.some(
      (args) => (args[0] as { data: { testName: string } }).data.testName === 'Blood Pressure - Systolic'
    )
    expect(calledWithSystolic).toBe(true)
  })

  it('never touches an existing row\'s minValue/maxValue (a value the owner may have since edited)', async () => {
    const db = makeDb({ 'Blood Pressure - Systolic|ALL|ALL': { minValue: 95, maxValue: 125, isActive: true, criticalLow: 70, criticalHigh: 180 } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await seedDefaultNormalRanges()

    // Already has both critical thresholds set — nothing to backfill, so no write at all for this row.
    const updatedSystolic = vi.mocked(db.normalRangeReference.update).mock.calls.some(
      (args) => (args[0] as { where: { testName_gender_species: { testName: string } } }).where.testName_gender_species.testName === 'Blood Pressure - Systolic'
    )
    expect(updatedSystolic).toBe(false)
  })

  it('seeds real Dog/Cat species-specific rows for temperature and pulse (Phase 58 §2)', async () => {
    const db = makeDb({})
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await seedDefaultNormalRanges()

    const dogTemp = vi.mocked(db.normalRangeReference.create).mock.calls.find(
      (args) => (args[0] as { data: { testName: string; species: string } }).data.testName === 'Body Temperature' && (args[0] as { data: { species: string } }).data.species === 'Dog'
    )
    expect(dogTemp).toBeDefined()
    const humanTemp = vi.mocked(db.normalRangeReference.create).mock.calls.find(
      (args) => (args[0] as { data: { testName: string; species: string } }).data.testName === 'Body Temperature' && (args[0] as { data: { species: string } }).data.species === 'ALL'
    )
    expect(humanTemp).toBeDefined()
  })

  it('seeds real critical/panic-value thresholds for FBS on a fresh table (Phase 58 §2)', async () => {
    const db = makeDb({})
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await seedDefaultNormalRanges()

    const fbs = vi.mocked(db.normalRangeReference.create).mock.calls.find(
      (args) => (args[0] as { data: { testName: string } }).data.testName === 'Fasting Blood Sugar (FBS)'
    )
    expect(fbs).toBeDefined()
    expect((fbs![0] as { data: { criticalLow: number; criticalHigh: number } }).data.criticalLow).toBe(40)
    expect((fbs![0] as { data: { criticalLow: number; criticalHigh: number } }).data.criticalHigh).toBe(400)

    // A test with no recognized panic value (HbA1c) must not get a spurious one.
    const hba1c = vi.mocked(db.normalRangeReference.create).mock.calls.find(
      (args) => (args[0] as { data: { testName: string } }).data.testName === 'HbA1c'
    )
    expect((hba1c![0] as { data: { criticalLow: number | null } }).data.criticalLow).toBeNull()
  })

  // Real bug found live building this feature: a plain upsert's `update: {}`
  // fixes missing ROWS but does nothing for a NEW FIELD added onto an
  // ALREADY-EXISTING row — an install's FBS row predates criticalLow/High
  // entirely, so it stayed permanently null even after this function "ran".
  it('backfills ONLY the null critical thresholds on an already-existing row, never touching minValue/maxValue', async () => {
    const db = makeDb({ 'Fasting Blood Sugar (FBS)|ALL|ALL': { minValue: 70, maxValue: 100, isActive: true, criticalLow: null, criticalHigh: null } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await seedDefaultNormalRanges()

    expect(db.normalRangeReference.create).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ testName: 'Fasting Blood Sugar (FBS)' }) })
    )
    expect(db.normalRangeReference.update).toHaveBeenCalledWith({
      where: { testName_gender_species: { testName: 'Fasting Blood Sugar (FBS)', gender: 'ALL', species: 'ALL' } },
      data: { criticalLow: 40, criticalHigh: 400 },
    })
  })

  it('leaves a partially-backfilled row\'s already-set critical threshold alone, only filling the still-null one', async () => {
    // Owner manually set criticalHigh to something custom; criticalLow is
    // still the pre-existing null. Only criticalLow should be backfilled.
    const db = makeDb({ 'Fasting Blood Sugar (FBS)|ALL|ALL': { minValue: 70, maxValue: 100, isActive: true, criticalLow: null, criticalHigh: 350 } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await seedDefaultNormalRanges()

    expect(db.normalRangeReference.update).toHaveBeenCalledWith({
      where: { testName_gender_species: { testName: 'Fasting Blood Sugar (FBS)', gender: 'ALL', species: 'ALL' } },
      data: { criticalLow: 40 },
    })
  })
})
