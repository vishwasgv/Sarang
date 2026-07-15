/**
 * Live UAT for all 70 new AI Assistant templates added in Phase 57 Addendum 7
 * (2026-07-15). Requested: "perform UAT for all of this 110 AI questions" —
 * scoped down to the 70 templates that have NEVER been run against real data
 * before (the original 40 already have live-verification history across
 * Addendums 2-6). This is the actual unverified surface.
 *
 * Design: seeds real fixtures via raw SQL (node:sqlite, matching this
 * project's established harness pattern — see 09-stress.js), then calls the
 * REAL production IPC handler (`window.api.ai.query`) inside the real running
 * Electron app for every question — same code path a real user's click
 * triggers, real classification, real DB reads, real answer formatting.
 * Every fixture is named with the "UAT70 " prefix for unambiguous cleanup and
 * for verifying an answer's detail list actually surfaces the RIGHT record
 * among whatever real/pre-existing data is already in the dev DB, rather than
 * requiring a fragile exact global-count match.
 *
 * BusinessProfile.businessType is flipped directly via SQL between batches
 * (not via the Settings UI) — askQuestion() reads it fresh from the DB on
 * every call with no caching, and calling window.api.ai.query directly
 * (rather than driving the chat UI) means the renderer's own stale
 * industry.store.ts (Gotcha 4, project memory) never enters the picture.
 * IndustryTemplateSetting rows for every business type under test are
 * upserted with enabledModules=["ai_assistant"] up front — the AI's own
 * template functions query the DB directly and don't check any OTHER module
 * flag, so this one flag is sufficient regardless of which vertical.
 */
const h = require('./harness')
const crypto = require('crypto')

const PREFIX = 'UAT70'
function id() { return crypto.randomUUID() }
function daysFromNow(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString() }
function isoNow() { return new Date().toISOString() }
function monthKey(d = new Date()) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }

