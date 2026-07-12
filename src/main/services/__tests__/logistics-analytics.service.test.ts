import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))

import { getPrisma } from '../../database/db'
import { getLogisticsAnalytics } from '../logistics-analytics.service'

function makeDb(shipments: any[] = []) {
  return {
    shipment: { findMany: vi.fn().mockResolvedValue(shipments), groupBy: vi.fn().mockResolvedValue([]) },
    deliveryChallan: { findMany: vi.fn().mockResolvedValue([]) },
    goodsReceiptNote: { findMany: vi.fn().mockResolvedValue([]) },
    freightLedger: { findMany: vi.fn().mockResolvedValue([]) },
    vehicle: { findMany: vi.fn().mockResolvedValue([]) },
    carrier: { findMany: vi.fn().mockResolvedValue([]) },
  } as never
}

beforeEach(() => vi.clearAllMocks())

describe('getLogisticsAnalytics — avgDeliveryDays', () => {
  it('averages only DELIVERED shipments with both inTransitAt and deliveredAt set', async () => {
    const db = makeDb([
      { status: 'DELIVERED', inTransitAt: new Date('2026-01-01'), deliveredAt: new Date('2026-01-03') }, // 2 days
      { status: 'DELIVERED', inTransitAt: new Date('2026-01-01'), deliveredAt: new Date('2026-01-05') }, // 4 days
      { status: 'DELIVERED', inTransitAt: null, deliveredAt: new Date('2026-01-05') }, // excluded — no inTransitAt
      { status: 'PENDING', inTransitAt: null, deliveredAt: null },
    ])
    vi.mocked(getPrisma).mockReturnValue(db)

    const result = await getLogisticsAnalytics()

    expect(result.success).toBe(true)
    const data = (result as { data: { shipments: { avgDeliveryDays: number } } }).data
    expect(data.shipments.avgDeliveryDays).toBe(3) // (2+4)/2, not diluted by the 3rd/4th record
  })

  it('returns 0 when there are no measurable deliveries', async () => {
    const db = makeDb([{ status: 'PENDING', inTransitAt: null, deliveredAt: null }])
    vi.mocked(getPrisma).mockReturnValue(db)

    const result = await getLogisticsAnalytics()

    const data = (result as { data: { shipments: { avgDeliveryDays: number } } }).data
    expect(data.shipments.avgDeliveryDays).toBe(0)
  })
})
