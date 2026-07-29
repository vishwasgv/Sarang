import { app, BrowserWindow } from 'electron'
import { writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import { purchaseOrderService } from '../../services/purchase-order.service'
import { printService } from '../../services/print.service'
import { exportToPdf } from '../../services/export.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { getPrisma } from '../../database/db'
import { CreatePOSchema, CancelPOSchema } from '../../validation/purchase-order.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

function validateId(id: unknown, label = 'ID'): { success: false; error: { code: string; message: string } } | null {
  if (typeof id !== 'string' || !id.trim()) {
    return { success: false, error: { code: 'VAL-001', message: `Invalid ${label}: must be a non-empty string.` } }
  }
  return null
}

export function register(handle: HandleFn): void {
  handle('purchaseOrders:list', async (payload) => {
    const deny = await requirePermission('purchaseOrders.view'); if (deny) return deny
    return purchaseOrderService.listPOs(payload as { supplierId?: string; status?: string; page?: number; limit?: number } | undefined)
  })

  handle('purchaseOrders:get', async (id) => {
    const deny = await requirePermission('purchaseOrders.view'); if (deny) return deny
    const bad = validateId(id, 'purchase order ID'); if (bad) return bad
    return purchaseOrderService.getPO(id as string)
  })

  handle('purchaseOrders:create', async (payload) => {
    const deny = await requirePermission('purchaseOrders.create'); if (deny) return deny
    const parsed = CreatePOSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return purchaseOrderService.createPO(parsed.data, getCurrentSession()?.userId)
  })

  handle('purchaseOrders:approve', async (id) => {
    const deny = await requirePermission('purchaseOrders.approve'); if (deny) return deny
    const bad = validateId(id, 'purchase order ID'); if (bad) return bad
    return purchaseOrderService.approvePO(id as string)
  })

  handle('purchaseOrders:receive', async (id) => {
    const deny = await requirePermission('purchaseOrders.receive'); if (deny) return deny
    const bad = validateId(id, 'purchase order ID'); if (bad) return bad
    return purchaseOrderService.receivePO(id as string, getCurrentSession()?.userId)
  })

  handle('purchaseOrders:cancel', async (payload) => {
    const deny = await requirePermission('purchaseOrders.cancel'); if (deny) return deny
    const parsed = CancelPOSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return purchaseOrderService.cancelPO(parsed.data.id, parsed.data.reason)
  })

  // Phase 58 §2 — reorder automation. Same trust level as creating a PO
  // by hand (this only ever produces DRAFT POs, same starting point).
  handle('purchaseOrders:generateReorderDraftPOs', async () => {
    const deny = await requirePermission('purchaseOrders.create'); if (deny) return deny
    return purchaseOrderService.generateReorderDraftPOs(getCurrentSession()?.userId)
  })

  // Share feature (docs/FEATURE_SHARE_BILL_REPORT_WHATSAPP_EMAIL.md Section 4):
  // Purchase Order PDF generation/printing built from scratch — no print or
  // PDF capability of any kind existed for POs before this. Gated on the
  // new `purchaseOrders.printDocument` permission, seeded at the same role
  // tier as the existing (mislabeled) `purchaseOrders.print` key — NOT that
  // key itself, which is load-bearing for Debit Note printing and left
  // untouched.
  handle('purchaseOrders:print', async (id) => {
    const deny = await requirePermission('purchaseOrders.printDocument'); if (deny) return deny
    const bad = validateId(id, 'purchase order ID'); if (bad) return bad
    const poRes = await purchaseOrderService.getPO(id as string)
    if (!poRes.success) return poRes
    const profile = await getPrisma().businessProfile.findFirst()
    const html = await printService.generatePurchaseOrderHtml(poRes.data as Parameters<typeof printService.generatePurchaseOrderHtml>[0], profile as Parameters<typeof printService.generatePurchaseOrderHtml>[1])
    const tmpPath = join(app.getPath('temp'), `sarang_po_${Date.now()}.html`)
    await writeFile(tmpPath, html, 'utf-8')
    return new Promise<{ success: boolean; data?: unknown; error?: { code: string; message: string } }>((resolve) => {
      const win = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true, sandbox: true } })
      win.loadFile(tmpPath)
      win.webContents.once('did-finish-load', () => {
        win.webContents.print({ silent: false, printBackground: true, color: true }, (success: boolean) => {
          win.close()
          unlink(tmpPath).catch(() => {})
          resolve({ success, data: { printed: success } })
        })
      })
    })
  })

  // Share feature — reuses the same HTML generator, saved to a chosen file
  // path via export.toPdf instead of straight to the OS print dialog, so
  // Share's reveal-in-folder step has a real path to act on.
  handle('purchaseOrders:exportPdf', async (id) => {
    const deny = await requirePermission('purchaseOrders.printDocument'); if (deny) return deny
    const bad = validateId(id, 'purchase order ID'); if (bad) return bad
    const poRes = await purchaseOrderService.getPO(id as string)
    if (!poRes.success) return poRes
    const profile = await getPrisma().businessProfile.findFirst()
    const html = await printService.generatePurchaseOrderHtml(poRes.data as Parameters<typeof printService.generatePurchaseOrderHtml>[0], profile as Parameters<typeof printService.generatePurchaseOrderHtml>[1])
    const poNumber = (poRes.data as { poNumber: string }).poNumber
    const result = await exportToPdf({ html, filename: `PurchaseOrder-${poNumber}.pdf` })
    return { success: true, data: result }
  })
}
