import { app, BrowserWindow } from 'electron'
import { writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import { salesOrderService } from '../../services/sales-order.service'
import { printService } from '../../services/print.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { getPrisma } from '../../database/db'
import { CreateSalesOrderSchema, CancelSalesOrderSchema, CreateInvoiceFromSalesOrderSchema } from '../../validation/sales-order.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

function validateId(id: unknown, label = 'ID'): { success: false; error: { code: string; message: string } } | null {
  if (typeof id !== 'string' || !id.trim()) {
    return { success: false, error: { code: 'VAL-001', message: `Invalid ${label}: must be a non-empty string.` } }
  }
  return null
}

export function register(handle: HandleFn): void {
  handle('salesOrders:list', async (payload) => {
    const deny = await requirePermission('salesOrders.view'); if (deny) return deny
    return salesOrderService.listSalesOrders(payload as { customerId?: string; status?: string; page?: number; limit?: number } | undefined)
  })

  handle('salesOrders:get', async (id) => {
    const deny = await requirePermission('salesOrders.view'); if (deny) return deny
    const bad = validateId(id, 'sales order ID'); if (bad) return bad
    return salesOrderService.getSalesOrder(id as string)
  })

  handle('salesOrders:create', async (payload) => {
    const deny = await requirePermission('salesOrders.create'); if (deny) return deny
    const parsed = CreateSalesOrderSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return salesOrderService.createSalesOrder(parsed.data, getCurrentSession()?.userId)
  })

  handle('salesOrders:confirm', async (id) => {
    const deny = await requirePermission('salesOrders.create'); if (deny) return deny
    const bad = validateId(id, 'sales order ID'); if (bad) return bad
    return salesOrderService.confirmSalesOrder(id as string)
  })

  handle('salesOrders:cancel', async (payload) => {
    const deny = await requirePermission('salesOrders.cancel'); if (deny) return deny
    const parsed = CancelSalesOrderSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return salesOrderService.cancelSalesOrder(parsed.data.id, parsed.data.reason)
  })

  handle('salesOrders:createInvoice', async (payload) => {
    const deny = await requirePermission('salesOrders.invoice'); if (deny) return deny
    const parsed = CreateInvoiceFromSalesOrderSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    const userId = getCurrentSession()?.userId
    if (!userId) return { success: false, error: { code: 'AUTH-001', message: 'Not authenticated.' } }
    return salesOrderService.createInvoiceFromSalesOrder(parsed.data, userId)
  })

  // Phase 63 print gap closed — Sales Order had no print/PDF at all before
  // this. Same pattern as bills:print / purchaseOrders:print.
  handle('salesOrders:print', async (id) => {
    const deny = await requirePermission('salesOrders.view'); if (deny) return deny
    const bad = validateId(id, 'sales order ID'); if (bad) return bad
    const soRes = await salesOrderService.getSalesOrder(id as string)
    if (!soRes.success) return soRes
    const profile = await getPrisma().businessProfile.findFirst()
    const html = await printService.generateSalesOrderHtml(soRes.data as Parameters<typeof printService.generateSalesOrderHtml>[0], profile as Parameters<typeof printService.generateSalesOrderHtml>[1])
    const tmpPath = join(app.getPath('temp'), `sarang_so_${Date.now()}.html`)
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
}
