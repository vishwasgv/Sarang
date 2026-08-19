import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { listBreedHealthAlerts, saveBreedHealthAlert, deleteBreedHealthAlert, getHealthAlertsForBreed } from '../../services/breed-health-alert.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

// Phase 67 §9.1 item 18.3 — Vet Clinic: breed-specific health-alert flagging.
export function register(handle: HandleFn): void {
  handle('breedHealthAlert:list', async (payload) => {
    const deny = await requirePermission('clinicalNotes.view'); if (deny) return deny
    return listBreedHealthAlerts(payload as Parameters<typeof listBreedHealthAlerts>[0])
  })

  handle('breedHealthAlert:save', async (payload) => {
    const deny = await requirePermission('clinicalNotes.write'); if (deny) return deny
    const p = payload as { id?: string; species?: string; breed?: string; alertText?: string }
    if (!p?.species || !p.breed || !p.alertText) {
      return { success: false, error: { code: 'VAL-001', message: 'species, breed, and alertText are required.' } }
    }
    const session = getCurrentSession()
    return saveBreedHealthAlert({ id: p.id, species: p.species, breed: p.breed, alertText: p.alertText }, session?.userId)
  })

  handle('breedHealthAlert:delete', async (payload) => {
    const deny = await requirePermission('clinicalNotes.write'); if (deny) return deny
    const { id } = payload as { id: string }
    const session = getCurrentSession()
    return deleteBreedHealthAlert(id, session?.userId)
  })

  handle('breedHealthAlert:forBreed', async (payload) => {
    const deny = await requirePermission('clinicalNotes.view'); if (deny) return deny
    const p = payload as { species?: string; breed?: string | null }
    if (!p?.species) return { success: false, error: { code: 'VAL-001', message: 'species is required.' } }
    return getHealthAlertsForBreed(p.species, p.breed)
  })
}