async function main() {
  // `node uat-70-templates.js --cleanup-only` — remove UAT70 fixtures
  // without launching Electron or asking anything, for tearing down after
  // the last verification pass.
  if (process.argv.includes('--cleanup-only')) {
    cleanupUat70()
    console.log('Cleanup done.')
    return
  }

  h.resetAdminPasswordForSuite()
  // Self-healing pre-cleanup — see 09-stress.js's own comment for why.
  cleanupUat70()
  const app = await h.launchApp()
  const results = []
  let originalBusinessType = null

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    originalBusinessType = h.withDb((db) => db.prepare('SELECT businessType FROM BusinessProfile LIMIT 1').get()?.businessType)
    const adminId = h.withDb((db) => db.prepare("SELECT id FROM User WHERE username = 'admin'").get()?.id)
    if (!adminId) throw new Error('No admin user found')

    // Enable ai_assistant for every business type under test, up front.
    const allTypes = ['GENERAL', 'LAWYER', 'CA_FIRM', 'ARCHITECT', 'CIVIL_ENGINEER', 'REAL_ESTATE', 'SOFTWARE_AGENCY', 'PHOTO_STUDIO', 'EVENT_MANAGEMENT', 'DRIVING_SCHOOL', 'TAILOR_BOUTIQUE', 'PEST_CONTROL', 'VET_CLINIC', 'DENTAL_CLINIC', 'CAR_SERVICE_CENTER', 'COACHING_INSTITUTE', 'DIAGNOSTIC_LAB', 'PLACEMENT_AGENCY']
    h.withDb((db) => {
      db.exec('BEGIN')
      for (const bt of allTypes) {
        const existing = db.prepare('SELECT id, enabledModules FROM IndustryTemplateSetting WHERE businessType = ?').get(bt)
        if (existing) {
          const mods = new Set(JSON.parse(existing.enabledModules || '[]'))
          mods.add('ai_assistant')
          db.prepare('UPDATE IndustryTemplateSetting SET enabledModules = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').run(JSON.stringify([...mods]), existing.id)
        } else {
          db.prepare('INSERT INTO IndustryTemplateSetting (id, businessType, enabledModules, createdAt, updatedAt) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)').run(id(), bt, JSON.stringify(['ai_assistant']))
        }
      }
      db.exec('COMMIT')
    })

    console.log('\n[SEED] Universal fixtures...')
    const u = seedUniversal(adminId)
    console.log('[SEED] Universal done:', Object.keys(u).length, 'refs')

    console.log('\n[SEED] Vertical fixtures (all 17 business types)...')
    seedVerticals(adminId)
    console.log('[SEED] Vertical done')

    // Real bug in THIS SCRIPT found live (2026-07-15): every date value
    // inserted above via `.toISOString()` or the SQL `CURRENT_TIMESTAMP`
    // literal is stored as TEXT — but Prisma's real SQLite provider stores
    // every DateTime column as INTEGER (Unix epoch milliseconds), confirmed
    // by directly inspecting a genuine Prisma-written row (`typeof` came
    // back 'integer', this script's own inserts came back 'text'). A
    // date-range query built from a real JS Date (as every template here
    // does) compares against that INTEGER representation — a TEXT-stored
    // seed row silently falls outside any range filter, which is exactly
    // why `vet.vaccinationsDue` returned the empty-fallback message despite
    // a correctly-dated VaccinationRecord existing. Fixed by converting
    // every touched date column from TEXT to INTEGER epoch-ms in place,
    // for every UAT70-prefixed row, rather than rewriting all ~50 INSERT
    // statements above — `strftime('%s', textValue)` correctly parses both
    // ISO 8601 (`.toISOString()`) and SQLite's own CURRENT_TIMESTAMP format.
    fixDateColumnTypes()
    console.log('[SEED] Date column types fixed (TEXT -> INTEGER epoch-ms)')

    // ── Universal batch (52 questions, business type = GENERAL) ──────────
    setBusinessType('GENERAL')
    const universalQuestions = [
      ['inventory.stockValue', "What's my total stock value?"],
      ['inventory.outOfStockCount', 'How many products are out of stock?'],
      ['finance.cashInHand', 'How much cash do I have on hand?'],
      ['finance.expenseBreakdown', 'Show me my expense breakdown this month'],
      ['finance.biggestExpenseCategory', "What's my biggest expense category?"],
      ['finance.taxCollected', 'How much tax have I collected this month?'],
      ['staff.attendanceToday', 'How many staff are present today?'],
      ['staff.onLeave', 'Who is on leave today?'],
      ['documents.pendingQuotations', 'How many quotations are pending?'],
      ['documents.pendingPurchaseOrders', 'How many purchase orders are pending?'],
      ['documents.creditDebitNotesIssued', 'How many credit and debit notes were issued this month?'],
      ['customers.totalCount', 'How many customers do I have in total?'],
      ['documents.invoiceByNumber', `Look up invoice ${u.invoiceNumber}`],
      ['documents.purchaseOrderByNumber', `Look up purchase order ${u.poNumber}`],
      ['customers.byNameOrPhone', 'Look up customer "UAT70 Epsilon Corp"'],
      ['suppliers.byName', 'Look up supplier "UAT70 Prime Supplies"'],
      ['inventory.productByNameOrSku', 'Look up product "UAT70 Widget D"'],
      ['inventory.topSellingByQuantity', 'What are my best-selling products by quantity?'],
      ['sales.byCategory', 'What are my sales by product category?'],
      ['sales.byHourOfDay', "What's my busiest hour of the day for sales?"],
      ['sales.uniqueCustomersServed', 'How many unique customers did I serve this month?'],
      ['sales.totalDiscountsGiven', 'How much discount have I given this month?'],
      ['sales.returnsAndRefunds', 'How many returns did I process this month?'],
      ['sales.cancelledInvoices', 'How many cancelled invoices this month?'],
      ['sales.walkInVsRegistered', 'How many walk-in versus registered customer sales this month?'],
      ['inventory.stockValueByCategory', "What's my stock value broken down by category?"],
      ['inventory.nearReorderLevel', 'Which products are close to their reorder level?'],
      ['inventory.distinctSkuCount', 'How many distinct SKUs do I have?'],
      ['inventory.productsAddedThisMonth', 'How many products were added this month?'],
      ['inventory.productsNeverPurchased', 'Which products have never been purchased from a supplier?'],
      ['inventory.stockTurnoverRate', "What's my stock turnover rate this month?"],
      ['inventory.biggestStockAdjustment', "What's my biggest stock adjustment this month?"],
      ['customers.highestSinglePurchase', 'What is the highest single purchase ever made by a customer?'],
      ['customers.averageSpend', "What's the average customer spend this month?"],
      ['customers.byCity', 'What cities are my customers located in?'],
      ['customers.repeatPurchaseRate', "What's my customer repeat purchase rate this month?"],
      ['customers.newThisWeek', 'How many new customers did I get this week?'],
      ['suppliers.inactive', "Which suppliers haven't I ordered from recently?"],
      ['suppliers.averageDeliveryLeadTime', "What's my average supplier delivery lead time?"],
      ['suppliers.totalPurchaseValueThisMonth', "What's my total purchase value across all suppliers this month?"],
      ['finance.netGstPayable', "What's my net GST payable this month?"],
      ['finance.cashVsBankSplit', 'What is my cash versus bank split of receipts this month?'],
      ['finance.discountImpact', 'How much have discounts impacted my revenue this month?'],
      ['finance.netWorthSnapshot', "What's my net worth snapshot?"],
      ['finance.expenseTrend', "What's my expense trend versus last month?"],
      ['finance.profitTrend', "What's my profit trend versus last month?"],
      ['staff.totalSalaryPaidThisMonth', 'How much salary have I paid out this month?'],
      ['staff.bestWorstAttendance', 'Who has the best and worst attendance this month?'],
      ['staff.activeHeadcount', 'How many active employees do I have?'],
      ['documents.openQuotationsValue', "What's the total value of my open quotations?"],
      ['documents.quotationConversionRate', "What's my quotation to invoice conversion rate this month?"],
      ['documents.overduePurchaseOrders', 'Which purchase orders are overdue for receipt?'],
    ]
    for (const [tmpl, q] of universalQuestions) {
      results.push(await ask(page, tmpl, 'GENERAL', q))
    }

    // ── Vertical batch (18 questions across 17 business-type switches) ───
    const verticalRuns = [
      ['LAWYER', [['legal.openCasesAndHearings', 'How many open cases and hearings do I have coming up?'], ['service.unbilledTimeValue', 'How much unbilled time do I have right now?']]],
      ['CA_FIRM', [['compliance.upcomingFilings', 'What ROC filings are due soon?']]],
      ['ARCHITECT', [['service.drawingsPendingRevision', 'Which drawings are pending review or revision?']]],
      ['CIVIL_ENGINEER', [['service.siteVisitsDueThisWeek', 'Which site visits are due this week?']]],
      ['REAL_ESTATE', [['realEstate.listingsAndLeads', 'How are my listings and leads doing?']]],
      ['SOFTWARE_AGENCY', [['service.openIssues', 'How many open issues do I have?']]],
      ['PHOTO_STUDIO', [['photography.upcomingShoots', 'What shoots do I have coming up?']]],
      ['EVENT_MANAGEMENT', [['events.upcoming', 'What events do I have coming up?']]],
      ['DRIVING_SCHOOL', [['driving.upcomingTestsAndLowBalance', 'Which learners have an upcoming test or are low on package sessions?']]],
      ['TAILOR_BOUTIQUE', [['tailoring.ordersDueThisWeek', 'Which tailoring orders are due for delivery this week?']]],
      ['PEST_CONTROL', [['pestControl.contractsDueForRenewal', 'Which pest control contracts are due for renewal?']]],
      ['VET_CLINIC', [['vet.vaccinationsDue', 'Which vaccinations are due soon?']]],
      ['DENTAL_CLINIC', [['dental.recallsDue', 'Which patient recalls are due?']]],
      ['CAR_SERVICE_CENTER', [['carService.vehiclesInService', 'How many vehicles are currently in service?']]],
      ['COACHING_INSTITUTE', [['coaching.feeDuesAndAttendance', 'What are my fee dues and attendance this week?']]],
      ['DIAGNOSTIC_LAB', [['lab.reportsPendingFinalization', 'How many lab reports are pending finalization?']]],
      ['PLACEMENT_AGENCY', [['placement.pipelineByStage', "What's my candidate pipeline by stage?"]]],
    ]
    for (const [bt, qs] of verticalRuns) {
      setBusinessType(bt)
      for (const [tmpl, q] of qs) {
        results.push(await ask(page, tmpl, bt, q))
      }
    }

    // ── Report ─────────────────────────────────────────────────────────
    console.log('\n\n========== UAT RESULTS (' + results.length + ' questions) ==========\n')
    for (const r of results) {
      console.log(`[${r.template}] (${r.businessType}) "${r.question}"`)
      console.log(`  matched: ${r.matched}  correctTemplate: ${r.matched === r.template}`)
      console.log(`  answer: ${r.answer}`)
      console.log('')
    }
    const wrongTemplate = results.filter((r) => r.matched !== r.template)
    const errors = results.filter((r) => r.errored)
    console.log('========== SUMMARY ==========')
    console.log('Total:', results.length, ' Wrong-template-match:', wrongTemplate.length, ' Errored:', errors.length)
    if (wrongTemplate.length) console.log('Wrong matches:', wrongTemplate.map((r) => `${r.template} -> got ${r.matched}`))
    if (errors.length) console.log('Errored:', errors.map((r) => r.template))

    require('fs').writeFileSync(require('path').join(__dirname, 'uat-70-results.json'), JSON.stringify(results, null, 2))
    console.log('\nFull results written to tests/e2e/uat-70-results.json')
  } catch (e) {
    console.error('FATAL', e)
  } finally {
    if (originalBusinessType) {
      h.withDb((db) => db.prepare('UPDATE BusinessProfile SET businessType = ? WHERE id = (SELECT id FROM BusinessProfile LIMIT 1)').run(originalBusinessType))
    }
    await h.closeApp(app)
    h.randomizeAdminPassword()
  }

  function setBusinessType(bt) {
    h.withDb((db) => db.prepare('UPDATE BusinessProfile SET businessType = ? WHERE id = (SELECT id FROM BusinessProfile LIMIT 1)').run(bt))
  }

  async function ask(page, template, businessType, question) {
    try {
      const res = await page.evaluate((q) => window.api.ai.query({ question: q }), question)
      const log = h.withDb((db) => db.prepare('SELECT matchedTemplate, matchedCategory, success FROM AiQueryLog ORDER BY createdAt DESC LIMIT 1').get())
      return {
        template, businessType, question,
        matched: log?.matchedTemplate ?? null,
        success: !!res?.success,
        answer: res?.success ? res.data.answer : JSON.stringify(res?.error),
        errored: !res?.success,
      }
    } catch (e) {
      return { template, businessType, question, matched: null, success: false, answer: 'THREW: ' + String(e.message || e), errored: true }
    }
  }

  console.log('\n=== DONE ===')
}

