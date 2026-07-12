import * as importService from '../../services/import.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import {
  ParseFileSchema,
  ParseDroppedFileSchema,
  ValidatePreviewSchema,
  ExecuteImportSchema,
  DownloadTemplateSchema,
  GetModuleFieldsSchema,
} from '../../validation/import.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('import:parseFile', async (payload) => {
    const deny = await requirePermission('import.execute'); if (deny) return deny
    const parsed = ParseFileSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return importService.parseFile(parsed.data.module)
  })

  handle('import:parseDroppedFile', async (payload) => {
    const deny = await requirePermission('import.execute'); if (deny) return deny
    const parsed = ParseDroppedFileSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return importService.parseDroppedFile(parsed.data.module, parsed.data.filePath)
  })

  handle('import:validatePreview', async (payload) => {
    const deny = await requirePermission('import.execute'); if (deny) return deny
    const parsed = ValidatePreviewSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return importService.validatePreview(parsed.data.sessionId, parsed.data.mapping, parsed.data.module)
  })

  handle('import:execute', async (payload) => {
    const deny = await requirePermission('import.execute'); if (deny) return deny
    const parsed = ExecuteImportSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return importService.executeImport(parsed.data.sessionId, parsed.data.mapping, parsed.data.module, getCurrentSession()?.userId)
  })

  handle('import:downloadTemplate', async (payload) => {
    const deny = await requirePermission('import.execute'); if (deny) return deny
    const parsed = DownloadTemplateSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return importService.downloadTemplate(parsed.data.module)
  })

  handle('import:getFields', async (payload) => {
    const deny = await requirePermission('import.execute'); if (deny) return deny
    const parsed = GetModuleFieldsSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return importService.getModuleFields(parsed.data.module)
  })
}
