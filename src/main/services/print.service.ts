import QRCode from 'qrcode'
import { readFileSync } from 'fs'
import { join } from 'path'
import { aszurexFooterHtml, aszurexBrandSuffixHtml } from '../utils/branding'
import { getPrisma } from '../database/db'
import { formatAmount as formatAmountLocaleAware } from './currency.service'

// Phase 38: jsbarcode's minified browser bundle, inlined as a <script> block into
// generated label HTML rather than referenced by file:// path — this guarantees it
// works identically in dev and in a packaged/asar build with no runtime path
// resolution risk. Read once at module load, not per print job.
let jsBarcodeScriptCache: string | null = null
function getJsBarcodeScript(): string {
  if (jsBarcodeScriptCache === null) {
    jsBarcodeScriptCache = readFileSync(join(require.resolve('jsbarcode/package.json'), '..', 'dist', 'JsBarcode.all.min.js'), 'utf-8')
  }
  return jsBarcodeScriptCache
}

function escHtml(s: string | null | undefined): string {
  if (!s) return ''
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

interface BusinessProfile {
  businessName: string
  ownerName?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  phone?: string | null
  email?: string | null
  taxNumber?: string | null
  upiId?: string | null
  logoPath?: string | null
  enableDocumentWatermark?: boolean | null
  currencySymbol?: string
  taxModel?: string | null
  country?: string | null
}

// UPI is exclusively an Indian payment system — a business outside India
// has no legitimate way to hold a valid UPI VPA, so a QR must never be
// shown regardless of what (if anything) ended up in the upiId field.
// Exported so every UPI-QR call site (this file's two, plus Phase 47's
// QR-ordering flow) shares one gate rather than each re-deriving it —
// `generateUpiQr()` itself does NOT self-guard on country, callers must
// check this first.
//
// BusinessProfile.country is free text typed into SetupWizard.tsx's plain
// input (defaulting to "India", never normalized to an ISO code — see that
// file's COUNTRY_DEFAULTS map, which is itself keyed by lowercased country
// name, not 'IN'), so a strict `=== 'IN'` check never matches a real
// business and silently disables the QR for every Indian setup. Match
// loosely instead, same convention as HotelBookingsScreen.tsx's
// getIdTypesForCountry.
export function canShowUpiQr(profile: { upiId?: string | null; country?: string | null } | null | undefined): boolean {
  const country = (profile?.country ?? '').trim().toLowerCase()
  return Boolean(profile?.upiId) && (country === 'in' || country.includes('india'))
}

function logoToFileUrl(p: string): string {
  return 'file:///' + p.replace(/\\/g, '/')
}

const LOGO_MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp'
}

/**
 * Base64 data-URI form of the logo, for print delivery paths with no resolvable
 * file:// base (e.g. a window.open()/document.write() popup) — mirrors the same
 * technique already used for the Aszurex partnership mark in print-branding.ts.
 */
export function logoToBase64DataUri(p: string): string {
  const ext = p.split('.').pop()?.toLowerCase() ?? 'png'
  const mime = LOGO_MIME_BY_EXT[ext] ?? 'image/png'
  return `data:${mime};base64,${readFileSync(p).toString('base64')}`
}

/**
 * Semi-transparent, centered, rotated logo behind document content — opt-in via
 * BusinessProfile.enableDocumentWatermark, distinct from the plain corner logo.
 * Caller's <body> should not rely on painting order for other absolutely-positioned
 * elements; this div is emitted first so normal-flow content paints above it.
 *
 * IMPORTANT: the caller's <body> must set its OWN stacking context (e.g.
 * `position:relative; z-index:0`, not just `position:relative`) or this z-index:-1
 * div escapes past body entirely and paints BEHIND body's own opaque background —
 * i.e. completely invisible. `z-index:auto` does not establish a stacking context;
 * an explicit z-index does.
 */
function watermarkHtml(profile: BusinessProfile | null, logoUrl?: string): string {
  if (!profile?.enableDocumentWatermark || !profile?.logoPath) return ''
  const src = logoUrl ?? logoToFileUrl(profile.logoPath)
  // z-index -1 (not 0): normal-flow static content always paints above a positioned
  // descendant with z-index 0, so 0 would put the watermark ABOVE the document
  // content instead of behind it.
  return `<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);opacity:0.08;z-index:-1;pointer-events:none;"><img src="${src}" style="width:60vw;max-width:400px;object-fit:contain;" alt="" /></div>`
}

/** Mirrors renderer's tax.util.ts getTaxLabel() — main process can't import renderer code. */
function getTaxLabel(taxModel?: string | null): string {
  switch (taxModel) {
    case 'GST': return 'GST'
    case 'VAT': return 'VAT'
    case 'SALES_TAX': return 'Sales Tax'
    case 'CUSTOM': return 'Tax'
    default: return 'Tax'
  }
}

interface InvoiceItem {
  // Snapshot at time of sale — the correct source for print output. Not
  // item.product.productName, which is the product's CURRENT (possibly later
  // renamed) name and isn't even selected by getInvoice()'s Prisma query.
  productName: string
  product: { unit: string }
  quantity: number
  unitPrice: number
  discountAmount: number
  taxRate: number
  taxAmount: number
  lineTotal: number
  variantInfo?: string | null
  // Fresh-audit fix (2026-07-12): purity/weight/making-charge breakdown a
  // jewellery line was priced from — previously computed then discarded,
  // never reaching print. Absent/null for a non-jewellery line.
  jewelleryMetalType?: string | null
  jewelleryPurity?: string | null
  jewelleryNetWeight?: number | null
  jewelleryRatePerGram?: number | null
  jewelleryMakingCharge?: number | null
  // Phase 58 §2 — hallmark/HUID number (BIS HUID in India, or equivalent),
  // printed on the invoice so the compliance mark travels with the sale
  // record, not only the physical piece.
  jewelleryHallmarkNumber?: string | null
}

function jewelleryDetailLine(item: InvoiceItem, sym: string): string {
  if (!item.jewelleryMetalType) return ''
  const metal = `${item.jewelleryMetalType} ${item.jewelleryPurity ?? ''}`.trim()
  const weight = item.jewelleryNetWeight != null ? `${item.jewelleryNetWeight.toFixed(3)}g` : ''
  const rate = item.jewelleryRatePerGram != null ? `@ ${formatAmount(item.jewelleryRatePerGram, sym)}/g` : ''
  const making = item.jewelleryMakingCharge ? `+ ${formatAmount(item.jewelleryMakingCharge, sym)} making` : ''
  const hallmark = item.jewelleryHallmarkNumber ? `HUID: ${item.jewelleryHallmarkNumber}` : ''
  return [metal, weight, rate, making, hallmark].filter(Boolean).join(' ')
}

interface Invoice {
  invoiceNumber: string
  invoiceDate: string | Date
  status: string
  customer?: { customerName: string; phone?: string | null; customerCode?: string | null } | null
  items: InvoiceItem[]
  subtotal: number
  discountAmount: number
  taxAmount: number
  roundingAmount: number
  totalAmount: number
  paidAmount: number
  balanceAmount: number
  paymentStatus: string
  notes?: string | null
  gstType?: string | null
}