function seedUniversal(adminId) {
  const now = new Date()
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 15).toISOString()
  const fiveDaysAgo = daysFromNow(-5)
  const twoHundredDaysAgo = daysFromNow(-200)

  const ids = {}
  h.withDb((db) => {
    db.exec('BEGIN')

    // Categories
    const catAlpha = id(); const catBeta = id()
    db.prepare('INSERT INTO ProductCategory (id, name, isActive, createdAt, updatedAt) VALUES (?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)').run(catAlpha, `${PREFIX} Category Alpha`)
    db.prepare('INSERT INTO ProductCategory (id, name, isActive, createdAt, updatedAt) VALUES (?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)').run(catBeta, `${PREFIX} Category Beta`)

    // Customers
    const c = { alpha: id(), beta: id(), gamma: id(), delta: id(), epsilon: id() }
    db.prepare(`INSERT INTO Customer (id, customerName, phone, city, outstandingBalance, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`).run(c.alpha, `${PREFIX} Alpha Traders`, '9800000001', 'Mumbai')
    db.prepare(`INSERT INTO Customer (id, customerName, phone, city, outstandingBalance, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`).run(c.beta, `${PREFIX} Beta Retail`, '9800000002', 'Mumbai')
    db.prepare(`INSERT INTO Customer (id, customerName, phone, city, outstandingBalance, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`).run(c.gamma, `${PREFIX} Gamma Stores`, '9800000003', 'Pune')
    db.prepare(`INSERT INTO Customer (id, customerName, phone, city, outstandingBalance, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`).run(c.delta, `${PREFIX} Delta Mart`, '9800000004', 'Pune')
    db.prepare(`INSERT INTO Customer (id, customerName, phone, city, outstandingBalance, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`).run(c.epsilon, `${PREFIX} Epsilon Corp`, '9800000005', 'Delhi')

    // Suppliers
    const s = { prime: id(), stale: id(), fast: id() }
    db.prepare(`INSERT INTO Supplier (id, supplierName, phone, isActive, createdAt, updatedAt) VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`).run(s.prime, `${PREFIX} Prime Supplies`, '9800001001')
    db.prepare(`INSERT INTO Supplier (id, supplierName, phone, isActive, createdAt, updatedAt) VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`).run(s.stale, `${PREFIX} Stale Supplier`, '9800001002')
    db.prepare(`INSERT INTO Supplier (id, supplierName, phone, isActive, createdAt, updatedAt) VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`).run(s.fast, `${PREFIX} Fast Supplier`, '9800001003')

    // Products + Inventory
    function addProduct(name, categoryId, sellingPrice, costPrice, stock, reorderLevel, createdAt) {
      const pid = id()
      db.prepare(`INSERT INTO Product (id, categoryId, productName, sellingPrice, costPrice, taxRate, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, 18, 1, ?, CURRENT_TIMESTAMP)`)
        .run(pid, categoryId, name, sellingPrice, costPrice, createdAt || isoNow())
      db.prepare(`INSERT INTO Inventory (id, productId, quantity, reorderLevel, averageCost, updatedAt) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`)
        .run(id(), pid, stock, reorderLevel, costPrice)
      return pid
    }
    const p = {}
    p.widgetA = addProduct(`${PREFIX} Widget A`, catAlpha, 200, 100, 0, 10)
    p.widgetB = addProduct(`${PREFIX} Widget B`, catAlpha, 250, 120, 11, 10)
    p.widgetC = addProduct(`${PREFIX} Widget C`, catBeta, 300, 150, 5, 10)
    p.widgetD = addProduct(`${PREFIX} Widget D`, catBeta, 5000, 3000, 100, 5)
    p.neverPurchased = addProduct(`${PREFIX} Never Purchased Gadget`, catAlpha, 400, 200, 20, 5)
    p.purchased = addProduct(`${PREFIX} Purchased Gadget`, catAlpha, 450, 220, 30, 5)
    p.newThisMonth = addProduct(`${PREFIX} New This Month Product`, catBeta, 600, 300, 15, 5)
    p.adjustmentWidget = addProduct(`${PREFIX} Adjustment Widget`, catBeta, 350, 50, 80, 5)

    // Invoices
    function addInvoice(opts) {
      const iid = id()
      db.prepare(`INSERT INTO Invoice (id, invoiceNumber, invoiceType, customerId, invoiceDate, status, subtotal, discountAmount, taxAmount, totalAmount, paidAmount, balanceAmount, paymentStatus, quotationId, createdById, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`).run(
        iid, opts.invoiceNumber, opts.invoiceType || 'RETAIL', opts.customerId || null, opts.invoiceDate,
        opts.status || 'ACTIVE', opts.subtotal, opts.discountAmount || 0, opts.taxAmount || 0, opts.totalAmount,
        opts.paidAmount || 0, opts.balanceAmount ?? opts.totalAmount, opts.paymentStatus || 'UNPAID', opts.quotationId || null, adminId
      )
      return iid
    }
    function addInvoiceItem(invoiceId, productId, productName, qty, unitPrice, taxRate, discountAmount) {
      const taxable = qty * unitPrice - (discountAmount || 0)
      const taxAmount = taxable * (taxRate / 100)
      db.prepare(`INSERT INTO InvoiceItem (id, invoiceId, productId, productName, quantity, unitPrice, discountAmount, taxRate, taxAmount, lineTotal) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(id(), invoiceId, productId, productName, qty, unitPrice, discountAmount || 0, taxRate, taxAmount, taxable + taxAmount)
    }

    // Quotation converted to an invoice
    const qConverted = id()
    db.prepare(`INSERT INTO Quotation (id, quotationNumber, customerId, status, subtotal, taxAmount, discountAmount, totalAmount, createdBy, createdAt, updatedAt) VALUES (?, ?, ?, 'ACCEPTED', 10000, 1800, 0, 11800, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`)
      .run(qConverted, `${PREFIX}-QT-0001`, c.epsilon, adminId)

    const invNum1 = `${PREFIX}-INV-0001`
    const i1 = addInvoice({ invoiceNumber: invNum1, customerId: c.epsilon, invoiceDate: isoNow(), subtotal: 10000, taxAmount: 1800, totalAmount: 11800, paidAmount: 11800, balanceAmount: 0, paymentStatus: 'PAID', quotationId: qConverted })
    addInvoiceItem(i1, p.widgetD, `${PREFIX} Widget D`, 2, 5000, 18, 0)
    db.prepare('UPDATE Quotation SET status = ? WHERE id = ?').run('ACCEPTED', qConverted)

    const i2 = addInvoice({ invoiceNumber: `${PREFIX}-INV-0002`, customerId: null, invoiceDate: isoNow(), subtotal: 300, taxAmount: 54, totalAmount: 354, paidAmount: 354, balanceAmount: 0, paymentStatus: 'PAID' })
    addInvoiceItem(i2, p.widgetC, `${PREFIX} Widget C`, 1, 300, 18, 0)

    const i3 = addInvoice({ invoiceNumber: `${PREFIX}-INV-0003`, customerId: c.epsilon, invoiceDate: thisMonth, subtotal: 20000, discountAmount: 5000, taxAmount: 2700, totalAmount: 17700, paidAmount: 17700, balanceAmount: 0, paymentStatus: 'PAID' })
    addInvoiceItem(i3, p.widgetD, `${PREFIX} Widget D`, 4, 5000, 18, 5000)

    const i4 = addInvoice({ invoiceNumber: `${PREFIX}-INV-0004`, invoiceType: 'RETURN', customerId: c.beta, invoiceDate: thisMonth, subtotal: -250, taxAmount: -45, totalAmount: -295, paidAmount: 0, balanceAmount: -295, paymentStatus: 'PAID' })
    addInvoiceItem(i4, p.widgetC, `${PREFIX} Widget C`, 1, 250, 18, 0)

    const i5 = addInvoice({ invoiceNumber: `${PREFIX}-INV-0005`, customerId: c.gamma, invoiceDate: thisMonth, status: 'CANCELLED', subtotal: 900, taxAmount: 162, totalAmount: 1062, paidAmount: 0, balanceAmount: 1062, paymentStatus: 'UNPAID' })
    addInvoiceItem(i5, p.widgetB, `${PREFIX} Widget B`, 3, 250, 18, 0)

    const i6 = addInvoice({ invoiceNumber: `${PREFIX}-INV-0006`, customerId: c.epsilon, invoiceDate: thisMonth, subtotal: 5000, taxAmount: 900, totalAmount: 5900, paidAmount: 5900, balanceAmount: 0, paymentStatus: 'PAID' })
    addInvoiceItem(i6, p.widgetD, `${PREFIX} Widget D`, 1, 5000, 18, 0)

    const invNum7 = `${PREFIX}-INV-0007`
    const i7 = addInvoice({ invoiceNumber: invNum7, customerId: c.epsilon, invoiceDate: thisMonth, subtotal: 500000, taxAmount: 90000, totalAmount: 590000, paidAmount: 590000, balanceAmount: 0, paymentStatus: 'PAID' })
    addInvoiceItem(i7, p.widgetD, `${PREFIX} Widget D`, 100, 5000, 18, 0)

    // A couple more spread across different hours (byHourOfDay)
    const morningDate = new Date(); morningDate.setHours(9, 0, 0, 0)
    const eveningDate = new Date(); eveningDate.setHours(19, 0, 0, 0)
    const i8 = addInvoice({ invoiceNumber: `${PREFIX}-INV-0008`, customerId: c.alpha, invoiceDate: morningDate.toISOString(), subtotal: 250, taxAmount: 45, totalAmount: 295, paidAmount: 295, balanceAmount: 0, paymentStatus: 'PAID' })
    addInvoiceItem(i8, p.widgetB, `${PREFIX} Widget B`, 1, 250, 18, 0)
    const i9 = addInvoice({ invoiceNumber: `${PREFIX}-INV-0009`, customerId: c.delta, invoiceDate: eveningDate.toISOString(), subtotal: 300, taxAmount: 54, totalAmount: 354, paidAmount: 354, balanceAmount: 0, paymentStatus: 'PAID' })
    addInvoiceItem(i9, p.widgetC, `${PREFIX} Widget C`, 1, 300, 18, 0)

    // Payments (cash vs bank split)
    db.prepare(`INSERT INTO Payment (id, invoiceId, customerId, paymentMethod, amount, paymentDate, isReversed, createdAt) VALUES (?, ?, ?, 'CASH', ?, ?, 0, CURRENT_TIMESTAMP)`).run(id(), i2, null, 354, isoNow())
    db.prepare(`INSERT INTO Payment (id, invoiceId, customerId, paymentMethod, amount, paymentDate, isReversed, createdAt) VALUES (?, ?, ?, 'UPI', ?, ?, 0, CURRENT_TIMESTAMP)`).run(id(), i1, c.epsilon, 11800, isoNow())
    db.prepare(`INSERT INTO Payment (id, invoiceId, customerId, paymentMethod, amount, paymentDate, isReversed, createdAt) VALUES (?, ?, ?, 'BANK_TRANSFER', ?, ?, 0, CURRENT_TIMESTAMP)`).run(id(), i7, c.epsilon, 590000, thisMonth)

    // Second open quotation (DRAFT), plus the already-converted one counts as closed
    db.prepare(`INSERT INTO Quotation (id, quotationNumber, customerId, status, subtotal, taxAmount, discountAmount, totalAmount, createdBy, createdAt, updatedAt) VALUES (?, ?, ?, 'DRAFT', 15000, 2700, 0, 17700, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`)
      .run(id(), `${PREFIX}-QT-0002`, c.gamma, adminId)
    db.prepare(`INSERT INTO Quotation (id, quotationNumber, customerId, status, subtotal, taxAmount, discountAmount, totalAmount, createdBy, createdAt, updatedAt) VALUES (?, ?, ?, 'SENT', 12000, 2160, 0, 14160, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`)
      .run(id(), `${PREFIX}-QT-0003`, c.delta, adminId)

    // Purchase Orders + GRN
    const po1 = id()
    db.prepare(`INSERT INTO PurchaseOrder (id, poNumber, supplierId, orderDate, status, subtotal, taxAmount, totalAmount, createdAt, updatedAt) VALUES (?, ?, ?, ?, 'DRAFT', 5000, 900, 5900, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`)
      .run(po1, `${PREFIX}-PO-0001`, s.prime, isoNow())

    const poNum2 = `${PREFIX}-PO-0002`
    db.prepare(`INSERT INTO PurchaseOrder (id, poNumber, supplierId, orderDate, expectedDate, status, subtotal, taxAmount, totalAmount, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, 'APPROVED', 8000, 1440, 9440, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`)
      .run(id(), poNum2, s.prime, fiveDaysAgo, fiveDaysAgo)

    const po3 = id()
    db.prepare(`INSERT INTO PurchaseOrder (id, poNumber, supplierId, orderDate, status, subtotal, taxAmount, totalAmount, createdAt, updatedAt) VALUES (?, ?, ?, ?, 'RECEIVED', 6000, 1080, 7080, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`)
      .run(po3, `${PREFIX}-PO-0003`, s.prime, thisMonth)
    db.prepare(`INSERT INTO PurchaseOrderItem (id, purchaseOrderId, productId, quantity, unitCost, taxRate, taxAmount, total, createdAt) VALUES (?, ?, ?, 30, 200, 18, 1080, 7080, CURRENT_TIMESTAMP)`)
      .run(id(), po3, p.purchased)

    const po4 = id()
    const po4Order = daysFromNow(-5)
    const po4Received = daysFromNow(-3)
    db.prepare(`INSERT INTO PurchaseOrder (id, poNumber, supplierId, orderDate, status, subtotal, taxAmount, totalAmount, createdAt, updatedAt) VALUES (?, ?, ?, ?, 'RECEIVED', 4000, 720, 4720, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`)
      .run(po4, `${PREFIX}-PO-0004`, s.fast, po4Order)
    db.prepare(`INSERT INTO GoodsReceiptNote (id, grnNumber, supplierId, supplierName, purchaseOrderId, receivedDate, totalValue, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, 4720, 'POSTED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`)
      .run(id(), `${PREFIX}-GRN-0001`, s.fast, `${PREFIX} Fast Supplier`, po4, po4Received)

    db.prepare(`INSERT INTO PurchaseOrder (id, poNumber, supplierId, orderDate, status, subtotal, taxAmount, totalAmount, createdAt, updatedAt) VALUES (?, ?, ?, ?, 'RECEIVED', 3000, 540, 3540, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`)
      .run(id(), `${PREFIX}-PO-0005`, s.stale, twoHundredDaysAgo)

    // Credit / Debit notes
    db.prepare(`INSERT INTO CreditNote (id, creditNoteNumber, customerId, invoiceId, reason, amount, createdBy, createdAt, updatedAt) VALUES (?, ?, ?, ?, 'Damaged goods', 300, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`)
      .run(id(), `${PREFIX}-CN-0001`, c.beta, i4, adminId)
    db.prepare(`INSERT INTO DebitNote (id, debitNoteNumber, supplierId, purchaseOrderId, reason, amount, createdBy, createdAt, updatedAt) VALUES (?, ?, ?, ?, 'Price correction', 400, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`)
      .run(id(), `${PREFIX}-DN-0001`, s.prime, po3, adminId)

    // Expenses
    const expCat = id()
    db.prepare(`INSERT INTO ExpenseCategory (id, categoryName, createdAt) VALUES (?, ?, CURRENT_TIMESTAMP)`).run(expCat, `${PREFIX} Marketing`)
    db.prepare(`INSERT INTO Expense (id, categoryId, expenseName, amount, expenseDate, paymentMethod, createdAt, updatedAt) VALUES (?, ?, ?, 1500, ?, 'CASH', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`)
      .run(id(), expCat, `${PREFIX} Ad Campaign`, thisMonth)
    db.prepare(`INSERT INTO Expense (id, categoryId, expenseName, amount, expenseDate, paymentMethod, createdAt, updatedAt) VALUES (?, ?, ?, 800, ?, 'CASH', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`)
      .run(id(), expCat, `${PREFIX} Print Flyers`, thisMonth)

    // Employees, attendance, leave, payroll
    const e1 = id(); const e2 = id()
    db.prepare(`INSERT INTO Employee (id, fullName, joinDate, isActive, salaryType, basicSalary, allowances, createdAt, updatedAt) VALUES (?, ?, ?, 1, 'MONTHLY', 30000, '[]', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`)
      .run(e1, `${PREFIX} Employee One`, twoHundredDaysAgo)
    db.prepare(`INSERT INTO Employee (id, fullName, joinDate, isActive, salaryType, basicSalary, allowances, createdAt, updatedAt) VALUES (?, ?, ?, 1, 'MONTHLY', 25000, '[]', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`)
      .run(e2, `${PREFIX} Employee Two`, twoHundredDaysAgo)

    // generateAttendanceReport compares Attendance.date against
    // `new Date(dateFromString)`, i.e. UTC midnight of that Y-M-D string —
    // NOT local midnight. Seeding with local-midnight.toISOString() (the
    // exact bug class fixed elsewhere this session) would land "today"'s
    // row on the wrong side of the boundary on this IST machine. Store UTC
    // midnight of the LOCAL calendar date instead, matching what the app's
    // own toLocalISODate()-derived query string actually resolves to.
    const utcMidnightOfLocalDate = (d) => new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString()
    const today = new Date()
    db.prepare(`INSERT INTO Attendance (id, employeeId, date, status, createdAt, updatedAt) VALUES (?, ?, ?, 'PRESENT', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`).run(id(), e1, utcMidnightOfLocalDate(today))
    db.prepare(`INSERT INTO Attendance (id, employeeId, date, status, createdAt, updatedAt) VALUES (?, ?, ?, 'LEAVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`).run(id(), e2, utcMidnightOfLocalDate(today))
    // A spread of days this month for best/worst attendance
    for (let dOff = 1; dOff <= 5; dOff++) {
      const d = new Date(); d.setDate(1); d.setDate(d.getDate() + dOff)
      if (d > new Date()) continue
      db.prepare(`INSERT OR IGNORE INTO Attendance (id, employeeId, date, status, createdAt, updatedAt) VALUES (?, ?, ?, 'PRESENT', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`).run(id(), e1, utcMidnightOfLocalDate(d))
      db.prepare(`INSERT OR IGNORE INTO Attendance (id, employeeId, date, status, createdAt, updatedAt) VALUES (?, ?, ?, 'ABSENT', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`).run(id(), e2, utcMidnightOfLocalDate(d))
    }
    db.prepare(`INSERT INTO SalaryPayment (id, employeeId, periodYear, periodMonth, basicSalary, allowances, grossSalary, deductions, netPayable, status, paidDate, paymentMethod, createdAt, updatedAt) VALUES (?, ?, ?, ?, 30000, '[]', 30000, '[]', 30000, 'PAID', CURRENT_TIMESTAMP, 'BANK_TRANSFER', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`)
      .run(id(), e1, now.getFullYear(), now.getMonth() + 1)

    // Inventory movement (adjustment)
    db.prepare(`INSERT INTO InventoryMovement (id, productId, movementType, quantity, createdAt) VALUES (?, ?, 'ADJUSTMENT', -20, CURRENT_TIMESTAMP)`).run(id(), p.adjustmentWidget)

    db.exec('COMMIT')

    ids.invoiceNumber = invNum1
    ids.poNumber = poNum2
  })
  return ids
}

function seedVerticals(adminId) {
  h.withDb((db) => {
    db.exec('BEGIN')

    // LAWYER
    const lawyerClient = id()
    db.prepare(`INSERT INTO Customer (id, customerName, isActive, createdAt, updatedAt) VALUES (?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`).run(lawyerClient, `${PREFIX} Legal Client`)
    const legalCase = id()
    db.prepare(`INSERT INTO LegalCase (id, caseNumber, caseTitle, caseType, courtName, clientId, status, nextHearingDate, feeCollected, createdAt, updatedAt) VALUES (?, ?, ?, 'CIVIL', ?, ?, 'ACTIVE', ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`)
      .run(legalCase, `${PREFIX}-CASE-0001`, `${PREFIX} vs Opposing Party`, `${PREFIX} District Court`, lawyerClient, daysFromNow(3))
    db.prepare(`INSERT INTO Hearing (id, caseId, hearingDate, status, createdAt, updatedAt) VALUES (?, ?, ?, 'SCHEDULED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`)
      .run(id(), legalCase, daysFromNow(3))
    db.prepare(`INSERT INTO TimeEntry (id, caseId, date, description, hours, ratePerHour, amount, isBilled, createdAt, updatedAt) VALUES (?, ?, ?, ?, 5, 1000, 5000, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`)
      .run(id(), legalCase, isoNow(), `${PREFIX} Research`)

    // CA_FIRM
    const caClient = id()
    db.prepare(`INSERT INTO Customer (id, customerName, isActive, createdAt, updatedAt) VALUES (?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`).run(caClient, `${PREFIX} CA Client`)
    db.prepare(`INSERT INTO ROCFiling (id, clientId, formType, status, dueDate, createdAt, updatedAt) VALUES (?, ?, 'AOC-4', 'PENDING', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`)
      .run(id(), caClient, daysFromNow(15))

    // ARCHITECT
    const archClient = id()
    db.prepare(`INSERT INTO Customer (id, customerName, isActive, createdAt, updatedAt) VALUES (?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`).run(archClient, `${PREFIX} Architect Client`)
    const archProject = id()
    db.prepare(`INSERT INTO ServiceProject (id, clientId, projectName, status, createdAt, updatedAt) VALUES (?, ?, ?, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`).run(archProject, archClient, `${PREFIX} Arch Project`)
    db.prepare(`INSERT INTO DrawingRevision (id, projectId, drawingNumber, title, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, 'ISSUED_FOR_REVIEW', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`)
      .run(id(), archProject, `${PREFIX}-DWG-01`, `${PREFIX} Floor Plan`)

    // CIVIL_ENGINEER
    const civilClient = id()
    db.prepare(`INSERT INTO Customer (id, customerName, isActive, createdAt, updatedAt) VALUES (?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`).run(civilClient, `${PREFIX} Civil Client`)
    const civilProject = id()
    db.prepare(`INSERT INTO ServiceProject (id, clientId, projectName, status, createdAt, updatedAt) VALUES (?, ?, ?, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`).run(civilProject, civilClient, `${PREFIX} Civil Project`)
    db.prepare(`INSERT INTO SiteVisit (id, projectId, visitDate, visitType, createdAt, updatedAt) VALUES (?, ?, ?, 'INSPECTION', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`)
      .run(id(), civilProject, daysFromNow(3))

    // REAL_ESTATE
    const realEstateOwner = id()
    db.prepare(`INSERT INTO Customer (id, customerName, isActive, createdAt, updatedAt) VALUES (?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`).run(realEstateOwner, `${PREFIX} Property Owner`)
    db.prepare(`INSERT INTO Property (id, propertyType, listingType, status, location, area, ownerClientId, createdAt, updatedAt) VALUES (?, 'RESIDENTIAL_FLAT', 'SALE', 'AVAILABLE', ?, 1200, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`)
      .run(id(), `${PREFIX} Location`, realEstateOwner)

    // SOFTWARE_AGENCY
    const swClient = id()
    db.prepare(`INSERT INTO Customer (id, customerName, isActive, createdAt, updatedAt) VALUES (?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`).run(swClient, `${PREFIX} Software Client`)
    const swProject = id()
    db.prepare(`INSERT INTO ServiceProject (id, clientId, projectName, status, createdAt, updatedAt) VALUES (?, ?, ?, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`).run(swProject, swClient, `${PREFIX} Software Project`)
    db.prepare(`INSERT INTO Issue (id, projectId, title, priority, status, reportedDate, createdAt, updatedAt) VALUES (?, ?, ?, 'HIGH', 'OPEN', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`)
      .run(id(), swProject, `${PREFIX} Login bug`)
    db.prepare(`INSERT INTO Issue (id, projectId, title, priority, status, reportedDate, createdAt, updatedAt) VALUES (?, ?, ?, 'MED', 'IN_PROGRESS', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`)
      .run(id(), swProject, `${PREFIX} Slow report`)

    // PHOTO_STUDIO
    const photoClient = id()
    db.prepare(`INSERT INTO Customer (id, customerName, isActive, createdAt, updatedAt) VALUES (?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`).run(photoClient, `${PREFIX} Photo Client`)
    db.prepare(`INSERT INTO ShootBooking (id, clientId, shootType, shootDate, shootLocation, estimatedDurationHours, status, createdAt, updatedAt) VALUES (?, ?, 'WEDDING', ?, ?, 4, 'CONFIRMED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`)
      .run(id(), photoClient, daysFromNow(5), `${PREFIX} Venue`)

    // EVENT_MANAGEMENT
    const eventClient = id()
    db.prepare(`INSERT INTO Customer (id, customerName, isActive, createdAt, updatedAt) VALUES (?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`).run(eventClient, `${PREFIX} Event Client`)
    db.prepare(`INSERT INTO EventBooking (id, clientId, eventName, eventType, eventDate, venueName, status, createdAt, updatedAt) VALUES (?, ?, ?, 'CORPORATE', ?, ?, 'CONFIRMED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`)
      .run(id(), eventClient, `${PREFIX} Annual Meet`, daysFromNow(10), `${PREFIX} Hall`)

    // DRIVING_SCHOOL
    const learner = id()
    db.prepare(`INSERT INTO Customer (id, customerName, isActive, createdAt, updatedAt) VALUES (?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`).run(learner, `${PREFIX} Learner One`)
    db.prepare(`INSERT INTO LearnerProfile (id, customerId, licenseClass, createdAt, updatedAt) VALUES (?, ?, 'LMV', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`).run(id(), learner)
    db.prepare(`INSERT INTO DrivingTest (id, learnerId, testType, testDate, testCenter, result, createdAt, updatedAt) VALUES (?, ?, 'LL_TEST', ?, ?, 'PENDING', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`)
      .run(id(), learner, daysFromNow(5), `${PREFIX} Test Center`)
    const drivingPkg = id()
    db.prepare(`INSERT INTO DrivingPackage (id, packageName, totalSessions, price, vehicleClass, isActive, createdAt, updatedAt) VALUES (?, ?, 10, 5000, 'LMV', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`)
      .run(drivingPkg, `${PREFIX} 10-Lesson Package`)
    db.prepare(`INSERT INTO DrivingPackageEnrollment (id, learnerId, packageId, sessionsUsed, purchaseDate, createdAt, updatedAt) VALUES (?, ?, ?, 9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`)
      .run(id(), learner, drivingPkg)

    // TAILOR_BOUTIQUE
    const tailorClient = id()
    db.prepare(`INSERT INTO Customer (id, customerName, isActive, createdAt, updatedAt) VALUES (?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`).run(tailorClient, `${PREFIX} Tailor Client`)
    db.prepare(`INSERT INTO TailoringOrder (id, orderNumber, clientId, garmentType, deliveryDate, status, createdAt, updatedAt) VALUES (?, ?, ?, 'SUIT', ?, 'IN_STITCHING', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`)
      .run(id(), `${PREFIX}-TO-0001`, tailorClient, daysFromNow(3))

    // PEST_CONTROL
    const pestClient = id()
    db.prepare(`INSERT INTO Customer (id, customerName, isActive, createdAt, updatedAt) VALUES (?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`).run(pestClient, `${PREFIX} Pest Client`)
    db.prepare(`INSERT INTO PestServiceContract (id, contractNumber, clientId, propertyAddress, startDate, endDate, contractValue, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, 12000, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`)
      .run(id(), `${PREFIX}-PC-0001`, pestClient, `${PREFIX} Address`, daysFromNow(-350), daysFromNow(15))

    // VET_CLINIC
    const petOwner = id()
    db.prepare(`INSERT INTO Customer (id, customerName, isActive, createdAt, updatedAt) VALUES (?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`).run(petOwner, `${PREFIX} Pet Owner`)
    const pet = id()
    db.prepare(`INSERT INTO Pet (id, customerId, petName, species, isActive, createdAt, updatedAt) VALUES (?, ?, ?, 'Dog', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`).run(pet, petOwner, `${PREFIX} Rex`)
    db.prepare(`INSERT INTO VaccinationRecord (id, petId, vaccineName, administeredAt, nextDueDate, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`)
      .run(id(), pet, `${PREFIX} Rabies`, daysFromNow(-355), daysFromNow(10))

    // DENTAL_CLINIC
    const dentalPatient = id()
    db.prepare(`INSERT INTO Customer (id, customerName, isActive, createdAt, updatedAt) VALUES (?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`).run(dentalPatient, `${PREFIX} Dental Patient`)
    db.prepare(`INSERT INTO RecallRecord (id, patientId, recallType, lastVisitDate, nextRecallDate, createdAt, updatedAt) VALUES (?, ?, 'HYGIENE_6M', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`)
      .run(id(), dentalPatient, daysFromNow(-170), daysFromNow(10))

    // CAR_SERVICE_CENTER
    const carClient = id()
    db.prepare(`INSERT INTO Customer (id, customerName, isActive, createdAt, updatedAt) VALUES (?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`).run(carClient, `${PREFIX} Car Client`)
    db.prepare(`INSERT INTO CarJobCard (id, jobNumber, clientId, vehicleNumber, vehicleMake, vehicleModel, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, 'IN_PROGRESS', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`)
      .run(id(), `${PREFIX}-CJ-0001`, carClient, `${PREFIX}-CAR-01`, `${PREFIX}Make`, `${PREFIX}Model`)

    // COACHING_INSTITUTE
    const student = id()
    db.prepare(`INSERT INTO Customer (id, customerName, isActive, createdAt, updatedAt) VALUES (?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`).run(student, `${PREFIX} Student One`)
    const batch = id()
    db.prepare(`INSERT INTO CoachingBatch (id, batchName, subjectOrCourse, startDate, status, feePerMonth, createdAt, updatedAt) VALUES (?, ?, ?, CURRENT_TIMESTAMP, 'ACTIVE', 3000, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`)
      .run(batch, `${PREFIX} Batch A`, `${PREFIX} Maths`)
    const enrollment = id()
    db.prepare(`INSERT INTO CoachingBatchEnrollment (id, batchId, studentId, status, effectiveFee, createdAt, updatedAt) VALUES (?, ?, ?, 'ACTIVE', 3000, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`)
      .run(enrollment, batch, student)
    db.prepare(`INSERT INTO CoachingFeeRecord (id, enrollmentId, studentId, batchId, feeMonth, amountDue, amountReceived, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, 3000, 0, 'PENDING', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`)
      .run(id(), enrollment, student, batch, monthKey())
    const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - weekStart.getDay())
    db.prepare(`INSERT INTO CoachingBatchAttendance (id, batchId, attendanceDate, presentStudentIds, absentStudentIds, createdAt, updatedAt) VALUES (?, ?, ?, ?, '[]', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`)
      .run(id(), batch, weekStart.toISOString(), JSON.stringify([student]))

    // DIAGNOSTIC_LAB
    db.prepare(`INSERT INTO LabTestOrder (id, orderNumber, patientName, status, createdBy, createdAt, updatedAt) VALUES (?, ?, ?, 'ORDERED', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`)
      .run(id(), `${PREFIX}-LAB-0001`, `${PREFIX} Lab Patient`, adminId)

    // PLACEMENT_AGENCY
    db.prepare(`INSERT INTO Candidate (id, candidateNumber, fullName, status, createdAt, updatedAt) VALUES (?, ?, ?, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`)
      .run(id(), `${PREFIX}-CAND-0001`, `${PREFIX} Candidate Active`)
    db.prepare(`INSERT INTO Candidate (id, candidateNumber, fullName, status, createdAt, updatedAt) VALUES (?, ?, ?, 'PLACED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`)
      .run(id(), `${PREFIX}-CAND-0002`, `${PREFIX} Candidate Placed`)

    db.exec('COMMIT')
  })
  return {}
}

// Real bug found running this suite (2026-07-15): the original version of
// this function skipped any table with no name-like column of its own
// (Payment, InventoryMovement, Attendance, etc.) on the theory that Prisma's
// onDelete:Cascade would clean them up automatically — but several FKs in
// this schema (Payment.invoiceId, GoodsReceiptNote.purchaseOrderId,
// SalaryPayment.employeeId, DrivingPackageEnrollment.packageId, and others)
// have NO onDelete clause, which Prisma/SQLite defaults to RESTRICT. A
// leftover Payment row silently blocked re-deleting its Invoice, the
// `catch {}` swallowed the FK error, and the NEXT run's re-seed then hit a
// UNIQUE constraint on the same invoiceNumber. Fixed by collecting root IDs
// first and explicitly deleting every child table that references them, in
// leaf-to-root order, rather than assuming cascade behavior.

// Every (table, dateColumn, nameLikeColumn) triple whose date value was set
// explicitly by seedUniversal/seedVerticals above and could plausibly be
// read by a date-range filter in one of the 70 templates under test. Errs
// inclusive — converting an already-correct INTEGER column is a no-op
// (guarded by `typeof(...) = 'text'`), so there's no cost to listing a few
// that turn out not to matter.
const DATE_COLUMNS_TO_FIX = [
  ['Customer', 'createdAt', 'customerName'],
  ['Product', 'createdAt', 'productName'],
  ['Invoice', 'invoiceDate', 'invoiceNumber'],
  ['Quotation', 'createdAt', 'quotationNumber'],
  ['Payment', 'paymentDate', null],
  ['PurchaseOrder', 'orderDate', 'poNumber'],
  ['PurchaseOrder', 'expectedDate', 'poNumber'],
  ['GoodsReceiptNote', 'receivedDate', 'grnNumber'],
  ['CreditNote', 'createdAt', 'creditNoteNumber'],
  ['DebitNote', 'createdAt', 'debitNoteNumber'],
  ['Expense', 'expenseDate', 'expenseName'],
  ['Attendance', 'date', null],
  ['InventoryMovement', 'createdAt', null],
  ['LegalCase', 'nextHearingDate', 'caseTitle'],
  ['Hearing', 'hearingDate', null],
  ['TimeEntry', 'date', 'description'],
  ['ROCFiling', 'dueDate', null],
  ['SiteVisit', 'visitDate', null],
  ['ShootBooking', 'shootDate', null],
  ['EventBooking', 'eventDate', 'eventName'],
  ['DrivingTest', 'testDate', null],
  ['TailoringOrder', 'deliveryDate', 'orderNumber'],
  ['PestServiceContract', 'startDate', 'contractNumber'],
  ['PestServiceContract', 'endDate', 'contractNumber'],
  ['VaccinationRecord', 'administeredAt', 'vaccineName'],
  ['VaccinationRecord', 'nextDueDate', 'vaccineName'],
  ['RecallRecord', 'lastVisitDate', null],
  ['RecallRecord', 'nextRecallDate', null],
  ['CoachingBatchAttendance', 'attendanceDate', null],
  ['LabTestOrder', 'createdAt', 'orderNumber'],
]

function fixDateColumnTypes() {
  h.withDb((db) => {
    const like = `${PREFIX}%`
    for (const [table, col, nameCol] of DATE_COLUMNS_TO_FIX) {
      try {
        if (nameCol) {
          db.prepare(`UPDATE ${table} SET ${col} = CAST(strftime('%s', ${col}) AS INTEGER) * 1000 WHERE ${nameCol} LIKE ? AND typeof(${col}) = 'text'`).run(like)
        } else {
          // No name-like column on this table (a child row) — every row in
          // it for this run is already scoped to UAT70 fixtures via its own
          // FK chain, so just convert every TEXT-stored value unconditionally.
          db.prepare(`UPDATE ${table} SET ${col} = CAST(strftime('%s', ${col}) AS INTEGER) * 1000 WHERE typeof(${col}) = 'text'`).run()
        }
      } catch (e) {
        console.log(`  WARNING: date-fix failed for ${table}.${col}:`, e.message)
      }
    }
  })
}

function cleanupUat70() {
  h.withDb((db) => {
    const like = `${PREFIX}%`
    const ids = (table, col) => db.prepare(`SELECT id FROM ${table} WHERE ${col} LIKE ?`).all(like).map((r) => r.id)
    const del = (sql, ...params) => { try { db.prepare(sql).run(...params) } catch { /* best effort */ } }
    const delIn = (table, col, idList) => {
      if (idList.length === 0) return
      const placeholders = idList.map(() => '?').join(',')
      del(`DELETE FROM ${table} WHERE ${col} IN (${placeholders})`, ...idList)
    }

    db.exec('BEGIN')

    const invoiceIds = ids('Invoice', 'invoiceNumber')
    const poIds = ids('PurchaseOrder', 'poNumber')
    const custIds = ids('Customer', 'customerName')
    const employeeIds = ids('Employee', 'fullName')
    const caseIds = ids('LegalCase', 'caseTitle')
    const projectIds = [...ids('ServiceProject', 'projectName')]
    const batchIds = ids('CoachingBatch', 'batchName')
    const packageIds = ids('DrivingPackage', 'packageName')
    const petIds = db.prepare(`SELECT id FROM Pet WHERE petName LIKE ?`).all(like).map((r) => r.id)
    const productIds = ids('Product', 'productName')

    // Leaf tables referencing the roots above.
    delIn('Payment', 'invoiceId', invoiceIds)
    delIn('InvoiceItem', 'invoiceId', invoiceIds)
    delIn('CreditNote', 'invoiceId', invoiceIds)
    delIn('GoodsReceiptNote', 'purchaseOrderId', poIds)
    delIn('DebitNote', 'purchaseOrderId', poIds)
    delIn('PurchaseOrderItem', 'purchaseOrderId', poIds)
    delIn('Hearing', 'caseId', caseIds)
    delIn('TimeEntry', 'caseId', caseIds)
    delIn('TimeEntry', 'projectId', projectIds)
    delIn('DrawingRevision', 'projectId', projectIds)
    delIn('SiteVisit', 'projectId', projectIds)
    delIn('Issue', 'projectId', projectIds)
    delIn('CoachingFeeRecord', 'batchId', batchIds)
    delIn('CoachingBatchAttendance', 'batchId', batchIds)
    delIn('CoachingBatchEnrollment', 'batchId', batchIds)
    delIn('DrivingPackageEnrollment', 'packageId', packageIds)
    delIn('VaccinationRecord', 'petId', petIds)
    delIn('Inventory', 'productId', productIds)
    delIn('InventoryMovement', 'productId', productIds)
    delIn('SalaryPayment', 'employeeId', employeeIds)
    delIn('Attendance', 'employeeId', employeeIds)
    del(`DELETE FROM ROCFiling WHERE clientId IN (${custIds.map(() => '?').join(',') || "''"})`, ...custIds)
    del(`DELETE FROM Property WHERE ownerClientId IN (${custIds.map(() => '?').join(',') || "''"})`, ...custIds)
    del(`DELETE FROM ShootBooking WHERE clientId IN (${custIds.map(() => '?').join(',') || "''"})`, ...custIds)
    del(`DELETE FROM EventBooking WHERE clientId IN (${custIds.map(() => '?').join(',') || "''"})`, ...custIds)
    del(`DELETE FROM LearnerProfile WHERE customerId IN (${custIds.map(() => '?').join(',') || "''"})`, ...custIds)
    del(`DELETE FROM DrivingTest WHERE learnerId IN (${custIds.map(() => '?').join(',') || "''"})`, ...custIds)
    del(`DELETE FROM TailoringOrder WHERE clientId IN (${custIds.map(() => '?').join(',') || "''"})`, ...custIds)
    del(`DELETE FROM PestServiceContract WHERE clientId IN (${custIds.map(() => '?').join(',') || "''"})`, ...custIds)
    del(`DELETE FROM Pet WHERE customerId IN (${custIds.map(() => '?').join(',') || "''"})`, ...custIds)
    del(`DELETE FROM RecallRecord WHERE patientId IN (${custIds.map(() => '?').join(',') || "''"})`, ...custIds)
    del(`DELETE FROM CarJobCard WHERE clientId IN (${custIds.map(() => '?').join(',') || "''"})`, ...custIds)

    // Roots (children of these, and of Customer above, are now gone).
    delIn('Invoice', 'id', invoiceIds)
    delIn('PurchaseOrder', 'id', poIds)
    del(`DELETE FROM Quotation WHERE quotationNumber LIKE ?`, like)
    del(`DELETE FROM LegalCase WHERE id IN (${caseIds.map(() => '?').join(',') || "''"})`, ...caseIds)
    del(`DELETE FROM ServiceProject WHERE id IN (${projectIds.map(() => '?').join(',') || "''"})`, ...projectIds)
    del(`DELETE FROM CoachingBatch WHERE id IN (${batchIds.map(() => '?').join(',') || "''"})`, ...batchIds)
    del(`DELETE FROM DrivingPackage WHERE id IN (${packageIds.map(() => '?').join(',') || "''"})`, ...packageIds)
    del(`DELETE FROM LabTestOrder WHERE orderNumber LIKE ?`, like)
    del(`DELETE FROM Candidate WHERE candidateNumber LIKE ?`, like)
    del(`DELETE FROM Expense WHERE expenseName LIKE ?`, like)
    del(`DELETE FROM ExpenseCategory WHERE categoryName LIKE ?`, like)
    delIn('Employee', 'id', employeeIds)
    delIn('Product', 'id', productIds)
    del(`DELETE FROM ProductCategory WHERE name LIKE ?`, like)
    del(`DELETE FROM Supplier WHERE supplierName LIKE ?`, like)
    delIn('Customer', 'id', custIds)

    db.exec('COMMIT')
  })
}

main().catch((e) => { console.error('FATAL', e); process.exit(1) })
