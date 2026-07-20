import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../billing.service', () => ({ billingService: { createInvoice: vi.fn() } }))

import { getPrisma } from '../../database/db'
import { billingService } from '../billing.service'
import {
  createLabTestOrder,
  markSampleCollected,
  updateTestResult,
  finalizeReport,
  cancelLabTestOrder,
  deleteLabTestOrder,
  generateLabTestOrderInvoice,
  acknowledgeCriticalResult,
  listPendingCriticalEscalations,
} from '../lab-test-order.service'

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'order-1',
    orderNumber: 'LAB-202607-0001',
    customerId: 'cust-1',
    patientName: 'Ravi Kumar',
    patientAge: '35 years',
    status: 'ORDERED',
    totalAmount: 500,
    invoiceId: null,
    notes: null,
    items: [
      { id: 'item-1', labTestOrderId: 'order-1', testName: 'CBC', serviceCatalogId: 'sc-1', price: 300, status: 'PENDING', resultParameters: '[]', resultSummary: null },
      { id: 'item-2', labTestOrderId: 'order-1', testName: 'Lipid Profile', serviceCatalogId: 'sc-2', price: 200, status: 'PENDING', resultParameters: '[]', resultSummary: null },
    ],
    ...overrides,
  }
}

function makeMockDb(order: ReturnType<typeof makeOrder> | null, options: { existingOrderNumbers?: string[] } = {}) {
  const orderStore = { current: order }
  const itemsById: Record<string, any> = {}
  if (order) for (const it of order.items) itemsById[it.id] = { ...it, labTestOrder: order }

  const db: Record<string, any> = {
    labTestOrder: {
      findUnique: vi.fn().mockImplementation(({ where: { id } }: { where: { id: string } }) =>
        Promise.resolve(orderStore.current && orderStore.current.id === id ? orderStore.current : null)
      ),
      findMany: vi.fn().mockImplementation(() =>
        Promise.resolve((options.existingOrderNumbers ?? []).map((orderNumber) => ({ orderNumber })))
      ),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
        const created = { id: 'order-new', ...data, items: (data.items as any)?.create ?? [] }
        orderStore.current = created as any
        return Promise.resolve(created)
      }),
      update: vi.fn().mockImplementation(({ where: { id }, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        if (orderStore.current && orderStore.current.id === id) {
          orderStore.current = { ...orderStore.current, ...data } as any
        }
        return Promise.resolve(orderStore.current)
      }),
      updateMany: vi.fn().mockImplementation(({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        if (where.invoiceId === null && orderStore.current) {
          if (orderStore.current.invoiceId !== null) return Promise.resolve({ count: 0 })
          orderStore.current = { ...orderStore.current, ...data } as any
          return Promise.resolve({ count: 1 })
        }
        return Promise.resolve({ count: 0 })
      }),
    },
    labTestOrderItem: {
      findUnique: vi.fn().mockImplementation(({ where: { id } }: { where: { id: string } }) =>
        Promise.resolve(itemsById[id] ? { ...itemsById[id], labTestOrder: orderStore.current } : null)
      ),
      update: vi.fn().mockImplementation(({ where: { id }, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        itemsById[id] = { ...itemsById[id], ...data }
        if (orderStore.current) {
          orderStore.current.items = orderStore.current.items.map((it: any) => (it.id === id ? itemsById[id] : it))
        }
        return Promise.resolve(itemsById[id])
      }),
      updateMany: vi.fn().mockImplementation(({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        if (orderStore.current) {
          orderStore.current.items = orderStore.current.items.map((it: any) => {
            if (it.labTestOrderId !== where.labTestOrderId) return it
            if (where.status && it.status !== where.status) return it
            const updated = { ...it, ...data }
            itemsById[it.id] = updated
            return updated
          })
        }
        return Promise.resolve({ count: orderStore.current?.items.length ?? 0 })
      }),
    },
    serviceCatalog: {
      findUnique: vi.fn().mockResolvedValue({ id: 'sc-1', taxRate: 5, sacCode: '999311' }),
    },
    product: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: 'prod-1', ...data })),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  }
  db.$transaction = vi.fn((arg: unknown) => {
    if (Array.isArray(arg)) return Promise.all(arg)
    return (arg as (tx: unknown) => unknown)(db)
  })
  return { db, orderStore }
}

