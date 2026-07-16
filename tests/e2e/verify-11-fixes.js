/**
 * Targeted re-verification of all 11 misses found in the 2026-07-16
 * 109-template packaged-app battery: 5 real fast-path fixes (this file
 * confirms them with the SAME parameters that failed before) + 6 "test
 * artifact" misses re-run with corrected business type / phrasing to
 * confirm no real product bug exists there.
 */
const h = require('./harness')

async function main() {
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const results = []
  let originalBusinessType = null
  try {
    const page = await h.getMainWindow(app)
    await h.login(page)
    originalBusinessType = h.withDb((db) => db.prepare('SELECT businessType FROM BusinessProfile LIMIT 1').get()?.businessType)

    const allTypes = ['GENERAL', 'RENTAL', 'VET_CLINIC', 'BEAUTY_SALON', 'CLOTHING', 'DISTRIBUTOR']
    h.withDb((db) => {
      for (const bt of allTypes) {
        const existing = db.prepare('SELECT id, enabledModules FROM IndustryTemplateSetting WHERE businessType = ?').get(bt)
        if (existing) {
          const mods = new Set(JSON.parse(existing.enabledModules || '[]'))
          mods.add('ai_assistant')
          db.prepare('UPDATE IndustryTemplateSetting SET enabledModules = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').run(JSON.stringify([...mods]), existing.id)
        } else {
          db.prepare('INSERT INTO IndustryTemplateSetting (id, businessType, enabledModules, createdAt, updatedAt) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)').run('fix' + bt, bt, JSON.stringify(['ai_assistant']))
        }
      }
    })

    function setBt(bt) { h.withDb((db) => db.prepare('UPDATE BusinessProfile SET businessType = ? WHERE id = (SELECT id FROM BusinessProfile LIMIT 1)').run(bt)) }

    async function ask(template, bt, question) {
      const t0 = Date.now()
      const res = await page.evaluate((q) => window.api.ai.query({ question: q }), question)
      const ms = Date.now() - t0
      const log = h.withDb((db) => db.prepare('SELECT matchedTemplate FROM AiQueryLog ORDER BY createdAt DESC LIMIT 1').get())
      const ok = log?.matchedTemplate === template
      results.push({ template, bt, question, matched: log?.matchedTemplate, ok, ms })
      console.log(`[${ok ? 'FIXED/OK' : 'STILL WRONG'}] ${template} (${bt}) (${ms}ms) matched=${log?.matchedTemplate}`)
    }

    console.log('\n=== 5 REAL FIXES (same params as the original failing test) ===')
    setBt('GENERAL')
    await ask('inventory.bottomRevenueProducts', 'GENERAL', 'What are my worst-selling products?')
    await ask('suppliers.pendingPayments', 'GENERAL', 'What payments are pending to suppliers?')
    await ask('customers.byCity', 'GENERAL', 'What cities are my customers located in?')
    await ask('customers.newThisWeek', 'GENERAL', 'How many new customers did I get this week?')
    setBt('RENTAL')
    await ask('rental.revenue', 'RENTAL', "What's my rental revenue this month?")

    console.log('\n=== 6 TEST ARTIFACTS (corrected parameters) ===')
    setBt('GENERAL')
    await ask('meta.suggestions', 'GENERAL', 'What needs my attention today?')
    setBt('CLOTHING')
    await ask('retail.variantStock', 'CLOTHING', 'What is my variant stock breakdown?')
    setBt('VET_CLINIC')
    await ask('service.clientRetention', 'VET_CLINIC', "What's my client retention rate?")
    await ask('service.appointmentUtilisation', 'VET_CLINIC', "What's my appointment utilisation this week?")
    setBt('BEAUTY_SALON')
    await ask('service.commission', 'BEAUTY_SALON', 'How much commission is owed?')
    setBt('DISTRIBUTOR')
    await ask('logistics.summary', 'DISTRIBUTOR', "What's my logistics summary this month?")

    const wrong = results.filter((r) => !r.ok)
    console.log('\n\n=== SUMMARY:', results.length - wrong.length, '/', results.length, 'correct ===')
    if (wrong.length) console.log('Still wrong:', wrong.map((r) => r.template))
  } catch (e) {
    console.error('FATAL', e)
  } finally {
    if (originalBusinessType) {
      h.withDb((db) => db.prepare('UPDATE BusinessProfile SET businessType = ? WHERE id = (SELECT id FROM BusinessProfile LIMIT 1)').run(originalBusinessType))
    }
    await h.closeApp(app)
    h.randomizeAdminPassword()
  }
}
main().catch((e) => { console.error('FATAL', e); process.exit(1) })
