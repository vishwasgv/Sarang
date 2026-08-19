import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Hash, Plus, PhoneCall, CheckCircle2, SkipForward, RotateCcw, RefreshCw, X, AlertTriangle, QrCode, RotateCw, Copy } from 'lucide-react'
import { api } from '@renderer/services/ipc-client'
import { useAuthStore } from '@app/store/auth.store'
import { useIndustryStore } from '@app/store/industry.store'
import { Button } from '@shared/ui/atoms/Button'
import { Input } from '@shared/ui/atoms/Input'
import { Card } from '@shared/ui/molecules/Card'
import { Badge } from '@shared/ui/atoms/Badge'
import { Select } from '@shared/ui/atoms/Select'
import { cn } from '@shared/utils/cn'
import { useNotificationStore } from '@app/store/notification.store'
import { ConfirmDialog } from '@shared/ui/molecules/ConfirmDialog'

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
  // Phase 67 §9.1 item 20.5 — Specialist Clinic: waitlist prioritization by referral urgency.
  isUrgent: boolean
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
  const { error: toastError, success: toastSuccess } = useNotificationStore()
  const canManage = hasPermission('billing.createInvoice')
  const canManageCheckIn = hasPermission('tokenQueue.manage')
  // Phase 67 §9.1 item 20.5 — Specialist Clinic: waitlist prioritization by referral urgency.
  const isReferralUrgency = useIndustryStore((s) => s.isModuleEnabled('referral_urgency'))

  const [tokens, setTokens] = useState<Token[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [actioningId, setActioningId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  // Phase 62 — self check-in via QR (LAN server), mirrors
  // FieldOrdersScreen.tsx's own status/QR block exactly.
  const [serverStatus, setServerStatus] = useState<{ running: boolean; lanUrls: string[]; token: string | null } | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [captureUrl, setCaptureUrl] = useState<string | null>(null)
  const [regenerateConfirmOpen, setRegenerateConfirmOpen] = useState(false)
  const [regenerating, setRegenerating] = useState(false)

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

  const loadServerStatus = useCallback(async () => {
    if (!canManageCheckIn) return
    try {
      const res = await api.tokenQueue.getServerStatus()
      if (res.success && res.data) setServerStatus(res.data as { running: boolean; lanUrls: string[]; token: string | null })
    } catch {
      // status panel failing to load must never block the queue above
    }
  }, [canManageCheckIn])

  useEffect(() => { load() }, [load])
  useEffect(() => { loadServerStatus() }, [loadServerStatus])

  async function handleShowQr() {
    try {
      const res = await api.tokenQueue.generateServerQr()
      if (res.success && res.data) {
        const d = res.data as { qrDataUrl: string; captureUrl: string }
        setQrDataUrl(d.qrDataUrl); setCaptureUrl(d.captureUrl)
      } else {
        toastError('Error', res.error?.message ?? 'Check-in is not currently running.')
      }
    } catch {
      toastError('Error', 'Could not generate QR code.')
    }
  }

  async function handleRegenerateToken() {
    setRegenerating(true)
    try {
      const res = await api.tokenQueue.regenerateServerToken()
      if (res.success) {
        toastSuccess('Link regenerated', 'The old check-in link and QR code no longer work.')
        setQrDataUrl(null); setCaptureUrl(null)
        setRegenerateConfirmOpen(false)
        loadServerStatus()
      } else {
        toastError('Error', res.error?.message ?? 'Could not regenerate the link.')
      }
    } catch {
      toastError('Error', 'Could not regenerate the link.')
    } finally {
      setRegenerating(false)
    }
  }

  async function handleAction(id: string, action: 'call' | 'seen' | 'skip' | 'reset') {
    setActioningId(id)
    setActionError(null)
    const handlers = {
      call:  () => api.tokenQueue.call({ id }),
      seen:  () => api.tokenQueue.seen({ id }),
      skip:  () => api.tokenQueue.skip({ id }),
      reset: () => api.tokenQueue.reset({ id }),
    }
    try {
      const res = await handlers[action]()
      if (!res.success) {
        setActionError(res.error?.message ?? 'Action failed. Please try again.')
        return
      }
      load()
    } catch {
      setActionError('Action failed. Please try again.')
    } finally {
      setActioningId(null)
    }
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
        <div className="flex items-center gap-4 pe-6 border-e border-slate-200 dark:border-slate-700">
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
            className="ms-auto"
          >
            Call Next (#{waiting[0]?.tokenNumber ?? '—'})
          </Button>
        )}
      </div>

      {/* Phase 62 — self check-in via QR */}
      {canManageCheckIn && serverStatus?.running && (
        <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 me-1">Patient self check-in:</p>
            <button onClick={handleShowQr} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-semibold hover:bg-brand/90 transition-colors">
              <QrCode size={13} /> Show QR
            </button>
            <button onClick={() => setRegenerateConfirmOpen(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 hover:border-danger hover:text-danger transition-colors">
              <RotateCw size={13} /> Regenerate Link
            </button>
          </div>
          {captureUrl && (
            <div className="flex items-center gap-3 mt-2 p-3 rounded-xl border border-slate-200 dark:border-slate-700 max-w-md">
              {qrDataUrl && <img src={qrDataUrl} alt="Token queue check-in QR code" className="w-28 h-28" />}
              <div className="min-w-0">
                <p className="text-xs text-slate-400 mb-1">Patients on the same Wi-Fi scan this to check themselves in.</p>
                <div className="flex items-center gap-1.5">
                  <code className="text-xs text-dark dark:text-slate-200 truncate">{captureUrl}</code>
                  <button onClick={() => { navigator.clipboard.writeText(captureUrl); toastSuccess('Copied', 'Link copied to clipboard.') }} className="text-slate-400 hover:text-brand transition-colors shrink-0">
                    <Copy size={13} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={regenerateConfirmOpen}
        onClose={() => setRegenerateConfirmOpen(false)}
        onConfirm={handleRegenerateToken}
        title="Regenerate check-in link?"
        message="The current QR code and link will stop working immediately. Anyone who already has it open will need the new one."
        confirmLabel="Regenerate"
        loading={regenerating}
      />

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
        <AddTokenModal showUrgent={isReferralUrgency} onClose={() => setShowAddForm(false)} onSaved={() => { setShowAddForm(false); load() }} />
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
        token.status === 'CALLED' && 'border-amber-300 bg-amber-50/50',
        token.isUrgent && 'border-danger/40'
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
          {token.isUrgent && (
            <Badge variant="danger" size="sm" icon={<AlertTriangle size={10} />}>Urgent</Badge>
          )}
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
      <div className="text-end shrink-0 text-[10px] text-slate-400 space-y-0.5">
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

function AddTokenModal({ showUrgent, onClose, onSaved }: { showUrgent: boolean; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ patientName: '', age: '', gender: '', phone: '', notes: '', isUrgent: false })
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
    try {
      const res = await api.tokenQueue.create({
        patientName: form.patientName.trim(),
        age: form.age.trim() || undefined,
        gender: form.gender || undefined,
        phone: form.phone.trim() || undefined,
        notes: form.notes.trim() || undefined,
        isUrgent: form.isUrgent || undefined,
      })
      if (!res.success) { setError(res.error?.message ?? 'Could not create token.'); return }
      onSaved()
    } catch {
      setError('Could not create token.')
    } finally {
      setSaving(false)
    }
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

          {showUrgent && (
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={form.isUrgent}
                onChange={(e) => setForm((f) => ({ ...f, isUrgent: e.target.checked }))}
                className="w-4 h-4"
              />
              Mark as urgent (referring doctor flagged this as urgent) — calls this patient ahead of the regular queue order
            </label>
          )}
        </div>
        <div className="px-6 pb-6 flex gap-3 justify-end">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>Issue Token</Button>
        </div>
      </motion.div>
    </div>
  )
}
