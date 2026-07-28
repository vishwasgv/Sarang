import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))

import { getPrisma } from '../../database/db'
import { createStudent, updateStudent, listStudents } from '../student-profile.service'

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
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'profile-1', customerId: 'new-customer-id', enrollmentDate: new Date(), ...data, customer: { customerName: 'New Student' } })
      ),
      findUnique: vi.fn().mockResolvedValue({ id: 'profile-1', customerId: 'existing-customer-id', enrollmentDate: new Date(2026, 2, 10), rollNumber: null, classOrGrade: '10th', schoolName: null, parentPhone: null, isActive: true }),
      update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'profile-1', customerId: 'existing-customer-id', enrollmentDate: new Date(2026, 2, 10), rollNumber: null, classOrGrade: '10th', schoolName: null, parentPhone: null, isActive: true, ...data, customer: { customerName: 'Existing Student' } })
      ),
      findMany: vi.fn().mockResolvedValue([{ id: 'profile-1', customerId: 'existing-customer-id', enrollmentDate: new Date(2026, 2, 10), rollNumber: null, classOrGrade: '10th', schoolName: null, parentPhone: null, isActive: true, customer: { customerName: 'Existing Student' } }]),
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

// Real bug found live (2026-07-28 sales/agency/education-vertical audit):
// StudentProfile.enrollmentDate is a non-nullable DateTime field that used
// to be returned across Electron's IPC boundary as a raw Prisma Date
// instance — structured clone preserves it without throwing (unlike a
// Decimal, caught immediately in dev), so this shipped as a live, always-
// reproducible renderer crash: StudentsScreen.tsx's edit-form populator
// (openEdit) calls `s.enrollmentDate.split('T')[0]` directly, assuming an
// ISO string — crashing on EVERY student edit.
describe('student-profile.service — enrollmentDate IPC serialization', () => {
  beforeEach(() => vi.clearAllMocks())

  it('createStudent stores an explicit enrollmentDate at local midnight and returns it as an ISO string', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createStudent({ customerName: 'New Student', classOrGrade: '10th', enrollmentDate: '2026-03-10' })

    expect(res.success).toBe(true)
    const call = (db.studentProfile as { create: ReturnType<typeof vi.fn> }).create.mock.calls[0][0]
    const stored: Date = call.data.enrollmentDate
    expect(stored.getDate()).toBe(10)
    expect(stored.getHours()).toBe(0) // local midnight, not shifted by a bare UTC parse

    const data = (res as { data: { enrollmentDate: unknown } }).data
    expect(typeof data.enrollmentDate).toBe('string')
    expect(data.enrollmentDate).not.toBeInstanceOf(Date)
    expect((data.enrollmentDate as string).slice(0, 10)).toBe('2026-03-10')
  })

  it('listStudents returns enrollmentDate as an ISO string, not a raw Date instance', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await listStudents({})

    expect(res.success).toBe(true)
    const row = (res as { data: Array<{ enrollmentDate: unknown }> }).data[0]
    expect(typeof row.enrollmentDate).toBe('string')
    expect(row.enrollmentDate).not.toBeInstanceOf(Date)
  })

  it('updateStudent returns enrollmentDate as an ISO string', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateStudent({ id: 'profile-1', classOrGrade: '11th' })

    expect(res.success).toBe(true)
    const data = (res as { data: { enrollmentDate: unknown } }).data
    expect(typeof data.enrollmentDate).toBe('string')
    expect(data.enrollmentDate).not.toBeInstanceOf(Date)
  })
})
