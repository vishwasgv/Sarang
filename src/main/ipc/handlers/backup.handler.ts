import { dialog } from 'electron'
import * as backupService from '../../services/backup.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('backup:pickDestinationFolder', async () => {
    const deny = await requirePermission('backup.create'); if (deny) return deny
    const result = await dialog.showOpenDialog({
      title: 'Choose Backup Folder',
      properties: ['openDirectory', 'createDirectory']
    })
    if (result.canceled || !result.filePaths[0]) return { success: true, data: null }
    return { success: true, data: { folderPath: result.filePaths[0] } }
  })

  handle('backup:getDestination', async () => {
    const deny = await requirePermission('backup.view'); if (deny) return deny
    return backupService.getBackupDestination()
  })

  handle('backup:setDestination', async (payload) => {
    const deny = await requirePermission('backup.create'); if (deny) return deny
    const p = (payload ?? {}) as { path?: string | null }
    return backupService.setBackupDestination(p.path ?? null, getCurrentSession()?.userId)
  })

  handle('backup:create', async () => {
    const deny = await requirePermission('backup.create'); if (deny) return deny
    return backupService.createBackup(getCurrentSession()?.userId)
  })

  handle('backup:list', async () => {
    const deny = await requirePermission('backup.view'); if (deny) return deny
    return backupService.listBackups()
  })

  handle('backup:validate', async (payload) => {
    const deny = await requirePermission('backup.view'); if (deny) return deny
    const p = (payload ?? {}) as { backupId?: string }
    if (!p.backupId) return { success: false, error: { code: 'VAL-001', message: 'backupId is required.' } }
    return backupService.validateBackup(p.backupId)
  })

  handle('backup:restore', async (payload) => {
    const deny = await requirePermission('backup.restore'); if (deny) return deny
    const p = (payload ?? {}) as { backupId?: string }
    if (!p.backupId) return { success: false, error: { code: 'VAL-001', message: 'backupId is required.' } }
    return backupService.restoreBackup(p.backupId, getCurrentSession()?.userId)
  })

  handle('backup:delete', async (payload) => {
    const deny = await requirePermission('backup.delete'); if (deny) return deny
    const id = typeof payload === 'string' ? payload : (payload as { id?: string })?.id
    if (!id) return { success: false, error: { code: 'VAL-001', message: 'Backup ID is required.' } }
    return backupService.deleteBackup(id, getCurrentSession()?.userId)
  })

  handle('backup:checkIntegrity', async () => {
    const deny = await requirePermission('backup.view'); if (deny) return deny
    const result = await backupService.checkDatabaseIntegrity()
    return { success: true, data: result }
  })
}
