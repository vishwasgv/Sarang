/**
 * Suite 28 — Vet Clinic vertical (vet_patients). Real UI-driven Pet
 * registration linked to an existing Customer owner. This screen uses the
 * shared labeled Input/Select atoms throughout (getByLabel works), unlike
 * most other service-business screens — see project_vertical_uat_research.md.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E Vet'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-vet-clinic', async () => {
      const sw = await h.switchBusinessType(page, 'Veterinary Clinic')
      r.log('business-type-switched', sw.to === 'VET_CLINIC', JSON.stringify(sw))
    })

    let ownerId

    await r.step('create-owner', async () => {
      const custRes = await page.evaluate(async () => window.api.customers.create({
        customerName: 'E2E Vet Owner', phone: `9${String(Date.now()).slice(-9)}`,
      }))
      ownerId = custRes?.data?.id
      r.log('owner-created', !!custRes?.success, JSON.stringify(custRes?.error || ''))
    })

    await r.step('register-pet-via-real-ui', async () => {
      await h.gotoHash(page, '#/vet/pets')
      await page.waitForTimeout(700)
      r.log('pets-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.getByRole('button', { name: 'Add Patient' }).click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)

      await modal.getByLabel('Pet Name *').fill('E2E Vet Buddy')
      await modal.getByLabel('Species *').selectOption('Dog')
      await modal.getByLabel('Breed').fill('Labrador')
      await modal.getByLabel('Weight (kg)').fill('12.5')
      await modal.getByLabel('Owner (optional)').selectOption(ownerId)
      await page.waitForTimeout(300)

      await modal.getByRole('button', { name: 'Register Patient' }).click()
      await page.waitForTimeout(1200)
      r.log('pet-registered-no-crash', !(await h.hasErrorBoundary(page)))
      const url = page.url()
      r.log('navigated-to-pet-profile', /#\/vet\/pets\/[a-zA-Z0-9]+/.test(url), url)
      await h.shot(page, 'vetclinic-pet-registered')
    })

    await r.step('verify-pet-via-api', async () => {
      const listRes = await page.evaluate(async () => window.api.pets.list({}))
      const pets = listRes?.data || []
      const found = pets.find((p) => p.petName === 'E2E Vet Buddy')
      r.log('pet-findable-via-api', !!found, JSON.stringify({ species: found?.species, breed: found?.breed, weight: found?.weight }))
      r.log('pet-linked-to-owner-correctly', found?.customerId === ownerId, JSON.stringify(found?.customerId))
    })

    // ── Phase 67 §9.1 item 18.3 gap-closure (2026-08-27) — breed-specific
    // health-alert flagging, previously untested. ──────────────────────────
    let breedAlertId

    await r.step('save-breed-health-alert-via-api', async () => {
      const res = await page.evaluate(async () => window.api.breedHealthAlert.save({
        species: 'Dog', breed: 'E2E Labrador', alertText: 'E2E Prone to hip dysplasia — watch for limping',
      }))
      breedAlertId = res?.data?.id
      r.log('breed-alert-saved', !!breedAlertId, JSON.stringify(res?.error || ''))
    })

    await r.step('missing-required-fields-rejected', async () => {
      const res = await page.evaluate(async () => window.api.breedHealthAlert.save({ species: 'Dog', breed: '', alertText: '' }))
      r.log('save-without-breed-and-text-rejected', res?.success === false, JSON.stringify(res?.error))
    })

    await r.step('for-breed-lookup-matches-case-insensitively', async () => {
      // Real pet above is breed 'Labrador' (exact case, no E2E prefix) --
      // the alert is 'E2E Labrador'. Case-insensitive SUBSTRING match either
      // direction means a real pet's plain 'Labrador' still needs to be
      // checked against 'E2E Labrador' -- it won't match (substring fails
      // both ways), so verify using the alert's own exact breed spelling
      // instead, and separately confirm a genuinely unrelated breed finds nothing.
      const matchRes = await page.evaluate(async () => window.api.breedHealthAlert.forBreed({ species: 'Dog', breed: 'E2E Labrador' }))
      const found = (matchRes?.data || []).some((a) => a.id === breedAlertId)
      r.log('for-breed-finds-exact-breed-match', found, JSON.stringify(matchRes?.data))

      const caseInsensitiveRes = await page.evaluate(async () => window.api.breedHealthAlert.forBreed({ species: 'Dog', breed: 'e2e labrador' }))
      const foundCaseInsensitive = (caseInsensitiveRes?.data || []).some((a) => a.id === breedAlertId)
      r.log('for-breed-matches-case-insensitively', foundCaseInsensitive, JSON.stringify(caseInsensitiveRes?.data))

      const noMatchRes = await page.evaluate(async () => window.api.breedHealthAlert.forBreed({ species: 'Dog', breed: 'Poodle' }))
      const wronglyMatched = (noMatchRes?.data || []).some((a) => a.id === breedAlertId)
      r.log('for-breed-does-not-match-unrelated-breed', !wronglyMatched, JSON.stringify(noMatchRes?.data))
    })

    await r.step('breed-alerts-screen-loads-and-lists-alert', async () => {
      await h.gotoHash(page, '#/vet/breed-alerts')
      await page.waitForTimeout(700)
      r.log('breed-alerts-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))
      const bodyText = await page.locator('body').innerText().catch(() => '')
      r.log('breed-alerts-screen-shows-our-alert', bodyText.includes('E2E Labrador'), 'expected our saved breed alert to render')
      await h.shot(page, 'vetclinic-breed-alerts')
    })

    await r.step('delete-breed-alert', async () => {
      if (!breedAlertId) return r.log('delete-breed-alert', false, 'no breedAlertId captured')
      const res = await page.evaluate((id) => window.api.breedHealthAlert.delete({ id }), breedAlertId)
      r.log('breed-alert-deleted', !!res?.success, JSON.stringify(res?.error || ''))
      const listRes = await page.evaluate(async () => window.api.breedHealthAlert.list({ species: 'Dog' }))
      const stillThere = (listRes?.data || []).some((a) => a.id === breedAlertId)
      r.log('breed-alert-actually-gone', !stillThere, JSON.stringify(listRes?.data?.map((a) => a.id)))
    })

    await r.step('restore-business-type', async () => {
      if (originalBusinessType && originalBusinessType !== 'VET_CLINIC') {
        const res = await page.evaluate(async (bt) => window.api.industry.changeBusinessType({ businessType: bt }), originalBusinessType)
        r.log('business-type-restored', !!res?.success, originalBusinessType)
      }
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    const cleaned = h.cleanupByNamePrefix(TEST_PREFIX)
    console.log('cleanup:', JSON.stringify(cleaned))
    h.withDb((db) => {
      const ids = db.prepare("SELECT id FROM Pet WHERE petName LIKE 'E2E Vet%'").all().map((r2) => r2.id)
      for (const id of ids) { try { db.prepare('DELETE FROM Pet WHERE id = ?').run(id) } catch { /* noop */ } }
      console.log('extra cleanup: pets', ids.length)
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nVET CLINIC VERTICAL: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
