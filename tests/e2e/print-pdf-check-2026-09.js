/**
 * M8 — print and PDF check (BUILD CHECKLIST.md).
 *
 * The native `dialog.showSaveDialog` used by every `...exportPdf`/`export.toPdf`/
 * `export.toCsv`/`export.toExcel` handler cannot be driven by Playwright's Electron
 * automation — a known, permanent limitation already documented in
 * tests/e2e/suites/61-share-bill-report.js. That suite works around it by replacing
 * the WHOLE export IPC handler with a canned response, which is right for testing
 * the Share-button orchestration but never actually generates a file.
 *
 * This script instead patches ONLY `dialog.showSaveDialog` (via electronApp.evaluate,
 * same main-process-injection technique as suite 61) to silently approve a real temp
 * path — every real handler underneath (fetch real document data, generate real HTML,
 * call the real Electron printToPDF()/write the real CSV or Excel bytes) runs exactly
 * as shipped. Each exported file is then checked on disk: exists, non-trivial size,
 * and — for PDFs — starts with the real `%PDF` magic bytes.
 *
 * Native OS print dialogs (bills:print, print:invoice, print:receipt, purchaseOrders:print,
 * etc. — silent:false calls into webContents.print()) are NOT exercised here: unlike a
 * save dialog, there is no return value to stub, the dialog would actually open and
 * block waiting for a human, and Electron's print pipeline additionally needs a real
 * printer driver to rasterize against. That class of check is correctly scoped to a
 * human, in M4 (BUILD CHECKLIST.md F-49/F-53 already say so explicitly).
 *
 * Not part of run-all.js — standalone, run directly:
 *   node tests/e2e/print-pdf-check-2026-09.js
 */
const h = require('./harness')
const path = require('path')
const fs = require('fs')
const os = require('os')

