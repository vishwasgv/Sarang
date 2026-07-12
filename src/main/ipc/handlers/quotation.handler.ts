import { app, BrowserWindow } from 'electron'
import { writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import { quotationService, type CreateQuotationPayload } from '../../services/quotation.service'
import { printService } from '../../services/print.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { getPrisma } from '../../database/db'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

function validateId(id: unknown, label = 'ID'): { success: false; error: { code: string; message: string } } | null {
  if (typeof id !== 'string' || !id.trim()) {
    return { success: false, error: { code: 'VAL-001', message: `Invalid ${label}: must be a non-empty string.` } }
  }
  return null
}

export function register(handle: HandleFn): void {
  handle('quotations:list', async (payload) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    return quotationService.list(payload as { status?: string; customerId?: string; page?: number; limit?: number } ?? {})
  })

  handle('quotations:get', async (id) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const bad = validateId(id, 'quotation ID'); if (bad) return bad
    return quotationService.getById(id as string)
  })

  handle('quotations:create', async (payload) => {
    const deny = await requirePermission('billing.create'); if (deny) return deny
    const session = getCurrentSession()
    if (!session) return { success: false, error: { code: 'AUTH-001', message: 'Not authenticated.' } }
    return quotationService.create(payload as CreateQuotationPayload, session.userId)
  })

  handle('quotations:updateStatus', async (payload) => {
    const deny = await requirePermission('billing.create'); if (deny) return deny
    const session = getCurrentSession()
    if (!session) return { success: false, error: { code: 'AUTH-001', message: 'Not authenticated.' } }
    const p = payload as { id: string; status: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'EXPIRED' }
    return quotationService.updateStatus(p, session.userId)
  })

  handle('quotations:convertToInvoice', async (id) => {
    const deny = await requirePermission('billing.create'); if (deny) return deny
    const bad = validateId(id, 'quotation ID'); if (bad) return bad
    const session = getCurrentSession()
    if (!session) return { success: false, error: { code: 'AUTH-001', message: 'Not authenticated.' } }
    return quotationService.convertToInvoice(id as string, session.userId)
  })

  handle('quotations:delete', async (id) => {
    const deny = await requirePermission('billing.void'); if (deny) return deny
    const bad = validateId(id, 'quotation ID'); if (bad) return bad
    const session = getCurrentSession()
    if (!session) return { success: false, error: { code: 'AUTH-001', message: 'Not authenticated.' } }
    return quotationService.delete(id as string, session.userId)
  })

  handle('quotations:print', async (id) => {
    const deny = await requirePermission('billing.printInvoice'); if (deny) return deny
    const bad = validateId(id, 'quotation ID'); if (bad) return bad
    const qtRes = await quotationService.getById(id as string)
    if (!qtRes.success) return qtRes
    const db = getPrisma()
    // Fresh-audit fix (2026-07-12): respects the global print_type Setting
    // (same one billing's print:invoice already reads) so a shop whose only
    // printer is thermal gets a thermal quotation too, not a forced A4 job.
    const [profile, printTypeSetting] = await Promise.all([
      db.businessProfile.findFirst(),
      db.setting.findUnique({ where: { settingKey: 'print_type' } })
    ])
    const printType = (printTypeSetting?.settingValue ?? 'A4') as 'A4' | 'THERMAL_80MM' | 'THERMAL_58MM'
    const isReceipt = printType === 'THERMAL_80MM' || printType === 'THERMAL_58MM'
    const paperWidth = printType === 'THERMAL_58MM' ? '58mm' : '80mm'
    const html = isReceipt
      ? await printService.generateQuotationReceiptHtml(qtRes.data as Parameters<typeof printService.generateQuotationReceiptHtml>[0], profile as Parameters<typeof printService.generateQuotationReceiptHtml>[1], paperWidth)
      : await printService.generateQuotationHtml(qtRes.data as Parameters<typeof printService.generateQuotationHtml>[0], profile as Parameters<typeof printService.generateQuotationHtml>[1])
    const tmpPath = join(app.getPath('temp'), `sarang_qt_${Date.now()}.html`)
    await writeFile(tmpPath, html, 'utf-8')
    return new Promise<{ success: boolean; data?: unknown; error?: { code: string; message: string } }>((resolve) => {
      const win = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true, sandbox: true } })
      win.loadFile(tmpPath)
      win.webContents.once('did-finish-load', () => {
        win.webContents.print({ silent: false, printBackground: true, color: !isReceipt }, (success: boolean) => {
          win.close()
          unlink(tmpPath).catch(() => {})
          resolve({ success, data: { printed: success } })
        })
      })
    })
  })

  // Fresh-audit fix (2026-07-12): explicit thermal override, mirroring
  // billing.handler.ts's print:receipt — lets the owner force a receipt-
  // width printout regardless of the global default, same as Invoice's
  // "Print" + "Print Receipt" pair.
  handle('quotations:printReceipt', async (payload) => {
    const deny = await requirePermission('billing.printInvoice'); if (deny) return deny
    const { id, paperWidth: overridePaperWidth } = payload as { id: string; paperWidth?: '80mm' | '58mm' }
    const bad = validateId(id, 'quotation ID'); if (bad) return bad
    const qtRes = await quotationService.getById(id)
    if (!qtRes.success) return qtRes
    const db = getPrisma()
    const [profile, printTypeSetting] = await Promise.all([
      db.businessProfile.findFirst(),
      db.setting.findUnique({ where: { settingKey: 'print_type' } })
    ])
    const printType = (printTypeSetting?.settingValue ?? 'THERMAL_80MM') as 'A4' | 'THERMAL_80MM' | 'THERMAL_58MM'
    const paperWidth = overridePaperWidth ?? (printType === 'THERMAL_58MM' ? '58mm' : '80mm')
    const html = await printService.generateQuotationReceiptHtml(qtRes.data as Parameters<typeof printService.generateQuotationReceiptHtml>[0], profile as Parameters<typeof printService.generateQuotationReceiptHtml>[1], paperWidth)
    const tmpPath = join(app.getPath('temp'), `sarang_qt_rcpt_${Date.now()}.html`)
    await writeFile(tmpPath, html, 'utf-8')
    return new Promise<{ success: boolean; data?: unknown; error?: { code: string; message: string } }>((resolve) => {
      const win = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true, sandbox: true } })
      win.loadFile(tmpPath)
      win.webContents.once('did-finish-load', () => {
        win.webContents.print({ silent: false, printBackground: true }, (success: boolean) => {
          win.close()
          unlink(tmpPath).catch(() => {})
          resolve({ success, data: { printed: success } })
        })
      })
    })
  })
}
