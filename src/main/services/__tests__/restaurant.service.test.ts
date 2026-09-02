import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))
vi.mock('../inventory.service', () => ({ inventoryService: { adjustStock: vi.fn() } }))
vi.mock('../billing.service', () => ({ billingService: { createInvoice: vi.fn() } }))

import { getPrisma } from '../../database/db'
import { inventoryService } from '../inventory.service'
import { billingService } from '../billing.service'
import {
  updateKOTStatus, assignWaiter, mergeTableIntoInvoice, releaseTablesForInvoiceTx,
  getDishIngredientCostsBatch, getRecipeImpliedIngredientUsageBatch,
  createKOT, checkoutTable, getTableOrderSummary, performDailyClose,
} from '../restaurant.service'

// 2026-09-02 — a KOT's items now come from its own KOTItem rows (created
// the moment an order is accepted, independent of any Invoice) rather
// than invoice.items.
function makeKot(status: string) {
  return {
    id: 'kot-1', status, tableId: null,
    items: [{ productId: 'prod-1', quantity: 2, unitPriceSnapshot: 100, taxRateSnapshot: 0 }]
  }
}

function makeMockDb(kotStatus: string) {
  const db: Record<string, any> = {
    kOT: {
      findUnique: vi.fn().mockResolvedValue(makeKot(kotStatus)),
      count: vi.fn().mockResolvedValue(0),
      update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'kot-1', ...data })
      ),
    },
    restaurantTable: { update: vi.fn() },
    recipe: { findUnique: vi.fn().mockResolvedValue(null) },
    // Phase 67 §9.1 — Restaurant's "Combo/thali auto-pricing" signature win.
    // Empty by default (the item isn't a kit) so every pre-existing test's
    // behavior is unchanged; kit-expansion tests below override this.
    kitComponent: { findMany: vi.fn().mockResolvedValue([]) },
    inventory: { findUnique: vi.fn().mockResolvedValue(null) },
  }
  return db
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('restaurant.service.updateKOTStatus', () => {
  it('allows the normal forward transition PENDING -> IN_PROGRESS', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeMockDb('PENDING') as never)
    const res = await updateKOTStatus('kot-1', 'IN_PROGRESS')
    expect(res.success).toBe(true)
  })

  it('rejects changing status of an already-DONE KOT — prevents double ingredient deduction', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeMockDb('DONE') as never)
    const res = await updateKOTStatus('kot-1', 'CANCELLED')
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('RST-017')
    // Ingredient deduction must never even be attempted for a rejected transition
    expect(inventoryService.adjustStock).not.toHaveBeenCalled()
  })

  it('rejects re-marking a CANCELLED KOT as DONE — the DONE -> CANCELLED -> DONE double-deduction path', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeMockDb('CANCELLED') as never)
    const res = await updateKOTStatus('kot-1', 'DONE')
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('RST-017')
    expect(inventoryService.adjustStock).not.toHaveBeenCalled()
  })

  it('is a no-op-safe idempotent call when re-setting the same terminal status', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeMockDb('DONE') as never)
    const res = await updateKOTStatus('kot-1', 'DONE')
    // Same status -> same status is allowed through (status !== kot.status is false),
    // but must not re-deduct ingredients since kot.status === 'DONE' already.
    expect(res.success).toBe(true)
    expect(inventoryService.adjustStock).not.toHaveBeenCalled()
  })
})

