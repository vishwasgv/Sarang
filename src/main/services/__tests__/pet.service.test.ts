import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))

import { getPrisma } from '../../database/db'
import { getPet } from '../pet.service'

function makePet(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pet-1', customerId: 'cust-1', petName: 'Buddy', species: 'Dog',
    customer: { id: 'cust-1', customerName: 'Asha Rao' },
    weightHistory: [], vaccinations: [], appointments: [],
    ...overrides,
  }
}

// Phase 67 §9.1 item 18.5 — multi-pet household linkage. Pet.customerId
// already supported several pets per owner structurally (no new schema);
// getPet() now also surfaces the owner's other active pets.
describe('pet.service — getPet siblingPets', () => {
  beforeEach(() => vi.clearAllMocks())

  it('includes other active pets under the same owner, excluding itself', async () => {
    const db = {
      pet: {
        findUnique: vi.fn().mockResolvedValue(makePet()),
        findMany: vi.fn().mockResolvedValue([
          { id: 'pet-2', petName: 'Max', species: 'Dog', breed: 'Labrador' },
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getPet('pet-1')

    expect(res.success).toBe(true)
    expect((res.data as { siblingPets: unknown[] }).siblingPets).toEqual([
      { id: 'pet-2', petName: 'Max', species: 'Dog', breed: 'Labrador' },
    ])
    expect(db.pet.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { customerId: 'cust-1', id: { not: 'pet-1' }, isActive: true }
    }))
  })

  it('returns an empty siblingPets list for a walk-in pet with no linked owner', async () => {
    const db = {
      pet: {
        findUnique: vi.fn().mockResolvedValue(makePet({ customerId: null, customer: null })),
        findMany: vi.fn(),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getPet('pet-1')

    expect(res.success).toBe(true)
    expect((res.data as { siblingPets: unknown[] }).siblingPets).toEqual([])
    expect(db.pet.findMany).not.toHaveBeenCalled()
  })

  it('returns a not-found error when the pet does not exist', async () => {
    const db = { pet: { findUnique: vi.fn().mockResolvedValue(null), findMany: vi.fn() } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getPet('missing')

    expect(res.success).toBe(false)
    expect(db.pet.findMany).not.toHaveBeenCalled()
  })
})
