import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Hash, Plus, PhoneCall, CheckCircle2, SkipForward, RotateCcw, RefreshCw, X, AlertTriangle } from 'lucide-react'
import { api } from '@renderer/services/ipc-client'
import { useAuthStore } from '@app/store/auth.store'
import { Button } from '@shared/ui/atoms/Button'
import { Input } from '@shared/ui/atoms/Input'
import { Card } from '@shared/ui/molecules/Card'
import { Badge } from '@shared/ui/atoms/Badge'
import { Select } from '@shared/ui/atoms/Select'
import { cn } from '@shared/utils/cn'
import { useNotificationStore } from '@app/store/notification.store'

type TokenStatus = 'WAITING' | 'CALLED' | 'SEEN' | 'SKIPPED'

interface Token {
  id: string
  tokenNumber: number
  patientName: string
  age: string | null
  gender: string | null
  phone: string | null
  appointmentId: string | null
  status: TokenStatus
  calledAt: string | null
  seenAt: string | null
  notes: string | null
  appointment: { id: string; appointmentNumber: string; serviceTitle: string; scheduledTime: string } | null
}

interface Stats {
  waiting: number
  called: number
  seen: number
  skipped: number
  currentToken: { tokenNumber: number; patientName: string } | null
}

const STATUS_VARIANT: Record<TokenStatus, 'info' | 'warning' | 'success' | 'neutral'> = {
  WAITING: 'info',
  CALLED:  'warning',
  SEEN:    'success',
  SKIPPED: 'neutral',
}

