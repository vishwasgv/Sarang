/**
 * M4/M8 — live check of J10 (receipt OCR). receipt-ocr.util.ts's own text-parsing
 * heuristics are already unit-tested (7 tests). What has NEVER been verified is
 * the half that can't run in a unit test: tesseract.js's Web Worker + WASM
 * loading of local files (resources/ocr/) inside this app's real renderer,
 * which runs with `sandbox: true` + `webSecurity: true` (src/main/index.ts) —
 * a documented, known trouble spot for that library.
 *
 * Generates its own test receipt image (via a real Playwright screenshot of a
 * simple HTML page — no new fixture/dependency needed), feeds it through the
 * REAL "Scan Receipt" button on the real Expense form, and checks: (a) the
 * scan reaches a definite terminal state (success banner or the friendly
 * failure toast — never stuck spinning), (b) the amount detected actually
 * matches what's in the generated image (proves the pipeline read real
 * pixels, not just failed gracefully), and (c) no worker/WASM-loading error
 * appears in the console (which would show up there even when the try/catch
 * in ExpensesScreen.tsx swallows it into the same generic failure toast a
 * blurry photo would also produce — this distinguishes the two).
 *
 * Not part of run-all.js — standalone, run directly:
 *   node tests/e2e/receipt-ocr-live-check-2026-09.js
 */
const h = require('./harness')
const path = require('path')
const os = require('os')
const fs = require('fs')

async function main() {
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const page = await h.getMainWindow(app)
  const r = h.makeResults()
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sarang-ocr-check-'))
  const imgPath = path.join(tmpDir, 'test-receipt.png')

  const consoleErrors = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })

  try {
    // ── Generate a real receipt-shaped test image via a real screenshot ──────
    // Large, high-contrast, simple text — this is a pipeline check, not an
    // OCR-accuracy check (that's what the 7 unit tests are for).
    const html = `<!doctype html><html><body style="margin:0;width:500px;height:300px;background:#fff;font-family:Arial;color:#000;padding:20px;font-size:22px;line-height:1.6;">` +
      `<div>Sarang Test Store</div>` +
      `<div>123 Market Road</div>` +
      `<div>Date: 12 Jan 2026</div>` +
      `<div>Item A ........ 300.00</div>` +
      `<div>Item B ........ 200.00</div>` +
      `<div style="font-weight:bold;">Grand Total: Rs. 500.00</div>` +
      `</body></html>`
    // Electron's Playwright context refuses a second CDP target
    // (`browserContext.newPage()` → "Target.createTarget: Not supported"),
    // so this can't use a normal Playwright screenshot. Instead, render and
    // capture the image inside the real main process via app.evaluate() —
    // the same BrowserWindow.capturePage() mechanism this app's own print
    // pipeline (print-html.ts) already relies on. electronApp.evaluate()'s
    // sandbox has no `require`, so the PNG comes back as base64 over the
    // wire and is written to disk from here instead.
    const pngBase64 = await app.evaluate(async ({ BrowserWindow }, htmlContent) => {
      const win = new BrowserWindow({ show: false, width: 500, height: 300, webPreferences: { sandbox: true } })
      await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent))
      await new Promise((resolve) => setTimeout(resolve, 300))
      const image = await win.webContents.capturePage()
      const buf = image.toPNG()
      win.close()
      return buf.toString('base64')
    }, html)
    fs.writeFileSync(imgPath, Buffer.from(pngBase64, 'base64'))
    r.log('generated-test-receipt-image', fs.existsSync(imgPath) && fs.statSync(imgPath).size > 500, imgPath)

    // ── Drive the real Scan Receipt flow ─────────────────────────────────────
    await h.login(page)
    await h.gotoHash(page, '#/expenses')
    await page.waitForTimeout(800)
    const addBtn = page.getByRole('button', { name: /add expense/i }).first()
    await addBtn.click()
    await page.waitForTimeout(400)

    const fileInput = page.locator('#receipt-scan-input')
    r.log('scan-receipt-input-present', await fileInput.count() > 0)
    await fileInput.setInputFiles(imgPath)

    // Wait for a definite terminal state: either the "detected" notice or the
    // failure toast — poll rather than a fixed sleep, since real OCR timing
    // varies (first run also pays a one-time worker cold-start cost).
    const terminal = await page.waitForFunction(() => {
      const body = document.body.innerText || ''
      return body.includes('Detected from receipt') || body.includes('Could not read that receipt')
    }, { timeout: 45000 }).catch(() => null)
    r.log('scan-reached-terminal-state-within-45s', !!terminal)

    const bodyText = await page.locator('body').innerText().catch(() => '')
    const amountField = await page.locator('input[placeholder="0.00"]').first().inputValue().catch(() => '')
    const succeeded = bodyText.includes('Detected from receipt')
    r.log('scan-succeeded-not-just-gracefully-failed', succeeded, `amountField="${amountField}" bodyHasNotice=${succeeded}`)
    // The generated image's real total is 500.00 — if OCR actually read real
    // pixels (not just failed gracefully into the same-looking toast), the
    // amount field should reflect it.
    r.log('detected-amount-matches-real-image-content', amountField === '500.00' || amountField === '500', `amountField="${amountField}"`)

    const workerErrors = consoleErrors.filter((e) => /worker|wasm|tesseract|ocrAssetsUrl/i.test(e))
    r.log('no-worker-wasm-loading-errors-in-console', workerErrors.length === 0, JSON.stringify(workerErrors))

    r.log('app-still-responsive-after-ocr-scan', !(await h.hasErrorBoundary(page)))
  } finally {
    await h.closeApp(app)
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }

  const s = r.summary()
  console.log(`\n=== RECEIPT OCR LIVE CHECK SUMMARY: ${s.pass}/${s.total} passed ===`)
  process.exit(s.fail > 0 ? 1 : 0)
}

main().catch((e) => { console.error('FATAL', e); process.exit(1) })
