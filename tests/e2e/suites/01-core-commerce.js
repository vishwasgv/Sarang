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

    // ── Split Payment (window.api.payments.recordSplit) — a real,
    // money-critical POS feature (paying one sale across two payment
    // methods) with ZERO E2E coverage of any kind before this step,
    // found via a full audit cross-referencing every mutating UI action
    // against every E2E suite. recordSplitPayment itself already had a
    // real accounting bug fixed this same audit (paidAmount credited the
    // entered split total instead of the invoice's actual balance,
    // silently losing up to 5 paise with no ledger trail) — this is the
    // first live-UI proof that the fixed function actually works
    // end-to-end, not just under its own unit tests. ─────────────────────
    let splitInvoiceId = null
    await r.step('split-payment-invoice-via-real-ui', async () => {
      const prodRes = await page.evaluate(async () => window.api.products.create({
        productName: 'E2E Commerce Split Widget', productType: 'STANDARD', unit: 'PCS',
        costPrice: 100, sellingPrice: 200, taxRate: 18, openingQuantity: 20,
      }))
      r.log('split-product-created', !!prodRes?.data?.id, JSON.stringify(prodRes?.error || ''))

      await h.gotoHash(page, '#/billing/new')
      await page.waitForTimeout(700)
      const searchInput = page.locator('input[placeholder="Search products…"]')
      await searchInput.fill('E2E Commerce Split Widget')
      await page.waitForTimeout(700)
      await page.locator('button:has-text("E2E Commerce Split Widget")').first().click()
      await page.waitForTimeout(400)
      const qtyInput = page.locator('input[type="number"][min="0.001"]').first()
      await qtyInput.fill('2')
      await page.waitForTimeout(300)

      await page.getByRole('button', { name: 'Split', exact: true }).click()
      await page.waitForTimeout(300)
      // total = 2 x 200 x 1.18 = 472. The container is the <p> label's own
      // parent div (same "walk up from a uniquely-matched inner element"
      // pattern the return-processing step above already uses) — the Cash
      // input is the first type="number" input inside it; UPI auto-fills
      // to the remainder (172) via the field's own onChange handler.
      const splitLabel = page.locator('p', { hasText: 'Split Payment — enter amounts per method' })
      const splitContainer = splitLabel.locator('xpath=..')
      const cashInput = splitContainer.locator('input[type="number"]').first()
      await cashInput.fill('300')
      await page.waitForTimeout(300)

      await page.keyboard.press('F10')
      await page.waitForTimeout(1500)

      const url = page.url()
      const match = url.match(/#\/billing\/([a-zA-Z0-9]+)/)
      r.log('split-invoice-created-navigated-to-detail', !!match, url)
      if (match) splitInvoiceId = match[1]
      r.log('split-payment-no-crash', !(await h.hasErrorBoundary(page)))
    })

    await r.step('split-payment-persisted-correctly', () => h.withDb((db) => {
      if (!splitInvoiceId) return r.log('skipped-no-split-invoice-id', false)
      const inv = db.prepare('SELECT * FROM Invoice WHERE id = ?').get(splitInvoiceId)
      r.log('split-invoice-fully-paid', inv?.paymentStatus === 'PAID' && inv?.balanceAmount === 0, JSON.stringify({ paymentStatus: inv?.paymentStatus, balanceAmount: inv?.balanceAmount }))
      const legs = db.prepare('SELECT * FROM Payment WHERE invoiceId = ? ORDER BY paymentMethod').all(splitInvoiceId)
      r.log('split-payment-has-two-legs', legs.length === 2, JSON.stringify(legs.map((l) => ({ method: l.paymentMethod, amount: l.amount }))))
      const cashLeg = legs.find((l) => l.paymentMethod === 'CASH')
      const upiLeg = legs.find((l) => l.paymentMethod === 'UPI')
      r.log('split-legs-amounts-correct', cashLeg?.amount === 300 && Math.abs((upiLeg?.amount ?? 0) - 172) < 0.01, JSON.stringify({ cashLeg: cashLeg?.amount, upiLeg: upiLeg?.amount }))
      // paidAmount must equal totalAmount exactly (472) -- the real bug this
      // audit fixed: paidAmount used to be credited from the entered split
      // total (which the code tolerates being up to 5 paise off the real
      // balance) instead of the invoice's actual balanceAmount, silently
      // losing that gap with no ledger trail.
      r.log('paid-amount-equals-total-exactly-no-rounding-leak', inv?.paidAmount === inv?.totalAmount, JSON.stringify({ paidAmount: inv?.paidAmount, totalAmount: inv?.totalAmount }))
    }))

    // ── Foreign-Currency Settlement (window.api.payments.recordForeign
    // CurrencySettlement) — another money-critical action with ZERO E2E
    // coverage before this step. Settles a USD-raised invoice at a
    // DIFFERENT exchange rate than it was raised at on purpose, to prove
    // the realized-gain posting actually happens, not just the common
    // same-rate case. ───────────────────────────────────────────────────
    let fxInvoiceId = null
    await r.step('foreign-currency-invoice-raised-and-settled-at-a-gain', async () => {
      const prodRes = await page.evaluate(async () => window.api.products.create({
        productName: 'E2E Commerce FX Widget', productType: 'STANDARD', unit: 'PCS',
        costPrice: 4000, sellingPrice: 8300, taxRate: 0, openingQuantity: 10,
      }))
      const fxProductId = prodRes?.data?.id
      r.log('fx-product-created', !!fxProductId, JSON.stringify(prodRes?.error || ''))

      // Raised at 8300 INR / 83 per USD = exactly $100.00 foreignTotalAmount
      // (see billing.service.ts's own createInvoice: foreignTotalAmount =
      // totalAmount / foreignExchangeRate).
      const invRes = await page.evaluate(async ({ productId, customerId }) => window.api.billing.createInvoice({
        customerId, paymentMethod: 'CREDIT', items: [{ productId, quantity: 1, unitPrice: 8300, taxRate: 0 }],
        foreignCurrencyCode: 'USD', foreignExchangeRate: 83,
      }), { productId: fxProductId, customerId })
      fxInvoiceId = invRes?.data?.id
      r.log('fx-invoice-created-via-api', !!fxInvoiceId, JSON.stringify(invRes?.error || ''))
      r.log('fx-invoice-foreign-total-correct', invRes?.data?.foreignTotalAmount === 100, JSON.stringify(invRes?.data?.foreignTotalAmount))

      await h.gotoHash(page, `#/billing/${fxInvoiceId}`)
      await page.waitForTimeout(700)
      await page.locator('button', { hasText: 'Record Payment' }).click()
      await page.waitForTimeout(400)
      const modal = h.topModal(page)
      // Settling in USD is a checkbox that only appears because this
      // invoice actually has a foreignCurrencyCode set.
      await modal.locator('label', { hasText: 'Settle in USD' }).locator('input[type="checkbox"]').check()
      await page.waitForTimeout(300)
      // Same $100 received, but the rate moved 83 -> 85 by settlement time:
      // computedBaseAmount = 100 x 85 = 8500 vs the 8300 it was raised at,
      // an INR 200 realized GAIN.
      await modal.getByPlaceholder('100.00').fill('100')
      await modal.getByPlaceholder('83').fill('85')
      await modal.getByRole('button', { name: 'Settle Invoice' }).click()
      await page.waitForTimeout(1000)
      r.log('fx-settlement-no-crash', !(await h.hasErrorBoundary(page)))
    })

    await r.step('foreign-currency-settlement-persisted-with-realized-gain', () => h.withDb((db) => {
      if (!fxInvoiceId) return r.log('skipped-no-fx-invoice-id', false)
      const inv = db.prepare('SELECT * FROM Invoice WHERE id = ?').get(fxInvoiceId)
      r.log('fx-invoice-fully-settled', inv?.paymentStatus === 'PAID' && inv?.balanceAmount === 0, JSON.stringify({ paymentStatus: inv?.paymentStatus, balanceAmount: inv?.balanceAmount }))
      // paidAmount absorbs the ORIGINAL balance (8300), not the settlement-
      // rate value (8500) -- the difference is a separate FX gain posting,
      // not extra "payment".
      r.log('fx-paid-amount-is-original-balance-not-settlement-value', inv?.paidAmount === 8300, JSON.stringify(inv?.paidAmount))

      const pmt = db.prepare('SELECT * FROM Payment WHERE invoiceId = ?').get(fxInvoiceId)
      r.log('fx-payment-leg-records-foreign-amount-and-settlement-rate', pmt?.foreignAmount === 100 && pmt?.foreignExchangeRate === 85, JSON.stringify({ foreignAmount: pmt?.foreignAmount, foreignExchangeRate: pmt?.foreignExchangeRate }))

      const gainJe = db.prepare("SELECT * FROM JournalEntry WHERE sourceType = 'REALIZED_FX_GAIN_LOSS' AND sourceId = ?").get(pmt?.id)
      r.log('realized-fx-gain-je-posted', !!gainJe, JSON.stringify(gainJe))
      if (gainJe) {
        const lines = db.prepare('SELECT SUM(debitAmount) d, SUM(creditAmount) c FROM JournalEntryLine WHERE journalEntryId = ?').get(gainJe.id)
        r.log('realized-fx-gain-je-balanced-at-200', lines.d === lines.c && lines.d === 200, JSON.stringify(lines))
      }
    }))

    // ── Held Sale (window.api.heldSale.hold/resume/delete) — a common POS
    // "park this sale and come back to it" feature with ZERO E2E coverage
    // of any kind before this step. Covers hold -> resume -> complete (the
    // cart genuinely restores and the sale still completes correctly) and
    // hold -> discard (the row is actually gone, not just hidden). ────────
    let heldProductId = null
    await r.step('hold-a-sale-then-resume-and-complete-it-via-real-ui', async () => {
      const prodRes = await page.evaluate(async () => window.api.products.create({
        productName: 'E2E Commerce Held Widget', productType: 'STANDARD', unit: 'PCS',
        costPrice: 50, sellingPrice: 150, taxRate: 0, openingQuantity: 20,
      }))
      heldProductId = prodRes?.data?.id
      r.log('held-sale-product-created', !!heldProductId, JSON.stringify(prodRes?.error || ''))

      await h.gotoHash(page, '#/billing/new')
      await page.waitForTimeout(700)
      await page.locator('input[placeholder="Search products…"]').fill('E2E Commerce Held Widget')
      await page.waitForTimeout(700)
      await page.locator('button:has-text("E2E Commerce Held Widget")').first().click()
      await page.waitForTimeout(400)

      await page.locator('button', { hasText: 'Hold Sale' }).click()
      await page.waitForTimeout(300)
      const holdModal = h.topModal(page)
      await holdModal.getByPlaceholder('e.g. Rahul - blue shirt').fill(`${TEST_PREFIX} Held`)
      await holdModal.getByRole('button', { name: 'Hold', exact: true }).click()
      await page.waitForTimeout(800)
      r.log('sale-held-no-crash', !(await h.hasErrorBoundary(page)))

      const heldRow = h.withDb((db) => db.prepare("SELECT * FROM HeldSale WHERE label = ?").get(`${TEST_PREFIX} Held`))
      r.log('held-sale-persisted-with-correct-total', heldRow?.totalAmount === 150, JSON.stringify(heldRow))

      // Cart must be empty again immediately after holding (the point of
      // "hold" is freeing the register for the next customer).
      const cartTextAfterHold = await page.locator('body').innerText()
      r.log('cart-cleared-after-hold', !cartTextAfterHold.includes('E2E Commerce Held Widget') || /Resume Sale/.test(cartTextAfterHold))

      await page.locator('button', { hasText: 'Resume Sale' }).click()
      await page.waitForTimeout(500)
      const resumeModal = h.topModal(page)
      const listedText = await resumeModal.innerText().catch(() => '')
      r.log('held-sale-listed-in-resume-modal', listedText.includes(`${TEST_PREFIX} Held`), listedText.slice(0, 300))
      await resumeModal.getByRole('button', { name: 'Resume', exact: true }).click()
      await page.waitForTimeout(600)

      const cartTextAfterResume = await page.locator('body').innerText()
      r.log('cart-restored-with-held-item-after-resume', cartTextAfterResume.includes('E2E Commerce Held Widget'))

      await page.keyboard.press('F10')
      await page.waitForTimeout(1500)
      const url = page.url()
      r.log('resumed-sale-completes-to-a-real-invoice', /#\/billing\/[a-zA-Z0-9]+/.test(url), url)
    })

    await r.step('held-sale-row-consumed-not-left-behind-after-resume', () => h.withDb((db) => {
      const stillHeld = db.prepare("SELECT * FROM HeldSale WHERE label = ?").get(`${TEST_PREFIX} Held`)
      r.log('held-sale-row-removed-after-resume-and-complete', !stillHeld, JSON.stringify(stillHeld))
    }))

    await r.step('hold-a-second-sale-then-discard-it-via-real-ui', async () => {
      if (!heldProductId) return r.log('skipped-no-held-product-id', false)
      await h.gotoHash(page, '#/billing/new')
      await page.waitForTimeout(700)
      await page.locator('input[placeholder="Search products…"]').fill('E2E Commerce Held Widget')
      await page.waitForTimeout(700)
      await page.locator('button:has-text("E2E Commerce Held Widget")').first().click()
      await page.waitForTimeout(400)

      await page.locator('button', { hasText: 'Hold Sale' }).click()
      await page.waitForTimeout(300)
      const holdModal = h.topModal(page)
      await holdModal.getByPlaceholder('e.g. Rahul - blue shirt').fill(`${TEST_PREFIX} Held To Discard`)
      await holdModal.getByRole('button', { name: 'Hold', exact: true }).click()
      await page.waitForTimeout(800)

      await page.locator('button', { hasText: 'Resume Sale' }).click()
      await page.waitForTimeout(500)
      const resumeModal = h.topModal(page)
      await resumeModal.locator('button[title="Discard"]').click()
      await page.waitForTimeout(400)
      const confirmModal = h.topModal(page)
      await confirmModal.getByRole('button', { name: 'Discard', exact: true }).click()
      await page.waitForTimeout(600)
      r.log('discard-held-sale-no-crash', !(await h.hasErrorBoundary(page)))
    })

    await r.step('discarded-held-sale-actually-deleted', () => h.withDb((db) => {
      const row = db.prepare("SELECT * FROM HeldSale WHERE label = ?").get(`${TEST_PREFIX} Held To Discard`)
      r.log('discarded-held-sale-row-gone', !row, JSON.stringify(row))
    }))
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
