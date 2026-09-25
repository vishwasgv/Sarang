import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))

import { Prisma } from '@prisma/client'
import { getPrisma } from '../../database/db'
import { planMerge, mergePartiesService } from '../merge-parties.service'

describe('planMerge reads the real database model', () => {
  const steps = planMerge(Prisma.dmmf.datamodel.models as never, 'Customer')
  it('finds the tables that point at a customer', () => {
    expect(steps.find((s) => s.model === 'Invoice')).toMatchObject({ field: 'customerId', delegate: 'invoice', unique: false })
    expect(steps.find((s) => s.model === 'Payment' || s.model === 'CustomerLedger')).toBeTruthy()
    expect(steps.length).toBeGreaterThan(30)
  })
  it('finds supplier tables too, including bills', () => {
    const s = planMerge(Prisma.dmmf.datamodel.models as never, 'Supplier')
    expect(s.find((x) => x.model === 'Bill')).toMatchObject({ field: 'supplierId' })
    expect(s.find((x) => x.model === 'PurchaseOrder')).toBeTruthy()
  })
  it('marks one-row-per-party tables as unique', () => {
    expect(steps.some((s) => s.unique)).toBe(true)
  })
})

describe('mergePartiesService.merge', () => {
  beforeEach(() => vi.clearAllMocks())

  function makeDb(over: { keep?: unknown; remove?: unknown; conflictOn?: string } = {}) {
    const updates: Array<{ table: string; where: unknown; data: unknown }> = []
    const tables = new Proxy({} as Record<string, any>, {
      get: (target, name: string) => name in target ? target[name] : ({
        findFirst: vi.fn(async ({ where }: { where: Record<string, string> }) => (over.conflictOn === name ? { id: 'x', ...where } : null)),
        updateMany: vi.fn(async ({ where, data }: { where: unknown; data: unknown }) => { updates.push({ table: name, where, data }); return { count: name === 'invoice' ? 3 : 0 } }),
        update: vi.fn(async ({ where, data }: { where: unknown; data: unknown }) => { updates.push({ table: `${name}.update`, where, data }); return {} }),
        findUnique: vi.fn(async ({ where }: { where: { id: string } }) => (where.id === 'keep' ? ('keep' in over ? over.keep : { id: 'keep', customerName: 'Ramesh', customerCode: 'CUS-1', outstandingBalance: 100, notes: null }) : ('remove' in over ? over.remove : { id: 'dup', customerName: 'Ramesh K', outstandingBalance: 40, notes: 'old' })))
      })
    })
    const db = Object.assign(tables, { $transaction: async (cb: (t: unknown) => unknown) => cb(tables) })
    return { db, updates }
  }

  it('moves the records, adds the balances and archives the duplicate with a note', async () => {
    const { db, updates } = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const r = await mergePartiesService.merge('Customer', 'keep', 'dup', 'u1')
    expect(r).toMatchObject({ success: true, data: { moved: { Invoice: 3 } } })
    expect(updates.find((u) => u.table === 'invoice')).toMatchObject({ where: { customerId: 'dup' }, data: { customerId: 'keep' } })
    expect(updates.find((u) => u.table === 'customer.update' && (u.where as { id: string }).id === 'keep')!.data).toEqual({ outstandingBalance: 140 })
    const archived = updates.find((u) => u.table === 'customer.update' && (u.where as { id: string }).id === 'dup')!.data as { isActive: boolean; notes: string; outstandingBalance: number }
    expect(archived).toMatchObject({ isActive: false, outstandingBalance: 0 })
    expect(archived.notes).toContain('Merged into Ramesh')
  })

  it('refuses to merge a record into itself or a missing one', async () => {
    const { db } = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    expect(await mergePartiesService.merge('Customer', 'keep', 'keep')).toMatchObject({ success: false, error: { code: 'MERGE-001' } })
    const missing = makeDb({ remove: null })
    vi.mocked(getPrisma).mockReturnValue(missing.db as never)
    expect(await mergePartiesService.merge('Customer', 'keep', 'gone')).toMatchObject({ success: false, error: { code: 'MERGE-002' } })
  })

  it('stops when a one-per-party table has an entry for both, and changes nothing', async () => {
    const steps = planMerge(Prisma.dmmf.datamodel.models as never, 'Customer').filter((s) => s.unique)
    const { db, updates } = makeDb({ conflictOn: steps[0].delegate })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const r = await mergePartiesService.merge('Customer', 'keep', 'dup')
    expect(r).toMatchObject({ success: false, error: { code: 'MERGE-003' } })
    expect(updates.find((u) => u.table === 'customer.update')).toBeUndefined()
  })
})
