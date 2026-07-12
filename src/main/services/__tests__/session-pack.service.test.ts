import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../billing.service', () => ({ billingService: { createInvoice: vi.fn() } }))

import { getPrisma } from '../../database/db'
import { billingService } from '../billing.service'
import { createPack, getActivePack, listPacks, listAllActivePacks, deductSession, generateSessionPackInvoice } from '../session-pack.service'

// Regression coverage for the Phase 26 re-audit findings:
//  1. ClientSessionPack.pricePerPack is a Prisma Decimal — Electron's IPC
//     (structured clone) can't serialize a Decimal instance and throws
//     "An object could not be cloned" on every response that includes one.
//     A FakeDecimal test double (toString/valueOf only, like a real Decimal.js
//     instance) proves serializePack() actually converts it to a number.
//  2. deductSession's "no active pack" / "already deducted" checks ran before
//     and outside the transaction (a TOCTOU race) — two near-simultaneous
//     calls for the same appointment could both pass the "already deducted"
//     check before either committed. Fixed by moving everything inside one
//     interactive db.$transaction().

class FakeDecimal {
  constructor(private value: number) {}
  toString() { return String(this.value) }
  valueOf() { return this.value }
}

function makePack(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pack-1', customerId: 'cust-1', packName: 'Physio 10-pack',
    totalSessions: 10, usedSessions: 0, isActive: true,
    purchaseDate: new Date('2026-06-01'), expiryDate: null,
    pricePerPack: new FakeDecimal(2500) as unknown as number,
    notes: null,
    ...overrides,
  }
}

function makeMockDb(pack: ReturnType<typeof makePack> | null, sessionLogExists = false) {
  const db: Record<string, any> = {
    clientSessionPack: {
      findMany: vi.fn().mockResolvedValue(pack ? [pack] : []),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'pack-new', pricePerPack: new FakeDecimal(Number(data.pricePerPack ?? 0)), ...data })
      ),
      update: vi.fn().mockImplementation(({ where: { id }, data }: { where: { id: string }; data: Record<string, unknown> }) =>
        Promise.resolve({ ...pack, id, ...data })
      ),
    },
    sessionLog: {
      findUnique: vi.fn().mockResolvedValue(sessionLogExists ? { id: 'log-existing', clientSessionPackId: pack?.id, appointmentId: 'apt-1' } : null),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'log-new', ...data })
      ),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  }
  db.$transaction = vi.fn((cb: (tx: unknown) => unknown) => cb(db))
  return db
}

describe('session-pack.service — Decimal serialization', () => {
  beforeEach(() => vi.clearAllMocks())

  it('createPack returns pricePerPack as a plain number, not a Decimal instance', async () => {
    const db = makeMockDb(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createPack({ customerId: 'cust-1', packName: 'Physio 10-pack', totalSessions: 10, pricePerPack: 2500 })

    expect(res.success).toBe(true)
    expect(typeof (res as { data: { pricePerPack: unknown } }).data.pricePerPack).toBe('number')
    expect((res as unknown as { data: { pricePerPack: number } }).data.pricePerPack).toBe(2500)
  })

  it('getActivePack returns pricePerPack as a plain number', async () => {
    const db = makeMockDb(makePack())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getActivePack('cust-1')

    expect(res.success).toBe(true)
    expect(typeof (res as { data: { pricePerPack: unknown } }).data.pricePerPack).toBe('number')
  })

  it('listPacks and listAllActivePacks return pricePerPack as plain numbers', async () => {
    const db = makeMockDb(makePack())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const listRes = await listPacks('cust-1')
    const allRes = await listAllActivePacks()

    expect(typeof (listRes as { data: Array<{ pricePerPack: unknown }> }).data[0].pricePerPack).toBe('number')
    expect(typeof (allRes as { data: Array<{ pricePerPack: unknown }> }).data[0].pricePerPack).toBe('number')
  })
})

describe('session-pack.service — deductSession atomicity', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deducts a session and returns a serialized pack', async () => {
    const db = makeMockDb(makePack())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await deductSession({ customerId: 'cust-1', appointmentId: 'apt-1' })

    expect(res.success).toBe(true)
    const data = (res as { data: { pack: { pricePerPack: unknown; usedSessions: number } } }).data
    expect(typeof data.pack.pricePerPack).toBe('number')
    expect(data.pack.usedSessions).toBe(1)
    expect(db.sessionLog.create).toHaveBeenCalledTimes(1)
  })

  it('runs the check and the write inside a single transaction', async () => {
    const db = makeMockDb(makePack())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await deductSession({ customerId: 'cust-1', appointmentId: 'apt-1' })

    expect(db.$transaction).toHaveBeenCalledTimes(1)
  })

  it('reports already-deducted without creating a second log when a log already exists for the appointment', async () => {
    const db = makeMockDb(makePack(), true)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await deductSession({ customerId: 'cust-1', appointmentId: 'apt-1' })

    expect(res.success).toBe(true)
    expect((res as { data: { alreadyDeducted: boolean } }).data.alreadyDeducted).toBe(true)
    expect(db.sessionLog.create).not.toHaveBeenCalled()
    expect(db.clientSessionPack.update).not.toHaveBeenCalled()
  })

  it('returns an error when no active pack has remaining sessions', async () => {
    const db = makeMockDb(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await deductSession({ customerId: 'cust-1' })

    expect(res.success).toBe(false)
    expect(db.clientSessionPack.update).not.toHaveBeenCalled()
  })

  it('marks the pack inactive once the last session is used', async () => {
    const db = makeMockDb(makePack({ usedSessions: 9, totalSessions: 10 }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await deductSession({ customerId: 'cust-1' })

    expect(res.success).toBe(true)
    expect(db.clientSessionPack.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ usedSessions: 10, isActive: false }) })
    )
    expect((res as { data: { depleted: boolean } }).data.depleted).toBe(true)
  })
})

