/**
 * Full verification of every AI query template (~111 identifiers found in
 * ai-query.service.ts + ai-vertical-templates.service.ts) against the REAL
 * PACKAGED, freshly-installed app — not dev mode. Combines:
 *  - The 70 templates already covered by uat-70-templates.js (re-run here
 *    fresh, against the new build, not trusted from history)
 *  - The ~41 templates that file's own header says were never covered
 *    ("the original 40 already have live-verification history" — a claim
 *    this run exists specifically to check, not assume)
 *
 * Points at the packaged install's real exe + real userData db, not the dev
 * ones. The DB found here ("E2E Fresh Install Traders", RETAIL) is itself
 * leftover test fixture data from a prior verification session, not a real
 * person's business — safe to mutate business type / admin password here,
 * unlike a genuine user's install.
 */
const { _electron } = require('D:/Sarang(business OS LITE)/sarang-business-os/node_modules/playwright-core')
const { DatabaseSync } = require('node:sqlite')
const bcrypt = require('D:/Sarang(business OS LITE)/sarang-business-os/node_modules/bcryptjs')
const crypto = require('crypto')
const fs = require('fs')

const EXE_PATH = 'C:/Users/vishw/AppData/Local/Programs/Sarang Business OS Lite/Sarang Business OS Lite.exe'
const DB_PATH = 'C:/Users/vishw/AppData/Roaming/sarang-business-os/sarang.db'
const TEST_PASSWORD = 'PackagedVerify!2026'
const PREFIX = 'PKGV'

function withDb(fn) {
  const db = new DatabaseSync(DB_PATH)
  try { return fn(db) } finally { db.close() }
}

function id() { return PREFIX + crypto.randomBytes(8).toString('hex') }

function setBusinessType(bt) {
  withDb((db) => db.prepare('UPDATE BusinessProfile SET businessType = ? WHERE id = (SELECT id FROM BusinessProfile LIMIT 1)').run(bt))
}

function enableAiForType(bt) {
  withDb((db) => {
    const existing = db.prepare('SELECT id, enabledModules FROM IndustryTemplateSetting WHERE businessType = ?').get(bt)
    if (existing) {
      const mods = new Set(JSON.parse(existing.enabledModules || '[]'))
      mods.add('ai_assistant')
      db.prepare('UPDATE IndustryTemplateSetting SET enabledModules = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').run(JSON.stringify([...mods]), existing.id)
    } else {
      db.prepare('INSERT INTO IndustryTemplateSetting (id, businessType, enabledModules, createdAt, updatedAt) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)').run(id(), bt, JSON.stringify(['ai_assistant']))
    }
  })
}

async function ask(page, template, businessType, question) {
  const t0 = Date.now()
  try {
    const res = await page.evaluate((q) => window.api.ai.query({ question: q }), question)
    const ms = Date.now() - t0
    const log = withDb((db) => db.prepare('SELECT matchedTemplate, matchedCategory, success FROM AiQueryLog ORDER BY createdAt DESC LIMIT 1').get())
    return {
      template, businessType, question,
      matched: log?.matchedTemplate ?? null,
      correctMatch: log?.matchedTemplate === template,
      success: !!res?.success,
      answer: res?.success ? String(res.data.answer).slice(0, 200) : JSON.stringify(res?.error).slice(0, 200),
      ms,
      errored: !res?.success,
    }
  } catch (e) {
    return { template, businessType, question, matched: null, correctMatch: false, success: false, answer: 'THREW: ' + String(e.message || e), ms: Date.now() - t0, errored: true }
  }
}

