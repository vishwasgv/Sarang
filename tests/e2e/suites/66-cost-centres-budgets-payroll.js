/**
 * Suite 66 — Phase 65 Cost Centres, Budgets & Payroll Compliance: live UI
 * verification for the highest-risk new integrations (real click-through,
 * not just "the screen didn't crash"): cost-centre tagging flowing into the
 * treemap report, a Budget's own inline actual/variance reacting to a real
 * tagged expense, the statutory-suggestion button pre-filling deductions
 * WITHOUT auto-saving (the one behavior this whole feature's design hinges
 * on), and the Cash-Flow Projection / Payment Performance reports reading
 * real data. Setup (products/customers/suppliers) goes through the real IPC
 * layer directly (window.api.*) — same convention suite 65 established — so
 * only the feature under test is driven via real UI clicks.
 */
const h = require('../harness')
const crypto = require('crypto')

const TEST_PREFIX = 'E2E Phase65'
const suffix = Date.now()

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()

  const downtownName = `${TEST_PREFIX} Downtown ${suffix}`
  const uptownName = `${TEST_PREFIX} Uptown ${suffix}`
  const customerAName = `${TEST_PREFIX} Cust A ${suffix}`
  const customerBName = `${TEST_PREFIX} Cust B ${suffix}`
  const productName = `${TEST_PREFIX} Widget ${suffix}`
  const employeeName = `${TEST_PREFIX} Employee ${suffix}`

  let page
  let downtownId = null, uptownId = null
  let customerAId = null, customerBId = null
  let productId = null
  let employeeId = null
  let invoiceAId = null // unpaid, future due date — cash-flow projection
  let invoiceBId = null // paid same-day — payment performance
  let expenseId = null
  let categoryId = null
  let salaryPaymentId = null
  let recurringProfileId = null
  let ccBillSupplierId = null, ccBillId = null
  try {
    page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('seed-cost-centres-customers-product', async () => {
      const cc1 = await page.evaluate(async (n) => window.api.costCentres.create({ name: n }), downtownName)
      const cc2 = await page.evaluate(async (n) => window.api.costCentres.create({ name: n }), uptownName)
      downtownId = cc1?.data?.id
      uptownId = cc2?.data?.id
      const custA = await page.evaluate(async (n) => window.api.customers.create({ customerName: n, phone: `9${String(Date.now()).slice(-9)}` }), customerAName)
      const custB = await page.evaluate(async (n) => window.api.customers.create({ customerName: n, phone: `8${String(Date.now()).slice(-9)}` }), customerBName)
      customerAId = custA?.data?.id
      customerBId = custB?.data?.id
      const prod = await page.evaluate(async (n) => window.api.products.create({
        productName: n, productType: 'STANDARD', unit: 'PCS', costPrice: 50, sellingPrice: 100, taxRate: 18, openingQuantity: 100
      }), productName)
      productId = prod?.data?.id
      r.log('seed-ok', !!(downtownId && uptownId && customerAId && customerBId && productId),
        JSON.stringify({ cc1: cc1?.error, cc2: cc2?.error, custA: custA?.error, custB: custB?.error, prod: prod?.error }))
    })

    // ── Phase 65 gap-closure (2026-08-27) — Bill cost-centre tagging (only
    // Invoice/Expense were previously covered here). ──────────────────────
    await r.step('bill-cost-centre-tagging', async () => {
      const supRes = await page.evaluate((n) => window.api.suppliers.create({ supplierName: n }), `${TEST_PREFIX} CC Bill Vendor ${suffix}`)
      ccBillSupplierId = supRes?.data?.id
      const billRes = await page.evaluate(({ supplierId, costCentreId }) => window.api.bills.create({
        supplierId, costCentreId, items: [{ serviceDescription: 'E2E Phase65 CC-tagged bill line', quantity: 1, unitCost: 1000, taxRate: 0 }],
      }), { supplierId: ccBillSupplierId, costCentreId: uptownId })
      ccBillId = billRes?.data?.id
      r.log('cc-tagged-bill-created', !!ccBillId, JSON.stringify(billRes?.error || ''))
      r.log('bill-cost-centre-persisted', billRes?.data?.costCentreId === uptownId, JSON.stringify(billRes?.data?.costCentreId))

      const je = h.withDb((db) => db.prepare("SELECT id FROM JournalEntry WHERE sourceType = 'BILL' AND sourceId = ?").get(ccBillId))
      r.log('bill-gl-posting-exists', !!je, JSON.stringify(je))
      if (je) {
        const taggedLine = h.withDb((db) => db.prepare('SELECT * FROM JournalEntryLine WHERE journalEntryId = ? AND costCentreId = ?').get(je.id, uptownId))
        r.log('bill-gl-posting-attributed-to-cost-centre', !!taggedLine, JSON.stringify(taggedLine))
      }
    })

    // ── Cost-centre tagging via real Billing UI, flowing into the treemap report ──
    await r.step('tag-invoice-to-downtown-via-real-billing-ui', async () => {
      await h.gotoHash(page, '#/billing/new')
      await page.waitForTimeout(700)
      await page.locator('input[placeholder="Search products…"]').fill(productName)
      await page.waitForTimeout(700)
      await page.locator('button', { hasText: productName }).first().click()
      await page.waitForTimeout(400)
      await page.locator('input[placeholder="Search customers…"]').fill(customerAName)
      await page.waitForTimeout(700)
      await page.locator('button', { hasText: customerAName }).first().click()
      await page.waitForTimeout(300)
      const ccSelect = page.locator('select:has(option:text-is("' + downtownName + '"))')
      r.log('cost-centre-picker-visible-on-billing-screen', await ccSelect.count() === 1, `count=${await ccSelect.count()}`)
      await ccSelect.selectOption({ label: downtownName })
      await page.getByRole('button', { name: 'Credit (Pay Later)', exact: true }).click()
      await page.waitForTimeout(300)
      // A future due date keeps this invoice open/unpaid for the cash-flow test below.
      const dueDateInput = page.locator('input[type="date"]').last()
      if (await dueDateInput.count() > 0) {
        const future = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10)
        await dueDateInput.fill(future).catch(() => {})
      }
      await page.keyboard.press('F10')
      await page.waitForTimeout(1500)
      r.log('tagged-invoice-sale-no-crash', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'invoice-tagged-downtown')
    })

    await r.step('tagged-invoice-persisted-with-cost-centre', () => h.withDb((db) => {
      const inv = db.prepare('SELECT * FROM "Invoice" WHERE customerId = ? ORDER BY createdAt DESC LIMIT 1').get(customerAId)
      invoiceAId = inv?.id
      r.log('invoice-carries-downtown-cost-centre', inv?.costCentreId === downtownId, JSON.stringify(inv))
      const lines = db.prepare('SELECT * FROM JournalEntryLine WHERE costCentreId = ?').all(downtownId)
      r.log('gl-lines-carry-downtown-cost-centre', lines.length > 0, `count=${lines.length}`)
    }))

    await r.step('tag-expense-to-uptown-via-real-expenses-ui', async () => {
      const catRes = await page.evaluate(() => window.api.expenses.listCategories())
      categoryId = (catRes?.data ?? [])[0]?.id
      r.log('expense-category-available', !!categoryId, JSON.stringify(catRes?.data?.[0]))
      await h.gotoHash(page, '#/expenses')
      await page.waitForTimeout(700)
      await page.locator('button', { hasText: 'Add Expense' }).first().click().catch(async () => {
        await page.locator('button', { hasText: 'New Expense' }).first().click()
      })
      await page.waitForTimeout(500)
      const modal = h.topModal(page)
      await modal.getByLabel('Expense Name').fill(`${TEST_PREFIX} Ad Spend ${suffix}`).catch(async () => {
        await modal.locator('input').nth(0).fill(`${TEST_PREFIX} Ad Spend ${suffix}`)
      })
      const amountInput = modal.locator('input[type="number"]').first()
      await amountInput.fill('4000')
      const ccSelect = modal.locator('select:has(option:text-is("' + uptownName + '"))')
      r.log('cost-centre-picker-visible-on-expense-form', await ccSelect.count() === 1, `count=${await ccSelect.count()}`)
      await ccSelect.selectOption({ label: uptownName })
      // Create-mode submit button reads "Add Expense" (same label as the
      // trigger button that opened this modal) — not "Save", that's only
      // the edit-mode label. Scoped to the modal so it never matches the
      // page's own "Add Expense" open-trigger button behind it.
      await modal.locator('button', { hasText: 'Add Expense' }).last().click()
      await page.waitForTimeout(800)
      r.log('tagged-expense-no-crash', !(await h.hasErrorBoundary(page)))
    })

    await r.step('tagged-expense-persisted-with-cost-centre', () => h.withDb((db) => {
      const exp = db.prepare('SELECT * FROM Expense WHERE costCentreId = ? ORDER BY createdAt DESC LIMIT 1').get(uptownId)
      expenseId = exp?.id
      r.log('expense-carries-uptown-cost-centre', !!exp && exp.amount === 4000, JSON.stringify(exp))
    }))

    await r.step('treemap-report-shows-correct-split-via-real-ui', async () => {
      await h.gotoHash(page, '#/reports')
      await page.waitForTimeout(600)
      await page.locator('button', { hasText: 'Cost Centre P&L' }).click()
      await page.waitForTimeout(400)
      await page.locator('button', { hasText: 'Generate Report' }).click()
      await page.waitForTimeout(1200)
      const bodyText = await page.locator('body').innerText().catch(() => '')
      r.log('treemap-shows-downtown', bodyText.includes(downtownName), 'checked for downtown name in report body')
      r.log('treemap-shows-uptown', bodyText.includes(uptownName), 'checked for uptown name in report body')
      // This report is a real recharts Treemap (rectangles sized by revenue,
      // colored by margin) per spec — not a bar chart. Confirm real SVG
      // <rect> nodes actually render, not just that the fallback table does.
      const treemapRects = page.locator('svg rect')
      r.log('treemap-renders-real-svg-rectangles', await treemapRects.count() >= 2, `count=${await treemapRects.count()}`)
      r.log('treemap-no-crash', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'cost-centre-treemap-report')
    })

    // ── Budget: real inline actual/variance reacting to the tagged expense above ──
    await r.step('set-budget-for-uptown-via-real-ui', async () => {
      await h.gotoHash(page, '#/budgets')
      await page.waitForTimeout(700)
      await page.locator('button', { hasText: 'New Budget' }).click()
      await page.waitForTimeout(400)
      const modal = h.topModal(page)
      const ccSelect = modal.locator('select:has(option:text-is("' + uptownName + '"))')
      r.log('budget-form-has-cost-centre-select', await ccSelect.count() === 1, `count=${await ccSelect.count()}`)
      await ccSelect.selectOption({ label: uptownName })
      await modal.getByLabel('Amount *').fill('3000')
      await modal.locator('button', { hasText: 'Save Changes' }).click()
      await page.waitForTimeout(1000)
      r.log('budget-save-no-crash', !(await h.hasErrorBoundary(page)))
    })

    await r.step('budget-vs-actual-shows-over-budget-inline', async () => {
      await page.waitForTimeout(500)
      const row = page.locator('tr', { hasText: uptownName })
      r.log('budget-row-visible', await row.count() > 0, `count=${await row.count()}`)
      const rowText = await row.first().innerText().catch(() => '')
      r.log('budget-row-shows-over-budget-variance', /-/.test(rowText) || /−/.test(rowText), rowText)
      await h.shot(page, 'budget-vs-actual-uptown')
    })

    await r.step('budget-persisted-real-scope', () => h.withDb((db) => {
      const bud = db.prepare('SELECT * FROM Budget WHERE costCentreId = ?').get(uptownId)
      r.log('budget-persisted-with-correct-scope', !!bud && bud.amount === 3000 && bud.accountId === null, JSON.stringify(bud))
    }))

    // ── Budget vs. Actual also lives as its own selectable Reports-screen
    // entry (spec's own "shares the report-picker pattern" requirement),
    // not just inline on /budgets — verify it independently.
    await r.step('budget-vs-actual-standalone-report-via-real-ui', async () => {
      await h.gotoHash(page, '#/reports')
      await page.waitForTimeout(600)
      await page.locator('button', { hasText: 'Budget vs. Actual' }).click()
      await page.waitForTimeout(400)
      await page.locator('button', { hasText: 'Generate Report' }).click()
      await page.waitForTimeout(1200)
      const bodyText = await page.locator('body').innerText().catch(() => '')
      r.log('budget-vs-actual-report-shows-uptown', bodyText.includes(uptownName), 'checked for uptown name in report body')
      r.log('budget-vs-actual-report-no-crash', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'budget-vs-actual-standalone-report')
    })

    // ── Statutory suggestion: configure rates, generate payroll, suggest, verify NO auto-save ──
    await r.step('configure-statutory-rates-via-real-settings-ui', async () => {
      await h.gotoHash(page, '#/settings')
      await page.waitForTimeout(700)
      await page.locator('button', { hasText: 'Edit' }).first().click()
      await page.waitForTimeout(400)
      // This field's <label> has no htmlFor/id association (matches the
      // pre-existing Overhead Rate field right above it in the same file),
      // so getByLabel can't resolve it — locate via the label's own
      // following-sibling input instead.
      const pfInput = page.locator('div:has(> label:text-is("PF Rate (% of Basic Salary)")) input')
      r.log('pf-rate-field-visible', await pfInput.count() === 1, `count=${await pfInput.count()}`)
      await pfInput.fill('12')
      await page.locator('button', { hasText: 'Save Changes' }).click()
      await page.waitForTimeout(1000)
      r.log('settings-save-no-crash', !(await h.hasErrorBoundary(page)))
    })

    await r.step('seed-employee-for-payroll', async () => {
      const emp = await page.evaluate(async ({ n, costCentreId }) => window.api.hr.createEmployee({
        fullName: n, employeeType: 'FULL_TIME', joinDate: new Date().toISOString().slice(0, 10),
        salaryType: 'MONTHLY', basicSalary: 20000, costCentreId
      }), { n: employeeName, costCentreId: downtownId })
      employeeId = emp?.data?.id
      r.log('employee-created', !!employeeId, JSON.stringify(emp?.error))
      // Phase 65 gap-closure (2026-08-27) — Employee cost-centre tagging.
      r.log('employee-cost-centre-persisted', emp?.data?.costCentreId === downtownId, JSON.stringify(emp?.data?.costCentreId))
    })

    await r.step('generate-payroll-and-suggest-statutory-via-real-ui', async () => {
      await h.gotoHash(page, '#/hr/payroll')
      await page.waitForTimeout(700)
      await page.locator('button', { hasText: 'Generate' }).first().click()
      await page.waitForTimeout(1500)
      const row = page.locator('tr, [role="row"]', { hasText: employeeName }).first()
      const rowExists = await row.count() > 0
      r.log('payslip-row-generated', rowExists, `count=${await row.count()}`)
      // The row's onClick handler lives on its first <td> specifically, not
      // the <tr> itself — clicking the row's bounding box can land on a
      // different cell with no handler. Click the employee-name cell text directly.
      if (rowExists) await page.locator('p', { hasText: employeeName }).first().click()
      await page.waitForTimeout(500)
      const suggestBtn = page.locator('button', { hasText: 'Suggest from statutory rates' })
      r.log('suggest-statutory-button-visible', await suggestBtn.count() === 1, `count=${await suggestBtn.count()}`)
      await suggestBtn.click()
      await page.waitForTimeout(1000)
      const bodyText = await page.locator('body').innerText().catch(() => '')
      // 12% of ₹20,000 basic = ₹2,400 — check the suggestion pre-filled without saving yet.
      r.log('suggestion-prefilled-pf-amount-in-draft', bodyText.includes('2,400') || bodyText.includes('2400'), bodyText.match(/PF[^\n]{0,30}/i)?.[0] ?? 'no PF line found')
      await h.shot(page, 'payslip-statutory-suggestion-prefilled')
    })

    await r.step('suggestion-not-auto-saved-to-db', () => h.withDb((db) => {
      if (!employeeId) { r.log('skipped-no-employee-id', false); return }
      const sp = db.prepare('SELECT * FROM SalaryPayment WHERE employeeId = ? ORDER BY createdAt DESC LIMIT 1').get(employeeId)
      salaryPaymentId = sp?.id
      let deductions = []
      try { deductions = JSON.parse(sp?.deductions ?? '[]') } catch { /* ignore */ }
      const hasPfSaved = deductions.some((d) => d.name === 'PF')
      r.log('suggestion-never-auto-saved-before-explicit-save-click', !hasPfSaved, JSON.stringify(deductions))
    }))

    await r.step('explicit-save-persists-suggested-deduction', async () => {
      const saveBtn = page.locator('button', { hasText: 'Save' }).first()
      await saveBtn.click()
      await page.waitForTimeout(1000)
      r.log('deduction-save-no-crash', !(await h.hasErrorBoundary(page)))
    })

    await r.step('suggested-deduction-persisted-after-explicit-save', () => h.withDb((db) => {
      if (!salaryPaymentId) { r.log('skipped-no-salary-payment-id', false); return }
      const sp = db.prepare('SELECT * FROM SalaryPayment WHERE id = ?').get(salaryPaymentId)
      let deductions = []
      try { deductions = JSON.parse(sp?.deductions ?? '[]') } catch { /* ignore */ }
      const pf = deductions.find((d) => d.name === 'PF')
      r.log('pf-deduction-persisted-after-explicit-save', !!pf && Math.abs(pf.amount - 2400) < 1, JSON.stringify(deductions))
    }))

    // ── Real, previously-undisclosed bug fixed this phase: markSalaryPaid()
    // used to create a real Expense row but never post it to the GL. Verify
    // via an actual Trial Balance before/after, not just the unit-level
    // regression-guard test — the acceptance checklist explicitly calls for this.
    let glLineCountBeforePaid = 0
    await r.step('gl-line-count-before-mark-paid', () => h.withDb((db) => {
      glLineCountBeforePaid = db.prepare('SELECT COUNT(*) as c FROM JournalEntryLine').get().c
      r.log('captured-gl-line-count-before', true, `count=${glLineCountBeforePaid}`)
    }))

    await r.step('mark-payslip-paid-via-real-ui', async () => {
      const markPaidBtn = page.locator('button', { hasText: 'Mark as Paid' })
      r.log('mark-as-paid-button-visible', await markPaidBtn.count() === 1, `count=${await markPaidBtn.count()}`)
      await markPaidBtn.click()
      await page.waitForTimeout(400)
      // ConfirmDialog — its own confirm button also reads "Mark as Paid".
      await page.locator('button', { hasText: 'Mark as Paid' }).last().click()
      await page.waitForTimeout(1200)
      r.log('mark-paid-no-crash', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'payslip-marked-paid')
    })

    await r.step('mark-paid-created-real-gl-posting', () => h.withDb((db) => {
      if (!salaryPaymentId) { r.log('skipped-no-salary-payment-id', false); return }
      const sp = db.prepare('SELECT * FROM SalaryPayment WHERE id = ?').get(salaryPaymentId)
      r.log('salary-payment-marked-paid', sp?.status === 'PAID', JSON.stringify(sp))
      const glLineCountAfter = db.prepare('SELECT COUNT(*) as c FROM JournalEntryLine').get().c
      r.log('gl-line-count-increased-by-marking-paid', glLineCountAfter > glLineCountBeforePaid, `before=${glLineCountBeforePaid} after=${glLineCountAfter}`)
      // Real Trial Balance check: debit total must still equal credit total
      // across the WHOLE ledger after this posting — proves the new entry
      // is balanced, not just present.
      const totals = db.prepare('SELECT SUM(debitAmount) as d, SUM(creditAmount) as c FROM JournalEntryLine').get()
      r.log('ledger-still-balanced-after-payroll-posting', Math.abs((totals.d ?? 0) - (totals.c ?? 0)) < 0.01, JSON.stringify(totals))
      // netPayable = grossSalary (20000, no allowances configured) minus the
      // ₹2,400 PF deduction saved earlier = 17600 — not the raw basic salary.
      const expenseRow = db.prepare('SELECT e.* FROM Expense e WHERE e.expenseName LIKE ? ORDER BY e.createdAt DESC LIMIT 1').get('%' + employeeName + '%')
      r.log('payroll-created-a-real-expense-row', !!expenseRow && Math.abs(expenseRow.amount - 17600) < 1, JSON.stringify(expenseRow))
      if (expenseRow) {
        const je = db.prepare('SELECT id FROM JournalEntry WHERE sourceType = ? AND sourceId = ?').get('EXPENSE', expenseRow.id)
        r.log('payroll-expense-has-real-gl-posting', !!je, JSON.stringify(je))
        if (je) {
          const lines = db.prepare('SELECT * FROM JournalEntryLine WHERE journalEntryId = ?').all(je.id)
          r.log('payroll-gl-posting-has-lines', lines.length >= 2, `count=${lines.length}`)
          // Phase 65 gap-closure (2026-08-27) — the employee's own
          // costCentreId should attribute this GL posting to that centre.
          const taggedLine = lines.find((l) => l.costCentreId === downtownId)
          r.log('payroll-gl-posting-attributed-to-employee-cost-centre', !!taggedLine, JSON.stringify({ downtownId, lines: lines.map((l) => l.costCentreId) }))
        }
      }
    }))

    // ── UAT scenario from the spec itself: "...a dashed line dip... because
    // of a large recurring rent expense due then." Seed a real recurring
    // EXPENSE profile (via IPC, matching suite convention) whose next
    // occurrence lands a few days out, then confirm the projection actually
    // reflects it — not just that an open invoice shows up.
    await r.step('seed-recurring-rent-expense-profile', async () => {
      const targetDate = new Date(Date.now() + 3 * 86400000)
      const targetDow = ((targetDate.getDay() + 6) % 7) + 1 // ISO day-of-week, matches WEEKLY cadence's own convention
      const res = await page.evaluate(async ({ categoryId, dow }) => window.api.recurringProfiles.create({
        documentType: 'EXPENSE', categoryId, expenseName: 'Rent', amount: 15000,
        cadence: 'WEEKLY', dayOfPeriod: dow, startDate: new Date().toISOString().slice(0, 10)
      }), { categoryId, dow: targetDow })
      recurringProfileId = res?.data?.id
      r.log('recurring-rent-profile-created', !!recurringProfileId, JSON.stringify(res?.error))
    })

    await r.step('cash-flow-projection-report-reflects-invoice-and-recurring-rent', async () => {
      await h.gotoHash(page, '#/reports')
      await page.waitForTimeout(600)
      await page.locator('button', { hasText: 'Cash-Flow Projection' }).click()
      await page.waitForTimeout(400)
      await page.locator('button', { hasText: 'Generate Report' }).click()
      await page.waitForTimeout(1200)
      const bodyText = await page.locator('body').innerText().catch(() => '')
      // The recurring ₹15,000 rent forecast should show up somewhere in the
      // projected total/table — a real negative pull on the dashed line,
      // not just the open invoice's positive contribution.
      r.log('cash-flow-projection-reflects-recurring-rent', bodyText.includes('15,000') || bodyText.includes('15000'), 'checked for the ₹15,000 recurring rent forecast in report body')
      r.log('cash-flow-report-no-crash', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'cash-flow-projection-report')
    })

    // ── Payment Performance: a same-day-paid invoice shows a real days-to-pay figure ──
    await r.step('create-and-pay-second-invoice-for-payment-performance', async () => {
      await h.gotoHash(page, '#/billing/new')
      await page.waitForTimeout(700)
      await page.locator('input[placeholder="Search products…"]').fill(productName)
      await page.waitForTimeout(700)
      await page.locator('button', { hasText: productName }).first().click()
      await page.waitForTimeout(400)
      await page.locator('input[placeholder="Search customers…"]').fill(customerBName)
      await page.waitForTimeout(700)
      await page.locator('button', { hasText: customerBName }).first().click()
      await page.waitForTimeout(300)
      await page.getByRole('button', { name: 'Cash', exact: true }).click().catch(() => {})
      await page.keyboard.press('F10')
      await page.waitForTimeout(1500)
      r.log('second-invoice-no-crash', !(await h.hasErrorBoundary(page)))
    })

    await r.step('second-invoice-persisted-as-paid', () => h.withDb((db) => {
      const inv = db.prepare('SELECT * FROM "Invoice" WHERE customerId = ? ORDER BY createdAt DESC LIMIT 1').get(customerBId)
      invoiceBId = inv?.id
      r.log('second-invoice-fully-paid', !!inv && inv.balanceAmount <= 0, JSON.stringify(inv))
    }))

    await r.step('payment-performance-report-shows-real-customer', async () => {
      await h.gotoHash(page, '#/reports')
      await page.waitForTimeout(600)
      await page.locator('button', { hasText: 'Payment Performance' }).click()
      await page.waitForTimeout(400)
      await page.locator('button', { hasText: 'Generate Report' }).click()
      await page.waitForTimeout(1200)
      const bodyText = await page.locator('body').innerText().catch(() => '')
      r.log('payment-performance-shows-customer-b', bodyText.includes(customerBName), 'checked for customer B name in report body')
      r.log('payment-performance-no-crash', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'payment-performance-report')
    })
  } finally {
    let cleanup
    try {
      cleanup = h.withDb((db) => {
        const counts = {}
        const del = (table, where, ...args) => { try { counts[table] = (counts[table] || 0) + db.prepare(`DELETE FROM ${table} WHERE ${where}`).run(...args).changes } catch { /* table may not exist in this shape */ } }
        if (salaryPaymentId) del('SalaryPayment', 'id = ?', salaryPaymentId)
        // markSalaryPaid's own GL posting (the real bug fixed this phase) —
        // clean up the Expense row + its JournalEntry/Lines it created.
        const payrollExpense = db.prepare('SELECT id FROM Expense WHERE expenseName LIKE ? ORDER BY createdAt DESC LIMIT 1').get('%' + employeeName + '%')
        if (payrollExpense) {
          try {
            const je = db.prepare('SELECT id FROM JournalEntry WHERE sourceType = ? AND sourceId = ?').get('EXPENSE', payrollExpense.id)
            if (je) { del('JournalEntryLine', 'journalEntryId = ?', je.id); del('"JournalEntry"', 'id = ?', je.id) }
          } catch { /* schema shape may differ — best-effort only */ }
          del('Expense', 'id = ?', payrollExpense.id)
        }
        if (employeeId) { try { db.prepare('DELETE FROM Employee WHERE id = ?').run(employeeId) } catch { db.prepare('UPDATE Employee SET isActive = 0 WHERE id = ?').run(employeeId) } }
        if (expenseId) del('Expense', 'id = ?', expenseId)
        for (const invId of [invoiceAId, invoiceBId].filter(Boolean)) {
          del('Payment', 'invoiceId = ?', invId)
          del('InvoiceItem', 'invoiceId = ?', invId)
          del('CustomerLedger', 'invoiceId = ?', invId)
          del('"Invoice"', 'id = ?', invId)
        }
        if (productId) {
          del('Inventory', 'productId = ?', productId)
          try { db.prepare('DELETE FROM Product WHERE id = ?').run(productId) } catch { db.prepare('UPDATE Product SET isActive = 0 WHERE id = ?').run(productId) }
        }
        for (const custId of [customerAId, customerBId].filter(Boolean)) {
          try { db.prepare('DELETE FROM Customer WHERE id = ?').run(custId) } catch { db.prepare('UPDATE Customer SET isActive = 0 WHERE id = ?').run(custId) }
        }
        if (ccBillId) {
          del('SupplierPayment', 'billId = ?', ccBillId)
          del('BillItem', 'billId = ?', ccBillId)
          const je = db.prepare("SELECT id FROM JournalEntry WHERE sourceType = 'BILL' AND sourceId = ?").get(ccBillId)
          if (je) { del('JournalEntryLine', 'journalEntryId = ?', je.id); del('"JournalEntry"', 'id = ?', je.id) }
          del('"Bill"', 'id = ?', ccBillId)
        }
        if (ccBillSupplierId) {
          del('SupplierLedger', 'supplierId = ?', ccBillSupplierId)
          try { db.prepare('DELETE FROM Supplier WHERE id = ?').run(ccBillSupplierId) } catch { db.prepare('UPDATE Supplier SET isActive = 0 WHERE id = ?').run(ccBillSupplierId) }
        }
        if (uptownId) del('Budget', 'costCentreId = ?', uptownId)
        if (recurringProfileId) del('RecurringProfile', 'id = ?', recurringProfileId)
        for (const ccId of [downtownId, uptownId].filter(Boolean)) {
          try { db.prepare('UPDATE JournalEntryLine SET costCentreId = NULL WHERE costCentreId = ?').run(ccId) } catch { /* ignore */ }
          try { db.prepare('DELETE FROM CostCentre WHERE id = ?').run(ccId) } catch { db.prepare('UPDATE CostCentre SET isActive = 0 WHERE id = ?').run(ccId) }
        }
        // Revert the statutory rate configured on BusinessProfile during this run.
        try { db.prepare('UPDATE BusinessProfile SET statutoryPfPercent = NULL').run() } catch { /* ignore */ }
        return counts
      })
    } catch (e) {
      cleanup = { error: String(e) }
    }
    console.log('cleanup:', JSON.stringify(cleanup))
    await h.closeApp(app)
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nCOST CENTRES, BUDGETS & PAYROLL COMPLIANCE (PHASE 65): ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
