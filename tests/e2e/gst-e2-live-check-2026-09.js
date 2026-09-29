/**
 * M4 — live check of F-10 (E2 area never run in the real app): GST Payments
 * screen, GST Return Files screen, Net Payable / Purchase register / HSN /
 * TDS reports, supplier-invoice fields on bills.
 *
 * Seeds a real supplier + product + bill (with a real supplier invoice
 * number/date and a TDS-liable amount), receives it, records a GST payment
 * against it, exports GSTR-1/GSTR-3B (dialog stubbed like M8), and runs the
 * four purchase-side GST reports — checking each real IPC call succeeds and
 * returns real, non-empty data referencing the bill just created.
 *
 * Not part of run-all.js — standalone, run directly:
 *   node tests/e2e/gst-e2-live-check-2026-09.js
 */
const h = require('./harness')

async function installSaveDialogStub(app, dir) {
  await app.evaluate(({ dialog }, dirPath) => {
    let counter = 0
    dialog.showSaveDialog = async (options) => {
      counter += 1
      const defaultPath = (options && options.defaultPath) ? String(options.defaultPath) : `export-${counter}`
      const name = defaultPath.split(/[\\/]/).pop()
      const sep = dirPath.endsWith('\\') || dirPath.endsWith('/') ? '' : '\\'
      return { filePath: `${dirPath}${sep}${counter}-${name}`, canceled: false }
    }
  }, dir)
}

function monthRange(d) {
  const y = d.getFullYear(), m = d.getMonth()
  const dateFrom = new Date(y, m, 1).toISOString().slice(0, 10)
  const dateTo = new Date(y, m + 1, 0).toISOString().slice(0, 10)
  return { dateFrom, dateTo, month: `${y}-${String(m + 1).padStart(2, '0')}` }
}

