import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../notification-queue.service', () => ({ buildReminderWhatsAppLink: vi.fn().mockResolvedValue('https://wa.me/919999999999?text=hi') }))

import { getPrisma } from '../../database/db'
import { updateSerialStatus, updateSerialServiceInfo, listEquipmentDueForService, scheduleEquipmentServiceReminder, transferInstallationWarranty } from '../serial.service'

beforeEach(() => vi.clearAllMocks())

// Real bug found live (core-commerce audit): updateSerialStatus used to read
// `existing` BEFORE this transaction opened, then reused that stale
// `existing.status` inside it to decide whether to increment/decrement
// Inventory.quantity. Two concurrent status changes on the same serial (e.g.
// two staff both marking a returned unit back AVAILABLE at once) would each
// act on the same pre-transaction snapshot, so the inventory adjustment
// below could apply twice for what is really only one real state transition.
describe('serial.service.updateSerialStatus', () => {
  function makeMockDb(opts: { freshStatus: string; productId?: string }) {
    const callOrder: string[] = []
    const db: Record<string, any> = {
      productSerial: {
        findUnique: vi.fn(async () => {
          callOrder.push('findUnique')
          return { id: 'ser-1', productId: opts.productId ?? 'prod-1', status: opts.freshStatus, invoiceId: null }
        }),
        update: vi.fn().mockResolvedValue({}),
      },
      inventory: { upsert: vi.fn().mockResolvedValue({}) },
    }
    db.$transaction = vi.fn((cb: (tx: unknown) => unknown) => { callOrder.push('transactionStart'); return cb(db) })
    return { db, callOrder }
  }

  // Proves the read that decides the inventory adjustment happens AFTER the
  // transaction opens (i.e. atomically with the write), not against a
  // snapshot taken before it — this is the actual shape of the race fix.
  // Fails on the pre-fix code, where findUnique ran BEFORE $transaction was
  // ever called.
  it('reads the serial status fresh INSIDE the transaction, not before it opens', async () => {
    const { db, callOrder } = makeMockDb({ freshStatus: 'SOLD' })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await updateSerialStatus({ id: 'ser-1', status: 'AVAILABLE' })

    expect(callOrder.indexOf('findUnique')).toBeGreaterThan(callOrder.indexOf('transactionStart'))
  })

  it('increments inventory when a SOLD unit is marked AVAILABLE', async () => {
    const { db } = makeMockDb({ freshStatus: 'SOLD' })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateSerialStatus({ id: 'ser-1', status: 'AVAILABLE' })

    expect(res.success).toBe(true)
    expect(db.inventory.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { productId: 'prod-1' },
      update: { quantity: { increment: 1 } },
    }))
  })

  it('decrements inventory when an AVAILABLE unit is marked SOLD', async () => {
    const { db } = makeMockDb({ freshStatus: 'AVAILABLE' })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateSerialStatus({ id: 'ser-1', status: 'SOLD', invoiceId: 'inv-1' })

    expect(res.success).toBe(true)
    expect(db.inventory.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { productId: 'prod-1' },
      update: { quantity: { decrement: 1 } },
    }))
  })

  it('does not touch inventory for a status change that is not a SOLD<->AVAILABLE transition', async () => {
    const { db } = makeMockDb({ freshStatus: 'SOLD' })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateSerialStatus({ id: 'ser-1', status: 'DEFECTIVE' })

    expect(res.success).toBe(true)
    expect(db.inventory.upsert).not.toHaveBeenCalled()
  })

  it('returns an error when the serial does not exist', async () => {
    const db: Record<string, any> = {
      productSerial: { findUnique: vi.fn().mockResolvedValue(null), update: vi.fn() },
      inventory: { upsert: vi.fn() },
    }
    db.$transaction = vi.fn((cb: (tx: unknown) => unknown) => cb(db))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateSerialStatus({ id: 'missing', status: 'AVAILABLE' })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('SER-006')
  })
})