// Phase 67 §9.1 — Restaurant's "Combo/thali auto-pricing" signature win.
// A combo/thali is a Phase 64 kit (Product.isKit + KitComponent) — kits have
// no Recipe of their own (recipes are per-dish), so marking a combo's KOT
// DONE used to silently skip ingredient-level deduction for every dish
// inside it, even though billing.service.ts's explodeKitComponentsTx
// already correctly deducts each dish's own top-level stock at sale time.
describe('restaurant.service.updateKOTStatus — kit (combo/thali) ingredient deduction', () => {
  it('expands a kit line into its component dishes and deducts each dish\'s own recipe ingredients', async () => {
    const db = makeMockDb('PENDING')
    db.kOT.findUnique = vi.fn().mockResolvedValue({
      id: 'kot-1', status: 'PENDING', tableId: null,
      items: [{ productId: 'thali-kit', quantity: 1, unitPriceSnapshot: 200, taxRateSnapshot: 0 }]
    })
    // thali-kit explodes into 2 dishes: 1x Dal, 1x Rice
    db.kitComponent.findMany = vi.fn().mockResolvedValue([
      { componentProductId: 'dal', quantity: 1 },
      { componentProductId: 'rice', quantity: 1 }
    ])
    db.recipe.findUnique = vi.fn().mockImplementation(({ where }: { where: { productId: string } }) => {
      if (where.productId === 'dal') return Promise.resolve({ recipeName: 'Dal', items: [{ ingredientProductId: 'lentils', quantity: 0.2 }] })
      if (where.productId === 'rice') return Promise.resolve({ recipeName: 'Rice', items: [{ ingredientProductId: 'raw-rice', quantity: 0.15 }] })
      return Promise.resolve(null)
    })
    db.inventory.findUnique = vi.fn().mockResolvedValue({ quantity: 10 })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateKOTStatus('kot-1', 'DONE')

    expect(res.success).toBe(true)
    expect(db.kitComponent.findMany).toHaveBeenCalledWith({ where: { kitProductId: 'thali-kit' } })
    // Both component dishes' own recipes get looked up, not the kit's own productId
    expect(db.recipe.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { productId: 'dal' } }))
    expect(db.recipe.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { productId: 'rice' } }))
    expect(db.recipe.findUnique).not.toHaveBeenCalledWith(expect.objectContaining({ where: { productId: 'thali-kit' } }))
    // Ingredients for BOTH dishes get deducted, not just one
    expect(inventoryService.adjustStock).toHaveBeenCalledWith(
      expect.objectContaining({ productId: 'lentils', quantity: 9.8 }), undefined
    )
    expect(inventoryService.adjustStock).toHaveBeenCalledWith(
      expect.objectContaining({ productId: 'raw-rice', quantity: 9.85 }), undefined
    )
  })

  it('multiplies component quantity by both the kit-component ratio and the quantity of kits sold', async () => {
    const db = makeMockDb('PENDING')
    db.kOT.findUnique = vi.fn().mockResolvedValue({
      id: 'kot-1', status: 'PENDING', tableId: null,
      // 3 thali kits sold, each needs 2x Dal per the kit's own component ratio
      items: [{ productId: 'thali-kit', quantity: 3, unitPriceSnapshot: 200, taxRateSnapshot: 0 }]
    })
    db.kitComponent.findMany = vi.fn().mockResolvedValue([{ componentProductId: 'dal', quantity: 2 }])
    db.recipe.findUnique = vi.fn().mockResolvedValue({ recipeName: 'Dal', items: [{ ingredientProductId: 'lentils', quantity: 0.2 }] })
    db.inventory.findUnique = vi.fn().mockResolvedValue({ quantity: 100 })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await updateKOTStatus('kot-1', 'DONE')

    // 3 kits x 2 dal-per-kit x 0.2 lentils-per-dal = 1.2 lentils needed
    expect(inventoryService.adjustStock).toHaveBeenCalledWith(
      expect.objectContaining({ productId: 'lentils', quantity: 98.8 }), undefined
    )
  })

  it('a non-kit item still deducts its own recipe directly, unchanged from before this fix', async () => {
    const db = makeMockDb('PENDING')
    // kitComponent.findMany returns [] (default) — this item is a plain dish, not a kit
    db.recipe.findUnique = vi.fn().mockResolvedValue({ recipeName: 'Butter Chicken', items: [{ ingredientProductId: 'chicken', quantity: 0.25 }] })
    db.inventory.findUnique = vi.fn().mockResolvedValue({ quantity: 50 })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await updateKOTStatus('kot-1', 'DONE')

    expect(db.recipe.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { productId: 'prod-1' } }))
    expect(inventoryService.adjustStock).toHaveBeenCalledWith(
      expect.objectContaining({ productId: 'chicken', quantity: 49.5 }), undefined
    )
  })
})

