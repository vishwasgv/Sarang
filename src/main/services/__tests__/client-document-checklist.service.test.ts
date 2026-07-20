import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn().mockResolvedValue(undefined) }))

import { getPrisma } from '../../database/db'
import {
  listChecklistItems, addChecklistItem, seedStandardChecklist,
  updateChecklistItem, removeChecklistItem,
} from '../client-document-checklist.service'

function makeItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cdc-1', clientId: 'cust-1', documentType: 'PAN', label: null,
    status: 'PENDING', collectedDate: null, notes: null,
    createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  }
}

// findMany serves BOTH listChecklistItems (display) and seedStandardChecklist's
// existing-document-type check — both query the same shape (where: {clientId}),
// so the same `items` seed correctly backs both real usages.
function makeMockDb(items: ReturnType<typeof makeItem>[] = []) {
  const db: Record<string, any> = {
    clientDocumentChecklistItem: {
      findMany: vi.fn().mockResolvedValue(items),
      findUnique: vi.fn().mockImplementation(({ where: { id } }: { where: { id: string } }) => Promise.resolve(items.find((i) => i.id === id) ?? null)),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve(makeItem({ id: 'cdc-new', ...data }))),
      createMany: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve(makeItem({ ...items[0], ...data }))),
      delete: vi.fn().mockResolvedValue({}),
    },
    customer: {
      findUnique: vi.fn().mockResolvedValue({ id: 'cust-1' }),
    },
  }
  return db
}

describe('client-document-checklist.service.listChecklistItems', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lists items for a client, oldest first', async () => {
    const db = makeMockDb([makeItem()])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await listChecklistItems('cust-1')

    expect(res.success).toBe(true)
    expect((res as { data: unknown[] }).data).toHaveLength(1)
  })
})

describe('client-document-checklist.service.addChecklistItem', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects a missing client', async () => {
    const db = makeMockDb()
    db.customer.findUnique = vi.fn().mockResolvedValue(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await addChecklistItem({ clientId: 'missing', documentType: 'PAN' })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('CDC-002')
  })

  it('creates a PENDING item for a real client', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await addChecklistItem({ clientId: 'cust-1', documentType: 'BANK_STATEMENT' })

    expect(res.success).toBe(true)
    expect(db.clientDocumentChecklistItem.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ clientId: 'cust-1', documentType: 'BANK_STATEMENT', status: 'PENDING' }),
    }))
  })
})

describe('client-document-checklist.service.seedStandardChecklist', () => {
  beforeEach(() => vi.clearAllMocks())

  it('seeds all 4 standard document types for a client with none yet', async () => {
    const db = makeMockDb([])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await seedStandardChecklist('cust-1')

    expect(res.success).toBe(true)
    expect((res as { data: { created: number } }).data.created).toBe(4)
    expect(db.clientDocumentChecklistItem.createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.arrayContaining([
        expect.objectContaining({ documentType: 'PAN' }),
        expect.objectContaining({ documentType: 'AADHAAR' }),
        expect.objectContaining({ documentType: 'BANK_STATEMENT' }),
        expect.objectContaining({ documentType: 'GST_CERTIFICATE' }),
      ]),
    }))
  })

  it('is idempotent — skips document types already present for the client', async () => {
    const db = makeMockDb([makeItem({ documentType: 'PAN' }), makeItem({ documentType: 'AADHAAR' })])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await seedStandardChecklist('cust-1')

    expect(res.success).toBe(true)
    expect((res as { data: { created: number } }).data.created).toBe(2)
    const created = db.clientDocumentChecklistItem.createMany.mock.calls[0][0].data.map((d: any) => d.documentType)
    expect(created).toEqual(expect.arrayContaining(['BANK_STATEMENT', 'GST_CERTIFICATE']))
    expect(created).not.toContain('PAN')
  })

  it('does nothing when all 4 standard types are already present', async () => {
    const db = makeMockDb(['PAN', 'AADHAAR', 'BANK_STATEMENT', 'GST_CERTIFICATE'].map((documentType) => makeItem({ documentType })))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await seedStandardChecklist('cust-1')

    expect(res.success).toBe(true)
    expect((res as { data: { created: number } }).data.created).toBe(0)
    expect(db.clientDocumentChecklistItem.createMany).not.toHaveBeenCalled()
  })
})

describe('client-document-checklist.service.updateChecklistItem', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects a missing item', async () => {
    const db = makeMockDb([])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateChecklistItem({ id: 'missing', status: 'COLLECTED' })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('CDC-005')
  })

  it('marking COLLECTED stamps a real collectedDate', async () => {
    const db = makeMockDb([makeItem()])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateChecklistItem({ id: 'cdc-1', status: 'COLLECTED' })

    expect(res.success).toBe(true)
    expect(db.clientDocumentChecklistItem.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'COLLECTED', collectedDate: expect.any(Date) }),
    }))
  })

  it('reverting to PENDING clears collectedDate', async () => {
    const db = makeMockDb([makeItem({ status: 'COLLECTED', collectedDate: new Date() })])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateChecklistItem({ id: 'cdc-1', status: 'PENDING' })

    expect(res.success).toBe(true)
    expect(db.clientDocumentChecklistItem.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'PENDING', collectedDate: null }),
    }))
  })
})

describe('client-document-checklist.service.removeChecklistItem', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes the item', async () => {
    const db = makeMockDb([makeItem()])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await removeChecklistItem('cdc-1')

    expect(res.success).toBe(true)
    expect(db.clientDocumentChecklistItem.delete).toHaveBeenCalledWith({ where: { id: 'cdc-1' } })
  })
})
