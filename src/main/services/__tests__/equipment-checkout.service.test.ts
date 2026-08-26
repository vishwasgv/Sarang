import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn().mockResolvedValue(undefined) }))

import { getPrisma } from '../../database/db'
import { listEquipmentCheckouts, checkOutEquipment, returnEquipment, deleteEquipmentCheckout } from '../equipment-checkout.service'

function makeCheckout(overrides: Record<string, unknown> = {}) {
  return {
    id: 'chk-1', fixedAssetId: 'asset-1', shootBookingId: 'shoot-1', checkedOutToId: null,
    checkedOutDate: new Date(2026, 7, 1), expectedReturnDate: null, actualReturnDate: null, notes: null,
    createdAt: new Date(), updatedAt: new Date(),
    fixedAsset: { id: 'asset-1', assetName: 'Canon R5', assetCode: 'EQ-001', category: 'CAMERA' },
    shootBooking: { id: 'shoot-1', shootType: 'WEDDING', shootDate: new Date() },
    checkedOutTo: null,
    ...overrides,
  }
}

function makeMockDb(existing: ReturnType<typeof makeCheckout> | null = makeCheckout(), asset: { id: string; status: string } | null = { id: 'asset-1', status: 'ACTIVE' }) {
  const db: Record<string, any> = {
    fixedAsset: { findUnique: vi.fn().mockResolvedValue(asset) },
    equipmentCheckout: {
      findMany: vi.fn().mockResolvedValue(existing ? [existing] : []),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve(makeCheckout({ id: 'chk-new', ...data }))),
      update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve(makeCheckout({ ...existing, ...data }))),
      delete: vi.fn().mockResolvedValue({}),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  }
  return db
}

describe('equipment-checkout.service — basic CRUD', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lists checkouts', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await listEquipmentCheckouts({ shootBookingId: 'shoot-1' })
    expect(res.success).toBe(true)
  })

  it('rejects a missing checkout date', async () => {
    const res = await checkOutEquipment({ fixedAssetId: 'asset-1', checkedOutDate: '' })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('EQC-002')
  })

  it('rejects a missing fixed asset', async () => {
    const db = makeMockDb(null, null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await checkOutEquipment({ fixedAssetId: 'missing', checkedOutDate: '2026-08-15' })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('EQC-003')
  })

  it('rejects checking out a DISPOSED asset', async () => {
    const db = makeMockDb(null, { id: 'asset-1', status: 'DISPOSED' })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await checkOutEquipment({ fixedAssetId: 'asset-1', checkedOutDate: '2026-08-15' })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('EQC-004')
  })

  it('checks out equipment with real logged dates', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await checkOutEquipment({ fixedAssetId: 'asset-1', shootBookingId: 'shoot-1', checkedOutDate: '2026-08-15', expectedReturnDate: '2026-08-17' })

    expect(res.success).toBe(true)
    expect(db.equipmentCheckout.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ fixedAssetId: 'asset-1', shootBookingId: 'shoot-1' }),
    }))
  })

  it('rejects a missing return date', async () => {
    const res = await returnEquipment({ id: 'chk-1', actualReturnDate: '' })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('EQC-006')
  })

  it('records a return', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await returnEquipment({ id: 'chk-1', actualReturnDate: '2026-08-20' })

    expect(res.success).toBe(true)
    expect(db.equipmentCheckout.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'chk-1' },
      data: expect.objectContaining({ actualReturnDate: expect.any(Date) }),
    }))
  })

  it('deletes a checkout', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await deleteEquipmentCheckout('chk-1')
    expect(res.success).toBe(true)
  })
})

// Real bug prevention (2026-08-27 Phase 68 audit): a bare
// `new Date('YYYY-MM-DD')` parses as UTC midnight — this new file is built
// with parseLocalDateStart from the start, matching the app-wide convention.
describe('equipment-checkout.service — local-date construction', () => {
  beforeEach(() => vi.clearAllMocks())

  it('checkOutEquipment stores checkedOutDate/expectedReturnDate at local midnight, not UTC midnight', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await checkOutEquipment({ fixedAssetId: 'asset-1', checkedOutDate: '2026-08-15', expectedReturnDate: '2026-08-17' })

    expect(db.equipmentCheckout.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ checkedOutDate: new Date(2026, 7, 15), expectedReturnDate: new Date(2026, 7, 17) }),
    }))
  })

  it('returnEquipment stores actualReturnDate at local midnight, not UTC midnight', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await returnEquipment({ id: 'chk-1', actualReturnDate: '2026-08-20' })

    expect(db.equipmentCheckout.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ actualReturnDate: new Date(2026, 7, 20) }),
    }))
  })
})
