// Follow-up C-4: the line total shown in the billing cart is the line that gets stored (after the line's own
// discount and its share of the invoice-level discount), and the lines add up to the header.
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../inventory.service', () => ({ inventoryService: { reduceStockTx: vi.fn() }, applyLocationDeltaTx: vi.fn() }))
vi.mock('../customer-ledger.service', () => ({ customerLedgerService: { addEntry: vi.fn() } }))
vi.mock('../industry-template.service', () => ({ isModuleEnabled: vi.fn().mockResolvedValue(false) }))
vi.mock('../notification.service', () => ({ createNotification: vi.fn() }))
vi.mock('../distributor-credit-risk.service', () => ({ getCustomerCreditRisk: vi.fn() }))
vi.mock('../auth.service', () => ({ getCurrentSession: vi.fn().mockReturnValue({ userId: 'u' }) }))
vi.mock('../kit.service', () => ({ explodeKitComponentsTx: vi.fn() }))
vi.mock('../license.service', () => ({ getLicenseState: vi.fn().mockResolvedValue({ status: 'ACTIVE', tier: 'PAID' }) }))

import { getPrisma } from '../../database/db'
import { billingService } from '../billing.service'
import { computeCartTotals } from '../../../renderer/src/shared/utils/cart-totals.util'
import { buildMoneyContext } from '../../../renderer/src/shared/utils/money-context.util'
import { computeDocumentTotals, getCurrencyDecimals, roundMoney, sumMoney } from '../../../shared/utils/money'

function rng(seed: number) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296 } }

function makeDb(currencyCode: string) {
  const items: Array<Record<string, any>> = []
  const invoices: Array<Record<string, any>> = []
  const db: Record<string, any> = {
    setting: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn(), update: vi.fn(), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    product: { findUnique: vi.fn().mockResolvedValue({ id: 'p', productName: 'W', sku: 'W', hsnCode: null, productType: 'SERVICE', taxRate: 0, isActive: true, inventory: null }), findMany: vi.fn().mockResolvedValue([]) },
    customer: { findUnique: vi.fn().mockResolvedValue(null) },
    cropSeason: { findUnique: vi.fn() },
    businessProfile: { findFirst: vi.fn().mockResolvedValue({ currencyCode, lockDate: null }) },
    chartOfAccounts: { findUnique: vi.fn().mockResolvedValue({ id: 'c', accountCode: '1000', accountName: 'Cash', accountType: 'ASSET', isActive: true }) },
    journalEntry: { create: vi.fn().mockResolvedValue({ id: 'j', entryNumber: 'J' }), findMany: vi.fn().mockResolvedValue([]) },
    invoice: { create: vi.fn(async ({ data }: any) => { const r = { id: 'i', invoiceNumber: 'I', paidAmount: 0, ...data }; invoices.push(r); if (data.items?.create) items.push(...data.items.create); return r }), findUnique: vi.fn(), findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
    invoiceItem: { create: vi.fn(async ({ data }: any) => { items.push(data); return data }) },
    payment: { create: vi.fn() },
    productBatch: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(null), update: vi.fn(), aggregate: vi.fn().mockResolvedValue({ _sum: { quantityRemaining: null } }) },
    productSerial: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
    restaurantTable: { updateMany: vi.fn() }
  }
  db.$transaction = vi.fn((arg: unknown) => (Array.isArray(arg) ? Promise.all(arg) : (arg as (tx: unknown) => unknown)(db)))
  return { db, items, invoices }
}

beforeEach(() => vi.clearAllMocks())

describe('billing cart line totals equal the stored lines', () => {
  it('worked example: 2 lines, invoice discount 20 -> the screen line is after its share, not the old figure', () => {
    const ctx = buildMoneyContext({ currencyCode: 'USD' }, {})
    const t = computeCartTotals([{ quantity: 1, unitPrice: 100, discountAmount: 0, taxRate: 10 }, { quantity: 1, unitPrice: 100, discountAmount: 0, taxRate: 10 }], 20, ctx)
    expect(t.lines.map(l => l.total)).toEqual([99, 99]) // 90 taxable + 9 tax each; the old per-line figure was 110
    expect(t.totalAmount).toBe(198)
  })

  it('1500 random carts with invoice-level discounts, both pricing modes: screen line == stored line, lines add up to the header', async () => {
    const r = rng(94)
    for (let n = 0; n < 1500; n++) {
      const currencyCode = ['INR', 'USD', 'KWD', 'JPY'][n % 4]
      const dp = getCurrencyDecimals(currencyCode)
      const inclusive = r() < 0.5
      const lines = Array.from({ length: 1 + Math.floor(r() * 4) }, () => {
        const quantity = 1 + Math.floor(r() * 6)
        const unitPrice = Math.round(r() * 90000) / 10 ** dp
        return { quantity, unitPrice, discountAmount: r() < 0.3 ? roundMoney(quantity * unitPrice * r() * 0.3, dp) : 0, taxRate: [0, 5, 18, 40][Math.floor(r() * 4)] }
      })
      const gross = lines.reduce((s, l) => s + l.quantity * l.unitPrice - l.discountAmount, 0)
      const globalDiscount = r() < 0.7 ? roundMoney(gross * r() * 0.5, dp) : 0
      const { db, items, invoices } = makeDb(currencyCode)
      vi.mocked(getPrisma).mockReturnValue(db as never)
      const res = await billingService.createInvoice({ paymentMethod: 'CASH', pricesIncludeTax: inclusive, globalDiscount, items: lines.map(l => ({ productId: 'p', ...l })) } as never)
      const ctxJson = JSON.stringify({ n, currencyCode, inclusive, lines, globalDiscount })
      if (!res.success) continue
      const shown = computeCartTotals(lines, globalDiscount, buildMoneyContext({ currencyCode }, {}), false, inclusive)
      expect({ ctxJson, v: items.map(i => i.lineTotal) }).toEqual({ ctxJson, v: shown.lines.map(l => l.total) })
      // the header is the lines plus the rounding, on screen and as stored
      expect(roundMoney(sumMoney(shown.lines.map(l => l.total), dp) + shown.roundingAmount, dp), ctxJson).toBe(shown.totalAmount)
      expect(invoices[0].totalAmount, ctxJson).toBe(shown.totalAmount)
      // and it is exactly the shared module's line for the same cart
      const direct = computeDocumentTotals(lines, { decimals: dp, roundingRule: buildMoneyContext({ currencyCode }, {}).roundingRule, globalDiscount, pricesIncludeTax: inclusive })
      expect(shown.lines.map(l => l.total), ctxJson).toEqual(direct.lines.map(l => l.total))
    }
  }, 60_000)
})