// 2026-09-02 — real bug found+fixed: a customer scanning the table QR
// again mid-meal used to land on a SEPARATE invoice from their first
// order. Fixed by deferring invoicing entirely: createKOT never touches
// Invoice, and checkoutTable is the ONE place a table's running,
// un-invoiced tab finally gets billed — this suite is the money-math
// coverage for that consolidation.
describe('restaurant.service.createKOT', () => {
  it('creates a KOT with its own KOTItem rows and no invoiceId when none is passed (table-tab path)', async () => {
    const createSpy = vi.fn().mockResolvedValue({ id: 'kot-1' })
    const db: Record<string, any> = {
      kOT: { create: createSpy },
      restaurantTable: { update: vi.fn().mockResolvedValue({}) },
      $transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb(db)),
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createKOT([{ productId: 'prod-1', quantity: 2, unitPrice: 100, taxRate: 5 }], 'table-1', 'user-1')

    expect(res.success).toBe(true)
    expect(createSpy).toHaveBeenCalledWith({
      data: {
        invoiceId: null, tableId: 'table-1', status: 'PENDING',
        items: { create: [{ productId: 'prod-1', quantity: 2, unitPriceSnapshot: 100, taxRateSnapshot: 5 }] }
      }
    })
  })

  it('rejects a KOT with zero items', async () => {
    const res = await createKOT([], 'table-1')
    expect(res.success).toBe(false)
  })

  it('links immediately to an existing invoice when one is explicitly passed (counter/takeaway "Send to Kitchen" path)', async () => {
    const createSpy = vi.fn().mockResolvedValue({ id: 'kot-1' })
    const db: Record<string, any> = {
      invoice: { findUnique: vi.fn().mockResolvedValue({ id: 'inv-1' }) },
      kOT: { findUnique: vi.fn().mockResolvedValue(null), create: createSpy },
      restaurantTable: { update: vi.fn().mockResolvedValue({}) },
      $transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb(db)),
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createKOT([{ productId: 'prod-1', quantity: 1, unitPrice: 50 }], undefined, 'user-1', 'inv-1')

    expect(res.success).toBe(true)
    expect(createSpy.mock.calls[0][0].data.invoiceId).toBe('inv-1')
  })
})

describe('restaurant.service.checkoutTable', () => {
  function makeCheckoutDb(openKots: Array<{ id: string; status?: string; items: Array<{ productId: string; quantity: number; unitPriceSnapshot: number; taxRateSnapshot: number }> }>) {
    const db: Record<string, any> = {
      restaurantTable: { findUnique: vi.fn().mockResolvedValue({ id: 'table-1' }), update: vi.fn().mockResolvedValue({}) },
      kOT: { findMany: vi.fn().mockResolvedValue(openKots), updateMany: vi.fn().mockResolvedValue({ count: openKots.length }) },
    }
    return db
  }

  it('rejects checkout when the table has nothing un-invoiced to bill', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeCheckoutDb([]) as never)
    const res = await checkoutTable('table-1', { paymentMethod: 'CASH' })
    expect(res.success).toBe(false)
    expect(billingService.createInvoice).not.toHaveBeenCalled()
  })

  it('sums the same product ordered across two separate rounds into one invoice line, not two', async () => {
    const db = makeCheckoutDb([
      { id: 'kot-1', items: [{ productId: 'prod-1', quantity: 2, unitPriceSnapshot: 100, taxRateSnapshot: 5 }] },
      { id: 'kot-2', items: [{ productId: 'prod-1', quantity: 1, unitPriceSnapshot: 100, taxRateSnapshot: 5 }] },
    ])
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: true, data: { id: 'inv-1' } } as never)

    const res = await checkoutTable('table-1', { paymentMethod: 'CASH' }, 'user-1')

    expect(res.success).toBe(true)
    const invoiceArg = vi.mocked(billingService.createInvoice).mock.calls[0][0]
    expect(invoiceArg.items).toEqual([{ productId: 'prod-1', quantity: 3, unitPrice: 100, discountAmount: 0, taxRate: 5 }])
    expect(invoiceArg.tableIds).toEqual(['table-1'])
  })

  it('bills two different rounds as two separate line items when the products differ', async () => {
    const db = makeCheckoutDb([
      { id: 'kot-1', items: [{ productId: 'prod-1', quantity: 1, unitPriceSnapshot: 100, taxRateSnapshot: 5 }] },
      { id: 'kot-2', items: [{ productId: 'prod-2', quantity: 2, unitPriceSnapshot: 50, taxRateSnapshot: 0 }] },
    ])
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: true, data: { id: 'inv-1' } } as never)

    await checkoutTable('table-1', { paymentMethod: 'CASH' })

    const invoiceArg = vi.mocked(billingService.createInvoice).mock.calls[0][0]
    expect(invoiceArg.items).toEqual([
      { productId: 'prod-1', quantity: 1, unitPrice: 100, discountAmount: 0, taxRate: 5 },
      { productId: 'prod-2', quantity: 2, unitPrice: 50, discountAmount: 0, taxRate: 0 },
    ])
  })

  it('back-fills invoiceId on every included KOT and clears checkoutRequestedAt', async () => {
    const db = makeCheckoutDb([
      { id: 'kot-1', items: [{ productId: 'prod-1', quantity: 1, unitPriceSnapshot: 100, taxRateSnapshot: 0 }] },
      { id: 'kot-2', items: [{ productId: 'prod-2', quantity: 1, unitPriceSnapshot: 50, taxRateSnapshot: 0 }] },
    ])
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: true, data: { id: 'inv-1' } } as never)

    await checkoutTable('table-1', { paymentMethod: 'CASH' })

    expect(db.kOT.updateMany).toHaveBeenCalledWith({ where: { id: { in: ['kot-1', 'kot-2'] } }, data: { invoiceId: 'inv-1' } })
    expect(db.restaurantTable.update).toHaveBeenCalledWith({ where: { id: 'table-1' }, data: { checkoutRequestedAt: null } })
  })

  it('does not fail the whole checkout when createInvoice fails, and reports its error', async () => {
    const db = makeCheckoutDb([{ id: 'kot-1', items: [{ productId: 'prod-1', quantity: 1, unitPriceSnapshot: 100, taxRateSnapshot: 0 }] }])
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: false, error: { code: 'INV-002', message: 'Insufficient stock' } } as never)

    const res = await checkoutTable('table-1', { paymentMethod: 'CASH' })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('INV-002')
    expect(db.kOT.updateMany).not.toHaveBeenCalled()
  })
})