// Exported — Phase 47's QR table ordering reuses this to let a customer pay
// for their order via UPI directly from their own phone, same URI shape and
// QR rendering as every printed document already uses, just a different
// transaction note (no invoice exists yet at order-submission time).
export async function generateUpiQr(upiId: string, name: string, amount: number, note: string): Promise<string> {
  // tn (transaction note) lets the payer's UPI app show what this payment is
  // for — without it, the payer sees only "pay ₹X to Business" with no way to
  // reconcile which purchase the payment belongs to.
  const uri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(name)}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(note)}`
  // 300px source — every caller currently displays this at 180-220px; a
  // higher source resolution than the display size keeps the QR crisp and
  // reliably scannable at typical print DPI, rather than upscaling a
  // low-resolution source and risking scan failures.
  return QRCode.toDataURL(uri, { width: 300, margin: 2, color: { dark: '#000000', light: '#ffffff' } })
}

function formatDate(d: string | Date): string {
  return new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
}

// Real bug found+fixed 2026-07-15: this used to be `${symbol}${amount.toFixed(2)}`
// with no digit grouping at all — every printed invoice/receipt/report showed
// e.g. "₹14568.00" instead of "₹14,568.00" for any amount over 999, completely
// ignoring the `number_format`/`currency_symbol_position` Settings that the
// renderer's own currency.util.ts already respects correctly (confirmed via a
// real print-preview HTML inspection, not just reading the code). Fixed by
// routing through currency.service.ts's already-correct, locale-aware
// `formatAmount` (Intl.NumberFormat-based) instead of reimplementing it here
// a second, naive time.
async function getPrintFormatSettings(): Promise<{ numberFormat: string; decimals: number; symbolPosition: 'prefix' | 'suffix' }> {
  const db = getPrisma()
  const rows = await db.setting.findMany({ where: { settingKey: { in: ['number_format', 'decimal_places', 'currency_symbol_position'] } } })
  const map = new Map(rows.map(r => [r.settingKey, r.settingValue]))
  const numberFormat = map.get('number_format') ?? 'IN'
  const decimalsRaw = map.get('decimal_places')
  const decimals = decimalsRaw !== undefined ? parseInt(decimalsRaw, 10) : 2
  const symbolPosition = map.get('currency_symbol_position') === 'suffix' ? 'suffix' : 'prefix'
  return { numberFormat, decimals: Number.isFinite(decimals) ? decimals : 2, symbolPosition }
}

// Exported so other main-process code building printable content (e.g. Phase
// 38's label price text) formats currency the same way every print template
// in this file already does, instead of re-implementing the same string.
// Locale-aware: fetches the same Settings the print templates below use.
export async function formatAmount(amount: number, symbol = '₹'): Promise<string> {
  const { numberFormat, decimals, symbolPosition } = await getPrintFormatSettings()
  return formatAmountLocaleAware(Math.abs(amount), symbol, numberFormat, decimals, symbolPosition)
}

export const printService = {
  async generateInvoiceHtml(invoice: Invoice, profile: BusinessProfile | null): Promise<string> {
    const sym = escHtml(profile?.currencySymbol ?? '₹')
    const bizName = escHtml(profile?.businessName ?? 'Business')
    // Locale-aware formatting settings, fetched once per document and
    // shadowed as a synchronous local so the many unqualified `formatAmount(...)`
    // calls below (inside template literals, which can't `await`) all pick
    // this up automatically without individually being rewritten.
    const _fmtSettings = await getPrintFormatSettings()
    const formatAmount = (amount: number, symbol = sym): string => formatAmountLocaleAware(Math.abs(amount), symbol, _fmtSettings.numberFormat, _fmtSettings.decimals, _fmtSettings.symbolPosition)

    let qrHtml = ''
    if (canShowUpiQr(profile) && invoice.balanceAmount > 0.01) {
      try {
        const qr = await generateUpiQr(profile!.upiId!, bizName, invoice.balanceAmount, `Invoice ${invoice.invoiceNumber}`)
        qrHtml = `<div class="qr-section"><p class="qr-label">Scan to Pay (UPI)</p><img src="${qr}" width="200" height="200" alt="UPI QR"/><p class="qr-note">SARANG records payments only. Scan using BHIM, GPay, PhonePe or any UPI app.</p></div>`
      } catch { /* QR generation optional */ }
    }

    // CGST/SGST breakdown for GST tax model (GAP G4.3) — branches on THIS
    // invoice's own gstType, not just the business's general tax model. An
    // inter-state (IGST) sale must print a single IGST line, never CGST+SGST —
    // showing CGST/SGST on an inter-state sale is legally incorrect under GST.
    const isGstModel = profile?.taxModel === 'GST'
    const isIGST = invoice.gstType === 'IGST'
    const cgst = invoice.taxAmount / 2
    const sgst = invoice.taxAmount / 2
    const taxHtml = invoice.taxAmount > 0
      ? isGstModel
        ? isIGST
          ? `<div class="totals-row"><span>IGST</span><span>${formatAmount(invoice.taxAmount, sym)}</span></div>`
          : `<div class="totals-row"><span>CGST</span><span>${formatAmount(cgst, sym)}</span></div>
           <div class="totals-row"><span>SGST</span><span>${formatAmount(sgst, sym)}</span></div>`
        : `<div class="totals-row"><span>${escHtml(getTaxLabel(profile?.taxModel))}</span><span>${formatAmount(invoice.taxAmount, sym)}</span></div>`
      : ''

    const itemsHtml = invoice.items.map(item => `
      <tr>
        <td>${escHtml(item.productName)}${item.variantInfo ? `<br><span style="font-size:10px;color:#666">${escHtml(item.variantInfo)}</span>` : ''}${jewelleryDetailLine(item, sym) ? `<br><span style="font-size:10px;color:#666">${escHtml(jewelleryDetailLine(item, sym))}</span>` : ''}</td>
        <td class="right">${item.quantity} ${escHtml(item.product.unit)}</td>
        <td class="right">${formatAmount(item.unitPrice, sym)}</td>
        <td class="right">${item.discountAmount > 0 ? formatAmount(item.discountAmount, sym) : '—'}</td>
        <td class="right">${item.taxRate > 0 ? item.taxRate + '%' : '—'}</td>
        <td class="right bold">${formatAmount(item.lineTotal, sym)}</td>
      </tr>`).join('')

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Invoice ${invoice.invoiceNumber}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #1e293b; background: #fff; padding: 20mm; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; border-bottom: 2px solid #00AEEF; padding-bottom: 16px; }
  .biz-name { font-size: 22px; font-weight: 700; color: #0F172A; }
  .biz-meta { font-size: 11px; color: #64748b; margin-top: 4px; line-height: 1.5; }
  .invoice-meta { text-align: right; }
  .inv-number { font-size: 16px; font-weight: 700; color: #00AEEF; }
  .inv-date { font-size: 11px; color: #64748b; margin-top: 4px; }
  .status-badge { display: inline-block; padding: 2px 10px; border-radius: 20px; font-size: 10px; font-weight: 600; margin-top: 6px; }
  .status-ACTIVE { background: #dcfce7; color: #166534; }
  .status-CANCELLED { background: #fee2e2; color: #991b1b; }
  .section { margin-bottom: 20px; }
  .section-title { font-size: 10px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; }
  .customer-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 14px; }
  .customer-name { font-weight: 600; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th { background: #f1f5f9; text-align: left; padding: 8px 10px; font-size: 10px; font-weight: 600; text-transform: uppercase; color: #64748b; }
  td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; font-size: 11px; }
  .right { text-align: right; }
  .bold { font-weight: 600; }
  .totals { display: flex; justify-content: flex-end; margin-bottom: 20px; }
  .totals-table { min-width: 260px; }
  .totals-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px; color: #475569; }
  .totals-total { display: flex; justify-content: space-between; padding: 8px 0; font-size: 15px; font-weight: 700; color: #0F172A; border-top: 2px solid #00AEEF; margin-top: 4px; }
  .totals-balance { display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px; font-weight: 600; color: #EF4444; }
  .qr-section { text-align: center; margin: 16px 0; }
  .qr-label { font-size: 11px; font-weight: 600; color: #0F172A; margin-bottom: 8px; }
  .qr-note { font-size: 9px; color: #94a3b8; margin-top: 6px; max-width: 200px; margin-left: auto; margin-right: auto; }
  .footer { margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 12px; text-align: center; color: #94a3b8; font-size: 10px; }
  .notes-box { background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 8px 12px; font-size: 11px; color: #92400e; margin-bottom: 16px; }
  @media print { body { padding: 0; } }
</style>
</head>
<body style="position:relative;z-index:0;">
  ${watermarkHtml(profile)}
  <div class="header">
    <div>
      ${profile?.logoPath ? `<img src="${logoToFileUrl(profile.logoPath)}" alt="Logo" style="max-height:60px;max-width:140px;object-fit:contain;display:block;margin-bottom:8px;" />` : ''}
      <div class="biz-name">${bizName}</div>
      <div class="biz-meta">
        ${[profile?.address, profile?.city, profile?.state].filter(Boolean).map(escHtml).join(', ') || ''}
        ${profile?.phone ? '<br>' + escHtml(profile.phone) : ''}
        ${profile?.email ? '<br>' + escHtml(profile.email) : ''}
        ${profile?.taxNumber ? '<br>Tax/GST: ' + escHtml(profile.taxNumber) : ''}
      </div>
    </div>
    <div class="invoice-meta">
      <div class="inv-number">Invoice ${escHtml(invoice.invoiceNumber)}</div>
      <div class="inv-date">${formatDate(invoice.invoiceDate)}</div>
      <div><span class="status-badge status-${invoice.status}">${invoice.status}</span></div>
    </div>
  </div>

  ${invoice.customer ? `
  <div class="section">
    <div class="section-title">Bill To</div>
    <div class="customer-box">
      <div class="customer-name">${escHtml(invoice.customer.customerName)}</div>
      ${invoice.customer.phone ? `<div style="color:#64748b;font-size:11px">${escHtml(invoice.customer.phone)}</div>` : ''}
      ${invoice.customer.customerCode ? `<div style="color:#94a3b8;font-size:10px">${escHtml(invoice.customer.customerCode)}</div>` : ''}
    </div>
  </div>` : ''}

  <div class="section">
    <div class="section-title">Items</div>
    <table>
      <thead>
        <tr>
          <th>Product</th>
          <th class="right">Qty</th>
          <th class="right">Unit Price</th>
          <th class="right">Discount</th>
          <th class="right">Tax</th>
          <th class="right">Total</th>
        </tr>
      </thead>
      <tbody>${itemsHtml}</tbody>
    </table>
  </div>

  ${invoice.notes ? `<div class="notes-box">Note: ${escHtml(invoice.notes)}</div>` : ''}

  <div class="totals">
    <div class="totals-table">
      <div class="totals-row"><span>Subtotal</span><span>${formatAmount(invoice.subtotal, sym)}</span></div>
      ${invoice.discountAmount > 0 ? `<div class="totals-row"><span>Discount</span><span>- ${formatAmount(invoice.discountAmount, sym)}</span></div>` : ''}
      ${taxHtml}
      ${Math.abs(invoice.roundingAmount) > 0.001 ? `<div class="totals-row"><span>Rounding</span><span>${invoice.roundingAmount >= 0 ? '+' : ''}${formatAmount(invoice.roundingAmount, sym)}</span></div>` : ''}
      <div class="totals-total"><span>Total</span><span>${formatAmount(invoice.totalAmount, sym)}</span></div>
      ${invoice.paidAmount > 0 ? `<div class="totals-row"><span>Paid</span><span>${formatAmount(invoice.paidAmount, sym)}</span></div>` : ''}
      ${invoice.balanceAmount > 0.01 ? `<div class="totals-balance"><span>Balance Due</span><span>${formatAmount(invoice.balanceAmount, sym)}</span></div>` : ''}
    </div>
  </div>

  ${qrHtml}

  <div class="footer">
    <p>Thank you for your business!</p>
    <p style="margin-top:8px;font-style:italic;color:#64748b;font-size:9px">This is a computer-generated document. Calculations are based on data entered by the user. Verify all totals before use for legal or tax purposes.</p>
    <p style="margin-top:4px">${await aszurexFooterHtml(10)}</p>
  </div>
</body>
</html>`
  },

  // Phase 54F.16 — payslip document. Deduction/allowance names are whatever
  // the owner typed in (e.g. "PF", "ESI", "Professional Tax") — this app does
  // not compute or validate statutory amounts, see PHASE_54F_16_TECHNICAL_SPEC.md.
  async generatePayslipHtml(payslip: {
    employeeName: string
    employeeNumber?: string | null
    designation?: string | null
    periodYear: number
    periodMonth: number
    basicSalary: number
    allowances: { name: string; amount: number }[]
    grossSalary: number
    deductions: { name: string; amount: number }[]
    totalDeductions: number
    netPayable: number
    status: string
    paidDate?: string | null
    paymentMethod?: string | null
  }, profile: BusinessProfile | null): Promise<string> {
    const sym = escHtml(profile?.currencySymbol ?? '₹')
    const bizName = escHtml(profile?.businessName ?? 'Business')
    // Locale-aware formatting settings, fetched once per document and
    // shadowed as a synchronous local so the many unqualified `formatAmount(...)`
    // calls below (inside template literals, which can't `await`) all pick
    // this up automatically without individually being rewritten.
    const _fmtSettings = await getPrintFormatSettings()
    const formatAmount = (amount: number, symbol = sym): string => formatAmountLocaleAware(Math.abs(amount), symbol, _fmtSettings.numberFormat, _fmtSettings.decimals, _fmtSettings.symbolPosition)
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    const periodLabel = `${monthNames[payslip.periodMonth - 1] ?? payslip.periodMonth} ${payslip.periodYear}`

    const earningsRows = [
      `<tr><td>Basic Salary</td><td class="right">${formatAmount(payslip.basicSalary, sym)}</td></tr>`,
      ...payslip.allowances.map(a => `<tr><td>${escHtml(a.name)}</td><td class="right">${formatAmount(a.amount, sym)}</td></tr>`)
    ].join('')

    const deductionsRows = payslip.deductions.length > 0
      ? payslip.deductions.map(d => `<tr><td>${escHtml(d.name)}</td><td class="right">${formatAmount(d.amount, sym)}</td></tr>`).join('')
      : `<tr><td colspan="2" style="color:#94a3b8;font-style:italic">No deductions recorded</td></tr>`

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Payslip — ${escHtml(payslip.employeeName)} — ${periodLabel}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #1e293b; background: #fff; padding: 20mm; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; border-bottom: 2px solid #00AEEF; padding-bottom: 16px; }
  .biz-name { font-size: 22px; font-weight: 700; color: #0F172A; }
  .biz-meta { font-size: 11px; color: #64748b; margin-top: 4px; line-height: 1.5; }
  .doc-meta { text-align: right; }
  .doc-title { font-size: 16px; font-weight: 700; color: #00AEEF; }
  .doc-sub { font-size: 11px; color: #64748b; margin-top: 4px; }
  .status-badge { display: inline-block; padding: 2px 10px; border-radius: 20px; font-size: 10px; font-weight: 600; margin-top: 6px; }
  .status-PAID { background: #dcfce7; color: #166534; }
  .status-DRAFT { background: #fef3c7; color: #92400e; }
  .section { margin-bottom: 20px; }
  .section-title { font-size: 10px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; }
  .employee-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 14px; }
  .employee-name { font-weight: 600; font-size: 13px; }
  .columns { display: flex; gap: 16px; }
  .column { flex: 1; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #f1f5f9; text-align: left; padding: 8px 10px; font-size: 10px; font-weight: 600; text-transform: uppercase; color: #64748b; }
  td { padding: 6px 10px; border-bottom: 1px solid #f1f5f9; font-size: 11px; }
  .right { text-align: right; }
  .totals-row { display: flex; justify-content: space-between; padding: 8px 10px; font-size: 12px; font-weight: 600; border-top: 1px solid #e2e8f0; }
  .net-pay { display: flex; justify-content: space-between; padding: 12px 0; margin-top: 16px; font-size: 16px; font-weight: 700; color: #0F172A; border-top: 2px solid #00AEEF; }
  .footer { margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 12px; text-align: center; color: #94a3b8; font-size: 10px; }
  @media print { body { padding: 0; } }
</style>
</head>
<body style="position:relative;z-index:0;">
  ${watermarkHtml(profile)}
  <div class="header">
    <div>
      ${profile?.logoPath ? `<img src="${logoToFileUrl(profile.logoPath)}" alt="Logo" style="max-height:60px;max-width:140px;object-fit:contain;display:block;margin-bottom:8px;" />` : ''}
      <div class="biz-name">${bizName}</div>
      <div class="biz-meta">
        ${[profile?.address, profile?.city, profile?.state].filter(Boolean).map(escHtml).join(', ') || ''}
        ${profile?.phone ? '<br>' + escHtml(profile.phone) : ''}
      </div>
    </div>
    <div class="doc-meta">
      <div class="doc-title">Payslip</div>
      <div class="doc-sub">${periodLabel}</div>
      <div><span class="status-badge status-${payslip.status}">${payslip.status}</span></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Employee</div>
    <div class="employee-box">
      <div class="employee-name">${escHtml(payslip.employeeName)}</div>
      ${payslip.designation ? `<div style="color:#64748b;font-size:11px">${escHtml(payslip.designation)}</div>` : ''}
      ${payslip.employeeNumber ? `<div style="color:#94a3b8;font-size:10px">${escHtml(payslip.employeeNumber)}</div>` : ''}
    </div>
  </div>

  <div class="section columns">
    <div class="column">
      <div class="section-title">Earnings</div>
      <table><tbody>${earningsRows}</tbody></table>
      <div class="totals-row"><span>Gross Salary</span><span>${formatAmount(payslip.grossSalary, sym)}</span></div>
    </div>
    <div class="column">
      <div class="section-title">Deductions</div>
      <table><tbody>${deductionsRows}</tbody></table>
      <div class="totals-row"><span>Total Deductions</span><span>${formatAmount(payslip.totalDeductions, sym)}</span></div>
    </div>
  </div>

  <div class="net-pay"><span>Net Pay</span><span>${formatAmount(payslip.netPayable, sym)}</span></div>

  ${payslip.status === 'PAID' ? `<div class="section" style="font-size:11px;color:#64748b">Paid on ${payslip.paidDate ? formatDate(payslip.paidDate) : '—'}${payslip.paymentMethod ? ` via ${escHtml(payslip.paymentMethod)}` : ''}</div>` : ''}

  <div class="footer">
    <p style="font-style:italic;color:#64748b;font-size:9px">This is a computer-generated payslip. Statutory deduction amounts (if any) are entered by the business, not calculated by this software — verify with your accountant before relying on them for compliance purposes.</p>
    <p style="margin-top:4px">${await aszurexFooterHtml(10)}</p>
  </div>
</body>
</html>`
  },

  // 80mm thermal receipt (standard POS printer)
  async generateReceiptHtml(invoice: Invoice, profile: BusinessProfile | null, paperWidth: '80mm' | '58mm' = '80mm'): Promise<string> {
    const sym = escHtml(profile?.currencySymbol ?? '₹')
    const bizName = escHtml(profile?.businessName ?? 'Business')
    // Locale-aware formatting settings, fetched once per document and
    // shadowed as a synchronous local so the many unqualified `formatAmount(...)`
    // calls below (inside template literals, which can't `await`) all pick
    // this up automatically without individually being rewritten.
    const _fmtSettings = await getPrintFormatSettings()
    const formatAmount = (amount: number, symbol = sym): string => formatAmountLocaleAware(Math.abs(amount), symbol, _fmtSettings.numberFormat, _fmtSettings.decimals, _fmtSettings.symbolPosition)
    const width = paperWidth === '58mm' ? '56mm' : '72mm'
    // 58mm paper is narrower — tighten font
    const baseFontSize = paperWidth === '58mm' ? '9px' : '11px'
    const headerFontSize = paperWidth === '58mm' ? '12px' : '14px'

    let qrHtml = ''
    if (canShowUpiQr(profile) && invoice.balanceAmount > 0.01) {
      try {
        // Sized to comfortably fill most of the printable width (56mm/72mm
        // body) with margin to spare, while staying reliably scannable —
        // previously 80/100px, too small at typical print DPI for a phone
        // camera to lock on reliably from normal handling distance.
        const qrSize = paperWidth === '58mm' ? 130 : 160
        const qr = await generateUpiQr(profile!.upiId!, bizName, invoice.balanceAmount, `Invoice ${invoice.invoiceNumber}`)
        qrHtml = `<div style="text-align:center;margin:8px 0"><img src="${qr}" width="${qrSize}" height="${qrSize}"/><p style="font-size:8px;color:#666;margin-top:4px">Scan to Pay (UPI)</p></div>`
      } catch { /* optional */ }
    }

    const itemsHtml = invoice.items.map(item => `
      <tr>
        <td>${escHtml(item.productName)}${item.variantInfo ? ` <span style="font-size:9px;color:#666">(${escHtml(item.variantInfo)})</span>` : ''}${jewelleryDetailLine(item, sym) ? `<br><span style="font-size:9px;color:#666">${escHtml(jewelleryDetailLine(item, sym))}</span>` : ''}</td>
        <td style="text-align:right">${item.quantity}×${formatAmount(item.unitPrice, sym)}</td>
        <td style="text-align:right">${formatAmount(item.lineTotal, sym)}</td>
      </tr>`).join('')

    const isGstModelR = profile?.taxModel === 'GST'
    const isIGSTR = invoice.gstType === 'IGST'
    const rcptCgst = invoice.taxAmount / 2
    const rcptSgst = invoice.taxAmount / 2
    const rcptTaxHtml = invoice.taxAmount > 0
      ? isGstModelR
        ? isIGSTR
          ? `<tr><td colspan="2">IGST</td><td style="text-align:right">${formatAmount(invoice.taxAmount, sym)}</td></tr>`
          : `<tr><td colspan="2">CGST</td><td style="text-align:right">${formatAmount(rcptCgst, sym)}</td></tr>
           <tr><td colspan="2">SGST</td><td style="text-align:right">${formatAmount(rcptSgst, sym)}</td></tr>`
        : `<tr><td colspan="2">${escHtml(getTaxLabel(profile?.taxModel))}</td><td style="text-align:right">${formatAmount(invoice.taxAmount, sym)}</td></tr>`
      : ''

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: monospace; font-size: ${baseFontSize}; width: ${width}; padding: 3mm; color: #000; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .divider { border-top: 1px dashed #000; margin: 5px 0; }
  table { width: 100%; font-size: ${paperWidth === '58mm' ? '8px' : '10px'}; }
  td { padding: 2px 0; vertical-align: top; }
  .total-row td { font-weight: bold; border-top: 1px solid #000; padding-top: 4px; }
  @media print { body { width: ${width}; } }
</style>
</head>
<body style="position:relative;z-index:0;">
  ${watermarkHtml(profile)}
  ${profile?.logoPath ? `<div class="center" style="margin-bottom:4px"><img src="${logoToFileUrl(profile.logoPath)}" alt="" style="max-height:36px;max-width:72px;object-fit:contain;" /></div>` : ''}
  <div class="center bold" style="font-size:${headerFontSize}">${bizName}</div>
  ${profile?.address ? `<div class="center" style="font-size:8px">${[profile.address, profile.city].filter(Boolean).map(escHtml).join(', ')}</div>` : ''}
  ${profile?.phone ? `<div class="center" style="font-size:8px">${escHtml(profile.phone)}</div>` : ''}
  ${profile?.taxNumber ? `<div class="center" style="font-size:8px">GST: ${escHtml(profile.taxNumber)}</div>` : ''}
  <div class="divider"></div>
  <div class="bold">Invoice: ${escHtml(invoice.invoiceNumber)}</div>
  <div style="font-size:8px">Date: ${formatDate(invoice.invoiceDate)}</div>
  ${invoice.customer ? `<div style="font-size:8px">Customer: ${escHtml(invoice.customer.customerName)}</div>` : ''}
  <div class="divider"></div>
  <table>
    <tbody>${itemsHtml}</tbody>
    <tr>
      <td colspan="2">Subtotal</td>
      <td style="text-align:right">${formatAmount(invoice.subtotal, sym)}</td>
    </tr>
    ${invoice.discountAmount > 0 ? `<tr><td colspan="2">Discount</td><td style="text-align:right">-${formatAmount(invoice.discountAmount, sym)}</td></tr>` : ''}
    ${rcptTaxHtml}
    <tr class="total-row">
      <td colspan="2">TOTAL</td>
      <td style="text-align:right">${formatAmount(invoice.totalAmount, sym)}</td>
    </tr>
    ${invoice.balanceAmount > 0.01 ? `<tr><td colspan="2">Balance Due</td><td style="text-align:right">${formatAmount(invoice.balanceAmount, sym)}</td></tr>` : ''}
  </table>
  <div class="divider"></div>
  ${qrHtml}
  <div class="center" style="font-size:8px;margin-top:8px">Thank you for your business!</div>
  <div class="center" style="font-size:7px;margin-top:4px;color:#666;font-style:italic">Computer-generated document. Verify totals before legal use.</div>
  <div class="center" style="font-size:8px;margin-top:4px;color:#666">${await aszurexFooterHtml(8)}</div>
</body>
</html>`
  },

  async generateQuotationHtml(quotation: {
    quotationNumber: string
    validUntil?: string | Date | null
    customerName?: string | null
    customer?: { customerName: string; phone?: string | null } | null
    items: Array<{ productName: string; quantity: number; unitPrice: number; discount: number; taxRate: number; lineTotal: number }>
    subtotal: number; discountAmount: number; taxAmount: number; totalAmount: number
    notes?: string | null
  }, profile: BusinessProfile | null): Promise<string> {
    const sym = escHtml(profile?.currencySymbol ?? '₹')
    const bizName = escHtml(profile?.businessName ?? 'Business')
    // Locale-aware formatting settings, fetched once per document and
    // shadowed as a synchronous local so the many unqualified `formatAmount(...)`
    // calls below (inside template literals, which can't `await`) all pick
    // this up automatically without individually being rewritten.
    const _fmtSettings = await getPrintFormatSettings()
    const formatAmount = (amount: number, symbol = sym): string => formatAmountLocaleAware(Math.abs(amount), symbol, _fmtSettings.numberFormat, _fmtSettings.decimals, _fmtSettings.symbolPosition)
    const customerDisplay = escHtml(quotation.customer?.customerName ?? quotation.customerName ?? 'Walk-in Customer')
    const validUntilStr = quotation.validUntil ? formatDate(quotation.validUntil as string | Date) : 'No expiry'

    const itemsHtml = quotation.items.map(item => `
      <tr>
        <td>${escHtml(item.productName)}</td>
        <td class="right">${item.quantity}</td>
        <td class="right">${formatAmount(item.unitPrice, sym)}</td>
        <td class="right">${item.discount > 0 ? item.discount + '%' : '—'}</td>
        <td class="right">${item.taxRate > 0 ? item.taxRate + '%' : '—'}</td>
        <td class="right bold">${formatAmount(item.lineTotal, sym)}</td>
      </tr>`).join('')

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Quotation ${quotation.quotationNumber}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #1e293b; background: #fff; padding: 20mm; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; border-bottom: 2px solid #f59e0b; padding-bottom: 16px; }
  .biz-name { font-size: 22px; font-weight: 700; color: #0F172A; }
  .biz-meta { font-size: 11px; color: #64748b; margin-top: 4px; line-height: 1.5; }
  .qt-meta { text-align: right; }
  .qt-label { font-size: 20px; font-weight: 700; color: #f59e0b; letter-spacing: 0.05em; }
  .qt-number { font-size: 16px; font-weight: 700; color: #92400e; margin-top: 2px; }
  .qt-date { font-size: 11px; color: #64748b; margin-top: 4px; }
  .section { margin-bottom: 20px; }
  .section-title { font-size: 10px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; }
  .customer-box { background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 10px 14px; }
  .customer-name { font-weight: 600; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th { background: #fef3c7; text-align: left; padding: 8px 10px; font-size: 10px; font-weight: 600; text-transform: uppercase; color: #92400e; }
  td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; font-size: 11px; }
  .right { text-align: right; }
  .bold { font-weight: 600; }
  .totals { display: flex; justify-content: flex-end; margin-bottom: 20px; }
  .totals-table { min-width: 260px; }
  .totals-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px; color: #475569; }
  .totals-total { display: flex; justify-content: space-between; padding: 8px 0; font-size: 15px; font-weight: 700; color: #0F172A; border-top: 2px solid #f59e0b; margin-top: 4px; }
  .validity-badge { display: inline-block; background: #fef3c7; color: #92400e; border: 1px solid #fde68a; border-radius: 6px; padding: 4px 12px; font-size: 11px; font-weight: 600; margin-top: 8px; }
  .footer { margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 12px; text-align: center; color: #94a3b8; font-size: 10px; }
  .notice { background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 8px 12px; font-size: 11px; color: #92400e; margin-bottom: 16px; }
  @media print { body { padding: 0; } }
</style>
</head>
<body style="position:relative;z-index:0;">
  ${watermarkHtml(profile)}
  <div class="header">
    <div>
      ${profile?.logoPath ? `<img src="${logoToFileUrl(profile.logoPath)}" alt="Logo" style="max-height:60px;max-width:140px;object-fit:contain;display:block;margin-bottom:8px;" />` : ''}
      <div class="biz-name">${bizName}</div>
      <div class="biz-meta">
        ${[profile?.address, profile?.city, profile?.state].filter(Boolean).map(escHtml).join(', ')}<br/>
        ${profile?.phone ? 'Ph: ' + escHtml(profile.phone) : ''}
        ${profile?.email ? ' | ' + escHtml(profile.email) : ''}
        ${profile?.taxNumber ? '<br/>GSTIN: ' + escHtml(profile.taxNumber) : ''}
      </div>
    </div>
    <div class="qt-meta">
      <div class="qt-label">QUOTATION</div>
      <div class="qt-number">${escHtml(quotation.quotationNumber)}</div>
      <div class="qt-date">Date: ${formatDate(new Date())}</div>
      <div class="validity-badge">Valid until: ${validUntilStr}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Quotation For</div>
    <div class="customer-box">
      <div class="customer-name">${customerDisplay}</div>
    </div>
  </div>

  <div class="notice">This is a quotation, not a tax invoice. Prices are subject to change until an invoice is issued.</div>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th class="right">Qty</th>
        <th class="right">Unit Price</th>
        <th class="right">Disc%</th>
        <th class="right">Tax%</th>
        <th class="right">Amount</th>
      </tr>
    </thead>
    <tbody>${itemsHtml}</tbody>
  </table>

  <div class="totals">
    <div class="totals-table">
      <div class="totals-row"><span>Subtotal</span><span>${formatAmount(quotation.subtotal, sym)}</span></div>
      ${quotation.discountAmount > 0 ? `<div class="totals-row"><span>Discount</span><span>−${formatAmount(quotation.discountAmount, sym)}</span></div>` : ''}
      ${quotation.taxAmount > 0 ? `<div class="totals-row"><span>Tax</span><span>${formatAmount(quotation.taxAmount, sym)}</span></div>` : ''}
      <div class="totals-total"><span>Total Amount</span><span>${formatAmount(quotation.totalAmount, sym)}</span></div>
    </div>
  </div>

  ${quotation.notes ? `<div class="notice"><strong>Notes:</strong> ${escHtml(quotation.notes)}</div>` : ''}

  <div class="footer">
    Computer-generated quotation. Valid until ${validUntilStr}. Subject to applicable taxes at the time of invoice.<br/>
    ${await aszurexFooterHtml(10)}
  </div>
</body>
</html>`
  },

  // Fresh-audit fix (2026-07-12): thermal receipt-width variant — Quotation
  // previously only had the A4 template above, unlike Invoice which already
  // had both. Mirrors generateReceiptHtml's layout/sizing conventions
  // exactly (same monospace/narrow-width approach) for a shop whose only
  // printer is a thermal one.
  async generateQuotationReceiptHtml(quotation: {
    quotationNumber: string
    validUntil?: string | Date | null
    customerName?: string | null
    customer?: { customerName: string; phone?: string | null } | null
    items: Array<{ productName: string; quantity: number; unitPrice: number; discount: number; taxRate: number; lineTotal: number }>
    subtotal: number; discountAmount: number; taxAmount: number; totalAmount: number
    notes?: string | null
  }, profile: BusinessProfile | null, paperWidth: '80mm' | '58mm' = '80mm'): Promise<string> {
    const sym = escHtml(profile?.currencySymbol ?? '₹')
    const bizName = escHtml(profile?.businessName ?? 'Business')
    // Locale-aware formatting settings, fetched once per document and
    // shadowed as a synchronous local so the many unqualified `formatAmount(...)`
    // calls below (inside template literals, which can't `await`) all pick
    // this up automatically without individually being rewritten.
    const _fmtSettings = await getPrintFormatSettings()
    const formatAmount = (amount: number, symbol = sym): string => formatAmountLocaleAware(Math.abs(amount), symbol, _fmtSettings.numberFormat, _fmtSettings.decimals, _fmtSettings.symbolPosition)
    const customerDisplay = escHtml(quotation.customer?.customerName ?? quotation.customerName ?? 'Walk-in Customer')
    const validUntilStr = quotation.validUntil ? formatDate(quotation.validUntil as string | Date) : 'No expiry'
    const width = paperWidth === '58mm' ? '56mm' : '72mm'
    const baseFontSize = paperWidth === '58mm' ? '9px' : '11px'
    const headerFontSize = paperWidth === '58mm' ? '12px' : '14px'

    const itemsHtml = quotation.items.map(item => `
      <tr>
        <td>${escHtml(item.productName)}</td>
        <td style="text-align:right">${item.quantity}×${formatAmount(item.unitPrice, sym)}</td>
        <td style="text-align:right">${formatAmount(item.lineTotal, sym)}</td>
      </tr>`).join('')

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: monospace; font-size: ${baseFontSize}; width: ${width}; padding: 3mm; color: #000; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .divider { border-top: 1px dashed #000; margin: 5px 0; }
  table { width: 100%; font-size: ${paperWidth === '58mm' ? '8px' : '10px'}; }
  td { padding: 2px 0; vertical-align: top; }
  .total-row td { font-weight: bold; border-top: 1px solid #000; padding-top: 4px; }
  @media print { body { width: ${width}; } }
</style>
</head>
<body style="position:relative;z-index:0;">
  ${watermarkHtml(profile)}
  ${profile?.logoPath ? `<div class="center" style="margin-bottom:4px"><img src="${logoToFileUrl(profile.logoPath)}" alt="" style="max-height:36px;max-width:72px;object-fit:contain;" /></div>` : ''}
  <div class="center bold" style="font-size:${headerFontSize}">${bizName}</div>
  ${profile?.address ? `<div class="center" style="font-size:8px">${[profile.address, profile.city].filter(Boolean).map(escHtml).join(', ')}</div>` : ''}
  ${profile?.phone ? `<div class="center" style="font-size:8px">${escHtml(profile.phone)}</div>` : ''}
  <div class="divider"></div>
  <div class="bold">QUOTATION: ${escHtml(quotation.quotationNumber)}</div>
  <div style="font-size:8px">Date: ${formatDate(new Date())}</div>
  <div style="font-size:8px">Valid until: ${validUntilStr}</div>
  <div style="font-size:8px">Customer: ${customerDisplay}</div>
  <div class="divider"></div>
  <table>
    <tbody>${itemsHtml}</tbody>
    <tr>
      <td colspan="2">Subtotal</td>
      <td style="text-align:right">${formatAmount(quotation.subtotal, sym)}</td>
    </tr>
    ${quotation.discountAmount > 0 ? `<tr><td colspan="2">Discount</td><td style="text-align:right">-${formatAmount(quotation.discountAmount, sym)}</td></tr>` : ''}
    ${quotation.taxAmount > 0 ? `<tr><td colspan="2">Tax</td><td style="text-align:right">${formatAmount(quotation.taxAmount, sym)}</td></tr>` : ''}
    <tr class="total-row">
      <td colspan="2">TOTAL</td>
      <td style="text-align:right">${formatAmount(quotation.totalAmount, sym)}</td>
    </tr>
  </table>
  <div class="divider"></div>
  ${quotation.notes ? `<div style="font-size:8px">Notes: ${escHtml(quotation.notes)}</div><div class="divider"></div>` : ''}
  <div class="center" style="font-size:7px;margin-top:4px;color:#666;font-style:italic">Not a tax invoice. Prices subject to change.</div>
  <div class="center" style="font-size:8px;margin-top:4px;color:#666">${await aszurexFooterHtml(8)}</div>
</body>
</html>`
  },

  // Phase 45: Credit Note / Debit Note — both models are flat, single-amount
  // records (no line items, no tax breakdown — confirmed at Phase 45's own
  // audit, founder-confirmed out of scope), so this is a summary document,
  // not an itemized one like Invoice/Quotation.
  async generateCreditNoteHtml(cn: {
    creditNoteNumber: string
    createdAt: string | Date
    reason: string
    amount: number
    notes?: string | null
    customer?: { customerName: string; phone?: string | null } | null
    invoice?: { invoiceNumber: string; invoiceDate: string | Date } | null
  }, profile: BusinessProfile | null): Promise<string> {
    const sym = escHtml(profile?.currencySymbol ?? '₹')
    const bizName = escHtml(profile?.businessName ?? 'Business')
    // Locale-aware formatting settings, fetched once per document and
    // shadowed as a synchronous local so the many unqualified `formatAmount(...)`
    // calls below (inside template literals, which can't `await`) all pick
    // this up automatically without individually being rewritten.
    const _fmtSettings = await getPrintFormatSettings()
    const formatAmount = (amount: number, symbol = sym): string => formatAmountLocaleAware(Math.abs(amount), symbol, _fmtSettings.numberFormat, _fmtSettings.decimals, _fmtSettings.symbolPosition)
    const customerDisplay = escHtml(cn.customer?.customerName ?? 'Walk-in Customer')

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Credit Note ${cn.creditNoteNumber}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #1e293b; background: #fff; padding: 20mm; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; border-bottom: 2px solid #22C55E; padding-bottom: 16px; }
  .biz-name { font-size: 22px; font-weight: 700; color: #0F172A; }
  .biz-meta { font-size: 11px; color: #64748b; margin-top: 4px; line-height: 1.5; }
  .doc-meta { text-align: right; }
  .doc-label { font-size: 20px; font-weight: 700; color: #16a34a; letter-spacing: 0.05em; }
  .doc-number { font-size: 16px; font-weight: 700; color: #15803d; margin-top: 2px; }
  .doc-date { font-size: 11px; color: #64748b; margin-top: 4px; }
  .section { margin-bottom: 20px; }
  .section-title { font-size: 10px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; }
  .customer-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 10px 14px; }
  .customer-name { font-weight: 600; font-size: 13px; }
  .summary-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 14px 16px; margin-bottom: 20px; }
  .summary-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px; color: #475569; }
  .summary-total { display: flex; justify-content: space-between; padding: 8px 0; font-size: 15px; font-weight: 700; color: #0F172A; border-top: 2px solid #22C55E; margin-top: 8px; }
  .ref-line { font-size: 11px; color: #64748b; margin-top: 6px; }
  .footer { margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 12px; text-align: center; color: #94a3b8; font-size: 10px; }
  .notice { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 8px 12px; font-size: 11px; color: #15803d; margin-bottom: 16px; }
  @media print { body { padding: 0; } }
</style>
</head>
<body style="position:relative;z-index:0;">
  ${watermarkHtml(profile)}
  <div class="header">
    <div>
      ${profile?.logoPath ? `<img src="${logoToFileUrl(profile.logoPath)}" alt="Logo" style="max-height:60px;max-width:140px;object-fit:contain;display:block;margin-bottom:8px;" />` : ''}
      <div class="biz-name">${bizName}</div>
      <div class="biz-meta">
        ${[profile?.address, profile?.city, profile?.state].filter(Boolean).map(escHtml).join(', ')}<br/>
        ${profile?.phone ? 'Ph: ' + escHtml(profile.phone) : ''}
        ${profile?.email ? ' | ' + escHtml(profile.email) : ''}
        ${profile?.taxNumber ? '<br/>GSTIN: ' + escHtml(profile.taxNumber) : ''}
      </div>
    </div>
    <div class="doc-meta">
      <div class="doc-label">CREDIT NOTE</div>
      <div class="doc-number">${escHtml(cn.creditNoteNumber)}</div>
      <div class="doc-date">Date: ${formatDate(cn.createdAt)}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Issued To</div>
    <div class="customer-box">
      <div class="customer-name">${customerDisplay}</div>
      ${cn.invoice ? `<div class="ref-line">Against Invoice ${escHtml(cn.invoice.invoiceNumber)} dated ${formatDate(cn.invoice.invoiceDate)}</div>` : ''}
    </div>
  </div>

  <div class="notice">This credit note reduces the amount owed by the customer. It is not a refund of cash unless separately settled.</div>

  <div class="summary-box">
    <div class="summary-row"><span>Reason</span><span>${escHtml(cn.reason)}</span></div>
    <div class="summary-total"><span>Credit Amount</span><span>${formatAmount(cn.amount, sym)}</span></div>
  </div>

  ${cn.notes ? `<div class="notice"><strong>Notes:</strong> ${escHtml(cn.notes)}</div>` : ''}

  <div class="footer">
    Computer-generated credit note.<br/>
    ${await aszurexFooterHtml(10)}
  </div>
</body>
</html>`
  },

  // Fresh-audit fix (2026-07-12): thermal receipt-width variant. Credit Note
  // is a flat single-amount summary document (no line items — confirmed at
  // Phase 45's own audit), so this is even more compact than the quotation
  // receipt above.
  async generateCreditNoteReceiptHtml(cn: {
    creditNoteNumber: string
    createdAt: string | Date
    reason: string
    amount: number
    notes?: string | null
    customer?: { customerName: string; phone?: string | null } | null
    invoice?: { invoiceNumber: string; invoiceDate: string | Date } | null
  }, profile: BusinessProfile | null, paperWidth: '80mm' | '58mm' = '80mm'): Promise<string> {
    const sym = escHtml(profile?.currencySymbol ?? '₹')
    const bizName = escHtml(profile?.businessName ?? 'Business')
    // Locale-aware formatting settings, fetched once per document and
    // shadowed as a synchronous local so the many unqualified `formatAmount(...)`
    // calls below (inside template literals, which can't `await`) all pick
    // this up automatically without individually being rewritten.
    const _fmtSettings = await getPrintFormatSettings()
    const formatAmount = (amount: number, symbol = sym): string => formatAmountLocaleAware(Math.abs(amount), symbol, _fmtSettings.numberFormat, _fmtSettings.decimals, _fmtSettings.symbolPosition)
    const customerDisplay = escHtml(cn.customer?.customerName ?? 'Walk-in Customer')
    const width = paperWidth === '58mm' ? '56mm' : '72mm'
    const baseFontSize = paperWidth === '58mm' ? '9px' : '11px'
    const headerFontSize = paperWidth === '58mm' ? '12px' : '14px'

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: monospace; font-size: ${baseFontSize}; width: ${width}; padding: 3mm; color: #000; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .divider { border-top: 1px dashed #000; margin: 5px 0; }
  .row { display: flex; justify-content: space-between; padding: 2px 0; }
  .total-row { font-weight: bold; border-top: 1px solid #000; padding-top: 4px; margin-top: 2px; }
  @media print { body { width: ${width}; } }
</style>
</head>
<body style="position:relative;z-index:0;">
  ${watermarkHtml(profile)}
  ${profile?.logoPath ? `<div class="center" style="margin-bottom:4px"><img src="${logoToFileUrl(profile.logoPath)}" alt="" style="max-height:36px;max-width:72px;object-fit:contain;" /></div>` : ''}
  <div class="center bold" style="font-size:${headerFontSize}">${bizName}</div>
  <div class="divider"></div>
  <div class="bold">CREDIT NOTE: ${escHtml(cn.creditNoteNumber)}</div>
  <div style="font-size:8px">Date: ${formatDate(cn.createdAt)}</div>
  <div style="font-size:8px">Issued To: ${customerDisplay}</div>
  ${cn.invoice ? `<div style="font-size:8px">Against Invoice ${escHtml(cn.invoice.invoiceNumber)} (${formatDate(cn.invoice.invoiceDate)})</div>` : ''}
  <div class="divider"></div>
  <div class="row"><span>Reason</span><span>${escHtml(cn.reason)}</span></div>
  <div class="row total-row"><span>Credit Amount</span><span>${formatAmount(cn.amount, sym)}</span></div>
  <div class="divider"></div>
  ${cn.notes ? `<div style="font-size:8px">Notes: ${escHtml(cn.notes)}</div><div class="divider"></div>` : ''}
  <div class="center" style="font-size:7px;margin-top:4px;color:#666;font-style:italic">Reduces amount owed. Not a cash refund unless settled separately.</div>
  <div class="center" style="font-size:8px;margin-top:4px;color:#666">${await aszurexFooterHtml(8)}</div>
</body>
</html>`
  },

  async generateDebitNoteHtml(dn: {
    debitNoteNumber: string
    createdAt: string | Date
    reason: string
    amount: number
    notes?: string | null
    supplier?: { supplierName: string; phone?: string | null } | null
    purchaseOrder?: { poNumber: string; orderDate: string | Date } | null
  }, profile: BusinessProfile | null): Promise<string> {
    const sym = escHtml(profile?.currencySymbol ?? '₹')
    const bizName = escHtml(profile?.businessName ?? 'Business')
    // Locale-aware formatting settings, fetched once per document and
    // shadowed as a synchronous local so the many unqualified `formatAmount(...)`
    // calls below (inside template literals, which can't `await`) all pick
    // this up automatically without individually being rewritten.
    const _fmtSettings = await getPrintFormatSettings()
    const formatAmount = (amount: number, symbol = sym): string => formatAmountLocaleAware(Math.abs(amount), symbol, _fmtSettings.numberFormat, _fmtSettings.decimals, _fmtSettings.symbolPosition)
    const supplierDisplay = escHtml(dn.supplier?.supplierName ?? 'Supplier')

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Debit Note ${dn.debitNoteNumber}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #1e293b; background: #fff; padding: 20mm; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; border-bottom: 2px solid #EF4444; padding-bottom: 16px; }
  .biz-name { font-size: 22px; font-weight: 700; color: #0F172A; }
  .biz-meta { font-size: 11px; color: #64748b; margin-top: 4px; line-height: 1.5; }
  .doc-meta { text-align: right; }
  .doc-label { font-size: 20px; font-weight: 700; color: #dc2626; letter-spacing: 0.05em; }
  .doc-number { font-size: 16px; font-weight: 700; color: #b91c1c; margin-top: 2px; }
  .doc-date { font-size: 11px; color: #64748b; margin-top: 4px; }
  .section { margin-bottom: 20px; }
  .section-title { font-size: 10px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; }
  .customer-box { background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 10px 14px; }
  .customer-name { font-weight: 600; font-size: 13px; }
  .summary-box { background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 14px 16px; margin-bottom: 20px; }
  .summary-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px; color: #475569; }
  .summary-total { display: flex; justify-content: space-between; padding: 8px 0; font-size: 15px; font-weight: 700; color: #0F172A; border-top: 2px solid #EF4444; margin-top: 8px; }
  .ref-line { font-size: 11px; color: #64748b; margin-top: 6px; }
  .footer { margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 12px; text-align: center; color: #94a3b8; font-size: 10px; }
  .notice { background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 8px 12px; font-size: 11px; color: #b91c1c; margin-bottom: 16px; }
  @media print { body { padding: 0; } }
</style>
</head>
<body style="position:relative;z-index:0;">
  ${watermarkHtml(profile)}
  <div class="header">
    <div>
      ${profile?.logoPath ? `<img src="${logoToFileUrl(profile.logoPath)}" alt="Logo" style="max-height:60px;max-width:140px;object-fit:contain;display:block;margin-bottom:8px;" />` : ''}
      <div class="biz-name">${bizName}</div>
      <div class="biz-meta">
        ${[profile?.address, profile?.city, profile?.state].filter(Boolean).map(escHtml).join(', ')}<br/>
        ${profile?.phone ? 'Ph: ' + escHtml(profile.phone) : ''}
        ${profile?.email ? ' | ' + escHtml(profile.email) : ''}
        ${profile?.taxNumber ? '<br/>GSTIN: ' + escHtml(profile.taxNumber) : ''}
      </div>
    </div>
    <div class="doc-meta">
      <div class="doc-label">DEBIT NOTE</div>
      <div class="doc-number">${escHtml(dn.debitNoteNumber)}</div>
      <div class="doc-date">Date: ${formatDate(dn.createdAt)}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Issued To</div>
    <div class="customer-box">
      <div class="customer-name">${supplierDisplay}</div>
      ${dn.purchaseOrder ? `<div class="ref-line">Against Purchase Order ${escHtml(dn.purchaseOrder.poNumber)} dated ${formatDate(dn.purchaseOrder.orderDate)}</div>` : ''}
    </div>
  </div>

  <div class="notice">This debit note reduces the amount owed to the supplier. It is not a cash recovery unless separately settled.</div>

  <div class="summary-box">
    <div class="summary-row"><span>Reason</span><span>${escHtml(dn.reason)}</span></div>
    <div class="summary-total"><span>Debit Amount</span><span>${formatAmount(dn.amount, sym)}</span></div>
  </div>

  ${dn.notes ? `<div class="notice"><strong>Notes:</strong> ${escHtml(dn.notes)}</div>` : ''}

  <div class="footer">
    Computer-generated debit note.<br/>
    ${await aszurexFooterHtml(10)}
  </div>
</body>
</html>`
  },

  // Fresh-audit fix (2026-07-12): thermal receipt-width variant, same
  // reasoning as generateCreditNoteReceiptHtml above.
  async generateDebitNoteReceiptHtml(dn: {
    debitNoteNumber: string
    createdAt: string | Date
    reason: string
    amount: number
    notes?: string | null
    supplier?: { supplierName: string; phone?: string | null } | null
    purchaseOrder?: { poNumber: string; orderDate: string | Date } | null
  }, profile: BusinessProfile | null, paperWidth: '80mm' | '58mm' = '80mm'): Promise<string> {
    const sym = escHtml(profile?.currencySymbol ?? '₹')
    const bizName = escHtml(profile?.businessName ?? 'Business')
    // Locale-aware formatting settings, fetched once per document and
    // shadowed as a synchronous local so the many unqualified `formatAmount(...)`
    // calls below (inside template literals, which can't `await`) all pick
    // this up automatically without individually being rewritten.
    const _fmtSettings = await getPrintFormatSettings()
    const formatAmount = (amount: number, symbol = sym): string => formatAmountLocaleAware(Math.abs(amount), symbol, _fmtSettings.numberFormat, _fmtSettings.decimals, _fmtSettings.symbolPosition)
    const supplierDisplay = escHtml(dn.supplier?.supplierName ?? 'Supplier')
    const width = paperWidth === '58mm' ? '56mm' : '72mm'
    const baseFontSize = paperWidth === '58mm' ? '9px' : '11px'
    const headerFontSize = paperWidth === '58mm' ? '12px' : '14px'

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: monospace; font-size: ${baseFontSize}; width: ${width}; padding: 3mm; color: #000; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .divider { border-top: 1px dashed #000; margin: 5px 0; }
  .row { display: flex; justify-content: space-between; padding: 2px 0; }
  .total-row { font-weight: bold; border-top: 1px solid #000; padding-top: 4px; margin-top: 2px; }
  @media print { body { width: ${width}; } }
</style>
</head>
<body style="position:relative;z-index:0;">
  ${watermarkHtml(profile)}
  ${profile?.logoPath ? `<div class="center" style="margin-bottom:4px"><img src="${logoToFileUrl(profile.logoPath)}" alt="" style="max-height:36px;max-width:72px;object-fit:contain;" /></div>` : ''}
  <div class="center bold" style="font-size:${headerFontSize}">${bizName}</div>
  <div class="divider"></div>
  <div class="bold">DEBIT NOTE: ${escHtml(dn.debitNoteNumber)}</div>
  <div style="font-size:8px">Date: ${formatDate(dn.createdAt)}</div>
  <div style="font-size:8px">Issued To: ${supplierDisplay}</div>
  ${dn.purchaseOrder ? `<div style="font-size:8px">Against PO ${escHtml(dn.purchaseOrder.poNumber)} (${formatDate(dn.purchaseOrder.orderDate)})</div>` : ''}
  <div class="divider"></div>
  <div class="row"><span>Reason</span><span>${escHtml(dn.reason)}</span></div>
  <div class="row total-row"><span>Debit Amount</span><span>${formatAmount(dn.amount, sym)}</span></div>
  <div class="divider"></div>
  ${dn.notes ? `<div style="font-size:8px">Notes: ${escHtml(dn.notes)}</div><div class="divider"></div>` : ''}
  <div class="center" style="font-size:7px;margin-top:4px;color:#666;font-style:italic">Reduces amount owed to supplier. Not a cash recovery unless settled separately.</div>
  <div class="center" style="font-size:8px;margin-top:4px;color:#666">${await aszurexFooterHtml(8)}</div>
</body>
</html>`
  },

  // G9.1: KOT (Kitchen Order Ticket) print template
  async generateKOTHtml(params: {
    kotId: string
    tableNumber?: string | null
    tableName?: string | null
    invoiceNumber: string
    items: Array<{ productName: string; quantity: number; remarks?: string | null }>
    createdAt: string | Date
    status: string
    businessName: string
  }): Promise<string> {
    const dt = new Date(params.createdAt)
    const timeStr = dt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: true })
    const dateStr = dt.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
    const tableLabel = params.tableName
      ? `${params.tableNumber} — ${params.tableName}`
      : (params.tableNumber ?? 'Takeaway')

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  body { font-family: 'Courier New', monospace; width: 72mm; margin: 0 auto; padding: 8px; font-size: 11px; }
  .center { text-align: center; }
  h2 { font-size: 16px; margin: 0; text-align: center; letter-spacing: 2px; }
  .divider { border-top: 1px dashed #000; margin: 6px 0; }
  .bold { font-weight: bold; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 2px 0; vertical-align: top; }
  .qty { width: 30px; font-weight: bold; font-size: 13px; }
  .item { font-size: 12px; }
  .remarks { font-size: 9px; color: #555; padding-left: 4px; }
  .meta { font-size: 9px; color: #333; }
</style>
</head>
<body>
  <h2>KOT</h2>
  <div class="center meta">${escHtml(params.businessName)}</div>
  <div class="divider"></div>
  <div><span class="bold">Table:</span> ${escHtml(tableLabel)}</div>
  <div><span class="bold">Order:</span> ${escHtml(params.invoiceNumber)}</div>
  <div><span class="bold">Time:</span> ${timeStr} — ${dateStr}</div>
  <div class="divider"></div>
  <table>
    ${params.items.map(item => `
    <tr>
      <td class="qty">${item.quantity}×</td>
      <td class="item">${escHtml(item.productName)}${item.remarks ? `<div class="remarks">Note: ${escHtml(item.remarks)}</div>` : ''}</td>
    </tr>`).join('')}
  </table>
  <div class="divider"></div>
  <div class="center meta" style="font-size:8px">KOT #${params.kotId.slice(-6).toUpperCase()} | Sarang Business OS Lite | ${await aszurexBrandSuffixHtml(8)}</div>
</body>
</html>`
  },

  // Phase 38: barcode/price label printing. Renders through the same
  // HTML + webContents.print()/printToPDF() mechanism as every other document
  // in this file (see PHASE_38_TECHNICAL_SPEC.md Section 4.1 for why: no
  // actively-maintained package cleanly speaks raw TSPL/ZPL from Electron on
  // Windows, but commercial label printers ship a Windows driver that accepts
  // a normal print job just like this — so labels don't need a different
  // mechanism, only a different page/label size).
  //
  // outputMode 'THERMAL_LABEL' renders one label per physical page at a small
  // fixed size (owner's configured label dimensions). 'A4_SHEET' renders a
  // repeating grid sized to fit a standard sheet, for shops without a
  // dedicated label printer.
  async generateLabelHtml(params: {
    labels: Array<{ productName: string; barcode: string; priceText: string | null; copies: number }>
    outputMode: 'THERMAL_LABEL' | 'A4_SHEET'
    labelSizeMm: { width: number; height: number } // e.g. {40,30} thermal; ignored (grid-derived) for A4_SHEET
    fields: { showPrice: boolean; showBarcode: boolean; showName: boolean }
    businessName: string
  }): Promise<string> {
    const flat: Array<{ productName: string; barcode: string; priceText: string | null }> = []
    for (const l of params.labels) {
      for (let i = 0; i < l.copies; i++) flat.push({ productName: l.productName, barcode: l.barcode, priceText: l.priceText })
    }

    // Phase 52 audit: previously plain "Sarang · Aszurex" text, no website, no
    // mark — the one print surface that fell short of every other template's
    // branding. Reuses the same small partnership-mark image already proven
    // to render legibly at tiny sizes elsewhere (KOT uses it at 8px) rather
    // than the full gradient "S" logo, which would not resolve at real
    // thermal-print resolution on a 40x30mm label. Computed once, not per
    // label, since it's identical on every copy in the batch.
    const brandSuffix = await aszurexBrandSuffixHtml(5)

    const oneLabel = (l: { productName: string; barcode: string; priceText: string | null }, idx: number): string => `
      <div class="label">
        ${params.fields.showName ? `<div class="label-name">${escHtml(l.productName)}</div>` : ''}
        ${params.fields.showPrice && l.priceText ? `<div class="label-price">${escHtml(l.priceText)}</div>` : ''}
        ${params.fields.showBarcode ? `<svg class="barcode" id="bc-${idx}" data-code="${escHtml(l.barcode)}"></svg>` : ''}
        <div class="label-brand">Sarang · ${brandSuffix}</div>
      </div>`

    const isThermal = params.outputMode === 'THERMAL_LABEL'
    const pageStyle = isThermal
      ? `@page { size: ${params.labelSizeMm.width}mm ${params.labelSizeMm.height}mm; margin: 0; }
         body { width: ${params.labelSizeMm.width}mm; }
         .label-grid { display: block; }
         .label { width: ${params.labelSizeMm.width}mm; height: ${params.labelSizeMm.height}mm; page-break-after: always; }`
      : `@page { size: A4; margin: 10mm; }
         .label-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4mm; }
         .label { border: 1px dashed #ccc; padding: 2mm; height: 28mm; }`

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, sans-serif; color: #000; }
  ${pageStyle}
  .label { display: flex; flex-direction: column; align-items: center; justify-content: center; overflow: hidden; text-align: center; }
  .label-name { font-size: 8px; font-weight: bold; line-height: 1.1; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .label-price { font-size: 11px; font-weight: bold; margin-top: 1mm; }
  .barcode { width: 90%; max-height: 10mm; margin-top: 1mm; }
  .label-brand { font-size: 6px; color: #666; margin-top: 0.5mm; line-height: 1.3; }
  .label-brand img { vertical-align: middle; }
</style>
</head>
<body>
  <div class="label-grid">
    ${flat.map((l, idx) => oneLabel(l, idx)).join('')}
  </div>
  <script>${getJsBarcodeScript()}</script>
  <script>
    // A stored Product.barcode is not always EAN-13 — a manually-entered
    // manufacturer code (Code39, UPC-A, an arbitrary alphanumeric SKU used as
    // a barcode) is accepted as-is by validation (product.validation.ts) and
    // was never checksum-restricted to EAN-13. Forcing EAN13 format here would
    // make JsBarcode throw on any non-13-digit code, and the catch below would
    // silently print a blank barcode with no indication anything went wrong.
    // CODE128 encodes arbitrary text/digits, so it's used as the fallback for
    // anything that isn't a valid 13-digit numeric code.
    document.querySelectorAll('.barcode').forEach(function (el) {
      var code = el.getAttribute('data-code') || '';
      var format = /^\\d{13}$/.test(code) ? 'EAN13' : 'CODE128';
      try {
        JsBarcode(el, code, { format: format, width: 1.4, height: 28, fontSize: 8, margin: 0, displayValue: true });
      } catch (e) {
        // Truly malformed (empty, unencodable) — leave blank rather than crash the print job.
      }
    });
  </script>
</body>
</html>`
  }
}
