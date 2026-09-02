import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Package, RefreshCw, AlertTriangle, CheckCircle2, Clock, Plus, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api } from '@renderer/services/ipc-client'
import { useAuthStore } from '@app/store/auth.store'
import { useIndustryStore } from '@app/store/industry.store'
import { useBusinessStore } from '@app/store/business.store'
import { Badge } from '@shared/ui/atoms/Badge'
import { Button } from '@shared/ui/atoms/Button'
import { Input } from '@shared/ui/atoms/Input'
import { Card } from '@shared/ui/molecules/Card'
import { CustomerPicker, type CustomerLite } from '@shared/ui/molecules/CustomerPicker'
import { cn } from '@shared/utils/cn'
import { useNotificationStore } from '@app/store/notification.store'

interface SessionPack {
  id: string
  packName: string
  totalSessions: number
  usedSessions: number
  purchaseDate: string
  expiryDate: string | null
  pricePerPack: number
  isActive: boolean
  invoiceId?: string | null
  assignedTrainerId?: string | null
  assignedTrainer?: { id: string; fullName: string } | null
  customer: { id: string; customerName: string; phone: string | null }
}

interface Trainer { id: string; fullName: string }

type Band = 'LOW' | 'EXPIRED' | 'ACTIVE'

function getBand(pack: SessionPack): Band {
  if (pack.expiryDate && new Date(pack.expiryDate) < new Date()) return 'EXPIRED'
  const remaining = pack.totalSessions - pack.usedSessions
  if (remaining <= 2) return 'LOW'
  return 'ACTIVE'
}

// Band is a purely client-derived classification (computed by getBand() above from
// expiryDate/remaining sessions, not a backend-set field — ClientSessionPack has no
// `status` column in prisma/schema.prisma). getBand()'s switch is exhaustive over the
// 3-value Band union, so this map is complete by construction.
const BAND_CONFIG: Record<Band, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  EXPIRED: { label: 'Expired',      color: 'text-danger',    bg: 'bg-danger/5',    border: 'border-danger/20',   icon: <AlertTriangle size={13} /> },
  LOW:     { label: 'Running Low',  color: 'text-warning',   bg: 'bg-warning/5',   border: 'border-warning/20',  icon: <Clock size={13} /> },
  ACTIVE:  { label: 'Active',       color: 'text-success',   bg: 'bg-success/5',   border: 'border-success/20',  icon: <CheckCircle2 size={13} /> },
}

const BAND_VARIANT: Record<Band, 'danger' | 'warning' | 'success'> = {
  EXPIRED: 'danger',
  LOW: 'warning',
  ACTIVE: 'success',
}

