/**
 * Suite 61 — Share Bill/Report/Purchase Order via WhatsApp & Email
 * (docs/FEATURE_SHARE_BILL_REPORT_WHATSAPP_EMAIL.md Section 8.3 "E2E").
 *
 * Covers Invoice + Reports + Purchase Order. Purchase Order is chosen over
 * Quotation/Credit Note/Debit Note as the third document type because it's
 * the highest-risk one in this feature — it had NO print/PDF capability of
 * any kind before this build (Section 4), and it's the only document type
 * that got a brand-new permission (`purchaseOrders.printDocument`) rather
 * than reusing an existing print-gate, so it's the one most likely to have
 * a real wiring bug.
 *
 * Per the founder's explicit test-design instruction, the native
 * `dialog.showSaveDialog` (used by every `...exportPdf`/`export.toPdf`
 * handler) cannot be driven by Playwright's Electron automation — this is a
 * known, permanent limitation (see docs/RELEASE_CHECKLIST.md's Export
 * discussion), not something this suite works around.
 *
 * IMPORTANT, found the hard way: `window.api.*` (the contextBridge-exposed
 * IPC surface) is deep-frozen by Electron (`writable:false,
 * configurable:false` on every property, confirmed empirically) — a
 * deliberate security hardening so page JS can't tamper with privileged IPC
 * calls. Monkey-patching `window.api.print.exportInvoicePdf = ...` from the
 * renderer therefore silently no-ops; the REAL handler still runs, opening
 * an actual native save dialog that blocks the rest of the test. (An
 * earlier draft of this suite tried the renderer-side approach and every
 * assertion downstream of the first click failed/timed out for exactly
 * this reason.)
 *
 * The fix: intercept one layer deeper, at the MAIN-PROCESS `ipcMain`
 * handler itself, via Playwright's `electronApp.evaluate()` (which runs
 * code in the real main process, with full `require('electron')` access).
 * This means `window.api.print.exportInvoicePdf()` — the real, completely
 * unmodified call ShareMenu.tsx makes — executes exactly as shipped; only
 * what the main process does when that IPC channel fires gets swapped out.
 * This is a MORE faithful test than mocking the renderer boundary would
 * have been, not a compromise.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E Share'
const TEST_USER_PASSWORD = 'E2ESharePw!2026Test'

// Overrides the given export IPC channel's real ipcMain handler (main
// process) with one that returns `exportResult` and records the call, plus
// the three `share:*` handlers used downstream. Calls are recorded into
// `global.__shareTestCalls` in the MAIN process (not the renderer), read
// back afterward via getCalls(). Safe to call fresh before every click —
// no restoration needed between calls since this suite gets its own
// disposable Electron process per run (h.launchApp()) and nothing else in
// this suite touches these channels expecting the real behavior.
async function installShareSpies(app, { exportChannel, exportResult }) {
  await app.evaluate((electron, { exportChannel, exportResult }) => {
    const { ipcMain } = electron
    global.__shareTestCalls = []

    const override = (channel, name, result) => {
      try { ipcMain.removeHandler(channel) } catch { /* not yet registered */ }
      ipcMain.handle(channel, async (_evt, payload) => {
        global.__shareTestCalls.push([name, payload])
        return result
      })
    }

    override(exportChannel, 'export', exportResult)
    override('share:showItemInFolder', 'showItemInFolder', { success: true })
    override('share:buildWhatsAppLink', 'buildWhatsAppLink', { success: true, data: 'https://wa.me/919999999999?text=spy' })
    override('share:buildEmailLink', 'buildEmailLink', { success: true, data: 'mailto:spy@example.com?subject=x&body=y' })
  }, { exportChannel, exportResult })

  // window.open() itself is a normal renderer global, NOT contextBridge-
  // frozen — overriding it from the page context is safe and real.
}

async function installWindowOpenSpy(page) {
  await page.evaluate(() => {
    window.__testCalls = []
    window.open = (url) => {
      window.__testCalls.push(['window.open', url])
      return null
    }
  })
}

async function getCalls(app, page) {
  const mainCalls = await app.evaluate(() => global.__shareTestCalls || [])
  const openCalls = await page.evaluate(() => window.__testCalls || [])
  // Merge in call order: main-process calls happen strictly before
  // window.open (which only fires after the IPC round-trips resolve), so
  // concatenation preserves the real order for this suite's assertions.
  return [...mainCalls, ...openCalls]
}

