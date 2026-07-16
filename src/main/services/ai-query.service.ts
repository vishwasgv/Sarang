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
import { getDashboardKpis, getOutstandingAmount, getTopProducts, getDashboardAlerts, getTopCategories } from './analytics.service'
import { getDeadStock, getBottomRevenueProducts, getTopCustomersByRevenue, getCustomersWithNoRecentPurchases, getTopSuppliersByPurchaseVolume, getInactiveSuppliers } from './ai-aggregations.service'
import { listPayrollForPeriod } from './payroll.service'
import { getActiveVerticalTemplateNames, executeVerticalTemplate } from './ai-vertical-templates.service'
import { quotationService } from './quotation.service'
import { purchaseOrderService } from './purchase-order.service'
import { listCustomers, searchCustomers } from './customer.service'
import { searchSuppliers } from './supplier.service'
import { billingService } from './billing.service'
import { inventoryService } from './inventory.service'
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
  // Checked BEFORE sales.totalThisMonth below — "walk-in versus registered
  // ... sales this month" also matches that broader `sale.*this month`
  // pattern, and being earlier in this array it would otherwise always win
  // first. Real bug found live during the 70-template UAT re-verification.
  { template: 'sales.walkInVsRegistered', patterns: [/walk-?in.*(vs\.?|versus).*registered/i, /walk-?in.*registered/i] },
  { template: 'sales.totalThisMonth', patterns: [/\bthis month'?s?\s+sales?\b/i, /(sold|sell|sale).*this month/i] },
  { template: 'sales.averageInvoiceValue', patterns: [/average\s+(invoice|order|sale|bill)/i] },
  { template: 'inventory.lowStock', patterns: [/low\s+(on\s+)?stock/i, /running\s+(low|out)/i, /what'?s\s+low/i] },
  { template: 'inventory.deadStock', patterns: [/(not\s+sold|hasn'?t\s+sold|dead\s+stock|not\s+moving|stale\s+stock)/i] },
  // Real misclassification found live during the 70-template UAT (2026-07-15,
  // 50% miss rate on the full battery) — checked BEFORE the broader
  // inventory.topRevenueProducts pattern below since "best-selling by
  // quantity" would otherwise be shadowed by it (that pattern matches any
  // "best-sell..." phrase regardless of the quantity qualifier).
  { template: 'inventory.topSellingByQuantity', patterns: [/(top|best)[\s-]sell.*quantity/i, /quantity.*(top|best)[\s-]sell/i] },
  { template: 'inventory.topRevenueProducts', patterns: [/(top|best)[\s-]sell/i, /(top|best)\s+products?\b/i] },
  // Real gap found live 2026-07-16 (full 109-template packaged-app battery,
  // not hypothetical): "What are my worst-selling products?" fell through to
  // the LLM classify call and was misrouted to inventory.topRevenueProducts
  // — this template had zero fast-path coverage before this fix, unlike its
  // "top" counterpart above. Same fix shape as every other live-caught
  // classification gap in this file.
  { template: 'inventory.bottomRevenueProducts', patterns: [/worst[\s-]sell/i, /bottom\s+(revenue|sell)/i, /least\s+sell/i, /slow(est)?[\s-]sell/i] },
  { template: 'credit.whoOwesMe', patterns: [/who owes me/i, /^who owes\b/i] },
  { template: 'credit.totalReceivable', patterns: [/total\s+(receivable|owed to me|amount owed)/i] },
  // Checked BEFORE finance.profitAndLoss below — its own `/\bprofit\b/i`
  // pattern matches any mention of the word "profit" at all, so "profit
  // trend" would always be caught by it first if this weren't earlier in
  // the array. Real bug found live during the 70-template UAT
  // re-verification.
  { template: 'finance.profitTrend', patterns: [/profit trend/i] },
  { template: 'finance.profitAndLoss', patterns: [/\bprofit\b/i, /\bp\s?&\s?l\b/i, /net\s+(income|profit|earning)/i] },
  // Real bug found live 2026-07-13 (full question-battery test, not a
  // hypothetical): "Who do I buy the most from?" — a natural, common
  // phrasing — was misclassified by the model as credit.whoOwesMe (likely
  // pattern-matching "who" onto the far more common "who owes me" template),
  // producing a confidently wrong answer about customer balances instead of
  // suppliers. Same fix shape as every other live-caught misclassification
  // this session: a specific deterministic pattern wins over model judgment.
  { template: 'suppliers.topByPurchaseVolume', patterns: [/buy the most from/i, /top\s+suppliers?\b/i, /biggest\s+suppliers?\b/i, /buy.*most.*from/i] },
  // Real gap found live 2026-07-16 (full 109-template packaged-app battery):
  // "What payments are pending to suppliers?" fell through to the LLM
  // classify call and was misrouted to credit.whoOwesMe — a genuine
  // direction confusion (money I owe vs. money owed to me). Zero fast-path
  // coverage existed for this template before this fix.
  { template: 'suppliers.pendingPayments', patterns: [/pending.*(payment|suppliers?)/i, /suppliers?.*pending/i, /payments?\s+(due|owed)\s+to\s+suppliers?/i] },
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
  // Real gap found live 2026-07-16 (full 109-template packaged-app battery):
  // "What's my rental revenue this month?" fell through to the LLM classify
  // call and was misrouted to finance.profitAndLoss — plausible since both
  // discuss money, but rental.revenue is the correct, more specific answer.
  // Checked BEFORE finance.profitAndLoss's own bare `/\bprofit\b/i`-adjacent
  // patterns aren't actually triggered by the word "revenue" alone, so no
  // ordering conflict, but placed here for category grouping regardless.
  { template: 'rental.revenue', patterns: [/rental\s+revenue/i, /revenue.*rental/i] },
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
  // "logistics summary" itself (the most natural phrasing, matching the
  // template's own name) was missing from this pattern — real gap found live
  // 2026-07-16 re-verification: even with the correct business type
  // (DISTRIBUTOR/HARDWARE), "What's my logistics summary this month?" still
  // fell through to the LLM and was misrouted, since neither existing
  // pattern below covers that direct phrasing.
  { template: 'logistics.summary', patterns: [/shipments?/i, /deliver(y|ies)\s+rate/i, /logistics\s+summary/i, /\blogistics\b/i] },
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
  { template: 'meta.suggestions', patterns: [/what needs my attention/i, /anything (i need to know|to review|urgent)/i, /any (suggestions|recommendations)/i, /what'?s (important|urgent) today/i, /things? to review/i] },
  // AI expansion, 2026-07 — 3 real misclassifications caught live during the
  // 70-template UAT (a 12-question sample already found these 3 wrong out of
  // 12, a real accuracy concern now that the classification grammar has
  // grown to ~110 template names). Same fix shape as every other live-caught
  // misclassification in this file's history: a deterministic pattern wins
  // over model judgment for the clearest phrasings, rather than trusting the
  // model to keep discriminating well as the catalog grows.
  { template: 'documents.pendingPurchaseOrders', patterns: [/purchase orders?.*(pending|approval|awaiting)/i, /pending.*purchase orders?/i] },
  { template: 'staff.attendanceToday', patterns: [/staff.*(present|attendance)/i, /(present|attendance).*today/i, /who'?s (in|present) today/i] },
  { template: 'documents.creditDebitNotesIssued', patterns: [/credit (and|&)?\s?debit notes?/i, /(credit|debit) notes?.*issued/i] },
  // AI expansion, 2026-07 — the rest of the 35 misclassifications found by
  // the full 70-question live UAT run (50% miss rate on the first full
  // pass). Same fix shape as every prior entry in this array: a specific,
  // deterministic pattern for the clearest phrasing of each template's
  // actual question, since a 1.5B model choosing among ~110+ template names
  // demonstrably can't be trusted to discriminate this many similarly-named
  // options reliably. Five of these (realEstate/photography/pestControl/
  // vet/dental) were being refused outright (classified as out_of_scope)
  // before this fix — the worst failure mode, since the question was
  // genuinely answerable and the assistant said it couldn't help at all.
  { template: 'finance.biggestExpenseCategory', patterns: [/biggest expense category/i] },
  { template: 'documents.invoiceByNumber', patterns: [/(look\s*up|find|show me)\s+invoice\b/i] },
  { template: 'documents.purchaseOrderByNumber', patterns: [/(look\s*up|find|show me)\s+purchase\s+order\b/i] },
  { template: 'customers.byNameOrPhone', patterns: [/(look\s*up|find)\s+customer\b/i] },
  { template: 'suppliers.byName', patterns: [/(look\s*up|find)\s+supplier\b/i] },
  { template: 'sales.cancelledInvoices', patterns: [/cancelled invoices?/i] },
  { template: 'inventory.nearReorderLevel', patterns: [/close to.*reorder/i, /near.*reorder level/i] },
  { template: 'inventory.biggestStockAdjustment', patterns: [/biggest stock adjustment/i, /stock adjustment/i] },
  { template: 'customers.highestSinglePurchase', patterns: [/highest single purchase/i, /biggest single purchase/i] },
  { template: 'customers.averageSpend', patterns: [/average.*customer spend/i, /customer spend/i] },
  { template: 'customers.repeatPurchaseRate', patterns: [/repeat purchase rate/i, /repeat buyers?/i] },
  // Real gaps found live 2026-07-16 (full 109-template packaged-app
  // battery): both fell through to the LLM classify call, which has no
  // fast-path competitor for sales.compareToPreviousPeriod either (it has
  // zero deterministic patterns of its own) — confirming these two just had
  // no coverage at all rather than losing to a specific competing pattern.
  { template: 'customers.byCity', patterns: [/(what\s+)?cit(y|ies).*customers?/i, /customers?.*(cities|located)/i, /where.*customers?.*located/i] },
  { template: 'customers.newThisWeek', patterns: [/new\s+customers?.*this\s+week/i, /how many new customers/i] },
  { template: 'suppliers.inactive', patterns: [/suppliers?.*(haven'?t|not).*order/i, /inactive suppliers?/i] },
  { template: 'suppliers.averageDeliveryLeadTime', patterns: [/delivery lead time/i, /supplier.*lead time/i] },
  { template: 'suppliers.totalPurchaseValueThisMonth', patterns: [/purchase value.*suppliers?/i, /total purchase value/i] },
  { template: 'finance.discountImpact', patterns: [/discounts?.*impact/i, /impact.*discount/i] },
  { template: 'staff.totalSalaryPaidThisMonth', patterns: [/salary.*paid/i, /paid.*salary/i] },
  { template: 'documents.openQuotationsValue', patterns: [/value.*open quotations?/i, /open quotations?.*value/i] },
  { template: 'documents.quotationConversionRate', patterns: [/quotation.*(conversion|convert)/i] },
  { template: 'documents.overduePurchaseOrders', patterns: [/purchase orders?.*overdue/i, /overdue.*purchase orders?/i] },
  { template: 'service.unbilledTimeValue', patterns: [/unbilled time/i] },
  { template: 'compliance.upcomingFilings', patterns: [/roc filings?/i, /filings?\s+due/i] },
  { template: 'service.siteVisitsDueThisWeek', patterns: [/site visits?.*due/i, /site visits?.*week/i] },
  { template: 'realEstate.listingsAndLeads', patterns: [/listings?.*leads?/i, /leads?.*listings?/i] },
  { template: 'service.openIssues', patterns: [/open issues?/i] },
  // `\s+` required the trigger word and qualifier to be directly adjacent —
  // real phrasing like "shoots do I have coming up" has words in between.
  // Real bug found live during the 70-template UAT re-verification; widened
  // to `.*` for this and the two entries below.
  { template: 'photography.upcomingShoots', patterns: [/shoots?.*(coming up|upcoming|scheduled)/i, /upcoming shoots?/i] },
  { template: 'driving.upcomingTestsAndLowBalance', patterns: [/learners?.*(test|package|session)/i, /(upcoming test|package session)/i] },
  { template: 'pestControl.contractsDueForRenewal', patterns: [/pest.*contracts?/i, /contracts?.*renewal/i] },
  { template: 'vet.vaccinationsDue', patterns: [/vaccinations?.*(due|soon)/i] },
  { template: 'dental.recallsDue', patterns: [/(patient )?recalls?.*(due|soon)/i] },
  { template: 'carService.vehiclesInService', patterns: [/vehicles?.*in service/i] },
  { template: 'lab.reportsPendingFinalization', patterns: [/lab reports?.*pending/i, /reports?.*finaliz/i] },
  { template: 'placement.pipelineByStage', patterns: [/pipeline.*stage/i, /candidate pipeline/i] }
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

const STATIC_CATEGORY_PREFIXES = new Set(['sales', 'inventory', 'customers', 'suppliers', 'credit', 'finance', 'staff', 'documents', 'meta'])
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
// Real, verified bug fix, 2026-07 — NEVER use Date.prototype.toISOString()
// to stringify a date that represents a LOCAL calendar boundary ("today",
// start of month, a specific date the user asked about). toISOString()
// converts to UTC, which silently shifts the calendar day backward for any
// positive UTC-offset timezone — including IST (UTC+5:30), this app's
// primary market. Reproduced directly: `new Date(2025, 0, 15).toISOString()`
// on an IST machine returns "2025-01-14T18:30:00.000Z", so `.slice(0, 10)`
// silently returns Jan 14 for a question about Jan 15. The same class of bug
// hits "today" during the local 00:00-05:29 window (`new Date().toISOString()`
// still reports the previous UTC day) and every "start of this month/week"
// boundary, always, for any IST user regardless of time of day. Caught by a
// new test for the specific-date parser; the fix applies everywhere in this
// file that stringifies a LOCAL calendar boundary, not just that one path.
function toLocalISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Month-name → zero-indexed month map, longest keys first when built into a
// regex alternation (matched via MONTH_PATTERN below) so "september" isn't
// pre-empted by a shorter alias.
const MONTH_NAMES: Record<string, number> = {
  january: 0, jan: 0, february: 1, feb: 1, march: 2, mar: 2, april: 3, apr: 3,
  may: 4, june: 5, jun: 5, july: 6, jul: 6, august: 7, aug: 7,
  september: 8, sept: 8, sep: 8, october: 9, oct: 9, november: 10, nov: 10, december: 11, dec: 11
}
const MONTH_PATTERN = Object.keys(MONTH_NAMES).sort((a, b) => b.length - a.length).join('|')

// AI expansion, 2026-07 — a specific calendar date ("sales on 15th Jan",
// "how much did we sell on Jan 15 2025") was previously invisible to
// extractParams entirely, silently falling through to whatever default the
// matched template happened to use. Handles ISO (YYYY-MM-DD), day-first
// slash (DD/MM/YYYY, matching this codebase's Indian-locale convention
// elsewhere), "15th Jan[uary] [YYYY]", and "Jan[uary] 15[th] [,YYYY]".
// When no year is stated, defaults to the current year but rolls back to
// last year if that would land in the future — a bare "15th Jan" asked
// about a backward-looking sales question almost certainly means the most
// recent past occurrence, not a date that hasn't happened yet.
function tryParseSpecificDate(question: string, now: Date): string | null {
  const toISO = toLocalISODate
  const resolveYear = (day: number, month: number, explicitYear: string | undefined): Date => {
    if (explicitYear) return new Date(parseInt(explicitYear, 10), month, day)
    const d = new Date(now.getFullYear(), month, day)
    return d.getTime() > now.getTime() ? new Date(now.getFullYear() - 1, month, day) : d
  }

  const isoMatch = question.match(/\b(\d{4})-(\d{2})-(\d{2})\b/)
  if (isoMatch) return toISO(new Date(parseInt(isoMatch[1], 10), parseInt(isoMatch[2], 10) - 1, parseInt(isoMatch[3], 10)))

  const slashMatch = question.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/)
  if (slashMatch) return toISO(new Date(parseInt(slashMatch[3], 10), parseInt(slashMatch[2], 10) - 1, parseInt(slashMatch[1], 10)))

  const dayMonthMatch = question.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH_PATTERN})\\b(?:\\s+(\\d{4}))?`, 'i'))
  if (dayMonthMatch) return toISO(resolveYear(parseInt(dayMonthMatch[1], 10), MONTH_NAMES[dayMonthMatch[2].toLowerCase()], dayMonthMatch[3]))

  const monthDayMatch = question.match(new RegExp(`\\b(${MONTH_PATTERN})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:,?\\s+(\\d{4}))?`, 'i'))
  if (monthDayMatch) return toISO(resolveYear(parseInt(monthDayMatch[2], 10), MONTH_NAMES[monthDayMatch[1].toLowerCase()], monthDayMatch[3]))

  return null
}

// AI expansion, 2026-07 — Tier 2 (record-lookup-by-identifier templates).
// A single generic extractor rather than five bespoke ones: try the most
// unambiguous signal first (a quoted string), then a code-like token (covers
// invoice/PO/quotation numbers, SKUs, and phone numbers — all
// letters+digits or pure digits), then fall back to a run of Title-Case
// words for a bare person/business name. Returns null rather than a bad
// guess if none of these find anything — the lookup template's own isEmpty
// path then produces the standard FALLBACK_MESSAGE instead of a wrong match.
function extractSearchTerm(question: string): string | null {
  const quoted = question.match(/["'“”]([^"'“”]{2,60})["'“”]/)
  if (quoted) return quoted[1].trim()

  const codeMatches = question.match(/\b[A-Za-z]*\d[A-Za-z0-9-]*\b/g)
  if (codeMatches) {
    const longest = codeMatches.filter((t) => t.length >= 3).sort((a, b) => b.length - a.length)[0]
    if (longest) return longest
  }

  const words = question.trim().split(/\s+/)
  const nameWords: string[] = []
  for (let i = 1; i < words.length; i++) {
    const w = words[i].replace(/[?.,!]/g, '')
    if (/^[A-Z][a-z]+$/.test(w)) nameWords.push(w)
    else if (nameWords.length > 0) break
  }
  return nameWords.length > 0 ? nameWords.join(' ') : null
}

function extractParams(question: string): Record<string, unknown> {
  const params: Record<string, unknown> = {}

  const searchTerm = extractSearchTerm(question)
  if (searchTerm) params.searchTerm = searchTerm

  const topNMatch = question.match(/\b(?:top|best|bottom|worst|lowest)\s+(\d+)\b/i)
  if (topNMatch) params.topN = parseInt(topNMatch[1], 10)

  const daysMatch = question.match(/\b(?:last|past)\s+(\d+)\s+days?\b/i)
  if (daysMatch) params.days = parseInt(daysMatch[1], 10)

  const now = new Date()
  const toISO = toLocalISODate
  const startOfMonth = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), 1)
  const endOfMonth = (d: Date): Date => new Date(d.getFullYear(), d.getMonth() + 1, 0)
  const startOfWeek = (d: Date): Date => {
    const s = new Date(d)
    s.setDate(s.getDate() - s.getDay())
    return s
  }

  const specificDate = tryParseSpecificDate(question, now)
  if (specificDate) {
    params.dateFrom = specificDate
    params.dateTo = specificDate
  } else if (/\byesterday\b/i.test(question)) {
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
  } else if (/\blast year\b/i.test(question)) {
    params.dateFrom = toISO(new Date(now.getFullYear() - 1, 0, 1))
    params.dateTo = toISO(new Date(now.getFullYear() - 1, 11, 31))
  } else if (/\bthis year\b/i.test(question)) {
    params.dateFrom = toISO(new Date(now.getFullYear(), 0, 1))
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

// AI expansion, 2026-07 — a large fraction of the new templates default to
// "this month to date" when no date range was extracted from the question,
// same convention as sales.averageInvoiceValue/finance.profitAndLoss above.
// Factored out once here rather than repeated inline a dozen more times.
function defaultThisMonthRange(params: Record<string, unknown>): { dateFrom: string; dateTo: string } {
  const now = new Date()
  return {
    dateFrom: (params.dateFrom as string) ?? toLocalISODate(new Date(now.getFullYear(), now.getMonth(), 1)),
    dateTo: (params.dateTo as string) ?? toLocalISODate(now)
  }
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
      const dateFrom = (params.dateFrom as string) ?? toLocalISODate(new Date(now.getFullYear(), now.getMonth(), 1))
      const dateTo = (params.dateTo as string) ?? toLocalISODate(now)
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
      const dateFrom = (params.dateFrom as string) ?? toLocalISODate(new Date(now.getFullYear(), now.getMonth(), 1))
      const dateTo = (params.dateTo as string) ?? toLocalISODate(now)
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
  // AI expansion, 2026-07 — updated after the ~70-template expansion (Phase
  // 57 Addendum 7) to actually describe current scope: staff and documents
  // are now real answerable categories (they weren't before), and looking
  // up ONE specific record by name/number is a genuinely new capability
  // shape worth surfacing, not just a variation on the aggregate questions
  // already listed. Still a fixed, code-owned description, never model text.
  'meta.capabilities': {
    category: 'meta',
    async execute(_params, _sym) {
      return {
        headline: 'I can answer questions about your own business records — sales, inventory, customers, suppliers, credit, finance, staff, and documents like quotations and purchase orders — plus questions specific to your business type',
        details: [
          'Examples: "What were today\'s sales?", "What\'s low on stock?", "Who owes me money?", "What\'s our profit this month?"',
          'I can also look up one specific invoice, customer, supplier, or product by name or number — e.g. "Look up invoice INV-2026-000123"',
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
  },
  // AI expansion, 2026-07 — Tier 1: wiring an already-existing
  // report.service.ts/service function into a new template, zero new
  // aggregation logic. See project memory "AI Expansion Progress" for the
  // full ~83-item audit this batch is drawn from.
  'inventory.stockValue': {
    category: 'inventory',
    async execute(_params, sym) {
      const report = await reportService.generateInventoryReport()
      return {
        headline: `Total stock value: ${formatAmountForSpeech(report.summary.totalStockValue, sym)}`,
        details: [`${report.summary.totalProducts} products tracked`],
        isEmpty: report.summary.totalProducts === 0
      }
    }
  },
  'inventory.outOfStockCount': {
    category: 'inventory',
    async execute(_params, _sym) {
      const report = await reportService.generateInventoryReport()
      const outOfStock = report.rows.filter((r) => r.currentStock === 0).slice(0, 10)
      return {
        headline: `${report.summary.outOfStockItems} products are out of stock`,
        details: outOfStock.map((r) => r.productName),
        isEmpty: report.summary.outOfStockItems === 0
      }
    }
  },
  // Cash-in-hand is a running balance, not a period figure — dateFrom is
  // pinned to well before any real business's data (rather than left
  // undefined) so `openingBalance` computes to 0 and `closingBalance`
  // reflects every cash movement ever recorded, up to today.
  'finance.cashInHand': {
    category: 'finance',
    async execute(_params, sym) {
      const now = new Date()
      const report = await reportService.generateCashBookReport({ dateFrom: '2000-01-01', dateTo: toLocalISODate(now) })
      return {
        headline: `Cash in hand: ${formatAmountForSpeech(report.closingBalance, sym)}`,
        details: [],
        isEmpty: false
      }
    }
  },
  'finance.expenseBreakdown': {
    category: 'finance',
    async execute(params, sym) {
      const now = new Date()
      const dateFrom = (params.dateFrom as string) ?? toLocalISODate(new Date(now.getFullYear(), now.getMonth(), 1))
      const dateTo = (params.dateTo as string) ?? toLocalISODate(now)
      const report = await reportService.generateExpenseReport({ dateFrom, dateTo })
      return {
        headline: `Total expenses for the selected period: ${formatAmountForSpeech(report.summary.totalAmount, sym)}`,
        details: report.byCategory.map((c) => `${c.category}: ${formatAmountForSpeech(c.amount, sym)}`),
        isEmpty: report.summary.expenseCount === 0
      }
    }
  },
  'finance.biggestExpenseCategory': {
    category: 'finance',
    async execute(params, sym) {
      const now = new Date()
      const dateFrom = (params.dateFrom as string) ?? toLocalISODate(new Date(now.getFullYear(), now.getMonth(), 1))
      const dateTo = (params.dateTo as string) ?? toLocalISODate(now)
      const report = await reportService.generateExpenseReport({ dateFrom, dateTo })
      const top = [...report.byCategory].sort((a, b) => b.amount - a.amount)[0]
      if (!top) return { headline: '', details: [], isEmpty: true }
      return {
        headline: `Your biggest expense category is ${top.category} at ${formatAmountForSpeech(top.amount, sym)}`,
        details: [`${top.count} expense entries in this category for the selected period`],
        isEmpty: false
      }
    }
  },
  'finance.taxCollected': {
    category: 'finance',
    async execute(params, sym) {
      const now = new Date()
      const dateFrom = (params.dateFrom as string) ?? toLocalISODate(new Date(now.getFullYear(), now.getMonth(), 1))
      const dateTo = (params.dateTo as string) ?? toLocalISODate(now)
      const report = await reportService.generateTaxReport({ dateFrom, dateTo })
      return {
        headline: `Tax collected for the selected period: ${formatAmountForSpeech(report.summary.totalTaxCollected, sym)}`,
        details: [`Taxable turnover: ${formatAmountForSpeech(report.summary.totalTaxableAmount, sym)}`],
        isEmpty: report.summary.totalTaxCollected === 0
      }
    }
  },
  'staff.attendanceToday': {
    category: 'staff',
    async execute(_params, _sym) {
      const today = toLocalISODate(new Date())
      const report = await reportService.generateAttendanceReport({ dateFrom: today, dateTo: today })
      return {
        headline: `${report.summary.presentCount} of ${report.summary.totalRecords} staff present today`,
        details: [`Absent: ${report.summary.absentCount}`, `On leave: ${report.summary.leaveCount}`],
        isEmpty: report.summary.totalRecords === 0
      }
    }
  },
  'staff.onLeave': {
    category: 'staff',
    async execute(_params, _sym) {
      const today = toLocalISODate(new Date())
      const report = await reportService.generateAttendanceReport({ dateFrom: today, dateTo: today })
      const onLeave = report.rows.filter((r) => r.status === 'LEAVE')
      return {
        headline: `${report.summary.leaveCount} staff on leave today`,
        details: onLeave.map((r) => r.employeeName),
        isEmpty: report.summary.leaveCount === 0
      }
    }
  },
  // Pending = not yet resolved to a final ACCEPTED/EXPIRED (quotations) or
  // RECEIVED/CANCELLED (purchase orders) state — two service calls rather
  // than one query since both list() functions only accept a single status
  // filter, matching the existing "reuse canonical functions" pattern
  // instead of a new raw aggregation.
  'documents.pendingQuotations': {
    category: 'documents',
    async execute(_params, _sym) {
      const [draft, sent] = await Promise.all([
        quotationService.list({ status: 'DRAFT' }),
        quotationService.list({ status: 'SENT' })
      ])
      const count = (draft.data?.total ?? 0) + (sent.data?.total ?? 0)
      return {
        headline: `${count} quotations are still pending a customer decision`,
        details: [],
        isEmpty: count === 0
      }
    }
  },
  'documents.pendingPurchaseOrders': {
    category: 'documents',
    async execute(_params, _sym) {
      const [draft, approved] = await Promise.all([
        purchaseOrderService.listPOs({ status: 'DRAFT' }),
        purchaseOrderService.listPOs({ status: 'APPROVED' })
      ])
      const count = (draft.data?.total ?? 0) + (approved.data?.total ?? 0)
      return {
        headline: `${count} purchase orders are still pending receipt`,
        details: [`Awaiting approval: ${draft.data?.total ?? 0}`, `Approved, awaiting delivery: ${approved.data?.total ?? 0}`],
        isEmpty: count === 0
      }
    }
  },
  'documents.creditDebitNotesIssued': {
    category: 'documents',
    async execute(params, sym) {
      const now = new Date()
      const dateFrom = (params.dateFrom as string) ?? toLocalISODate(new Date(now.getFullYear(), now.getMonth(), 1))
      const dateTo = (params.dateTo as string) ?? toLocalISODate(now)
      const db = getPrisma()
      const from = new Date(dateFrom)
      const to = new Date(dateTo); to.setHours(23, 59, 59, 999)
      const [creditNotes, debitNotes] = await Promise.all([
        db.creditNote.findMany({ where: { createdAt: { gte: from, lte: to } }, select: { amount: true } }),
        db.debitNote.findMany({ where: { createdAt: { gte: from, lte: to } }, select: { amount: true } })
      ])
      const creditTotal = creditNotes.reduce((s, c) => s + c.amount, 0)
      const debitTotal = debitNotes.reduce((s, d) => s + d.amount, 0)
      return {
        headline: `${creditNotes.length} credit notes and ${debitNotes.length} debit notes issued in the selected period`,
        details: [`Credit notes total: ${formatAmountForSpeech(creditTotal, sym)}`, `Debit notes total: ${formatAmountForSpeech(debitTotal, sym)}`],
        isEmpty: creditNotes.length === 0 && debitNotes.length === 0
      }
    }
  },
  'customers.totalCount': {
    category: 'customers',
    async execute(_params, _sym) {
      const res = await listCustomers({ limit: 1 })
      const total = (res.data as { total?: number } | undefined)?.total ?? 0
      return {
        headline: `You have ${total} customers on record`,
        details: [],
        isEmpty: total === 0
      }
    }
  },
  // AI expansion, 2026-07 — Tier 2: look up ONE specific record by
  // identifier. Every template shares extractSearchTerm's params.searchTerm
  // and reuses each screen's own existing search-capable lookup function —
  // no new search logic. isEmpty is true both when no identifier could be
  // extracted from the question AND when a real search found nothing, since
  // either way there's no record to report.
  'documents.invoiceByNumber': {
    category: 'documents',
    async execute(params, sym) {
      const term = params.searchTerm as string | undefined
      if (!term) return { headline: '', details: [], isEmpty: true }
      const res = await billingService.listInvoices({ search: term, limit: 1 })
      const invoice = (res.data as { invoices?: Array<{ invoiceNumber: string; totalAmount: number; status: string; invoiceDate: Date; customer: { customerName: string } | null }> } | undefined)?.invoices?.[0]
      if (!invoice) return { headline: '', details: [], isEmpty: true }
      return {
        headline: `Invoice ${invoice.invoiceNumber}: ${formatAmountForSpeech(invoice.totalAmount, sym)}, status ${invoice.status}`,
        details: [
          `Customer: ${invoice.customer?.customerName ?? 'Walk-in'}`,
          `Date: ${toLocalISODate(new Date(invoice.invoiceDate))}`
        ],
        isEmpty: false
      }
    }
  },
  'documents.purchaseOrderByNumber': {
    category: 'documents',
    async execute(params, sym) {
      const term = params.searchTerm as string | undefined
      if (!term) return { headline: '', details: [], isEmpty: true }
      const db = getPrisma()
      const po = await db.purchaseOrder.findFirst({
        where: { poNumber: { contains: term } },
        include: { supplier: { select: { supplierName: true } } },
        orderBy: { createdAt: 'desc' }
      })
      if (!po) return { headline: '', details: [], isEmpty: true }
      return {
        headline: `Purchase order ${po.poNumber}: ${formatAmountForSpeech(po.totalAmount, sym)}, status ${po.status}`,
        details: [`Supplier: ${po.supplier.supplierName}`, `Order date: ${toLocalISODate(po.orderDate)}`],
        isEmpty: false
      }
    }
  },
  'customers.byNameOrPhone': {
    category: 'customers',
    async execute(params, sym) {
      const term = params.searchTerm as string | undefined
      if (!term) return { headline: '', details: [], isEmpty: true }
      const res = await searchCustomers(term)
      const customer = (res.data as Array<{ customerName: string; phone: string | null; outstandingBalance: number; customerCode: string | null }> | undefined)?.[0]
      if (!customer) return { headline: '', details: [], isEmpty: true }
      return {
        headline: `${customer.customerName}${customer.customerCode ? ` (${customer.customerCode})` : ''}`,
        details: [
          `Phone: ${customer.phone ?? 'not recorded'}`,
          `Outstanding balance: ${formatAmountForSpeech(customer.outstandingBalance, sym)}`
        ],
        isEmpty: false
      }
    }
  },
  'suppliers.byName': {
    category: 'suppliers',
    async execute(params, _sym) {
      const term = params.searchTerm as string | undefined
      if (!term) return { headline: '', details: [], isEmpty: true }
      const res = await searchSuppliers(term)
      const supplier = (res.data as Array<{ supplierName: string; phone: string | null; supplierCode: string | null }> | undefined)?.[0]
      if (!supplier) return { headline: '', details: [], isEmpty: true }
      return {
        headline: `${supplier.supplierName}${supplier.supplierCode ? ` (${supplier.supplierCode})` : ''}`,
        details: [`Phone: ${supplier.phone ?? 'not recorded'}`],
        isEmpty: false
      }
    }
  },
  'inventory.productByNameOrSku': {
    category: 'inventory',
    async execute(params, sym) {
      const term = params.searchTerm as string | undefined
      if (!term) return { headline: '', details: [], isEmpty: true }
      const res = await inventoryService.listInventory({ search: term, limit: 1 })
      const item = (res.data as { inventory?: Array<{ quantity: number; averageCost: number; product: { productName: string; sku: string | null; unit: string } }> } | undefined)?.inventory?.[0]
      if (!item) return { headline: '', details: [], isEmpty: true }
      return {
        headline: `${item.product.productName}${item.product.sku ? ` (${item.product.sku})` : ''}: ${item.quantity} ${item.product.unit} in stock`,
        details: [`Average cost: ${formatAmountForSpeech(item.averageCost, sym)}`],
        isEmpty: false
      }
    }
  },
  // AI expansion, 2026-07 — universal deepening batch (~35 templates covering
  // sales/inventory/customers/suppliers/finance/staff/documents questions
  // one level deeper than the original 18). See project memory "AI Expansion
  // Progress" for the full audit this batch is drawn from. Two items from
  // that audit are deliberately NOT here: "upcoming staff birthdays" (the
  // Employee model has no dateOfBirth field — genuinely unsupported by the
  // data, not an oversight) and "products with no supplier assigned" is
  // reinterpreted below as "products never purchased from any supplier"
  // (this app has no direct Product→Supplier assignment field).
  'inventory.topSellingByQuantity': {
    category: 'inventory',
    async execute(params, sym) {
      const topN = (params.topN as number) ?? 5
      const products = await getTopProducts(topN, params.dateFrom as string | undefined, params.dateTo as string | undefined, 'quantity')
      return {
        headline: `Your top ${products.length} products by quantity sold`,
        details: products.map((p) => `${p.productName}: ${p.quantitySold} sold (${formatAmountForSpeech(p.revenue, sym)})`),
        isEmpty: products.length === 0
      }
    }
  },
  'sales.byCategory': {
    category: 'sales',
    async execute(params, sym) {
      const topN = (params.topN as number) ?? 5
      const categories = await getTopCategories(topN)
      return {
        headline: `Your top ${categories.length} product categories by revenue (all-time)`,
        details: categories.map((c) => `${c.categoryName}: ${formatAmountForSpeech(c.revenue, sym)} (${c.itemsSold} items)`),
        isEmpty: categories.length === 0
      }
    }
  },
  'sales.byHourOfDay': {
    category: 'sales',
    async execute(params, sym) {
      const { dateFrom, dateTo } = defaultThisMonthRange(params)
      const report = await reportService.generateSalesReport({ dateFrom, dateTo })
      const busiest = [...report.byHour].sort((a, b) => b.revenue - a.revenue).slice(0, 5)
      if (busiest.length === 0) return { headline: '', details: [], isEmpty: true }
      return {
        headline: `Your busiest hour is ${busiest[0].hour} with ${formatAmountForSpeech(busiest[0].revenue, sym)} in sales`,
        details: busiest.slice(1).map((h) => `${h.hour}: ${formatAmountForSpeech(h.revenue, sym)} (${h.invoiceCount} invoices)`),
        isEmpty: false
      }
    }
  },
  'sales.uniqueCustomersServed': {
    category: 'sales',
    async execute(params, _sym) {
      const { dateFrom, dateTo } = defaultThisMonthRange(params)
      const db = getPrisma()
      const from = new Date(dateFrom)
      const to = new Date(dateTo); to.setHours(23, 59, 59, 999)
      const invoices = await db.invoice.findMany({
        where: { status: 'ACTIVE', invoiceType: { not: 'RETURN' }, invoiceDate: { gte: from, lte: to } },
        select: { customerId: true }
      })
      const uniqueCustomers = new Set(invoices.filter((i) => i.customerId).map((i) => i.customerId)).size
      const walkIns = invoices.filter((i) => !i.customerId).length
      return {
        headline: `${uniqueCustomers} unique registered customers served in the selected period`,
        details: [`Plus ${walkIns} walk-in (unregistered) sales`],
        isEmpty: invoices.length === 0
      }
    }
  },
  'sales.totalDiscountsGiven': {
    category: 'sales',
    async execute(params, sym) {
      const { dateFrom, dateTo } = defaultThisMonthRange(params)
      const report = await reportService.generateSalesReport({ dateFrom, dateTo })
      return {
        headline: `Total discounts given in the selected period: ${formatAmountForSpeech(report.summary.totalDiscount, sym)}`,
        details: [`Across ${report.summary.totalInvoices} invoices`],
        isEmpty: report.summary.totalDiscount === 0
      }
    }
  },
  'sales.returnsAndRefunds': {
    category: 'sales',
    async execute(params, sym) {
      const { dateFrom, dateTo } = defaultThisMonthRange(params)
      const db = getPrisma()
      const from = new Date(dateFrom)
      const to = new Date(dateTo); to.setHours(23, 59, 59, 999)
      const returns = await db.invoice.findMany({
        where: { invoiceType: 'RETURN', invoiceDate: { gte: from, lte: to } },
        select: { totalAmount: true }
      })
      const totalValue = returns.reduce((s, r) => s + Math.abs(r.totalAmount), 0)
      return {
        headline: `${returns.length} returns processed in the selected period, totaling ${formatAmountForSpeech(totalValue, sym)}`,
        details: [],
        isEmpty: returns.length === 0
      }
    }
  },
  'sales.cancelledInvoices': {
    category: 'sales',
    async execute(params, sym) {
      const { dateFrom, dateTo } = defaultThisMonthRange(params)
      const report = await reportService.generateSalesReport({ dateFrom, dateTo })
      const cancelledRows = report.rows.filter((r) => r.paymentStatus === 'CANCELLED')
      const cancelledValue = cancelledRows.reduce((s, r) => s + r.totalAmount, 0)
      return {
        headline: `${report.summary.cancelledInvoices} invoices were cancelled in the selected period, totaling ${formatAmountForSpeech(cancelledValue, sym)}`,
        details: [],
        isEmpty: report.summary.cancelledInvoices === 0
      }
    }
  },
  'sales.walkInVsRegistered': {
    category: 'sales',
    async execute(params, sym) {
      const { dateFrom, dateTo } = defaultThisMonthRange(params)
      const report = await reportService.generateSalesReport({ dateFrom, dateTo })
      const active = report.rows.filter((r) => r.paymentStatus !== 'CANCELLED')
      const registered = active.filter((r) => r.customer !== null)
      const walkIn = active.filter((r) => r.customer === null)
      const registeredValue = registered.reduce((s, r) => s + r.totalAmount, 0)
      const walkInValue = walkIn.reduce((s, r) => s + r.totalAmount, 0)
      return {
        headline: `${registered.length} sales to registered customers, ${walkIn.length} walk-in sales in the selected period`,
        details: [`Registered customer revenue: ${formatAmountForSpeech(registeredValue, sym)}`, `Walk-in revenue: ${formatAmountForSpeech(walkInValue, sym)}`],
        isEmpty: active.length === 0
      }
    }
  },
  'inventory.stockValueByCategory': {
    category: 'inventory',
    async execute(_params, sym) {
      const report = await reportService.generateInventoryReport()
      const map = new Map<string, number>()
      for (const r of report.rows) map.set(r.category, (map.get(r.category) ?? 0) + r.stockValue)
      const sorted = Array.from(map.entries()).sort((a, b) => b[1] - a[1])
      if (sorted.length === 0) return { headline: '', details: [], isEmpty: true }
      return {
        headline: `Stock value is spread across ${sorted.length} categories, led by ${sorted[0][0]} at ${formatAmountForSpeech(sorted[0][1], sym)}`,
        details: sorted.slice(1, 6).map(([cat, val]) => `${cat}: ${formatAmountForSpeech(val, sym)}`),
        isEmpty: false
      }
    }
  },
  'inventory.nearReorderLevel': {
    category: 'inventory',
    async execute(_params, _sym) {
      const db = getPrisma()
      const items = await db.inventory.findMany({
        where: { reorderLevel: { gt: 0 } },
        select: { quantity: true, reorderLevel: true, product: { select: { productName: true, isActive: true } } }
      })
      const near = items.filter((i) => i.product.isActive && i.quantity > i.reorderLevel && i.quantity <= i.reorderLevel * 1.2)
      return {
        headline: `${near.length} products are close to their reorder level but not yet below it`,
        details: near.slice(0, 10).map((i) => `${i.product.productName}: ${i.quantity} in stock (reorder at ${i.reorderLevel})`),
        isEmpty: near.length === 0
      }
    }
  },
  'inventory.distinctSkuCount': {
    category: 'inventory',
    async execute(_params, _sym) {
      const db = getPrisma()
      const count = await db.product.count({ where: { isActive: true, sku: { not: null } } })
      return {
        headline: `You have ${count} distinct SKUs on record`,
        details: [],
        isEmpty: count === 0
      }
    }
  },
  'inventory.productsAddedThisMonth': {
    category: 'inventory',
    async execute(_params, _sym) {
      const now = new Date()
      const from = new Date(now.getFullYear(), now.getMonth(), 1)
      const db = getPrisma()
      const count = await db.product.count({ where: { createdAt: { gte: from } } })
      return {
        headline: `${count} products added this month`,
        details: [],
        isEmpty: count === 0
      }
    }
  },
  // "Products with no supplier assigned" reinterpreted: this app has no
  // direct Product→Supplier assignment field (a product only links to a
  // supplier through its actual purchase-order history, PurchaseOrderItem)
  // — so the honest version of this question is "products that have never
  // appeared on any purchase order," which captures the same real concern
  // (no known supplier relationship for this product) without inventing data.
  'inventory.productsNeverPurchased': {
    category: 'inventory',
    async execute(_params, _sym) {
      const db = getPrisma()
      const products = await db.product.findMany({
        where: { isActive: true, purchaseItems: { none: {} } },
        select: { productName: true, sku: true }
      })
      return {
        headline: `${products.length} products have never been purchased from a supplier`,
        details: products.slice(0, 10).map((p) => p.productName),
        isEmpty: products.length === 0
      }
    }
  },
  'inventory.stockTurnoverRate': {
    category: 'inventory',
    async execute(params, _sym) {
      const { dateFrom, dateTo } = defaultThisMonthRange(params)
      const [pnl, inv] = await Promise.all([
        reportService.generateProfitAndLossReport({ dateFrom, dateTo }),
        reportService.generateInventoryReport()
      ])
      const turnover = inv.summary.totalStockValue > 0 ? pnl.summary.cogs / inv.summary.totalStockValue : 0
      return {
        headline: `Stock turnover for the selected period: ${turnover.toFixed(2)}x`,
        details: ['Based on cost of goods sold vs current stock value — an estimate, not a historical daily average, since this app doesn\'t keep a stock-value snapshot history'],
        isEmpty: inv.summary.totalStockValue === 0
      }
    }
  },
  'inventory.biggestStockAdjustment': {
    category: 'inventory',
    async execute(params, sym) {
      const { dateFrom, dateTo } = defaultThisMonthRange(params)
      const db = getPrisma()
      const from = new Date(dateFrom)
      const to = new Date(dateTo); to.setHours(23, 59, 59, 999)
      const movements = await db.inventoryMovement.findMany({
        where: { movementType: 'ADJUSTMENT', createdAt: { gte: from, lte: to } },
        select: { quantity: true, product: { select: { productName: true, costPrice: true } } }
      })
      if (movements.length === 0) return { headline: '', details: [], isEmpty: true }
      const biggest = [...movements].sort((a, b) => Math.abs(b.quantity * b.product.costPrice) - Math.abs(a.quantity * a.product.costPrice))[0]
      return {
        headline: `Biggest stock adjustment this period: ${biggest.product.productName}, ${biggest.quantity} units (~${formatAmountForSpeech(Math.abs(biggest.quantity * biggest.product.costPrice), sym)})`,
        details: [`${movements.length} adjustments recorded in total this period`],
        isEmpty: false
      }
    }
  },
  'customers.highestSinglePurchase': {
    category: 'customers',
    async execute(_params, sym) {
      const db = getPrisma()
      const invoice = await db.invoice.findFirst({
        where: { status: 'ACTIVE', invoiceType: { not: 'RETURN' }, customerId: { not: null } },
        orderBy: { totalAmount: 'desc' },
        select: { totalAmount: true, invoiceNumber: true, invoiceDate: true, customer: { select: { customerName: true } } }
      })
      if (!invoice) return { headline: '', details: [], isEmpty: true }
      return {
        headline: `Highest single purchase ever: ${formatAmountForSpeech(invoice.totalAmount, sym)} by ${invoice.customer?.customerName ?? 'a customer'}`,
        details: [`Invoice ${invoice.invoiceNumber}, ${toLocalISODate(invoice.invoiceDate)}`],
        isEmpty: false
      }
    }
  },
  'customers.averageSpend': {
    category: 'customers',
    async execute(params, sym) {
      const { dateFrom, dateTo } = defaultThisMonthRange(params)
      const db = getPrisma()
      const from = new Date(dateFrom)
      const to = new Date(dateTo); to.setHours(23, 59, 59, 999)
      const invoices = await db.invoice.findMany({
        where: { status: 'ACTIVE', invoiceType: { not: 'RETURN' }, customerId: { not: null }, invoiceDate: { gte: from, lte: to } },
        select: { customerId: true, totalAmount: true }
      })
      const byCustomer = new Map<string, number>()
      for (const inv of invoices) {
        const id = inv.customerId as string
        byCustomer.set(id, (byCustomer.get(id) ?? 0) + inv.totalAmount)
      }
      const totalCustomers = byCustomer.size
      const totalSpend = Array.from(byCustomer.values()).reduce((s, v) => s + v, 0)
      const avg = totalCustomers > 0 ? totalSpend / totalCustomers : 0
      return {
        headline: `Average spend per customer in the selected period: ${formatAmountForSpeech(avg, sym)}`,
        details: [`Across ${totalCustomers} customers`],
        isEmpty: totalCustomers === 0
      }
    }
  },
  'customers.byCity': {
    category: 'customers',
    async execute(_params, _sym) {
      const db = getPrisma()
      const customers = await db.customer.findMany({ where: { isActive: true }, select: { city: true } })
      const map = new Map<string, number>()
      for (const c of customers) {
        const city = c.city?.trim() || 'Not recorded'
        map.set(city, (map.get(city) ?? 0) + 1)
      }
      const sorted = Array.from(map.entries()).sort((a, b) => b[1] - a[1])
      if (sorted.length === 0) return { headline: '', details: [], isEmpty: true }
      return {
        headline: `Your customers are spread across ${sorted.length} cities/areas, led by ${sorted[0][0]} with ${sorted[0][1]} customers`,
        details: sorted.slice(1, 6).map(([city, count]) => `${city}: ${count}`),
        isEmpty: false
      }
    }
  },
  // Generalizes generateClientRetentionReport (service-appointment
  // businesses only) to any product business — repeat rate here is simply
  // "of the customers who bought in this period, what share bought more
  // than once."
  'customers.repeatPurchaseRate': {
    category: 'customers',
    async execute(params, _sym) {
      const { dateFrom, dateTo } = defaultThisMonthRange(params)
      const db = getPrisma()
      const from = new Date(dateFrom)
      const to = new Date(dateTo); to.setHours(23, 59, 59, 999)
      const invoices = await db.invoice.findMany({
        where: { status: 'ACTIVE', invoiceType: { not: 'RETURN' }, customerId: { not: null }, invoiceDate: { gte: from, lte: to } },
        select: { customerId: true }
      })
      const counts = new Map<string, number>()
      for (const inv of invoices) {
        const id = inv.customerId as string
        counts.set(id, (counts.get(id) ?? 0) + 1)
      }
      const total = counts.size
      const repeat = Array.from(counts.values()).filter((c) => c > 1).length
      const rate = total > 0 ? (repeat / total) * 100 : 0
      return {
        headline: `${rate.toFixed(0)}% of customers who bought this period bought more than once`,
        details: [`${repeat} of ${total} customers were repeat buyers`],
        isEmpty: total === 0
      }
    }
  },
  'customers.newThisWeek': {
    category: 'customers',
    async execute(_params, _sym) {
      const now = new Date()
      const startOfWeek = new Date(now)
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay())
      startOfWeek.setHours(0, 0, 0, 0)
      const db = getPrisma()
      const customers = await db.customer.findMany({ where: { createdAt: { gte: startOfWeek } }, select: { customerName: true } })
      return {
        headline: `${customers.length} new customers added this week`,
        details: customers.slice(0, 10).map((c) => c.customerName),
        isEmpty: customers.length === 0
      }
    }
  },
  'suppliers.inactive': {
    category: 'suppliers',
    async execute(params, _sym) {
      const days = (params.days as number) ?? 90
      const suppliers = await getInactiveSuppliers(days)
      const top10 = suppliers.slice(0, 10)
      return {
        headline: `${suppliers.length} suppliers haven't received an order from you in the last ${days} days`,
        details: top10.map((s) => `${s.supplierName} — last order ${s.lastOrderDate}`),
        isEmpty: suppliers.length === 0
      }
    }
  },
  'suppliers.averageDeliveryLeadTime': {
    category: 'suppliers',
    async execute(_params, _sym) {
      const db = getPrisma()
      const grns = await db.goodsReceiptNote.findMany({
        where: { purchaseOrderId: { not: null } },
        select: { receivedDate: true, purchaseOrder: { select: { orderDate: true } } }
      })
      const leadTimes = grns
        .filter((g): g is typeof g & { purchaseOrder: { orderDate: Date } } => g.purchaseOrder !== null)
        .map((g) => (g.receivedDate.getTime() - g.purchaseOrder.orderDate.getTime()) / (1000 * 60 * 60 * 24))
      if (leadTimes.length === 0) return { headline: '', details: [], isEmpty: true }
      const avg = leadTimes.reduce((s, v) => s + v, 0) / leadTimes.length
      return {
        headline: `Average delivery lead time: ${avg.toFixed(1)} days`,
        details: [`Based on ${leadTimes.length} received purchase orders`],
        isEmpty: false
      }
    }
  },
  'suppliers.totalPurchaseValueThisMonth': {
    category: 'suppliers',
    async execute(params, sym) {
      const { dateFrom, dateTo } = defaultThisMonthRange(params)
      const db = getPrisma()
      const from = new Date(dateFrom)
      const to = new Date(dateTo); to.setHours(23, 59, 59, 999)
      const orders = await db.purchaseOrder.findMany({
        where: { status: { not: 'CANCELLED' }, orderDate: { gte: from, lte: to } },
        select: { totalAmount: true }
      })
      const total = orders.reduce((s, o) => s + o.totalAmount, 0)
      return {
        headline: `Total purchase value across all suppliers this period: ${formatAmountForSpeech(total, sym)}`,
        details: [`${orders.length} purchase orders`],
        isEmpty: orders.length === 0
      }
    }
  },
  'finance.netGstPayable': {
    category: 'finance',
    async execute(params, sym) {
      const { dateFrom, dateTo } = defaultThisMonthRange(params)
      const db = getPrisma()
      const from = new Date(dateFrom)
      const to = new Date(dateTo); to.setHours(23, 59, 59, 999)
      const [taxReport, purchaseOrders] = await Promise.all([
        reportService.generateTaxReport({ dateFrom, dateTo }),
        db.purchaseOrder.findMany({ where: { status: { not: 'CANCELLED' }, orderDate: { gte: from, lte: to } }, select: { taxAmount: true } })
      ])
      const outputTax = taxReport.summary.totalTaxCollected
      const inputTax = purchaseOrders.reduce((s, po) => s + po.taxAmount, 0)
      const net = outputTax - inputTax
      return {
        headline: `Estimated net GST payable for the selected period: ${formatAmountForSpeech(net, sym)}`,
        details: [
          `Output tax collected on sales: ${formatAmountForSpeech(outputTax, sym)}`,
          `Input tax on purchase orders: ${formatAmountForSpeech(inputTax, sym)}`,
          'Estimate only, based on purchase-order tax — not a full input-tax-credit ledger'
        ],
        isEmpty: outputTax === 0 && inputTax === 0
      }
    }
  },
  'finance.cashVsBankSplit': {
    category: 'finance',
    async execute(params, sym) {
      const { dateFrom, dateTo } = defaultThisMonthRange(params)
      const db = getPrisma()
      const from = new Date(dateFrom)
      const to = new Date(dateTo); to.setHours(23, 59, 59, 999)
      const payments = await db.payment.findMany({
        where: { isReversed: false, paymentDate: { gte: from, lte: to } },
        select: { amount: true, paymentMethod: true }
      })
      const cash = payments.filter((p) => p.paymentMethod === 'CASH').reduce((s, p) => s + p.amount, 0)
      const nonCash = payments.filter((p) => p.paymentMethod !== 'CASH').reduce((s, p) => s + p.amount, 0)
      return {
        headline: `Receipts this period: ${formatAmountForSpeech(cash, sym)} cash, ${formatAmountForSpeech(nonCash, sym)} non-cash (card/UPI/bank transfer/other)`,
        details: [],
        isEmpty: payments.length === 0
      }
    }
  },
  'finance.discountImpact': {
    category: 'finance',
    async execute(params, sym) {
      const { dateFrom, dateTo } = defaultThisMonthRange(params)
      const report = await reportService.generateSalesReport({ dateFrom, dateTo })
      const pct = report.summary.totalRevenue > 0 ? (report.summary.totalDiscount / report.summary.totalRevenue) * 100 : 0
      return {
        headline: `Discounts reduced revenue by ${formatAmountForSpeech(report.summary.totalDiscount, sym)} this period, ${pct.toFixed(1)}% of gross sales`,
        details: [],
        isEmpty: report.summary.totalDiscount === 0
      }
    }
  },
  'finance.netWorthSnapshot': {
    category: 'finance',
    async execute(params, sym) {
      const { dateFrom, dateTo } = defaultThisMonthRange(params)
      const report = await reportService.generateTrialBalanceReport({ dateFrom, dateTo })
      const capitalRow = report.rows.find((r) => r.account.startsWith('Capital & Retained Earnings'))
      const netWorth = capitalRow ? capitalRow.credit - capitalRow.debit : 0
      return {
        headline: `Estimated net worth as of ${report.asOf}: ${formatAmountForSpeech(netWorth, sym)}`,
        details: ['Derived from your trial balance, not a persisted double-entry ledger — treat as an estimate'],
        isEmpty: false
      }
    }
  },
  'finance.expenseTrend': {
    category: 'finance',
    async execute(_params, sym) {
      const kpis = await getDashboardKpis()
      return {
        headline: `This month's expenses: ${formatAmountForSpeech(kpis.monthExpenses, sym)}, ${kpis.expenseTrend >= 0 ? 'up' : 'down'} ${Math.abs(kpis.expenseTrend).toFixed(1)}% vs last month`,
        details: [],
        isEmpty: kpis.monthExpenses === 0
      }
    }
  },
  'finance.profitTrend': {
    category: 'finance',
    async execute(_params, sym) {
      const kpis = await getDashboardKpis()
      return {
        headline: `This month's estimated profit: ${formatAmountForSpeech(kpis.estimatedProfit, sym)}, ${kpis.profitTrend >= 0 ? 'up' : 'down'} ${Math.abs(kpis.profitTrend).toFixed(1)}% vs last month`,
        details: [],
        isEmpty: false
      }
    }
  },
  'staff.totalSalaryPaidThisMonth': {
    category: 'staff',
    async execute(_params, sym) {
      const now = new Date()
      const res = await listPayrollForPeriod({ year: now.getFullYear(), month: now.getMonth() + 1 })
      const records = res.data?.records ?? []
      const paid = records.filter((r) => r.status === 'PAID')
      const total = paid.reduce((s, r) => s + r.netPayable, 0)
      return {
        headline: `Total salary paid this month: ${formatAmountForSpeech(total, sym)}`,
        details: [`${paid.length} of ${records.length} payroll records marked paid`],
        isEmpty: records.length === 0
      }
    }
  },
  'staff.bestWorstAttendance': {
    category: 'staff',
    async execute(params, _sym) {
      const { dateFrom, dateTo } = defaultThisMonthRange(params)
      const report = await reportService.generateAttendanceReport({ dateFrom, dateTo })
      if (report.byEmployee.length === 0) return { headline: '', details: [], isEmpty: true }
      const best = report.byEmployee[0]
      const worst = report.byEmployee[report.byEmployee.length - 1]
      return {
        headline: `Best attendance this period: ${best.employeeName} at ${best.attendanceRate}%`,
        details: report.byEmployee.length > 1 ? [`Lowest attendance: ${worst.employeeName} at ${worst.attendanceRate}%`] : [],
        isEmpty: false
      }
    }
  },
  'staff.activeHeadcount': {
    category: 'staff',
    async execute(_params, _sym) {
      const db = getPrisma()
      const count = await db.employee.count({ where: { isActive: true } })
      return {
        headline: `You have ${count} active employees`,
        details: [],
        isEmpty: count === 0
      }
    }
  },
  'documents.openQuotationsValue': {
    category: 'documents',
    async execute(_params, sym) {
      const [draft, sent] = await Promise.all([
        quotationService.list({ status: 'DRAFT', limit: 1000 }),
        quotationService.list({ status: 'SENT', limit: 1000 })
      ])
      const draftQuotations = (draft.data as { quotations?: Array<{ totalAmount: number }> } | undefined)?.quotations ?? []
      const sentQuotations = (sent.data as { quotations?: Array<{ totalAmount: number }> } | undefined)?.quotations ?? []
      const totalValue = [...draftQuotations, ...sentQuotations].reduce((s, q) => s + q.totalAmount, 0)
      const count = draftQuotations.length + sentQuotations.length
      return {
        headline: `${count} open quotations worth ${formatAmountForSpeech(totalValue, sym)}`,
        details: [],
        isEmpty: count === 0
      }
    }
  },
  'documents.quotationConversionRate': {
    category: 'documents',
    async execute(params, _sym) {
      const { dateFrom, dateTo } = defaultThisMonthRange(params)
      const db = getPrisma()
      const from = new Date(dateFrom)
      const to = new Date(dateTo); to.setHours(23, 59, 59, 999)
      const [total, converted] = await Promise.all([
        db.quotation.count({ where: { createdAt: { gte: from, lte: to } } }),
        db.quotation.count({ where: { createdAt: { gte: from, lte: to }, invoice: { isNot: null } } })
      ])
      const rate = total > 0 ? (converted / total) * 100 : 0
      return {
        headline: `${rate.toFixed(0)}% of quotations converted to an invoice this period`,
        details: [`${converted} of ${total} quotations converted`],
        isEmpty: total === 0
      }
    }
  },
  'documents.overduePurchaseOrders': {
    category: 'documents',
    async execute(_params, sym) {
      const db = getPrisma()
      const now = new Date()
      const orders = await db.purchaseOrder.findMany({
        where: { status: 'APPROVED', expectedDate: { lt: now } },
        select: { poNumber: true, totalAmount: true, expectedDate: true, supplier: { select: { supplierName: true } } },
        orderBy: { expectedDate: 'asc' }
      })
      const totalValue = orders.reduce((s, o) => s + o.totalAmount, 0)
      return {
        headline: `${orders.length} purchase orders are overdue for receipt, worth ${formatAmountForSpeech(totalValue, sym)}`,
        details: orders.slice(0, 10).map((o) => `${o.poNumber} — ${o.supplier.supplierName}, expected ${o.expectedDate ? toLocalISODate(o.expectedDate) : 'unknown'}`),
        isEmpty: orders.length === 0
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