describe('restaurant.service.getTableOrderSummary', () => {
  it('aggregates un-invoiced rounds and computes an estimated total', async () => {
    const db: Record<string, any> = {
      kOT: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'kot-1', status: 'IN_PROGRESS', createdAt: new Date('2026-09-02T10:00:00'), items: [{ productId: 'prod-1', quantity: 2, unitPriceSnapshot: 100, taxRateSnapshot: 0 }] },
          { id: 'kot-2', status: 'PENDING', createdAt: new Date('2026-09-02T10:15:00'), items: [{ productId: 'prod-1', quantity: 1, unitPriceSnapshot: 100, taxRateSnapshot: 0 }] },
        ]),
      },
      product: { findMany: vi.fn().mockResolvedValue([{ id: 'prod-1', productName: 'Paneer Tikka' }]) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getTableOrderSummary('table-1')

    expect(res.success).toBe(true)
    const data = (res as { data: { aggregated: Array<{ productId: string; quantity: number }>; estimatedTotal: number; rounds: unknown[] } }).data
    expect(data.aggregated).toEqual([{ productId: 'prod-1', productName: 'Paneer Tikka', quantity: 3, unitPrice: 100 }])
    expect(data.estimatedTotal).toBe(300)
    expect(data.rounds).toHaveLength(2)
  })
})

describe('restaurant.service.assignWaiter', () => {
  it('assigns a waiter to a table', async () => {
    const update = vi.fn().mockResolvedValue({ id: 'table-1', waiterId: 'emp-1', waiter: { id: 'emp-1', fullName: 'Ravi' } })
    vi.mocked(getPrisma).mockReturnValue({ restaurantTable: { update } } as never)

    const res = await assignWaiter('table-1', 'emp-1')

    expect(res.success).toBe(true)
    expect(update).toHaveBeenCalledWith({
      where: { id: 'table-1' },
      data: { waiterId: 'emp-1' },
      include: { waiter: { select: { id: true, fullName: true } } },
    })
    expect((res as { data: { waiterId: string } }).data.waiterId).toBe('emp-1')
  })

  it('clears an assignment back to unassigned when waiterId is null', async () => {
    const update = vi.fn().mockResolvedValue({ id: 'table-1', waiterId: null, waiter: null })
    vi.mocked(getPrisma).mockReturnValue({ restaurantTable: { update } } as never)

    const res = await assignWaiter('table-1', null)

    expect(res.success).toBe(true)
    expect(update).toHaveBeenCalledWith({
      where: { id: 'table-1' },
      data: { waiterId: null },
      include: { waiter: { select: { id: true, fullName: true } } },
    })
    expect((res as { data: { waiterId: string | null } }).data.waiterId).toBeNull()
  })
})

