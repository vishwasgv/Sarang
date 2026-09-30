import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'

vi.setConfig({ testTimeout: 120000, hookTimeout: 120000 })
vi.mock('electron', () => ({ app: { isPackaged: false, getPath: () => process.env.TEMP ?? '.' } }))

import { openRealDb, type RealDb } from '../real-db'

let handle: RealDb

async function services() {
  const { debitNoteService } = await import('../../services/debit-note.service')
  const { purchaseOrderService } = await import('../../services/purchase-order.service')
  const { getPrisma } = await import('../../database/db')
  return { debitNoteService, purchaseOrderService, db: getPrisma() }
}

// Real bug found in this audit: a Debit Note (the purchase-side equivalent of
// a Credit Note) could be created — and later edited — with a purchaseOrderId
// belonging to a DIFFERENT supplier than its own supplierId, the exact class
// of bug already found and fixed on the sales side (credit-note.service.ts's
// customerId/invoiceId pairing). Ledger effects were still posted to
// payload.supplierId while the note inherited gstType/dominant tax rate from
// the wrong supplier's PO — a real, silent data-integrity break, not a
// hypothetical.
describe('debit note / PO supplier pairing', () => {
  let supplierAId: string
  let supplierBId: string
  let poForSupplierBId: string

  beforeAll(async () => {
    handle = await openRealDb()
    const { db, purchaseOrderService } = await services()
    supplierAId = (await db.supplier.create({ data: { supplierName: 'Supplier A' } })).id
    supplierBId = (await db.supplier.create({ data: { supplierName: 'Supplier B' } })).id
    const poRes = await purchaseOrderService.createPO({
      supplierId: supplierBId,
      items: [{ serviceDescription: 'Freight', quantity: 1, unitCost: 1000, taxRate: 18 }],
      isReverseCharge: false
    } as never)
    expect((poRes as { success: boolean }).success).toBe(true)
    poForSupplierBId = (poRes as { data: { id: string } }).data.id
  }, 120000)
  afterAll(async () => { await handle.close() })

  it('rejects create() when supplierId and purchaseOrderId belong to different suppliers', async () => {
    const { debitNoteService } = await services()
    const res = await debitNoteService.create({
      supplierId: supplierAId,
      purchaseOrderId: poForSupplierBId,
      reason: 'Damaged goods',
      amount: 100
    } as never, 'user-1')
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('DN-006')
  })

  it('allows create() when supplierId and purchaseOrderId agree', async () => {
    const { debitNoteService } = await services()
    const res = await debitNoteService.create({
      supplierId: supplierBId,
      purchaseOrderId: poForSupplierBId,
      reason: 'Damaged goods',
      amount: 100
    } as never, 'user-1')
    expect(res.success).toBe(true)
  })

  it('rejects update() when re-pairing a note to a PO from a different supplier', async () => {
    const { debitNoteService } = await services()
    const created = await debitNoteService.create({ supplierId: supplierAId, reason: 'Price correction', amount: 50 } as never, 'user-1')
    expect(created.success).toBe(true)
    const id = (created as { data: { id: string } }).data.id

    const res = await debitNoteService.update(id, { purchaseOrderId: poForSupplierBId }, 'user-1')
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('DN-006')
  })

  it('rejects update() when re-pairing an existing PO-linked note to an unrelated supplier', async () => {
    const { debitNoteService } = await services()
    const created = await debitNoteService.create({ supplierId: supplierBId, purchaseOrderId: poForSupplierBId, reason: 'Original', amount: 75 } as never, 'user-1')
    expect(created.success).toBe(true)
    const id = (created as { data: { id: string } }).data.id

    const res = await debitNoteService.update(id, { supplierId: supplierAId }, 'user-1')
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('DN-006')
  })
})