describe('serial.service.updateSerialServiceInfo', () => {
  it('errors when the equipment record does not exist', async () => {
    const db: Record<string, any> = { productSerial: { findUnique: vi.fn().mockResolvedValue(null), update: vi.fn() } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateSerialServiceInfo({ id: 'missing', nextServiceDueDate: '2026-09-01' })

    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('SER-010')
  })

  it('updates nextServiceDueDate and lastServicedDate', async () => {
    const update = vi.fn().mockResolvedValue({})
    const db: Record<string, any> = { productSerial: { findUnique: vi.fn().mockResolvedValue({ id: 'ser-1' }), update } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateSerialServiceInfo({ id: 'ser-1', nextServiceDueDate: '2026-09-01', lastServicedDate: '2026-03-01' })

    expect(res.success).toBe(true)
    // Local midnight, not new Date('2026-09-01') (UTC midnight) — a
    // date-only ISO string parses as UTC, the wrong calendar day in a
    // positive-UTC-offset timezone (this app's primary market is IST).
    expect(update).toHaveBeenCalledWith({
      where: { id: 'ser-1' },
      data: { nextServiceDueDate: new Date(2026, 8, 1), lastServicedDate: new Date(2026, 2, 1) }
    })
  })

  it('clears a date when explicitly passed null, but leaves it untouched when omitted', async () => {
    const update = vi.fn().mockResolvedValue({})
    const db: Record<string, any> = { productSerial: { findUnique: vi.fn().mockResolvedValue({ id: 'ser-1' }), update } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await updateSerialServiceInfo({ id: 'ser-1', nextServiceDueDate: null })

    expect(update).toHaveBeenCalledWith({ where: { id: 'ser-1' }, data: { nextServiceDueDate: null } })
  })
})

describe('serial.service.listEquipmentDueForService', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns an empty list when no equipment has a next-service date set', async () => {
    const db: Record<string, any> = { productSerial: { findMany: vi.fn().mockResolvedValue([]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await listEquipmentDueForService()

    expect(res.success).toBe(true)
    expect(res.data).toEqual([])
  })

  it('flags overdue and due-soon equipment correctly', async () => {
    const now = new Date()
    const overdueDate = new Date(now.getTime() - 5 * 86400000)
    const dueSoonDate = new Date(now.getTime() + 7 * 86400000)
    const farOutDate = new Date(now.getTime() + 60 * 86400000)
    const db: Record<string, any> = {
      productSerial: {
        findMany: vi.fn().mockResolvedValue([
          { id: 's-overdue', serialNumber: 'SN-1', nextServiceDueDate: overdueDate, lastServicedDate: null, product: { productName: 'Tractor A' } },
          { id: 's-soon', serialNumber: 'SN-2', nextServiceDueDate: dueSoonDate, lastServicedDate: null, product: { productName: 'Sprayer B' } },
          { id: 's-later', serialNumber: 'SN-3', nextServiceDueDate: farOutDate, lastServicedDate: null, product: { productName: 'Tractor C' } },
        ])
      }
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await listEquipmentDueForService(14)

    const overdue = res.data!.find(r => r.serialId === 's-overdue')!
    const soon = res.data!.find(r => r.serialId === 's-soon')!
    const later = res.data!.find(r => r.serialId === 's-later')!
    expect(overdue.overdue).toBe(true)
    expect(overdue.dueForService).toBe(true)
    expect(soon.overdue).toBe(false)
    expect(soon.dueForService).toBe(true)
    expect(later.overdue).toBe(false)
    expect(later.dueForService).toBe(false)
  })
})

describe('serial.service.scheduleEquipmentServiceReminder', () => {
  beforeEach(() => vi.clearAllMocks())

  it('errors when the equipment record does not exist', async () => {
    const db: Record<string, any> = { productSerial: { findUnique: vi.fn().mockResolvedValue(null) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await scheduleEquipmentServiceReminder('missing')

    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('SER-013')
  })

  it('errors when no next-service-due date is set', async () => {
    const db: Record<string, any> = {
      productSerial: { findUnique: vi.fn().mockResolvedValue({ id: 'ser-1', nextServiceDueDate: null, product: { productName: 'Tractor' } }) }
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await scheduleEquipmentServiceReminder('ser-1')

    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('SER-014')
  })

  it('quietly no-ops (success, no queue row) when the equipment has no linked customer phone', async () => {
    const futureDue = new Date(Date.now() + 30 * 86400000)
    const db: Record<string, any> = {
      productSerial: { findUnique: vi.fn().mockResolvedValue({ id: 'ser-1', invoiceId: null, nextServiceDueDate: futureDue, serialNumber: 'SN-1', product: { productName: 'Tractor' } }) },
      notificationQueue: { create: vi.fn() }
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await scheduleEquipmentServiceReminder('ser-1')

    expect(res.success).toBe(true)
    expect(res.data).toBeNull()
    expect(db.notificationQueue.create).not.toHaveBeenCalled()
  })

  it('errors when the computed reminder date has already passed', async () => {
    const nearDue = new Date(Date.now() + 1 * 86400000) // due tomorrow, daysBefore=3 pushes reminder into the past
    const db: Record<string, any> = {
      productSerial: { findUnique: vi.fn().mockResolvedValue({ id: 'ser-1', invoiceId: 'inv-1', nextServiceDueDate: nearDue, serialNumber: 'SN-1', product: { productName: 'Tractor' } }) },
      invoice: { findUnique: vi.fn().mockResolvedValue({ customerId: 'cust-1', customer: { customerName: 'Ramesh', phone: '9999999999' } }) },
      notificationQueue: { create: vi.fn() }
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await scheduleEquipmentServiceReminder('ser-1', 3)

    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('SER-015')
  })

  it('creates a notification queue row with the correct type when a reminder is schedulable', async () => {
    const futureDue = new Date(Date.now() + 30 * 86400000)
    const create = vi.fn().mockResolvedValue({ id: 'nq-1' })
    const db: Record<string, any> = {
      productSerial: { findUnique: vi.fn().mockResolvedValue({ id: 'ser-1', invoiceId: 'inv-1', nextServiceDueDate: futureDue, serialNumber: 'SN-1', product: { productName: 'Tractor' } }) },
      invoice: { findUnique: vi.fn().mockResolvedValue({ customerId: 'cust-1', customer: { customerName: 'Ramesh', phone: '9999999999' } }) },
      notificationQueue: { create }
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await scheduleEquipmentServiceReminder('ser-1', 3)

    expect(res.success).toBe(true)
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ notificationType: 'EQUIPMENT_SERVICE_DUE_REMINDER', customerId: 'cust-1' })
    }))
  })
})

// Phase 69 §11 — Plumbing wow feature: Installation Warranty Transfer.
describe('serial.service.transferInstallationWarranty', () => {
  function makeMockDb(opts: { status?: string } = {}) {
    const db: Record<string, any> = {
      productSerial: {
        findUnique: vi.fn().mockResolvedValue({ id: 'ser-1', status: opts.status ?? 'SOLD' }),
        update: vi.fn().mockResolvedValue({}),
      },
      customer: { findUnique: vi.fn().mockResolvedValue({ id: 'cust-1', customerName: 'Homeowner' }) },
    }
    return db
  }

  it('rejects a unit that was not found', async () => {
    const db = makeMockDb()
    db.productSerial.findUnique = vi.fn().mockResolvedValue(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await transferInstallationWarranty({ serialId: 'ser-missing', customerId: 'cust-1' })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('SER-013')
  })

  it('rejects a unit that has not been sold yet', async () => {
    const db = makeMockDb({ status: 'AVAILABLE' })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await transferInstallationWarranty({ serialId: 'ser-1', customerId: 'cust-1' })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('SER-014')
    expect(db.productSerial.update).not.toHaveBeenCalled()
  })

  it('rejects a customer that does not exist', async () => {
    const db = makeMockDb()
    db.customer.findUnique = vi.fn().mockResolvedValue(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await transferInstallationWarranty({ serialId: 'ser-1', customerId: 'cust-missing' })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('CUST-001')
  })

  it('sets installedCustomerId/installedAt/installationAddress on a sold unit', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await transferInstallationWarranty({ serialId: 'ser-1', customerId: 'cust-1', installationAddress: '12 MG Road' })

    expect(res.success).toBe(true)
    expect(db.productSerial.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'ser-1' },
      data: expect.objectContaining({ installedCustomerId: 'cust-1', installationAddress: '12 MG Road' })
    }))
  })
})
