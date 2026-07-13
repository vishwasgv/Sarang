import { useState, useRef, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { Sparkles, Send } from 'lucide-react'
import { Card } from '@shared/ui/molecules/Card'
import { Button } from '@shared/ui/atoms/Button'

// Phase 57 — AI Assistant chat panel. English-only (see
// AI_ASSISTANT_MASTER_PROMPT.md Section 6 — small local models' non-English
// quality is weaker and untested), matching the plain-English convention
// already used for Hotel/Jewellery/Rental (all languageLock-adjacent
// verticals). Never names the underlying model/runtime anywhere here —
// "Sarang AI Assistant" only, enforced by never importing or displaying
// anything from ai-llama-provider.ts's internals.
//
// Latency is real for any question the deterministic fast-path doesn't
// match (~20-30s, actual model inference, not just a one-time load cost —
// PHASE_57_COMPLETION_REPORT.md Addendum 4's real measured numbers). Kept
// deliberately simple, per founder feedback (2026-07-13): just show
// "Thinking..." for the whole wait, no escalating/qualifying message — an
// earlier version added a "can take up to a minute" message after a delay,
// which was more accurate but was explicitly asked to be simplified back.

interface ChatMessage {
  role: 'user' | 'assistant'
  text: string
}

export function AiAssistantScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [question, setQuestion] = useState('')
  const [asking, setAsking] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const location = useLocation()

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, asking])

  async function handleAsk(override?: string) {
    // override lets a caller (the initialQuestion effect below) submit a
    // value that hasn't gone through setQuestion yet — asking() otherwise
    // reads the `question` state, which a setState just before calling this
    // wouldn't have applied in time.
    const q = (override ?? question).trim()
    if (!q || asking) return
    setMessages((prev) => [...prev, { role: 'user', text: q }])
    setQuestion('')
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
                Try "How much did I sell today?", "What's low on stock?", or "Who owes me money?" —
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
              </div>
            </div>
          ))}
          {asking && (
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-2xl rounded-bl-sm bg-slate-100 dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse" />
                Thinking...
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
