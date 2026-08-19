import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn().mockResolvedValue(undefined) }))

import { getPrisma } from '../../database/db'
import { listBreedHealthAlerts, saveBreedHealthAlert, deleteBreedHealthAlert, getHealthAlertsForBreed } from '../breed-health-alert.service'

describe('breed-health-alert.service', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('saveBreedHealthAlert', () => {
    it('rejects an empty breed', async () => {
      const res = await saveBreedHealthAlert({ species: 'Dog', breed: '  ', alertText: 'Watch for hip issues' })
      expect(res.success).toBe(false)
    })

    it('rejects empty alert text', async () => {
      const res = await saveBreedHealthAlert({ species: 'Dog', breed: 'Labrador', alertText: '  ' })
      expect(res.success).toBe(false)
    })

    it('creates a new alert when no id is given', async () => {
      const db = { breedHealthAlert: { create: vi.fn().mockResolvedValue({ id: 'a1', species: 'Dog', breed: 'Labrador', alertText: 'Hip issues' }) } }
      vi.mocked(getPrisma).mockReturnValue(db as never)

      const res = await saveBreedHealthAlert({ species: 'Dog', breed: 'Labrador', alertText: 'Hip issues' })

      expect(res.success).toBe(true)
      expect(db.breedHealthAlert.create).toHaveBeenCalledWith({ data: { species: 'Dog', breed: 'Labrador', alertText: 'Hip issues' } })
    })

    it('updates an existing alert when an id is given', async () => {
      const db = { breedHealthAlert: { update: vi.fn().mockResolvedValue({ id: 'a1', species: 'Dog', breed: 'Labrador', alertText: 'Updated' }) } }
      vi.mocked(getPrisma).mockReturnValue(db as never)

      const res = await saveBreedHealthAlert({ id: 'a1', species: 'Dog', breed: 'Labrador', alertText: 'Updated' })

      expect(res.success).toBe(true)
      expect(db.breedHealthAlert.update).toHaveBeenCalledWith({ where: { id: 'a1' }, data: { species: 'Dog', breed: 'Labrador', alertText: 'Updated' } })
    })
  })

  describe('listBreedHealthAlerts', () => {
    it('filters by species when given', async () => {
      const db = { breedHealthAlert: { findMany: vi.fn().mockResolvedValue([]) } }
      vi.mocked(getPrisma).mockReturnValue(db as never)

      await listBreedHealthAlerts({ species: 'Dog' })

      expect(db.breedHealthAlert.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { species: 'Dog' } }))
    })

    it('lists all alerts when no filter given', async () => {
      const db = { breedHealthAlert: { findMany: vi.fn().mockResolvedValue([]) } }
      vi.mocked(getPrisma).mockReturnValue(db as never)

      await listBreedHealthAlerts()

      expect(db.breedHealthAlert.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: undefined }))
    })
  })

  describe('deleteBreedHealthAlert', () => {
    it('deletes by id', async () => {
      const db = { breedHealthAlert: { delete: vi.fn().mockResolvedValue({}) } }
      vi.mocked(getPrisma).mockReturnValue(db as never)

      const res = await deleteBreedHealthAlert('a1')

      expect(res.success).toBe(true)
      expect(db.breedHealthAlert.delete).toHaveBeenCalledWith({ where: { id: 'a1' } })
    })
  })

  // Phase 67 §9.1 item 18.3 — case-insensitive, substring match since
  // Pet.breed is free text with no shared enum against BreedHealthAlert.breed.
  describe('getHealthAlertsForBreed', () => {
    it('matches case-insensitively', async () => {
      const db = { breedHealthAlert: { findMany: vi.fn().mockResolvedValue([{ id: 'a1', species: 'Dog', breed: 'labrador', alertText: 'Hip issues' }]) } }
      vi.mocked(getPrisma).mockReturnValue(db as never)

      const res = await getHealthAlertsForBreed('Dog', 'Labrador')

      expect(res.success).toBe(true)
      expect((res.data as unknown[])).toHaveLength(1)
    })

    it('matches a partial breed name in either direction', async () => {
      const db = { breedHealthAlert: { findMany: vi.fn().mockResolvedValue([{ id: 'a1', species: 'Dog', breed: 'Golden Retriever', alertText: 'Hip issues' }]) } }
      vi.mocked(getPrisma).mockReturnValue(db as never)

      const res = await getHealthAlertsForBreed('Dog', 'Golden')

      expect((res.data as unknown[])).toHaveLength(1)
    })

    it('returns no matches for an unrelated breed', async () => {
      const db = { breedHealthAlert: { findMany: vi.fn().mockResolvedValue([{ id: 'a1', species: 'Dog', breed: 'Golden Retriever', alertText: 'Hip issues' }]) } }
      vi.mocked(getPrisma).mockReturnValue(db as never)

      const res = await getHealthAlertsForBreed('Dog', 'Poodle')

      expect((res.data as unknown[])).toHaveLength(0)
    })

    it('returns an honest empty result when no breed is given', async () => {
      const res = await getHealthAlertsForBreed('Dog', null)

      expect(res.success).toBe(true)
      expect(res.data).toEqual([])
    })
  })
})
