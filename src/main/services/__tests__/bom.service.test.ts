import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))

import { getPrisma } from '../../database/db'
import { upsertBom } from '../bom.service'

function makeMockDb(opts: {
  product?: { productName: string } | null
  existingBom?: { id: string; description: string | null; outputQty: number } | null
  otherBoms?: Array<{ productId: string; isActive: boolean; items: Array<{ componentProductId: string | null }> }>
} = {}) {
  const db: Record<string, any> = {
    product: { findUnique: vi.fn().mockResolvedValue(opts.product ?? { productName: 'Finished Widget' }) },
    billOfMaterial: {
      // Real callers use two different lookups: by productId (checking for
      // an existing BOM before create/update) and by id (the final re-fetch
      // with items included, after the transaction writes) — a single
      // canned return value can't serve both correctly.
      findUnique: vi.fn().mockImplementation(({ where }: { where: { productId?: string; id?: string } }) => {
        if (where.id) {
          return Promise.resolve({
            id: where.id, productId: 'prod-1', description: null, outputQty: 1, isActive: true, createdAt: new Date(),
            product: { productName: 'Finished Widget' }, items: []
          })
        }
        return Promise.resolve(opts.existingBom ?? null)
      }),
      findMany: vi.fn().mockResolvedValue(opts.otherBoms ?? []),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: 'bom-new', ...data })),
      update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: opts.existingBom?.id ?? 'bom-new', ...data })),
    },
    billOfMaterialItem: {
      deleteMany: vi.fn().mockResolvedValue({}),
      createMany: vi.fn().mockResolvedValue({}),
    },
  }
  db.$transaction = vi.fn(async (cb: (tx: unknown) => unknown) => cb(db))
  return db
}

describe('bom.service.upsertBom — Phase 58 §2 multi-level BOM', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects a line with neither a raw material nor a component product', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await upsertBom({ productId: 'prod-1', items: [{ quantityNeeded: 1 }] })
    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('BOM-009')
  })

  it('rejects a line with BOTH a raw material and a component product', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await upsertBom({ productId: 'prod-1', items: [{ rawMaterialId: 'rm-1', componentProductId: 'prod-2', quantityNeeded: 1 }] })
    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('BOM-009')
  })

  it('rejects a product being a component of its own BOM', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await upsertBom({ productId: 'prod-1', items: [{ componentProductId: 'prod-1', quantityNeeded: 1 }] })
    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('BOM-010')
  })

  it('accepts a valid mix of raw-material and component-product lines', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await upsertBom({
      productId: 'prod-1',
      items: [
        { rawMaterialId: 'rm-1', quantityNeeded: 2 },
        { componentProductId: 'prod-sub', quantityNeeded: 1 }
      ]
    })
    expect(res.success).toBe(true)
    expect(db.billOfMaterialItem.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ rawMaterialId: 'rm-1', componentProductId: null }),
        expect.objectContaining({ rawMaterialId: null, componentProductId: 'prod-sub' })
      ]
    })
  })

  it('rejects a direct circular BOM (component\'s own BOM includes the parent product back)', async () => {
    // prod-1's BOM wants to use prod-sub as a component; prod-sub's own BOM
    // already uses prod-1 as a component — a genuine cycle.
    const db = makeMockDb({
      otherBoms: [{ productId: 'prod-sub', isActive: true, items: [{ componentProductId: 'prod-1' }] }]
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await upsertBom({ productId: 'prod-1', items: [{ componentProductId: 'prod-sub', quantityNeeded: 1 }] })
    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('BOM-011')
  })

  it('rejects a multi-level circular BOM (cycle two hops away)', async () => {
    // prod-1 -> prod-a -> prod-b -> prod-1 (cycle at depth 2)
    const db = makeMockDb({
      otherBoms: [
        { productId: 'prod-a', isActive: true, items: [{ componentProductId: 'prod-b' }] },
        { productId: 'prod-b', isActive: true, items: [{ componentProductId: 'prod-1' }] }
      ]
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await upsertBom({ productId: 'prod-1', items: [{ componentProductId: 'prod-a', quantityNeeded: 1 }] })
    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('BOM-011')
  })

  it('allows a genuine multi-level BOM with no cycle', async () => {
    // prod-1 -> prod-a -> prod-b (a plain raw material, no further component chain)
    const db = makeMockDb({
      otherBoms: [
        { productId: 'prod-a', isActive: true, items: [{ componentProductId: null }] }
      ]
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await upsertBom({ productId: 'prod-1', items: [{ componentProductId: 'prod-a', quantityNeeded: 1 }] })
    expect(res.success).toBe(true)
  })
})
