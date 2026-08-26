import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn().mockResolvedValue(undefined) }))

import { getPrisma } from '../../database/db'
import {
  listServiceCombos, createServiceCombo, updateServiceCombo, deleteServiceCombo, resolveComboServices,
} from '../service-combo.service'

// Phase 68 §9.1 — Beauty Salon item 5: service-combo package builder.

function makeComboRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'combo-1', comboName: 'Wash + Cut + Style', description: null, comboPrice: 900, isActive: true,
    items: [
      { serviceCatalog: { id: 'svc-wash', serviceName: 'Wash', basePrice: 200 } },
      { serviceCatalog: { id: 'svc-cut', serviceName: 'Cut', basePrice: 500 } },
      { serviceCatalog: { id: 'svc-style', serviceName: 'Style', basePrice: 300 } },
    ],
    ...overrides,
  }
}

function makeDb(overrides: Record<string, unknown> = {}) {
  const db: Record<string, any> = {
    serviceCatalog: { findMany: vi.fn().mockResolvedValue([{ id: 'svc-wash' }, { id: 'svc-cut' }, { id: 'svc-style' }]) },
    serviceCombo: {
      findMany: vi.fn().mockResolvedValue([makeComboRow()]),
      findUnique: vi.fn().mockResolvedValue(makeComboRow()),
      findUniqueOrThrow: vi.fn().mockResolvedValue(makeComboRow()),
      create: vi.fn().mockResolvedValue({ id: 'combo-1' }),
      update: vi.fn().mockResolvedValue({}),
    },
    serviceComboItem: {
      createMany: vi.fn().mockResolvedValue({ count: 3 }),
      deleteMany: vi.fn().mockResolvedValue({ count: 3 }),
    },
    ...overrides,
  }
  db.$transaction = vi.fn((cb: (tx: unknown) => unknown) => cb(db))
  return db
}

beforeEach(() => vi.clearAllMocks())

describe('service-combo.service — createServiceCombo', () => {
  it('rejects a combo name that is blank', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await createServiceCombo({ comboName: '  ', comboPrice: 900, serviceCatalogIds: ['svc-wash', 'svc-cut'] })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('SVC-002')
  })

  it('rejects a zero or negative combo price', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await createServiceCombo({ comboName: 'Combo', comboPrice: 0, serviceCatalogIds: ['svc-wash', 'svc-cut'] })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('SVC-003')
  })

  it('rejects fewer than 2 distinct services (a "combo" of 1 or 0 is not a combo)', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await createServiceCombo({ comboName: 'Combo', comboPrice: 900, serviceCatalogIds: ['svc-wash', 'svc-wash'] })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('SVC-004')
  })

  it('rejects when one of the selected services no longer exists/is inactive', async () => {
    const db = makeDb({ serviceCatalog: { findMany: vi.fn().mockResolvedValue([{ id: 'svc-wash' }]) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await createServiceCombo({ comboName: 'Combo', comboPrice: 900, serviceCatalogIds: ['svc-wash', 'svc-cut'] })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('SVC-005')
  })

  it('creates a combo and links its member services inside one transaction', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await createServiceCombo({ comboName: 'Wash + Cut + Style', comboPrice: 900, serviceCatalogIds: ['svc-wash', 'svc-cut', 'svc-style'] })
    expect(res.success).toBe(true)
    expect(db.$transaction).toHaveBeenCalledTimes(1)
    expect(db.serviceComboItem.createMany).toHaveBeenCalledWith({
      data: [{ comboId: 'combo-1', serviceCatalogId: 'svc-wash' }, { comboId: 'combo-1', serviceCatalogId: 'svc-cut' }, { comboId: 'combo-1', serviceCatalogId: 'svc-style' }],
    })
  })
})

describe('service-combo.service — updateServiceCombo / deleteServiceCombo', () => {
  it('returns not-found for a combo that does not exist', async () => {
    const db = makeDb({ serviceCombo: { findUnique: vi.fn().mockResolvedValue(null) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await updateServiceCombo({ id: 'ghost', comboName: 'X' })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('SVC-007')
  })

  it('leaves member services untouched when serviceCatalogIds is omitted from the update', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    await updateServiceCombo({ id: 'combo-1', comboName: 'Renamed Combo' })
    expect(db.serviceComboItem.deleteMany).not.toHaveBeenCalled()
    expect(db.serviceComboItem.createMany).not.toHaveBeenCalled()
  })

  it('soft-deletes (isActive: false), never a hard delete', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await deleteServiceCombo('combo-1')
    expect(res.success).toBe(true)
    expect(db.serviceCombo.update).toHaveBeenCalledWith({ where: { id: 'combo-1' }, data: { isActive: false } })
  })
})

describe('service-combo.service — resolveComboServices', () => {
  it('scales each member price proportionally from comboPrice by its own basePrice weight', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    // basePrices 200/500/300 = 1000 total; comboPrice 900 -> 180/450/270
    const res = await resolveComboServices('combo-1')
    expect(res.success).toBe(true)
    const services = (res as { data: { services: Array<{ id: string; price: number }> } }).data.services
    expect(services).toEqual([
      { id: 'svc-wash', name: 'Wash', price: 180 },
      { id: 'svc-cut', name: 'Cut', price: 450 },
      { id: 'svc-style', name: 'Style', price: 270 },
    ])
  })

  it('the resolved prices always sum to exactly comboPrice, correcting any rounding drift on the last line', async () => {
    const db = makeDb({
      serviceCombo: {
        findUnique: vi.fn().mockResolvedValue(makeComboRow({
          comboPrice: 100,
          items: [
            { serviceCatalog: { id: 'svc-a', serviceName: 'A', basePrice: 100 } },
            { serviceCatalog: { id: 'svc-b', serviceName: 'B', basePrice: 100 } },
            { serviceCatalog: { id: 'svc-c', serviceName: 'C', basePrice: 100 } },
          ],
        })),
      },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await resolveComboServices('combo-1')
    const services = (res as { data: { services: Array<{ price: number }> } }).data.services
    expect(services.reduce((s, x) => s + x.price, 0)).toBe(100)
  })

  it('falls back to an equal split when every member is priced at 0', async () => {
    const db = makeDb({
      serviceCombo: {
        findUnique: vi.fn().mockResolvedValue(makeComboRow({
          comboPrice: 300,
          items: [
            { serviceCatalog: { id: 'svc-a', serviceName: 'A', basePrice: 0 } },
            { serviceCatalog: { id: 'svc-b', serviceName: 'B', basePrice: 0 } },
            { serviceCatalog: { id: 'svc-c', serviceName: 'C', basePrice: 0 } },
          ],
        })),
      },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await resolveComboServices('combo-1')
    const services = (res as { data: { services: Array<{ price: number }> } }).data.services
    expect(services.map((s) => s.price)).toEqual([100, 100, 100])
  })

  it('rejects resolving an inactive (deleted) combo', async () => {
    const db = makeDb({ serviceCombo: { findUnique: vi.fn().mockResolvedValue(makeComboRow({ isActive: false })) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await resolveComboServices('combo-1')
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('SVC-010')
  })
})

describe('service-combo.service — listServiceCombos', () => {
  it('exposes memberBasePriceTotal alongside comboPrice, so the UI can show the savings', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await listServiceCombos()
    expect(res.success).toBe(true)
    const combos = res.data as Array<{ comboPrice: number; memberBasePriceTotal: number }>
    expect(combos[0].comboPrice).toBe(900)
    expect(combos[0].memberBasePriceTotal).toBe(1000)
  })
})
