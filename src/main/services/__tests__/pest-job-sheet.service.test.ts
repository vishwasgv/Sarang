import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../billing.service', () => ({ billingService: { createInvoice: vi.fn() } }))
vi.mock('../inventory.service', () => ({ inventoryService: { reduceStockTx: vi.fn() } }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))

import { getPrisma } from '../../database/db'
import { inventoryService } from '../inventory.service'
import {
  listPestJobSheets, createPestJobSheet, updatePestJobSheet,
  listJobSheetPesticides, addJobSheetPesticide, removeJobSheetPesticide,
} from '../pest-job-sheet.service'
import { ServiceError } from '../../errors/service-error'

// Regression coverage for the Phase 33 re-audit finding: PestJobSheet.
// jobAmount is a Prisma Decimal field, returned unserialized by every
// function below. Electron's IPC can't serialize a Decimal instance and
// throws "An object could not be cloned". serializePestJobSheet is also
// exported and reused by pest-contract.service.ts to serialize jobSheets[]
// nested under a contract — covered separately in
// pest-contract.service.test.ts.

class FakeDecimal {
  constructor(private value: number) {}
  toString() { return String(this.value) }
  valueOf() { return this.value }
}

function makeSheet(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pjs-1', jobNumber: 'PJS-00001', contractId: 'pct-1', clientId: 'cust-1',
    visitDate: new Date(), scheduledTime: null, technicianIds: '[]', pesticideUsed: null,
    areasServiced: '[]', treatmentType: 'SPRAY',
    jobAmount: new FakeDecimal(1500) as unknown as number,
    status: 'SCHEDULED', completedDate: null, followUpDate: null, clientSignature: false,
    invoiceId: null, notes: null, createdAt: new Date(), updatedAt: new Date(),
    contract: { id: 'pct-1', contractNumber: 'PCT-00001', propertyAddress: 'Test Address' },
    client: { id: 'cust-1', customerName: 'Ramesh Kumar', phone: null },
    ...overrides,
  }
}

function makeContract(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pct-1', contractNumber: 'PCT-00001', clientId: 'cust-1',
    serviceFrequency: 'QUARTERLY', status: 'ACTIVE', endDate: null,
    ...overrides,
  }
}

function makeMockDb(existing: ReturnType<typeof makeSheet> | null = null, contract: ReturnType<typeof makeContract> | null = makeContract()) {
  let settingRow: { settingKey: string; settingValue: string } | null = null
  const db: Record<string, any> = {
    pestJobSheet: {
      findMany: vi.fn().mockResolvedValue(existing ? [existing] : []),
      findFirst: vi.fn().mockResolvedValue(existing),
      findUnique: vi.fn().mockResolvedValue(existing),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(makeSheet({ id: 'pjs-new', ...data }))
      ),
      update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(makeSheet({ ...existing, ...data }))
      ),
    },
    pestServiceContract: {
      findUnique: vi.fn().mockResolvedValue(contract),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
    setting: {
      findUnique: vi.fn(async () => settingRow),
      updateMany: vi.fn(async ({ where, data }: { where: { settingValue: string }; data: { settingValue: string } }) => {
        if (!settingRow || settingRow.settingValue !== where.settingValue) return { count: 0 }
        settingRow = { ...settingRow, settingValue: data.settingValue }
        return { count: 1 }
      }),
      create: vi.fn(async ({ data }: { data: { settingKey: string; settingValue: string } }) => {
        settingRow = { settingKey: data.settingKey, settingValue: data.settingValue }
        return settingRow
      }),
    },
  }
  db.$transaction = vi.fn(async (cb: (tx: unknown) => unknown) => cb(db))
  return db
}

describe('pest-job-sheet.service — Decimal serialization', () => {
  beforeEach(() => vi.clearAllMocks())

  it('createPestJobSheet returns jobAmount as a plain number', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createPestJobSheet({ contractId: 'pct-1', clientId: 'cust-1', visitDate: '2026-07-01', jobAmount: 1500 })

    expect(res.success).toBe(true)
    expect(typeof (res as { data: { jobAmount: unknown } }).data.jobAmount).toBe('number')
  })

  it('listPestJobSheets returns jobAmount as a plain number, not a Decimal instance', async () => {
    const db = makeMockDb(makeSheet())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await listPestJobSheets({})

    expect(res.success).toBe(true)
    expect(typeof (res as { data: Array<{ jobAmount: unknown }> }).data[0].jobAmount).toBe('number')
  })

  it('updatePestJobSheet returns jobAmount as a plain number', async () => {
    const db = makeMockDb(makeSheet())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updatePestJobSheet({ id: 'pjs-1', jobAmount: 2000 })

    expect(res.success).toBe(true)
    expect(typeof (res as { data: { jobAmount: unknown } }).data.jobAmount).toBe('number')
  })
})

