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
//
// BUG FOUND 2026-07-22: this hardcoded 'en-US' grouping regardless of the
// business's configured number_format Setting (default 'IN' — lakh/crore
// grouping) — every other money-formatting surface in the app
// (print.service.ts, export.service.ts) resolves it via
// currency.service.ts. The AI Assistant spoke every amount in US-style
// grouping even for the app's stated primary Indian market, mismatching
// the invoice the same figure came from. formatAmountForSpeech is called
// from ~75 sites across ai-query.service.ts / ai-vertical-templates.service.ts
// and is a synchronous, DB-free function by design (called deep inside many
// small template functions) — rather than making all 75 call sites async
// just to fetch a Setting, this module keeps a small cache primed ONCE per
// question by askQuestion() (ai-query.service.ts's single entry point every
// question flows through) via refreshAiNumberFormat(), and every call in
// between reads it synchronously. Falls back to the same 'IN' default
// currency.service.ts itself uses if never primed (e.g. in unit tests).
const LOCALE_MAP: Record<string, string> = { IN: 'en-IN', US: 'en-US', EU: 'de-DE', UK: 'en-GB' }
let cachedNumberFormat = 'IN'

export async function refreshAiNumberFormat(): Promise<void> {
  // Lazy import to avoid a circular dependency at module-load time between
  // this util and the database layer.
  const { getPrisma } = await import('../database/db')
  try {
    const db = getPrisma()
    const row = await db.setting.findUnique({ where: { settingKey: 'number_format' } })
    cachedNumberFormat = row?.settingValue ?? 'IN'
  } catch {
    cachedNumberFormat = 'IN'
  }
}

export function formatAmountForSpeech(amount: number, sym: string): string {
  const locale = LOCALE_MAP[cachedNumberFormat] ?? 'en-IN'
  const grouped = Math.abs(amount).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `${amount < 0 ? '-' : ''}${sym}${grouped}`
}
