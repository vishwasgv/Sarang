import { getPrisma } from '../database/db'
import { logAction } from './audit.service'

// Phase 67 §9.1 item 18.3 — Vet Clinic: breed-specific health-alert flagging
// at intake. User-maintained reference data (see schema.prisma's own
// comment on why this app never ships pre-authored veterinary claims) —
// this service is pure CRUD plus a case-insensitive lookup, mirroring
// normal-range.service.ts's own shape for the same "clinic-maintained
// reference list" pattern.

export async function listBreedHealthAlerts(filters?: { species?: string }) {
  try {
    const db = getPrisma()
    const alerts = await db.breedHealthAlert.findMany({
      where: filters?.species ? { species: filters.species } : undefined,
      orderBy: [{ species: 'asc' }, { breed: 'asc' }],
    })
    return { success: true, data: alerts }
  } catch (err) {
    return { success: false, error: { code: 'BHA-001', message: err instanceof Error ? err.message : 'Could not list breed health alerts.' } }
  }
}

export async function saveBreedHealthAlert(payload: {
  id?: string
  species: string
  breed: string
  alertText: string
}, userId?: string) {
  try {
    if (!payload.breed.trim()) return { success: false, error: { code: 'BHA-002', message: 'Breed is required.' } }
    if (!payload.alertText.trim()) return { success: false, error: { code: 'BHA-003', message: 'Alert text is required.' } }

    const db = getPrisma()
    const data = { species: payload.species, breed: payload.breed.trim(), alertText: payload.alertText.trim() }
    const item = payload.id
      ? await db.breedHealthAlert.update({ where: { id: payload.id }, data })
      : await db.breedHealthAlert.create({ data })

    await logAction(userId, payload.id ? 'UPDATE' : 'CREATE', 'BreedHealthAlert', item.id, undefined, { species: item.species, breed: item.breed }).catch(() => {})
    return { success: true, data: item }
  } catch (err) {
    return { success: false, error: { code: 'BHA-004', message: err instanceof Error ? err.message : 'Could not save breed health alert.' } }
  }
}

export async function deleteBreedHealthAlert(id: string, userId?: string) {
  try {
    const db = getPrisma()
    await db.breedHealthAlert.delete({ where: { id } })
    await logAction(userId, 'DELETE', 'BreedHealthAlert', id).catch(() => {})
    return { success: true }
  } catch (err) {
    return { success: false, error: { code: 'BHA-005', message: err instanceof Error ? err.message : 'Could not delete breed health alert.' } }
  }
}

// Called at intake (PetListScreen's Add/Edit Patient form) and from the
// patient profile — case-insensitive substring match, since Pet.breed is
// free text (no shared enum), same reasoning as its own schema comment.
export async function getHealthAlertsForBreed(species: string, breed: string | null | undefined) {
  try {
    if (!breed || !breed.trim()) return { success: true, data: [] }
    const db = getPrisma()
    const candidates = await db.breedHealthAlert.findMany({ where: { species } })
    const needle = breed.trim().toLowerCase()
    const matches = candidates.filter((a) => needle.includes(a.breed.toLowerCase()) || a.breed.toLowerCase().includes(needle))
    return { success: true, data: matches }
  } catch (err) {
    return { success: false, error: { code: 'BHA-006', message: err instanceof Error ? err.message : 'Could not check breed health alerts.' } }
  }
}