describe('pest-job-sheet.service — AMC auto-scheduling of the next visit (F.10)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('auto-creates the next visit, 3 months out, when a QUARTERLY-contract job sheet is marked COMPLETED', async () => {
    const visitDate = new Date('2026-07-01T00:00:00Z')
    const db = makeMockDb(makeSheet({ status: 'SCHEDULED', visitDate }), makeContract({ serviceFrequency: 'QUARTERLY' }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updatePestJobSheet({ id: 'pjs-1', status: 'COMPLETED' })

    expect(res.success).toBe(true)
    expect(db.pestJobSheet.create).toHaveBeenCalledTimes(1)
    const created = db.pestJobSheet.create.mock.calls[0][0].data
    expect(created.contractId).toBe('pct-1')
    expect(created.status).toBe('SCHEDULED')
    expect(new Date(created.visitDate).toISOString()).toBe('2026-10-01T00:00:00.000Z')
  })

  it('does not re-trigger auto-scheduling if the job sheet was already COMPLETED (no-op re-save)', async () => {
    const db = makeMockDb(makeSheet({ status: 'COMPLETED' }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updatePestJobSheet({ id: 'pjs-1', status: 'COMPLETED', notes: 'edited note' })

    expect(res.success).toBe(true)
    expect(db.pestJobSheet.create).not.toHaveBeenCalled()
  })

  it('does not schedule a next visit for an ad-hoc job sheet with no linked contract', async () => {
    const db = makeMockDb(makeSheet({ status: 'SCHEDULED', contractId: null }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updatePestJobSheet({ id: 'pjs-1', status: 'COMPLETED' })

    expect(res.success).toBe(true)
    expect(db.pestServiceContract.findUnique).not.toHaveBeenCalled()
    expect(db.pestJobSheet.create).not.toHaveBeenCalled()
  })

  it('does not schedule a next visit for a ONE_TIME contract', async () => {
    const db = makeMockDb(makeSheet({ status: 'SCHEDULED' }), makeContract({ serviceFrequency: 'ONE_TIME' }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updatePestJobSheet({ id: 'pjs-1', status: 'COMPLETED' })

    expect(res.success).toBe(true)
    expect(db.pestJobSheet.create).not.toHaveBeenCalled()
  })

  it('does not schedule a next visit for a non-ACTIVE contract (e.g. CANCELLED)', async () => {
    const db = makeMockDb(makeSheet({ status: 'SCHEDULED' }), makeContract({ status: 'CANCELLED' }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updatePestJobSheet({ id: 'pjs-1', status: 'COMPLETED' })

    expect(res.success).toBe(true)
    expect(db.pestJobSheet.create).not.toHaveBeenCalled()
  })

  it('does not schedule a next visit that would fall after the contract end date', async () => {
    const visitDate = new Date('2026-07-01T00:00:00Z')
    const endDate = new Date('2026-08-01T00:00:00Z') // before the +3 month QUARTERLY next-visit date
    const db = makeMockDb(makeSheet({ status: 'SCHEDULED', visitDate }), makeContract({ serviceFrequency: 'QUARTERLY', endDate }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updatePestJobSheet({ id: 'pjs-1', status: 'COMPLETED' })

    expect(res.success).toBe(true)
    expect(db.pestJobSheet.create).not.toHaveBeenCalled()
  })
})

// Phase 58 §2 — Pest Control: structured pesticide dosage/quantity per
// visit (add/remove ledger, mirrors Repair's JobCardPart), replacing the
// single free-text pesticideUsed field for anything needing a real quantity.

function makePesticideLine(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pjp-1', jobSheetId: 'pjs-1', productId: null, pesticideName: 'Cypermethrin 25 EC',
    quantityUsed: 50, unit: 'ML', dosageNote: null, targetPest: null, createdAt: new Date(),
    product: null,
    ...overrides,
  }
}

function makePesticideMockDb(sheet: Record<string, unknown> | null, line: Record<string, unknown> | null = null) {
  const db: Record<string, any> = {
    pestJobSheet: {
      findUnique: vi.fn().mockResolvedValue(sheet),
    },
    pestJobSheetPesticide: {
      findMany: vi.fn().mockResolvedValue(line ? [line] : []),
      findUnique: vi.fn().mockResolvedValue(line),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(makePesticideLine({ ...data, product: data.productId ? { productName: 'Cypermethrin 25 EC' } : null }))
      ),
      delete: vi.fn().mockResolvedValue({}),
    },
    product: { findUnique: vi.fn().mockResolvedValue({ id: 'prod-1' }) },
    inventory: { update: vi.fn().mockResolvedValue({}) },
    inventoryMovement: { create: vi.fn().mockResolvedValue({}) },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  }
  db.$transaction = vi.fn((cb: (tx: unknown) => unknown) => cb(db))
  return db
}

describe('pest-job-sheet.service.listJobSheetPesticides', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lists pesticide lines for a job sheet, oldest first', async () => {
    const db = makePesticideMockDb({ id: 'pjs-1' }, makePesticideLine())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await listJobSheetPesticides('pjs-1')

    expect(res.success).toBe(true)
    expect((res as { data: unknown[] }).data).toHaveLength(1)
    expect(db.pestJobSheetPesticide.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { jobSheetId: 'pjs-1' }, orderBy: { createdAt: 'asc' } }))
  })
})

describe('pest-job-sheet.service.addJobSheetPesticide', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects an empty pesticide name', async () => {
    const res = await addJobSheetPesticide({ jobSheetId: 'pjs-1', pesticideName: '  ', quantityUsed: 5 })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('PJS-005')
  })

  it('rejects a non-positive quantity', async () => {
    const res = await addJobSheetPesticide({ jobSheetId: 'pjs-1', pesticideName: 'Cypermethrin', quantityUsed: 0 })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('PJS-006')
  })

  it('rejects a missing job sheet', async () => {
    const db = makePesticideMockDb(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await addJobSheetPesticide({ jobSheetId: 'missing', pesticideName: 'Cypermethrin', quantityUsed: 50 })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('PJS-001')
  })

  it('records a line WITHOUT a productId and never touches inventory — not every shop tracks pesticide as stock', async () => {
    const db = makePesticideMockDb({ id: 'pjs-1', jobNumber: 'PJS-00001' })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await addJobSheetPesticide({ jobSheetId: 'pjs-1', pesticideName: 'Cypermethrin 25 EC', quantityUsed: 50, unit: 'ML', targetPest: 'Cockroach', dosageNote: '2% dilution' })

    expect(res.success).toBe(true)
    expect(inventoryService.reduceStockTx).not.toHaveBeenCalled()
    expect(db.pestJobSheetPesticide.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ productId: null, pesticideName: 'Cypermethrin 25 EC', quantityUsed: 50, unit: 'ML', targetPest: 'Cockroach', dosageNote: '2% dilution' }),
    }))
  })

  it('rejects a missing linked product', async () => {
    const db = makePesticideMockDb({ id: 'pjs-1', jobNumber: 'PJS-00001' })
    db.product.findUnique = vi.fn().mockResolvedValue(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await addJobSheetPesticide({ jobSheetId: 'pjs-1', productId: 'prod-missing', pesticideName: 'Cypermethrin', quantityUsed: 50 })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('PJS-007')
  })

  it('WITH a productId, deducts real inventory via reduceStockTx', async () => {
    const db = makePesticideMockDb({ id: 'pjs-1', jobNumber: 'PJS-00001' })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(inventoryService.reduceStockTx).mockResolvedValue(undefined as never)

    const res = await addJobSheetPesticide({ jobSheetId: 'pjs-1', productId: 'prod-1', pesticideName: 'Cypermethrin 25 EC', quantityUsed: 50, unit: 'ML' })

    expect(res.success).toBe(true)
    expect(inventoryService.reduceStockTx).toHaveBeenCalledWith(
      db, 'prod-1', 50, expect.stringContaining('PJS-00001'), 'PEST_JOB_SHEET', 'PJS-00001', undefined
    )
  })

  it('translates an insufficient-stock ServiceError (INV-002) into a friendly PJS-008', async () => {
    const db = makePesticideMockDb({ id: 'pjs-1', jobNumber: 'PJS-00001' })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(inventoryService.reduceStockTx).mockRejectedValue(new ServiceError('INV-002', 'Insufficient stock.'))

    const res = await addJobSheetPesticide({ jobSheetId: 'pjs-1', productId: 'prod-1', pesticideName: 'Cypermethrin', quantityUsed: 9999 })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('PJS-008')
  })
})

