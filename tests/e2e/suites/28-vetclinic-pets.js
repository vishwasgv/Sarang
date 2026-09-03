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

    let petId

    await r.step('verify-pet-via-api', async () => {
      const listRes = await page.evaluate(async () => window.api.pets.list({}))
      const pets = listRes?.data || []
      const found = pets.find((p) => p.petName === 'E2E Vet Buddy')
      petId = found?.id
      r.log('pet-findable-via-api', !!found, JSON.stringify({ species: found?.species, breed: found?.breed, weight: found?.weight }))
      r.log('pet-linked-to-owner-correctly', found?.customerId === ownerId, JSON.stringify(found?.customerId))
    })

    // ── pets.update / addWeight via real UI (broader-gap-list closure) ──────
    await r.step('edit-pet-details-via-ui', async () => {
      if (!petId) return r.log('edit-pet-details-via-ui', false, 'no petId captured')
      await h.gotoHash(page, `#/vet/pets/${petId}`)
      await page.waitForTimeout(700)
      await page.getByRole('button', { name: 'Edit' }).click()
      await page.waitForTimeout(400)
      const modal = h.topModal(page)
      await modal.getByLabel('Breed').fill('Golden Retriever')
      await modal.getByLabel('Weight (kg)').fill('14.2')
      await modal.getByRole('button', { name: 'Save Changes' }).click()
      await page.waitForTimeout(1000)
      r.log('edit-pet-modal-closed-no-crash', !(await h.hasErrorBoundary(page)))

      const getRes = await page.evaluate((id) => window.api.pets.get({ id }), petId)
      r.log('pet-breed-updated', getRes?.data?.breed === 'Golden Retriever', JSON.stringify(getRes?.data?.breed))
      r.log('pet-weight-updated', getRes?.data?.weight === 14.2, JSON.stringify(getRes?.data?.weight))
    })

    await r.step('add-weight-entry-via-ui', async () => {
      if (!petId) return r.log('add-weight-entry-via-ui', false, 'no petId captured')
      await page.getByRole('button', { name: '+ Add Entry' }).click()
      await page.waitForTimeout(300)
      await page.getByLabel('Weight (kg)').fill('14.5')
      await page.getByLabel('Notes (optional)').fill('E2E post-checkup weigh-in')
      await page.getByRole('button', { name: 'Save', exact: true }).click()
      await page.waitForTimeout(1000)
      r.log('weight-entry-saved-no-crash', !(await h.hasErrorBoundary(page)))

      const getRes = await page.evaluate((id) => window.api.pets.get({ id }), petId)
      const found = (getRes?.data?.weightHistory || []).some((w) => w.weightKg === 14.5 && w.notes === 'E2E post-checkup weigh-in')
      r.log('weight-entry-persisted', found, JSON.stringify(getRes?.data?.weightHistory))
    })

    // ── vaccinations.* via real UI (broader-gap-list closure — whole-namespace gap) ──
    let vacId

    await r.step('add-vaccination-record-via-ui', async () => {
      if (!petId) return r.log('add-vaccination-record-via-ui', false, 'no petId captured')
      await page.getByRole('button', { name: /Vaccinations \(/ }).click()
      await page.waitForTimeout(400)
      await page.getByRole('button', { name: 'Add Record' }).click()
      await page.waitForTimeout(400)
      const modal = h.topModal(page)
      await modal.getByLabel('Vaccine Name *').fill('E2E Rabies Shot')
      await modal.getByLabel('Next Due Date').fill(h.toLocalISODate(new Date(Date.now() + 10 * 24 * 3600000)))
      await modal.getByRole('button', { name: 'Save Record' }).click()
      await page.waitForTimeout(1000)
      r.log('vaccination-modal-closed-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate((id) => window.api.vaccinations.list({ petId: id }), petId)
      const found = (listRes?.data || []).find((v) => v.vaccineName === 'E2E Rabies Shot')
      vacId = found?.id
      r.log('vaccination-record-persisted', !!vacId, JSON.stringify(found))
    })

    await r.step('edit-vaccination-record-via-ui', async () => {
      if (!vacId) return r.log('edit-vaccination-record-via-ui', false, 'no vacId captured')
      const row = page.locator('p', { hasText: 'E2E Rabies Shot' }).first().locator('xpath=../../..')
      await row.locator('button:has(svg.lucide-pen)').click()
      await page.waitForTimeout(400)
      const modal = h.topModal(page)
      await modal.getByLabel('Vaccine Name *').fill('E2E Rabies Shot Updated')
      await modal.getByRole('button', { name: 'Update' }).click()
      await page.waitForTimeout(1000)
      r.log('vaccination-edit-modal-closed-no-crash', !(await h.hasErrorBoundary(page)))

      const getRes = await page.evaluate((id) => window.api.vaccinations.get({ id }), vacId)
      r.log('vaccination-record-updated', getRes?.data?.vaccineName === 'E2E Rabies Shot Updated', JSON.stringify(getRes?.data?.vaccineName))
    })

    await r.step('vaccination-reminder-queued-via-ui', async () => {
      if (!vacId) return r.log('vaccination-reminder-queued-via-ui', false, 'no vacId captured')
      const row = page.locator('p', { hasText: 'E2E Rabies Shot Updated' }).first().locator('xpath=../../..')
      await row.locator('button[title="Queue WhatsApp reminder"]').click()
      await page.waitForTimeout(1000)
      r.log('reminder-button-no-crash', !(await h.hasErrorBoundary(page)))

      const reminderRow = h.withDb((db) => db.prepare("SELECT * FROM NotificationQueue WHERE notificationType LIKE '%VACCIN%' ORDER BY createdAt DESC LIMIT 1").get())
      r.log('reminder-row-queued', !!reminderRow, JSON.stringify(reminderRow))
    })

    await r.step('vaccinations-upcoming-includes-our-record', async () => {
      const res = await page.evaluate(async () => window.api.vaccinations.upcoming({ daysAhead: 30 }))
      const found = (res?.data || []).some((v) => v.id === vacId)
      r.log('upcoming-vaccinations-includes-ours', found, JSON.stringify(res?.data?.map((v) => v.id)))
    })

    await r.step('delete-vaccination-record-via-ui', async () => {
      if (!vacId) return r.log('delete-vaccination-record-via-ui', false, 'no vacId captured')
      const row = page.locator('p', { hasText: 'E2E Rabies Shot Updated' }).first().locator('xpath=../../..')
      await row.locator('button:has(svg.lucide-trash2)').click()
      await page.waitForTimeout(300)
      await row.getByRole('button', { name: 'Yes' }).click()
      await page.waitForTimeout(1000)
      r.log('vaccination-delete-no-crash', !(await h.hasErrorBoundary(page)))

      const getRes = await page.evaluate((id) => window.api.vaccinations.get({ id }), vacId)
      r.log('vaccination-record-actually-gone', getRes?.success === false || !getRes?.data, JSON.stringify(getRes))
    })

    // pets.delete has no UI trigger anywhere in the renderer (the Archive
    // Patient button in the edit modal calls pets.update({isActive:false}),
    // never this channel) -- API-only coverage, same soft-delete semantics.
    await r.step('pets-delete-channel-api-only', async () => {
      const supRes = await page.evaluate(async () => window.api.customers.create({
        customerName: 'E2E Vet Delete Owner', phone: `9${String(Date.now()).slice(-9)}`,
      }))
      const tempPetRes = await page.evaluate((customerId) => window.api.pets.create({
        petName: 'E2E Vet Temp Delete Pet', species: 'Cat', customerId,
      }), supRes?.data?.id)
      const tempPetId = tempPetRes?.data?.id
      r.log('temp-pet-created-for-delete-test', !!tempPetId, JSON.stringify(tempPetRes?.error || ''))
      if (!tempPetId) return

      const delRes = await page.evaluate((id) => window.api.pets.delete({ id }), tempPetId)
      r.log('pets-delete-succeeds', !!delRes?.success, JSON.stringify(delRes?.error || ''))
      const getRes = await page.evaluate((id) => window.api.pets.get({ id }), tempPetId)
      r.log('pets-delete-soft-deactivates', getRes?.data?.isActive === false, JSON.stringify(getRes?.data?.isActive))
    })

    // ── pets.update archive/restore via real UI (broader-gap-list closure) ──
    await r.step('archive-and-restore-pet-via-ui', async () => {
      if (!petId) return r.log('archive-and-restore-pet-via-ui', false, 'no petId captured')
      await page.getByRole('button', { name: 'Edit' }).click()
      await page.waitForTimeout(400)
      await page.getByRole('button', { name: 'Archive Patient' }).click()
      await page.waitForTimeout(300)
      await page.getByRole('button', { name: 'Confirm' }).click()
      await page.waitForTimeout(1000)
      r.log('archive-no-crash', !(await h.hasErrorBoundary(page)))

      const afterArchive = await page.evaluate((id) => window.api.pets.get({ id }), petId)
      r.log('pet-archived', afterArchive?.data?.isActive === false, JSON.stringify(afterArchive?.data?.isActive))

      // Screen redirects to the list on archive -- navigate back in directly.
      await h.gotoHash(page, `#/vet/pets/${petId}`)
      await page.waitForTimeout(700)
      await page.getByRole('button', { name: 'Edit' }).click()
      await page.waitForTimeout(400)
      await page.getByRole('button', { name: 'Restore Patient' }).click()
      await page.waitForTimeout(1000)
      r.log('restore-no-crash', !(await h.hasErrorBoundary(page)))

      const afterRestore = await page.evaluate((id) => window.api.pets.get({ id }), petId)
      r.log('pet-restored', afterRestore?.data?.isActive === true, JSON.stringify(afterRestore?.data?.isActive))
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
      // This raw connection doesn't enforce FK constraints (no `PRAGMA
      // foreign_keys=ON`), so a bare `DELETE FROM Pet` neither cascades nor
      // fails -- it just silently orphans VaccinationRecord/WeightHistory rows
      // forever. Clear children first (broader-gap-list closure, 2026-09-03,
      // once this suite started actually creating vaccination/weight data).
      const ids = db.prepare("SELECT id FROM Pet WHERE petName LIKE 'E2E Vet%'").all().map((r2) => r2.id)
      let vacs = 0, weights = 0
      for (const id of ids) {
        vacs += db.prepare('DELETE FROM VaccinationRecord WHERE petId = ?').run(id).changes
        weights += db.prepare('DELETE FROM WeightHistory WHERE petId = ?').run(id).changes
        try { db.prepare('DELETE FROM Pet WHERE id = ?').run(id) } catch { /* noop */ }
      }
      const notifs = db.prepare("DELETE FROM NotificationQueue WHERE notificationType LIKE 'VACCINE_%' AND customerName LIKE 'E2E Vet%'").run().changes
      console.log('extra cleanup: pets', ids.length, 'vaccinationRecords', vacs, 'weightEntries', weights, 'notifications', notifs)
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