function fmt(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function SessionPacksScreen() {
  const navigate = useNavigate()
  const hasSessionPacks = useIndustryStore((s) => s.isModuleEnabled('session_packs'))
  const currSym = useBusinessStore((s) => s.profile?.currencySymbol ?? '₹')
  const businessType = useBusinessStore((s) => s.profile?.businessType)
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const canManage = hasPermission('billing.createInvoice')
  const { success: toastSuccess, error: toastError } = useNotificationStore()

  const [packs, setPacks] = useState<SessionPack[]>([])
  const [trainers, setTrainers] = useState<Trainer[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Band | 'ALL'>('ALL')
  const [search, setSearch] = useState('')
  const [reassigningId, setReassigningId] = useState<string | null>(null)

  const [showNewPack, setShowNewPack] = useState(false)
  const [pickedCustomer, setPickedCustomer] = useState<CustomerLite | null>(null)
  const [form, setForm] = useState({
    packName: '', totalSessions: 10, purchaseDate: new Date().toISOString().split('T')[0],
    expiryDate: '', pricePerPack: 0, taxRate: 18, assignedTrainerId: '',
  })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [packsRes, trainersRes] = await Promise.all([
        api.sessionPack.listAll(),
        api.hr.listEmployees({ isActive: true }),
      ])
      if (packsRes.success && packsRes.data) setPacks(packsRes.data as SessionPack[])
      else toastError('Error', packsRes.error?.message ?? 'Could not load session packs.')
      if (trainersRes.success && trainersRes.data) setTrainers((trainersRes.data as { employees: Trainer[] }).employees ?? [])
    } catch {
      toastError('Error', 'Could not load session packs.')
    } finally {
      setLoading(false)
    }
  }, [toastError])

  useEffect(() => { load() }, [load])

  function resetForm() {
    setPickedCustomer(null)
    setForm({ packName: '', totalSessions: 10, purchaseDate: new Date().toISOString().split('T')[0], expiryDate: '', pricePerPack: 0, taxRate: 18, assignedTrainerId: '' })
    setFormError(null)
  }

  async function handleCreatePack() {
    if (!pickedCustomer) { setFormError('Select a customer.'); return }
    if (!form.packName.trim()) { setFormError('Pack name is required.'); return }
    if (form.totalSessions < 1) { setFormError('Sessions must be at least 1.'); return }
    setSaving(true)
    setFormError(null)
    try {
      const res = await api.sessionPack.create({
        customerId: pickedCustomer.id,
        packName: form.packName,
        totalSessions: form.totalSessions,
        purchaseDate: form.purchaseDate,
        expiryDate: form.expiryDate || undefined,
        pricePerPack: form.pricePerPack,
        taxRate: form.taxRate,
        assignedTrainerId: form.assignedTrainerId || undefined,
      })
      if (res.success) {
        toastSuccess('Pack created', `${form.packName} for ${pickedCustomer.customerName}`)
        setShowNewPack(false)
        resetForm()
        await load()
      } else {
        setFormError(res.error?.message ?? 'Could not create pack.')
      }
    } catch {
      setFormError('Could not create pack.')
    } finally {
      setSaving(false)
    }
  }

  async function handleReassignTrainer(packId: string, trainerId: string) {
    setReassigningId(packId)
    try {
      const res = await api.sessionPack.assignTrainer({ packId, trainerId: trainerId || null })
      if (res.success) await load()
      else toastError('Error', res.error?.message ?? 'Could not assign trainer.')
    } catch {
      toastError('Error', 'Could not assign trainer.')
    } finally {
      setReassigningId(null)
    }
  }

  if (!hasSessionPacks) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Package size={40} className="text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Session Packs are not enabled for your business type.</p>
        </div>
      </div>
    )
  }

  const filtered = packs.filter((p) => {
    if (filter !== 'ALL' && getBand(p) !== filter) return false
    if (search) {
      const q = search.toLowerCase()
      return p.customer.customerName.toLowerCase().includes(q) || (p.customer.phone ?? '').includes(q)
    }
    return true
  })

  const counts: Record<Band | 'ALL', number> = {
    ALL:     packs.length,
    ACTIVE:  packs.filter((p) => getBand(p) === 'ACTIVE').length,
    LOW:     packs.filter((p) => getBand(p) === 'LOW').length,
    EXPIRED: packs.filter((p) => getBand(p) === 'EXPIRED').length,
  }

  // PhysioPatientScreen's own "Session Packs" section (patient-scoped, with
  // clinical notes context) is the richer destination for PHYSIO_CLINIC —
  // every other vertical sharing this module (Gym/Studio, Beauty Salon) has
  // no such patient-shaped screen, so a pack row there just expands trainer
  // assignment inline instead of navigating to a route that doesn't apply.
  const clickThroughToPhysio = businessType === 'PHYSIO_CLINIC'

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-brand flex items-center justify-center">
            <Package size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-dark dark:text-slate-100">Session Packs</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">{packs.length} pack{packs.length !== 1 ? 's' : ''} tracked</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          {canManage && (
            <Button size="sm" icon={<Plus size={14} />} onClick={() => setShowNewPack((s) => !s)}>New Pack</Button>
          )}
        </div>
      </div>

      {/* New pack form — the only place any GYM_STUDIO/BEAUTY_SALON install can
          actually create a session pack (Personal Training package): pack
          creation previously only existed on PhysioPatientScreen, a
          physio-only route, leaving Gym/Salon with a read-only list and no
          way to reach the create/assignedTrainerId path that already existed
          server-side. */}
      <AnimatePresence>
        {showNewPack && canManage && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="mx-6 mt-4 bg-white dark:bg-slate-900 rounded-2xl border border-brand/20 p-5 space-y-4 shrink-0">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-dark dark:text-slate-100">New Session Pack</p>
              <button onClick={() => { setShowNewPack(false); resetForm() }} className="text-slate-400 hover:text-dark dark:hover:text-slate-100"><X size={16} /></button>
            </div>
            {formError && <p className="text-xs text-danger bg-danger/5 border border-danger/20 rounded-lg px-3 py-2">{formError}</p>}
            <CustomerPicker value={pickedCustomer} onChange={setPickedCustomer} label="Customer" />
            <div className="grid grid-cols-2 gap-4">
              <Input label="Pack Name" placeholder="e.g. 10-session Personal Training" value={form.packName}
                onChange={(e) => setForm((f) => ({ ...f, packName: e.target.value }))} required />
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Number of Sessions <span className="text-danger">*</span></label>
                <input type="number" min={1} value={form.totalSessions}
                  onChange={(e) => setForm((f) => ({ ...f, totalSessions: parseInt(e.target.value) || 1 }))}
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand" />
              </div>
              <Input label="Purchase Date" type="date" value={form.purchaseDate}
                onChange={(e) => setForm((f) => ({ ...f, purchaseDate: e.target.value }))} />
              <Input label="Expiry Date (optional)" type="date" value={form.expiryDate}
                onChange={(e) => setForm((f) => ({ ...f, expiryDate: e.target.value }))} />
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Pack Price ({currSym})</label>
                <input type="number" min={0} value={form.pricePerPack}
                  onChange={(e) => setForm((f) => ({ ...f, pricePerPack: parseFloat(e.target.value) || 0 }))}
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Tax Rate (%)</label>
                <input type="number" min={0} max={28} value={form.taxRate}
                  onChange={(e) => setForm((f) => ({ ...f, taxRate: parseFloat(e.target.value) || 0 }))}
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand" />
              </div>
              {trainers.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Assigned Trainer (optional)</label>
                  <select value={form.assignedTrainerId} onChange={(e) => setForm((f) => ({ ...f, assignedTrainerId: e.target.value }))}
                    className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand">
                    <option value="">No standing trainer</option>
                    {trainers.map((t) => <option key={t.id} value={t.id}>{t.fullName}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="secondary" onClick={() => { setShowNewPack(false); resetForm() }}>Cancel</Button>
              <Button size="sm" loading={saving} onClick={handleCreatePack}>Save Pack</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters */}
      <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-2 shrink-0 flex-wrap mt-4">
        {(['ALL', 'ACTIVE', 'LOW', 'EXPIRED'] as const).map((b) => {
          const cfg = b === 'ALL' ? null : BAND_CONFIG[b]
          const isActive = filter === b
          return (
            <button
              key={b}
              onClick={() => setFilter(b)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors flex items-center gap-1 ${
                isActive
                  ? cfg ? `${cfg.color} ${cfg.bg} ${cfg.border}` : 'text-brand bg-brand/5 border-brand/20'
                  : 'text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300'
              }`}
            >
              {cfg && <span className={cfg.color}>{cfg.icon}</span>}
              {b === 'ALL' ? 'All' : BAND_CONFIG[b].label}
              <span className={`ms-0.5 ${isActive ? '' : 'text-slate-400'}`}>({counts[b]})</span>
            </button>
          )
        })}
        <input
          type="text"
          placeholder="Search customer..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ms-2 h-8 px-3 text-sm border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
        />
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Package size={32} className="text-slate-300 mb-3" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">No session packs found</p>
            <p className="text-xs text-slate-400 mt-1">
              {filter !== 'ALL' ? 'Try a different filter.' : canManage ? 'Click "New Pack" to record one.' : 'No session packs recorded yet.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((pack) => {
              const band = getBand(pack)
              const cfg = BAND_CONFIG[band]
              const remaining = pack.totalSessions - pack.usedSessions
              return (
                <motion.div
                  key={pack.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                <Card
                  padding="md"
                  className={cn('flex items-center gap-4 hover:shadow-sm transition-all', cfg.border, clickThroughToPhysio && 'cursor-pointer')}
                  onClick={clickThroughToPhysio ? () => navigate(`/physio/patient/${pack.customer.id}`) : undefined}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${cfg.bg} ${cfg.color}`}>
                    {cfg.icon}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-dark dark:text-slate-100 truncate">{pack.customer.customerName}</p>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      <span>{pack.packName}</span>
                      {pack.customer.phone && <span>{pack.customer.phone}</span>}
                      <span>{currSym}{Number(pack.pricePerPack).toLocaleString('en-IN')}</span>
                    </div>
                    {trainers.length > 0 && (
                      <div className="mt-1.5 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <span className="text-xs text-slate-400">Trainer:</span>
                        {canManage ? (
                          <select
                            value={pack.assignedTrainerId ?? ''}
                            disabled={reassigningId === pack.id}
                            onChange={(e) => handleReassignTrainer(pack.id, e.target.value)}
                            className="text-xs h-7 border border-slate-200 dark:border-slate-700 rounded-lg px-1.5 bg-white dark:bg-slate-900 text-dark dark:text-slate-100"
                          >
                            <option value="">Unassigned</option>
                            {trainers.map((t) => <option key={t.id} value={t.id}>{t.fullName}</option>)}
                          </select>
                        ) : (
                          <span className="text-xs text-slate-500">{pack.assignedTrainer?.fullName ?? 'Unassigned'}</span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="text-end shrink-0">
                    <p className={`text-lg font-bold ${remaining <= 2 ? 'text-warning' : 'text-success'}`}>{remaining}</p>
                    <p className="text-xs text-slate-400">of {pack.totalSessions} left</p>
                  </div>

                  <div className="text-end shrink-0">
                    {pack.expiryDate ? (
                      <>
                        <p className={`text-xs font-medium ${band === 'EXPIRED' ? 'text-danger' : 'text-slate-600 dark:text-slate-300'}`}>{fmt(pack.expiryDate)}</p>
                        <p className="text-[10px] text-slate-400">expiry</p>
                      </>
                    ) : (
                      <p className="text-xs text-slate-400">No expiry</p>
                    )}
                  </div>

                  <Badge variant={BAND_VARIANT[band]} size="sm" className="shrink-0">
                    {cfg.label}
                  </Badge>
                </Card>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
