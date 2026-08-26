import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))

import { getPrisma } from '../../database/db'
import { recordTrialSession, getTrialConversionSummary } from '../trial-session.service'

const PRODUCT_ID = 'prod-shoe-1'
const VARIANT_A = 'var-a'
const VARIANT_B = 'var-b'
const VARIANT_C = 'var-c'

function makeMockDb(overrides: Record<string, any> = {}) {
  const db: Record<string, any> = {
    product: { findUnique: vi.fn().mockResolvedValue({ id: PRODUCT_ID, productName: 'Runner 5000' }) },
    productVariant: { count: vi.fn().mockResolvedValue(2) },
    trialSession: {
      create: vi.fn().mockImplementation(({ data }: any) =>
        Promise.resolve({
          id: 'trial-1',
          productId: data.productId,
          triedVariantIds: data.triedVariantIds,
          purchasedVariantId: data.purchasedVariantId,
          customerId: data.customerId,
          createdById: data.createdById,
          createdAt: new Date('2026-08-25T10:00:00Z')
        })
      ),
      findMany: vi.fn().mockResolvedValue([])
    },
    ...overrides
  }
  return db
}

describe('trial-session.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('recordTrialSession', () => {
    it('rejects fewer than two tried variants', async () => {
      const db = makeMockDb()
      vi.mocked(getPrisma).mockReturnValue(db as any)
      const res = await recordTrialSession({ productId: PRODUCT_ID, triedVariantIds: [VARIANT_A] })
      expect(res.success).toBe(false)
      expect(res.error?.code).toBe('TRIAL-001')
    })

    it('rejects a purchased variant that was not in the tried list', async () => {
      const db = makeMockDb()
      vi.mocked(getPrisma).mockReturnValue(db as any)
      const res = await recordTrialSession({ productId: PRODUCT_ID, triedVariantIds: [VARIANT_A, VARIANT_B], purchasedVariantId: VARIANT_C })
      expect(res.success).toBe(false)
      expect(res.error?.code).toBe('TRIAL-002')
    })

    it('rejects an unknown product', async () => {
      const db = makeMockDb({ product: { findUnique: vi.fn().mockResolvedValue(null) } })
      vi.mocked(getPrisma).mockReturnValue(db as any)
      const res = await recordTrialSession({ productId: 'missing', triedVariantIds: [VARIANT_A, VARIANT_B] })
      expect(res.success).toBe(false)
      expect(res.error?.code).toBe('TRIAL-003')
    })

    it('rejects a tried variant that does not belong to the product', async () => {
      const db = makeMockDb({ productVariant: { count: vi.fn().mockResolvedValue(1) } })
      vi.mocked(getPrisma).mockReturnValue(db as any)
      const res = await recordTrialSession({ productId: PRODUCT_ID, triedVariantIds: [VARIANT_A, VARIANT_B] })
      expect(res.success).toBe(false)
      expect(res.error?.code).toBe('TRIAL-004')
    })

    it('records a trial session with no purchase', async () => {
      const db = makeMockDb()
      vi.mocked(getPrisma).mockReturnValue(db as any)
      const res = await recordTrialSession({ productId: PRODUCT_ID, triedVariantIds: [VARIANT_A, VARIANT_B] }, 'user-1')
      expect(res.success).toBe(true)
      expect(res.data?.purchasedVariantId).toBeNull()
      expect(res.data?.triedVariantIds).toEqual([VARIANT_A, VARIANT_B])
      expect(db.trialSession.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ purchasedVariantId: null, createdById: 'user-1' }) })
      )
    })

    it('records a trial session that converted to a purchase', async () => {
      const db = makeMockDb()
      vi.mocked(getPrisma).mockReturnValue(db as any)
      const res = await recordTrialSession({ productId: PRODUCT_ID, triedVariantIds: [VARIANT_A, VARIANT_B], purchasedVariantId: VARIANT_A })
      expect(res.success).toBe(true)
      expect(res.data?.purchasedVariantId).toBe(VARIANT_A)
    })

    it('deduplicates repeated variant ids in the tried list', async () => {
      const db = makeMockDb()
      vi.mocked(getPrisma).mockReturnValue(db as any)
      const res = await recordTrialSession({ productId: PRODUCT_ID, triedVariantIds: [VARIANT_A, VARIANT_A, VARIANT_B] })
      expect(res.success).toBe(true)
      expect(res.data?.triedVariantIds).toEqual([VARIANT_A, VARIANT_B])
    })
  })

  describe('getTrialConversionSummary', () => {
    it('returns all-zero summary when there are no sessions', async () => {
      const db = makeMockDb()
      vi.mocked(getPrisma).mockReturnValue(db as any)
      const res = await getTrialConversionSummary()
      expect(res.success).toBe(true)
      expect(res.data).toEqual({
        totalSessions: 0,
        convertedSessions: 0,
        conversionRatePercent: 0,
        avgPairsTriedPerSession: 0,
        avgPairsTriedPerConversion: 0
      })
    })

    it('computes conversion rate and average pairs tried', async () => {
      const db = makeMockDb({
        trialSession: {
          findMany: vi.fn().mockResolvedValue([
            { triedVariantIds: JSON.stringify([VARIANT_A, VARIANT_B]), purchasedVariantId: VARIANT_A },
            { triedVariantIds: JSON.stringify([VARIANT_A, VARIANT_B, VARIANT_C]), purchasedVariantId: null },
            { triedVariantIds: JSON.stringify([VARIANT_A, VARIANT_B]), purchasedVariantId: VARIANT_B }
          ])
        }
      })
      vi.mocked(getPrisma).mockReturnValue(db as any)
      const res = await getTrialConversionSummary()
      expect(res.success).toBe(true)
      expect(res.data?.totalSessions).toBe(3)
      expect(res.data?.convertedSessions).toBe(2)
      expect(res.data?.conversionRatePercent).toBeCloseTo(66.67, 1)
      // (2 + 3 + 2) / 3 = 2.33
      expect(res.data?.avgPairsTriedPerSession).toBeCloseTo(2.33, 1)
      // converted sessions tried 2 + 2 = 4 pairs across 2 conversions
      expect(res.data?.avgPairsTriedPerConversion).toBe(2)
    })
  })
})
