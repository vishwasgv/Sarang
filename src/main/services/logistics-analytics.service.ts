import { getPrisma } from '../database/db'

export async function getLogisticsAnalytics(payload?: { fromDate?: string; toDate?: string }) {
  try {
    const db = getPrisma()
    const now = new Date()
    const from = payload?.fromDate ? new Date(payload.fromDate + 'T00:00:00.000') : new Date(now.getFullYear(), now.getMonth(), 1)
    const to = payload?.toDate ? new Date(payload.toDate + 'T23:59:59.999') : now

    const [shipments, challans, grns, freight, vehicles, carriers] = await Promise.all([
      db.shipment.findMany({ where: { createdAt: { gte: from, lte: to } } }),
      db.deliveryChallan.findMany({ where: { createdAt: { gte: from, lte: to } } }),
      db.goodsReceiptNote.findMany({ where: { createdAt: { gte: from, lte: to } } }),
      db.freightLedger.findMany({ where: { createdAt: { gte: from, lte: to } } }),
      db.vehicle.findMany(),
      db.carrier.findMany({ where: { isActive: true } }),
    ])

    const shipmentByStatus: Record<string, number> = {}
    for (const s of shipments) {
      shipmentByStatus[s.status] = (shipmentByStatus[s.status] ?? 0) + 1
    }

    const deliveredShipments = shipments.filter(s => s.status === 'DELIVERED')
    // Only average over shipments that have both timestamps — avoids wrong divisor
    const measurable = deliveredShipments.filter(s => s.deliveredAt && s.inTransitAt)
    const avgDeliveryDays = measurable.length
      ? measurable.reduce((sum, s) => {
          return sum + (s.deliveredAt!.getTime() - s.inTransitAt!.getTime()) / (1000 * 60 * 60 * 24)
        }, 0) / measurable.length
      : 0

    const freightTotal = freight.reduce((s, f) => s + f.amount, 0)
    const freightPaid = freight.filter(f => f.paidDate !== null).reduce((s, f) => s + f.amount, 0)
    const freightPending = freightTotal - freightPaid

    const vehicleByStatus: Record<string, number> = {}
    for (const v of vehicles) vehicleByStatus[v.status] = (vehicleByStatus[v.status] ?? 0) + 1

    const grnTotal = grns.reduce((s, g) => s + g.totalValue, 0)
    const grnPosted = grns.filter(g => g.status === 'POSTED').length

    // Monthly trend — base the 6-month window on `to` instead of always using now
    // Uses two single queries (shipments + freight) instead of 12 sequential DB calls
    const trendEnd = to
    const trendStart = new Date(trendEnd.getFullYear(), trendEnd.getMonth() - 5, 1)

    const [trendShipments, trendFreight] = await Promise.all([
      db.shipment.findMany({
        where: { createdAt: { gte: trendStart, lte: trendEnd } },
        select: { createdAt: true },
      }),
      db.freightLedger.findMany({
        where: { createdAt: { gte: trendStart, lte: trendEnd } },
        select: { createdAt: true, amount: true },
      }),
    ])

    const monthlyShipments: Array<{ month: string; count: number; freight: number }> = []
    for (let i = 5; i >= 0; i--) {
      const mStart = new Date(trendEnd.getFullYear(), trendEnd.getMonth() - i, 1)
      const mEnd = new Date(trendEnd.getFullYear(), trendEnd.getMonth() - i + 1, 0, 23, 59, 59, 999)
      const mLabel = mStart.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
      const mCount = trendShipments.filter(s => s.createdAt >= mStart && s.createdAt <= mEnd).length
      const mFreight = trendFreight
        .filter(f => f.createdAt >= mStart && f.createdAt <= mEnd)
        .reduce((s, f) => s + f.amount, 0)
      monthlyShipments.push({ month: mLabel, count: mCount, freight: mFreight })
    }

    // Top carriers with names — single groupBy + one name lookup
    const carrierShipmentCounts = await db.shipment.groupBy({
      by: ['carrierId'], _count: { id: true },
      where: { createdAt: { gte: from, lte: to }, carrierId: { not: null } },
    })
    const carrierIds = carrierShipmentCounts.map(c => c.carrierId).filter(Boolean) as string[]
    const carrierNames = carrierIds.length > 0
      ? await db.carrier.findMany({ where: { id: { in: carrierIds } }, select: { id: true, name: true } })
      : []
    const carrierNameMap = Object.fromEntries(carrierNames.map(c => [c.id, c.name]))
    const topCarriers = carrierShipmentCounts
      .sort((a, b) => b._count.id - a._count.id)
      .slice(0, 5)
      .map(c => ({ carrierId: c.carrierId, name: carrierNameMap[c.carrierId!] ?? 'Unknown', count: c._count.id }))

    return {
      success: true,
      data: {
        period: { from: from.toISOString(), to: to.toISOString() },
        shipments: {
          total: shipments.length,
          byStatus: shipmentByStatus,
          avgDeliveryDays: Math.round(avgDeliveryDays * 10) / 10,
          deliveryRate: shipments.length ? Math.round((deliveredShipments.length / shipments.length) * 100) : 0,
        },
        challans: {
          total: challans.length,
          delivered: challans.filter(c => c.status === 'DELIVERED').length,
          returned: challans.filter(c => c.status === 'RETURNED').length,
        },
        grns: {
          total: grns.length, posted: grnPosted, totalValue: grnTotal,
        },
        freight: {
          total: freightTotal, paid: freightPaid, pending: freightPending,
          avgPerShipment: shipments.length ? Math.round(freightTotal / shipments.length) : 0,
        },
        fleet: {
          total: vehicles.length,
          byStatus: vehicleByStatus,
          activeCarriers: carriers.length,
        },
        monthlyShipments,
        topCarriers,
      }
    }
  } catch (err) {
    return { success: false, error: { code: 'LOG-060', message: err instanceof Error ? err.message : 'Failed to get logistics analytics.' } }
  }
}