// REAL BUG found+fixed 2026-07-30: releaseTablesForInvoiceTx used to release
// on a single invoiceId reaching PAID/CANCELLED with no awareness that
// billing.service.ts's splitInvoice() turns one table's tab into N sibling
// invoices while re-pointing the table at only the first child — paying off
// that first split check released the table while other split checks were
// still fully unpaid. Fixed to resolve the whole split group and only
// release once every invoice in it is settled. See restaurant.service.ts's
// doc comment on the function for the full write-up.
describe('restaurant.service.releaseTablesForInvoiceTx', () => {
  function makeTx(invoices: Array<{ id: string; status: string; paymentStatus: string; splitFromInvoiceId?: string | null }>) {
    return {
      invoice: {
        findUnique: vi.fn(({ where }: { where: { id: string } }) => {
          const inv = invoices.find(i => i.id === where.id)
          return Promise.resolve(inv ? { splitFromInvoiceId: inv.splitFromInvoiceId ?? null } : null)
        }),
        findMany: vi.fn(({ where }: { where: { OR: [{ id: string }, { splitFromInvoiceId: string }] } }) => {
          const rootId = where.OR[0].id
          return Promise.resolve(invoices.filter(i => i.id === rootId || i.splitFromInvoiceId === rootId))
        })
      },
      restaurantTable: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) }
    }
  }

  it('releases a non-split invoice\'s table once it is PAID (unchanged happy path)', async () => {
    const tx = makeTx([{ id: 'inv-1', status: 'ACTIVE', paymentStatus: 'PAID' }])
    await releaseTablesForInvoiceTx(tx as never, 'inv-1')
    expect(tx.restaurantTable.updateMany).toHaveBeenCalledWith({
      where: { currentInvoiceId: { in: ['inv-1'] } },
      data: { currentInvoiceId: null, status: 'AVAILABLE' }
    })
  })

  it('does NOT release the table when one split-bill sibling is still unpaid', async () => {
    // original split into B (paid) and C (still unpaid) — table currently points at B
    const tx = makeTx([
      { id: 'orig-1', status: 'SPLIT', paymentStatus: 'PAID' },
      { id: 'split-B', status: 'ACTIVE', paymentStatus: 'PAID', splitFromInvoiceId: 'orig-1' },
      { id: 'split-C', status: 'ACTIVE', paymentStatus: 'UNPAID', splitFromInvoiceId: 'orig-1' }
    ])
    await releaseTablesForInvoiceTx(tx as never, 'split-B')
    expect(tx.restaurantTable.updateMany).not.toHaveBeenCalled()
  })

  it('releases the table once every split-bill sibling is settled, matching on any invoice id in the group', async () => {
    const tx = makeTx([
      { id: 'orig-1', status: 'SPLIT', paymentStatus: 'PAID' },
      { id: 'split-B', status: 'ACTIVE', paymentStatus: 'PAID', splitFromInvoiceId: 'orig-1' },
      { id: 'split-C', status: 'ACTIVE', paymentStatus: 'PAID', splitFromInvoiceId: 'orig-1' }
    ])
    // The table's currentInvoiceId points at split-B, but split-C is the one that just got paid
    await releaseTablesForInvoiceTx(tx as never, 'split-C')
    expect(tx.restaurantTable.updateMany).toHaveBeenCalledWith({
      where: { currentInvoiceId: { in: ['orig-1', 'split-B', 'split-C'] } },
      data: { currentInvoiceId: null, status: 'AVAILABLE' }
    })
  })
})

