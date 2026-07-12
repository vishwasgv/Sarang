import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))

import { getPrisma } from '../../database/db'
import { listMeasurementRecords, getMeasurementRecord, createMeasurementRecord, updateMeasurementRecord } from '../measurement-record.service'

// Regression coverage for the Phase 33 re-audit finding: MeasurementRecord
// has TEN Prisma Decimal fields (chest, waist, hips, shoulder, neck,
// sleeve, inseam, outseam, thigh, height) — the most Decimal-dense single
// record in the whole series — returned unserialized by every function
// below. Electron's IPC can't serialize a Decimal instance and throws "An
// object could not be cloned". This service wasn't even mentioned in the
// original completion report's file inventory despite being fully
// implemented and wired. Live-verified: creating a record with real
// measurements crashed (row silently written to the DB anyway), and
// listMeasurementRecords() then also crashed with that real row present.

class FakeDecimal {
  constructor(private value: number) {}
  toString() { return String(this.value) }
  valueOf() { return this.value }
}

function makeRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'mr-1', clientId: 'cust-1',
    chest: new FakeDecimal(40.5) as unknown as number,
    waist: new FakeDecimal(34) as unknown as number,
    hips: new FakeDecimal(38) as unknown as number,
    shoulder: new FakeDecimal(18) as unknown as number,
    neck: new FakeDecimal(16) as unknown as number,
    sleeve: new FakeDecimal(25) as unknown as number,
    inseam: new FakeDecimal(32) as unknown as number,
    outseam: new FakeDecimal(42) as unknown as number,
    thigh: new FakeDecimal(24) as unknown as number,
    height: new FakeDecimal(70) as unknown as number,
    notes: null, takenById: null, recordDate: new Date(), createdAt: new Date(), updatedAt: new Date(),
    takenBy: null,
    ...overrides,
  }
}

function makeMockDb(existing: ReturnType<typeof makeRecord> | null = null) {
  const db: Record<string, any> = {
    measurementRecord: {
      findMany: vi.fn().mockResolvedValue(existing ? [existing] : []),
      findUnique: vi.fn().mockResolvedValue(existing),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(makeRecord({ id: 'mr-new', ...data }))
      ),
      update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(makeRecord({ ...existing, ...data }))
      ),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  }
  return db
}

describe('measurement-record.service — Decimal serialization', () => {
  beforeEach(() => vi.clearAllMocks())

  it('createMeasurementRecord returns all 10 measurement fields as plain numbers', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createMeasurementRecord({
      clientId: 'cust-1', chest: 40.5, waist: 34, hips: 38, shoulder: 18, neck: 16,
      sleeve: 25, inseam: 32, outseam: 42, thigh: 24, height: 70,
    })

    expect(res.success).toBe(true)
    const data = (res as { data: Record<string, unknown> }).data
    for (const key of ['chest', 'waist', 'hips', 'shoulder', 'neck', 'sleeve', 'inseam', 'outseam', 'thigh', 'height']) {
      expect(typeof data[key]).toBe('number')
    }
  })

  it('createMeasurementRecord returns unset fields as null, not Decimals', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    db.measurementRecord.create = vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve(makeRecord({ id: 'mr-new', ...data, chest: null, waist: null }))
    )

    const res = await createMeasurementRecord({ clientId: 'cust-1', hips: 38 })

    expect(res.success).toBe(true)
    const data = (res as { data: { chest: unknown; waist: unknown } }).data
    expect(data.chest).toBeNull()
    expect(data.waist).toBeNull()
  })

  it('listMeasurementRecords returns chest/height as plain numbers, not Decimal instances', async () => {
    const db = makeMockDb(makeRecord())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await listMeasurementRecords('cust-1')

    expect(res.success).toBe(true)
    const record = (res as { data: Array<{ chest: unknown; height: unknown }> }).data[0]
    expect(typeof record.chest).toBe('number')
    expect(typeof record.height).toBe('number')
  })

  it('getMeasurementRecord returns waist as a plain number', async () => {
    const db = makeMockDb(makeRecord())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getMeasurementRecord('mr-1')

    expect(res.success).toBe(true)
    expect(typeof (res as { data: { waist: unknown } }).data.waist).toBe('number')
  })

  it('updateMeasurementRecord returns sleeve as a plain number', async () => {
    const db = makeMockDb(makeRecord())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateMeasurementRecord({ id: 'mr-1', sleeve: 26 })

    expect(res.success).toBe(true)
    expect(typeof (res as { data: { sleeve: unknown } }).data.sleeve).toBe('number')
  })
})

describe('measurement-record.service — Phase 48 blouse/shirt fields', () => {
  beforeEach(() => vi.clearAllMocks())

  const NEW_FIELDS = ['armhole', 'frontNeckDepth', 'backNeckDepth', 'garmentLength', 'cuff']

  it('createMeasurementRecord returns all 5 new fields as plain numbers', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createMeasurementRecord({
      clientId: 'cust-1', armhole: 8.5, frontNeckDepth: 3, backNeckDepth: 1.5, garmentLength: 15, cuff: 6,
    })

    expect(res.success).toBe(true)
    const data = (res as { data: Record<string, unknown> }).data
    for (const key of NEW_FIELDS) expect(typeof data[key]).toBe('number')
  })

  it('createMeasurementRecord returns unset new fields as null, not Decimals', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createMeasurementRecord({ clientId: 'cust-1', chest: 40 })

    expect(res.success).toBe(true)
    const data = (res as { data: Record<string, unknown> }).data
    for (const key of NEW_FIELDS) expect(data[key]).toBeNull()
  })

  it('updateMeasurementRecord accepts and serializes the 5 new fields', async () => {
    const db = makeMockDb(makeRecord())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateMeasurementRecord({ id: 'mr-1', armhole: 9, cuff: 6.5 })

    expect(res.success).toBe(true)
    const data = (res as { data: Record<string, unknown> }).data
    expect(typeof data.armhole).toBe('number')
    expect(typeof data.cuff).toBe('number')
  })
})
