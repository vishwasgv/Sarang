import { dialog } from 'electron'
import { readFile } from 'fs/promises'
import { getPrisma } from '../database/db'
import { ServiceError } from '../errors/service-error'
import { getCurrencyDecimals, roundMoney } from '../../shared/utils/money'
import { classifyTaxHead, resolvePartyState, splitGstHalves } from '../../shared/utils/gst-presentation'
import { toLocalISODate } from '../utils/date.util'
import { parsePortalPurchases, reconcilePurchases, type BookBill, type ReconResult } from './gst-portal-purchases.util'

// Compare the purchase data downloaded from the GST portal (GSTR-2B / 2A JSON) with the supplier bills in the
// books. Nothing is stored: the file is read, compared and the result shown.

export interface ReconReport extends ReconResult {
  fileName: string
  period: string
  portalDocCount: number
}

function periodMonthOf(rtnprd: string): string {
  const m = /^(\d{2})(\d{4})$/.exec(rtnprd)
  return m ? `${m[2]}-${m[1]}` : ''
}

export async function loadBooksForReconciliation(periodMonth: string): Promise<{ bills: BookBill[]; decimals: number }> {
  const db = getPrisma()
  const profile = await db.businessProfile.findFirst({ select: { state: true, taxNumber: true, currencyCode: true } })
  const decimals = getCurrencyDecimals(profile?.currencyCode)
  const businessState = resolvePartyState(profile?.state, profile?.taxNumber) || null

  const bills = await db.bill.findMany({
    where: { status: { not: 'VOID' }, supplier: { taxNumber: { not: null } } },
    include: { supplier: { select: { supplierName: true, taxNumber: true, state: true } }, items: { select: { taxRate: true, taxAmount: true } } }
  })

  return {
    decimals,
    bills: bills.map((b): BookBill => {
      const partyState = resolvePartyState(b.supplier.state, b.supplier.taxNumber) || null
      const head = classifyTaxHead(b.gstType, businessState, partyState).head
      const halves = splitGstHalves(b.taxAmount, decimals, b.items)
      const date = toLocalISODate(b.billDate)
      return {
        billId: b.id, billNumber: b.billNumber,
        supplierGstin: (b.supplier.taxNumber ?? '').trim().toUpperCase(), supplierName: b.supplier.supplierName,
        supplierInvoiceNumber: b.supplierInvoiceNumber ?? '', date,
        taxable: roundMoney(b.isReverseCharge ? b.totalAmount : b.totalAmount - b.taxAmount, decimals),
        igst: head === 'IGST' ? b.taxAmount : 0, cgst: head === 'IGST' ? 0 : halves.cgst, sgst: head === 'IGST' ? 0 : halves.sgst,
        tax: b.taxAmount, reverseCharge: b.isReverseCharge,
        inPeriod: periodMonth !== '' && date.startsWith(periodMonth)
      }
    })
  }
}

export const gstReconciliationService = {
  async runFromFile() {
    try {
      const { filePaths, canceled } = await dialog.showOpenDialog({
        title: 'Choose the GSTR-2B or GSTR-2A file',
        properties: ['openFile'],
        filters: [{ name: 'JSON files', extensions: ['json'] }]
      })
      if (canceled || !filePaths[0]) return { success: true, data: null }

      let parsed: unknown
      try {
        parsed = JSON.parse(await readFile(filePaths[0], 'utf8'))
      } catch {
        throw new ServiceError('GSTREC-001', 'This file could not be read. Choose the JSON file downloaded from the GST portal.')
      }
      const portal = parsePortalPurchases(parsed)
      if (portal.docs.length === 0) throw new ServiceError('GSTREC-002', 'No purchase invoices were found in this file.')

      const { bills, decimals } = await loadBooksForReconciliation(periodMonthOf(portal.period))
      const result = reconcilePurchases(portal, bills, decimals)
      const report: ReconReport = { ...result, fileName: filePaths[0].split(/[\\/]/).pop() ?? '', period: portal.period, portalDocCount: portal.docs.length }
      return { success: true, data: report }
    } catch (err) {
      if (err instanceof ServiceError) return { success: false, error: { code: err.code, message: err.message } }
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Could not compare the file.' } }
    }
  }
}
