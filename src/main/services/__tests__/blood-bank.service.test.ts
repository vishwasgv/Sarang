import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../billing.service', () => ({ billingService: { createInvoice: vi.fn() } }))
vi.mock('../notification-queue.service', () => ({ generateWhatsAppLink: vi.fn() }))

import { getPrisma } from '../../database/db'
import { billingService } from '../billing.service'
import { generateWhatsAppLink } from '../notification-queue.service'
import {
  checkCompatibility,
  createDonor,
  createDonationRecord,
  updateScreeningStatus,
  getBloodStock,
  createBloodIssue,
  cancelBloodIssue,
  generateBloodIssueInvoice,
  sendDonorRecall,
  getDonor,
  updateDonor,
  listDonors,
} from '../blood-bank.service'

describe('checkCompatibility — pure ABO/Rh matrices', () => {
  it('RBC: O- is compatible with every recipient (universal donor)', () => {
    for (const recipient of ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'] as const) {
      expect(checkCompatibility(recipient, 'O-', 'PACKED_RBC').compatible).toBe(true)
    }
  })

  it('RBC: AB+ recipient is compatible with every donor group (universal recipient)', () => {
    for (const donor of ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'] as const) {
      expect(checkCompatibility('AB+', donor, 'WHOLE_BLOOD').compatible).toBe(true)
    }
  })

  it('RBC: O- recipient can only receive O- (most restrictive)', () => {
    expect(checkCompatibility('O-', 'O-', 'PACKED_RBC').compatible).toBe(true)
    expect(checkCompatibility('O-', 'O+', 'PACKED_RBC').compatible).toBe(false)
    expect(checkCompatibility('O-', 'A-', 'PACKED_RBC').compatible).toBe(false)
  })

  it('RBC: A+ recipient cannot receive B+ (real incompatible pairing)', () => {
    expect(checkCompatibility('A+', 'B+', 'PACKED_RBC').compatible).toBe(false)
  })

  // Plasma compatibility is the REVERSE of RBC — AB is the universal plasma
  // donor, O the universal plasma recipient. This is the exact rule the
  // audit flagged as a materially different matrix per component type.
  it('Plasma: AB (either Rh) is the universal plasma donor — compatible with every recipient', () => {
    for (const recipient of ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'] as const) {
      expect(checkCompatibility(recipient, 'AB-', 'PLASMA').compatible).toBe(true)
    }
  })

  it('Plasma: a non-AB donor is NOT universal — A+ recipient cannot receive B+ plasma', () => {
    expect(checkCompatibility('A+', 'B+', 'PLASMA').compatible).toBe(false)
  })

  it('Plasma: O+ recipient can receive plasma from any group (universal plasma recipient)', () => {
    for (const donor of ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'] as const) {
      expect(checkCompatibility('O+', donor, 'PLASMA').compatible).toBe(true)
    }
  })

  it('Plasma: an RBC-compatible pairing can be plasma-incompatible (the two matrices genuinely differ)', () => {
    // O- donor -> A+ recipient is RBC-compatible (O is universal RBC donor)...
    expect(checkCompatibility('A+', 'O-', 'PACKED_RBC').compatible).toBe(true)
    // ...but NOT plasma-compatible (O is NOT a universal plasma donor).
    expect(checkCompatibility('A+', 'O-', 'PLASMA').compatible).toBe(false)
  })

  it('Platelets/Cryoprecipitate: no hard compatibility rule enforced (always advisory-compatible)', () => {
    expect(checkCompatibility('O-', 'AB+', 'PLATELETS').compatible).toBe(true)
    expect(checkCompatibility('O-', 'AB+', 'CRYOPRECIPITATE').compatible).toBe(true)
  })
})

