/**
 * Live verification for the Restaurant (KOT/KitchenDisplay/Recipes) and
 * Blood Bank (Donors/Donations/Camps/Stock/Issue) i18n wiring pass (2026-09).
 * These 8 screens previously had zero i18n usage — fully hardcoded English
 * strings — despite both verticals being languageLock: 'multi'.
 *
 * This suite:
 *  1. Switches to Hindi and Arabic in turn and visually/textually confirms
 *     each of the 8 screens renders real translated script, no raw i18n
 *     keys, no crash.
 *  2. Restores English and runs a functional regression pass — create a
 *     real KOT via Tables -> Start Order -> Send to Kitchen, view Kitchen
 *     Display, view a recipe, view the donor list, register a donor and
 *     log a donation — to confirm the refactor didn't break behavior.
 */
const h = require('./harness')

const RESTAURANT_SCREENS = [
  { hash: '#/restaurant/kot', name: 'kot' },
  { hash: '#/kitchen-display', name: 'kitchen-display' },
  { hash: '#/restaurant/recipes', name: 'recipes' },
]
const BLOODBANK_SCREENS = [
  { hash: '#/blood-bank/donors', name: 'donors' },
  { hash: '#/blood-bank/donations', name: 'donations' },
  { hash: '#/blood-bank/camps', name: 'camps' },
  { hash: '#/blood-bank/stock', name: 'stock' },
  { hash: '#/blood-bank/issue', name: 'issue' },
]

const RAW_KEY_PATTERNS = [
  'restaurant.kot.', 'restaurant.kitchenDisplay.', 'restaurant.recipes.',
  'bloodBank.donors.', 'bloodBank.donations.', 'bloodBank.camps.', 'bloodBank.stock.', 'bloodBank.issue.',
]

async function switchLanguage(page, rowLabel) {
  await h.gotoHash(page, '#/settings')
  await page.waitForTimeout(700)
  const langTab = page.locator('button, [role="tab"]', { hasText: /Language/i }).first()
  if (await langTab.count()) { await langTab.click(); await page.waitForTimeout(400) }
  const row = page.locator('button', { hasText: rowLabel }).first()
  const found = (await row.count()) > 0
  if (found) { await row.click(); await page.waitForTimeout(500) }
  return found
}

