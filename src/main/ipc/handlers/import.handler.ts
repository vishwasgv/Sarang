import * as importService from '../../services/import.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('import:parseFile', async (payload) => {
    const deny = await requirePermission('import.execute'); if (deny) return deny
    const p = (payload ?? {}) as { module?: string }
    if (!p.module) return { success: false, error: { code: 'VAL-001', message: 'module is required.' } }
    return importService.parseFile(p.module as importService.ImportModule)
  })

  handle('import:parseDroppedFile', async (payload) => {
    const deny = await requirePermission('import.execute'); if (deny) return deny
    const p = (payload ?? {}) as { module?: string; filePath?: string }
    if (!p.module || !p.filePath) return { success: false, error: { code: 'VAL-001', message: 'module and filePath are required.' } }
    return importService.parseDroppedFile(p.module as importService.ImportModule, p.filePath)
  })

  handle('import:validatePreview', async (payload) => {
    const deny = await requirePermission('import.execute'); if (deny) return deny
    const p = (payload ?? {}) as { sessionId?: string; mapping?: Record<string, string>; module?: string }
    if (!p.sessionId || !p.mapping || !p.module) return { success: false, error: { code: 'VAL-001', message: 'sessionId, mapping, and module are required.' } }
    return importService.validatePreview(p.sessionId, p.mapping, p.module as importService.ImportModule)
  })

  handle('import:execute', async (payload) => {
    const deny = await requirePermission('import.execute'); if (deny) return deny
    const p = (payload ?? {}) as { sessionId?: string; mapping?: Record<string, string>; module?: string }
    if (!p.sessionId || !p.mapping || !p.module) return { success: false, error: { code: 'VAL-001', message: 'sessionId, mapping, and module are required.' } }
    return importService.executeImport(p.sessionId, p.mapping, p.module as importService.ImportModule, getCurrentSession()?.userId)
  })

  handle('import:downloadTemplate', async (payload) => {
    const deny = await requirePermission('import.execute'); if (deny) return deny
    const p = (payload ?? {}) as { module?: string }
    if (!p.module) return { success: false, error: { code: 'VAL-001', message: 'module is required.' } }
    return importService.downloadTemplate(p.module as importService.ImportModule)
  })

  handle('import:getFields', async (payload) => {
    const deny = await requirePermission('import.execute'); if (deny) return deny
    const p = (payload ?? {}) as { module?: string }
    if (!p.module) return { success: false, error: { code: 'VAL-001', message: 'module is required.' } }
    return importService.getModuleFields(p.module as importService.ImportModule)
  })
}
