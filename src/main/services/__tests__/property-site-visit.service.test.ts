import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../notification-queue.service', () => ({ buildWhatsAppLink: vi.fn().mockResolvedValue('https://wa.me/test') }))

import { getPrisma } from '../../database/db'
import { buildWhatsAppLink } from '../notification-queue.service'
import {
  listPropertySiteVisits, schedulePropertySiteVisit, updatePropertySiteVisit, deletePropertySiteVisit,
} from '../property-site-visit.service'

function makeInquiry(overrides: Record<string, unknown> = {}) {
  return {
    id: 'inq-1', propertyId: 'prop-1', buyerClientId: 'cust-1', status: 'SHORTLISTED',
    buyer: { id: 'cust-1', customerName: 'Ramesh Kumar', phone: '9812340000' },
    property: { location: 'Baner, Pune', propertyType: 'RESIDENTIAL_FLAT' },
    ...overrides,
  }
}

function makeVisit(overrides: Record<string, unknown> = {}) {
  return {
    id: 'psv-1', inquiryId: 'inq-1', scheduledDate: new Date(), scheduledTime: '11:00',
    status: 'SCHEDULED', feedback: null, interestLevel: null, completedDate: null,
    createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  }
}

function makeMockDb(inquiry: ReturnType<typeof makeInquiry> | null = makeInquiry(), visit: ReturnType<typeof makeVisit> | null = makeVisit()) {
  const db: Record<string, any> = {
    propertyInquiry: {
      findUnique: vi.fn().mockResolvedValue(inquiry),
      update: vi.fn().mockResolvedValue({}),
    },
    propertySiteVisit: {
      findMany: vi.fn().mockResolvedValue(visit ? [visit] : []),
      findUnique: vi.fn().mockResolvedValue(visit),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve(makeVisit({ id: 'psv-new', ...data }))),
      update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve(makeVisit({ ...visit, ...data }))),
      delete: vi.fn().mockResolvedValue({}),
    },
    notificationQueue: {
      create: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  }
  return db
}

describe('property-site-visit.service.schedulePropertySiteVisit', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects a missing scheduled date', async () => {
    const res = await schedulePropertySiteVisit({ inquiryId: 'inq-1', scheduledDate: '' })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('PSV-002')
  })

  it('rejects a missing inquiry', async () => {
    const db = makeMockDb(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await schedulePropertySiteVisit({ inquiryId: 'missing', scheduledDate: '2026-08-01' })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('PSV-003')
  })

  it('creates a real visit and flips the inquiry status to SITE_VISIT_SCHEDULED', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const future = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

    const res = await schedulePropertySiteVisit({ inquiryId: 'inq-1', scheduledDate: future, scheduledTime: '11:00' })

    expect(res.success).toBe(true)
    expect(db.propertySiteVisit.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ inquiryId: 'inq-1', scheduledTime: '11:00', status: 'SCHEDULED' }),
    }))
    expect(db.propertyInquiry.update).toHaveBeenCalledWith({ where: { id: 'inq-1' }, data: { status: 'SITE_VISIT_SCHEDULED' } })
  })

  it('schedules a real WhatsApp reminder 1 day before, when the buyer has a phone and enough lead time', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const future = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

    await schedulePropertySiteVisit({ inquiryId: 'inq-1', scheduledDate: future })
    await new Promise((r) => setTimeout(r, 0)) // let the fire-and-forget reminder promise settle

    expect(buildWhatsAppLink).toHaveBeenCalledWith('9812340000', expect.stringContaining('Baner, Pune'))
    expect(db.notificationQueue.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ customerId: 'cust-1', notificationType: 'PROPERTY_SITE_VISIT_REMINDER' }),
    }))
  })

  it('does not schedule a reminder when the buyer has no phone on file', async () => {
    const db = makeMockDb(makeInquiry({ buyer: { id: 'cust-1', customerName: 'Ramesh Kumar', phone: null } }))
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const future = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

    await schedulePropertySiteVisit({ inquiryId: 'inq-1', scheduledDate: future })
    await new Promise((r) => setTimeout(r, 0))

    expect(db.notificationQueue.create).not.toHaveBeenCalled()
  })
})

describe('property-site-visit.service.updatePropertySiteVisit', () => {
  beforeEach(() => vi.clearAllMocks())

  it('stamps a real completedDate when status moves to COMPLETED', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updatePropertySiteVisit({ id: 'psv-1', status: 'COMPLETED', feedback: 'Loved the balcony view', interestLevel: 'HIGH' })

    expect(res.success).toBe(true)
    expect(db.propertySiteVisit.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'COMPLETED', feedback: 'Loved the balcony view', interestLevel: 'HIGH', completedDate: expect.any(Date) }),
    }))
  })

  it('reschedule (scheduledDate change) cancels the old reminder and schedules a fresh one', async () => {
    const oldDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
    const db = makeMockDb(makeInquiry(), makeVisit({ scheduledDate: oldDate }))
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const newDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

    const res = await updatePropertySiteVisit({ id: 'psv-1', scheduledDate: newDate })
    await new Promise((r) => setTimeout(r, 0))

    expect(res.success).toBe(true)
    expect(db.notificationQueue.deleteMany).toHaveBeenCalledTimes(1)
    expect(db.notificationQueue.create).toHaveBeenCalledTimes(1)
  })

  it('re-saving the SAME scheduledDate does not touch any reminder', async () => {
    const sameDateStr = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const db = makeMockDb(makeInquiry(), makeVisit({ scheduledDate: new Date(sameDateStr) }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updatePropertySiteVisit({ id: 'psv-1', scheduledDate: sameDateStr, feedback: 'edited' })

    expect(res.success).toBe(true)
    expect(db.notificationQueue.deleteMany).not.toHaveBeenCalled()
  })
})

describe('property-site-visit.service — list/delete', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lists visits for an inquiry', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await listPropertySiteVisits('inq-1')
    expect(res.success).toBe(true)
  })

  it('deletes a visit', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await deletePropertySiteVisit('psv-1')
    expect(res.success).toBe(true)
  })
})
