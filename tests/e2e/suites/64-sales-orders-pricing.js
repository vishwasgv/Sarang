/**
 * Suite 64 — Phase 63 Sales-Side Completion & Pricing Infrastructure: live
 * UI verification for every new screen built this phase, not just the
 * backend IPC layer (already covered by unit tests). Real click-through:
 * fill a real form, submit, confirm the row lands in the real dev DB —
 * not just "the screen didn't crash." Also exercises the real, previously
 * unshippable Price List → Customer assignment fix found while writing
 * this suite (see the roadmap memory note dated 2026-08-12 for the gap).
 */
const h = require('../harness')
const crypto = require('crypto')

const TEST_PREFIX = 'E2E Sales63'
const suffix = Date.now()
function newId() { return crypto.randomUUID() }

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()

  const customerId = newId()
  const productId = newId()
  const inventoryId = newId()
  let categoryId = null
  let createdCategory = false
  const customerName = `${TEST_PREFIX} Customer ${suffix}`
  const productName = `${TEST_PREFIX} Widget ${suffix}`
  const priceListName = `${TEST_PREFIX} Price List ${suffix}`
  const schemeName = `${TEST_PREFIX} Scheme ${suffix}`
  const expenseName = `${TEST_PREFIX} Expense ${suffix}`
  const workflowName = `${TEST_PREFIX} Workflow ${suffix}`
  const happyHourProductId = newId()
  const outsideWindowProductId = newId()
  const happyHourProductName = `${TEST_PREFIX} Drink ${suffix}`
  const outsideWindowProductName = `${TEST_PREFIX} Midnight Item ${suffix}`
  const happyHourSchemeName = `${schemeName} Happy Hour`
  const outsideWindowSchemeName = `${schemeName} Outside Window`
  let happyHourSchemeId = null
  let outsideWindowSchemeId = null

  let page
  try {
    page = await h.getMainWindow(app)
    await h.login(page)

    // ── Setup: seed a customer + product (not the feature under test) ─────
    await r.step('seed-test-customer-and-product', () => h.withDb((db) => {
      db.prepare(`INSERT INTO Customer (id, customerName, phone, isActive, updatedAt) VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)`)
        .run(customerId, customerName, `9${String(suffix).slice(-9)}`)
      db.prepare(`INSERT INTO Product (id, productName, productType, sellingPrice, costPrice, taxRate, isActive, updatedAt)
        VALUES (?, ?, 'STANDARD', 100, 50, 18, 1, CURRENT_TIMESTAMP)`).run(productId, productName)
      db.prepare(`INSERT INTO Inventory (id, productId, quantity, updatedAt) VALUES (?, ?, ?, CURRENT_TIMESTAMP)`).run(inventoryId, productId, 100)
      const cat = db.prepare('SELECT id FROM ExpenseCategory LIMIT 1').get()
      if (cat) { categoryId = cat.id } else {
        categoryId = newId(); createdCategory = true
        db.prepare('INSERT INTO ExpenseCategory (id, categoryName) VALUES (?, ?)').run(categoryId, `${TEST_PREFIX} Category ${suffix}`)
      }
    }))
    r.log('seed-complete', !!categoryId, `customerId=${customerId} productId=${productId} categoryId=${categoryId}`)

    // ── Breadth: every new screen loads without crashing ──────────────────
    const routes = [
      ['#/sales-orders', 'sales-orders'],
      ['#/pricing/price-lists', 'price-lists'],
      ['#/pricing/schemes', 'pricing-schemes'],
      ['#/recurring-profiles', 'recurring-profiles'],
      ['#/approval-workflows', 'approval-workflows'],
    ]
    for (const [route, label] of routes) {
      await r.step(`visit-${label}`, async () => {
        await h.gotoHash(page, route)
        await page.waitForTimeout(700)
        const crashed = await h.hasErrorBoundary(page)
        r.log(`${label}-loads-no-crash`, !crashed, crashed ? 'ErrorBoundary tripped' : '')
      })
    }

    // ── Sales Orders: real UI creation, then confirm ────────────────────────
    let soId = null
    await r.step('create-sales-order-via-ui', async () => {
      await h.gotoHash(page, '#/sales-orders')
      await page.waitForTimeout(600)
      await page.locator('button', { hasText: 'New Sales Order' }).click()
      await page.waitForTimeout(400)
      // Customer option label includes its auto-generated code, which this
      // suite doesn't know in advance — match by visible text substring instead.
      const customerSelect = page.getByLabel('Customer')
      const optValue = await customerSelect.locator('option', { hasText: customerName }).first().getAttribute('value')
      if (optValue) await customerSelect.selectOption(optValue)
      const searchBox = page.locator('input[placeholder="Search product…"]').first()
      await searchBox.fill(productName)
      await page.waitForTimeout(500)
      await page.locator('button', { hasText: productName }).first().click()
      await page.waitForTimeout(300)
      const qtyInput = page.locator('input[type="number"][placeholder="Qty"]').first()
      if (await qtyInput.count()) await qtyInput.fill('5')
      await page.locator('button', { hasText: 'New Sales Order' }).last().click()
      await page.waitForTimeout(900)
      r.log('sales-order-modal-closed-no-crash', !(await h.hasErrorBoundary(page)))
    })

    await r.step('sales-order-persisted-with-correct-customer-and-total', () => h.withDb((db) => {
      const row = db.prepare('SELECT * FROM SalesOrder WHERE customerId = ? ORDER BY createdAt DESC LIMIT 1').get(customerId)
      r.log('sales-order-row-exists', !!row, JSON.stringify(row))
      if (row) {
        soId = row.id
        r.log('sales-order-status-draft', row.status === 'DRAFT', `status=${row.status}`)
        const items = db.prepare('SELECT * FROM SalesOrderItem WHERE salesOrderId = ?').all(row.id)
        r.log('sales-order-has-one-item-qty-5', items.length === 1 && items[0].quantity === 5, JSON.stringify(items))
      }
    }))

    await r.step('confirm-sales-order-via-ui', async () => {
      if (!soId) { r.log('skipped-no-so-id', false); return }
      await h.gotoHash(page, `#/sales-orders/${soId}`)
      await page.waitForTimeout(700)
      await page.locator('button', { hasText: 'Confirm Order' }).click()
      await page.waitForTimeout(800)
      r.log('confirm-no-crash', !(await h.hasErrorBoundary(page)))
    })

    await r.step('sales-order-confirmed-no-workflow-active-yet', () => h.withDb((db) => {
      if (!soId) { r.log('skipped-no-so-id', false); return }
      const row = db.prepare('SELECT status FROM SalesOrder WHERE id = ?').get(soId)
      r.log('sales-order-status-confirmed', row?.status === 'CONFIRMED', `status=${row?.status}`)
    }))

    // ── Price Lists: create, add a tier, THEN assign to the customer ───────
    // (the last part is the real gap this suite's own writing uncovered —
    // Customer.priceListId was fully backend-wired but had zero UI to set
    // it until this phase's CustomerFormModal/SupplierFormModal fix).
    let priceListId = null
    await r.step('create-price-list-via-ui', async () => {
      await h.gotoHash(page, '#/pricing/price-lists')
      await page.waitForTimeout(600)
      await page.locator('button', { hasText: 'New Price List' }).click()
      await page.waitForTimeout(400)
      await page.getByLabel('Name').fill(priceListName)
      await page.locator('button', { hasText: 'Create' }).click()
      await page.waitForTimeout(800)
      r.log('price-list-modal-closed-no-crash', !(await h.hasErrorBoundary(page)))
    })

    await r.step('price-list-persisted', () => h.withDb((db) => {
      const row = db.prepare('SELECT * FROM PriceList WHERE name = ?').get(priceListName)
      r.log('price-list-row-exists', !!row, JSON.stringify(row))
      if (row) { priceListId = row.id; r.log('price-list-applies-to-customer', row.appliesTo === 'CUSTOMER') }
    }))

    await r.step('add-tier-via-manage-tiers-ui', async () => {
      if (!priceListId) { r.log('skipped-no-price-list-id', false); return }
      const row = page.locator('tr', { hasText: priceListName })
      await row.locator('button', { hasText: 'Manage Tiers' }).click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)
      // A fresh Price List starts with zero tier rows ("No price tiers yet")
      // — Add Tier must be clicked first to render the row's own inputs.
      await modal.locator('button', { hasText: 'Add Tier' }).click()
      await page.waitForTimeout(300)
      const tierSearch = modal.locator('input[type="text"], input:not([type])').first()
      await tierSearch.fill(productName)
      await page.waitForTimeout(500)
      await modal.locator('button', { hasText: productName }).first().click()
      await page.waitForTimeout(200)
      const numberInputs = modal.locator('input[type="number"]')
      await numberInputs.nth(0).fill('1') // minQuantity
      await numberInputs.nth(1).fill('80') // unitPrice
      await modal.locator('button', { hasText: 'Save' }).click()
      await page.waitForTimeout(800)
      r.log('tiers-modal-closed-no-crash', !(await h.hasErrorBoundary(page)))
    })

    await r.step('price-list-tier-persisted', () => h.withDb((db) => {
      if (!priceListId) { r.log('skipped-no-price-list-id', false); return }
      const row = db.prepare('SELECT * FROM PriceListItem WHERE priceListId = ? AND productId = ?').get(priceListId, productId)
      r.log('price-list-tier-row-exists', !!row, JSON.stringify(row))
      if (row) r.log('price-list-tier-price-correct', row.unitPrice === 80, `unitPrice=${row.unitPrice}`)
    }))

    // Real gap regression guard: assign the price list to the customer via
    // the Customer edit form (the fix built this session) and verify it
    // actually persists — this is the one screen that had zero UI for this
    // before the fix, confirmed by grepping the renderer for `priceListId`
    // outside PriceListsScreen.tsx itself and finding zero hits.
    await r.step('assign-price-list-to-customer-via-customer-form', async () => {
      if (!priceListId) { r.log('skipped-no-price-list-id', false); return }
      await h.gotoHash(page, '#/customers')
      await page.waitForTimeout(600)
      const searchBox = page.locator('input[type="text"]').first()
      await searchBox.fill(customerName).catch(() => {})
      await page.waitForTimeout(500)
      // The row's own inline Edit icon button (title="Edit", no visible
      // text) opens CustomerFormModal directly — no need to navigate into
      // the customer detail page at all.
      const customerRow = page.locator('tr', { hasText: customerName }).first()
      await customerRow.getByTitle('Edit').click()
      await page.waitForTimeout(400)
      const priceListSelect = page.getByLabel('Price List')
      if (await priceListSelect.count()) {
        const optValue = await priceListSelect.locator('option', { hasText: priceListName }).first().getAttribute('value')
        if (optValue) await priceListSelect.selectOption(optValue)
        await page.locator('button', { hasText: 'Save Changes' }).click()
        await page.waitForTimeout(800)
      }
      r.log('customer-price-list-assign-no-crash', !(await h.hasErrorBoundary(page)))
    })

    await r.step('customer-price-list-assignment-persisted', () => h.withDb((db) => {
      if (!priceListId) { r.log('skipped-no-price-list-id', false); return }
      const row = db.prepare('SELECT priceListId FROM Customer WHERE id = ?').get(customerId)
      r.log('customer-priceListId-set-correctly', row?.priceListId === priceListId, `priceListId=${row?.priceListId}, expected=${priceListId}`)
    }))

    // ── Pricing Schemes: BUY_X_GET_Y_FREE, then verify the live cart ───────
    // suggestion banner + Apply flow on the real Billing screen.
    let schemeId = null
    await r.step('create-pricing-scheme-via-ui', async () => {
      await h.gotoHash(page, '#/pricing/schemes')
      await page.waitForTimeout(600)
      await page.locator('button', { hasText: 'New Scheme' }).click()
      await page.waitForTimeout(400)
      const modal = h.topModal(page)
      await modal.getByLabel('Name').fill(schemeName)
      // Scope defaults to "One Product" already — just pick the test
      // product from the plain dropdown (not a search box, unlike the
      // Sales Order / Price List tier pickers elsewhere in this phase).
      const scopeSelect = modal.getByLabel('Product / Category')
      const scopeOptValue = await scopeSelect.locator('option', { hasText: productName }).first().getAttribute('value')
      if (scopeOptValue) await scopeSelect.selectOption(scopeOptValue)
      // Defaults: BUY_X_GET_Y_FREE, buyQuantity=1, freeQuantity=1 — set
      // buyQuantity to 2 so the billing-cart test below (qty 2) triggers
      // exactly one free unit, a clean, unambiguous assertion.
      await modal.getByLabel('Buy Quantity').fill('2')
      await modal.locator('button', { hasText: 'Create' }).click()
      await page.waitForTimeout(800)
      r.log('scheme-modal-closed-no-crash', !(await h.hasErrorBoundary(page)))
    })

    await r.step('pricing-scheme-persisted', () => h.withDb((db) => {
      const row = db.prepare('SELECT * FROM PricingScheme WHERE name = ?').get(schemeName)
      r.log('pricing-scheme-row-exists', !!row, JSON.stringify(row))
      if (row) {
        schemeId = row.id
        r.log('pricing-scheme-buy-2-free-1', row.buyQuantity === 2 && row.freeQuantity === 1, `buy=${row.buyQuantity} free=${row.freeQuantity}`)
      }
    }))

    await r.step('billing-cart-shows-and-applies-scheme-suggestion', async () => {
      if (!schemeId) { r.log('skipped-no-scheme-id', false); return }
      await h.gotoHash(page, '#/billing/new')
      await page.waitForTimeout(700)
      const searchInput = page.locator('input[placeholder="Search products…"]')
      await searchInput.fill(productName)
      await page.waitForTimeout(600)
      await page.locator('button', { hasText: productName }).first().click()
      await page.waitForTimeout(300)
      const qtyInput = page.locator('input[type="number"][min="0.001"]').first()
      await qtyInput.fill('2')
      await page.waitForTimeout(1000) // evaluateCart is debounced
      const bodyText = await page.locator('body').innerText().catch(() => '')
      r.log('scheme-suggestion-banner-visible', bodyText.includes(productName) && /free/i.test(bodyText))
      const applyBtn = page.locator('button', { hasText: 'Apply' }).first()
      const applyVisible = await applyBtn.count() > 0
      r.log('apply-button-visible', applyVisible)
      if (applyVisible) {
        await applyBtn.click()
        await page.waitForTimeout(500)
        const afterText = await page.locator('body').innerText().catch(() => '')
        r.log('free-line-added-to-cart', /free/i.test(afterText))
      }
    })

    // ── Pricing Schemes: FLAT_PERCENT_OFF happy-hour window, live against ──
    // the real wall clock (evaluateCart's `now` is server-side only, not
    // exposed over IPC, so this genuinely proves the time-gate — not a
    // mocked clock) — Phase 67 21.x (Restaurant happy-hour pricing).
    await r.step('seed-happyhour-test-products', () => h.withDb((db) => {
      for (const [pid, pname] of [[happyHourProductId, happyHourProductName], [outsideWindowProductId, outsideWindowProductName]]) {
        db.prepare(`INSERT INTO Product (id, productName, productType, sellingPrice, costPrice, taxRate, isActive, updatedAt)
          VALUES (?, ?, 'STANDARD', 100, 50, 18, 1, CURRENT_TIMESTAMP)`).run(pid, pname)
        db.prepare(`INSERT INTO Inventory (id, productId, quantity, updatedAt) VALUES (?, ?, ?, CURRENT_TIMESTAMP)`).run(newId(), pid, 100)
      }
    }))

    function fmtMinutes(m) { return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}` }

    async function createFlatPercentScheme({ name, productName, discountPercent, startMinutes, endMinutes }) {
      await h.gotoHash(page, '#/pricing/schemes')
      await page.waitForTimeout(600)
      await page.locator('button', { hasText: 'New Scheme' }).click()
      await page.waitForTimeout(400)
      const modal = h.topModal(page)
      await modal.getByLabel('Name').fill(name)
      await modal.getByLabel('Offer Type').selectOption('FLAT_PERCENT_OFF')
      const scopeSelect = modal.getByLabel('Product / Category')
      const scopeOptValue = await scopeSelect.locator('option', { hasText: productName }).first().getAttribute('value')
      if (scopeOptValue) await scopeSelect.selectOption(scopeOptValue)
      await modal.getByLabel('Discount %').fill(String(discountPercent))
      await modal.getByLabel('Start Time').fill(fmtMinutes(startMinutes))
      await modal.getByLabel('End Time').fill(fmtMinutes(endMinutes))
      await modal.locator('button', { hasText: 'Create' }).click()
      await page.waitForTimeout(800)
      return !(await h.hasErrorBoundary(page))
    }

    await r.step('create-happyhour-scheme-window-spans-right-now-via-ui', async () => {
      const now = new Date()
      const nowMinutes = now.getHours() * 60 + now.getMinutes()
      const winStart = Math.max(0, nowMinutes - 30)
      const winEnd = Math.min(1439, nowMinutes + 30)
      const ok = await createFlatPercentScheme({ name: happyHourSchemeName, productName: happyHourProductName, discountPercent: 20, startMinutes: winStart, endMinutes: winEnd })
      r.log('happyhour-scheme-modal-closed-no-crash', ok)
    })

    await r.step('create-outsidewindow-scheme-window-is-just-after-midnight-via-ui', async () => {
      // 00:01-00:02 — a window virtually guaranteed not to contain the real
      // "now" whenever this suite actually runs, giving a genuine (not
      // fabricated) negative case for the same live time-gate.
      const ok = await createFlatPercentScheme({ name: outsideWindowSchemeName, productName: outsideWindowProductName, discountPercent: 15, startMinutes: 1, endMinutes: 2 })
      r.log('outsidewindow-scheme-modal-closed-no-crash', ok)
    })

    await r.step('happyhour-schemes-persisted-correctly', () => h.withDb((db) => {
      const hh = db.prepare('SELECT * FROM PricingScheme WHERE name = ?').get(happyHourSchemeName)
      const ow = db.prepare('SELECT * FROM PricingScheme WHERE name = ?').get(outsideWindowSchemeName)
      r.log('happyhour-scheme-row-exists-with-flat-percent-and-window', !!hh && hh.ruleType === 'FLAT_PERCENT_OFF' && hh.flatDiscountPercent === 20 && hh.startTimeMinutes !== null, JSON.stringify(hh))
      r.log('outsidewindow-scheme-row-exists', !!ow && ow.flatDiscountPercent === 15, JSON.stringify(ow))
      if (hh) happyHourSchemeId = hh.id
      if (ow) outsideWindowSchemeId = ow.id
    }))

    await r.step('happyhour-discount-applies-live-right-now-via-real-api', async () => {
      if (!happyHourSchemeId) { r.log('skipped-no-scheme-id', false); return }
      const res = await page.evaluate((pid) => window.api.pricingSchemes.evaluateCart({ items: [{ productId: pid, quantity: 1 }] }), happyHourProductId)
      const discounts = res?.data?.discounts || []
      r.log('happyhour-20-percent-discount-suggested-right-now', discounts.some((d) => d.discountPercent === 20 && d.productId === happyHourProductId), JSON.stringify(discounts))
    })

    await r.step('outsidewindow-discount-does-not-apply-right-now-via-real-api', async () => {
      if (!outsideWindowSchemeId) { r.log('skipped-no-scheme-id', false); return }
      const res = await page.evaluate((pid) => window.api.pricingSchemes.evaluateCart({ items: [{ productId: pid, quantity: 1 }] }), outsideWindowProductId)
      const discounts = res?.data?.discounts || []
      r.log('outsidewindow-discount-correctly-absent-right-now', discounts.length === 0, JSON.stringify(discounts))
    })

    // ── Recurring Profiles: EXPENSE type, then pause/resume ─────────────────
    let profileId = null
    await r.step('create-recurring-profile-via-ui', async () => {
      await h.gotoHash(page, '#/recurring-profiles')
      await page.waitForTimeout(600)
      await page.locator('button', { hasText: 'New Recurring Profile' }).click()
      await page.waitForTimeout(400)
      const modal = h.topModal(page)
      await modal.locator('label', { hasText: 'Expense' }).click()
      await page.waitForTimeout(300)
      await modal.getByLabel('Category').selectOption({ index: 1 })
      await modal.getByLabel('Expense Name').fill(expenseName)
      await modal.getByLabel('Amount').fill('5000')
      await modal.locator('button', { hasText: 'Create' }).click()
      await page.waitForTimeout(800)
      r.log('recurring-profile-modal-closed-no-crash', !(await h.hasErrorBoundary(page)))
    })

    await r.step('recurring-profile-persisted', () => h.withDb((db) => {
      const row = db.prepare("SELECT * FROM RecurringProfile WHERE documentType = 'EXPENSE' AND payloadJson LIKE ?").get(`%${expenseName}%`)
      r.log('recurring-profile-row-exists', !!row, JSON.stringify(row))
      if (row) { profileId = row.id; r.log('recurring-profile-active-by-default', row.active === 1) }
    }))

    await r.step('pause-and-resume-recurring-profile-via-ui', async () => {
      if (!profileId) { r.log('skipped-no-profile-id', false); return }
      await h.gotoHash(page, '#/recurring-profiles')
      await page.waitForTimeout(600)
      // The table has no column showing the expense name itself (only
      // type/counterparty/schedule) — but the list is ordered newest-first
      // (`orderBy: { createdAt: 'desc' }`), so the just-created profile is
      // reliably the first row.
      const row = page.locator('table tbody tr').first()
      await row.locator('button', { hasText: 'Pause' }).click()
      await page.waitForTimeout(600)
      const pausedNow = h.withDb((db) => db.prepare('SELECT active FROM RecurringProfile WHERE id = ?').get(profileId))
      r.log('recurring-profile-paused', pausedNow?.active === 0, `active=${pausedNow?.active}`)
      await row.locator('button', { hasText: 'Resume' }).click()
      await page.waitForTimeout(600)
      const resumedNow = h.withDb((db) => db.prepare('SELECT active FROM RecurringProfile WHERE id = ?').get(profileId))
      r.log('recurring-profile-resumed', resumedNow?.active === 1, `active=${resumedNow?.active}`)
    })

    // ── Approval Workflows: create with admin as a USER-approver step, ─────
    // low threshold, then verify a NEW Sales Order actually pauses for
    // approval and the ApprovalPanel's own Approve button completes it.
    let workflowId = null
    const adminUser = h.withDb((db) => db.prepare("SELECT id, fullName FROM User WHERE username = 'admin'").get())
    await r.step('create-approval-workflow-via-ui', async () => {
      await h.gotoHash(page, '#/approval-workflows')
      await page.waitForTimeout(600)
      await page.locator('button', { hasText: 'New Workflow' }).click()
      await page.waitForTimeout(400)
      const modal = h.topModal(page)
      await modal.getByLabel('Name').fill(workflowName)
      // Default step approverType is ROLE — switch to "By Person" so the
      // logged-in E2E admin user can actually approve it later regardless
      // of which role they hold.
      await modal.locator('button', { hasText: 'By Person' }).click()
      await page.waitForTimeout(200)
      // The modal's first <select> is the "Applies To" document-type picker
      // (rendered above the steps section) — the step's own raw approver
      // <select> is the SECOND one in DOM order, not the first.
      const approverSelect = modal.locator('select').nth(1)
      if (adminUser?.id) await approverSelect.selectOption(adminUser.id)
      const thresholdInput = modal.locator('input[type="number"]').first()
      await thresholdInput.fill('1')
      await modal.locator('button', { hasText: 'Create' }).click()
      await page.waitForTimeout(800)
      r.log('workflow-modal-closed-no-crash', !(await h.hasErrorBoundary(page)))
    })

    await r.step('approval-workflow-persisted-active-with-one-step', () => h.withDb((db) => {
      const row = db.prepare('SELECT * FROM ApprovalWorkflow WHERE name = ?').get(workflowName)
      r.log('approval-workflow-row-exists', !!row, JSON.stringify(row))
      if (row) {
        workflowId = row.id
        r.log('approval-workflow-active-and-sales-order-scoped', row.isActive === 1 && row.documentType === 'SALES_ORDER')
        const steps = db.prepare('SELECT * FROM ApprovalStep WHERE workflowId = ?').all(row.id)
        r.log('approval-workflow-has-one-step-admin-approver', steps.length === 1 && steps[0].approverUserId === adminUser?.id, JSON.stringify(steps))
      }
    }))

    let secondSoId = null
    await r.step('new-sales-order-now-requires-approval', async () => {
      if (!workflowId) { r.log('skipped-no-workflow-id', false); return }
      await h.gotoHash(page, '#/sales-orders')
      await page.waitForTimeout(600)
      await page.locator('button', { hasText: 'New Sales Order' }).click()
      await page.waitForTimeout(400)
      const customerSelect = page.getByLabel('Customer')
      const optValue = await customerSelect.locator('option', { hasText: customerName }).first().getAttribute('value')
      if (optValue) await customerSelect.selectOption(optValue)
      const searchBox = page.locator('input[placeholder="Search product…"]').first()
      await searchBox.fill(productName)
      await page.waitForTimeout(500)
      await page.locator('button', { hasText: productName }).first().click()
      await page.waitForTimeout(300)
      await page.locator('button', { hasText: 'New Sales Order' }).last().click()
      await page.waitForTimeout(900)

      const row = h.withDb((db) => db.prepare('SELECT * FROM SalesOrder WHERE customerId = ? AND id != ? ORDER BY createdAt DESC LIMIT 1').get(customerId, soId))
      if (row) secondSoId = row.id
      r.log('second-sales-order-created', !!row, JSON.stringify(row))
    })

    await r.step('confirm-second-sales-order-lands-in-pending-approval', async () => {
      if (!secondSoId) { r.log('skipped-no-second-so-id', false); return }
      await h.gotoHash(page, `#/sales-orders/${secondSoId}`)
      await page.waitForTimeout(700)
      await page.locator('button', { hasText: 'Confirm Order' }).click()
      await page.waitForTimeout(800)
      const row = h.withDb((db) => db.prepare('SELECT status FROM SalesOrder WHERE id = ?').get(secondSoId))
      r.log('second-sales-order-pending-approval', row?.status === 'PENDING_APPROVAL', `status=${row?.status}`)
    })

    await r.step('approve-via-approval-panel-completes-confirmation', async () => {
      if (!secondSoId) { r.log('skipped-no-second-so-id', false); return }
      // Real bug found while writing this suite, fixed in ApprovalPanel.tsx
      // (see its own comment): the panel only fetched its ApprovalInstance
      // once on mount, so confirming a DRAFT order — which creates the
      // instance server-side — never made the panel appear until the user
      // navigated away and back. Fixed by giving the panel a
      // `refreshSignal` (the parent so.status) so its fetch re-runs when
      // the document's own status changes, not just on mount. This
      // suite's own prior navigation (to this same URL, in the previous
      // step) is now sufficient — no more bounce-through-the-list-screen
      // workaround needed.
      const panelTitle = page.locator('*', { hasText: workflowName })
      const panelVisible = await panelTitle.first().waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false)
      r.log('approval-panel-title-visible-without-remount', panelVisible)
      const approveBtn = page.getByRole('button', { name: 'Approve', exact: true })
      const approveVisible = await approveBtn.first().waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false)
      r.log('approve-button-visible', approveVisible)
      if (approveVisible) {
        await approveBtn.first().click()
        await page.waitForTimeout(900)
      }
      const afterApprove = h.withDb((db) => db.prepare('SELECT status FROM SalesOrder WHERE id = ?').get(secondSoId))
      r.log('sales-order-still-pending-approval-immediately-after-approve', afterApprove?.status === 'PENDING_APPROVAL', `status=${afterApprove?.status}`)
      // By design (confirmSalesOrder's own "re-callable" comment):
      // approving the last step marks the ApprovalInstance itself APPROVED
      // but does not touch the SalesOrder — the same Confirm button
      // (now relabeled "Check Approval Status" while PENDING_APPROVAL)
      // must be clicked again to finish the DRAFT→CONFIRMED transition.
      const checkStatusBtn = page.locator('button', { hasText: 'Check Approval Status' })
      if (await checkStatusBtn.count()) {
        await checkStatusBtn.click()
        await page.waitForTimeout(800)
      }
      const row = h.withDb((db) => db.prepare('SELECT status FROM SalesOrder WHERE id = ?').get(secondSoId))
      r.log('second-sales-order-confirmed-after-approval', row?.status === 'CONFIRMED', `status=${row?.status}`)
    })
  } finally {
    const cleanup = h.withDb((db) => {
      let counts = { soItems: 0, sos: 0, approvalActions: 0, approvalSteps: 0, approvalInstances: 0, workflows: 0, schemes: 0, priceListItems: 0, priceLists: 0, profiles: 0, category: 0, inventory: 0, products: 0, customers: 0, happyHourSchemes: 0, happyHourProducts: 0 }
      const sos = db.prepare('SELECT id FROM SalesOrder WHERE customerId = ?').all(customerId)
      for (const so of sos) {
        counts.soItems += db.prepare('DELETE FROM SalesOrderItem WHERE salesOrderId = ?').run(so.id).changes
        const instances = db.prepare('SELECT id FROM ApprovalInstance WHERE salesOrderId = ?').all(so.id)
        for (const inst of instances) {
          counts.approvalActions += db.prepare('DELETE FROM ApprovalAction WHERE instanceId = ?').run(inst.id).changes
          counts.approvalInstances += db.prepare('DELETE FROM ApprovalInstance WHERE id = ?').run(inst.id).changes
        }
        counts.sos += db.prepare('DELETE FROM SalesOrder WHERE id = ?').run(so.id).changes
      }
      const wf = db.prepare('SELECT id FROM ApprovalWorkflow WHERE name = ?').get(workflowName)
      if (wf) {
        counts.approvalSteps += db.prepare('DELETE FROM ApprovalStep WHERE workflowId = ?').run(wf.id).changes
        counts.workflows += db.prepare('DELETE FROM ApprovalWorkflow WHERE id = ?').run(wf.id).changes
      }
      const scheme = db.prepare('SELECT id FROM PricingScheme WHERE name = ?').get(schemeName)
      if (scheme) counts.schemes += db.prepare('DELETE FROM PricingScheme WHERE id = ?').run(scheme.id).changes
      for (const name of [happyHourSchemeName, outsideWindowSchemeName]) {
        const s = db.prepare('SELECT id FROM PricingScheme WHERE name = ?').get(name)
        if (s) counts.happyHourSchemes += db.prepare('DELETE FROM PricingScheme WHERE id = ?').run(s.id).changes
      }
      for (const pid of [happyHourProductId, outsideWindowProductId]) {
        db.prepare('DELETE FROM Inventory WHERE productId = ?').run(pid)
        try { counts.happyHourProducts += db.prepare('DELETE FROM Product WHERE id = ?').run(pid).changes } catch { db.prepare('UPDATE Product SET isActive = 0 WHERE id = ?').run(pid) }
      }
      const pl = db.prepare('SELECT id FROM PriceList WHERE name = ?').get(priceListName)
      if (pl) {
        counts.priceListItems += db.prepare('DELETE FROM PriceListItem WHERE priceListId = ?').run(pl.id).changes
        counts.priceLists += db.prepare('DELETE FROM PriceList WHERE id = ?').run(pl.id).changes
      }
      const profile = db.prepare("SELECT id FROM RecurringProfile WHERE payloadJson LIKE ?").get(`%${expenseName}%`)
      if (profile) counts.profiles += db.prepare('DELETE FROM RecurringProfile WHERE id = ?').run(profile.id).changes
      if (createdCategory) counts.category += db.prepare('DELETE FROM ExpenseCategory WHERE id = ?').run(categoryId).changes
      counts.inventory += db.prepare('DELETE FROM Inventory WHERE productId = ?').run(productId).changes
      try { counts.products += db.prepare('DELETE FROM Product WHERE id = ?').run(productId).changes } catch { db.prepare('UPDATE Product SET isActive = 0 WHERE id = ?').run(productId) }
      db.prepare('UPDATE Customer SET priceListId = NULL WHERE id = ?').run(customerId)
      try { counts.customers += db.prepare('DELETE FROM Customer WHERE id = ?').run(customerId).changes } catch { db.prepare('UPDATE Customer SET isActive = 0 WHERE id = ?').run(customerId) }
      return counts
    })
    console.log('extra cleanup (Phase 63 tables):', JSON.stringify(cleanup))
    await h.closeApp(app)
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nSALES ORDERS & PRICING (PHASE 63): ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
