import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))
vi.mock('../inventory.service', () => ({ inventoryService: { adjustStock: vi.fn() } }))

import { getPrisma } from '../../database/db'
import { inventoryService } from '../inventory.service'
import { updateKOTStatus, assignWaiter, mergeTableIntoInvoice, releaseTablesForInvoiceTx } from '../restaurant.service'

function makeKot(status: string) {
  return {
    id: 'kot-1', status, tableId: null,
    invoice: { items: [{ productId: 'prod-1', quantity: 2, product: {} }] }
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
      invoice: { items: [{ productId: 'thali-kit', quantity: 1, product: { isKit: true } }] }
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
      invoice: { items: [{ productId: 'thali-kit', quantity: 3, product: { isKit: true } }] }
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
  function makeMergeDb(overrides: { invoice?: Record<string, unknown> | null; claimCount?: number } = {}) {
    const invoice = overrides.invoice === undefined ? { id: 'inv-1', status: 'ACTIVE', paymentStatus: 'UNPAID' } : overrides.invoice
    return {
      invoice: { findUnique: vi.fn().mockResolvedValue(invoice) },
      restaurantTable: {
        updateMany: vi.fn().mockResolvedValue({ count: overrides.claimCount ?? 1 }),
        findUnique: vi.fn().mockResolvedValue({ id: 'table-6', currentInvoiceId: 'inv-1', status: 'OCCUPIED' }),
      },
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
})
