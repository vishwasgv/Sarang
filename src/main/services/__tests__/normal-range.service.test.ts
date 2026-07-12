import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))

import { getPrisma } from '../../database/db'
import { evaluateAgainstNormalRange, computeVitalsFlags, seedDefaultNormalRanges } from '../normal-range.service'

function makeDb(ranges: Record<string, { minValue: number | null; maxValue: number | null; isActive: boolean }>) {
  return {
    normalRangeReference: {
      findUnique: vi.fn().mockImplementation(({ where }: { where: { testName_gender: { testName: string; gender: string } } }) => {
        const key = `${where.testName_gender.testName}|${where.testName_gender.gender}`
        return Promise.resolve(ranges[key] ?? null)
      }),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({}),
    },
  }
}

describe('normal-range.service — evaluateAgainstNormalRange', () => {
  beforeEach(() => vi.clearAllMocks())

  it('flags a value below minValue as LOW', async () => {
    const db = makeDb({ 'Fasting Blood Sugar (FBS)|ALL': { minValue: 70, maxValue: 100, isActive: true } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const flag = await evaluateAgainstNormalRange('Fasting Blood Sugar (FBS)', 55)

    expect(flag).toBe('LOW')
  })

  it('flags a value above maxValue as HIGH', async () => {
    const db = makeDb({ 'Fasting Blood Sugar (FBS)|ALL': { minValue: 70, maxValue: 100, isActive: true } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const flag = await evaluateAgainstNormalRange('Fasting Blood Sugar (FBS)', 180)

    expect(flag).toBe('HIGH')
  })

  it('flags a value within range as NORMAL', async () => {
    const db = makeDb({ 'Fasting Blood Sugar (FBS)|ALL': { minValue: 70, maxValue: 100, isActive: true } })
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
    const db = makeDb({ 'Hemoglobin|ALL': { minValue: 12, maxValue: 16, isActive: true } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const flag = await evaluateAgainstNormalRange('Hemoglobin', 10, 'FEMALE')

    expect(flag).toBe('LOW')
    expect(db.normalRangeReference.findUnique).toHaveBeenCalledTimes(2)
  })
})

describe('normal-range.service — computeVitalsFlags', () => {
  beforeEach(() => vi.clearAllMocks())

  it('computes a flag per vital and omits vitals that were not provided', async () => {
    const db = makeDb({
      'Blood Pressure - Systolic|ALL': { minValue: 90, maxValue: 120, isActive: true },
      'Blood Pressure - Diastolic|ALL': { minValue: 60, maxValue: 80, isActive: true },
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

  it('does not reseed when ranges already exist', async () => {
    const db = makeDb({})
    db.normalRangeReference.count = vi.fn().mockResolvedValue(4)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await seedDefaultNormalRanges()

    expect(db.normalRangeReference.create).not.toHaveBeenCalled()
  })

  it('seeds the default vitals/lab ranges on a fresh table', async () => {
    const db = makeDb({})
    db.normalRangeReference.count = vi.fn().mockResolvedValue(0)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await seedDefaultNormalRanges()

    expect(db.normalRangeReference.create).toHaveBeenCalled()
    const calledWithSystolic = vi.mocked(db.normalRangeReference.create).mock.calls.some(
      (args) => (args[0] as { data: { testName: string } }).data.testName === 'Blood Pressure - Systolic'
    )
    expect(calledWithSystolic).toBe(true)
  })
})
