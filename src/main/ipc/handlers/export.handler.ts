import { requirePermission } from '../permission-guard'
import { exportToCsv, exportToExcel, exportToPdf, generateReportHtml } from '../../services/export.service'
import { ExportToCsvSchema, ExportToExcelSchema, ExportToPdfSchema, GenerateReportHtmlSchema } from '../../validation/export.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('export:toCsv', async (payload) => {
    const deny = await requirePermission('reports.export'); if (deny) return deny
    const parsed = ExportToCsvSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    await exportToCsv(parsed.data)
    return { success: true }
  })

  handle('export:toExcel', async (payload) => {
    const deny = await requirePermission('reports.export'); if (deny) return deny
    const parsed = ExportToExcelSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    await exportToExcel(parsed.data)
    return { success: true }
  })

  handle('export:toPdf', async (payload) => {
    const deny = await requirePermission('reports.print'); if (deny) return deny
    const parsed = ExportToPdfSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    await exportToPdf(parsed.data)
    return { success: true }
  })

  handle('export:generateReportHtml', async (payload) => {
    const parsed = GenerateReportHtmlSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    const p = parsed.data
    // The report being rendered determines which permission gates it — a caller printing a
    // Tax Report needs reports.tax, not reports.sales. Falls back to reports.sales only if the
    // caller didn't specify one, matching this handler's original (narrower) behaviour.
    const deny = await requirePermission(p.reportPermission ?? 'reports.sales'); if (deny) return deny
    const { reportPermission: _reportPermission, ...htmlParams } = p
    const html = await generateReportHtml(htmlParams)
    return { success: true, data: html }
  })
}
