/**
 * One-off live verification (2026-07-15): confirms token_queue, newly added
 * to VET_CLINIC/DENTAL_CLINIC/PHYSIO_CLINIC/DIAGNOSTIC_LAB, actually renders
 * and works end-to-end in the real UI for a representative newly-enabled
 * type (VET_CLINIC) — not just that the module flag is set in the DB.
 */
const h = require('./harness')

async function main() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    const sw = await h.switchBusinessType(page, 'Veterinary Clinic')
    r.log('switched-to-vet-clinic', sw.to === 'VET_CLINIC', JSON.stringify(sw))

    const sidebarLink = page.locator('a, button', { hasText: 'Token Queue' }).first()
    r.log('token-queue-nav-item-visible-in-sidebar', await sidebarLink.count() > 0)

    await h.gotoHash(page, '#/clinical/queue')
    await page.waitForTimeout(700)
    r.log('token-queue-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

    await page.getByRole('button', { name: 'Add Walk-in' }).click()
    await page.waitForTimeout(500)
    const modal = h.topModal(page)
    await modal.getByPlaceholder('Full name').fill('E2E TQAll Vet Walkin')
    await page.waitForTimeout(300)
    await modal.getByRole('button', { name: 'Issue Token' }).click()
    await page.waitForTimeout(1200)
    r.log('token-issued-no-crash', !(await h.hasErrorBoundary(page)))
    await h.shot(page, 'vet-token-queue-verified')

    const apiRes = await page.evaluate(async () => window.api.tokenQueue.today({}))
    const found = (apiRes?.data || []).find((t) => t.patientName === 'E2E TQAll Vet Walkin')
    r.log('token-findable-via-api', !!found, JSON.stringify({ status: found?.status }))

    if (originalBusinessType && originalBusinessType !== 'VET_CLINIC') {
      await page.evaluate(async (bt) => window.api.industry.changeBusinessType({ businessType: bt }), originalBusinessType)
    }
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    h.withDb((db) => {
      const ids = db.prepare("SELECT id FROM TokenQueue WHERE patientName LIKE 'E2E TQAll%'").all().map((r2) => r2.id)
      for (const id of ids) { try { db.prepare('DELETE FROM TokenQueue WHERE id = ?').run(id) } catch { /* noop */ } }
      console.log('cleanup: tokens', ids.length)
    })
  }

  const s = r.summary()
  console.log(`\nTOKEN QUEUE ALL-CLINICS VERIFICATION: ${s.pass}/${s.total} passed`)
  process.exit(s.fail > 0 ? 1 : 0)
}

main().catch((e) => { console.error('FATAL', e); process.exit(1) })