describe('restaurant.service.mergeTableIntoInvoice', () => {
  function makeMergeDb(overrides: { invoice?: Record<string, unknown> | null; claimCount?: number; hasOpenKot?: boolean } = {}) {
    const invoice = overrides.invoice === undefined ? { id: 'inv-1', status: 'ACTIVE', paymentStatus: 'UNPAID' } : overrides.invoice
    return {
      invoice: { findUnique: vi.fn().mockResolvedValue(invoice) },
      restaurantTable: {
        updateMany: vi.fn().mockResolvedValue({ count: overrides.claimCount ?? 1 }),
        findUnique: vi.fn().mockResolvedValue({ id: 'table-6', currentInvoiceId: 'inv-1', status: 'OCCUPIED' }),
      },
      // 2026-09-02 — a table with no currentInvoiceId can now still have
      // its own open, un-invoiced KOTs (deferred-billing model); default to
      // "none" here so the pre-existing tests below still exercise the
      // claim/invoice-state logic they were written for.
      kOT: { findFirst: vi.fn().mockResolvedValue(overrides.hasOpenKot ? { id: 'kot-open' } : null) },
    }
  }

  it('merges a free table into a running, unpaid order', async () => {
    const db = makeMergeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await mergeTableIntoInvoice('table-6', 'inv-1')

    expect(res.success).toBe(true)
    expect(db.restaurantTable.updateMany).toHaveBeenCalledWith({
      where: { id: 'table-6', currentInvoiceId: null },
      data: { currentInvoiceId: 'inv-1', status: 'OCCUPIED' }
    })
  })

  it('rejects merging into an invoice that no longer exists', async () => {
    const db = makeMergeDb({ invoice: null })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await mergeTableIntoInvoice('table-6', 'missing')

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('RST-040')
  })

  it('rejects merging into an invoice that is not ACTIVE (e.g. already SPLIT or CANCELLED)', async () => {
    const db = makeMergeDb({ invoice: { id: 'inv-1', status: 'SPLIT', paymentStatus: 'PAID' } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await mergeTableIntoInvoice('table-6', 'inv-1')

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('RST-041')
  })

  it('rejects merging into an invoice that is already fully paid', async () => {
    const db = makeMergeDb({ invoice: { id: 'inv-1', status: 'ACTIVE', paymentStatus: 'PAID' } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await mergeTableIntoInvoice('table-6', 'inv-1')

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('RST-041')
  })

  it('rejects merging a table that is already part of another running order', async () => {
    const db = makeMergeDb({ claimCount: 0 })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await mergeTableIntoInvoice('table-6', 'inv-1')

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('RST-042')
  })

  it('rejects merging a table that has its own open, un-invoiced KOT — would silently orphan it', async () => {
    const db = makeMergeDb({ hasOpenKot: true })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await mergeTableIntoInvoice('table-6', 'inv-1')

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('RST-044')
    expect(db.restaurantTable.updateMany).not.toHaveBeenCalled()
  })
})

// Phase 67 §9.1 — Restaurant: Dish-Wise Contribution Margin's cost side.
// Shares deductIngredients()'s own kit-expansion logic so a combo's margin
// reflects the sum of its real component dishes' recipes.
describe('restaurant.service.getDishIngredientCostsBatch', () => {
  beforeEach(() => vi.clearAllMocks())

  function makeCostDb(overrides: Record<string, unknown> = {}) {
    const db: Record<string, any> = {
      kitComponent: { findMany: vi.fn().mockResolvedValue([]) },
      recipe: { findMany: vi.fn().mockResolvedValue([]) },
      product: { findMany: vi.fn().mockResolvedValue([]) },
      inventory: { findMany: vi.fn().mockResolvedValue([]) },
      ...overrides
    }
    return db
  }

  it('returns 0 for a product with no recipe at all', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeCostDb() as never)

    const result = await getDishIngredientCostsBatch(['dish-no-recipe'])

    expect(result.get('dish-no-recipe')).toBe(0)
  })

  it('computes a non-kit dish\'s cost as recipe quantity times ingredient cost', async () => {
    const db = makeCostDb({
      recipe: { findMany: vi.fn().mockResolvedValue([{ productId: 'dish-1', items: [{ ingredientProductId: 'ing-1', quantity: 4 }] }]) },
      product: { findMany: vi.fn().mockResolvedValue([{ id: 'ing-1', costPrice: 5, valuationMethod: 'WEIGHTED_AVERAGE', standardCost: null }]) },
      inventory: { findMany: vi.fn().mockResolvedValue([{ productId: 'ing-1', averageCost: 12, quantity: 100 }]) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await getDishIngredientCostsBatch(['dish-1'])

    expect(result.get('dish-1')).toBe(48) // 4 * 12
  })

  it('expands a kit/combo into its component dishes\' recipes rather than looking for the combo\'s own (nonexistent) recipe', async () => {
    const db = makeCostDb({
      kitComponent: { findMany: vi.fn().mockResolvedValue([
        { kitProductId: 'combo-1', componentProductId: 'dish-a', quantity: 2 },
        { kitProductId: 'combo-1', componentProductId: 'dish-b', quantity: 1 },
      ]) },
      recipe: { findMany: vi.fn().mockResolvedValue([
        { productId: 'dish-a', items: [{ ingredientProductId: 'ing-1', quantity: 1 }] },
        { productId: 'dish-b', items: [{ ingredientProductId: 'ing-1', quantity: 3 }] },
      ]) },
      product: { findMany: vi.fn().mockResolvedValue([{ id: 'ing-1', costPrice: 5, valuationMethod: 'WEIGHTED_AVERAGE', standardCost: null }]) },
      inventory: { findMany: vi.fn().mockResolvedValue([{ productId: 'ing-1', averageCost: 10, quantity: 100 }]) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await getDishIngredientCostsBatch(['combo-1'])

    // dish-a: 1 * 10 = 10, weighted by kit qty 2 = 20; dish-b: 3 * 10 = 30, weighted by kit qty 1 = 30; total 50
    expect(result.get('combo-1')).toBe(50)
  })

  it('resolves multiple distinct products in one batched call without cross-contamination', async () => {
    const db = makeCostDb({
      recipe: { findMany: vi.fn().mockResolvedValue([
        { productId: 'dish-1', items: [{ ingredientProductId: 'ing-1', quantity: 1 }] },
        { productId: 'dish-2', items: [{ ingredientProductId: 'ing-2', quantity: 1 }] },
      ]) },
      product: { findMany: vi.fn().mockResolvedValue([
        { id: 'ing-1', costPrice: 5, valuationMethod: 'WEIGHTED_AVERAGE', standardCost: null },
        { id: 'ing-2', costPrice: 5, valuationMethod: 'WEIGHTED_AVERAGE', standardCost: null },
      ]) },
      inventory: { findMany: vi.fn().mockResolvedValue([
        { productId: 'ing-1', averageCost: 7, quantity: 100 },
        { productId: 'ing-2', averageCost: 20, quantity: 100 },
      ]) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await getDishIngredientCostsBatch(['dish-1', 'dish-2'])

    expect(result.get('dish-1')).toBe(7)
    expect(result.get('dish-2')).toBe(20)
  })
})

// Phase 67 §9.1 — Restaurant: Recipe-vs-Actual Waste Variance's implied
// side. Shares the same kit-expansion as getDishIngredientCostsBatch, but
// aggregates ingredient QUANTITY across every dish sold, not cost per dish.
describe('restaurant.service.getRecipeImpliedIngredientUsageBatch', () => {
  beforeEach(() => vi.clearAllMocks())

  function makeUsageDb(overrides: Record<string, unknown> = {}) {
    const db: Record<string, any> = {
      kitComponent: { findMany: vi.fn().mockResolvedValue([]) },
      recipe: { findMany: vi.fn().mockResolvedValue([]) },
      ...overrides
    }
    return db
  }

  it('returns an empty map for a dish with no recipe', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeUsageDb() as never)

    const result = await getRecipeImpliedIngredientUsageBatch([{ productId: 'dish-no-recipe', quantity: 5 }])

    expect(result.size).toBe(0)
  })

  it('multiplies recipe quantity by units sold for a non-kit dish', async () => {
    const db = makeUsageDb({
      recipe: { findMany: vi.fn().mockResolvedValue([{ productId: 'dish-1', items: [{ ingredientProductId: 'ing-1', quantity: 3 }] }]) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await getRecipeImpliedIngredientUsageBatch([{ productId: 'dish-1', quantity: 4 }])

    expect(result.get('ing-1')).toBe(12) // 3 * 4
  })

  it('expands a kit/combo sale into its component dishes\' recipes, weighted by kit quantity and units sold', async () => {
    const db = makeUsageDb({
      kitComponent: { findMany: vi.fn().mockResolvedValue([
        { kitProductId: 'combo-1', componentProductId: 'dish-a', quantity: 2 },
        { kitProductId: 'combo-1', componentProductId: 'dish-b', quantity: 1 },
      ]) },
      recipe: { findMany: vi.fn().mockResolvedValue([
        { productId: 'dish-a', items: [{ ingredientProductId: 'ing-1', quantity: 1 }] },
        { productId: 'dish-b', items: [{ ingredientProductId: 'ing-1', quantity: 3 }] },
      ]) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await getRecipeImpliedIngredientUsageBatch([{ productId: 'combo-1', quantity: 2 }])

    // dish-a: 1 * (2 kit qty * 2 sold) = 4; dish-b: 3 * (1 kit qty * 2 sold) = 6; total 10
    expect(result.get('ing-1')).toBe(10)
  })

  it('aggregates the SAME ingredient across multiple different dishes sold', async () => {
    const db = makeUsageDb({
      recipe: { findMany: vi.fn().mockResolvedValue([
        { productId: 'dish-1', items: [{ ingredientProductId: 'ing-shared', quantity: 2 }] },
        { productId: 'dish-2', items: [{ ingredientProductId: 'ing-shared', quantity: 5 }] },
      ]) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await getRecipeImpliedIngredientUsageBatch([
      { productId: 'dish-1', quantity: 3 },
      { productId: 'dish-2', quantity: 1 },
    ])

    expect(result.get('ing-shared')).toBe(11) // (2*3) + (5*1)
  })
})

// 2026-09-02 — real bug found during the post-deferred-billing audit pass:
// under the old model, every OCCUPIED table always had a currentInvoiceId
// by construction, so force-freeing every occupied table at end of day was
// safe. Under the new model a table is routinely OCCUPIED with real,
// un-invoiced KOTs sitting on it — force-freeing it would let the NEXT
// party seated there get checkoutTable()'d into the PREVIOUS party's
// unpaid food (its query only cares about tableId + invoiceId:null, not
// "which seating"). performDailyClose must skip any table with an open KOT.
describe('restaurant.service.performDailyClose', () => {
  function makeSummaryDb(overrides: Record<string, any> = {}) {
    return {
      kOT: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]) },
      invoice: { findMany: vi.fn().mockResolvedValue([]) },
      restaurantTable: { findMany: vi.fn().mockResolvedValue([]), update: vi.fn().mockResolvedValue({}), count: vi.fn().mockResolvedValue(0) },
      ...overrides,
    }
  }

  it('frees a table with no open KOTs, clearing status and currentInvoiceId', async () => {
    const db = makeSummaryDb({
      restaurantTable: {
        findMany: vi.fn().mockResolvedValue([{ id: 'table-1' }]),
        update: vi.fn().mockResolvedValue({}),
        count: vi.fn().mockResolvedValue(0),
      },
      kOT: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await performDailyClose('user-1')

    expect(res.success).toBe(true)
    expect(db.restaurantTable.update).toHaveBeenCalledWith({ where: { id: 'table-1' }, data: { status: 'AVAILABLE', currentInvoiceId: null } })
    expect((res as { data: { skippedUnsettledTables: number } }).data.skippedUnsettledTables).toBe(0)
  })

  it('skips freeing a table that still has an open, un-invoiced KOT — and reports it', async () => {
    const db = makeSummaryDb({
      restaurantTable: {
        findMany: vi.fn().mockResolvedValue([{ id: 'table-1' }, { id: 'table-2' }]),
        update: vi.fn().mockResolvedValue({}),
        count: vi.fn().mockResolvedValue(1),
      },
      kOT: {
        findFirst: vi.fn().mockImplementation(({ where }: { where: { tableId: string } }) =>
          Promise.resolve(where.tableId === 'table-1' ? { id: 'kot-open' } : null)
        ),
        findMany: vi.fn().mockResolvedValue([]),
      },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await performDailyClose('user-1')

    expect(res.success).toBe(true)
    // table-1 has an open KOT — never freed.
    expect(db.restaurantTable.update).not.toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'table-1' } }))
    // table-2 has no open KOT — freed normally.
    expect(db.restaurantTable.update).toHaveBeenCalledWith({ where: { id: 'table-2' }, data: { status: 'AVAILABLE', currentInvoiceId: null } })
    expect((res as { data: { skippedUnsettledTables: number } }).data.skippedUnsettledTables).toBe(1)
  })

  it('an open but CANCELLED-only KOT does not block freeing the table', async () => {
    // The hasOpenKot check itself filters status != CANCELLED — this just
    // confirms the query the mock stands in for is exercised correctly
    // when the real DB would return no rows for a cancelled-only table.
    const db = makeSummaryDb({
      restaurantTable: {
        findMany: vi.fn().mockResolvedValue([{ id: 'table-1' }]),
        update: vi.fn().mockResolvedValue({}),
        count: vi.fn().mockResolvedValue(0),
      },
      kOT: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await performDailyClose()

    expect(db.kOT.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { tableId: 'table-1', invoiceId: null, status: { not: 'CANCELLED' } },
    }))
    expect(db.restaurantTable.update).toHaveBeenCalledWith({ where: { id: 'table-1' }, data: { status: 'AVAILABLE', currentInvoiceId: null } })
  })
})
