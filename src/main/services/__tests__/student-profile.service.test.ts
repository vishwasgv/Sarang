import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))

import { getPrisma } from '../../database/db'
import { createStudent } from '../student-profile.service'

// Phase 54E — createStudent used to call tx.customer.create() unconditionally,
// silently duplicating the Customer row for anyone who'd already been billed
// elsewhere in the app (or already enrolled with the same phone). It now
// finds-and-reuses an existing customer first, either by an explicit
// customerId (the CustomerPicker UI) or by phone as a fallback.

function makeDb() {
  const db: Record<string, unknown> = {
    customer: {
      findUnique: vi.fn().mockResolvedValue(null),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'new-customer-id', customerName: 'New Student' }),
    },
    studentProfile: {
      create: vi.fn().mockResolvedValue({ id: 'profile-1', customerId: 'new-customer-id', customer: { customerName: 'New Student' } }),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  }
  db.$transaction = vi.fn((fn: (tx: unknown) => unknown) => fn(db))
  return db
}

describe('student-profile.service — createStudent find-or-create', () => {
  beforeEach(() => vi.clearAllMocks())

  it('reuses an existing customer by customerId without creating a duplicate', async () => {
    const db = makeDb()
    ;(db.customer as { findUnique: ReturnType<typeof vi.fn> }).findUnique.mockResolvedValue({ id: 'existing-id', customerName: 'Existing Person', phone: '9999999999' })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await createStudent({ customerId: 'existing-id', customerName: 'Existing Person', classOrGrade: '10th' })

    expect((db.customer as { create: ReturnType<typeof vi.fn> }).create).not.toHaveBeenCalled()
    expect((db.studentProfile as { create: ReturnType<typeof vi.fn> }).create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ customerId: 'existing-id' }) })
    )
  })

  it('reuses an existing customer found by phone when no customerId is given', async () => {
    const db = makeDb()
    ;(db.customer as { findFirst: ReturnType<typeof vi.fn> }).findFirst.mockResolvedValue({ id: 'phone-match-id', customerName: 'Phone Match', phone: '8888888888' })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await createStudent({ customerName: 'Phone Match', phone: '8888888888', classOrGrade: '9th' })

    expect((db.customer as { findFirst: ReturnType<typeof vi.fn> }).findFirst).toHaveBeenCalledWith({ where: { phone: '8888888888', isActive: true } })
    expect((db.customer as { create: ReturnType<typeof vi.fn> }).create).not.toHaveBeenCalled()
    expect((db.studentProfile as { create: ReturnType<typeof vi.fn> }).create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ customerId: 'phone-match-id' }) })
    )
  })

  it('creates a brand-new customer only when no existing match is found', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await createStudent({ customerName: 'Truly New', phone: '7777777777', classOrGrade: '8th' })

    expect((db.customer as { create: ReturnType<typeof vi.fn> }).create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ customerName: 'Truly New', phone: '7777777777' }) })
    )
    expect((db.studentProfile as { create: ReturnType<typeof vi.fn> }).create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ customerId: 'new-customer-id' }) })
    )
  })

  it('creates a new customer when no phone is provided (nothing to match on)', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await createStudent({ customerName: 'No Phone Given', classOrGrade: '7th' })

    expect((db.customer as { findFirst: ReturnType<typeof vi.fn> }).findFirst).not.toHaveBeenCalled()
    expect((db.customer as { create: ReturnType<typeof vi.fn> }).create).toHaveBeenCalled()
  })
})
