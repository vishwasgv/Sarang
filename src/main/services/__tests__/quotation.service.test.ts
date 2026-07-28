import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../industry-template.service', () => ({ isModuleEnabled: vi.fn().mockResolvedValue(false) }))
vi.mock('../license.service', () => ({ getLicenseState: vi.fn() }))

import { getPrisma } from '../../database/db'
import { getLicenseState } from '../license.service'
import { quotationService } from '../quotation.service'

const EXISTING_NUMBER = 'QT-00003'

function makeDb(lastQuotationNumber: string | null = EXISTING_NUMBER) {
  let settingRow: { settingKey: string; settingValue: string } | null = null
  const txClient = {
    quotation: {
      findFirst: vi.fn().mockResolvedValue(lastQuotationNumber ? { quotationNumber: lastQuotationNumber } : null),
      create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ ...data, id: 'qt-new', items: data.items?.create ?? [], customer: null }))
    },
    setting: {
      findUnique: vi.fn(async () => settingRow),
      update: vi.fn(async ({ data }: { data: { settingValue: string } }) => { settingRow = settingRow ? { ...settingRow, settingValue: data.settingValue } : null; return settingRow }),
      create: vi.fn(async ({ data }: { data: { settingKey: string; settingValue: string } }) => { settingRow = { settingKey: data.settingKey, settingValue: data.settingValue }; return settingRow })
    }
  }
  return {
    // create() reads currencyDecimals via businessProfile.findFirst() on the
    // outer `db` (not `tx`) BEFORE the transaction opens — no currencyCode
    // set means getCurrencyDecimals() falls back to its 2dp default, which is
    // what every test in this file was already written assuming.
    businessProfile: { findFirst: vi.fn().mockResolvedValue(null) },
    $transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb(txClient)),
    __txClient: txClient
  }
}

beforeEach(() => vi.clearAllMocks())

describe('quotationService.create', () => {
  it('generates the next number inside the same transaction as the insert (no pre-transaction read)', async () => {
    const db = makeDb('QT-00003')
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await quotationService.create({ customerName: 'Walk-in', items: [{ productName: 'Widget', quantity: 2, unitPrice: 100 }] }, 'user-1')

    expect(res.success).toBe(true)
    expect((res as { data: { quotationNumber: string } }).data.quotationNumber).toBe('QT-00004')
    expect(db.__txClient.setting.create).toHaveBeenCalledWith({
      data: { settingKey: 'quotation_sequence', settingValue: '4', settingType: 'NUMBER' }
    })
    // Number generation and the insert both went through the tx client, not a
    // pre-transaction read on the outer db — the whole point of the fix.
    expect(db.__txClient.quotation.findFirst).toHaveBeenCalledTimes(1)
    expect(db.__txClient.quotation.create).toHaveBeenCalledTimes(1)
  })

  it('starts at QT-00001 when there is no legacy data', async () => {
    const db = makeDb(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await quotationService.create({ items: [{ productName: 'Widget', quantity: 1, unitPrice: 50 }] }, 'user-1')

    expect((res as { data: { quotationNumber: string } }).data.quotationNumber).toBe('QT-00001')
  })

  it('computes subtotal, discount, tax and total correctly across multiple items', async () => {
    const db = makeDb(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await quotationService.create({
      items: [
        { productName: 'A', quantity: 2, unitPrice: 100, discount: 10, taxRate: 18 }, // base 200, disc 20, taxable 180, tax 32.4
        { productName: 'B', quantity: 1, unitPrice: 50 } // base 50, disc 0, taxable 50, tax 0
      ]
    }, 'user-1')

    const data = (res as { data: { subtotal: number; discountAmount: number; taxAmount: number; totalAmount: number } }).data
    expect(data.subtotal).toBe(250)
    expect(data.discountAmount).toBe(20)
    expect(data.taxAmount).toBeCloseTo(32.4)
    expect(data.totalAmount).toBeCloseTo(262.4)
  })

  // Real bug found live (core-commerce audit): subtotal/discountAmount/
  // taxAmount/totalAmount used to be accumulated with plain `+=` on raw
  // floats — this quotation total flows straight onto a real Invoice and a
  // real customer-ledger debit once converted, so any float artifact here
  // would be carried forward permanently, not just displayed wrong.
  it('produces a clean 2-decimal subtotal for a quantity/price pair that does not divide evenly in raw float math', async () => {
    const db = makeDb(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    // 3 * 0.1 = 0.30000000000000004 in raw IEEE754 float math, not 0.3.
    expect(3 * 0.1).not.toBe(0.3)

    const res = await quotationService.create({
      items: [{ productName: 'Widget', quantity: 3, unitPrice: 0.1, discount: 0, taxRate: 0 }]
    }, 'user-1')

    const data = (res as { data: { subtotal: number; totalAmount: number } }).data
    expect(data.subtotal).toBe(0.3)
    expect(data.totalAmount).toBe(0.3)
  })
})

// Real bug found live (core-commerce audit): the per-line discountAmount/
// taxAmount recomputation inside convertToInvoice used raw float arithmetic
// (and computed taxAmount via a subtraction against the quotation item's own
// raw-float lineTotal) instead of calculateLineTotal — the same helper every
// other invoice line in this app is built from.
describe('quotationService.convertToInvoice — float precision fix', () => {
  function makeConvertDb(quotation: Record<string, unknown>) {
    const txClient: Record<string, any> = {
      invoice: { create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: 'inv-1', ...data })) },
      invoiceItem: { create: vi.fn().mockResolvedValue({}) },
      quotation: { update: vi.fn().mockResolvedValue({}) },
      setting: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
    }
    const db: Record<string, any> = {
      quotation: { findUnique: vi.fn().mockResolvedValue(quotation) },
      // resolvedProductType 'SERVICE' — skips inventory reduction entirely,
      // so this test doesn't need to mock inventory.service at all.
      product: { findUnique: vi.fn().mockResolvedValue({ productType: 'SERVICE' }) },
      businessProfile: { findFirst: vi.fn().mockResolvedValue(null) },
    }
    db.$transaction = vi.fn(async (cb: (tx: unknown) => unknown) => cb(txClient))
    return { db, txClient }
  }

  it('recomputes discountAmount/taxAmount for the converted InvoiceItem with clean 2-decimal values, not raw-float drift', async () => {
    const quotation = {
      id: 'qt-1', quotationNumber: 'QT-00001', customerId: null, invoice: null,
      subtotal: 0.3, discountAmount: 0, taxAmount: 0, totalAmount: 0.3,
      items: [{ id: 'qi-1', productId: 'prod-1', productName: 'Widget', sku: null, quantity: 3, unitPrice: 0.1, discount: 0, taxRate: 0, lineTotal: 0.3 }]
    }
    const { db, txClient } = makeConvertDb(quotation)
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(getLicenseState).mockResolvedValue({
      status: 'ACTIVE', tier: 'PAID', region: 'IN', daysSinceIssue: null, daysRemaining: null, machineMismatch: false
    })

    const res = await quotationService.convertToInvoice('qt-1', 'user-1')

    expect(res.success).toBe(true)
    const itemCreateCall = txClient.invoiceItem.create.mock.calls[0][0] as { data: { discountAmount: number; taxAmount: number; lineTotal: number } }
    // Old code: taxAmount = item.lineTotal - (item.quantity * item.unitPrice - lineDiscountAmount)
    //         = 0.3 - (3*0.1 - 0) = 0.3 - 0.30000000000000004 = a tiny nonzero float artifact, not exactly 0.
    expect(itemCreateCall.data.taxAmount).toBe(0)
    expect(itemCreateCall.data.discountAmount).toBe(0)
    expect(itemCreateCall.data.lineTotal).toBe(0.3)
  })
})

