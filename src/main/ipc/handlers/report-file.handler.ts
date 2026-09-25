import { z } from 'zod'
import { reportFileService } from '../../services/report-file.service'
import { requirePermission } from '../permission-guard'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

const Cell = z.union([z.string(), z.number(), z.null()]).optional()
const SaveSchema = z.object({
  folder: z.string().min(1, 'Choose a folder'),
  fileName: z.string().min(1).max(200),
  format: z.enum(['CSV', 'XLSX']),
  sheetName: z.string().max(60).optional(),
  headers: z.array(z.string()).max(200),
  rows: z.array(z.array(Cell)).max(200000)
})

export function register(handle: HandleFn): void {
  handle('reportFiles:chooseFolder', async () => {
    const deny = await requirePermission('reports.export'); if (deny) return deny
    return reportFileService.chooseFolder()
  })

  handle('reportFiles:save', async (payload) => {
    const deny = await requirePermission('reports.export'); if (deny) return deny
    const parsed = SaveSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload.' } }
    return reportFileService.save(parsed.data)
  })
}
