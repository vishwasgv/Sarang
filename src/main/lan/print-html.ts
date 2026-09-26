import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { writeFile, unlink } from 'fs/promises'
import { isRemoteRequest } from './context'

export interface PrintOptions {
  silent?: boolean
  printBackground?: boolean
  color?: boolean
}

export type PrintResult = { success: boolean; data?: unknown; error?: { code: string; message: string } }

// Prints a page of HTML on this PC. When the request came from another PC, the page is handed back instead and the
// caller's PC prints it on its own printer.
export async function printHtml(html: string, prefix: string, options: PrintOptions = { silent: false, printBackground: true }): Promise<PrintResult> {
  if (isRemoteRequest()) return { success: true, data: { printed: true, __printHtml: html, __printOptions: options } }
  const tmpPath = join(app.getPath('temp'), `${prefix}_${Date.now()}.html`)
  await writeFile(tmpPath, html, 'utf-8')
  return new Promise<PrintResult>((resolve) => {
    const win = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true, sandbox: true } })
    win.loadFile(tmpPath)
    win.webContents.once('did-finish-load', () => {
      win.webContents.print(options, (success: boolean) => {
        win.close()
        unlink(tmpPath).catch(() => {})
        resolve({ success, data: { printed: success } })
      })
    })
  })
}
