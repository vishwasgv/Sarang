import { app, BrowserWindow } from 'electron'
import { writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import { billService } from '../../services/bill.service'
import { printService } from '../../services/print.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { getPrisma } from '../../database/db'
import { CreateBillSchema, VoidBillSchema } from '../../validation/bill.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

function validateId(id: unknown, label = 'ID'): { success: false; error: { code: string; message: string } } | null {
  if (typeof id !== 'string' || !id.trim()) {
    return { success: false, error: { code: 'VAL-001', message: `Invalid ${label}: must be a non-empty string.` } }
  }
  return null
}

export function register(handle: HandleFn): void {
  handle('bills:list', async (payload) => {
    const deny = await requirePermission('bills.view'); if (deny) return deny
    return billService.listBills(payload as { supplierId?: string; status?: string; page?: number; limit?: number } | undefined)
  })

  handle('bills:get', async (id) => {
    const deny = await requirePermission('bills.view'); if (deny) return deny
    const bad = validateId(id, 'bill ID'); if (bad) return bad
    return billService.getBill(id as string)
  })

  handle('bills:create', async (payload) => {
    const deny = await requirePermission('bills.create'); if (deny) return deny
    const parsed = CreateBillSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return billService.createBill(parsed.data, getCurrentSession()?.userId)
  })

  handle('bills:void', async (payload) => {
    const deny = await requirePermission('bills.void'); if (deny) return deny
    const parsed = VoidBillSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return billService.voidBill(parsed.data.id, parsed.data.reason, getCurrentSession()?.userId)
  })

  // Phase 63 print gap closed — Bill had no print/PDF at all before this.
  // Same silent-print-to-OS-dialog pattern purchaseOrders:print already
  // established; gated on the existing bills.view (read-tier) permission
  // rather than minting a new key, since printing an already-created
  // document is a natural extension of being able to see it.
  handle('bills:print', async (id) => {
    const deny = await requirePermission('bills.view'); if (deny) return deny
    const bad = validateId(id, 'bill ID'); if (bad) return bad
    const billRes = await billService.getBill(id as string)
    if (!billRes.success) return billRes
    const profile = await getPrisma().businessProfile.findFirst()
    const html = await printService.generateBillHtml(billRes.data as Parameters<typeof printService.generateBillHtml>[0], profile as Parameters<typeof printService.generateBillHtml>[1])
    const tmpPath = join(app.getPath('temp'), `sarang_bill_${Date.now()}.html`)
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