function shareButtons(page) {
  return {
    whatsapp: page.getByRole('button', { name: 'WhatsApp' }),
    email: page.getByRole('button', { name: 'Email' }),
  }
}

async function createRoleUser(page, roleName, username) {
  const rolesRes = await page.evaluate(async () => window.api.roles.list())
  const roles = rolesRes?.data || []
  const role = roles.find((rl) => rl.roleName === roleName)
  if (!role) return { success: false, error: { code: 'NO-ROLE', message: `role ${roleName} not found` } }
  return page.evaluate(async ({ roleId, username, password, fullName }) => window.api.users.create({
    fullName, username, password, roleId,
  }), { roleId: role.id, username, password: TEST_USER_PASSWORD, fullName: `${TEST_PREFIX} ${roleName}` })
}

async function switchToUser(page, username) {
  // Same reasoning as 13-role-permissions.js's switchToUser — the real
  // "Sign Out" UI control, not a raw IPC logout call, is what makes the
  // renderer's own auth store (and therefore the login form) update.
  await page.locator('header button:not([aria-label])').first().click()
  await page.waitForTimeout(300)
  await page.locator('button:has-text("Sign Out")').click()
  await page.waitForTimeout(800)
  await h.login(page, username, TEST_USER_PASSWORD)
}

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    // ── Setup: products, customers (with/without phone), invoices ───────
    let productId, customerPhoneId, customerNoPhoneId, invoicePhoneId, invoiceNoPhoneId
    const custPhone = `9${String(Date.now()).slice(-9)}`

    await r.step('setup-invoice-fixtures', async () => {
      const prodRes = await page.evaluate(async (prefix) => window.api.products.create({
        productName: `${prefix} Widget`, productType: 'STANDARD', unit: 'PCS',
        costPrice: 50, sellingPrice: 100, taxRate: 18, openingQuantity: 20,
      }), TEST_PREFIX)
      productId = prodRes?.data?.id
      r.log('share-product-created', !!productId, JSON.stringify(prodRes?.error || ''))

      const custPhoneRes = await page.evaluate(async ({ prefix, phone }) => window.api.customers.create({
        customerName: `${prefix} CustWithPhone`, phone, email: 'sharecust@example.com',
      }), { prefix: TEST_PREFIX, phone: custPhone })
      customerPhoneId = custPhoneRes?.data?.id
      r.log('customer-with-phone-created', !!customerPhoneId, JSON.stringify(custPhoneRes?.error || ''))

      const custNoPhoneRes = await page.evaluate(async (prefix) => window.api.customers.create({
        customerName: `${prefix} CustNoPhone`, email: 'sharecust2@example.com',
      }), TEST_PREFIX)
      customerNoPhoneId = custNoPhoneRes?.data?.id
      r.log('customer-no-phone-created', !!customerNoPhoneId, JSON.stringify(custNoPhoneRes?.error || ''))

      const invPhoneRes = await page.evaluate(async ({ customerId, prodId }) => window.api.billing.createInvoice({
        customerId, paymentMethod: 'CASH', items: [{ productId: prodId, quantity: 1, unitPrice: 100, taxRate: 18 }],
      }), { customerId: customerPhoneId, prodId: productId })
      invoicePhoneId = invPhoneRes?.data?.id
      r.log('invoice-for-phone-customer-created', !!invoicePhoneId, JSON.stringify(invPhoneRes?.error || ''))

      const invNoPhoneRes = await page.evaluate(async ({ customerId, prodId }) => window.api.billing.createInvoice({
        customerId, paymentMethod: 'CASH', items: [{ productId: prodId, quantity: 1, unitPrice: 100, taxRate: 18 }],
      }), { customerId: customerNoPhoneId, prodId: productId })
      invoiceNoPhoneId = invNoPhoneRes?.data?.id
      r.log('invoice-for-no-phone-customer-created', !!invoiceNoPhoneId, JSON.stringify(invNoPhoneRes?.error || ''))
    })

    // ── Invoice: render + enable/disable by phone presence ──────────────
    await r.step('invoice-share-buttons-enabled-when-customer-has-phone', async () => {
      await h.gotoHash(page, `#/billing/${invoicePhoneId}`)
      await page.waitForTimeout(900)
      const { whatsapp, email } = shareButtons(page)
      r.log('whatsapp-button-visible', await whatsapp.count() > 0)
      r.log('whatsapp-button-enabled-for-phone-customer', !(await whatsapp.isDisabled().catch(() => true)))
      r.log('email-button-enabled', !(await email.isDisabled().catch(() => true)))
    })

    await r.step('invoice-whatsapp-button-disabled-when-no-phone-on-file', async () => {
      await h.gotoHash(page, `#/billing/${invoiceNoPhoneId}`)
      await page.waitForTimeout(900)
      const { whatsapp, email } = shareButtons(page)
      const disabled = await whatsapp.isDisabled().catch(() => false)
      r.log('whatsapp-button-disabled-for-no-phone-customer', disabled === true)
      const title = await whatsapp.getAttribute('title').catch(() => null)
      r.log('whatsapp-button-title-explains-no-phone', title === 'No phone number on file', String(title))
      r.log('email-button-still-enabled-with-no-phone', !(await email.isDisabled().catch(() => true)))
    })

    // ── Invoice: happy-path WhatsApp click, correct call order+args ─────
    await r.step('invoice-whatsapp-share-happy-path-call-order-and-args', async () => {
      await h.gotoHash(page, `#/billing/${invoicePhoneId}`)
      await page.waitForTimeout(900)
      await installShareSpies(app, {
        exportChannel: 'print:exportInvoicePdf',
        exportResult: { success: true, data: { cancelled: false, filePath: 'C:\\fake\\path\\test-invoice.pdf' } },
      })
      await installWindowOpenSpy(page)
      const { whatsapp } = shareButtons(page)
      await whatsapp.click()
      await page.waitForTimeout(600)
      const calls = await getCalls(app, page)
      const order = calls.map((c) => c[0])
      r.log('whatsapp-call-order-export-reveal-buildlink-open', JSON.stringify(order) === JSON.stringify(['export', 'showItemInFolder', 'buildWhatsAppLink', 'window.open']), JSON.stringify(order))
      const revealCall = calls.find((c) => c[0] === 'showItemInFolder')
      r.log('reveal-called-with-mocked-filepath', revealCall?.[1]?.filePath === 'C:\\fake\\path\\test-invoice.pdf', JSON.stringify(revealCall))
      const linkCall = calls.find((c) => c[0] === 'buildWhatsAppLink')
      r.log('buildwhatsapplink-called-with-real-customer-phone', linkCall?.[1]?.phone === custPhone, JSON.stringify(linkCall))
      r.log('buildwhatsapplink-message-mentions-invoice', typeof linkCall?.[1]?.message === 'string' && linkCall[1].message.length > 0, JSON.stringify(linkCall?.[1]?.message))
      const openCall = calls.find((c) => c[0] === 'window.open')
      r.log('window-open-called-with-wa-me-url', typeof openCall?.[1] === 'string' && openCall[1].includes('wa.me'), JSON.stringify(openCall))
      const bodyText = await page.locator('body').innerText()
      r.log('neutral-opening-toast-shown-not-sent', bodyText.includes('Opening WhatsApp') && !/Sent!/i.test(bodyText))
    })

    // ── Invoice: happy-path Email click ──────────────────────────────────
    await r.step('invoice-email-share-happy-path-call-order-and-args', async () => {
      await h.gotoHash(page, `#/billing/${invoicePhoneId}`)
      await page.waitForTimeout(900)
      await installShareSpies(app, {
        exportChannel: 'print:exportInvoicePdf',
        exportResult: { success: true, data: { cancelled: false, filePath: 'C:\\fake\\path\\test-invoice.pdf' } },
      })
      await installWindowOpenSpy(page)
      const { email } = shareButtons(page)
      await email.click()
      await page.waitForTimeout(600)
      const calls = await getCalls(app, page)
      const order = calls.map((c) => c[0])
      r.log('email-call-order-export-reveal-buildlink-open', JSON.stringify(order) === JSON.stringify(['export', 'showItemInFolder', 'buildEmailLink', 'window.open']), JSON.stringify(order))
      const linkCall = calls.find((c) => c[0] === 'buildEmailLink')
      r.log('buildemaillink-called-with-real-customer-email', linkCall?.[1]?.email === 'sharecust@example.com', JSON.stringify(linkCall))
      r.log('buildemaillink-has-subject-and-body', !!linkCall?.[1]?.subject && !!linkCall?.[1]?.body, JSON.stringify(linkCall?.[1]))
      const openCall = calls.find((c) => c[0] === 'window.open')
      r.log('window-open-called-with-mailto-url', typeof openCall?.[1] === 'string' && openCall[1].startsWith('mailto:'), JSON.stringify(openCall))
      const bodyText = await page.locator('body').innerText()
      r.log('neutral-opening-email-toast-shown-not-sent', bodyText.includes('Opening your email app') && !/Sent!/i.test(bodyText))
    })

    // ── Invoice: cancelled save dialog aborts silently ───────────────────
    await r.step('invoice-share-aborts-silently-on-cancelled-export', async () => {
      await h.gotoHash(page, `#/billing/${invoicePhoneId}`)
      await page.waitForTimeout(900)
      await installShareSpies(app, {
        exportChannel: 'print:exportInvoicePdf',
        exportResult: { success: true, data: { cancelled: true } },
      })
      await installWindowOpenSpy(page)
      const { whatsapp } = shareButtons(page)
      await whatsapp.click()
      await page.waitForTimeout(600)
      const calls = await getCalls(app, page)
      r.log('cancelled-export-aborts-before-reveal-or-link-or-open', calls.length === 1 && calls[0][0] === 'export', JSON.stringify(calls))
    })

    // ── Invoice: failed export shows error toast, aborts ──────────────────
    await r.step('invoice-share-shows-error-toast-and-aborts-on-export-failure', async () => {
      await h.gotoHash(page, `#/billing/${invoicePhoneId}`)
      await page.waitForTimeout(900)
      await installShareSpies(app, {
        exportChannel: 'print:exportInvoicePdf',
        exportResult: { success: false, error: { message: 'E2E simulated disk error' } },
      })
      await installWindowOpenSpy(page)
      const { whatsapp } = shareButtons(page)
      await whatsapp.click()
      await page.waitForTimeout(600)
      const calls = await getCalls(app, page)
      r.log('failed-export-aborts-before-reveal-or-link-or-open', calls.length === 1 && calls[0][0] === 'export', JSON.stringify(calls))
      const bodyText = await page.locator('body').innerText()
      r.log('error-toast-shows-export-failure-message', bodyText.includes('E2E simulated disk error'), bodyText.slice(-300))
    })

    // ── Reports: Share renders for a report type the user can view ───────
    await r.step('reports-share-renders-for-permitted-report-type', async () => {
      await h.gotoHash(page, '#/reports')
      await page.waitForTimeout(700)
      const tile = page.locator('button, [role="button"]', { hasText: 'Sales Report' }).first()
      r.log('sales-report-tile-present', await tile.count() > 0)
      await tile.click()
      await page.waitForTimeout(500)
      const dateInputs = page.locator('input[type="date"]')
      if (await dateInputs.count() >= 2) {
        await dateInputs.nth(0).fill(h.toLocalISODate(new Date(Date.now() - 365 * 24 * 3600000)))
        await dateInputs.nth(1).fill(h.toLocalISODate(new Date()))
      }
      await page.locator('button:has-text("Generate Report")').click()
      await page.waitForTimeout(1200)
      r.log('sales-report-renders-no-crash', !(await h.hasErrorBoundary(page)))
      const { whatsapp, email } = shareButtons(page)
      r.log('report-share-buttons-render-for-admin', await whatsapp.count() > 0 && await email.count() > 0)

      // Reports have no single customer/supplier attached, so recipientPhone
      // is always null by design (ShareMenu.tsx) — that correctly disables
      // the WhatsApp button (there's genuinely nobody to send it to without
      // the owner typing a number themselves inside WhatsApp). Confirmed
      // here rather than assumed, then the Email button — which stays
      // enabled with an empty "To" field by design — is used for the
      // click-through happy-path check instead.
      r.log('report-whatsapp-button-disabled-no-single-recipient-by-design', await whatsapp.isDisabled().catch(() => false))
      r.log('report-email-button-enabled-despite-no-recipient', !(await email.isDisabled().catch(() => true)))

      await installShareSpies(app, {
        exportChannel: 'export:toPdf',
        exportResult: { success: true, data: { cancelled: false, filePath: 'C:\\fake\\path\\sales-report.pdf' } },
      })
      await installWindowOpenSpy(page)
      await email.click()
      await page.waitForTimeout(1000)
      const calls = await getCalls(app, page)
      const order = calls.map((c) => c[0])
      r.log('report-email-call-order-correct', JSON.stringify(order) === JSON.stringify(['export', 'showItemInFolder', 'buildEmailLink', 'window.open']), JSON.stringify(order))
      const linkCall = calls.find((c) => c[0] === 'buildEmailLink')
      // Reports have no single customer/supplier — recipientEmail is always
      // null (Section design), so the link is built with email: null and
      // the owner fills the recipient in manually inside their email app.
      r.log('report-share-recipient-email-is-null-by-design', linkCall?.[1]?.email == null, JSON.stringify(linkCall?.[1]))
    })

    // ── Purchase Order: setup ────────────────────────────────────────────
    let supplierPhoneId, supplierNoPhoneId, poPhoneId, poNoPhoneId, poProductId
    const supPhone = `8${String(Date.now()).slice(-9)}`

    await r.step('setup-purchase-order-fixtures', async () => {
      const prodRes = await page.evaluate(async (prefix) => window.api.products.create({
        productName: `${prefix} PO Widget`, productType: 'STANDARD', unit: 'PCS',
        costPrice: 40, sellingPrice: 80, taxRate: 18, openingQuantity: 5,
      }), TEST_PREFIX)
      poProductId = prodRes?.data?.id
      r.log('po-product-created', !!poProductId, JSON.stringify(prodRes?.error || ''))

      const supPhoneRes = await page.evaluate(async ({ prefix, phone }) => window.api.suppliers.create({
        supplierName: `${prefix} SupWithPhone`, phone, email: 'sharesup@example.com',
      }), { prefix: TEST_PREFIX, phone: supPhone })
      supplierPhoneId = supPhoneRes?.data?.id
      r.log('supplier-with-phone-created', !!supplierPhoneId, JSON.stringify(supPhoneRes?.error || ''))

      const supNoPhoneRes = await page.evaluate(async (prefix) => window.api.suppliers.create({
        supplierName: `${prefix} SupNoPhone`, email: 'sharesup2@example.com',
      }), TEST_PREFIX)
      supplierNoPhoneId = supNoPhoneRes?.data?.id
      r.log('supplier-no-phone-created', !!supplierNoPhoneId, JSON.stringify(supNoPhoneRes?.error || ''))

      const poPhoneRes = await page.evaluate(async ({ supplierId, prodId }) => window.api.purchaseOrders.create({
        supplierId, items: [{ productId: prodId, quantity: 2, unitCost: 40, taxRate: 18 }],
      }), { supplierId: supplierPhoneId, prodId: poProductId })
      poPhoneId = poPhoneRes?.data?.id
      r.log('po-for-phone-supplier-created', !!poPhoneId, JSON.stringify(poPhoneRes?.error || ''))

      const poNoPhoneRes = await page.evaluate(async ({ supplierId, prodId }) => window.api.purchaseOrders.create({
        supplierId, items: [{ productId: prodId, quantity: 1, unitCost: 40, taxRate: 18 }],
      }), { supplierId: supplierNoPhoneId, prodId: poProductId })
      poNoPhoneId = poNoPhoneRes?.data?.id
      r.log('po-for-no-phone-supplier-created', !!poNoPhoneId, JSON.stringify(poNoPhoneRes?.error || ''))
    })

    // ── Purchase Order (Admin): render + enable/disable, happy path ─────
    await r.step('po-share-buttons-enabled-when-supplier-has-phone-admin', async () => {
      await h.gotoHash(page, `#/purchase-orders/${poPhoneId}`)
      await page.waitForTimeout(900)
      const { whatsapp, email } = shareButtons(page)
      r.log('po-share-buttons-render-for-admin', await whatsapp.count() > 0 && await email.count() > 0)
      r.log('po-whatsapp-enabled-for-phone-supplier', !(await whatsapp.isDisabled().catch(() => true)))
    })

    await r.step('po-whatsapp-button-disabled-when-no-phone-on-file', async () => {
      await h.gotoHash(page, `#/purchase-orders/${poNoPhoneId}`)
      await page.waitForTimeout(900)
      const { whatsapp } = shareButtons(page)
      r.log('po-whatsapp-disabled-for-no-phone-supplier', await whatsapp.isDisabled().catch(() => false))
    })

    await r.step('po-whatsapp-share-happy-path-call-order-and-args', async () => {
      await h.gotoHash(page, `#/purchase-orders/${poPhoneId}`)
      await page.waitForTimeout(900)
      await installShareSpies(app, {
        exportChannel: 'purchaseOrders:exportPdf',
        exportResult: { success: true, data: { cancelled: false, filePath: 'C:\\fake\\path\\test-po.pdf' } },
      })
      await installWindowOpenSpy(page)
      const { whatsapp } = shareButtons(page)
      await whatsapp.click()
      await page.waitForTimeout(600)
      const calls = await getCalls(app, page)
      const order = calls.map((c) => c[0])
      r.log('po-whatsapp-call-order-correct', JSON.stringify(order) === JSON.stringify(['export', 'showItemInFolder', 'buildWhatsAppLink', 'window.open']), JSON.stringify(order))
      const linkCall = calls.find((c) => c[0] === 'buildWhatsAppLink')
      r.log('po-buildwhatsapplink-called-with-real-supplier-phone', linkCall?.[1]?.phone === supPhone, JSON.stringify(linkCall))
    })

    // ── Purchase Order permission gating: Cashier/Staff can't see Share ─
    const cashierUsername = `e2esharecashier${Date.now()}`
    await r.step('create-cashier-test-user-for-po-permission-check', async () => {
      const res = await createRoleUser(page, 'Cashier', cashierUsername)
      r.log('cashier-user-created', !!res?.success, JSON.stringify(res?.error || ''))
    })

    await r.step('cashier-does-not-see-po-share-buttons-lacks-printDocument-permission', async () => {
      await switchToUser(page, cashierUsername)
      const who = await page.evaluate(async () => window.api.auth.getCurrentUser())
      r.log('logged-in-as-cashier', who?.data?.username === cashierUsername, JSON.stringify(who?.data?.username))

      await h.gotoHash(page, `#/purchase-orders/${poPhoneId}`)
      await page.waitForTimeout(900)
      const { whatsapp, email } = shareButtons(page)
      r.log('cashier-sees-no-po-share-whatsapp-button', await whatsapp.count() === 0)
      r.log('cashier-sees-no-po-share-email-button', await email.count() === 0)
      const printBtn = page.getByRole('button', { name: /Print/ })
      r.log('cashier-also-sees-no-po-print-button-same-gate', await printBtn.count() === 0)
    })

    await r.step('cashier-still-sees-invoice-share-buttons-has-billing-printInvoice', async () => {
      // Bonus positive-permission check: Cashier DOES have billing.printInvoice
      // (seed.ts), so Share should still render on Invoice detail — confirms
      // the PO gate above is specific to the missing purchaseOrders.printDocument
      // permission, not an accidental blanket lockout of ShareMenu for Cashier.
      await h.gotoHash(page, `#/billing/${invoicePhoneId}`)
      await page.waitForTimeout(900)
      const { whatsapp, email } = shareButtons(page)
      r.log('cashier-sees-invoice-share-buttons', await whatsapp.count() > 0 && await email.count() > 0)
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    h.withDb((db) => {
      const userIds = db.prepare(`SELECT id FROM User WHERE fullName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      for (const uid of userIds) {
        // Same rationale as 13-role-permissions.js: never hard-delete a user
        // (breaks AuditLog hash-chain verification via the FK cascade), the
        // real app only ever deactivates.
        db.prepare('UPDATE User SET isActive = 0 WHERE id = ?').run(uid)
      }
      console.log('share-suite role-user cleanup:', userIds.length)

      // cleanupByNamePrefix (below) only knows about Customer/Product — this
      // suite also creates Supplier + PurchaseOrder rows, which it doesn't
      // touch. PurchaseOrderItem cascades on PurchaseOrder delete (schema.prisma).
      const poIds = db.prepare("SELECT id FROM PurchaseOrder WHERE supplierId IN (SELECT id FROM Supplier WHERE supplierName LIKE 'E2E Share%')").all().map((row) => row.id)
      for (const id of poIds) { try { db.prepare('DELETE FROM PurchaseOrder WHERE id = ?').run(id) } catch { /* ignore */ } }
      const supplierIds = db.prepare("SELECT id FROM Supplier WHERE supplierName LIKE 'E2E Share%'").all().map((row) => row.id)
      for (const id of supplierIds) {
        try { db.prepare('DELETE FROM Supplier WHERE id = ?').run(id) } catch { db.prepare('UPDATE Supplier SET isActive = 0 WHERE id = ?').run(id) }
      }
      console.log('share-suite PO/supplier cleanup:', { poIds: poIds.length, supplierIds: supplierIds.length })
    })
    const cleaned = h.cleanupByNamePrefix(TEST_PREFIX)
    console.log('cleanup:', JSON.stringify(cleaned))
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nSHARE BILL/REPORT: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
