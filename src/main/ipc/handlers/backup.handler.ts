import { dialog } from 'electron'
import * as backupService from '../../services/backup.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { SetBackupDestinationSchema, ValidateBackupSchema, RestoreBackupSchema, BackupIdSchema } from '../../validation/backup.validation'

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
    const parsed = SetBackupDestinationSchema.safeParse(payload ?? {})
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return backupService.setBackupDestination(parsed.data.path ?? null, getCurrentSession()?.userId)
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
    const parsed = ValidateBackupSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'backupId is required.' } }
    return backupService.validateBackup(parsed.data.backupId)
  })

  handle('backup:restore', async (payload) => {
    const deny = await requirePermission('backup.restore'); if (deny) return deny
    const parsed = RestoreBackupSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'backupId is required.' } }
    return backupService.restoreBackup(parsed.data.backupId, getCurrentSession()?.userId)
  })

  handle('backup:delete', async (payload) => {
    const deny = await requirePermission('backup.delete'); if (deny) return deny
    const normalized = typeof payload === 'string' ? { id: payload } : payload
    const parsed = BackupIdSchema.safeParse(normalized)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Backup ID is required.' } }
    return backupService.deleteBackup(parsed.data.id, getCurrentSession()?.userId)
  })

  handle('backup:checkIntegrity', async () => {
    const deny = await requirePermission('backup.view'); if (deny) return deny
    const result = await backupService.checkDatabaseIntegrity()
    return { success: true, data: result }
  })
}
