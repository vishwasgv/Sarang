/**
 * Suite 1 — Core commerce (Phases 1-21, 37-38, 54C/54D fixes).
 * Product creation, invoice creation (cash), invoice detail view, a
 * partial return, and confirmation that the return correctly reduced the
 * original invoice's outstanding balance (the 54D correctness fix).
 */
const h = require('../harness')
const { createTestCustomer } = require('../fixtures/seed')

const TEST_PREFIX = 'E2E Commerce'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    let customerId, productId, invoiceId, invoiceNumber

    await r.step('create-customer-and-product', async () => {
      const custRes = await createTestCustomer(page, { customerName: 'E2E Commerce Customer' })
      r.log('customer-created', !!custRes?.success, JSON.stringify(custRes?.error || ''))
      customerId = custRes?.data?.id

      const prodRes = await page.evaluate(async () => window.api.products.create({
        productName: 'E2E Commerce Widget', productType: 'STANDARD', unit: 'PCS',
        costPrice: 100, sellingPrice: 200, taxRate: 18, openingQuantity: 50,
      }))
      r.log('product-created', !!prodRes?.success, JSON.stringify(prodRes?.error || ''))
      productId = prodRes?.data?.id
    })

    await r.step('create-invoice-via-real-ui', async () => {
      await h.gotoHash(page, '#/billing/new')
      await page.waitForTimeout(700)
      log_noCrash(r, page, 'billing-screen-loads')

      const searchInput = page.locator('input[placeholder="Search products…"]')
      await searchInput.fill('E2E Commerce Widget')
      await page.waitForTimeout(700)
      const productOption = page.locator('button:has-text("E2E Commerce Widget")').first()
      r.log('product-search-found-result', await productOption.count() > 0)
      await productOption.click()
      await page.waitForTimeout(400)

      // Quantity: set to 3 so the return step below has room for a partial
      // return. Each cart row actually has TWO type="number" inputs (a
      // per-line discount field renders before the quantity field in the
      // DOM) — the quantity input is uniquely identified by min="0.001"
      // (the discount input's min is "0").
      const qtyInput = page.locator('input[type="number"][min="0.001"]').first()
      await qtyInput.fill('3')
      await page.waitForTimeout(300)

      const custSearch = page.locator('input[placeholder="Search customers…"]')
      await custSearch.fill('E2E Commerce Customer')
      await page.waitForTimeout(700)
      const custOption = page.locator('button:has-text("E2E Commerce Customer")').first()
      r.log('customer-search-found-result', await custOption.count() > 0)
      await custOption.click()
      await page.waitForTimeout(300)

      // CREDIT, not CASH — a cash sale is paid in full immediately
      // (balanceAmount 0 from the start), which would make the later
      // "return reduces the outstanding balance" (54D fix) assertion
      // meaningless. A credit sale has a real balance to reduce.
      await page.getByRole('button', { name: 'Credit (Pay Later)', exact: true }).click()
      await page.waitForTimeout(300)

      await page.keyboard.press('F10')
      await page.waitForTimeout(1500)

      const url = page.url()
      const match = url.match(/#\/billing\/([a-zA-Z0-9]+)/)
      r.log('invoice-created-navigated-to-detail', !!match, url)
      if (match) invoiceId = match[1]
      r.log('billing-screen-no-crash-after-submit', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'invoice-created')
    })

    await r.step('verify-invoice-via-api', async () => {
      if (!invoiceId) return r.log('verify-invoice-via-api', false, 'no invoiceId captured')
      const res = await page.evaluate(async (id) => window.api.billing.getInvoice(id), invoiceId)
      r.log('invoice-fetch-success', !!res?.success)
      const inv = res?.data
      invoiceNumber = inv?.invoiceNumber
      r.log('invoice-has-correct-total', Math.abs((inv?.totalAmount ?? 0) - 3 * 200 * 1.18) < 1, String(inv?.totalAmount))
      r.log('invoice-customer-linked', inv?.customerId === customerId, `expected=${customerId} actual=${inv?.customerId}`)
    })

    await r.step('cancel-a-second-throwaway-invoice', async () => {
      // Exercise the cancel path on a separate invoice so the return-flow
      // invoice below stays uncancelled.
      const createRes = await page.evaluate(async (pid) => window.api.billing.createInvoice({
        paymentMethod: 'CASH',
        items: [{ productId: pid, quantity: 1, unitPrice: 200, taxRate: 18 }],
      }), productId)
      r.log('throwaway-invoice-created', !!createRes?.success, JSON.stringify(createRes?.error || ''))
      const throwawayId = createRes?.data?.id
      if (!throwawayId) return

      await h.gotoHash(page, `#/billing/${throwawayId}`)
      await page.waitForTimeout(700)
      const cancelBtn = page.locator('button:has-text("Cancel Invoice")')
      r.log('cancel-invoice-button-present', await cancelBtn.count() > 0)
      if (await cancelBtn.count()) {
        await cancelBtn.click()
        await page.waitForTimeout(400)
        const modal = h.topModal(page)
        await modal.locator('textarea').fill('E2E suite cancellation test')
        await modal.locator('button:has-text("Yes, Cancel Invoice")').click()
        await page.waitForTimeout(1200)
        const bodyText = await page.locator('body').innerText()
        r.log('invoice-shows-cancelled-badge', /CANCELLED/.test(bodyText))
      }
    })

    await r.step('process-a-partial-return-and-verify-balance-correctness', async () => {
      if (!invoiceNumber) return r.log('process-a-partial-return-and-verify-balance-correctness', false, 'no invoiceNumber captured')
      const before = await page.evaluate(async (id) => window.api.billing.getInvoice(id), invoiceId)
      const balanceBefore = before?.data?.balanceAmount

      await h.gotoHash(page, '#/returns')
      await page.waitForTimeout(700)
      const invoiceNumberInput = page.locator('input[placeholder="e.g. INV-00042"]')
      await invoiceNumberInput.fill(invoiceNumber)
      // The global "Search (Ctrl+K)" header button also matches
      // has-text("Search") — scope to the button right next to this input.
      await invoiceNumberInput.locator('xpath=following::button[contains(., "Search")][1]').click()
      await page.waitForTimeout(1000)
      const selectItemsHeading = page.locator('text=Select Items to Return')
      r.log('return-screen-found-invoice', await selectItemsHeading.count() > 0)

      // Click the "+" for our item's row once (return 1 of the 3 units).
      // The <p> holding the product name and the Minus/Plus buttons are
      // SIBLING divs under one row container (not nested) — a hasText
      // match on the row itself would pick the innermost matching div
      // (the name-only div, no buttons), so walk up from the exact <p>
      // to the shared row ancestor instead.
      const nameP = page.locator('p', { hasText: 'E2E Commerce Widget' }).first()
      const itemRow = nameP.locator('xpath=../..')
      const plusBtn = itemRow.locator('button').last()
      await plusBtn.click()
      await page.waitForTimeout(300)
      await page.locator('textarea').fill('E2E suite partial return test')
      await page.locator('button:has-text("Process Return")').click()
      await page.waitForTimeout(1500)
      const successText = await page.locator('body').innerText()
      r.log('return-processed-confirmation-shown', /Return Processed/.test(successText))

      const after = await page.evaluate(async (id) => window.api.billing.getInvoice(id), invoiceId)
      const balanceAfter = after?.data?.balanceAmount
      // 54D fix: the original invoice's own balance must drop after a return
      // against an unpaid invoice, not just the aggregate ledger.
      r.log('original-invoice-balance-reduced-by-return-54D-fix', balanceAfter < balanceBefore, `${balanceBefore} -> ${balanceAfter}`)
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    const cleaned = h.cleanupByNamePrefix(TEST_PREFIX)
    console.log('cleanup:', JSON.stringify(cleaned))
  }

  return r
}

function log_noCrash(r, page, name) {
  return page.locator('body').innerText().then((t) => r.log(name, !/Something went wrong/i.test(t)))
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nCORE COMMERCE: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