async function checkScreens(page, r, screens, tag, scriptRegex, scriptName) {
  for (const s of screens) {
    await h.gotoHash(page, s.hash)
    await page.waitForTimeout(900)
    const crashed = await h.hasErrorBoundary(page)
    const text = await page.textContent('body')
    r.log(`${s.name}-loads-no-crash-${tag}`, !crashed)
    r.log(`${s.name}-has-${scriptName}-${tag}`, scriptRegex.test(text || ''))
    const rawLeak = RAW_KEY_PATTERNS.some((p) => (text || '').includes(p))
    r.log(`${s.name}-no-raw-keys-${tag}`, !rawLeak)
    await h.shot(page, `${s.name}-${tag}`)
  }
}

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  let page
  try {
    page = await h.getMainWindow(app)
    await h.login(page)

    // ── Part 1: non-English visual verification ──────────────────────────
    await r.step('switch-to-restaurant', async () => {
      const res = await h.switchBusinessType(page, 'Restaurant')
      r.log('switched-to-restaurant', res.to === 'RESTAURANT' || res.changed || res.to === res.from)
    })

    await r.step('hindi-restaurant-screens', async () => {
      const found = await switchLanguage(page, 'हिंदी')
      r.log('hindi-language-row-found', found)
      await checkScreens(page, r, RESTAURANT_SCREENS, 'hindi', /[ऀ-ॿ]/, 'devanagari')
    })

    await r.step('arabic-restaurant-screens', async () => {
      const found = await switchLanguage(page, 'العربية')
      r.log('arabic-language-row-found', found)
      await checkScreens(page, r, RESTAURANT_SCREENS, 'arabic', /[؀-ۿ]/, 'arabic-script')
    })

    await r.step('switch-to-bloodbank', async () => {
      const res = await h.switchBusinessType(page, 'Blood Bank')
      r.log('switched-to-bloodbank', res.to === 'BLOOD_BANK' || res.changed || res.to === res.from)
    })

    await r.step('hindi-bloodbank-screens', async () => {
      const found = await switchLanguage(page, 'हिंदी')
      r.log('hindi-language-row-found-bb', found)
      await checkScreens(page, r, BLOODBANK_SCREENS, 'hindi', /[ऀ-ॿ]/, 'devanagari')
    })

    await r.step('arabic-bloodbank-screens', async () => {
      const found = await switchLanguage(page, 'العربية')
      r.log('arabic-language-row-found-bb', found)
      await checkScreens(page, r, BLOODBANK_SCREENS, 'arabic', /[؀-ۿ]/, 'arabic-script')
    })

    // ── Restore English ────────────────────────────────────────────────
    await r.step('restore-english', async () => {
      const found = await switchLanguage(page, 'English')
      r.log('english-restored', found)
    })

    // ── Part 2: functional regression pass in English ────────────────────
    await r.step('setup-restaurant-fixtures', async () => {
      await h.switchBusinessType(page, 'Restaurant')
      const prodRes = await page.evaluate(async () => window.api.products.create({
        productName: 'I18N-QA Test Dosa', sku: 'I18N-QA-DOSA', sellingPrice: 120, purchasePrice: 60, unit: 'pcs', category: 'Food'
      }))
      r.log('test-product-created', !!(prodRes && prodRes.success), JSON.stringify(prodRes && prodRes.error))
      const tableRes = await page.evaluate(async () => window.api.restaurant.createTable({ tableNumber: 'I18N-QA-T1', tableName: 'I18N QA Table' }))
      r.log('test-table-created', !!(tableRes && tableRes.success), JSON.stringify(tableRes && tableRes.error))
    })

    await r.step('create-a-kot', async () => {
      await h.gotoHash(page, '#/restaurant/tables')
      await page.waitForTimeout(800)
      const startOrderBtn = page.locator('button', { hasText: 'Start Order' }).first()
      const btnFound = (await startOrderBtn.count()) > 0
      r.log('start-order-button-found', btnFound)
      if (btnFound) {
        await startOrderBtn.click()
        await page.waitForTimeout(900)
        const searchInput = page.locator('input[placeholder]').first()
        await searchInput.fill('I18N-QA Test Dosa')
        await page.waitForTimeout(500)
        await searchInput.press('Enter')
        await page.waitForTimeout(700)
        const sendBtn = page.locator('button', { hasText: 'Send to Kitchen' }).first()
        const sendFound = (await sendBtn.count()) > 0
        r.log('send-to-kitchen-button-found', sendFound)
        if (sendFound) {
          await sendBtn.click()
          await page.waitForTimeout(1200)
        }
      }
      await h.gotoHash(page, '#/restaurant/kot')
      await page.waitForTimeout(900)
      const crashed = await h.hasErrorBoundary(page)
      r.log('kot-screen-loads-no-crash-english', !crashed)
      const bodyText = await page.textContent('body')
      r.log('kot-shows-created-ticket', (bodyText || '').includes('I18N QA Table') || (bodyText || '').includes('I18N-QA-T1'))
      await h.shot(page, 'kot-functional-english')
    })

    await r.step('view-kitchen-display', async () => {
      await h.gotoHash(page, '#/kitchen-display')
      await page.waitForTimeout(900)
      const crashed = await h.hasErrorBoundary(page)
      r.log('kitchen-display-loads-no-crash-english', !crashed)
      const bodyText = await page.textContent('body')
      r.log('kitchen-display-shows-headings', (bodyText || '').includes('Pending') && (bodyText || '').includes('Kitchen Display'))
    })

    await r.step('view-a-recipe', async () => {
      await h.gotoHash(page, '#/restaurant/recipes')
      await page.waitForTimeout(900)
      const crashed = await h.hasErrorBoundary(page)
      r.log('recipes-screen-loads-no-crash-english', !crashed)
      const addBtn = page.locator('button', { hasText: 'Add Recipe' }).first()
      const addFound = (await addBtn.count()) > 0
      r.log('add-recipe-button-found', addFound)
      if (addFound) {
        await addBtn.click()
        await page.waitForTimeout(500)
        const formVisible = await page.locator('text=New Recipe').count() > 0
        r.log('recipe-form-opens', formVisible)
        const cancelBtn = page.locator('button', { hasText: 'Cancel' }).first()
        if (await cancelBtn.count()) await cancelBtn.click()
      }
    })

    await r.step('setup-bloodbank-and-view-donors', async () => {
      await h.switchBusinessType(page, 'Blood Bank')
      await h.gotoHash(page, '#/blood-bank/donors')
      await page.waitForTimeout(900)
      const crashed = await h.hasErrorBoundary(page)
      r.log('donors-screen-loads-no-crash-english', !crashed)
    })

    await r.step('register-donor-and-log-donation', async () => {
      await h.gotoHash(page, '#/blood-bank/donors')
      await page.waitForTimeout(700)
      const newDonorBtn = page.locator('button', { hasText: 'New Donor' }).first()
      const newDonorFound = (await newDonorBtn.count()) > 0
      r.log('new-donor-button-found', newDonorFound)
      const donorName = 'I18N QA Donor'
      if (newDonorFound) {
        await newDonorBtn.click()
        await page.waitForTimeout(500)
        const nameInput = page.locator('label:has-text("Full Name") + input, input').first()
        // Fill the first text input in the modal (Full Name is first field).
        const modalInputs = page.locator('div.fixed input[type="text"], div.fixed input:not([type])')
        await modalInputs.first().fill(donorName)
        const registerBtn = page.locator('button', { hasText: 'Register Donor' }).last()
        if (await registerBtn.count()) {
          await registerBtn.click()
          await page.waitForTimeout(1000)
        }
      }
      const bodyText = await page.textContent('body')
      r.log('donor-appears-in-list', (bodyText || '').includes(donorName))
      await h.shot(page, 'donors-functional-english')

      // Log a donation for the donor just created.
      await h.gotoHash(page, '#/blood-bank/donations')
      await page.waitForTimeout(700)
      const recordBtn = page.locator('button', { hasText: 'Record Donation' }).first()
      const recordFound = (await recordBtn.count()) > 0
      r.log('record-donation-button-found', recordFound)
      if (recordFound) {
        await recordBtn.click()
        await page.waitForTimeout(500)
        const donorSelect = page.locator('select').first()
        if (await donorSelect.count()) {
          const optionValue = await donorSelect.evaluate((sel, name) => {
            const opt = Array.from(sel.options).find((o) => o.textContent && o.textContent.includes(name))
            return opt ? opt.value : ''
          }, donorName)
          if (optionValue) await donorSelect.selectOption(optionValue)
        }
        const bloodGroupSelects = page.locator('select')
        if ((await bloodGroupSelects.count()) > 1) {
          await bloodGroupSelects.nth(1).selectOption('O+')
        }
        const submitBtn = page.locator('button', { hasText: 'Record Donation' }).last()
        if (await submitBtn.count()) {
          await submitBtn.click()
          await page.waitForTimeout(1000)
        }
      }
      const donationsText = await page.textContent('body')
      r.log('donation-recorded-and-visible', (donationsText || '').includes(donorName))
      await h.shot(page, 'donations-functional-english')
    })

    // Restore Restaurant as the default business type left over from setup.
    await r.step('cleanup-restore-business-type', async () => {
      await h.switchBusinessType(page, 'Restaurant')
    })
  } finally {
    await app.close()
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nRESTAURANT + BLOOD BANK i18n (2026-09): ${s.pass}/${s.pass + s.fail} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((err) => { console.error(err); process.exit(1) })
}

module.exports = { run }
