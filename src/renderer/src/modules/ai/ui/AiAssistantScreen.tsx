import { useState, useRef, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Sparkles, Send, BookOpen } from 'lucide-react'
import { Card } from '@shared/ui/molecules/Card'
import { Button } from '@shared/ui/atoms/Button'
import { findManualMatch, type ManualChapterRef } from '@modules/ai/manual-match.util'

// Phase 57 — AI Assistant chat panel. English-only (see
// docs/manual chapter ai-assistant.md's "Language" section, which discloses
// this directly to users — small local models' non-English quality is
// weaker and untested), matching the plain-English convention already used
// for Hotel/Jewellery/Rental (all languageLock-adjacent verticals). Never
// names the underlying model/runtime anywhere here — "Sarang AI Assistant"
// only, enforced by never importing or displaying anything from
// ai-llama-provider.ts's internals.
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
  manualSuggestions?: ManualChapterRef[]
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
    if (navMatch.kind === 'confident') {
      setMessages((prev) => [...prev, {
        role: 'assistant',
        text: `Here's how — see the "${navMatch.chapter.title}" chapter of the Manual for step-by-step instructions.`,
        manualSlug: navMatch.chapter.slug
      }])
      return
    }
    if (navMatch.kind === 'weak') {
      // Never sent to the AI pipeline — it has no knowledge of the app's UI
      // and would misclassify this as out_of_scope, producing a misleading
      // "I can only answer questions about your business data" refusal for
      // a perfectly reasonable navigation question. This is a graceful
      // "couldn't find an exact match" instead, with real candidates.
      setMessages((prev) => [...prev, {
        role: 'assistant',
        text: "I couldn't find an exact match for that in the Manual, but these chapters might help:",
        manualSuggestions: navMatch.candidates
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
                {m.manualSuggestions && (
                  <div className="mt-2 flex flex-col items-start gap-1">
                    {m.manualSuggestions.map((s) => (
                      <button
                        key={s.slug}
                        onClick={() => navigate(`/manual/${s.slug}`)}
                        className="flex items-center gap-1.5 text-xs font-semibold text-brand hover:underline"
                      >
                        <BookOpen size={13} /> {s.title}
                      </button>
                    ))}
                    <button
                      onClick={() => navigate('/manual')}
                      className="mt-1 text-xs text-slate-400 hover:text-slate-500 dark:hover:text-slate-300 hover:underline"
                    >
                      Or browse the full Manual
                    </button>
                  </div>
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
