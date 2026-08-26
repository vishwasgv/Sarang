import { getPrisma } from '../database/db'

// Phase 67 §9.1 — Distributor item 5: Auto Risk-Scored Retailer Credit —
// "replaces a static credit limit with one that flexes on actual payment
// history." billing.service.ts's own credit-limit enforcement (see its
// CUST-003 check) previously compared the projected balance against a
// single static Customer.creditLimit set once and never revisited. This
// computes a real risk tier from the customer's own last 12 months of
// invoices/payments and an EFFECTIVE limit (creditLimit × a tier
// multiplier) — better payers earn more headroom, risky ones get less,
// live-computed every time, never persisted (same "never stale, always
// re-derived" convention as ServiceTicket.isSlaBreached elsewhere this phase).

const HISTORY_WINDOW_DAYS = 365
const RISK_MULTIPLIER: Record<string, number> = { LOW: 1.25, UNRATED: 1.0, MEDIUM: 1.0, HIGH: 0.5 }

export interface CreditRiskAssessment {
  customerId: string
  riskTier: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNRATED'
  avgDaysLate: number
  currentOverdueCount: number
  maxOverdueDays: number
  baseCreditLimit: number
  riskMultiplier: number
  effectiveCreditLimit: number
}

export async function getCustomerCreditRisk(customerId: string): Promise<{ success: boolean; data?: CreditRiskAssessment; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const customer = await db.customer.findUnique({ where: { id: customerId }, select: { creditLimit: true } })
    if (!customer) return { success: false, error: { code: 'CRISK-001', message: 'Customer not found.' } }

    const windowStart = new Date(Date.now() - HISTORY_WINDOW_DAYS * 86400000)
    const invoices = await db.invoice.findMany({
      where: { customerId, dueDate: { not: null }, invoiceDate: { gte: windowStart }, status: { not: 'CANCELLED' } },
      select: { id: true, dueDate: true, balanceAmount: true, paymentStatus: true },
    })

    const now = new Date()
    let currentOverdueCount = 0
    let maxOverdueDays = 0
    const paidInvoiceIds: string[] = []
    for (const inv of invoices) {
      if (!inv.dueDate) continue
      if (inv.balanceAmount > 0 && inv.dueDate < now) {
        currentOverdueCount++
        const days = Math.floor((now.getTime() - inv.dueDate.getTime()) / 86400000)
        if (days > maxOverdueDays) maxOverdueDays = days
      }
      if (inv.paymentStatus === 'PAID' || inv.paymentStatus === 'PARTIAL') paidInvoiceIds.push(inv.id)
    }

    let avgDaysLate = 0
    if (paidInvoiceIds.length > 0) {
      const dueDateById = new Map(invoices.map((inv) => [inv.id, inv.dueDate as Date]))
      const payments = await db.payment.findMany({
        where: { invoiceId: { in: paidInvoiceIds }, isReversed: false },
        select: { invoiceId: true, paymentDate: true },
      })
      const latestPaymentByInvoice = new Map<string, Date>()
      for (const p of payments) {
        const existing = latestPaymentByInvoice.get(p.invoiceId)
        if (!existing || p.paymentDate > existing) latestPaymentByInvoice.set(p.invoiceId, p.paymentDate)
      }
      const daysLateValues: number[] = []
      for (const [invoiceId, paymentDate] of latestPaymentByInvoice.entries()) {
        const dueDate = dueDateById.get(invoiceId)
        if (!dueDate) continue
        daysLateValues.push(Math.max(0, Math.floor((paymentDate.getTime() - dueDate.getTime()) / 86400000)))
      }
      if (daysLateValues.length > 0) avgDaysLate = daysLateValues.reduce((s, d) => s + d, 0) / daysLateValues.length
    }

    let riskTier: CreditRiskAssessment['riskTier']
    if (paidInvoiceIds.length === 0 && currentOverdueCount === 0) {
      riskTier = 'UNRATED'
    } else if (maxOverdueDays > 30 || avgDaysLate > 20) {
      riskTier = 'HIGH'
    } else if (currentOverdueCount > 0 || avgDaysLate > 5) {
      riskTier = 'MEDIUM'
    } else {
      riskTier = 'LOW'
    }

    const round1 = (n: number) => Math.round(n * 10) / 10
    const riskMultiplier = RISK_MULTIPLIER[riskTier]
    const baseCreditLimit = customer.creditLimit
    return {
      success: true,
      data: {
        customerId, riskTier, avgDaysLate: round1(avgDaysLate), currentOverdueCount, maxOverdueDays,
        baseCreditLimit, riskMultiplier, effectiveCreditLimit: round1(baseCreditLimit * riskMultiplier),
      },
    }
  } catch (e) {
    return { success: false, error: { code: 'CRISK-002', message: e instanceof Error ? e.message : 'Could not compute credit risk.' } }
  }
}

// Portfolio-wide view for the AI assistant ("which retailers are high
// risk?") — every customer WITH a credit limit set (creditLimit === 0 means
// no credit extended, so risk-scoring it is meaningless), scored the same
// way as the single-customer lookup above.
export interface CreditRiskOverview {
  ratedCount: number
  tierCounts: Record<'LOW' | 'MEDIUM' | 'HIGH' | 'UNRATED', number>
  highRiskCustomers: Array<{ customerId: string; customerName: string; avgDaysLate: number; currentOverdueCount: number }>
}

export async function getCreditRiskOverview(): Promise<{ success: boolean; data?: CreditRiskOverview; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const customers = await db.customer.findMany({ where: { isActive: true, creditLimit: { gt: 0 } }, select: { id: true, customerName: true } })
    const tierCounts: CreditRiskOverview['tierCounts'] = { LOW: 0, MEDIUM: 0, HIGH: 0, UNRATED: 0 }
    const highRiskCustomers: CreditRiskOverview['highRiskCustomers'] = []
    for (const c of customers) {
      const res = await getCustomerCreditRisk(c.id)
      if (!res.success || !res.data) continue
      tierCounts[res.data.riskTier]++
      if (res.data.riskTier === 'HIGH') {
        highRiskCustomers.push({ customerId: c.id, customerName: c.customerName, avgDaysLate: res.data.avgDaysLate, currentOverdueCount: res.data.currentOverdueCount })
      }
    }
    highRiskCustomers.sort((a, b) => b.avgDaysLate - a.avgDaysLate)
    return { success: true, data: { ratedCount: customers.length, tierCounts, highRiskCustomers } }
  } catch (e) {
    return { success: false, error: { code: 'CRISK-003', message: e instanceof Error ? e.message : 'Could not compute credit risk overview.' } }
  }
}
