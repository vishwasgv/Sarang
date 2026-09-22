import { MANUAL_CHAPTERS } from '@modules/manual/manifest'
import { getChapterTitle, getChapterContentWithFallback } from '@modules/manual/content-loader'

// Navigation-help interception — answered entirely client-side, never sent
// through the ~20-30s AI model pipeline, since the model has no knowledge of
// the app's UI anyway (its templates only cover business-data questions).
// The Manual (Phase 56) is the single source of truth here — this only
// decides whether to point the user at one of its chapters, it never
// invents navigation instructions of its own.
//
// Extracted from AiAssistantScreen.tsx into its own pure module (no React,
// no Electron) so this deterministic matching logic is directly unit-
// testable with plain Vitest — the same reasoning as
// src/main/utils/external-link.util.ts's extraction: untested logic living
// inline inside a component is exactly the kind of thing that ships subtly
// wrong and stays that way.
// REAL BUG found+fixed 2026-07-31: the 2026-07-30 fix (the 'weak' branch
// below) only helps once a question is actually recognized as nav-shaped —
// this pattern only covered "how do/can/to..." and "where is/can/do...".
// A perfectly reasonable navigation question phrased another common way
// ("Can I export invoices to Excel?", "Is there a way to add a customer?",
// "What's the way to print a label?") never matched, fell through to the AI
// pipeline, got classified out_of_scope, and produced the exact misleading
// business-data-only refusal this whole feature exists to avoid — just for
// a different trigger phrase than the one already fixed.
const NAV_INTENT_PATTERN = /\bhow (do|can|to|would|does)\b|\bwhere (is|can|do|to)\b|\bcan i\b|\bis there (a |any )?way to\b|\b(what'?s|what is) the (way|best way) to\b|\bany way to\b/i
// REAL BUG found+fixed 2026-09-22, from live usage: the founder himself typed
// bare feature names ("kot", "waiters view") with no surrounding sentence at
// all — a completely normal, terse way to ask "where is/what is this
// feature" — and NAV_INTENT_PATTERN above only recognizes a full
// interrogative sentence shape, so these never even got a chance at a Manual
// lookup. They fell straight through to the slow AI data pipeline instead
// (isDeterministicallyOutOfScope doesn't catch them either — they're not
// advice-seeking), which has zero knowledge of the app's UI, and burned a
// genuine 90-144 SECONDS of local-model inference before refusing with the
// same misleading "I can only answer questions about your business data"
// message this whole file exists to avoid.
//
// Deliberately a small, hand-picked list of unambiguous, pure-UI/feature
// nouns — never words a genuine business-data question would use (unlike
// "settings" or "inventory", which are both manual-chapter topics AND
// plausible data-query subjects) — so this can safely OR into the gate
// without ever stealing a real data question's shot at the fast-path/model
// pipeline. Covers exactly the LAN-server features (Doctor Pad, Owner View,
// Field Orders, Token Queue, Kitchen Display, QR ordering) plus the two
// terms actually seen missing this session.
const FEATURE_NAME_PATTERN = /\bkot\b|\bwaiters?('?s)? view\b|\bdoctor'?s? pad\b|\bowner('?s)? view\b|\btoken queue\b|\bqr (order|ordering|menu)\b|\bfield orders?\b|\bkitchen display\b|\bkitchen order ticket\b/i
const STOPWORDS = new Set(['how', 'do', 'i', 'can', 'to', 'the', 'a', 'an', 'is', 'are', 'where', 'find', 'my', 'me', 'in', 'on', 'for', 'of', 'what', 'does', 'you', 'and'])

function tokenize(s: string): string[] {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter((w) => w.length > 2 && !STOPWORDS.has(w))
}

export type ManualChapterRef = { slug: string; title: string }
export type ManualMatchResult =
  // A genuinely confident single match — 2+ distinct matched words, or one
  // 6+-char "strong" word.
  | { kind: 'confident'; chapter: ManualChapterRef }
  // Real gap closed 2026-07-30: the question IS navigation-shaped ("how do
  // I...", "where is...") but no chapter cleared the confident bar — up to
  // 3 next-best candidates by score, shown as "might help" suggestions
  // instead of silently falling through to the AI pipeline, which would
  // misclassify this as out_of_scope and produce the misleading
  // business-data-only refusal message for a perfectly reasonable
  // navigation question.
  | { kind: 'weak'; candidates: ManualChapterRef[] }
  // Not phrased as a navigation question at all — proceed to the AI
  // pipeline as a genuine business-data question, unchanged.
  | { kind: 'none' }

export interface ScoredManualChapter { slug: string; title: string; score: number; confident: boolean }

// 2026-09-22 — extracted from findManualMatch below so CommandPalette.tsx's
// own Manual search (Ctrl+K) can reuse the exact same body-aware matching
// instead of its previous, much weaker `title.includes(query)` filter. REAL
// BUG found live: that title-only filter meant a huge fraction of the
// Manual was effectively unsearchable — anything covered mid-chapter but not
// literally present in the chapter's own title (e.g. "kot", "eraser",
// "waiter view") returned zero Command Palette results, even though this
// exact term-frequency scorer (already proven for the AI chat's navigation
// matching) finds it instantly. One scoring implementation, two callers —
// avoids the two ever silently drifting apart on what counts as a match.
export function scoreManualChapters(question: string, locale: string): ScoredManualChapter[] {
  const qWords = new Set(tokenize(question))
  if (qWords.size === 0) return []
  const scored: ScoredManualChapter[] = []
  for (const chapter of MANUAL_CHAPTERS) {
    const title = getChapterTitle(locale, chapter.slug, chapter.title)
    const titleWords = tokenize(title)
    const titleHit = titleWords.some((w) => qWords.has(w))
    // Body content is searched too (not just the title) — "how do I create an
    // invoice" shares no words with the title "Billing & Documents", but the
    // chapter body obviously discusses invoices at length. Still 100%
    // deterministic keyword matching, never generated text — only decides
    // WHICH real, already-written chapter to point at.
    //
    // Scored by TERM FREQUENCY, not just distinct-word presence — found live:
    // "how do I create an invoice" matched both `getting-started.md` (which
    // mentions "invoice" once, in its own walkthrough) and `billing.md` (which
    // discusses invoices at length) with the same distinct-word count, and the
    // tie went to whichever chapter happens to come first in MANUAL_CHAPTERS.
    // Counting occurrences instead means the chapter that's actually ABOUT the
    // topic wins, not just the first one that mentions it in passing.
    const bodyTokens = tokenize(getChapterContentWithFallback(locale, chapter.slug))
    const bodyCounts = new Map<string, number>()
    for (const w of bodyTokens) bodyCounts.set(w, (bodyCounts.get(w) ?? 0) + 1)
    const matchedDistinct = [...qWords].filter((w) => bodyCounts.has(w) || titleWords.includes(w))
    if (matchedDistinct.length === 0) continue
    const strongMatch = matchedDistinct.some((w) => w.length >= 6)
    let occurrenceScore = 0
    for (const w of qWords) occurrenceScore += bodyCounts.get(w) ?? 0
    const score = occurrenceScore + (titleHit ? 20 : 0)
    scored.push({ slug: chapter.slug, title, score, confident: matchedDistinct.length >= 2 || strongMatch })
  }
  scored.sort((a, b) => b.score - a.score)
  return scored
}

export function findManualMatch(question: string, locale: string): ManualMatchResult {
  if (!NAV_INTENT_PATTERN.test(question) && !FEATURE_NAME_PATTERN.test(question)) return { kind: 'none' }
  const scored = scoreManualChapters(question, locale)
  if (scored.length === 0) return { kind: 'none' }
  const best = scored[0]
  if (best.confident) return { kind: 'confident', chapter: { slug: best.slug, title: best.title } }
  return { kind: 'weak', candidates: scored.slice(0, 3).map(({ slug, title }) => ({ slug, title })) }
}
