import { dialog } from 'electron'
import * as backupService from '../../services/backup.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { isSetupComplete } from '../../services/setup.service'
import { SetBackupDestinationSchema, ValidateBackupSchema, RestoreBackupSchema, RestoreBackupFromFileSchema, BackupIdSchema } from '../../validation/backup.validation'

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

  // Restore from an arbitrary .sarang-backup file (e.g. copied in from a USB
  // drive) rather than one of THIS install's own tracked Backup rows — the
  // path a brand-new install/device needs to bring over data from an old
  // one. Picking is ungated (a file path leaks nothing); the restore itself
  // is gated below. No permission gate before setup is complete: a fresh
  // install has no session/admin yet, and this mirrors setup:completeSetup's
  // own pre-auth reachability — but only up to the point setup finishes, so
  // an already-set-up install still requires backup.restore like every
  // other restore path.
  handle('backup:pickBackupFile', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select Sarang Backup File',
      filters: [{ name: 'Sarang Backup', extensions: ['sarang-backup'] }],
      properties: ['openFile']
    })
    if (result.canceled || !result.filePaths[0]) return { success: true, data: null }
    return { success: true, data: { filePath: result.filePaths[0] } }
  })

  handle('backup:restoreFromFile', async (payload) => {
    const setupState = await isSetupComplete()
    const preAuthAllowed = setupState.success && !setupState.data?.complete
    if (!preAuthAllowed) {
      const deny = await requirePermission('backup.restore'); if (deny) return deny
    }
    const parsed = RestoreBackupFromFileSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'A backup file path is required.' } }
    return backupService.restoreBackupFromFile(parsed.data.filePath, getCurrentSession()?.userId)
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