async function installSaveDialogStub(app, dir) {
  // electronApp.evaluate() runs inside Electron's utility-script sandbox, which has
  // no `require` — only what's destructured off the first argument (same constraint
  // suite 61 works within). Building the path by hand instead of via `path.join`/
  // `path.basename` avoids needing the `path` module at all.
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

function isPdf(filePath) {
  const buf = fs.readFileSync(filePath)
  return buf.length > 500 && buf.slice(0, 4).toString('ascii') === '%PDF'
}

async function main() {
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const page = await h.getMainWindow(app)
  const r = h.makeResults()
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sarang-pdf-check-'))

  try {
    await h.login(page)
    await installSaveDialogStub(app, outDir)

    // ── Seed one real product/customer/supplier to build real documents against ──
    const product = await page.evaluate(() => window.api.products.create({
      productName: 'PDF-check item', productType: 'STANDARD', unit: 'PCS',
      costPrice: 100, sellingPrice: 200, taxRate: 18, sku: `PDFCHECK-${Date.now()}`
    }))
    const productId = product?.data?.id
    r.log('seed-product', !!productId, JSON.stringify(product))
    await page.evaluate((pid) => window.api.inventory.addStock({ productId: pid, quantity: 100, reason: 'pdf check' }), productId)

    const customer = await page.evaluate(() => window.api.customers.create({ customerName: `PDF-check customer ${Date.now()}`, phone: `9${String(Date.now()).slice(-9)}` }))
    const customerId = customer?.data?.id
    r.log('seed-customer', !!customerId, JSON.stringify(customer))

    const supplier = await page.evaluate(() => window.api.suppliers.create({ supplierName: `PDF-check supplier ${Date.now()}` }))
    const supplierId = supplier?.data?.id
    r.log('seed-supplier', !!supplierId, JSON.stringify(supplier))

    // ── Invoice PDF ──────────────────────────────────────────────────────────
    const invoice = await page.evaluate(({ pid, cid }) => window.api.billing.createInvoice({
      customerId: cid, paymentMethod: 'CASH',
      items: [{ productId: pid, quantity: 2, unitPrice: 200, discountAmount: 0, taxRate: 18 }]
    }), { pid: productId, cid: customerId })
    const invoiceId = invoice?.data?.id
    r.log('create-invoice', !!invoiceId, JSON.stringify(invoice))
    if (invoiceId) {
      const res = await page.evaluate((id) => window.api.print.exportInvoicePdf({ invoiceId: id }), invoiceId)
      const ok = !!res?.data?.filePath && !res?.data?.cancelled && fs.existsSync(res.data.filePath) && isPdf(res.data.filePath)
      r.log('invoice-pdf-generated-real-file', ok, JSON.stringify(res))
    }

    // ── Quotation PDF ────────────────────────────────────────────────────────
    const quotation = await page.evaluate(({ pid, cid }) => window.api.quotations.create({
      customerId: cid, items: [{ productId: pid, productName: 'PDF-check item', quantity: 1, unitPrice: 200, taxRate: 18, discount: 0 }]
    }), { pid: productId, cid: customerId })
    const quotationId = quotation?.data?.id
    r.log('create-quotation', !!quotationId, JSON.stringify(quotation))
    if (quotationId) {
      const res = await page.evaluate((id) => window.api.quotations.exportPdf(id), quotationId)
      const ok = !!res?.data?.filePath && !res?.data?.cancelled && fs.existsSync(res.data.filePath) && isPdf(res.data.filePath)
      r.log('quotation-pdf-generated-real-file', ok, JSON.stringify(res))
    }

    // ── Purchase Order PDF ───────────────────────────────────────────────────
    const po = await page.evaluate(({ pid, sid }) => window.api.purchaseOrders.create({
      supplierId: sid, items: [{ productId: pid, quantity: 5, unitCost: 100, taxRate: 18 }], isReverseCharge: false
    }), { pid: productId, sid: supplierId })
    const poId = po?.data?.id
    r.log('create-po', !!poId, JSON.stringify(po))
    if (poId) {
      const res = await page.evaluate((id) => window.api.purchaseOrders.exportPdf(id), poId)
      const ok = !!res?.data?.filePath && !res?.data?.cancelled && fs.existsSync(res.data.filePath) && isPdf(res.data.filePath)
      r.log('po-pdf-generated-real-file', ok, JSON.stringify(res))
    }

    // ── Credit Note PDF (against the invoice above) ─────────────────────────
    if (invoiceId) {
      const cn = await page.evaluate(({ id, cid }) => window.api.creditNotes.create({
        invoiceId: id, customerId: cid, reason: 'pdf check return', amount: 236, taxApplied: true, taxRate: 18
      }), { id: invoiceId, cid: customerId })
      const cnId = cn?.data?.id
      r.log('create-credit-note', !!cnId, JSON.stringify(cn))
      if (cnId) {
        const res = await page.evaluate((id) => window.api.creditNotes.exportPdf(id), cnId)
        const ok = !!res?.data?.filePath && !res?.data?.cancelled && fs.existsSync(res.data.filePath) && isPdf(res.data.filePath)
        r.log('credit-note-pdf-generated-real-file', ok, JSON.stringify(res))
      }
    }

    // ── Debit Note PDF (against the PO above) ────────────────────────────────
    if (poId) {
      const approved = await page.evaluate((id) => window.api.purchaseOrders.approve(id), poId)
      r.log('approve-po', !!approved?.success, JSON.stringify(approved))
      const received = await page.evaluate((id) => window.api.purchaseOrders.receive(id), poId)
      r.log('receive-po', !!received?.success, JSON.stringify(received))
      const dn = await page.evaluate(({ id, sid }) => window.api.debitNotes.create({
        purchaseOrderId: id, supplierId: sid, reason: 'pdf check damaged', amount: 118, taxApplied: true, taxRate: 18
      }), { id: poId, sid: supplierId })
      const dnId = dn?.data?.id
      r.log('create-debit-note', !!dnId, JSON.stringify(dn))
      if (dnId) {
        const res = await page.evaluate((id) => window.api.debitNotes.exportPdf(id), dnId)
        const ok = !!res?.data?.filePath && !res?.data?.cancelled && fs.existsSync(res.data.filePath) && isPdf(res.data.filePath)
        r.log('debit-note-pdf-generated-real-file', ok, JSON.stringify(res))
      }
    }

    // ── Generic report export: PDF, CSV, Excel ──────────────────────────────
    const reportHtml = await page.evaluate(() => window.api.export.generateReportHtml({
      title: 'PDF Check Report', tables: [{ headers: ['A', 'B'], rows: [[1, 2], [3, 4]] }]
    }))
    r.log('generate-report-html', !!reportHtml?.data, JSON.stringify(reportHtml).slice(0, 200))
    if (reportHtml?.data) {
      const res = await page.evaluate((html) => window.api.export.toPdf({ html, filename: 'pdf-check-report.pdf' }), reportHtml.data)
      const ok = !!res?.data?.filePath && !res?.data?.cancelled && fs.existsSync(res.data.filePath) && isPdf(res.data.filePath)
      r.log('report-pdf-generated-real-file', ok, JSON.stringify(res))
    }

    const csvRes = await page.evaluate(() => window.api.export.toCsv({
      filename: 'pdf-check.csv', headers: ['A', 'B'], rows: [[1, 2], [3, 4]]
    }))
    r.log('csv-export-succeeded', !!csvRes?.success, JSON.stringify(csvRes))

    const xlsRes = await page.evaluate(() => window.api.export.toExcel({
      filename: 'pdf-check.xlsx', sheets: [{ name: 'Sheet1', headers: ['A', 'B'], rows: [[1, 2], [3, 4]] }]
    }))
    r.log('excel-export-succeeded', !!xlsRes?.success, JSON.stringify(xlsRes))

    // ── Confirm the CSV/Excel files actually landed on disk with real content ──
    const written = fs.readdirSync(outDir)
    const csvFile = written.find((f) => f.endsWith('.csv'))
    const xlsFile = written.find((f) => f.endsWith('.xlsx'))
    r.log('csv-file-written-non-trivial', !!csvFile && fs.statSync(path.join(outDir, csvFile)).size > 5, JSON.stringify(written))
    r.log('excel-file-written-non-trivial', !!xlsFile && fs.statSync(path.join(outDir, xlsFile)).size > 500, JSON.stringify(written))

    r.log('app-still-responsive-after-all-exports', !(await h.hasErrorBoundary(page)))

    // ── Cleanup ──────────────────────────────────────────────────────────────
    // products.archive() refuses to archive a product still carrying stock
    // (PRD-006, by design — see M5 stress-test findings) — zero it first via
    // the real adjustStock path, same fix applied there.
    if (invoiceId) await page.evaluate((id) => window.api.billing.cancelInvoice({ invoiceId: id, reason: 'pdf check cleanup' }), invoiceId).catch(() => {})
    if (productId) {
      await page.evaluate((id) => window.api.inventory.adjustStock({ productId: id, quantity: 0, reason: 'pdf check cleanup' }), productId).catch(() => {})
      await page.evaluate((id) => window.api.products.archive(id), productId).catch(() => {})
    }
    if (customerId) await page.evaluate((id) => window.api.customers.archive(id), customerId).catch(() => {})
    if (supplierId) await page.evaluate((id) => window.api.suppliers.archive(id), supplierId).catch(() => {})
  } finally {
    await h.closeApp(app)
    fs.rmSync(outDir, { recursive: true, force: true })
  }

  const s = r.summary()
  console.log(`\n=== PRINT/PDF CHECK SUMMARY: ${s.pass}/${s.total} passed ===`)
  process.exit(s.fail > 0 ? 1 : 0)
}

main().catch((e) => { console.error('FATAL', e); process.exit(1) })