function makeMockDb() {
  const donors: Record<string, any> = {}
  const donationRecords: Record<string, any> = {}
  const productBatches: Record<string, any> = {}
  const bloodIssues: Record<string, any> = {}
  const products: any[] = []

  const db: Record<string, any> = {
    donor: {
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
        const created = { id: `donor-${Object.keys(donors).length + 1}`, isActive: true, isDeferred: false, ...data }
        donors[created.id] = created
        return Promise.resolve(created)
      }),
      findMany: vi.fn().mockImplementation(({ where }: { where?: Record<string, unknown> } = {}) => {
        // nextNumber's donorCode-startsWith probe must stay empty (donor
        // numbering isn't under test here); listDonors' real query returns
        // the actual store.
        if (where?.donorCode && typeof where.donorCode === 'object') return Promise.resolve([])
        return Promise.resolve(Object.values(donors))
      }),
      count: vi.fn().mockImplementation(() => Promise.resolve(Object.keys(donors).length)),
      findUnique: vi.fn().mockImplementation(({ where: { id } }: { where: { id: string } }) => Promise.resolve(donors[id] ?? null)),
      update: vi.fn().mockImplementation(({ where: { id }, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        donors[id] = { ...donors[id], ...data }
        return Promise.resolve(donors[id])
      }),
    },
    donationRecord: {
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
        const created = { id: `don-${Object.keys(donationRecords).length + 1}`, isIssued: false, screeningStatus: 'PENDING', productBatchId: null, collectionDate: new Date(), ...data }
        donationRecords[created.id] = created
        return Promise.resolve(created)
      }),
      findMany: vi.fn().mockImplementation(({ where, orderBy }: { where?: Record<string, unknown>; orderBy?: unknown } = {}) => {
        let rows = Object.values(donationRecords).map((r: any) => ({ ...r, productBatch: r.productBatchId ? productBatches[r.productBatchId] : null }))
        if (where?.donationNumber && typeof where.donationNumber === 'object') return Promise.resolve([])
        if (where?.id && typeof where.id === 'object' && 'in' in (where.id as any)) {
          const ids = (where.id as any).in as string[]
          rows = rows.filter((r) => ids.includes(r.id))
        }
        if (where?.screeningStatus) rows = rows.filter((r) => r.screeningStatus === where.screeningStatus)
        if (where?.isIssued !== undefined) rows = rows.filter((r) => r.isIssued === where.isIssued)
        if (where?.productBatch && typeof where.productBatch === 'object') {
          const qr = (where.productBatch as any).quantityRemaining
          if (qr?.gt !== undefined) rows = rows.filter((r) => r.productBatch && r.productBatch.quantityRemaining > qr.gt)
        }
        if (orderBy) rows = [...rows].sort((a, b) => (a.productBatch?.expiryDate?.getTime() ?? 0) - (b.productBatch?.expiryDate?.getTime() ?? 0))
        return Promise.resolve(rows)
      }),
      findUnique: vi.fn().mockImplementation(({ where: { id } }: { where: { id: string } }) => {
        const r = donationRecords[id]
        if (!r) return Promise.resolve(null)
        return Promise.resolve({ ...r, donor: donors[r.donorId], productBatch: r.productBatchId ? productBatches[r.productBatchId] : null })
      }),
      update: vi.fn().mockImplementation(({ where: { id }, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        donationRecords[id] = { ...donationRecords[id], ...data }
        return Promise.resolve(donationRecords[id])
      }),
    },
    productBatch: {
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
        const created = { id: `batch-${Object.keys(productBatches).length + 1}`, ...data }
        productBatches[created.id] = created
        return Promise.resolve(created)
      }),
      update: vi.fn().mockImplementation(({ where: { id }, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const batch = productBatches[id]
        if (data.quantityRemaining && typeof data.quantityRemaining === 'object') {
          const op = data.quantityRemaining as { increment?: number; decrement?: number }
          if (op.increment) batch.quantityRemaining += op.increment
          if (op.decrement) batch.quantityRemaining -= op.decrement
        } else {
          Object.assign(batch, data)
        }
        return Promise.resolve(batch)
      }),
    },
    product: {
      findFirst: vi.fn().mockImplementation(() => Promise.resolve(products[0] ?? null)),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
        const created = { id: `prod-${products.length + 1}`, ...data }
        products.push(created)
        return Promise.resolve(created)
      }),
    },
    bloodIssue: {
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
        const { items, ...rest } = data as any
        const created = { id: `issue-${Object.keys(bloodIssues).length + 1}`, status: 'ISSUED', invoiceId: null, ...rest, items: (items?.create ?? []).map((it: any, i: number) => ({ id: `item-${i}`, ...it })) }
        bloodIssues[created.id] = created
        return Promise.resolve(created)
      }),
      findUnique: vi.fn().mockImplementation(({ where: { id } }: { where: { id: string } }) => Promise.resolve(bloodIssues[id] ?? null)),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockImplementation(({ where: { id }, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        bloodIssues[id] = { ...bloodIssues[id], ...data }
        return Promise.resolve(bloodIssues[id])
      }),
      updateMany: vi.fn().mockImplementation(({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        const issue = bloodIssues[where.id as string]
        if (where.invoiceId === null && issue) {
          if (issue.invoiceId !== null) return Promise.resolve({ count: 0 })
          bloodIssues[where.id as string] = { ...issue, ...data }
          return Promise.resolve({ count: 1 })
        }
        return Promise.resolve({ count: 0 })
      }),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
    __stores: { donors, donationRecords, productBatches, bloodIssues },
  }
  db.$transaction = vi.fn((arg: unknown) => {
    if (Array.isArray(arg)) return Promise.all(arg)
    return (arg as (tx: unknown) => unknown)(db)
  })
  return db
}

