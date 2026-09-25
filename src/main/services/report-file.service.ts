import { dialog } from 'electron'
import * as XLSX from 'xlsx'
import { stat, writeFile, access } from 'fs/promises'
import { join, resolve, extname } from 'path'
import { ServiceError } from '../errors/service-error'

// Writes a report to a folder the owner picked, with no save dialog, for reports saved on a schedule while the
// app is open. The folder must already exist and the file name is cleaned so it cannot leave that folder.

export type ReportFileFormat = 'CSV' | 'XLSX'
type Cell = string | number | null | undefined

export function safeFileName(name: string): string {
  const last = name.split(/[\\/]/).pop() ?? ''
  const base = last.replace(/[:*?"<>|\u0000-\u001f]+/g, '_').trim().replace(/^\.+/, '')
  return base === '' ? 'report' : base.slice(0, 120)
}

export function csvText(headers: string[], rows: Cell[][]): string {
  const esc = (v: Cell): string => {
    if (v === null || v === undefined) return ''
    const s = String(v)
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return '﻿' + [headers, ...rows].map((r) => r.map(esc).join(',')).join('\r\n') + '\r\n'
}

async function uniquePath(folder: string, fileName: string): Promise<string> {
  const ext = extname(fileName)
  const stem = fileName.slice(0, fileName.length - ext.length)
  for (let i = 0; i < 100; i++) {
    const candidate = join(folder, i === 0 ? fileName : `${stem} (${i})${ext}`)
    try { await access(candidate) } catch { return candidate }
  }
  throw new ServiceError('RPTFILE-003', 'Too many files with this name in the folder.')
}

export const reportFileService = {
  async chooseFolder() {
    const { filePaths, canceled } = await dialog.showOpenDialog({ title: 'Choose a folder for saved reports', properties: ['openDirectory', 'createDirectory'] })
    return { success: true, data: canceled || !filePaths[0] ? null : filePaths[0] }
  },

  async save(p: { folder: string; fileName: string; format: ReportFileFormat; sheetName?: string; headers: string[]; rows: Cell[][] }) {
    try {
      const folder = resolve(p.folder)
      const info = await stat(folder).catch(() => null)
      if (!info || !info.isDirectory()) throw new ServiceError('RPTFILE-001', 'The folder for saved reports was not found. Choose it again.')
      const ext = p.format === 'CSV' ? '.csv' : '.xlsx'
      const name = safeFileName(p.fileName.replace(/\.(csv|xlsx)$/i, '')) + ext
      const target = await uniquePath(folder, name)
      if (!target.startsWith(folder)) throw new ServiceError('RPTFILE-002', 'That file name is not allowed.')
      if (p.format === 'CSV') {
        await writeFile(target, csvText(p.headers, p.rows), 'utf8')
      } else {
        const wb = XLSX.utils.book_new()
        const ws = XLSX.utils.aoa_to_sheet([p.headers, ...p.rows])
        ws['!cols'] = p.headers.map(() => ({ wch: 20 }))
        XLSX.utils.book_append_sheet(wb, ws, (p.sheetName ?? 'Report').replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'Report')
        await writeFile(target, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
      }
      return { success: true, data: { path: target } }
    } catch (err) {
      if (err instanceof ServiceError) return { success: false, error: { code: err.code, message: err.message } }
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Could not save the report.' } }
    }
  }
}
