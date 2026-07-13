// Phase 57 — AI Assistant. Shared by ai-query.service.ts and
// ai-vertical-templates.service.ts (a dedicated file, not exported from
// either, to avoid a circular import between them).
//
// print.service.ts's formatAmount() deliberately has no thousands
// separator ("₹18450.00", not "₹18,450.00") — correct for its own use case
// (compact print layouts), but a real readability gap once the AI
// assistant's LLM phrasing call was removed (2026-07-13) — that call used
// to naturally reformat numbers when generating text, silently masking
// this. Not touching formatAmount() itself (used across real invoice/
// receipt printing, out of scope here); this is a local wrapper for AI
// chat answers specifically.
// Real, live-caught bug (2026-07-13): this used to unconditionally
// Math.abs() the amount, on the assumption every value passed through here
// (sales totals, outstanding balances, revenue) is non-negative. That's
// false for finance.profitAndLoss's netProfit, which is a real loss in a
// normal test scenario (expenses exceeding revenue) — stripping the sign
// silently turned "you lost ₹9,876.54 this month" into "Net profit:
// ₹9,876.54", the exact opposite of true. A negative amount must render
// with a leading minus sign, not be silently made positive.
export function formatAmountForSpeech(amount: number, sym: string): string {
  const grouped = Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `${amount < 0 ? '-' : ''}${sym}${grouped}`
}
