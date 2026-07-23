import { app, BrowserWindow } from 'electron'
import { writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import { debitNoteService } from '../../services/debit-note.service'
import { printService } from '../../services/print.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { getPrisma } from '../../database/db'
import { CreateDebitNoteSchema, UpdateDebitNoteSchema } from '../../validation/debit-note.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

function validateId(id: unknown, label = 'ID'): { success: false; error: { code: string; message: string } } | null {
  if (typeof id !== 'string' || !id.trim()) {
    return { success: false, error: { code: 'VAL-001', message: `Invalid ${label}: must be a non-empty string.` } }
  }
  return null
}

export function register(handle: HandleFn): void {
  handle('debitNotes:list', async (payload) => {
    const deny = await requirePermission('purchaseOrders.view'); if (deny) return deny
    return debitNoteService.list(payload as { supplierId?: string; purchaseOrderId?: string; page?: number; limit?: number } ?? {})
  })

  handle('debitNotes:get', async (id) => {
    const deny = await requirePermission('purchaseOrders.view'); if (deny) return deny
    const bad = validateId(id, 'debit note ID'); if (bad) return bad
    return debitNoteService.getById(id as string)
  })

  handle('debitNotes:create', async (payload) => {
    const deny = await requirePermission('purchaseOrders.create'); if (deny) return deny
    const parsed = CreateDebitNoteSchema.safeParse(payload)
    if (!parsed.success) {
      return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid debit note data.' } }
    }
    const session = getCurrentSession()
    if (!session) return { success: false, error: { code: 'AUTH-001', message: 'Not authenticated.' } }
    return debitNoteService.create(parsed.data, session.userId)
  })

  handle('debitNotes:update', async (payload) => {
    const deny = await requirePermission('purchaseOrders.create'); if (deny) return deny
    const p = payload as { id?: string } & Record<string, unknown>
    const bad = validateId(p?.id, 'debit note ID'); if (bad) return bad
    const parsed = UpdateDebitNoteSchema.safeParse(p)
    if (!parsed.success) {
      return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid debit note data.' } }
    }
    const session = getCurrentSession()
    if (!session) return { success: false, error: { code: 'AUTH-001', message: 'Not authenticated.' } }
    return debitNoteService.update(p.id as string, parsed.data, session.userId)
  })

  handle('debitNotes:delete', async (id) => {
    const deny = await requirePermission('purchaseOrders.create'); if (deny) return deny
    const bad = validateId(id, 'debit note ID'); if (bad) return bad
    const session = getCurrentSession()
    if (!session) return { success: false, error: { code: 'AUTH-001', message: 'Not authenticated.' } }
    return debitNoteService.delete(id as string, session.userId)
  })

  handle('debitNotes:print', async (id) => {
    const deny = await requirePermission('purchaseOrders.print'); if (deny) return deny
    const bad = validateId(id, 'debit note ID'); if (bad) return bad
    const dnRes = await debitNoteService.getById(id as string)
    if (!dnRes.success) return dnRes
    const db = getPrisma()
    const [profile, printTypeSetting] = await Promise.all([
      db.businessProfile.findFirst(),
      db.setting.findUnique({ where: { settingKey: 'print_type' } })
    ])
    const printType = (printTypeSetting?.settingValue ?? 'A4') as 'A4' | 'THERMAL_80MM' | 'THERMAL_58MM'
    const isReceipt = printType === 'THERMAL_80MM' || printType === 'THERMAL_58MM'
    const paperWidth = printType === 'THERMAL_58MM' ? '58mm' : '80mm'
    const html = isReceipt
      ? await printService.generateDebitNoteReceiptHtml(dnRes.data as Parameters<typeof printService.generateDebitNoteReceiptHtml>[0], profile as Parameters<typeof printService.generateDebitNoteReceiptHtml>[1], paperWidth)
      : await printService.generateDebitNoteHtml(dnRes.data as Parameters<typeof printService.generateDebitNoteHtml>[0], profile as Parameters<typeof printService.generateDebitNoteHtml>[1])
    const tmpPath = join(app.getPath('temp'), `sarang_dn_${Date.now()}.html`)
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

  handle('debitNotes:printReceipt', async (payload) => {
    const deny = await requirePermission('purchaseOrders.print'); if (deny) return deny
    const { id, paperWidth: overridePaperWidth } = payload as { id: string; paperWidth?: '80mm' | '58mm' }
    const bad = validateId(id, 'debit note ID'); if (bad) return bad
    const dnRes = await debitNoteService.getById(id)
    if (!dnRes.success) return dnRes
    const db = getPrisma()
    const [profile, printTypeSetting] = await Promise.all([
      db.businessProfile.findFirst(),
      db.setting.findUnique({ where: { settingKey: 'print_type' } })
    ])
    const printType = (printTypeSetting?.settingValue ?? 'THERMAL_80MM') as 'A4' | 'THERMAL_80MM' | 'THERMAL_58MM'
    const paperWidth = overridePaperWidth ?? (printType === 'THERMAL_58MM' ? '58mm' : '80mm')
    const html = await printService.generateDebitNoteReceiptHtml(dnRes.data as Parameters<typeof printService.generateDebitNoteReceiptHtml>[0], profile as Parameters<typeof printService.generateDebitNoteReceiptHtml>[1], paperWidth)
    const tmpPath = join(app.getPath('temp'), `sarang_dn_rcpt_${Date.now()}.html`)
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
