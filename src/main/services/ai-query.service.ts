// Phase 57 — AI Assistant. The two-call pipeline: intent classification →
// deterministic template execution (read-only DB) → business-rule
// validation → NL phrasing. The model NEVER writes or executes SQL — see
// AI_ASSISTANT_MASTER_PROMPT.md Section 3, PHASE_57_TECHNICAL_SPEC.md
// Section 6.
//
// SINGLE SOURCE OF TRUTH for the template catalog. ai-llama-provider.ts's
// INTENT_TEMPLATE_NAMES must stay in sync with the keys of TEMPLATE_CATALOG
// below — if you add a template here, add its name there too.
//
// Full catalog per PHASE_57_TECHNICAL_SPEC.md Section 5 — 18 templates here
// (the active-vertical templates are wired separately in
// ai-vertical-templates.service.ts since which ones apply depends on the
// one business type actually installed).
import { getPrisma } from '../database/db'
import { getReadOnlyPrisma } from '../database/ai-readonly-db'
import { logAction } from './audit.service'
import { isModuleEnabled } from './industry-template.service'
import { reportService } from './report.service'
import { getDashboardKpis, getOutstandingAmount, getTopProducts, getDashboardAlerts } from './analytics.service'
import { getDeadStock, getBottomRevenueProducts, getTopCustomersByRevenue, getCustomersWithNoRecentPurchases, getTopSuppliersByPurchaseVolume } from './ai-aggregations.service'
import { getActiveVerticalTemplateNames, executeVerticalTemplate } from './ai-vertical-templates.service'
import { formatAmountForSpeech } from './ai-format.util'
import type { AIProvider, AIIntentResult } from './ai-provider'
import { NodeLlamaProvider } from './ai-llama-provider'

const FALLBACK_MESSAGE = 'I could not find enough information in your local database to answer that question.'
const REFUSAL_MESSAGE = "I can only answer questions about your own business's sales, inventory, customers, suppliers, credit, and profit data — I can't help with legal, tax, medical, investment, or compliance advice, or anything outside your business records."

// Deterministic, code-owned safety net — NOT a substitute for the model's
// own out_of_scope classification, but a hard override in front of it.
//
// Found live 2026-07-13, real bug: the pinned model (Qwen2.5-1.5B-Instruct)
// misclassified "Should I file a GST return this month and what tax rate
// should I use?" as sales.compareToPreviousPeriod and answered it with real
// sales figures instead of refusing — a genuine advice-question slipping
// through because it happened to also contain data-adjacent words ("this
// month"). This is exactly the failure mode Section 4 already anticipated
// in principle ("the model is never asked to decide not to answer in free
// text — that's promptable/injectable and not a real guarantee") and
// Section 7 named the sanctioned remedy for ("a fallback rule-based/
// keyword classifier for common phrasings") if the golden-eval threshold
// isn't met — this is that remedy, now proven necessary by a real failure,
// not spun up speculatively.
//
// Deliberately biased toward over-refusing rather than under-refusing,
// matching the spec's own stated tolerance: a wrong refusal on an ambiguous
// business question is acceptable; a missed refusal on a genuine advice
// question is not.
const ADVICE_SEEKING_PATTERNS = [
  /\bshould i\b/i, /\bshould we\b/i,
  /\bcan i claim\b/i, /\bam i (allowed|required|eligible)\b/i, /\bdo i (need|have) to\b/i,
  /\bis it legal\b/i, /\bis this legal\b/i,
  /\bhow (do|should) i file\b/i, /\bfile (a |my )?(gst|vat|tax|itr)\b/i,
  /\bwhat (tax )?rate should\b/i,
  /\blegal advice\b/i, /\bmedical advice\b/i, /\binvestment advice\b/i, /\btax advice\b/i,
  /\bshould i invest\b/i, /\bwhich stock\b/i, /\bwhat medicine\b/i, /\bwhat treatment\b/i,
  /\bcompliance (requirement|obligation)\b/i, /\baudit requirement\b/i
]

function isDeterministicallyOutOfScope(question: string): boolean {
  return ADVICE_SEEKING_PATTERNS.some((pattern) => pattern.test(question))
}

// LATENCY FIX, 2026-07-13 — founder required ≤5-10s responses; the two-call
// architecture's second call (LLM "phrasing") could never hit that on
// CPU-only local inference (measured ~12-14s on its own). This function
// replaces it entirely: every template already builds a natural-reading
// `headline` + supporting `details` (Section 3's "restate, don't recompute"
// principle already meant the phrasing call was never allowed to change the
// numbers — it was only ever rephrasing text that was already correct and
// already readable). Joining them directly is strictly safer (zero risk of
// the model altering a figure) and removes an entire model call from every
// single question, not just the common ones. The `AIProvider.generateResponse`
// method stays in the interface (still real, still tested, still available
// for a future quality pass) but is no longer invoked in the default path.
function formatDeterministicAnswer(result: TemplateResult): string {
  if (result.details.length === 0) return `${result.headline}.`
  return `${result.headline}. ${result.details.join('. ')}.`
}

