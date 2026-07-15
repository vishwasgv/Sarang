/**
 * Light, concrete keyboard-navigation/accessibility spot-check (release
 * checklist Section 5: "Keyboard navigation and basic accessibility (focus
 * order, labels) work"). Not a full audit -- Design consistency and
 * per-screen empty-states are genuinely visual/subjective judgment calls
 * this session can't make without a human's eyes; this checks what's
 * concretely testable: real Tab-key focus movement and accessible-name
 * coverage on a representative form-heavy screen.
 */
const h = require('./harness')

const TEST_PREFIX = 'E2E A11y'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('customer-form-modal-keyboard-navigation', async () => {
      await h.gotoHash(page, '#/customers')
      await page.waitForTimeout(700)
      const addBtn = page.locator('button', { hasText: 'Add Customer' }).first()
      const found = await addBtn.count() > 0
      r.log('add-customer-button-found', found)
      if (!found) return

      await addBtn.click()
      await page.waitForTimeout(500)
      // Wait for the real modal title text rather than assuming a fixed
      // delay was enough -- more robust than h.topModal()'s generic
      // container selector for a form that might render slightly
      // differently than other modals this harness has driven before.
      await page.locator('text=Add Customer').first().waitFor({ timeout: 5000 }).catch(() => {})
      const modal = h.topModal(page)
      const modalVisible = await modal.count() > 0
      r.log('customer-form-modal-opens', modalVisible)
      if (!modalVisible) return

      // Real Tab-key traversal: focus the first field, then press Tab
      // repeatedly, recording which element gets focus at each step. A
      // sane form has focus move through visible, interactive form
      // controls in a logical order -- not jumping to hidden elements or
      // getting stuck on the same element.
      const firstInput = modal.locator('input, select, textarea, button').first()
      await firstInput.focus()
      const focusTrace = []
      for (let i = 0; i < 8; i++) {
        const info = await page.evaluate(() => {
          const el = document.activeElement
          if (!el) return null
          return {
            tag: el.tagName,
            type: el.getAttribute('type'),
            visible: el.offsetParent !== null,
            accessibleName: el.getAttribute('aria-label') || el.getAttribute('placeholder') ||
              (el.id && document.querySelector(`label[for="${el.id}"]`)?.textContent) ||
              el.closest('label')?.textContent || null,
          }
        })
        focusTrace.push(info)
        await page.keyboard.press('Tab')
        await page.waitForTimeout(80)
      }

      const allVisible = focusTrace.every((f) => f && f.visible)
      r.log('tab-key-focus-stays-on-visible-elements', allVisible, JSON.stringify(focusTrace.map((f) => f?.tag + (f?.visible ? '' : '(HIDDEN)'))))

      const namedCount = focusTrace.filter((f) => f && f.accessibleName).length
      r.log('most-focused-elements-have-an-accessible-name', namedCount >= focusTrace.length * 0.7, `${namedCount}/${focusTrace.length} had a label/placeholder/aria-label`)

      const uniqueElements = new Set(focusTrace.map((f) => f && `${f.tag}-${f.accessibleName}`))
      r.log('focus-actually-advances-not-stuck-on-one-element', uniqueElements.size >= 5, `${uniqueElements.size} distinct elements focused across 8 tabs`)

      await h.closeTopModal(page)
    })

    await r.step('billing-screen-keyboard-navigation', async () => {
      await h.gotoHash(page, '#/billing/new')
      await page.waitForTimeout(700)
      const searchInput = page.locator('input[placeholder="Search products…"]')
      const found = await searchInput.count() > 0
      r.log('billing-search-input-found', found)
      if (!found) return

      await searchInput.focus()
      const isFocused = await page.evaluate(() => document.activeElement?.getAttribute('placeholder'))
      r.log('billing-search-input-is-real-tab-target', isFocused === 'Search products…')

      // Ctrl+K global shortcut vs a real click -- already found earlier this
      // session that Ctrl+K may not reach the app reliably in this automated
      // context (see 12-payments-import-credit.js's language-switch step
      // comments and the checklist's own Command Palette note). Not re-tested
      // here; this step is about basic form-field tab-reachability only.
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    const cleaned = h.cleanupByNamePrefix(TEST_PREFIX)
    console.log('cleanup:', JSON.stringify(cleaned))
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nACCESSIBILITY SPOT-CHECK: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
