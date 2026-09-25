import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))

import { getPrisma } from '../../database/db'
import { partyAddressService } from '../party-address.service'

function makeDb(count = 0, customerFound = true) {
  const tx = {
    partyAddress: {
      updateMany: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      create: vi.fn().mockResolvedValue({ id: 'n1' })
    }
  }
  return {
    tx,
    customer: { findUnique: vi.fn().mockResolvedValue(customerFound ? { id: 'c1' } : null) },
    supplier: { findUnique: vi.fn().mockResolvedValue({ id: 's1' }) },
    partyAddress: { count: vi.fn().mockResolvedValue(count), findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx))
  }
}

const base = { partyType: 'CUSTOMER' as const, partyId: 'c1', label: 'Warehouse', addressText: '12 Mill Road' }

describe('party addresses', () => {
  beforeEach(() => vi.clearAllMocks())

  it('needs a name and an address', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeDb() as never)
    expect((await partyAddressService.save({ ...base, label: ' ' })).success).toBe(false)
    expect((await partyAddressService.save({ ...base, addressText: '' })).success).toBe(false)
  })

  it('refuses an unknown party and more than 20 addresses', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeDb(0, false) as never)
    expect((await partyAddressService.save(base)).success).toBe(false)
    vi.mocked(getPrisma).mockReturnValue(makeDb(20) as never)
    expect((await partyAddressService.save(base)).success).toBe(false)
  })

  it('making one the default clears the others for that party only', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const r = await partyAddressService.save({ ...base, isDefault: true })
    expect(r.success).toBe(true)
    expect(db.tx.partyAddress.updateMany.mock.calls[0][0].where).toEqual({ partyType: 'CUSTOMER', partyId: 'c1' })
    expect(db.tx.partyAddress.create).toHaveBeenCalled()
  })

  it('edits in place without counting toward the limit', async () => {
    const db = makeDb(20)
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const r = await partyAddressService.save({ ...base, id: 'a1' })
    expect(r.success).toBe(true)
    expect(db.tx.partyAddress.update).toHaveBeenCalled()
  })
})