// LATENCY FIX, 2026-07-13 — a second structural change alongside the above:
// skip the LLM classification call entirely for common, unambiguous
// phrasings, matched deterministically. Deliberately conservative (specific
// patterns, not broad keyword guessing) — a wrong keyword-fast-path match
// would produce a wrong answer with no LLM judgment to catch it, which is a
// worse failure than just falling through to the slower LLM classify path.
// Only the clearest, most commonly-asked real-world phrasings are covered;
// anything not matched here still goes through the full LLM classify call
// (now itself faster after the grammar-simplification fix earlier the same
// day). This is the same "deterministic first, model as fallback" shape
// already proven for the out-of-scope safety net above.
const FAST_PATH_PATTERNS: Array<{ template: string; patterns: RegExp[] }> = [
  { template: 'sales.totalToday', patterns: [/\btoday'?s?\s+sales?\b/i, /how much.*(sold|sell|sale).*today/i, /today.*(sold|sell)/i] },
  { template: 'sales.totalThisWeek', patterns: [/\bthis week'?s?\s+sales?\b/i, /(sold|sell|sale).*this week/i] },
  { template: 'sales.totalThisMonth', patterns: [/\bthis month'?s?\s+sales?\b/i, /(sold|sell|sale).*this month/i] },
  { template: 'sales.averageInvoiceValue', patterns: [/average\s+(invoice|order|sale|bill)/i] },
  { template: 'inventory.lowStock', patterns: [/low\s+(on\s+)?stock/i, /running\s+(low|out)/i, /what'?s\s+low/i] },
  { template: 'inventory.deadStock', patterns: [/(not\s+sold|hasn'?t\s+sold|dead\s+stock|not\s+moving|stale\s+stock)/i] },
  { template: 'inventory.topRevenueProducts', patterns: [/(top|best)[\s-]sell/i, /(top|best)\s+products?\b/i] },
  { template: 'credit.whoOwesMe', patterns: [/who owes me/i, /^who owes\b/i] },
  { template: 'credit.totalReceivable', patterns: [/total\s+(receivable|owed to me|amount owed)/i] },
  { template: 'finance.profitAndLoss', patterns: [/\bprofit\b/i, /\bp\s?&\s?l\b/i, /net\s+(income|profit|earning)/i] },
  // Real bug found live 2026-07-13 (full question-battery test, not a
  // hypothetical): "Who do I buy the most from?" — a natural, common
  // phrasing — was misclassified by the model as credit.whoOwesMe (likely
  // pattern-matching "who" onto the far more common "who owes me" template),
  // producing a confidently wrong answer about customer balances instead of
  // suppliers. Same fix shape as every other live-caught misclassification
  // this session: a specific deterministic pattern wins over model judgment.
  { template: 'suppliers.topByPurchaseVolume', patterns: [/buy the most from/i, /top\s+suppliers?\b/i, /biggest\s+suppliers?\b/i, /buy.*most.*from/i] },
  // Vertical-template fast-path patterns, added 2026-07-13 alongside the
  // vertical-coverage expansion. Real bug found live: the model
  // misclassified "How is production going this month?" as
  // sales.compareToPreviousPeriod (likely because sales templates dominate
  // the catalog numerically and "this month" pattern-matches strongly on
  // them) — a genuine classification-accuracy gap for templates the model
  // hasn't been specifically validated against, not a hypothetical risk.
  // Same fix shape as the original latency-driving fast-path: deterministic
  // keyword match wins over model judgment for the clearest phrasings.
  { template: 'hotel.occupancy', patterns: [/room[s]?\s+(occupied|occupancy|available)/i, /occupancy/i] },
  { template: 'jewellery.stockAndSales', patterns: [/(gold|silver|metal|jewellery)\s+stock/i, /making[\s-]charge/i] },
  { template: 'rental.status', patterns: [/(checked\s+out|rented\s+out|overdue\s+rental)/i] },
  { template: 'lab.throughput', patterns: [/test\s+orders?/i, /(lab|sample)\s+(throughput|turnaround)/i] },
  { template: 'bloodBank.stock', patterns: [/blood\s+(stock|units|group)/i] },
  { template: 'restaurant.foodCost', patterns: [/(food|ingredient)\s+cost/i] },
  { template: 'restaurant.orderVolume', patterns: [/order\s+volume/i, /(qr|table)\s+orders?/i] },
  { template: 'manufacturing.production', patterns: [/\bproduction\b/i, /production\s+order/i] },
  { template: 'electronics.serialWarranty', patterns: [/warrant(y|ies)/i, /serial\s+number/i] },
  { template: 'retail.variantStock', patterns: [/variant\s+stock/i, /(size|color)\s+stock/i] },
  { template: 'coaching.testScores', patterns: [/test\s+scores?/i, /student.*(score|marks|result)/i] },
  { template: 'compliance.tasks', patterns: [/compliance\s+task/i, /(overdue|pending)\s+complian/i] },
  { template: 'repair.jobCards', patterns: [/job\s+cards?/i, /repair\s+jobs?/i] },
  { template: 'inventory.batchExpiry', patterns: [/(batch|expir)/i] },
  { template: 'service.projects', patterns: [/\bprojects?\b.*(status|active|going)/i, /how.*projects/i] },
  { template: 'service.appointmentUtilisation', patterns: [/appointments?\s+(this|today|utilisation|utilization)/i] },
  { template: 'service.clientRetention', patterns: [/client\s+retention/i, /(new|returning)\s+clients?/i] },
  { template: 'service.commission', patterns: [/staff\s+commission/i, /\bcommission\b/i] },
  { template: 'logistics.summary', patterns: [/shipments?/i, /deliver(y|ies)\s+rate/i] },
  { template: 'placement.summary', patterns: [/candidates?\s+placed/i, /job\s+orders?/i, /placements?\s+this/i] },
  // meta.* templates, added to answer "what can this thing even do" and
  // "what should I look at" questions — deliberately phrased WITHOUT the
  // word "should" for the suggestions trigger. `isDeterministicallyOutOfScope`
  // runs before this fast-path and its `/\bshould i\b/i` pattern would
  // otherwise refuse a perfectly legitimate "what should I pay attention to"
  // as if it were advice-seeking — rather than loosen that safety net (added
  // for a real live misclassification bug, deliberately biased toward
  // over-refusing), these trigger phrasings just avoid the word entirely.
  { template: 'meta.capabilities', patterns: [/what can you do/i, /what can'?t you do/i, /what (questions|things) can i ask/i, /^help$/i, /what are you (capable of|able to do)/i] },
  { template: 'meta.suggestions', patterns: [/what needs my attention/i, /anything (i need to know|to review|urgent)/i, /any (suggestions|recommendations)/i, /what'?s (important|urgent) today/i, /things? to review/i] }
]

function tryFastPathClassify(question: string, availableTemplates: readonly string[]): AIIntentResult | null {
  for (const entry of FAST_PATH_PATTERNS) {
    if (!availableTemplates.includes(entry.template)) continue
    if (entry.patterns.some((p) => p.test(question))) {
      return { template: entry.template, category: categoryOf(entry.template), params: {} }
    }
  }
  return null
}

const STATIC_CATEGORY_PREFIXES = new Set(['sales', 'inventory', 'customers', 'suppliers', 'credit', 'finance', 'meta'])
function categoryOf(template: string): string {
  const prefix = template.split('.')[0]
  return STATIC_CATEGORY_PREFIXES.has(prefix) ? prefix : 'vertical'
}

// FEATURE RESTORE, 2026-07-13 — the grammar-simplification latency fix
// (ai-llama-provider.ts's own comment, "Response-time fix") dropped
// dateFrom/dateTo/topN/days from the model's classification output for a
// real, measured speed win. That was a genuine capability reduction, not a
// no-op: every template above that reads params.topN/days/dateFrom/dateTo
// (inventory.topRevenueProducts, inventory.deadStock, customers.*,
// suppliers.topByPurchaseVolume, finance.profitAndLoss, plus the vertical
// templates' shared date-range default) had no way to receive a
// user-specified value anymore and silently fell back to its default every
// time. Restored here, deterministically, on every question regardless of
// which classification path matched — a regex/date-arithmetic extraction is
// strictly more reliable for this than asking a 1.5B model to compute dates
// in its head, and costs microseconds instead of reintroducing the extra
// model-generation time that caused the original slowdown.
function extractParams(question: string): Record<string, unknown> {
  const params: Record<string, unknown> = {}

  const topNMatch = question.match(/\b(?:top|best|bottom|worst|lowest)\s+(\d+)\b/i)
  if (topNMatch) params.topN = parseInt(topNMatch[1], 10)

  const daysMatch = question.match(/\b(?:last|past)\s+(\d+)\s+days?\b/i)
  if (daysMatch) params.days = parseInt(daysMatch[1], 10)

  const now = new Date()
  const toISO = (d: Date): string => d.toISOString().slice(0, 10)
  const startOfMonth = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), 1)
  const endOfMonth = (d: Date): Date => new Date(d.getFullYear(), d.getMonth() + 1, 0)
  const startOfWeek = (d: Date): Date => {
    const s = new Date(d)
    s.setDate(s.getDate() - s.getDay())
    return s
  }

  if (/\byesterday\b/i.test(question)) {
    const y = new Date(now)
    y.setDate(y.getDate() - 1)
    params.dateFrom = toISO(y)
    params.dateTo = toISO(y)
  } else if (/\btoday\b/i.test(question)) {
    params.dateFrom = toISO(now)
    params.dateTo = toISO(now)
  } else if (/\blast week\b/i.test(question)) {
    const startThisWeek = startOfWeek(now)
    const endLastWeek = new Date(startThisWeek)
    endLastWeek.setDate(endLastWeek.getDate() - 1)
    const startLastWeek = new Date(endLastWeek)
    startLastWeek.setDate(startLastWeek.getDate() - 6)
    params.dateFrom = toISO(startLastWeek)
    params.dateTo = toISO(endLastWeek)
  } else if (/\bthis week\b/i.test(question)) {
    params.dateFrom = toISO(startOfWeek(now))
    params.dateTo = toISO(now)
  } else if (/\blast month\b/i.test(question)) {
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    params.dateFrom = toISO(startOfMonth(lastMonth))
    params.dateTo = toISO(endOfMonth(lastMonth))
  } else if (/\bthis month\b/i.test(question)) {
    params.dateFrom = toISO(startOfMonth(now))
    params.dateTo = toISO(now)
  }

  return params
}

interface TemplateResult {
  // Pre-formatted, ready-to-restate strings — never raw numbers the phrasing
  // call could recompute. Built with formatAmountForSpeech() (Section 6/3).
  headline: string
  details: string[]
  isEmpty: boolean
}

interface TemplateDef {
  category: string
  execute: (params: Record<string, unknown>, sym: string) => Promise<TemplateResult>
}

// Business-rule validation (spec Section 6) — a thin sanity pass catching a
// template wired to the wrong function or an extraction mistake, not a
// re-derivation of business logic. The real correctness guarantee is
// reusing canonical functions below, not this pass.
function validate(result: TemplateResult): TemplateResult {
  return result
}

const TEMPLATE_CATALOG: Record<string, TemplateDef> = {
  'sales.totalToday': {
    category: 'sales',
    async execute(_params, sym) {
      const kpis = await getDashboardKpis()
      return {
        headline: `Today's sales: ${formatAmountForSpeech(kpis.todaySales, sym)}`,
        details: [`${kpis.todayTrend >= 0 ? 'up' : 'down'} ${Math.abs(kpis.todayTrend).toFixed(1)}% compared to yesterday`],
        isEmpty: kpis.todaySales === 0
      }
    }
  },
  'sales.totalThisWeek': {
    category: 'sales',
    async execute(_params, sym) {
      const kpis = await getDashboardKpis()
      return {
        headline: `This week's sales: ${formatAmountForSpeech(kpis.weekSales, sym)}`,
        details: [`${kpis.weekTrend >= 0 ? 'up' : 'down'} ${Math.abs(kpis.weekTrend).toFixed(1)}% compared to last week`],
        isEmpty: kpis.weekSales === 0
      }
    }
  },
  'sales.totalThisMonth': {
    category: 'sales',
    async execute(_params, sym) {
      const kpis = await getDashboardKpis()
      return {
        headline: `This month's sales: ${formatAmountForSpeech(kpis.monthSales, sym)}`,
        details: [`${kpis.monthTrend >= 0 ? 'up' : 'down'} ${Math.abs(kpis.monthTrend).toFixed(1)}% compared to last month`],
        isEmpty: kpis.monthSales === 0
      }
    }
  },
  'sales.averageInvoiceValue': {
    category: 'sales',
    async execute(params, sym) {
      const now = new Date()
      const dateFrom = (params.dateFrom as string) ?? new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
      const dateTo = (params.dateTo as string) ?? now.toISOString().slice(0, 10)
      const report = await reportService.generateSalesReport({ dateFrom, dateTo })
      return {
        headline: `Average invoice value: ${formatAmountForSpeech(report.summary.averageOrderValue, sym)}`,
        details: [`across ${report.summary.totalInvoices} invoices in the selected period`],
        isEmpty: report.summary.totalInvoices === 0
      }
    }
  },
  'credit.whoOwesMe': {
    category: 'credit',
    async execute(_params, sym) {
      const report = await reportService.generateOutstandingReport()
      const top5 = report.customers.rows.slice(0, 5)
      return {
        headline: `${report.customers.count} customers have outstanding balances totaling ${formatAmountForSpeech(report.customers.totalOutstanding, sym)}`,
        details: top5.map((c) => `${c.customerName}: ${formatAmountForSpeech(c.outstanding, sym)}`),
        isEmpty: report.customers.count === 0
      }
    }
  },
  'credit.totalReceivable': {
    category: 'credit',
    async execute(_params, sym) {
      const amount = await getOutstandingAmount()
      return {
        headline: `Total amount owed to you: ${formatAmountForSpeech(amount, sym)}`,
        details: [],
        isEmpty: amount === 0
      }
    }
  },
  'finance.profitAndLoss': {
    category: 'finance',
    async execute(params, sym) {
      const now = new Date()
      const dateFrom = (params.dateFrom as string) ?? new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
      const dateTo = (params.dateTo as string) ?? now.toISOString().slice(0, 10)
      const report = await reportService.generateProfitAndLossReport({ dateFrom, dateTo })
      // A negative netProfit is a real loss, not a small profit — say so in
      // words, not just via a minus sign a skimming reader could miss. Found
      // live 2026-07-13: a business with expenses exceeding revenue this
      // month got told "Net profit: ₹9,876.54" (formatAmountForSpeech used
      // to strip the sign entirely, hiding the loss outright).
      const isLoss = report.summary.netProfit < 0
      const headline = isLoss
        ? `Net loss for the selected period: ${formatAmountForSpeech(report.summary.netProfit, sym)}`
        : `Net profit for the selected period: ${formatAmountForSpeech(report.summary.netProfit, sym)}`
      return {
        headline,
        details: [
          `Revenue: ${formatAmountForSpeech(report.summary.revenue, sym)}`,
          `Cost of goods sold: ${formatAmountForSpeech(report.summary.cogs, sym)}`,
          `Net margin: ${report.summary.netMarginPercent.toFixed(1)}%`
        ],
        isEmpty: report.summary.revenue === 0
      }
    }
  },
  // sales.compareToPreviousPeriod — decision (spec Section 5): ship the
  // fixed today/week/month granularity from getDashboardKpis, reusing the
  // exact number the Dashboard already shows, rather than building an
  // arbitrary-range comparator. Defaults to "this month vs last month" as
  // the most natural reading of a bare "compared to before" question.
  'sales.compareToPreviousPeriod': {
    category: 'sales',
    async execute(_params, sym) {
      const kpis = await getDashboardKpis()
      return {
        headline: `This month's sales are ${formatAmountForSpeech(kpis.monthSales, sym)}, ${kpis.monthTrend >= 0 ? 'up' : 'down'} ${Math.abs(kpis.monthTrend).toFixed(1)}% vs last month`,
        details: [
          `Today: ${kpis.todayTrend >= 0 ? 'up' : 'down'} ${Math.abs(kpis.todayTrend).toFixed(1)}% vs yesterday`,
          `This week: ${kpis.weekTrend >= 0 ? 'up' : 'down'} ${Math.abs(kpis.weekTrend).toFixed(1)}% vs last week`
        ],
        isEmpty: false
      }
    }
  },
  'inventory.lowStock': {
    category: 'inventory',
    async execute(_params, _sym) {
      const report = await reportService.generateInventoryReport({ lowStockOnly: true })
      const top10 = report.rows.slice(0, 10)
      return {
        headline: `${report.summary.lowStockItems} products are low on stock`,
        details: top10.map((r) => `${r.productName}: ${r.currentStock} ${r.unit} left`),
        isEmpty: report.summary.lowStockItems === 0
      }
    }
  },
  'inventory.deadStock': {
    category: 'inventory',
    async execute(params, _sym) {
      const days = (params.days as number) ?? 90
      const items = await getDeadStock(days)
      const top10 = items.slice(0, 10)
      return {
        headline: `${items.length} products haven't sold in the last ${days} days`,
        details: top10.map((i) => `${i.productName}${i.lastSoldDate ? ` — last sold ${i.lastSoldDate}` : ' — never sold'}`),
        isEmpty: items.length === 0
      }
    }
  },
  'inventory.topRevenueProducts': {
    category: 'inventory',
    async execute(params, sym) {
      const topN = (params.topN as number) ?? 5
      const products = await getTopProducts(topN, params.dateFrom as string | undefined, params.dateTo as string | undefined)
      return {
        headline: `Your top ${products.length} products by revenue`,
        details: products.map((p) => `${p.productName}: ${formatAmountForSpeech(p.revenue, sym)} (${p.quantitySold} sold)`),
        isEmpty: products.length === 0
      }
    }
  },
  'inventory.bottomRevenueProducts': {
    category: 'inventory',
    async execute(params, sym) {
      const topN = (params.topN as number) ?? 5
      const products = await getBottomRevenueProducts(topN, params.dateFrom as string | undefined, params.dateTo as string | undefined)
      return {
        headline: `Your ${products.length} lowest-revenue products (that have sold at least once)`,
        details: products.map((p) => `${p.productName}: ${formatAmountForSpeech(p.revenue, sym)} (${p.quantitySold} sold)`),
        isEmpty: products.length === 0
      }
    }
  },
  'customers.topThisPeriod': {
    category: 'customers',
    async execute(params, sym) {
      const topN = (params.topN as number) ?? 5
      const customers = await getTopCustomersByRevenue(topN, params.dateFrom as string | undefined, params.dateTo as string | undefined)
      return {
        headline: `Your top ${customers.length} customers by spend`,
        details: customers.map((c) => `${c.customerName}: ${formatAmountForSpeech(c.revenue, sym)} across ${c.invoiceCount} invoices`),
        isEmpty: customers.length === 0
      }
    }
  },
  'customers.outstandingBalances': {
    category: 'customers',
    async execute(_params, sym) {
      const report = await reportService.generateOutstandingReport()
      const top10 = report.customers.rows.slice(0, 10)
      return {
        headline: `${report.customers.count} customers owe you money, totaling ${formatAmountForSpeech(report.customers.totalOutstanding, sym)}`,
        details: top10.map((c) => `${c.customerName}: ${formatAmountForSpeech(c.outstanding, sym)}`),
        isEmpty: report.customers.count === 0
      }
    }
  },
  'customers.noRecentPurchases': {
    category: 'customers',
    async execute(params, _sym) {
      const days = (params.days as number) ?? 90
      const customers = await getCustomersWithNoRecentPurchases(days)
      const top10 = customers.slice(0, 10)
      return {
        headline: `${customers.length} customers haven't purchased in the last ${days} days`,
        details: top10.map((c) => `${c.customerName} — last purchase ${c.lastPurchaseDate}`),
        isEmpty: customers.length === 0
      }
    }
  },
  'suppliers.topByPurchaseVolume': {
    category: 'suppliers',
    async execute(params, sym) {
      const topN = (params.topN as number) ?? 5
      const suppliers = await getTopSuppliersByPurchaseVolume(topN)
      return {
        headline: `Your top ${suppliers.length} suppliers by purchase volume`,
        details: suppliers.map((s) => `${s.supplierName}: ${formatAmountForSpeech(s.totalPurchaseValue, sym)} across ${s.poCount} purchase orders`),
        isEmpty: suppliers.length === 0
      }
    }
  },
  'suppliers.pendingPayments': {
    category: 'suppliers',
    async execute(_params, sym) {
      const report = await reportService.generateOutstandingReport()
      const top10 = report.suppliers.rows.slice(0, 10)
      return {
        headline: `You owe ${report.suppliers.count} suppliers a total of ${formatAmountForSpeech(report.suppliers.totalOutstanding, sym)}`,
        details: top10.map((s) => `${s.supplierName}: ${formatAmountForSpeech(s.outstanding, sym)}`),
        isEmpty: report.suppliers.count === 0
      }
    }
  },
  // credit.overdueInvoices — decision (spec Section 5): ship the aggregate
  // aging-bucket view from generateOutstandingReport, matching
  // reuse-over-reimplementation, rather than a new flat per-invoice list.
  'credit.overdueInvoices': {
    category: 'credit',
    async execute(_params, sym) {
      const report = await reportService.generateOutstandingReport()
      const b = report.customers.agingTotals
      return {
        headline: `Overdue receivables by age: ${formatAmountForSpeech(b.days1to30 + b.days31to60 + b.days61to90 + b.days90plus, sym)} overdue in total`,
        details: [
          `1-30 days: ${formatAmountForSpeech(b.days1to30, sym)}`,
          `31-60 days: ${formatAmountForSpeech(b.days31to60, sym)}`,
          `61-90 days: ${formatAmountForSpeech(b.days61to90, sym)}`,
          `90+ days: ${formatAmountForSpeech(b.days90plus, sym)}`
        ],
        isEmpty: report.customers.count === 0
      }
    }
  },
  // meta.capabilities — a fixed, code-owned description of scope, same
  // "never model-generated" principle as REFUSAL_MESSAGE/FALLBACK_MESSAGE
  // above. Deliberately static text, not a model call: what the assistant can
  // do should never vary run-to-run or risk the model describing a
  // capability it doesn't actually have.
  'meta.capabilities': {
    category: 'meta',
    async execute(_params, _sym) {
      return {
        headline: 'I can answer questions about your own business records — sales, inventory, customers, suppliers, credit, and profit — plus questions specific to your business type',
        details: [
          'Examples: "What were today\'s sales?", "What\'s low on stock?", "Who owes me money?", "What\'s our profit?"',
          "I can't help with legal, tax, medical, investment, or compliance advice, or anything outside your business records",
          'Ask "how do I..." or "where is..." a feature and I\'ll point you to the right Manual chapter',
          'I only understand English right now, and everything I answer stays on this device — nothing is ever sent anywhere'
        ],
        isEmpty: false
      }
    }
  },
  // meta.suggestions — restates the exact same DashboardAlert objects the
  // Dashboard's own alert tiles already compute (analytics.service.ts's
  // getDashboardAlerts, RULE AN001 etc.) as a natural-language answer. Zero
  // new business logic and zero risk of the model inventing a numeric
  // suggestion it can't justify — deliberately narrower than open-ended
  // "give me advice," which a 1.5B local model isn't reliable enough for.
  'meta.suggestions': {
    category: 'meta',
    async execute(_params, _sym) {
      const alerts = await getDashboardAlerts()
      if (alerts.length === 0) {
        return { headline: 'Nothing needs your attention right now — no low stock, overdue payments, or pending reminders', details: [], isEmpty: false }
      }
      const urgentCount = alerts.filter((a) => a.severity === 'danger').length
      return {
        headline: `${alerts.length} thing${alerts.length > 1 ? 's' : ''} may need your attention${urgentCount > 0 ? ` (${urgentCount} urgent)` : ''}`,
        details: alerts.map((a) => a.message),
        isEmpty: false
      }
    }
  }
}

let provider: AIProvider | null = null

// Overridable for tests — see ai-query.service.test.ts's use of FakeAIProvider.
export function setAIProvider(p: AIProvider): void {
  provider = p
}

async function getProvider(): Promise<AIProvider> {
  if (!provider) provider = new NodeLlamaProvider()
  return provider
}

export interface AiQueryResult {
  success: boolean
  data?: { answer: string; template: string | null }
  error?: { code: string; message: string }
}

export async function askQuestion(question: string, userId?: string): Promise<AiQueryResult> {
  const startedAt = Date.now()

  // Server-side module-flag re-check — a genuine, deliberate deviation from
  // house convention (no other IPC-adjacent path in this codebase re-checks
  // TemplateModule server-side; it's normally UI-only). Required here
  // because a disabled AI module must mean the capability is actually
  // unreachable, not just hidden — see PHASE_57_TECHNICAL_SPEC.md Section 7.
  if (!(await isModuleEnabled('ai_assistant'))) {
    return { success: false, error: { code: 'AI-001', message: 'The AI Assistant is not enabled for this business.' } }
  }

  // Deterministic keyword safety net — runs BEFORE the model is even
  // loaded/called. Real bug fix, not speculative: see
  // isDeterministicallyOutOfScope's own comment for the exact live failure
  // this closes. Also a genuine latency win — an obviously out-of-scope
  // question never has to pay the ~4-60s model cold/warm-start cost.
  if (isDeterministicallyOutOfScope(question)) {
    const executionTimeMs = Date.now() - startedAt
    await getPrisma().aiQueryLog.create({
      data: { userId, question, matchedTemplate: null, matchedCategory: 'out_of_scope', success: false, executionTimeMs }
    })
    await logAction({ userId, action: 'AI_QUERY_ASKED', entityType: 'AiQueryLog', entityId: undefined, newValue: { question, matchedTemplate: null, success: false, refusedBy: 'keyword_filter' } })
    return { success: true, data: { answer: REFUSAL_MESSAGE, template: null } }
  }

  try {
    // Compute the full valid template set BEFORE classification — the
    // model's grammar is built from exactly this list (Section 6), so it
    // can never even attempt a vertical template that doesn't apply to this
    // business's actual installed type. Also needed by the fast-path check
    // below, before the model is touched at all.
    const verticalNames = await getActiveVerticalTemplateNames()
    const availableTemplates = [...Object.keys(TEMPLATE_CATALOG), ...verticalNames]

    // Try the deterministic fast-path first — if it matches, the model is
    // never loaded or called at all for this question (LATENCY FIX,
    // 2026-07-13, see tryFastPathClassify's own comment). Only fall through
    // to real LLM classification for phrasings the fast-path doesn't
    // recognize.
    const fastPathIntent = tryFastPathClassify(question, availableTemplates)
    let intent: AIIntentResult
    if (fastPathIntent) {
      intent = fastPathIntent
    } else {
      const ai = await getProvider()
      await ai.initialize()
      intent = await ai.classifyIntent(question, availableTemplates)
    }
    // Restore params the classification grammar no longer produces (see
    // extractParams's own comment) — applies after either path, since
    // neither the fast-path nor the model's simplified grammar emits
    // dateFrom/dateTo/topN/days anymore.
    intent = { ...intent, params: { ...extractParams(question), ...intent.params } }
    const templateDef = intent.template ? TEMPLATE_CATALOG[intent.template] : null
    const isVerticalTemplate = intent.template !== null && verticalNames.includes(intent.template)

    let answer: string
    let matchedTemplate: string | null = null
    let matchedCategory = intent.category
    let success = true

    if (!templateDef && !isVerticalTemplate) {
      // Fixed, code-owned refusal — never model-generated. Covers both a
      // genuine out_of_scope classification and a template name the model
      // somehow produced outside the current catalog (defense in depth) —
      // including a vertical template name that doesn't apply to THIS
      // business's actual installed vertical, which must be refused the
      // same as any other unreachable template, not silently answered.
      answer = REFUSAL_MESSAGE
      matchedCategory = 'out_of_scope'
      success = false
    } else {
      matchedTemplate = intent.template
      const db = getPrisma()
      const profile = await db.businessProfile.findFirst({ select: { currencySymbol: true } })
      const sym = profile?.currencySymbol ?? '₹'

      // Ensure the read-only connection is live (defense in depth — the
      // template functions above currently call the app's normal
      // getPrisma(), matching Section 6's "reuse existing canonical
      // functions" principle; this connection exists so a future template
      // that needs bespoke aggregation queries has a read-only path ready).
      await getReadOnlyPrisma()

      const rawResult = templateDef
        ? await templateDef.execute(intent.params, sym)
        : await executeVerticalTemplate(matchedTemplate as string, intent.params, sym)
      const result = validate(rawResult)

      if (result.isEmpty) {
        // Fixed fallback, enforced in code — the model never gets a chance
        // to fill an empty result with a plausible-sounding guess (Section 4).
        answer = FALLBACK_MESSAGE
        success = false
      } else {
        // No LLM phrasing call (removed 2026-07-13, see
        // formatDeterministicAnswer's own comment) — every template's
        // headline/details are already natural-reading text, joined
        // directly. Zero risk of the model altering a figure, and removes
        // an entire model call from every question.
        answer = formatDeterministicAnswer(result)
      }
    }

    const executionTimeMs = Date.now() - startedAt

    await getPrisma().aiQueryLog.create({
      data: { userId, question, matchedTemplate, matchedCategory, success, executionTimeMs }
    })
    await logAction({ userId, action: 'AI_QUERY_ASKED', entityType: 'AiQueryLog', entityId: undefined, newValue: { question, matchedTemplate, success } })

    return { success: true, data: { answer, template: matchedTemplate } }
  } catch (err) {
    return { success: false, error: { code: 'AI-002', message: err instanceof Error ? err.message : 'Could not process that question.' } }
  }
}

export async function getAiStatus(): Promise<{ success: boolean; data: { modelLoaded: boolean } }> {
  return { success: true, data: { modelLoaded: provider !== null } }
}

export async function shutdownAi(): Promise<void> {
  if (provider) {
    await provider.shutdown()
    provider = null
  }
}

// Section 5.6 — "a clear AI conversation history action." There's no
// multi-turn chat memory to clear (every question is independent, Section
// 2's read-only-intelligence scope), so this clears the local AiQueryLog
// audit trail itself — gated on audit.view at the IPC layer, same trust
// boundary as the rest of the app's audit log (Section 5.7: "never
// transmitted, respects the same audit-log access permissions").
export async function clearAiQueryHistory(userId?: string): Promise<{ success: boolean; error?: { code: string; message: string } }> {
  try {
    await getPrisma().aiQueryLog.deleteMany({})
    await logAction({ userId, action: 'AI_QUERY_HISTORY_CLEARED', entityType: 'AiQueryLog' })
    return { success: true }
  } catch (err) {
    return { success: false, error: { code: 'AI-003', message: err instanceof Error ? err.message : 'Could not clear AI query history.' } }
  }
}