export function TokenQueueScreen() {
  const { hasPermission } = useAuthStore()
  const { error: toastError } = useNotificationStore()
  const canManage = hasPermission('billing.createInvoice')

  const [tokens, setTokens] = useState<Token[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [actioningId, setActioningId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [qRes, sRes] = await Promise.all([
        api.tokenQueue.today(),
        api.tokenQueue.stats(),
      ])
      if (qRes.success && qRes.data) setTokens(qRes.data as Token[])
      else toastError('Error', qRes.error?.message ?? 'Could not load queue.')
      if (sRes.success && sRes.data) setStats(sRes.data as Stats)
    } catch {
      toastError('Error', 'Could not load queue.')
    } finally {
      setLoading(false)
    }
  }, [toastError])

  useEffect(() => { load() }, [load])

  async function handleAction(id: string, action: 'call' | 'seen' | 'skip' | 'reset') {
    setActioningId(id)
    setActionError(null)
    const handlers = {
      call:  () => api.tokenQueue.call({ id }),
      seen:  () => api.tokenQueue.seen({ id }),
      skip:  () => api.tokenQueue.skip({ id }),
      reset: () => api.tokenQueue.reset({ id }),
    }
    const res = await handlers[action]()
    setActioningId(null)
    if (!res.success) {
      setActionError(res.error?.message ?? 'Action failed. Please try again.')
      return
    }
    load()
  }

  async function handleCallNext() {
    const next = tokens.find((t) => t.status === 'WAITING')
    if (!next) return
    await handleAction(next.id, 'call')
  }

  const waiting = tokens.filter((t) => t.status === 'WAITING')
  const active  = tokens.filter((t) => t.status === 'CALLED')
  const done    = tokens.filter((t) => t.status === 'SEEN' || t.status === 'SKIPPED')

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-brand flex items-center justify-center">
            <Hash size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-dark dark:text-slate-100">Token Queue</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">{today}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          {canManage && (
            <Button size="sm" icon={<Plus size={14} />} onClick={() => setShowAddForm(true)}>
              Add Walk-in
            </Button>
          )}
        </div>
      </div>

      {/* Stats + Current Token */}
      <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-6 shrink-0">
        {/* Big current token */}
        <div className="flex items-center gap-4 pr-6 border-r border-slate-200 dark:border-slate-700">
          <div className="text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Now Serving</p>
            {stats?.currentToken ? (
              <>
                <p className="text-5xl font-black text-brand leading-none">{stats.currentToken.tokenNumber}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-[100px] truncate">{stats.currentToken.patientName}</p>
              </>
            ) : (
              <p className="text-3xl font-black text-slate-300">—</p>
            )}
          </div>
        </div>

        {/* Count chips */}
        <div className="flex items-center gap-4">
          {[
            { label: 'Waiting', value: stats?.waiting ?? 0, color: 'text-blue-600' },
            { label: 'Called',  value: stats?.called  ?? 0, color: 'text-amber-600' },
            { label: 'Seen',    value: stats?.seen    ?? 0, color: 'text-success' },
            { label: 'Skipped', value: stats?.skipped ?? 0, color: 'text-slate-400' },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-slate-400">{s.label}</p>
            </div>
          ))}
        </div>

        {canManage && (
          <Button
            size="sm"
            onClick={handleCallNext}
            disabled={waiting.length === 0}
            className="ml-auto"
          >
            Call Next (#{waiting[0]?.tokenNumber ?? '—'})
          </Button>
        )}
      </div>

      {/* Action error */}
      {actionError && (
        <div className="px-6 py-2 shrink-0">
          <div className="flex items-center gap-2 px-4 py-3 bg-danger/5 border border-danger/20 rounded-xl text-sm text-danger">
            <AlertTriangle size={14} className="shrink-0" />
            <span className="flex-1">{actionError}</span>
            <button onClick={() => setActionError(null)} className="text-danger/60 hover:text-danger transition-colors">
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Queue list */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading && tokens.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          </div>
        ) : tokens.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Hash size={32} className="text-slate-300 mb-3" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">No tokens yet today</p>
            {canManage && <p className="text-xs text-slate-400 mt-1">Click "Add Walk-in" to issue the first token.</p>}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Active / Called */}
            {active.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Currently Called</p>
                <div className="space-y-2">
                  {active.map((t) => (
                    <TokenRow key={t.id} token={t} canManage={canManage} actioning={actioningId === t.id} onAction={handleAction} />
                  ))}
                </div>
              </div>
            )}

            {/* Waiting */}
            {waiting.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Waiting ({waiting.length})</p>
                <div className="space-y-2">
                  {waiting.map((t) => (
                    <TokenRow key={t.id} token={t} canManage={canManage} actioning={actioningId === t.id} onAction={handleAction} />
                  ))}
                </div>
              </div>
            )}

            {/* Done */}
            {done.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Completed ({done.length})</p>
                <div className="space-y-2">
                  {done.map((t) => (
                    <TokenRow key={t.id} token={t} canManage={canManage} actioning={actioningId === t.id} onAction={handleAction} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Walk-in Modal */}
      {showAddForm && (
        <AddTokenModal onClose={() => setShowAddForm(false)} onSaved={() => { setShowAddForm(false); load() }} />
      )}
    </div>
  )
}

// ─── Token Row ────────────────────────────────────────────────────────────────

function TokenRow({ token, canManage, actioning, onAction }: {
  token: Token
  canManage: boolean
  actioning: boolean
  onAction: (id: string, action: 'call' | 'seen' | 'skip' | 'reset') => void
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }}>
    <Card
      padding="md"
      className={cn(
        'flex items-center gap-4',
        token.status === 'CALLED' && 'border-amber-300 bg-amber-50/50'
      )}
    >
      {/* Token number */}
      <div className={cn(
        'w-12 h-12 rounded-xl flex items-center justify-center shrink-0 font-black text-lg',
        token.status === 'CALLED'  ? 'bg-amber-100 text-amber-700' :
        token.status === 'SEEN'    ? 'bg-success/10 text-success' :
        token.status === 'SKIPPED' ? 'bg-slate-100 dark:bg-slate-800 text-slate-400' :
        'bg-brand/10 text-brand'
      )}>
        {token.tokenNumber}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-dark dark:text-slate-100 truncate">{token.patientName}</p>
          <Badge variant={STATUS_VARIANT[token.status] ?? 'neutral'} size="sm">
            {token.status === 'WAITING' ? 'Waiting' : token.status === 'CALLED' ? 'Called' : token.status === 'SEEN' ? 'Seen' : 'Skipped'}
          </Badge>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          {[token.age, token.gender].filter(Boolean).join(' · ')}
          {token.phone && ` · ${token.phone}`}
        </p>
        {token.appointment && (
          <p className="text-[10px] text-slate-400 mt-0.5">Appt: {token.appointment.appointmentNumber} · {token.appointment.serviceTitle} @ {token.appointment.scheduledTime}</p>
        )}
        {token.notes && <p className="text-[10px] text-slate-400 italic mt-0.5">{token.notes}</p>}
      </div>

      {/* Time stamps */}
      <div className="text-right shrink-0 text-[10px] text-slate-400 space-y-0.5">
        {token.calledAt && <p>Called: {new Date(token.calledAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>}
        {token.seenAt  && <p>Seen: {new Date(token.seenAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>}
      </div>

      {/* Actions */}
      {canManage && (
        <div className="flex items-center gap-1 shrink-0">
          {token.status === 'WAITING' && (
            <>
              <button disabled={actioning} onClick={() => onAction(token.id, 'call')} title="Call this token" className="p-1.5 rounded-lg border border-amber-300 text-amber-600 hover:bg-amber-50 disabled:opacity-50 transition-colors">
                <PhoneCall size={13} />
              </button>
              <button disabled={actioning} onClick={() => onAction(token.id, 'skip')} title="Skip" className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 hover:border-slate-400 disabled:opacity-50 transition-colors">
                <SkipForward size={13} />
              </button>
            </>
          )}
          {token.status === 'CALLED' && (
            <>
              <button disabled={actioning} onClick={() => onAction(token.id, 'seen')} title="Mark seen" className="p-1.5 rounded-lg border border-success/40 text-success hover:bg-success/5 disabled:opacity-50 transition-colors">
                <CheckCircle2 size={13} />
              </button>
              <button disabled={actioning} onClick={() => onAction(token.id, 'skip')} title="Skip" className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 hover:border-slate-400 disabled:opacity-50 transition-colors">
                <SkipForward size={13} />
              </button>
            </>
          )}
          {(token.status === 'SEEN' || token.status === 'SKIPPED') && (
            <button disabled={actioning} onClick={() => onAction(token.id, 'reset')} title="Reset to waiting" className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-brand hover:border-brand/30 disabled:opacity-50 transition-colors">
              <RotateCcw size={13} />
            </button>
          )}
        </div>
      )}
    </Card>
    </motion.div>
  )
}

// ─── Add Token Modal ──────────────────────────────────────────────────────────

function AddTokenModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ patientName: '', age: '', gender: '', phone: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  async function handleSave() {
    if (!form.patientName.trim()) { setError('Patient name is required.'); return }
    setSaving(true)
    setError(null)
    const res = await api.tokenQueue.create({
      patientName: form.patientName.trim(),
      age: form.age.trim() || undefined,
      gender: form.gender || undefined,
      phone: form.phone.trim() || undefined,
      notes: form.notes.trim() || undefined,
    })
    setSaving(false)
    if (!res.success) { setError(res.error?.message ?? 'Could not create token.'); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <p className="text-sm font-semibold text-dark dark:text-slate-100">Add Walk-in Token</p>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400"><X size={16} /></button>
        </div>
        <div className="p-6 space-y-4">
          {error && <p className="text-xs text-danger bg-danger/5 rounded-lg px-3 py-2">{error}</p>}

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Patient Name <span className="text-danger">*</span></label>
            <Input value={form.patientName} onChange={(e) => setForm((f) => ({ ...f, patientName: e.target.value }))} placeholder="Full name" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Age</label>
              <Input value={form.age} onChange={(e) => setForm((f) => ({ ...f, age: e.target.value }))} placeholder="e.g. 35 years" />
            </div>
            <div>
              <Select
                label="Gender"
                value={form.gender}
                onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}
              >
                <option value="">Select</option>
                <option>Male</option>
                <option>Female</option>
                <option>Other</option>
              </Select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Phone</label>
            <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="Optional" />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Notes</label>
            <Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Optional" />
          </div>
        </div>
        <div className="px-6 pb-6 flex gap-3 justify-end">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>Issue Token</Button>
        </div>
      </motion.div>
    </div>
  )
}
