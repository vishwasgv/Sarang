import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn().mockResolvedValue(undefined) }))

import { getPrisma } from '../../database/db'
import {
  listSiteVisits, createSiteVisit, updateSiteVisit, deleteSiteVisit,
  listMaterialTestResults, addMaterialTestResult, updateMaterialTestResult, deleteMaterialTestResult,
} from '../site-visit.service'

function makeVisit(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sv-1', projectId: 'proj-1', visitDate: new Date(), visitType: 'INSPECTION',
    findings: null, weatherConditions: null, recordedById: null,
    latitude: null, longitude: null, locationAccuracy: null,
    createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  }
}

function makeTestResult(overrides: Record<string, unknown> = {}) {
  return {
    id: 'mtr-1', siteVisitId: 'sv-1', testType: 'CONCRETE_CUBE_STRENGTH', materialDescription: null,
    testValue: null, unit: null, requiredMinValue: null, result: 'PENDING',
    testedDate: null, notes: null, createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  }
}

function makeMockDb(visit: ReturnType<typeof makeVisit> | null = makeVisit(), testResult: ReturnType<typeof makeTestResult> | null = makeTestResult()) {
  const db: Record<string, any> = {
    siteVisit: {
      findMany: vi.fn().mockResolvedValue(visit ? [visit] : []),
      findUnique: vi.fn().mockResolvedValue(visit),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve(makeVisit({ id: 'sv-new', ...data }))),
      update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve(makeVisit({ ...visit, ...data }))),
      delete: vi.fn().mockResolvedValue({}),
    },
    materialTestResult: {
      findMany: vi.fn().mockResolvedValue(testResult ? [testResult] : []),
      findUnique: vi.fn().mockResolvedValue(testResult),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve(makeTestResult({ id: 'mtr-new', ...data }))),
      update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve(makeTestResult({ ...testResult, ...data }))),
      delete: vi.fn().mockResolvedValue({}),
    },
  }
  return db
}

describe('site-visit.service — basic CRUD + GPS fields', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lists visits for a project', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await listSiteVisits('proj-1')
    expect(res.success).toBe(true)
  })

  it('rejects a visit with no visit date', async () => {
    const res = await createSiteVisit({ projectId: 'proj-1', visitDate: '' })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('SV-002')
  })

  it('persists real GPS coordinates and accuracy on create', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createSiteVisit({ projectId: 'proj-1', visitDate: '2026-07-20', latitude: 18.5204, longitude: 73.8567, locationAccuracy: 12.5 })

    expect(res.success).toBe(true)
    expect(db.siteVisit.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ latitude: 18.5204, longitude: 73.8567, locationAccuracy: 12.5 }),
    }))
  })

  it('creates a visit with no GPS data — never fabricates coordinates', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createSiteVisit({ projectId: 'proj-1', visitDate: '2026-07-20' })

    expect(res.success).toBe(true)
    expect(db.siteVisit.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ latitude: null, longitude: null, locationAccuracy: null }),
    }))
  })

  it('deletes a visit', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await deleteSiteVisit('sv-1')
    expect(res.success).toBe(true)
  })
})

// Phase 58 §2 — Civil Engineer: structured material-test-result fields
// (value + pass/fail), auto-computed only from a well-defined >= threshold.

describe('site-visit.service.addMaterialTestResult', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects a blank test type', async () => {
    const res = await addMaterialTestResult({ siteVisitId: 'sv-1', testType: '  ' })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('MTR-002')
  })

  it('rejects a missing site visit', async () => {
    const db = makeMockDb(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await addMaterialTestResult({ siteVisitId: 'missing', testType: 'SLUMP_TEST' })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('MTR-003')
  })

  it('stays PENDING when neither testValue nor requiredMinValue is given', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await addMaterialTestResult({ siteVisitId: 'sv-1', testType: 'SLUMP_TEST' })

    expect(res.success).toBe(true)
    expect(db.materialTestResult.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ result: 'PENDING' }),
    }))
  })

  it('stays PENDING when only testValue is given (no threshold to compare against)', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await addMaterialTestResult({ siteVisitId: 'sv-1', testType: 'CONCRETE_CUBE_STRENGTH', testValue: 30 })

    expect(res.success).toBe(true)
    expect(db.materialTestResult.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ result: 'PENDING' }),
    }))
  })

  it('computes PASS when testValue meets the required minimum', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await addMaterialTestResult({ siteVisitId: 'sv-1', testType: 'CONCRETE_CUBE_STRENGTH', testValue: 30, requiredMinValue: 25, unit: 'MPa' })

    expect(res.success).toBe(true)
    expect(db.materialTestResult.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ result: 'PASS', testValue: 30, requiredMinValue: 25 }),
    }))
  })

  it('computes FAIL when testValue is below the required minimum', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await addMaterialTestResult({ siteVisitId: 'sv-1', testType: 'CONCRETE_CUBE_STRENGTH', testValue: 18, requiredMinValue: 25 })

    expect(res.success).toBe(true)
    expect(db.materialTestResult.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ result: 'FAIL' }),
    }))
  })

  it('treats testValue exactly equal to requiredMinValue as PASS (>=, not >)', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await addMaterialTestResult({ siteVisitId: 'sv-1', testType: 'CONCRETE_CUBE_STRENGTH', testValue: 25, requiredMinValue: 25 })

    expect(res.success).toBe(true)
    expect(db.materialTestResult.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ result: 'PASS' }),
    }))
  })
})

describe('site-visit.service.updateMaterialTestResult', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects a missing test result', async () => {
    const db = makeMockDb(makeVisit(), null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateMaterialTestResult({ id: 'missing' })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('MTR-003')
  })

  it('recomputes result when testValue is updated against an existing threshold', async () => {
    const db = makeMockDb(makeVisit(), makeTestResult({ testValue: 18, requiredMinValue: 25, result: 'FAIL' }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateMaterialTestResult({ id: 'mtr-1', testValue: 30 })

    expect(res.success).toBe(true)
    expect(db.materialTestResult.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ result: 'PASS' }),
    }))
  })

  it('honors an explicit result override instead of recomputing', async () => {
    const db = makeMockDb(makeVisit(), makeTestResult({ testValue: 30, requiredMinValue: 25, result: 'PASS' }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateMaterialTestResult({ id: 'mtr-1', result: 'FAIL', notes: 'Retest required — sample contamination suspected' })

    expect(res.success).toBe(true)
    expect(db.materialTestResult.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ result: 'FAIL' }),
    }))
  })
})

describe('site-visit.service — material test result list/delete', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lists test results for a site visit', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await listMaterialTestResults('sv-1')
    expect(res.success).toBe(true)
  })

  it('deletes a test result', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await deleteMaterialTestResult('mtr-1')
    expect(res.success).toBe(true)
  })
})
