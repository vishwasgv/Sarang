import { ipcMain } from 'electron'

export type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function registerHandle(): HandleFn {
  return (channel, handler) => {
    ipcMain.handle(channel, async (_event, payload) => {
      try {
        return await handler(payload)
      } catch (err) {
        console.error(`[IPC] Unhandled error in ${channel}:`, err)
        return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
      }
    })
  }
}

export function validateId(id: unknown, label: string): string {
  if (!id || typeof id !== 'string') {
    throw { success: false, error: { code: 'VAL-001', message: `${label} ID is required.` } }
  }
  return id
}
