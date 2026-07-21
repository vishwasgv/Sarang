import { useState, useRef, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Sparkles, Send, BookOpen } from 'lucide-react'
import { Card } from '@shared/ui/molecules/Card'
import { Button } from '@shared/ui/atoms/Button'
import { MANUAL_CHAPTERS } from '@modules/manual/manifest'
import { getChapterTitle, getChapterContentWithFallback } from '@modules/manual/content-loader'

// Phase 57 — AI Assistant chat panel. English-only (see
// AI_ASSISTANT_MASTER_PROMPT.md Section 6 — small local models' non-English
// quality is weaker and untested), matching the plain-English convention
// already used for Hotel/Jewellery/Rental (all languageLock-adjacent
// verticals). Never names the underlying model/runtime anywhere here —
// "Sarang AI Assistant" only, enforced by never importing or displaying
// anything from ai-llama-provider.ts's internals.
//
// Latency is real for any question the deterministic fast-path doesn't
// match (~20-30s typical, up to ~60s for the FIRST answer in a session while
// the local model warms up — PHASE_57_COMPLETION_REPORT.md Addendum 4's real
// measured numbers). "Thinking..." shows immediately; after 8s an escalating
// "This can take up to a minute..." line appears so a long first-run wait
// doesn't look stuck. (Re-added 2026-07-21 — a 2026-07-13 pass removed this
// for simplicity, but the founder asked for the honest expectation-setting
// back given warm-up time is real and can approach a full minute.)

interface ChatMessage {
  role: 'user' | 'assistant'
  text: string
  manualSlug?: string
}

// Navigation-help interception — answered entirely client-side, never sent
// through the ~20-30s model pipeline, since the model has no knowledge of
// the app's UI anyway (its templates only cover business-data questions).
// The Manual (Phase 56) is the single source of truth here — this only
// decides whether to point the user at one of its chapters, it never
// invents navigation instructions of its own.
const NAV_INTENT_PATTERN = /\bhow (do|can|to)\b|\bwhere (is|can|do)\b|\bhow to\b/i
const STOPWORDS = new Set(['how', 'do', 'i', 'can', 'to', 'the', 'a', 'an', 'is', 'are', 'where', 'find', 'my', 'me', 'in', 'on', 'for', 'of', 'what', 'does', 'you', 'and'])

function tokenize(s: string): string[] {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter((w) => w.length > 2 && !STOPWORDS.has(w))
}

function findManualMatch(question: string, locale: string): { slug: string; title: string } | null {
  if (!NAV_INTENT_PATTERN.test(question)) return null
  const qWords = new Set(tokenize(question))
  if (qWords.size === 0) return null
  let best: { slug: string; title: string; score: number } | null = null
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
    if (matchedDistinct.length < 2 && !strongMatch) continue
    let occurrenceScore = 0
    for (const w of qWords) occurrenceScore += bodyCounts.get(w) ?? 0
    const score = occurrenceScore + (titleHit ? 20 : 0)
    if (!best || score > best.score) best = { slug: chapter.slug, title, score }
  }
  return best ? { slug: best.slug, title: best.title } : null
}

export function AiAssistantScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [question, setQuestion] = useState('')
  const [asking, setAsking] = useState(false)
  const [slowWait, setSlowWait] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const location = useLocation()
  const navigate = useNavigate()
  const { i18n } = useTranslation()

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, asking])

  useEffect(() => {
    if (!asking) { setSlowWait(false); return }
    const t = setTimeout(() => setSlowWait(true), 8000)
    return () => clearTimeout(t)
  }, [asking])

  async function handleAsk(override?: string) {
    // override lets a caller (the initialQuestion effect below) submit a
    // value that hasn't gone through setQuestion yet — asking() otherwise
    // reads the `question` state, which a setState just before calling this
    // wouldn't have applied in time.
    const q = (override ?? question).trim()
    if (!q || asking) return
    setMessages((prev) => [...prev, { role: 'user', text: q }])
    setQuestion('')

    const navMatch = findManualMatch(q, i18n.language)
    if (navMatch) {
      setMessages((prev) => [...prev, {
        role: 'assistant',
        text: `Here's how — see the "${navMatch.title}" chapter of the Manual for step-by-step instructions.`,
        manualSlug: navMatch.slug
      }])
      return
    }

    setAsking(true)
    try {
      const res = await window.api.ai.query({ question: q })
      const answer = res.success
        ? (res.data as { answer: string }).answer
        : (res.error?.message ?? 'Something went wrong answering that question.')
      setMessages((prev) => [...prev, { role: 'assistant', text: answer }])
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', text: 'Something went wrong answering that question.' }])
    } finally {
      setAsking(false)
    }
  }

  // Owners can type their question straight from the Dashboard's "Ask
  // Sarang" box (DashboardScreen.tsx's handleAskFromDashboard) — it hands
  // the question over via router state and this screen answers it here.
  // Keyed on location.key (unique per navigation entry) so this only ever
  // fires once per hand-off, not on every re-render or on a later plain
  // sidebar navigation to this same route (which carries no state).
  const consumedKeyRef = useRef<string | null>(null)
  useEffect(() => {
    const initial = (location.state as { initialQuestion?: string } | null)?.initialQuestion
    if (initial && consumedKeyRef.current !== location.key) {
      consumedKeyRef.current = location.key
      void handleAsk(initial)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key])

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleAsk()
    }
  }

  return (
    <div className="p-6 h-full flex flex-col max-w-3xl mx-auto">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-dark dark:text-slate-100 flex items-center gap-2">
          <Sparkles size={24} className="text-brand" /> AI Assistant
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Ask Your Business.</p>
      </div>

      <Card padding="none" className="flex-1 flex flex-col overflow-hidden">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 py-12">
              <Sparkles size={36} className="mb-3 text-slate-300" />
              <p className="font-medium text-slate-500 dark:text-slate-400">Ask Your Business.</p>
              <p className="text-sm mt-1 max-w-sm">
                Try "How much did I sell today?", "What's low on stock?", "Who owes me money?",
                "What needs my attention?", "How do I create an invoice?", or "What can you do?" —
                answered entirely on this device, never sent anywhere.
              </p>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                  m.role === 'user'
                    ? 'bg-brand text-white rounded-br-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-dark dark:text-slate-100 rounded-bl-sm'
                }`}
              >
                {m.text}
                {m.manualSlug && (
                  <button
                    onClick={() => navigate(`/manual/${m.manualSlug}`)}
                    className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-brand hover:underline"
                  >
                    <BookOpen size={13} /> Open in Manual
                  </button>
                )}
              </div>
            </div>
          ))}
          {asking && (
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-2xl rounded-bl-sm bg-slate-100 dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse" />
                <span>
                  Thinking...
                  {slowWait && <span className="block text-xs mt-0.5 text-slate-400 dark:text-slate-500">This can take up to a minute, especially for the first question — please wait.</span>}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-slate-100 dark:border-slate-800 p-4 flex items-center gap-2">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={asking}
            placeholder="Ask a question about your business..."
            className="flex-1 h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-dark dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand disabled:opacity-50"
          />
          <Button onClick={() => handleAsk()} disabled={asking || !question.trim()} loading={asking} className="h-12 w-12 !p-0 flex items-center justify-center">
            <Send size={18} />
          </Button>
        </div>
      </Card>
    </div>
  )
}