describe('lab-test-order.service', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('createLabTestOrder', () => {
    it('rejects a missing patient name', async () => {
      const { db } = makeMockDb(null)
      vi.mocked(getPrisma).mockReturnValue(db as never)
      const res = await createLabTestOrder({ patientName: '', items: [{ testName: 'CBC' }] })
      expect(res.success).toBe(false)
    })

    it('rejects an order with no tests', async () => {
      const { db } = makeMockDb(null)
      vi.mocked(getPrisma).mockReturnValue(db as never)
      const res = await createLabTestOrder({ patientName: 'Ravi', items: [] })
      expect(res.success).toBe(false)
    })

    it('creates an order with a numeric-max sequence, not string-sorted (past-9999 safe)', async () => {
      // String-sort would place "...-10000" before "...-9999" — same bug class
      // this project already hit once in logistics-counter.service.ts.
      const { db } = makeMockDb(null, { existingOrderNumbers: ['LAB-202607-9999'] })
      vi.mocked(getPrisma).mockReturnValue(db as never)
      const res = await createLabTestOrder({ patientName: 'Ravi', items: [{ testName: 'CBC', price: 300 }] })
      expect(res.success).toBe(true)
      expect((res.data as any).orderNumber).toBe('LAB-202607-10000')
    })

    it('sums item prices into totalAmount', async () => {
      const { db } = makeMockDb(null)
      vi.mocked(getPrisma).mockReturnValue(db as never)
      const res = await createLabTestOrder({ patientName: 'Ravi', items: [{ testName: 'CBC', price: 300 }, { testName: 'Lipid', price: 200 }] })
      expect(res.success).toBe(true)
      expect((res.data as any).totalAmount).toBe(500)
    })
  })

  describe('markSampleCollected', () => {
    it('moves an ORDERED order to SAMPLE_COLLECTED and bumps items to COLLECTED', async () => {
      const { db, orderStore } = makeMockDb(makeOrder())
      vi.mocked(getPrisma).mockReturnValue(db as never)
      const res = await markSampleCollected({ id: 'order-1' })
      expect(res.success).toBe(true)
      expect(orderStore.current?.status).toBe('SAMPLE_COLLECTED')
      expect(orderStore.current?.items.every((i: any) => i.status === 'COLLECTED')).toBe(true)
    })

    it('rejects collecting a sample twice', async () => {
      const { db } = makeMockDb(makeOrder({ status: 'SAMPLE_COLLECTED' }))
      vi.mocked(getPrisma).mockReturnValue(db as never)
      const res = await markSampleCollected({ id: 'order-1' })
      expect(res.success).toBe(false)
    })
  })

  describe('updateTestResult', () => {
    it('rejects entering a result before the sample is collected', async () => {
      const { db } = makeMockDb(makeOrder())
      vi.mocked(getPrisma).mockReturnValue(db as never)
      const res = await updateTestResult({ itemId: 'item-1', resultSummary: 'Normal' })
      expect(res.success).toBe(false)
    })

    it('sets the item to RESULT_READY and moves the order to IN_PROCESS on first result', async () => {
      const { db, orderStore } = makeMockDb(makeOrder({ status: 'SAMPLE_COLLECTED', items: makeOrder().items.map((i) => ({ ...i, status: 'COLLECTED' })) }))
      vi.mocked(getPrisma).mockReturnValue(db as never)
      const res = await updateTestResult({ itemId: 'item-1', resultParameters: [{ parameter: 'Hemoglobin', value: '13.5', unit: 'g/dL', referenceRange: '12-16', flag: 'NORMAL' }] })
      expect(res.success).toBe(true)
      expect(orderStore.current?.status).toBe('IN_PROCESS')
    })

    // Regression: independent review found REPORTED wasn't in the rejected-status
    // list, so editing a finalized item's result flipped it back to RESULT_READY
    // while the order stayed REPORTED (finalizeReport unconditionally refuses an
    // already-REPORTED order) — a permanent, silent order/item desync with no
    // re-approval step for a compliance-sensitive edit.
    it('rejects editing a result once the report has been finalized (REPORTED)', async () => {
      const { db } = makeMockDb(makeOrder({ status: 'REPORTED', items: makeOrder().items.map((i) => ({ ...i, status: 'REPORTED' })) }))
      vi.mocked(getPrisma).mockReturnValue(db as never)
      const res = await updateTestResult({ itemId: 'item-1', resultParameters: [{ parameter: 'Hemoglobin', value: '9.5' }] })
      expect(res.success).toBe(false)
    })

    // Phase 58 §2 — critical/panic-value tier: hasCriticalResult is a
    // derived, cached flag recomputed from resultParameters on every save.
    it('sets hasCriticalResult=true when any parameter is flagged CRITICAL', async () => {
      const { db, orderStore } = makeMockDb(makeOrder({ status: 'SAMPLE_COLLECTED', items: makeOrder().items.map((i) => ({ ...i, status: 'COLLECTED' })) }))
      vi.mocked(getPrisma).mockReturnValue(db as never)
      const res = await updateTestResult({
        itemId: 'item-1',
        resultParameters: [
          { parameter: 'Potassium', value: '7.2', flag: 'CRITICAL' },
          { parameter: 'Sodium', value: '140', flag: 'NORMAL' },
        ],
      })
      expect(res.success).toBe(true)
      expect((orderStore.current?.items as any[])?.find((i) => i.id === 'item-1').hasCriticalResult).toBe(true)
    })

    it('sets hasCriticalResult=false when no parameter is CRITICAL', async () => {
      const { db, orderStore } = makeMockDb(makeOrder({ status: 'SAMPLE_COLLECTED', items: makeOrder().items.map((i) => ({ ...i, status: 'COLLECTED' })) }))
      vi.mocked(getPrisma).mockReturnValue(db as never)
      await updateTestResult({ itemId: 'item-1', resultParameters: [{ parameter: 'Sodium', value: '140', flag: 'NORMAL' }] })
      expect((orderStore.current?.items as any[])?.find((i) => i.id === 'item-1').hasCriticalResult).toBe(false)
    })

    it('leaves hasCriticalResult untouched on a resultSummary-only edit (resultParameters omitted)', async () => {
      const { db, orderStore } = makeMockDb(makeOrder({
        status: 'SAMPLE_COLLECTED',
        items: makeOrder().items.map((i) => ({ ...i, status: 'RESULT_READY', hasCriticalResult: true })),
      }))
      vi.mocked(getPrisma).mockReturnValue(db as never)
      await updateTestResult({ itemId: 'item-1', resultSummary: 'Repeat sample requested' })
      expect((orderStore.current?.items as any[])?.find((i) => i.id === 'item-1').hasCriticalResult).toBe(true)
    })
  })

  describe('acknowledgeCriticalResult — escalation workflow', () => {
    it('records the doctor-notified stamp on an item that actually has a critical result', async () => {
      const { db, orderStore } = makeMockDb(makeOrder({
        items: makeOrder().items.map((i) => (i.id === 'item-1' ? { ...i, hasCriticalResult: true } : i)),
      }))
      vi.mocked(getPrisma).mockReturnValue(db as never)

      const res = await acknowledgeCriticalResult({ itemId: 'item-1', notes: 'Called Dr. Rao, advised admission' })

      expect(res.success).toBe(true)
      const item = (orderStore.current?.items as any[])?.find((i) => i.id === 'item-1')
      expect(item.criticalNotifiedAt).toBeInstanceOf(Date)
      expect(item.criticalNotifiedNotes).toBe('Called Dr. Rao, advised admission')
    })

    it('refuses to acknowledge an item that has no critical result', async () => {
      const { db } = makeMockDb(makeOrder())
      vi.mocked(getPrisma).mockReturnValue(db as never)

      const res = await acknowledgeCriticalResult({ itemId: 'item-1', notes: 'x' })

      expect(res.success).toBe(false)
      expect((res as { error: { code: string } }).error.code).toBe('LAB-020')
    })

    it('returns not-found for a nonexistent item', async () => {
      const { db } = makeMockDb(makeOrder())
      vi.mocked(getPrisma).mockReturnValue(db as never)

      const res = await acknowledgeCriticalResult({ itemId: 'missing', notes: 'x' })

      expect(res.success).toBe(false)
      expect((res as { error: { code: string } }).error.code).toBe('LAB-019')
    })
  })

  describe('listPendingCriticalEscalations', () => {
    it('returns only items with an unacknowledged critical result', async () => {
      const db = {
        labTestOrderItem: {
          findMany: vi.fn().mockResolvedValue([
            { id: 'item-1', testName: 'Potassium', hasCriticalResult: true, criticalNotifiedAt: null, labTestOrder: { orderNumber: 'LAB-1', patientName: 'A' } },
          ]),
        },
      }
      vi.mocked(getPrisma).mockReturnValue(db as never)

      const res = await listPendingCriticalEscalations()

      expect(res.success).toBe(true)
      expect(db.labTestOrderItem.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { hasCriticalResult: true, criticalNotifiedAt: null },
      }))
      expect((res.data as unknown[])).toHaveLength(1)
    })
  })

  describe('finalizeReport', () => {
    it('rejects finalizing when not every item has a result', async () => {
      const { db } = makeMockDb(makeOrder({ status: 'SAMPLE_COLLECTED', items: [
        { id: 'item-1', labTestOrderId: 'order-1', testName: 'CBC', price: 300, status: 'RESULT_READY', resultParameters: '[]', resultSummary: null },
        { id: 'item-2', labTestOrderId: 'order-1', testName: 'Lipid Profile', price: 200, status: 'COLLECTED', resultParameters: '[]', resultSummary: null },
      ] }))
      vi.mocked(getPrisma).mockReturnValue(db as never)
      const res = await finalizeReport({ id: 'order-1' })
      expect(res.success).toBe(false)
    })

    it('finalizes when every item is RESULT_READY, cascading item status to REPORTED', async () => {
      const { db, orderStore } = makeMockDb(makeOrder({ status: 'SAMPLE_COLLECTED', items: [
        { id: 'item-1', labTestOrderId: 'order-1', testName: 'CBC', price: 300, status: 'RESULT_READY', resultParameters: '[]', resultSummary: null },
        { id: 'item-2', labTestOrderId: 'order-1', testName: 'Lipid Profile', price: 200, status: 'RESULT_READY', resultParameters: '[]', resultSummary: null },
      ] }))
      vi.mocked(getPrisma).mockReturnValue(db as never)
      const res = await finalizeReport({ id: 'order-1' })
      expect(res.success).toBe(true)
      expect(orderStore.current?.status).toBe('REPORTED')
      expect(orderStore.current?.items.every((i: any) => i.status === 'REPORTED')).toBe(true)
    })
  })

  describe('cancelLabTestOrder', () => {
    it('rejects cancelling an already-invoiced order', async () => {
      const { db } = makeMockDb(makeOrder({ invoiceId: 'inv-1' }))
      vi.mocked(getPrisma).mockReturnValue(db as never)
      const res = await cancelLabTestOrder({ id: 'order-1' })
      expect(res.success).toBe(false)
    })

    it('cancels an order with no invoice', async () => {
      const { db, orderStore } = makeMockDb(makeOrder())
      vi.mocked(getPrisma).mockReturnValue(db as never)
      const res = await cancelLabTestOrder({ id: 'order-1', reason: 'Patient no-show' })
      expect(res.success).toBe(true)
      expect(orderStore.current?.status).toBe('CANCELLED')
    })
  })

  describe('deleteLabTestOrder', () => {
    it('rejects deleting an order once the sample has been collected', async () => {
      const { db } = makeMockDb(makeOrder({ status: 'SAMPLE_COLLECTED' }))
      db.labTestOrder.delete = vi.fn()
      vi.mocked(getPrisma).mockReturnValue(db as never)
      const res = await deleteLabTestOrder('order-1')
      expect(res.success).toBe(false)
      expect(db.labTestOrder.delete).not.toHaveBeenCalled()
    })

    it('deletes a fresh ORDERED order with no invoice', async () => {
      const { db } = makeMockDb(makeOrder())
      db.labTestOrder.delete = vi.fn().mockResolvedValue({})
      vi.mocked(getPrisma).mockReturnValue(db as never)
      const res = await deleteLabTestOrder('order-1')
      expect(res.success).toBe(true)
      expect(db.labTestOrder.delete).toHaveBeenCalled()
    })
  })

  describe('generateLabTestOrderInvoice', () => {
    it('requires a linked customer before invoicing', async () => {
      const { db } = makeMockDb(makeOrder({ customerId: null }))
      vi.mocked(getPrisma).mockReturnValue(db as never)
      const res = await generateLabTestOrderInvoice('order-1')
      expect(res.success).toBe(false)
    })

    it('rejects a zero-priced test before invoicing', async () => {
      const { db } = makeMockDb(makeOrder({ items: [{ id: 'item-1', labTestOrderId: 'order-1', testName: 'CBC', price: 0, status: 'PENDING', resultParameters: '[]', resultSummary: null }] }))
      vi.mocked(getPrisma).mockReturnValue(db as never)
      const res = await generateLabTestOrderInvoice('order-1')
      expect(res.success).toBe(false)
    })

    it('generates an invoice once, using the atomic claim sentinel to block a second concurrent call', async () => {
      const { db } = makeMockDb(makeOrder())
      vi.mocked(getPrisma).mockReturnValue(db as never)
      vi.mocked(billingService.createInvoice).mockResolvedValue({ success: true, data: { id: 'inv-1' } } as never)

      const [first, second] = await Promise.all([
        generateLabTestOrderInvoice('order-1'),
        generateLabTestOrderInvoice('order-1'),
      ])
      const successes = [first, second].filter((r) => r.success)
      expect(successes.length).toBe(1)
      expect(billingService.createInvoice).toHaveBeenCalledTimes(1)
    })

    it('rolls back the claim sentinel if invoice creation fails, so a later retry can still succeed', async () => {
      const { db, orderStore } = makeMockDb(makeOrder())
      vi.mocked(getPrisma).mockReturnValue(db as never)
      vi.mocked(billingService.createInvoice).mockResolvedValue({ success: false, error: { code: 'BIL-000', message: 'boom' } } as never)

      const res = await generateLabTestOrderInvoice('order-1')
      expect(res.success).toBe(false)
      expect(orderStore.current?.invoiceId).toBeNull()
    })
  })
})
