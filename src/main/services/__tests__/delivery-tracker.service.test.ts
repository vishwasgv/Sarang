import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))

import { getPrisma } from '../../database/db'
import { getDeliveryTracker, upsertDeliveryTracker, incrementRevisionRound } from '../delivery-tracker.service'

function makeTracker(overrides: Record<string, unknown> = {}) {
  return {
    id: 'dlv-1', shootBookingId: 'shoot-1',
    proofsSentDate: null, selectionReceivedDate: null, editingStartedDate: null,
    albumProofSentDate: null, finalDeliveredDate: null,
    deliveryFormat: null, deliveredPhotosCount: null, revisionRounds: 0, notes: null,
    createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  }
}

function makeMockDb(existing: ReturnType<typeof makeTracker> | null = makeTracker()) {
  const db: Record<string, any> = {
    deliveryTracker: {
      findUnique: vi.fn().mockResolvedValue(existing),
      upsert: vi.fn().mockImplementation(({ create, update }: { create: Record<string, unknown>; update: Record<string, unknown> }) =>
        Promise.resolve(existing ? makeTracker({ ...existing, ...update }) : makeTracker(create))
      ),
    },
  }
  return db
}

describe('delivery-tracker.service — basic CRUD', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gets a tracker for a shoot booking', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await getDeliveryTracker('shoot-1')
    expect(res.success).toBe(true)
  })

  it('returns null when no tracker exists yet', async () => {
    const db = { deliveryTracker: { findUnique: vi.fn().mockResolvedValue(null) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await getDeliveryTracker('shoot-missing')
    expect(res.success).toBe(true)
    expect((res as { data: unknown }).data).toBeNull()
  })
})

// Real bug found live (2026-08-27 Phase 68 audit): a bare
// `new Date('YYYY-MM-DD')` parses as UTC midnight — inconsistent with this
// app's own parseLocalDateStart convention used everywhere else. This file
// had ZERO prior test coverage.
describe('delivery-tracker.service.upsertDeliveryTracker — local-date construction', () => {
  beforeEach(() => vi.clearAllMocks())

  it('stores proofsSentDate at local midnight, not UTC midnight', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await upsertDeliveryTracker({ shootBookingId: 'shoot-1', proofsSentDate: '2026-08-15' })

    const call = db.deliveryTracker.upsert.mock.calls[0][0]
    expect(call.update.proofsSentDate).toEqual(new Date(2026, 7, 15))
  })

  it('stores finalDeliveredDate at local midnight on first creation (create branch)', async () => {
    const db = makeMockDb(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await upsertDeliveryTracker({ shootBookingId: 'shoot-1', finalDeliveredDate: '2026-09-01' })

    const call = db.deliveryTracker.upsert.mock.calls[0][0]
    expect(call.create.finalDeliveredDate).toEqual(new Date(2026, 8, 1))
  })

  it('clears a milestone date back to null', async () => {
    const db = makeMockDb(makeTracker({ proofsSentDate: new Date(2026, 7, 1) }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await upsertDeliveryTracker({ shootBookingId: 'shoot-1', proofsSentDate: null })

    const call = db.deliveryTracker.upsert.mock.calls[0][0]
    expect(call.update.proofsSentDate).toBeNull()
  })

  it('leaves a field untouched when not part of the payload at all', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await upsertDeliveryTracker({ shootBookingId: 'shoot-1', deliveryFormat: 'USB_DRIVE' })

    const call = db.deliveryTracker.upsert.mock.calls[0][0]
    expect(call.update).not.toHaveProperty('proofsSentDate')
    expect(call.update.deliveryFormat).toBe('USB_DRIVE')
  })
})

// Phase 68 §9.1 — Photo Studio item 5: revision-round tracker.
describe('delivery-tracker.service.incrementRevisionRound', () => {
  beforeEach(() => vi.clearAllMocks())

  it('increments revisionRounds on an existing tracker', async () => {
    const db = makeMockDb(makeTracker({ revisionRounds: 2 }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await incrementRevisionRound('shoot-1')

    expect(res.success).toBe(true)
    expect(db.deliveryTracker.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: { revisionRounds: { increment: 1 } },
    }))
  })

  it('creates a new tracker with revisionRounds=1 when none exists yet', async () => {
    const db = makeMockDb(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await incrementRevisionRound('shoot-1')

    expect(db.deliveryTracker.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: { shootBookingId: 'shoot-1', revisionRounds: 1 },
    }))
  })
})