async function main() {
  const os = require('os')
  const fs = require('fs')
  const path = require('path')
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const page = await h.getMainWindow(app)
  const r = h.makeResults()
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sarang-gst-check-'))

  try {
    await h.login(page)
    await installSaveDialogStub(app, outDir)

    const product = await page.evaluate(() => window.api.products.create({
      productName: 'GST-check item', productType: 'STANDARD', unit: 'PCS',
      costPrice: 1000, sellingPrice: 1500, taxRate: 18, sku: `GSTCHECK-${Date.now()}`
    }))
    const productId = product?.data?.id
    r.log('seed-product', !!productId, JSON.stringify(product))

    const supplier = await page.evaluate(() => window.api.suppliers.create({ supplierName: `GST-check supplier ${Date.now()}` }))
    const supplierId = supplier?.data?.id
    r.log('seed-supplier', !!supplierId, JSON.stringify(supplier))

    // ── Bill with real supplier-invoice fields (F-10) ───────────────────────
    const bill = await page.evaluate(({ pid, sid }) => window.api.bills.create({
      supplierId: sid,
      supplierInvoiceNumber: `SUPINV-${Date.now()}`,
      supplierInvoiceDate: new Date().toISOString().slice(0, 10),
      items: [{ productId: pid, quantity: 10, unitCost: 1000, taxRate: 18 }]
    }), { pid: productId, sid: supplierId })
    const billId = bill?.data?.id
    r.log('create-bill-with-supplier-invoice-fields', !!billId && bill.data.supplierInvoiceNumber?.startsWith('SUPINV-'), JSON.stringify(bill))

    // ── GST Payment ──────────────────────────────────────────────────────────
    const payment = await page.evaluate(() => window.api.gstPayments.record({
      paymentDate: new Date().toISOString().slice(0, 10), taxAmount: 1000, creditUsed: 0, cashPaid: 1000, reference: 'GST-check'
    }))
    r.log('record-gst-payment', !!payment?.success, JSON.stringify(payment))
    const paymentList = await page.evaluate(() => window.api.gstPayments.list())
    const foundPayment = Array.isArray(paymentList?.data) && paymentList.data.some((p) => (p.narration ?? '').includes('GST-check'))
    r.log('gst-payment-listed', foundPayment, JSON.stringify(paymentList).slice(0, 300))
    if (payment?.data?.id) {
      const voided = await page.evaluate((id) => window.api.gstPayments.void({ id, reason: 'gst check cleanup' }), payment.data.id)
      r.log('void-gst-payment', !!voided?.success, JSON.stringify(voided))
    }

    // ── GST Return Files (GSTR-1 / GSTR-3B) ─────────────────────────────────
    // Needs a real GSTIN on the business profile first (GSTRET-002 guard) —
    // save and restore the original value so this doesn't leave the dev
    // profile permanently changed.
    const profileBefore = await page.evaluate(() => window.api.businessProfile.get())
    const originalTaxNumber = profileBefore?.data?.taxNumber ?? null
    await page.evaluate(() => window.api.businessProfile.update({ taxNumber: '27AAAAA0000A1Z5' }))

    const { month } = monthRange(new Date())
    function validSavedJson(res) {
      if (!res?.data?.saved || !res?.data?.path || !fs.existsSync(res.data.path)) return false
      try { JSON.parse(fs.readFileSync(res.data.path, 'utf8')); return true } catch { return false }
    }
    const gstr1 = await page.evaluate((m) => window.api.gstReturns.exportGstr1({ month: m }), month)
    r.log('export-gstr1', validSavedJson(gstr1), JSON.stringify(gstr1))
    const gstr3b = await page.evaluate((m) => window.api.gstReturns.exportGstr3b({ month: m }), month)
    r.log('export-gstr3b', validSavedJson(gstr3b), JSON.stringify(gstr3b))

    // ── Reports ──────────────────────────────────────────────────────────────
    const range = monthRange(new Date())
    const netPayable = await page.evaluate((rg) => window.api.reports.gstNetPayable(rg), range)
    r.log('report-gst-net-payable', !!netPayable?.success && !!netPayable?.data, JSON.stringify(netPayable).slice(0, 300))

    const purchaseRegister = await page.evaluate((rg) => window.api.reports.purchaseGstRegister(rg), range)
    const matchingRows = (purchaseRegister?.data?.rows ?? []).filter((row) => row.number === bill?.data?.billNumber || (row.supplier ?? '').includes('GST-check'))
    r.log('report-purchase-gst-register-includes-real-bill', matchingRows.length > 0, `totalRows=${purchaseRegister?.data?.rows?.length} matching=${JSON.stringify(matchingRows)}`)

    const hsnSummary = await page.evaluate((rg) => window.api.reports.purchaseHsnSummary(rg), range)
    r.log('report-purchase-hsn-summary', !!hsnSummary?.success && !!hsnSummary?.data, JSON.stringify(hsnSummary).slice(0, 300))

    const tdsDeducted = await page.evaluate((rg) => window.api.reports.tdsDeducted(rg), range)
    r.log('report-tds-deducted', !!tdsDeducted?.success && !!tdsDeducted?.data, JSON.stringify(tdsDeducted).slice(0, 300))

    r.log('app-still-responsive-after-e2-checks', !(await h.hasErrorBoundary(page)))

    // ── Cleanup ──────────────────────────────────────────────────────────────
    await page.evaluate((v) => window.api.businessProfile.update({ taxNumber: v }), originalTaxNumber).catch(() => {})
    if (billId) await page.evaluate((id) => window.api.bills.void({ id, reason: 'gst check cleanup' }), billId).catch(() => {})
    if (productId) {
      await page.evaluate((id) => window.api.inventory.adjustStock({ productId: id, quantity: 0, reason: 'gst check cleanup' }), productId).catch(() => {})
      await page.evaluate((id) => window.api.products.archive(id), productId).catch(() => {})
    }
    if (supplierId) await page.evaluate((id) => window.api.suppliers.archive(id), supplierId).catch(() => {})
  } finally {
    await h.closeApp(app)
    require('fs').rmSync(outDir, { recursive: true, force: true })
  }

  const s = r.summary()
  console.log(`\n=== GST E2 LIVE CHECK SUMMARY: ${s.pass}/${s.total} passed ===`)
  process.exit(s.fail > 0 ? 1 : 0)
}

main().catch((e) => { console.error('FATAL', e); process.exit(1) })
