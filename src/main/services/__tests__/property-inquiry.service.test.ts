import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))

import { getPrisma } from '../../database/db'
import { listPropertyInquiries, createPropertyInquiry, updatePropertyInquiry, deletePropertyInquiry } from '../property-inquiry.service'

function makeInquiry(overrides: Record<string, unknown> = {}) {
  return {
    id: 'inq-1', propertyId: 'prop-1', buyerClientId: 'cust-1', inquiryDate: new Date(),
    status: 'SHORTLISTED', notes: null, nextFollowUpDate: null,
    createdAt: new Date(), updatedAt: new Date(),
    buyer: { id: 'cust-1', customerName: 'Ramesh Kumar', phone: '9812340000' },
    ...overrides,
  }
}

function makeMockDb(existing: ReturnType<typeof makeInquiry> | null = makeInquiry()) {
  const db: Record<string, any> = {
    propertyInquiry: {
      findMany: vi.fn().mockResolvedValue(existing ? [existing] : []),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve(makeInquiry({ id: 'inq-new', ...data }))),
      update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve(makeInquiry({ ...existing, ...data }))),
      delete: vi.fn().mockResolvedValue({}),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  }
  return db
}

describe('property-inquiry.service — basic CRUD', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lists inquiries for a property', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await listPropertyInquiries('prop-1')
    expect(res.success).toBe(true)
  })

  it('creates an inquiry', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await createPropertyInquiry({ propertyId: 'prop-1', buyerClientId: 'cust-1' })
    expect(res.success).toBe(true)
  })

  it('deletes an inquiry', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await deletePropertyInquiry('inq-1')
    expect(res.success).toBe(true)
  })
})

// Real bug found live (2026-08-27 Phase 68 audit): a bare
// `new Date('YYYY-MM-DD')` parses as UTC midnight — inconsistent with this
// app's own parseLocalDateStart convention used everywhere else.
describe('property-inquiry.service — local-date construction', () => {
  beforeEach(() => vi.clearAllMocks())

  it('createPropertyInquiry stores nextFollowUpDate at local midnight, not UTC midnight', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await createPropertyInquiry({ propertyId: 'prop-1', buyerClientId: 'cust-1', nextFollowUpDate: '2026-08-15' })

    expect(db.propertyInquiry.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ nextFollowUpDate: new Date(2026, 7, 15) }),
    }))
  })

  it('updatePropertyInquiry stores an updated nextFollowUpDate at local midnight too', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await updatePropertyInquiry({ id: 'inq-1', nextFollowUpDate: '2026-09-01' })

    expect(db.propertyInquiry.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ nextFollowUpDate: new Date(2026, 8, 1) }),
    }))
  })

  it('createPropertyInquiry leaves nextFollowUpDate null when not provided', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await createPropertyInquiry({ propertyId: 'prop-1', buyerClientId: 'cust-1' })

    expect(db.propertyInquiry.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ nextFollowUpDate: null }),
    }))
  })
})
