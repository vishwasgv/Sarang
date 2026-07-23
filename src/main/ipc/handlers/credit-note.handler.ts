import { app, BrowserWindow } from 'electron'
import { writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import { creditNoteService } from '../../services/credit-note.service'
import { printService } from '../../services/print.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { getPrisma } from '../../database/db'
import { CreateCreditNoteSchema, UpdateCreditNoteSchema } from '../../validation/credit-note.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

function validateId(id: unknown, label = 'ID'): { success: false; error: { code: string; message: string } } | null {
  if (typeof id !== 'string' || !id.trim()) {
    return { success: false, error: { code: 'VAL-001', message: `Invalid ${label}: must be a non-empty string.` } }
  }
  return null
}

export function register(handle: HandleFn): void {
  handle('creditNotes:list', async (payload) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    return creditNoteService.list(payload as { customerId?: string; invoiceId?: string; page?: number; limit?: number } ?? {})
  })

  handle('creditNotes:get', async (id) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const bad = validateId(id, 'credit note ID'); if (bad) return bad
    return creditNoteService.getById(id as string)
  })

  handle('creditNotes:create', async (payload) => {
    const deny = await requirePermission('billing.create'); if (deny) return deny
    const parsed = CreateCreditNoteSchema.safeParse(payload)
    if (!parsed.success) {
      return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid credit note data.' } }
    }
    const session = getCurrentSession()
    if (!session) return { success: false, error: { code: 'AUTH-001', message: 'Not authenticated.' } }
    return creditNoteService.create(parsed.data, session.userId)
  })

  handle('creditNotes:update', async (payload) => {
    const deny = await requirePermission('billing.create'); if (deny) return deny
    const p = payload as { id?: string } & Record<string, unknown>
    const bad = validateId(p?.id, 'credit note ID'); if (bad) return bad
    const parsed = UpdateCreditNoteSchema.safeParse(p)
    if (!parsed.success) {
      return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid credit note data.' } }
    }
    const session = getCurrentSession()
    if (!session) return { success: false, error: { code: 'AUTH-001', message: 'Not authenticated.' } }
    return creditNoteService.update(p.id as string, parsed.data, session.userId)
  })

  handle('creditNotes:delete', async (id) => {
    const deny = await requirePermission('billing.void'); if (deny) return deny
    const bad = validateId(id, 'credit note ID'); if (bad) return bad
    const session = getCurrentSession()
    if (!session) return { success: false, error: { code: 'AUTH-001', message: 'Not authenticated.' } }
    return creditNoteService.delete(id as string, session.userId)
  })

  handle('creditNotes:print', async (id) => {
    const deny = await requirePermission('billing.printInvoice'); if (deny) return deny
    const bad = validateId(id, 'credit note ID'); if (bad) return bad
    const cnRes = await creditNoteService.getById(id as string)
    if (!cnRes.success) return cnRes
    const db = getPrisma()
    const [profile, printTypeSetting] = await Promise.all([
      db.businessProfile.findFirst(),
      db.setting.findUnique({ where: { settingKey: 'print_type' } })
    ])
    const printType = (printTypeSetting?.settingValue ?? 'A4') as 'A4' | 'THERMAL_80MM' | 'THERMAL_58MM'
    const isReceipt = printType === 'THERMAL_80MM' || printType === 'THERMAL_58MM'
    const paperWidth = printType === 'THERMAL_58MM' ? '58mm' : '80mm'
    const html = isReceipt
      ? await printService.generateCreditNoteReceiptHtml(cnRes.data as Parameters<typeof printService.generateCreditNoteReceiptHtml>[0], profile as Parameters<typeof printService.generateCreditNoteReceiptHtml>[1], paperWidth)
      : await printService.generateCreditNoteHtml(cnRes.data as Parameters<typeof printService.generateCreditNoteHtml>[0], profile as Parameters<typeof printService.generateCreditNoteHtml>[1])
    const tmpPath = join(app.getPath('temp'), `sarang_cn_${Date.now()}.html`)
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

  handle('creditNotes:printReceipt', async (payload) => {
    const deny = await requirePermission('billing.printInvoice'); if (deny) return deny
    const { id, paperWidth: overridePaperWidth } = payload as { id: string; paperWidth?: '80mm' | '58mm' }
    const bad = validateId(id, 'credit note ID'); if (bad) return bad
    const cnRes = await creditNoteService.getById(id)
    if (!cnRes.success) return cnRes
    const db = getPrisma()
    const [profile, printTypeSetting] = await Promise.all([
      db.businessProfile.findFirst(),
      db.setting.findUnique({ where: { settingKey: 'print_type' } })
    ])
    const printType = (printTypeSetting?.settingValue ?? 'THERMAL_80MM') as 'A4' | 'THERMAL_80MM' | 'THERMAL_58MM'
    const paperWidth = overridePaperWidth ?? (printType === 'THERMAL_58MM' ? '58mm' : '80mm')
    const html = await printService.generateCreditNoteReceiptHtml(cnRes.data as Parameters<typeof printService.generateCreditNoteReceiptHtml>[0], profile as Parameters<typeof printService.generateCreditNoteReceiptHtml>[1], paperWidth)
    const tmpPath = join(app.getPath('temp'), `sarang_cn_rcpt_${Date.now()}.html`)
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
