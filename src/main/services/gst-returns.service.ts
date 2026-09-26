import { chooseSavePath } from '../lan/file-bridge'
import { dialog } from 'electron'
import { writeFile } from 'fs/promises'
import { getPrisma } from '../database/db'
import { ServiceError } from '../errors/service-error'
import { reportService } from './report.service'
import { gstInputCreditService } from './gst-input-credit.service'
import { buildGstr1Json, buildGstr3bJson } from './gst-return-json.util'
import { stateCodeFromGstin } from '../../shared/utils/gst-presentation'

// GST return files for the government portal's offline tools. One calendar month at a time.

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/

export function monthRange(month: string): { dateFrom: string; dateTo: string } {
  if (!MONTH_PATTERN.test(month)) throw new ServiceError('GSTRET-001', 'Choose a month.')
  const [y, m] = month.split('-').map(Number)
  const last = new Date(y, m, 0).getDate()
  return { dateFrom: `${month}-01`, dateTo: `${month}-${String(last).padStart(2, '0')}` }
}

async function businessGstin(): Promise<string> {
  const profile = await getPrisma().businessProfile.findFirst({ select: { taxNumber: true } })
  const gstin = (profile?.taxNumber ?? '').trim().toUpperCase()
  if (!gstin || !stateCodeFromGstin(gstin)) {
    throw new ServiceError('GSTRET-002', 'Enter your business GSTIN in Settings before preparing a GST return file.')
  }
  return gstin
}

export async function prepareGstr1Json(month: string) {
  const range = monthRange(month)
  const gstin = await businessGstin()
  const [gstr1, hsn] = await Promise.all([reportService.generateGSTR1(range), reportService.generateHSNSummaryReport(range)])
  return buildGstr1Json({ gstin, dateFrom: range.dateFrom, gstr1, hsn })
}

export async function prepareGstr3bJson(month: string) {
  const range = monthRange(month)
  const gstin = await businessGstin()
  const [preview, net] = await Promise.all([reportService.generateGSTR3BPreview(range), gstInputCreditService.generateGstNetPayable(range)])
  return buildGstr3bJson({ gstin, dateFrom: range.dateFrom, preview, net })
}

export async function saveJsonFile(defaultName: string, body: unknown): Promise<{ saved: boolean; path?: string }> {
  const { filePath } = await chooseSavePath({
    title: 'Save file',
    defaultPath: defaultName,
    filters: [{ name: 'JSON files', extensions: ['json'] }]
  })
  if (!filePath) return { saved: false }
  await writeFile(filePath, JSON.stringify(body, null, 2), 'utf8')
  return { saved: true, path: filePath }
}

export const gstReturnsService = {
  async exportGstr1(month: string) {
    try {
      const json = await prepareGstr1Json(month)
      const result = await saveJsonFile(`GSTR1_${json.fp}.json`, json)
      return { success: true, data: result }
    } catch (err) {
      if (err instanceof ServiceError) return { success: false, error: { code: err.code, message: err.message } }
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Could not prepare the GSTR-1 file.' } }
    }
  },

  async exportGstr3b(month: string) {
    try {
      const json = await prepareGstr3bJson(month)
      const result = await saveJsonFile(`GSTR3B_${json.ret_period}.json`, json)
      return { success: true, data: result }
    } catch (err) {
      if (err instanceof ServiceError) return { success: false, error: { code: err.code, message: err.message } }
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Could not prepare the GSTR-3B file.' } }
    }
  }
}