// Regression test for a real bug found+fixed 2026-07-28: convertToInvoice
// creates a full real invoice (RETAIL type, via tx.invoice.create, exactly
// like billing.service.ts's createInvoice) but had no license-enforcement
// check at all — every other invoice-creating path in the app routes
// through createInvoice's gate, this was the one that didn't, making it a
// complete bypass of the Phase 59 licensing enforcement once a TRIAL
// license expired.
describe('quotationService.convertToInvoice — license gate', () => {
  function makeFindUniqueDb() {
    const findUnique = vi.fn()
    return { quotation: { findUnique }, __findUnique: findUnique }
  }

  it('blocks conversion when the license is an expired TRIAL, before touching the database at all', async () => {
    const db = makeFindUniqueDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(getLicenseState).mockResolvedValue({
      status: 'EXPIRED', tier: 'TRIAL', region: 'IN', daysSinceIssue: 400, daysRemaining: -35, machineMismatch: false
    })

    const res = await quotationService.convertToInvoice('qt-1', 'user-1')

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('LIC-002')
    // The gate must short-circuit before any DB read — proves this is a real
    // block, not a check that happens after work is already done.
    expect(db.__findUnique).not.toHaveBeenCalled()
  })

  it('blocks conversion when a PAID license has itself expired (real annual renewal, fixed 2026-07-28 — a PAID key used to never expire at all)', async () => {
    const db = makeFindUniqueDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(getLicenseState).mockResolvedValue({
      status: 'EXPIRED', tier: 'PAID', region: 'IN', daysSinceIssue: 900, daysRemaining: -535, machineMismatch: false
    })

    const res = await quotationService.convertToInvoice('qt-1', 'user-1')

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('LIC-002')
    expect(db.__findUnique).not.toHaveBeenCalled()
  })

  it('does not block conversion for an ACTIVE PAID license', async () => {
    const db = makeFindUniqueDb()
    db.__findUnique.mockResolvedValue(null) // "quotation not found" — fine, we're only proving the gate doesn't fire
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(getLicenseState).mockResolvedValue({
      status: 'ACTIVE', tier: 'PAID', region: 'IN', daysSinceIssue: null, daysRemaining: null, machineMismatch: false
    })

    const res = await quotationService.convertToInvoice('qt-1', 'user-1')

    expect((res as { error?: { code: string } }).error?.code).not.toBe('LIC-002')
    expect(db.__findUnique).toHaveBeenCalled()
  })

  it('does not block conversion for a still-within-free-year TRIAL', async () => {
    const db = makeFindUniqueDb()
    db.__findUnique.mockResolvedValue(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(getLicenseState).mockResolvedValue({
      status: 'ACTIVE', tier: 'TRIAL', region: 'IN', daysSinceIssue: 10, daysRemaining: 355, machineMismatch: false
    })

    const res = await quotationService.convertToInvoice('qt-1', 'user-1')

    expect((res as { error?: { code: string } }).error?.code).not.toBe('LIC-002')
    expect(db.__findUnique).toHaveBeenCalled()
  })

  it('does not block conversion for a pre-Phase-59 upgraded install (NOT_ACTIVATED, tier null)', async () => {
    const db = makeFindUniqueDb()
    db.__findUnique.mockResolvedValue(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(getLicenseState).mockResolvedValue({
      status: 'NOT_ACTIVATED', tier: null, region: null, daysSinceIssue: null, daysRemaining: null, machineMismatch: false
    })

    const res = await quotationService.convertToInvoice('qt-1', 'user-1')

    expect((res as { error?: { code: string } }).error?.code).not.toBe('LIC-002')
    expect(db.__findUnique).toHaveBeenCalled()
  })
})