describe('pest-job-sheet.service.removeJobSheetPesticide', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects a missing pesticide line', async () => {
    const db = makePesticideMockDb({ id: 'pjs-1' }, null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await removeJobSheetPesticide('missing')
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('PJS-009')
  })

  it('removing a line with NO linked product just deletes the row — no inventory touched', async () => {
    const db = makePesticideMockDb({ id: 'pjs-1', jobNumber: 'PJS-00001' }, makePesticideLine({ productId: null }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await removeJobSheetPesticide('pjp-1')

    expect(res.success).toBe(true)
    expect(db.inventory.update).not.toHaveBeenCalled()
    expect(db.inventoryMovement.create).not.toHaveBeenCalled()
    expect(db.pestJobSheetPesticide.delete).toHaveBeenCalledWith({ where: { id: 'pjp-1' } })
  })

  it('removing a line WITH a linked product restores the exact quantity via a PEST_RETURN movement', async () => {
    const db = makePesticideMockDb({ id: 'pjs-1', jobNumber: 'PJS-00001' }, makePesticideLine({ productId: 'prod-1', quantityUsed: 50 }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await removeJobSheetPesticide('pjp-1')

    expect(res.success).toBe(true)
    expect(db.inventory.update).toHaveBeenCalledWith({ where: { productId: 'prod-1' }, data: { quantity: { increment: 50 } } })
    expect(db.inventoryMovement.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ productId: 'prod-1', movementType: 'PEST_RETURN', quantity: 50, referenceType: 'PEST_JOB_SHEET', referenceId: 'PJS-00001' }),
    }))
  })
})