// Phase 41 — generateSessionPackInvoice

function makePackForInvoice(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pack-1', customerId: 'cust-1', packName: 'Physio 10-pack',
    pricePerPack: 2500, taxRate: 18, sacCode: null, invoiceId: null,
    totalSessions: 10,
    ...overrides,
  }
}

function makeInvoiceMockDb(pack: ReturnType<typeof makePackForInvoice> | null) {
  const canClaim = !!pack && !pack.invoiceId
  return {
    clientSessionPack: {
      updateMany: vi.fn().mockResolvedValue({ count: canClaim ? 1 : 0 }),
      findUnique: vi.fn().mockResolvedValue(pack),
      update: vi.fn().mockResolvedValue({}),
    },
    product: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'product-1', hsnCode: null }),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  }
}

describe('session-pack.service — generateSessionPackInvoice', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects a missing pack', async () => {
    const db = makeInvoiceMockDb(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateSessionPackInvoice('pack-missing')
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('SP-008')
  })

  it('rejects a pack that already has an invoice', async () => {
    const db = makeInvoiceMockDb(makePackForInvoice({ invoiceId: 'invoice-existing' }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateSessionPackInvoice('pack-1')
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('SP-009')
  })

  it('rejects a pack with no price set', async () => {
    const db = makeInvoiceMockDb(makePackForInvoice({ pricePerPack: 0 }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateSessionPackInvoice('pack-1')
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('SP-010')
  })

  it('generates an invoice using the pack own tax rate, with no hardcoded SAC fallback', async () => {
    const db = makeInvoiceMockDb(makePackForInvoice())
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: true, data: { id: 'invoice-1' } } as never)

    const res = await generateSessionPackInvoice('pack-1')

    expect(res.success).toBe(true)
    expect((res as { data: { invoiceId: string } }).data.invoiceId).toBe('invoice-1')
    expect(billingService.createInvoice).toHaveBeenCalledWith(expect.objectContaining({
      customerId: 'cust-1',
      items: [expect.objectContaining({ productId: 'product-1', unitPrice: 2500, taxRate: 18 })],
    }))
    expect(db.product.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ hsnCode: null }) }))
    expect(db.clientSessionPack.update).toHaveBeenCalledWith({ where: { id: 'pack-1' }, data: { invoiceId: 'invoice-1' } })
  })

  it('uses the pack sacCode when the business set one', async () => {
    const db = makeInvoiceMockDb(makePackForInvoice({ sacCode: '999723' }))
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: true, data: { id: 'invoice-1' } } as never)

    await generateSessionPackInvoice('pack-1')

    expect(db.product.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ hsnCode: '999723' }) }))
  })

  it('propagates a billing failure without linking an invoice, and releases the claim', async () => {
    const db = makeInvoiceMockDb(makePackForInvoice())
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: false, error: { code: 'BILL-001', message: 'failed' } } as never)

    const res = await generateSessionPackInvoice('pack-1')

    expect(res.success).toBe(false)
    expect(db.clientSessionPack.update).toHaveBeenCalledWith({ where: { id: 'pack-1' }, data: { invoiceId: null } })
  })

  it('rejects and releases the claim when a concurrent call wins the race', async () => {
    const db = makeInvoiceMockDb(makePackForInvoice())
    db.clientSessionPack.updateMany = vi.fn().mockResolvedValueOnce({ count: 0 })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateSessionPackInvoice('pack-1')

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('SP-009')
    expect(billingService.createInvoice).not.toHaveBeenCalled()
  })
})
