import { describe, it, expect, vi } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))

import { getPrisma } from '../../database/db'
import { kitService, explodeKitComponentsTx } from '../kit.service'

function makeDb(overrides: Record<string, unknown> = {}) {
  const tx = {
    kitComponent: { deleteMany: vi.fn().mockResolvedValue({}), createMany: vi.fn().mockResolvedValue({}) },
    product: { update: vi.fn().mockResolvedValue({}) }
  }
  const db = {
    product: {
      findUnique: vi.fn().mockResolvedValue({ id: 'kit-1', isKit: false }),
      findMany: vi.fn().mockResolvedValue([{ id: 'p1', productName: 'Widget', isActive: true, isKit: false }])
    },
    kitComponent: { findMany: vi.fn().mockResolvedValue([]) },
    $transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb(tx)),
    __tx: tx,
    ...overrides
  } as Record<string, any>
  vi.mocked(getPrisma).mockReturnValue(db as never)
  return db
}

describe('kitService.setComponents', () => {
  it('creates a real KitComponent row per component and flips isKit on the parent product', async () => {
    const db = makeDb()
    const result = await kitService.setComponents({ kitProductId: 'kit-1', components: [{ componentProductId: 'p1', quantity: 2 }] })

    expect(result.success).toBe(true)
    expect(db.__tx.kitComponent.deleteMany).toHaveBeenCalledWith({ where: { kitProductId: 'kit-1' } })
    expect(db.__tx.kitComponent.createMany).toHaveBeenCalledWith({
      data: [{ kitProductId: 'kit-1', componentProductId: 'p1', quantity: 2 }]
    })
    expect(db.__tx.product.update).toHaveBeenCalledWith({ where: { id: 'kit-1' }, data: { isKit: true } })
  })

  it('does not re-flip isKit when the product is already a kit (idempotent)', async () => {
    const db = makeDb({ product: { findUnique: vi.fn().mockResolvedValue({ id: 'kit-1', isKit: true }), findMany: vi.fn().mockResolvedValue([{ id: 'p1', productName: 'Widget', isActive: true, isKit: false }]) } })
    await kitService.setComponents({ kitProductId: 'kit-1', components: [{ componentProductId: 'p1', quantity: 2 }] })
    expect(db.__tx.product.update).not.toHaveBeenCalled()
  })

  it('rejects an empty component list', async () => {
    makeDb()
    const result = await kitService.setComponents({ kitProductId: 'kit-1', components: [] })
    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('KIT-001')
  })

  it('rejects a zero or negative component quantity', async () => {
    makeDb()
    const result = await kitService.setComponents({ kitProductId: 'kit-1', components: [{ componentProductId: 'p1', quantity: 0 }] })
    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('KIT-002')
  })

  it('rejects a kit including itself as a component', async () => {
    makeDb()
    const result = await kitService.setComponents({ kitProductId: 'kit-1', components: [{ componentProductId: 'kit-1', quantity: 1 }] })
    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('KIT-003')
  })

  it('rejects a duplicate component product in the same list', async () => {
    makeDb()
    const result = await kitService.setComponents({
      kitProductId: 'kit-1', components: [{ componentProductId: 'p1', quantity: 1 }, { componentProductId: 'p1', quantity: 2 }]
    })
    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('KIT-004')
  })

  it('rejects an archived component product', async () => {
    makeDb({ product: { findUnique: vi.fn().mockResolvedValue({ id: 'kit-1', isKit: false }), findMany: vi.fn().mockResolvedValue([{ id: 'p1', productName: 'Widget', isActive: false, isKit: false }]) } })
    const result = await kitService.setComponents({ kitProductId: 'kit-1', components: [{ componentProductId: 'p1', quantity: 1 }] })
    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('PRD-005')
  })

  it('rejects nesting a kit inside another kit (one level deep only)', async () => {
    makeDb({ product: { findUnique: vi.fn().mockResolvedValue({ id: 'kit-1', isKit: false }), findMany: vi.fn().mockResolvedValue([{ id: 'p1', productName: 'Sub-kit', isActive: true, isKit: true }]) } })
    const result = await kitService.setComponents({ kitProductId: 'kit-1', components: [{ componentProductId: 'p1', quantity: 1 }] })
    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('KIT-005')
  })

  it('returns a not-found error when the kit product itself does not exist', async () => {
    makeDb({ product: { findUnique: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]) } })
    const result = await kitService.setComponents({ kitProductId: 'missing', components: [{ componentProductId: 'p1', quantity: 1 }] })
    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('PRD-001')
  })
})

describe('kitService.clearKit', () => {
  it('removes all components and flips isKit off', async () => {
    const db = makeDb()
    const result = await kitService.clearKit('kit-1')
    expect(result.success).toBe(true)
    expect(db.__tx.kitComponent.deleteMany).toHaveBeenCalledWith({ where: { kitProductId: 'kit-1' } })
    expect(db.__tx.product.update).toHaveBeenCalledWith({ where: { id: 'kit-1' }, data: { isKit: false } })
  })
})

describe('explodeKitComponentsTx', () => {
  it('scales each component quantity by the kit quantity sold', async () => {
    const tx = { kitComponent: { findMany: vi.fn().mockResolvedValue([
      { componentProductId: 'p1', quantity: 2 },
      { componentProductId: 'p2', quantity: 1 }
    ]) } } as any

    const result = await explodeKitComponentsTx(tx, 'kit-1', 3)

    expect(result).toEqual([
      { componentProductId: 'p1', quantity: 6 },
      { componentProductId: 'p2', quantity: 3 }
    ])
  })
})
