import { getPrisma } from '../database/db'
import { ServiceError } from '../errors/service-error'
import { getCurrencyDecimals } from '../../shared/utils/money'
import { toLocalISODate, parseLocalDateStart } from '../utils/date.util'
import { logAction } from './audit.service'
import { saveJsonFile } from './gst-returns.service'
import { buildEInvoiceJson, einvoiceProblems, type EInvoiceSource } from './einvoice-json.util'

// E-invoice file for one invoice (to upload on the e-invoice portal) and the register of IRNs the owner
// pastes back after the portal returns them. Nothing here talks to the government.

const IRN_PATTERN = /^[0-9a-fA-F]{64}$/

export async function loadEInvoiceSource(invoiceId: string): Promise<EInvoiceSource> {
  const db = getPrisma()
  const invoice = await db.invoice.findUnique({
    where: { id: invoiceId },
    include: { customer: true, items: true, originalInvoice: { select: { invoiceNumber: true, invoiceDate: true } } }
  })
  if (!invoice) throw new ServiceError('EINV-001', 'Invoice not found.')
  if (invoice.status === 'CANCELLED') throw new ServiceError('EINV-002', 'A cancelled invoice cannot be sent as an e-invoice.')
  const profile = await db.businessProfile.findFirst()
  const decimals = getCurrencyDecimals(profile?.currencyCode)
  const isCreditNote = invoice.invoiceType === 'RETURN'

  return {
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: toLocalISODate(invoice.invoiceDate),
    isCreditNote,
    gstType: invoice.gstType,
    pricesIncludeTax: invoice.pricesIncludeTax,
    roundingAmount: invoice.roundingAmount,
    totalAmount: invoice.totalAmount,
    decimals,
    buyerState: invoice.buyerState ?? invoice.customer?.state ?? null,
    seller: {
      gstin: (profile?.taxNumber ?? '').trim().toUpperCase(), name: profile?.businessName ?? '',
      address: profile?.address ?? '', city: profile?.city ?? '', state: profile?.state ?? ''
    },
    buyer: {
      gstin: (invoice.customer?.taxNumber ?? '').trim().toUpperCase(), name: invoice.customer?.customerName ?? '',
      address: invoice.customer?.address ?? '', city: invoice.customer?.city ?? '', state: invoice.customer?.state ?? ''
    },
    original: isCreditNote && invoice.originalInvoice
      ? { number: invoice.originalInvoice.invoiceNumber, date: toLocalISODate(invoice.originalInvoice.invoiceDate) }
      : undefined,
    lines: invoice.items.map((i) => ({
      description: i.productName || 'Item', hsnCode: i.hsnCode, quantity: i.quantity, unit: i.weightUnit ?? 'PCS',
      taxRate: i.taxRate, taxAmount: i.taxAmount, lineTotal: i.lineTotal, discountAmount: i.discountAmount
    }))
  }
}

export const einvoiceService = {
  async exportJson(invoiceId: string) {
    try {
      const source = await loadEInvoiceSource(invoiceId)
      const problems = einvoiceProblems(source)
      if (problems.length > 0) {
        return { success: false, error: { code: 'EINV-003', message: `Before the e-invoice file can be made, add: ${problems.join('; ')}.`, details: problems } }
      }
      const json = buildEInvoiceJson(source)
      const safeName = source.invoiceNumber.replace(/[^A-Za-z0-9_-]+/g, '_')
      return { success: true, data: await saveJsonFile(`EINV_${safeName}.json`, [json]) }
    } catch (err) {
      if (err instanceof ServiceError) return { success: false, error: { code: err.code, message: err.message } }
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Could not prepare the e-invoice file.' } }
    }
  },

  async saveIrn(payload: { invoiceId: string; irn: string; ackNo?: string; ackDate?: string; signedQr?: string }, userId?: string) {
    try {
      const db = getPrisma()
      const irn = payload.irn.trim()
      if (!IRN_PATTERN.test(irn)) throw new ServiceError('EINV-004', 'The IRN is 64 letters and digits. Copy it from the e-invoice portal.')
      const invoice = await db.invoice.findUnique({ where: { id: payload.invoiceId }, select: { id: true, invoiceNumber: true } })
      if (!invoice) throw new ServiceError('EINV-001', 'Invoice not found.')
      const clash = await db.invoice.findFirst({ where: { irn: { equals: irn.toLowerCase() }, id: { not: invoice.id } }, select: { invoiceNumber: true } })
      if (clash) throw new ServiceError('EINV-005', `This IRN is already saved on ${clash.invoiceNumber}.`)
      const updated = await db.invoice.update({
        where: { id: invoice.id },
        data: {
          irn: irn.toLowerCase(),
          irnAckNo: payload.ackNo?.trim() || null,
          irnAckDate: payload.ackDate ? parseLocalDateStart(payload.ackDate) : null,
          irnQr: payload.signedQr?.trim() || null
        },
        select: { id: true, irn: true, irnAckNo: true, irnAckDate: true }
      })
      await logAction({ userId, action: 'EINVOICE_IRN_SAVED', entityType: 'Invoice', entityId: invoice.id, newValue: { invoiceNumber: invoice.invoiceNumber } })
      return { success: true, data: updated }
    } catch (err) {
      if (err instanceof ServiceError) return { success: false, error: { code: err.code, message: err.message } }
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Could not save the IRN.' } }
    }
  },

  async clearIrn(invoiceId: string, userId?: string) {
    try {
      await getPrisma().invoice.update({ where: { id: invoiceId }, data: { irn: null, irnAckNo: null, irnAckDate: null, irnQr: null } })
      await logAction({ userId, action: 'EINVOICE_IRN_CLEARED', entityType: 'Invoice', entityId: invoiceId })
      return { success: true }
    } catch (err) {
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Could not clear the IRN.' } }
    }
  },

  /** Invoices in the period that are B2B (registered buyer), with or without an IRN, for the register report. */
  async register(params: { dateFrom: string; dateTo: string }) {
    const db = getPrisma()
    const from = parseLocalDateStart(params.dateFrom)
    const to = new Date(parseLocalDateStart(params.dateTo).getTime() + 24 * 60 * 60 * 1000 - 1)
    const invoices = await db.invoice.findMany({
      where: { invoiceDate: { gte: from, lte: to }, status: { notIn: ['CANCELLED', 'SPLIT'] }, customer: { taxNumber: { not: null } } },
      select: { invoiceNumber: true, invoiceType: true, invoiceDate: true, totalAmount: true, irn: true, irnAckNo: true, irnAckDate: true, customer: { select: { customerName: true, taxNumber: true } } },
      orderBy: { invoiceDate: 'asc' }
    })
    const rows = invoices.map((i) => ({
      invoiceNumber: i.invoiceNumber,
      kind: i.invoiceType === 'RETURN' ? 'CREDIT_NOTE' : 'INVOICE',
      date: toLocalISODate(i.invoiceDate),
      customer: i.customer?.customerName ?? '',
      gstin: i.customer?.taxNumber ?? '',
      total: i.totalAmount,
      irn: i.irn ?? '',
      ackNo: i.irnAckNo ?? '',
      ackDate: i.irnAckDate ? toLocalISODate(i.irnAckDate) : ''
    }))
    const withIrn = rows.filter((r) => r.irn !== '').length
    return { dateFrom: params.dateFrom, dateTo: params.dateTo, rows, counts: { withIrn, withoutIrn: rows.length - withIrn } }
  }
}