// ── The 70 already covered by uat-70-templates.js (re-run fresh here) ──
const UNIVERSAL_70 = [
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

const VERTICAL_70 = [
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

// ── The ~41 templates with NO confirmed prior live-verification ──────────
const GAP_UNIVERSAL = [
  ['credit.whoOwesMe', 'Who owes me money?'],
  ['credit.totalReceivable', "What's my total receivable amount?"],
  ['credit.overdueInvoices', 'Which invoices are overdue?'],
  ['customers.outstandingBalances', 'Which customers have outstanding balances?'],
  ['customers.noRecentPurchases', "Which customers haven't purchased recently?"],
  ['customers.topThisPeriod', 'Who are my top customers this period?'],
  ['finance.profitAndLoss', 'What is my profit this month?'],
  ['inventory.lowStock', "What's low on stock?"],
  ['inventory.deadStock', 'What products have not sold recently?'],
  ['inventory.topRevenueProducts', 'What are my best-selling products?'],
  ['inventory.bottomRevenueProducts', 'What are my worst-selling products?'],
  ['sales.totalToday', 'How much did I sell today?'],
  ['sales.totalThisWeek', 'How much did I sell this week?'],
  ['sales.totalThisMonth', 'How much did I sell this month?'],
  ['sales.averageInvoiceValue', "What's my average invoice value?"],
  ['sales.compareToPreviousPeriod', 'How does this month compare to last month?'],
  ['suppliers.pendingPayments', 'What payments are pending to suppliers?'],
  ['suppliers.topByPurchaseVolume', 'Who do I buy the most from?'],
  ['meta.capabilities', 'What can you do?'],
  ['meta.suggestions', 'What should I look at today?'],
]

const GAP_VERTICAL = [
  ['MANUFACTURING', [['manufacturing.production', 'How is production going this month?']]],
  ['RESTAURANT', [['restaurant.foodCost', "What's my food cost this month?"], ['restaurant.orderVolume', "What's my order volume this month?"]]],
  ['RETAIL', [['retail.variantStock', 'What is my variant stock breakdown?']]],
  ['HOTEL_LODGE', [['hotel.occupancy', "What's my room occupancy right now?"]]],
  ['JEWELLERY', [['jewellery.stockAndSales', "What's my jewellery stock and sales position?"]]],
  ['BLOOD_BANK', [['bloodBank.stock', "What's my current blood stock?"]]],
  ['DIAGNOSTIC_LAB', [['lab.throughput', "What's my lab throughput this month?"]]],
  ['ELECTRONICS', [['electronics.serialWarranty', 'Which products have warranty coming due?']]],
  ['CA_FIRM', [['compliance.tasks', 'What compliance tasks are pending?']]],
  ['COACHING_INSTITUTE', [['coaching.testScores', 'How are test scores trending?']]],
  ['PLACEMENT_AGENCY', [['placement.summary', "What's my placement summary this month?"]]],
  ['RENTAL', [['rental.status', "What's my rental status right now?"], ['rental.revenue', "What's my rental revenue this month?"]]],
  ['REPAIR', [['repair.jobCards', 'How many job cards are open?']]],
  ['SOFTWARE_AGENCY', [['service.projects', 'How are my projects doing?'], ['service.openIssues', 'How many open issues do I have?']]],
  ['CONSULTANT', [['service.clientRetention', "What's my client retention rate?"], ['service.commission', 'How much commission is owed?'], ['service.appointmentUtilisation', "What's my appointment utilisation this week?"]]],
  ['LOGISTICS', [['logistics.summary', "What's my logistics summary this month?"]]],
]

async function main() {
  const results = []
  console.log('=== Backing up admin password hash ===')
  const originalHash = withDb((db) => db.prepare("SELECT passwordHash FROM User WHERE username = 'admin'").get()?.passwordHash)
  const originalBusinessType = withDb((db) => db.prepare('SELECT businessType FROM BusinessProfile LIMIT 1').get()?.businessType)
  console.log('Original business type:', originalBusinessType)

  withDb((db) => {
    const hash = bcrypt.hashSync(TEST_PASSWORD, 12)
    db.prepare("UPDATE User SET passwordHash = ? WHERE username = 'admin'").run(hash)
  })

  const allTypes = new Set([
    'GENERAL', 'RETAIL', 'MANUFACTURING', 'RESTAURANT', 'HOTEL_LODGE', 'JEWELLERY', 'BLOOD_BANK', 'DIAGNOSTIC_LAB',
    'ELECTRONICS', 'CA_FIRM', 'COACHING_INSTITUTE', 'PLACEMENT_AGENCY', 'RENTAL', 'REPAIR', 'SOFTWARE_AGENCY',
    'CONSULTANT', 'LAWYER', 'ARCHITECT', 'CIVIL_ENGINEER', 'REAL_ESTATE', 'PHOTO_STUDIO', 'EVENT_MANAGEMENT',
    'DRIVING_SCHOOL', 'TAILOR_BOUTIQUE', 'PEST_CONTROL', 'VET_CLINIC', 'DENTAL_CLINIC', 'CAR_SERVICE_CENTER', 'LOGISTICS',
  ])
  for (const bt of allTypes) enableAiForType(bt)

  let app
  try {
    app = await _electron.launch({ executablePath: EXE_PATH })
    let page = await app.firstWindow()
    if (page.url().includes('splash.html')) {
      const p = app.waitForEvent('window')
      await page.waitForEvent('close').catch(() => {})
      page = await p
    }
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(1500)

    // Login
    await page.waitForFunction(() => !!window.api, { timeout: 15000 })
    for (let attempt = 0; attempt < 6; attempt++) {
      const who = await page.evaluate(async () => window.api.auth.getCurrentUser()).catch(() => null)
      if (who?.success) break
      const userInput = page.locator('input[name="username"], input#username, input[placeholder="Username"]')
      if (await userInput.count()) {
        await userInput.first().fill('admin')
        await page.locator('input[type="password"], input#password, input[placeholder="Password"]').first().fill(TEST_PASSWORD)
        await page.locator('button[type="submit"], button:has-text("Sign In")').first().click()
      }
      await page.waitForTimeout(1500)
    }
    console.log('=== Logged in ===')

    setBusinessType('GENERAL')
    await page.waitForTimeout(300)
    console.log('\n=== GAP_UNIVERSAL (' + GAP_UNIVERSAL.length + ') ===')
    for (const [tmpl, q] of GAP_UNIVERSAL) {
      const r = await ask(page, tmpl, 'GENERAL', q)
      results.push(r)
      console.log(`[${r.correctMatch ? 'OK' : 'MISS'}] ${tmpl} (${r.ms}ms) matched=${r.matched}`)
    }

    console.log('\n=== GAP_VERTICAL ===')
    for (const [bt, qs] of GAP_VERTICAL) {
      setBusinessType(bt)
      await page.waitForTimeout(300)
      for (const [tmpl, q] of qs) {
        const r = await ask(page, tmpl, bt, q)
        results.push(r)
        console.log(`[${r.correctMatch ? 'OK' : 'MISS'}] ${tmpl} (${bt}) (${r.ms}ms) matched=${r.matched}`)
      }
    }

    setBusinessType('GENERAL')
    await page.waitForTimeout(300)
    console.log('\n=== UNIVERSAL_70 re-run (' + UNIVERSAL_70.length + ') ===')
    for (const [tmpl, q] of UNIVERSAL_70) {
      const r = await ask(page, tmpl, 'GENERAL', q)
      results.push(r)
      console.log(`[${r.correctMatch ? 'OK' : 'MISS'}] ${tmpl} (${r.ms}ms) matched=${r.matched}`)
    }

    console.log('\n=== VERTICAL_70 re-run ===')
    for (const [bt, qs] of VERTICAL_70) {
      setBusinessType(bt)
      await page.waitForTimeout(300)
      for (const [tmpl, q] of qs) {
        const r = await ask(page, tmpl, bt, q)
        results.push(r)
        console.log(`[${r.correctMatch ? 'OK' : 'MISS'}] ${tmpl} (${bt}) (${r.ms}ms) matched=${r.matched}`)
      }
    }

    console.log('\n\n========== FULL SUMMARY (' + results.length + ' questions) ==========')
    const wrong = results.filter((r) => !r.correctMatch)
    const errored = results.filter((r) => r.errored)
    console.log('Total:', results.length, ' Correct template match:', results.length - wrong.length, ' Wrong/missing match:', wrong.length, ' Errored:', errored.length)
    if (wrong.length) console.log('\nWrong matches:\n' + wrong.map((r) => `  ${r.template} -> got ${r.matched} (${r.businessType}) "${r.question}"`).join('\n'))
    if (errored.length) console.log('\nErrored:\n' + errored.map((r) => `  ${r.template}: ${r.answer}`).join('\n'))

    fs.writeFileSync(require('path').join(__dirname, 'verify-all-110-results.json'), JSON.stringify(results, null, 2))
    console.log('\nFull results written to tests/e2e/verify-all-110-results.json')
  } catch (e) {
    console.error('FATAL', e)
  } finally {
    if (app) await app.close().catch(() => {})
    withDb((db) => db.prepare("UPDATE User SET passwordHash = ? WHERE username = 'admin'").run(originalHash))
    if (originalBusinessType) setBusinessType(originalBusinessType)
    console.log('=== Restored original password hash and business type (' + originalBusinessType + ') ===')
  }
}
main().catch((e) => { console.error('FATAL', e); process.exit(1) })
