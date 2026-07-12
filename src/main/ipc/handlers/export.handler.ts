import { requirePermission } from '../permission-guard'
import { exportToCsv, exportToExcel, exportToPdf, generateReportHtml } from '../../services/export.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('export:toCsv', async (payload) => {
    const deny = await requirePermission('reports.export'); if (deny) return deny
    const p = payload as Parameters<typeof exportToCsv>[0]
    await exportToCsv(p)
    return { success: true }
  })

  handle('export:toExcel', async (payload) => {
    const deny = await requirePermission('reports.export'); if (deny) return deny
    const p = payload as Parameters<typeof exportToExcel>[0]
    await exportToExcel(p)
    return { success: true }
  })

  handle('export:toPdf', async (payload) => {
    const deny = await requirePermission('reports.print'); if (deny) return deny
    const p = payload as { html: string; filename: string }
    await exportToPdf(p)
    return { success: true }
  })

  handle('export:generateReportHtml', async (payload) => {
    const p = payload as Parameters<typeof generateReportHtml>[0] & { reportPermission?: string }
    // The report being rendered determines which permission gates it — a caller printing a
    // Tax Report needs reports.tax, not reports.sales. Falls back to reports.sales only if the
    // caller didn't specify one, matching this handler's original (narrower) behaviour.
    const deny = await requirePermission(p.reportPermission ?? 'reports.sales'); if (deny) return deny
    const { reportPermission: _reportPermission, ...htmlParams } = p
    const html = await generateReportHtml(htmlParams)
    return { success: true, data: html }
  })
}
