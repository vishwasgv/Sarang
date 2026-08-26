import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../billing.service', () => ({ billingService: { createInvoice: vi.fn() } }))

import { getPrisma } from '../../database/db'
import { billingService } from '../billing.service'
import {
  listSiteVisits, createSiteVisit, updateSiteVisit, deleteSiteVisit,
  listMaterialTestResults, addMaterialTestResult, updateMaterialTestResult, deleteMaterialTestResult,
  generateSiteVisitInvoice,
} from '../site-visit.service'

function makeVisit(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sv-1', projectId: 'proj-1', visitDate: new Date(), visitType: 'INSPECTION',
    findings: null, weatherConditions: null, recordedById: null,
    latitude: null, longitude: null, locationAccuracy: null,
    billableAmount: null, invoiceId: null,
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

  // Real bug found live (2026-08-27 Phase 68 audit): a bare
  // `new Date('YYYY-MM-DD')` parses as UTC midnight — inconsistent with
  // this app's own parseLocalDateStart convention used everywhere else.
  it('createSiteVisit stores visitDate at local midnight, not UTC midnight', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await createSiteVisit({ projectId: 'proj-1', visitDate: '2026-08-15' })

    expect(db.siteVisit.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ visitDate: new Date(2026, 7, 15) }),
    }))
  })

  it('updateSiteVisit stores an updated visitDate at local midnight too', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await updateSiteVisit({ id: 'sv-1', visitDate: '2026-09-01' })

    expect(db.siteVisit.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ visitDate: new Date(2026, 8, 1) }),
    }))
  })

  it('persists a billableAmount on create and serializes it as a plain number', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createSiteVisit({ projectId: 'proj-1', visitDate: '2026-08-15', billableAmount: 2500 })

    expect(res.success).toBe(true)
    expect(db.siteVisit.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ billableAmount: 2500 }) }))
    expect(typeof (res as { data: { billableAmount: unknown } }).data.billableAmount).toBe('number')
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

  it('addMaterialTestResult stores testedDate at local midnight, not UTC midnight', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await addMaterialTestResult({ siteVisitId: 'sv-1', testType: 'SLUMP_TEST', testedDate: '2026-08-15' })

    expect(db.materialTestResult.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ testedDate: new Date(2026, 7, 15) }),
    }))
  })

  it('updateMaterialTestResult stores an updated testedDate at local midnight too', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await updateMaterialTestResult({ id: 'mtr-1', testedDate: '2026-09-01' })

    expect(db.materialTestResult.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ testedDate: new Date(2026, 8, 1) }),
    }))
  })
})

// Phase 68 §9.1 — Civil Engineer item 1: site-visit-to-invoice linkage.
// Same atomic-claim-sentinel pattern as service-project-milestone.service.ts's
// generateMilestoneInvoice — mirrors that file's own test shape.

function makeVisitWithProject(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sv-1', visitType: 'INSPECTION', billableAmount: 2500, invoiceId: null,
    project: { id: 'proj-1', clientId: 'client-1', projectName: 'Highway Widening' },
    ...overrides,
  }
}

function makeInvoiceMockDb(visit: ReturnType<typeof makeVisitWithProject> | null) {
  const canClaim = !!visit && !visit.invoiceId
  return {
    siteVisit: {
      updateMany: vi.fn().mockResolvedValue({ count: canClaim ? 1 : 0 }),
      findUnique: vi.fn().mockResolvedValue(visit),
      update: vi.fn().mockResolvedValue({}),
    },
    product: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'product-1', hsnCode: '998311' }),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  }
}

describe('site-visit.service.generateSiteVisitInvoice', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects a missing site visit', async () => {
    const db = makeInvoiceMockDb(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateSiteVisitInvoice('sv-missing')
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('SV-006')
  })

  it('rejects a visit that already has an invoice', async () => {
    const db = makeInvoiceMockDb(makeVisitWithProject({ invoiceId: 'invoice-existing' }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateSiteVisitInvoice('sv-1')
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('SV-007')
  })

  it('rejects a visit with no billable amount set', async () => {
    const db = makeInvoiceMockDb(makeVisitWithProject({ billableAmount: null }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateSiteVisitInvoice('sv-1')
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('SV-008')
  })

  it('generates an invoice and links it back to the site visit', async () => {
    const db = makeInvoiceMockDb(makeVisitWithProject())
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: true, data: { id: 'invoice-1' } } as never)

    const res = await generateSiteVisitInvoice('sv-1')

    expect(res.success).toBe(true)
    expect((res as { data: { invoiceId: string } }).data.invoiceId).toBe('invoice-1')
    expect(billingService.createInvoice).toHaveBeenCalledWith(expect.objectContaining({
      customerId: 'client-1',
      items: [expect.objectContaining({ productId: 'product-1', unitPrice: 2500 })],
    }))
    expect(db.siteVisit.update).toHaveBeenCalledWith({ where: { id: 'sv-1' }, data: { invoiceId: 'invoice-1' } })
  })

  it('propagates a billing failure without linking an invoice, and releases the claim', async () => {
    const db = makeInvoiceMockDb(makeVisitWithProject())
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: false, error: { code: 'BILL-001', message: 'failed' } } as never)

    const res = await generateSiteVisitInvoice('sv-1')

    expect(res.success).toBe(false)
    expect(db.siteVisit.update).toHaveBeenCalledWith({ where: { id: 'sv-1' }, data: { invoiceId: null } })
  })

  it('rejects and releases the claim when a concurrent call wins the race', async () => {
    const db = makeInvoiceMockDb(makeVisitWithProject())
    db.siteVisit.updateMany = vi.fn().mockResolvedValueOnce({ count: 0 })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateSiteVisitInvoice('sv-1')

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('SV-007')
    expect(billingService.createInvoice).not.toHaveBeenCalled()
  })
})