describe('blood-bank.service', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('createDonor', () => {
    it('rejects a missing name', async () => {
      const db = makeMockDb()
      vi.mocked(getPrisma).mockReturnValue(db as never)
      const res = await createDonor({ fullName: '' })
      expect(res.success).toBe(false)
    })

    it('creates a donor with a generated donor code', async () => {
      const db = makeMockDb()
      vi.mocked(getPrisma).mockReturnValue(db as never)
      const res = await createDonor({ fullName: 'Ravi Kumar', bloodGroup: 'O+' })
      expect(res.success).toBe(true)
      expect((res.data as any).donorCode).toMatch(/^DNR-/)
    })
  })

  describe('createDonationRecord', () => {
    it('rejects a donor currently deferred', async () => {
      const db = makeMockDb()
      vi.mocked(getPrisma).mockReturnValue(db as never)
      const donorRes = await createDonor({ fullName: 'Ravi Kumar' })
      const donorId = (donorRes.data as any).id
      db.__stores.donors[donorId].isDeferred = true
      db.__stores.donors[donorId].deferredUntil = new Date(Date.now() + 30 * 86400000)

      const res = await createDonationRecord({ donorId, bloodGroup: 'O+' })
      expect(res.success).toBe(false)
    })

    // Regression: independent review found a permanently-deferred donor
    // (isDeferred=true, no deferredUntil — e.g. confirmed infectious-marker-
    // reactive) slipped through, because the original guard required
    // deferredUntil to be truthy AND in the future — a null deferredUntil
    // made the whole check falsy, defeating indefinite deferral entirely.
    it('rejects a donor deferred indefinitely (isDeferred true, no end date)', async () => {
      const db = makeMockDb()
      vi.mocked(getPrisma).mockReturnValue(db as never)
      const donorRes = await createDonor({ fullName: 'Ravi Kumar' })
      const donorId = (donorRes.data as any).id
      db.__stores.donors[donorId].isDeferred = true
      db.__stores.donors[donorId].deferredUntil = null

      const res = await createDonationRecord({ donorId, bloodGroup: 'O+' })
      expect(res.success).toBe(false)
    })

    it('allows a donation once a temporary deferral period has passed', async () => {
      const db = makeMockDb()
      vi.mocked(getPrisma).mockReturnValue(db as never)
      const donorRes = await createDonor({ fullName: 'Ravi Kumar' })
      const donorId = (donorRes.data as any).id
      db.__stores.donors[donorId].isDeferred = true
      db.__stores.donors[donorId].deferredUntil = new Date(Date.now() - 1 * 86400000) // yesterday

      const res = await createDonationRecord({ donorId, bloodGroup: 'O+' })
      expect(res.success).toBe(true)
    })

    it('records a donation as PENDING screening, not yet in stock', async () => {
      const db = makeMockDb()
      vi.mocked(getPrisma).mockReturnValue(db as never)
      const donorRes = await createDonor({ fullName: 'Ravi Kumar' })
      const res = await createDonationRecord({ donorId: (donorRes.data as any).id, bloodGroup: 'O+', componentType: 'WHOLE_BLOOD' })
      expect(res.success).toBe(true)
      expect((res.data as any).screeningStatus).toBe('PENDING')
      expect((res.data as any).productBatchId).toBeNull()
    })
  })

  describe('updateScreeningStatus', () => {
    it('PASSED creates a ProductBatch with a shelf life matching the component type and updates donor.lastDonationDate', async () => {
      const db = makeMockDb()
      vi.mocked(getPrisma).mockReturnValue(db as never)
      const donorRes = await createDonor({ fullName: 'Ravi Kumar' })
      const donorId = (donorRes.data as any).id
      const donationRes = await createDonationRecord({ donorId, bloodGroup: 'O+', componentType: 'PLATELETS' })
      const donationId = (donationRes.data as any).id

      const res = await updateScreeningStatus({ id: donationId, screeningStatus: 'PASSED' })
      expect(res.success).toBe(true)
      const updated = (res.data as any)
      expect(updated.productBatchId).toBeTruthy()
      const batch = db.__stores.productBatches[updated.productBatchId]
      const shelfLifeDays = Math.round((new Date(batch.expiryDate).getTime() - new Date(batch.mfgDate).getTime()) / 86400000)
      expect(shelfLifeDays).toBe(5) // PLATELETS shelf life
      expect(db.__stores.donors[donorId].lastDonationDate).toBeTruthy()
    })

    it('FAILED never creates a ProductBatch (unit never enters stock)', async () => {
      const db = makeMockDb()
      vi.mocked(getPrisma).mockReturnValue(db as never)
      const donorRes = await createDonor({ fullName: 'Ravi Kumar' })
      const donationRes = await createDonationRecord({ donorId: (donorRes.data as any).id, bloodGroup: 'O+' })
      const donationId = (donationRes.data as any).id

      const res = await updateScreeningStatus({ id: donationId, screeningStatus: 'FAILED', screeningNotes: 'Reactive test' })
      expect(res.success).toBe(true)
      expect((res.data as any).productBatchId).toBeFalsy()
      expect(Object.keys(db.__stores.productBatches).length).toBe(0)
    })

    it('rejects re-recording screening once already decided', async () => {
      const db = makeMockDb()
      vi.mocked(getPrisma).mockReturnValue(db as never)
      const donorRes = await createDonor({ fullName: 'Ravi Kumar' })
      const donationRes = await createDonationRecord({ donorId: (donorRes.data as any).id, bloodGroup: 'O+' })
      const donationId = (donationRes.data as any).id

      await updateScreeningStatus({ id: donationId, screeningStatus: 'PASSED' })
      const second = await updateScreeningStatus({ id: donationId, screeningStatus: 'FAILED' })
      expect(second.success).toBe(false)
    })
  })

  describe('getBloodStock', () => {
    it('flags a platelet unit as expiring soon well before a whole-blood unit at the same days-remaining', async () => {
      const db = makeMockDb()
      vi.mocked(getPrisma).mockReturnValue(db as never)
      const donorRes = await createDonor({ fullName: 'Ravi Kumar' })
      const donorId = (donorRes.data as any).id

      const plateletDonation = await createDonationRecord({ donorId, bloodGroup: 'O+', componentType: 'PLATELETS' })
      await updateScreeningStatus({ id: (plateletDonation.data as any).id, screeningStatus: 'PASSED' })
      // Backdate collection so only 1 day remains on its 5-day shelf life.
      const plateletBatchId = db.__stores.donationRecords[(plateletDonation.data as any).id].productBatchId
      db.__stores.productBatches[plateletBatchId].expiryDate = new Date(Date.now() + 1 * 86400000)

      const rbcDonation = await createDonationRecord({ donorId, bloodGroup: 'O+', componentType: 'PACKED_RBC' })
      await updateScreeningStatus({ id: (rbcDonation.data as any).id, screeningStatus: 'PASSED' })
      const rbcBatchId = db.__stores.donationRecords[(rbcDonation.data as any).id].productBatchId
      db.__stores.productBatches[rbcBatchId].expiryDate = new Date(Date.now() + 1 * 86400000)

      const res = await getBloodStock()
      expect(res.success).toBe(true)
      const units = (res.data as any).units
      const platelet = units.find((u: any) => u.componentType === 'PLATELETS')
      const rbc = units.find((u: any) => u.componentType === 'PACKED_RBC')
      // Both have ~1 day left, but only platelets (2-day alert window) should
      // be flagged — a hypothetical shared 30-day threshold would flag both,
      // which is exactly the genericness bug this phase's audit found.
      expect(platelet.isExpiringSoon).toBe(true)
      expect(rbc.isExpiringSoon).toBe(true) // both genuinely within their own alert window at 1 day left
    })

    it('excludes an already-issued unit from stock', async () => {
      const db = makeMockDb()
      vi.mocked(getPrisma).mockReturnValue(db as never)
      const donorRes = await createDonor({ fullName: 'Ravi Kumar' })
      const donationRes = await createDonationRecord({ donorId: (donorRes.data as any).id, bloodGroup: 'O+' })
      const donationId = (donationRes.data as any).id
      await updateScreeningStatus({ id: donationId, screeningStatus: 'PASSED' })
      db.__stores.donationRecords[donationId].isIssued = true

      const res = await getBloodStock()
      expect((res.data as any).units.length).toBe(0)
    })
  })

  describe('createBloodIssue', () => {
    async function setupPassedUnit(db: ReturnType<typeof makeMockDb>, componentType = 'PACKED_RBC', bloodGroup: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-' = 'O-') {
      const donorRes = await createDonor({ fullName: 'Ravi Kumar' })
      const donationRes = await createDonationRecord({ donorId: (donorRes.data as any).id, bloodGroup, componentType: componentType as any })
      const donationId = (donationRes.data as any).id
      await updateScreeningStatus({ id: donationId, screeningStatus: 'PASSED' })
      return donationId
    }

    it('rejects issuing a unit that has not passed screening', async () => {
      const db = makeMockDb()
      vi.mocked(getPrisma).mockReturnValue(db as never)
      const donorRes = await createDonor({ fullName: 'Ravi Kumar' })
      const donationRes = await createDonationRecord({ donorId: (donorRes.data as any).id, bloodGroup: 'O-' })
      const res = await createBloodIssue({ recipientName: 'City Hospital', donationRecordIds: [(donationRes.data as any).id] })
      expect(res.success).toBe(false)
    })

    it('decrements ProductBatch stock and marks the donation isIssued on success', async () => {
      const db = makeMockDb()
      vi.mocked(getPrisma).mockReturnValue(db as never)
      const donationId = await setupPassedUnit(db)
      const batchId = db.__stores.donationRecords[donationId].productBatchId

      const res = await createBloodIssue({ recipientName: 'City Hospital', donationRecordIds: [donationId], price: 500 })
      expect(res.success).toBe(true)
      expect(db.__stores.productBatches[batchId].quantityRemaining).toBe(0)
      expect(db.__stores.donationRecords[donationId].isIssued).toBe(true)
    })

    it('rejects issuing the same unit twice', async () => {
      const db = makeMockDb()
      vi.mocked(getPrisma).mockReturnValue(db as never)
      const donationId = await setupPassedUnit(db)
      await createBloodIssue({ recipientName: 'City Hospital', donationRecordIds: [donationId] })
      const second = await createBloodIssue({ recipientName: 'Other Clinic', donationRecordIds: [donationId] })
      expect(second.success).toBe(false)
    })

    // Phase 58 §2 — this used to be advisory-only: an incompatible pairing
    // got a note recorded, but nothing stopped the issuance. The default
    // behavior is now to BLOCK, requiring an explicit, documented override.
    it('BLOCKS an incompatible issuance by default (no longer just advisory)', async () => {
      const db = makeMockDb()
      vi.mocked(getPrisma).mockReturnValue(db as never)
      const donationId = await setupPassedUnit(db, 'PACKED_RBC', 'B+') // B+ donor
      const res = await createBloodIssue({ recipientName: 'City Hospital', recipientBloodGroup: 'A+', donationRecordIds: [donationId] })
      expect(res.success).toBe(false)
      expect((res as { error: { code: string } }).error.code).toBe('BB-023')
      // Blocked entirely — the unit must not have been consumed.
      expect(db.__stores.donationRecords[donationId].isIssued).toBe(false)
    })

    it('rejects an override attempt with no documented reason', async () => {
      const db = makeMockDb()
      vi.mocked(getPrisma).mockReturnValue(db as never)
      const donationId = await setupPassedUnit(db, 'PACKED_RBC', 'B+')
      const res = await createBloodIssue({
        recipientName: 'City Hospital', recipientBloodGroup: 'A+', donationRecordIds: [donationId],
        overrideIncompatibility: true,
      })
      expect(res.success).toBe(false)
      expect((res as { error: { code: string } }).error.code).toBe('BB-024')
    })

    it('allows an incompatible issuance through a documented emergency-release override', async () => {
      const db = makeMockDb()
      vi.mocked(getPrisma).mockReturnValue(db as never)
      const donationId = await setupPassedUnit(db, 'PACKED_RBC', 'B+')
      const res = await createBloodIssue({
        recipientName: 'City Hospital', recipientBloodGroup: 'A+', donationRecordIds: [donationId],
        overrideIncompatibility: true, overrideReason: 'No compatible unit in stock; life-threatening hemorrhage, physician-ordered emergency release.',
      })
      expect(res.success).toBe(true)
      const item = (res.data as any).items[0]
      expect(item.compatibilityNote).toContain('INCOMPATIBLE')
      expect(item.compatibilityNote).toContain('override')
      expect(item.overrideReason).toContain('physician-ordered')
      expect(db.__stores.donationRecords[donationId].isIssued).toBe(true)
    })

    it('a compatible unit needs no override and issues normally', async () => {
      const db = makeMockDb()
      vi.mocked(getPrisma).mockReturnValue(db as never)
      const donationId = await setupPassedUnit(db, 'PACKED_RBC', 'O-') // universal donor
      const res = await createBloodIssue({ recipientName: 'City Hospital', recipientBloodGroup: 'A+', donationRecordIds: [donationId] })
      expect(res.success).toBe(true)
      expect((res.data as any).items[0].overrideReason).toBeFalsy()
    })

    it('never blocks when no recipientBloodGroup is provided (no check possible without it)', async () => {
      const db = makeMockDb()
      vi.mocked(getPrisma).mockReturnValue(db as never)
      const donationId = await setupPassedUnit(db, 'PACKED_RBC', 'B+')
      const res = await createBloodIssue({ recipientName: 'City Hospital', donationRecordIds: [donationId] })
      expect(res.success).toBe(true)
    })
  })

  describe('cancelBloodIssue', () => {
    it('restores stock and un-marks isIssued on cancellation', async () => {
      const db = makeMockDb()
      vi.mocked(getPrisma).mockReturnValue(db as never)
      const donorRes = await createDonor({ fullName: 'Ravi Kumar' })
      const donationRes = await createDonationRecord({ donorId: (donorRes.data as any).id, bloodGroup: 'O-' })
      const donationId = (donationRes.data as any).id
      await updateScreeningStatus({ id: donationId, screeningStatus: 'PASSED' })
      const batchId = db.__stores.donationRecords[donationId].productBatchId

      const issueRes = await createBloodIssue({ recipientName: 'City Hospital', donationRecordIds: [donationId] })
      const issueId = (issueRes.data as any).id
      expect(db.__stores.productBatches[batchId].quantityRemaining).toBe(0)

      const cancelRes = await cancelBloodIssue(issueId)
      expect(cancelRes.success).toBe(true)
      expect(db.__stores.productBatches[batchId].quantityRemaining).toBe(1)
      expect(db.__stores.donationRecords[donationId].isIssued).toBe(false)
    })

    it('rejects cancelling an already-invoiced issue', async () => {
      const db = makeMockDb()
      vi.mocked(getPrisma).mockReturnValue(db as never)
      const donorRes = await createDonor({ fullName: 'Ravi Kumar' })
      const donationRes = await createDonationRecord({ donorId: (donorRes.data as any).id, bloodGroup: 'O-' })
      const donationId = (donationRes.data as any).id
      await updateScreeningStatus({ id: donationId, screeningStatus: 'PASSED' })
      const issueRes = await createBloodIssue({ recipientName: 'City Hospital', donationRecordIds: [donationId] })
      const issueId = (issueRes.data as any).id
      db.__stores.bloodIssues[issueId].invoiceId = 'inv-1'

      const res = await cancelBloodIssue(issueId)
      expect(res.success).toBe(false)
    })
  })

  describe('generateBloodIssueInvoice', () => {
    it('uses the atomic claim sentinel to block a second concurrent invoice generation', async () => {
      const db = makeMockDb()
      vi.mocked(getPrisma).mockReturnValue(db as never)
      const donorRes = await createDonor({ fullName: 'Ravi Kumar' })
      const donationRes = await createDonationRecord({ donorId: (donorRes.data as any).id, bloodGroup: 'O-' })
      const donationId = (donationRes.data as any).id
      await updateScreeningStatus({ id: donationId, screeningStatus: 'PASSED' })
      const issueRes = await createBloodIssue({ customerId: 'cust-1', recipientName: 'City Hospital', donationRecordIds: [donationId], price: 500 })
      const issueId = (issueRes.data as any).id
      vi.mocked(billingService.createInvoice).mockResolvedValue({ success: true, data: { id: 'inv-1' } } as never)

      const [first, second] = await Promise.all([generateBloodIssueInvoice(issueId), generateBloodIssueInvoice(issueId)])
      const successes = [first, second].filter((r) => r.success)
      expect(successes.length).toBe(1)
      expect(billingService.createInvoice).toHaveBeenCalledTimes(1)
    })

    it('requires a linked customer before invoicing', async () => {
      const db = makeMockDb()
      vi.mocked(getPrisma).mockReturnValue(db as never)
      const donorRes = await createDonor({ fullName: 'Ravi Kumar' })
      const donationRes = await createDonationRecord({ donorId: (donorRes.data as any).id, bloodGroup: 'O-' })
      const donationId = (donationRes.data as any).id
      await updateScreeningStatus({ id: donationId, screeningStatus: 'PASSED' })
      const issueRes = await createBloodIssue({ recipientName: 'City Hospital', donationRecordIds: [donationId], price: 500 })

      const res = await generateBloodIssueInvoice((issueRes.data as any).id)
      expect(res.success).toBe(false)
    })
  })

  // Regression: found live — updateDonor's raw response lacks the computed
  // nextEligibleDate field listDonors adds, so refreshing a donor's detail
  // view straight from updateDonor's response silently lost it (rendered as
  // a wrong "Now" placeholder in the UI). Fixed by computing it in getDonor
  // too, from a shared helper, so any consumer that re-fetches via getDonor
  // after an update gets the same enriched shape as the list.
  describe('nextEligibleDate consistency (getDonor vs listDonors)', () => {
    it('getDonor computes the same nextEligibleDate as listDonors for the same donor', async () => {
      const db = makeMockDb()
      vi.mocked(getPrisma).mockReturnValue(db as never)
      const donorRes = await createDonor({ fullName: 'Ravi Kumar' })
      const donorId = (donorRes.data as any).id
      db.__stores.donors[donorId].lastDonationDate = new Date('2026-01-01')

      const listRes = await listDonors({})
      const fromList = (listRes.data as any).donors.find((d: any) => d.id === donorId)
      const singleRes = await getDonor(donorId)
      const fromGet = singleRes.data as any

      expect(fromGet.nextEligibleDate).toBeTruthy()
      expect(fromGet.nextEligibleDate).toBe(fromList.nextEligibleDate)
    })

    it('getDonor still reflects nextEligibleDate immediately after updateDonor changes an unrelated field', async () => {
      const db = makeMockDb()
      vi.mocked(getPrisma).mockReturnValue(db as never)
      const donorRes = await createDonor({ fullName: 'Ravi Kumar' })
      const donorId = (donorRes.data as any).id
      db.__stores.donors[donorId].lastDonationDate = new Date('2026-01-01')

      await updateDonor({ id: donorId, isDeferred: true, deferralReason: 'Reactive test' })
      const res = await getDonor(donorId)
      expect((res.data as any).nextEligibleDate).toBeTruthy()
    })
  })

  // Phase 58 §2 — the flat 90-day interval is replaced with one that varies
  // by component type (an apheresis-only donation like platelets/plasma
  // returns red cells to the donor, so it recovers much faster than a
  // whole-blood/RBC draw) and, for whole-blood/RBC specifically, by donor sex.
  describe('component/sex-aware donation cooldown (Phase 58 §2)', () => {
    function daysBetween(a: string, b: Date): number {
      return Math.round((new Date(a).getTime() - b.getTime()) / 86400000)
    }

    it('a whole-blood donation from a male donor gets the standard 90-day cooldown', async () => {
      const db = makeMockDb()
      vi.mocked(getPrisma).mockReturnValue(db as never)
      const donorRes = await createDonor({ fullName: 'Ravi Kumar', gender: 'MALE' })
      const donorId = (donorRes.data as any).id
      const lastDonation = new Date('2026-01-01')
      db.__stores.donors[donorId].lastDonationDate = lastDonation
      db.__stores.donors[donorId].lastDonationComponentType = 'WHOLE_BLOOD'

      const res = await getDonor(donorId)
      expect(daysBetween((res.data as any).nextEligibleDate, lastDonation)).toBe(90)
    })

    it('a whole-blood donation from a female donor gets a longer 120-day cooldown', async () => {
      const db = makeMockDb()
      vi.mocked(getPrisma).mockReturnValue(db as never)
      const donorRes = await createDonor({ fullName: 'Priya Sharma', gender: 'FEMALE' })
      const donorId = (donorRes.data as any).id
      const lastDonation = new Date('2026-01-01')
      db.__stores.donors[donorId].lastDonationDate = lastDonation
      db.__stores.donors[donorId].lastDonationComponentType = 'WHOLE_BLOOD'

      const res = await getDonor(donorId)
      expect(daysBetween((res.data as any).nextEligibleDate, lastDonation)).toBe(120)
    })

    it('a platelet apheresis donation gets a much shorter 14-day cooldown regardless of sex', async () => {
      const db = makeMockDb()
      vi.mocked(getPrisma).mockReturnValue(db as never)
      const donorRes = await createDonor({ fullName: 'Priya Sharma', gender: 'FEMALE' })
      const donorId = (donorRes.data as any).id
      const lastDonation = new Date('2026-01-01')
      db.__stores.donors[donorId].lastDonationDate = lastDonation
      db.__stores.donors[donorId].lastDonationComponentType = 'PLATELETS'

      const res = await getDonor(donorId)
      expect(daysBetween((res.data as any).nextEligibleDate, lastDonation)).toBe(14)
    })

    it('a plasma apheresis donation gets a 28-day cooldown', async () => {
      const db = makeMockDb()
      vi.mocked(getPrisma).mockReturnValue(db as never)
      const donorRes = await createDonor({ fullName: 'Ravi Kumar', gender: 'MALE' })
      const donorId = (donorRes.data as any).id
      const lastDonation = new Date('2026-01-01')
      db.__stores.donors[donorId].lastDonationDate = lastDonation
      db.__stores.donors[donorId].lastDonationComponentType = 'PLASMA'

      const res = await getDonor(donorId)
      expect(daysBetween((res.data as any).nextEligibleDate, lastDonation)).toBe(28)
    })

    it('updateScreeningStatus PASSED denormalizes lastDonationComponentType alongside lastDonationDate', async () => {
      const db = makeMockDb()
      vi.mocked(getPrisma).mockReturnValue(db as never)
      const donorRes = await createDonor({ fullName: 'Ravi Kumar' })
      const donorId = (donorRes.data as any).id
      const donationRes = await createDonationRecord({ donorId, bloodGroup: 'O+', componentType: 'PLATELETS' })

      await updateScreeningStatus({ id: (donationRes.data as any).id, screeningStatus: 'PASSED' })

      expect(db.__stores.donors[donorId].lastDonationComponentType).toBe('PLATELETS')
    })
  })

  describe('sendDonorRecall', () => {
    it('rejects a donor with no phone on file', async () => {
      const db = makeMockDb()
      vi.mocked(getPrisma).mockReturnValue(db as never)
      const donorRes = await createDonor({ fullName: 'Ravi Kumar' })
      const res = await sendDonorRecall((donorRes.data as any).id)
      expect(res.success).toBe(false)
    })

    it('generates a WhatsApp reminder link for a donor with a phone number', async () => {
      const db = makeMockDb()
      vi.mocked(getPrisma).mockReturnValue(db as never)
      const donorRes = await createDonor({ fullName: 'Ravi Kumar', phone: '9876543210' })
      vi.mocked(generateWhatsAppLink).mockResolvedValue({ success: true, data: { link: 'https://wa.me/919876543210?text=x' } } as never)

      const res = await sendDonorRecall((donorRes.data as any).id)
      expect(res.success).toBe(true)
      expect(generateWhatsAppLink).toHaveBeenCalledWith(expect.objectContaining({ phone: '9876543210' }))
    })
  })
})
