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
