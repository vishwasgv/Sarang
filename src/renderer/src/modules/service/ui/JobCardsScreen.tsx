import React, { useEffect, useState, useCallback } from 'react'
import { Wrench, Plus, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { api } from '@renderer/services/ipc-client'
import { useNotificationStore } from '@app/store/notification.store'
import { cn } from '@shared/utils/cn'
import { formatCurrency } from '@shared/utils/currency.util'
import { formatDate } from '@shared/utils/locale.util'
import { Badge } from '@shared/ui/atoms/Badge'
import { Tabs } from '@shared/ui/molecules/Tabs'
import { Select } from '@shared/ui/atoms/Select'
import { ConfirmDialog } from '@shared/ui/molecules/ConfirmDialog'

interface Customer { id: string; customerName: string }
interface User { id: string; fullName: string }
interface JobCard {
  id: string; jobNumber: string; title: string; itemDescription: string | null
  status: string; priority: string; customerId: string | null; customerName: string | null
  assignedToId: string | null; assignedToName: string | null
  estimatedCost: number; actualCost: number
  receivedDate: string; expectedDate: string | null; deliveredDate: string | null
  notes: string | null; internalNotes: string | null
}

const STATUS_TABS = ['ALL', 'RECEIVED', 'DIAGNOSING', 'IN_REPAIR', 'PENDING_PARTS', 'READY', 'DELIVERED', 'CANCELLED']
const STATUS_LABEL_KEY: Record<string, string> = {
  RECEIVED:      'service.jobStReceived',
  DIAGNOSING:    'service.jobStDiagnosing',
  IN_REPAIR:     'service.jobStInRepair',
  PENDING_PARTS: 'service.jobStPendingParts',
  READY:         'service.jobStReady',
  DELIVERED:     'service.jobStDelivered',
  CANCELLED:     'service.jobStCancelled',
}

const STAGE_LABEL_KEYS = [
  'service.jobStReceived', 'service.jobStDiagnosing', 'service.jobStInRepair',
  'service.jobStReady', 'service.jobStDelivered'
]
// Verified exhaustive against job-card.service.ts's real status union:
// 'RECEIVED'|'DIAGNOSING'|'IN_REPAIR'|'PENDING_PARTS'|'READY'|'DELIVERED'|'CANCELLED'
const STATUS_VARIANT: Record<string, 'info' | 'brand' | 'warning' | 'success' | 'neutral' | 'danger'> = {
  RECEIVED: 'info', DIAGNOSING: 'brand',
  IN_REPAIR: 'warning', PENDING_PARTS: 'warning',
  READY: 'success', DELIVERED: 'neutral', CANCELLED: 'danger'
}
const NEXT_STATUS: Record<string, string> = {
  RECEIVED: 'DIAGNOSING', DIAGNOSING: 'IN_REPAIR', IN_REPAIR: 'READY',
  PENDING_PARTS: 'IN_REPAIR', READY: 'DELIVERED'
}

const BLANK_FORM = { title: '', itemDescription: '', priority: 'MEDIUM', customerId: '', assignedToId: '', estimatedCost: '', expectedDate: '', notes: '' }

export function JobCardsScreen() {
  const { t } = useTranslation()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const [cards, setCards] = useState<JobCard[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [activeTab, setActiveTab] = useState('ALL')
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ ...BLANK_FORM })
  const [saving, setSaving] = useState(false)
  const [detail, setDetail] = useState<JobCard | null>(null)
  const [actualCost, setActualCost] = useState('')
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [jRes, cRes, uRes] = await Promise.all([
        api.jobCards.list({}),
        api.customers.list({ limit: 500 }),
        api.users.list()
      ])
      if (jRes.success && jRes.data) {
        const d = jRes.data as { jobCards: JobCard[] }
        setCards(d.jobCards ?? [])
      } else {
        toastError(t('common.error'), jRes.error?.message ?? t('common.error'))
      }
      if (cRes.success && cRes.data) {
        const d = cRes.data as { customers: Customer[] }
        setCustomers(d.customers ?? [])
      }
      if (uRes.success && Array.isArray(uRes.data)) {
        setUsers(uRes.data as User[])
      }
    } catch {
      toastError(t('common.error'), t('common.error'))
    } finally {
      setLoading(false)
    }
  }, [toastError, t])

  useEffect(() => { load() }, [load])

  const visible = activeTab === 'ALL' ? cards : cards.filter(c => c.status === activeTab)
  const active = cards.filter(c => c.status !== 'DELIVERED' && c.status !== 'CANCELLED')

  const tabCounts = STATUS_TABS.slice(1).reduce<Record<string, number>>((acc, s) => {
    acc[s] = cards.filter(c => c.status === s).length
    return acc
  }, {})

  async function handleCreate() {
    if (!form.title.trim()) return
    setSaving(true)
    const res = await api.jobCards.create({
      title: form.title.trim(),
      itemDescription: form.itemDescription || undefined,
      priority: form.priority,
      customerId: form.customerId || undefined,
      assignedToId: form.assignedToId || undefined,
      estimatedCost: form.estimatedCost ? Number(form.estimatedCost) : undefined,
      expectedDate: form.expectedDate || undefined,
      notes: form.notes || undefined
    })
    setSaving(false)
    if (res.success) {
      toastSuccess(t('service.jobCreated'))
      setShowCreate(false)
      setForm({ ...BLANK_FORM })
      load()
    } else {
      toastError((res.error as any)?.message ?? 'Could not create job card')
    }
  }

  async function handleAdvanceStatus(card: JobCard) {
    const next = NEXT_STATUS[card.status]
    if (!next) return
    const payload: Record<string, unknown> = { id: card.id, status: next }
    if (next === 'DELIVERED' && actualCost) payload.actualCost = Number(actualCost)

    const res = await api.jobCards.update(payload as any)
    if (res.success) {
      toastSuccess(t('service.jobStatusUpdated'))
      const newActualCost = next === 'DELIVERED' && actualCost ? Number(actualCost) : undefined
      setCards(prev => prev.map(c => c.id === card.id ? { ...c, status: next, ...(newActualCost !== undefined ? { actualCost: newActualCost } : {}) } : c))
      if (detail?.id === card.id) setDetail(prev => prev ? { ...prev, status: next, ...(newActualCost !== undefined ? { actualCost: newActualCost } : {}) } : prev)
    } else {
      toastError(t('service.couldNotUpdateStatus'))
    }
  }

  async function handleSetPendingParts(cardId: string) {
    const res = await api.jobCards.update({ id: cardId, status: 'PENDING_PARTS' })
    if (res.success) {
      toastSuccess(t('service.jobStatusUpdated'))
      setCards(prev => prev.map(c => c.id === cardId ? { ...c, status: 'PENDING_PARTS' } : c))
      if (detail?.id === cardId) setDetail(prev => prev ? { ...prev, status: 'PENDING_PARTS' } : prev)
    } else {
      toastError(t('service.couldNotUpdateStatus'))
    }
  }

  async function handleCancel(cardId: string) {
    const res = await api.jobCards.update({ id: cardId, status: 'CANCELLED' })
    if (res.success) {
      toastSuccess(t('service.jobCancelled'))
      setCards(prev => prev.map(c => c.id === cardId ? { ...c, status: 'CANCELLED' } : c))
      if (detail?.id === cardId) setDetail(prev => prev ? { ...prev, status: 'CANCELLED' } : prev)
    } else {
      toastError(t('service.couldNotCancel'))
    }
  }

  async function handleDelete() {
    if (!deleteConfirmId) return
    const cardId = deleteConfirmId
    setDeleting(true)
    const res = await api.jobCards.delete({ id: cardId })
    setDeleting(false)
    setDeleteConfirmId(null)
    if (res.success) {
      toastSuccess(t('service.jobDeleted'))
      setDetail(null)
      setCards(prev => prev.filter(c => c.id !== cardId))
    } else {
      toastError((res.error as any)?.message ?? 'Could not delete')
    }
  }

  const STAGE_LABELS = STAGE_LABEL_KEYS.map(k => t(k))
  const STAGE_STATUSES = ['RECEIVED', 'DIAGNOSING', 'IN_REPAIR', 'READY', 'DELIVERED']

  function getStageIndex(status: string) {
    if (status === 'PENDING_PARTS') return 2
    return STAGE_STATUSES.indexOf(status)
  }

  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="shrink-0 px-6 pt-6 pb-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
              <Wrench size={24} className="text-brand" />
              {t('service.jobCards')}
            </h1>
            <p className="text-sm text-text-secondary mt-0.5">{active.length} {t('service.activeJobs')}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="h-11 w-11 flex items-center justify-center rounded-lg border border-border text-text-secondary hover:bg-surface-hover transition-colors">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={() => setShowCreate(true)} className="h-11 px-4 flex items-center gap-2 rounded-lg bg-brand text-white text-sm font-semibold hover:bg-brand-dark transition-colors">
              <Plus size={16} /> {t('service.newJobCardModal')}
            </button>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <Tabs
            tabs={STATUS_TABS.map(tab => ({
              id: tab,
              label: tab === 'ALL' ? `${t('common.all')} (${cards.length})` : `${t(STATUS_LABEL_KEY[tab] ?? tab)} (${tabCounts[tab] ?? 0})`
            }))}
            active={activeTab}
            onChange={setActiveTab}
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-text-secondary">
            <Wrench size={40} className="mb-3 opacity-30" />
            <p className="text-base font-medium">{t('service.noJobCards')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {visible.map(c => {
              const stageIdx = getStageIndex(c.status)
              return (
                <button key={c.id} onClick={() => { setDetail(c); setActualCost('') }}
                  className="w-full text-left bg-white dark:bg-slate-900 rounded-xl border border-border p-4 hover:border-brand/40 hover:shadow-sm transition-all">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs text-text-secondary">{c.jobNumber}</span>
                        <Badge variant={STATUS_VARIANT[c.status] ?? 'neutral'} size="sm">{t(STATUS_LABEL_KEY[c.status] ?? c.status)}</Badge>
                      </div>
                      <p className="mt-1 font-semibold text-text-primary">{c.title}</p>
                      {c.itemDescription && <p className="text-sm text-text-secondary truncate">{c.itemDescription}</p>}
                      {c.customerName && <p className="text-xs text-text-secondary mt-1">{c.customerName}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-text-primary">{formatCurrency(c.estimatedCost)}</p>
                      <p className="text-xs text-text-secondary">{t('service.estCost')}</p>
                    </div>
                  </div>

                  {stageIdx >= 0 && c.status !== 'CANCELLED' && (
                    <div className="mt-3">
                      <div className="flex gap-0.5">
                        {STAGE_LABELS.map((label, i) => (
                          <div key={label} className={cn('flex-1 h-1.5 rounded-sm transition-colors', i <= stageIdx ? 'bg-brand' : 'bg-slate-100 dark:bg-slate-800')} />
                        ))}
                      </div>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-auto">
            <div className="px-6 py-5 border-b border-border">
              <h2 className="text-xl font-bold text-text-primary">{t('service.newJobCardModal')}</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">{t('service.jobTitleLabel')}</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="" className="w-full h-12 px-4 rounded-xl border border-border text-base focus:outline-none focus:border-brand" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">{t('service.itemDescription')}</label>
                <input value={form.itemDescription} onChange={e => setForm(f => ({ ...f, itemDescription: e.target.value }))}
                  placeholder="" className="w-full h-12 px-4 rounded-xl border border-border text-base focus:outline-none focus:border-brand" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Select label={t('service.priority')} value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                    {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map(p => <option key={p} value={p}>{p}</option>)}
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">{t('service.estCost')}</label>
                  <input type="number" value={form.estimatedCost} onChange={e => setForm(f => ({ ...f, estimatedCost: e.target.value }))}
                    placeholder="0" min="0" className="w-full h-12 px-4 rounded-xl border border-border text-base focus:outline-none focus:border-brand" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Select label={t('billing.customer')} value={form.customerId} onChange={e => setForm(f => ({ ...f, customerId: e.target.value }))}>
                    <option value="">{t('service.noCustomer')}</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.customerName}</option>)}
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">{t('service.expectedBy')}</label>
                  <input type="date" value={form.expectedDate} onChange={e => setForm(f => ({ ...f, expectedDate: e.target.value }))}
                    className="w-full h-12 px-4 rounded-xl border border-border text-base focus:outline-none focus:border-brand" />
                </div>
              </div>
              {users.length > 0 && (
                <div>
                  <Select label={t('service.assignTo')} value={form.assignedToId} onChange={e => setForm(f => ({ ...f, assignedToId: e.target.value }))}>
                    <option value="">{t('service.unassigned')}</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
                  </Select>
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">{t('common.notes')}</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2} placeholder="" className="w-full px-4 py-3 rounded-xl border border-border text-base focus:outline-none focus:border-brand resize-none" />
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => { setShowCreate(false); setForm({ ...BLANK_FORM }) }}
                className="flex-1 h-12 rounded-xl border border-border text-text-secondary font-semibold hover:bg-surface-hover transition-colors">{t('common.cancel')}</button>
              <button onClick={handleCreate} disabled={saving || !form.title.trim()}
                className="flex-1 h-12 rounded-xl bg-brand text-white font-semibold hover:bg-brand-dark transition-colors disabled:opacity-50">
                {saving ? t('cashClose.saving') : t('service.newJobCardModal')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detail && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-auto">
            <div className="px-6 py-5 border-b border-border flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <span className="font-mono text-xs text-text-secondary">{detail.jobNumber}</span>
                <h2 className="text-lg font-bold text-text-primary mt-0.5">{detail.title}</h2>
                {detail.customerName && <p className="text-sm text-text-secondary">{detail.customerName}</p>}
              </div>
              <button onClick={() => setDetail(null)} className="text-text-secondary hover:text-text-primary text-2xl leading-none shrink-0">×</button>
            </div>
            <div className="p-6 space-y-4">
              {detail.status !== 'CANCELLED' && (
                <div>
                  <div className="flex gap-0.5 mb-2">
                    {STAGE_LABELS.map((label, i) => {
                      const isActive = i <= getStageIndex(detail.status)
                      return <div key={label} className={cn('flex-1 h-2 rounded-sm', isActive ? 'bg-brand' : 'bg-slate-100 dark:bg-slate-800')} />
                    })}
                  </div>
                  <div className="flex justify-between text-xs text-text-secondary">
                    {STAGE_LABELS.map(l => <span key={l}>{l}</span>)}
                  </div>
                </div>
              )}

              <div className="space-y-2 text-sm">
                <Badge variant={STATUS_VARIANT[detail.status] ?? 'neutral'} size="sm">{t(STATUS_LABEL_KEY[detail.status] ?? detail.status)}</Badge>
                <div className="flex justify-between"><span className="text-text-secondary">{t('service.assignTo')}</span><span className="text-text-primary font-medium">{detail.assignedToName ?? '—'}</span></div>
                {detail.itemDescription && (
                  <div><p className="text-text-secondary">{t('service.item')}</p><p className="text-text-primary mt-0.5">{detail.itemDescription}</p></div>
                )}
                {detail.notes && (
                  <div><p className="text-text-secondary">{t('common.notes')}</p><p className="text-text-primary mt-0.5">{detail.notes}</p></div>
                )}
                <div className="flex justify-between"><span className="text-text-secondary">{t('service.estCost')}</span><span className="font-semibold text-text-primary">{formatCurrency(detail.estimatedCost)}</span></div>
                {detail.actualCost > 0 && (
                  <div className="flex justify-between"><span className="text-text-secondary">{t('service.actualCostLabel')}</span><span className="font-semibold text-brand">{formatCurrency(detail.actualCost)}</span></div>
                )}
                {detail.expectedDate && (
                  <div className="flex justify-between"><span className="text-text-secondary">{t('service.expectedBy')}</span><span className="text-text-primary">{formatDate(detail.expectedDate)}</span></div>
                )}
              </div>

              {NEXT_STATUS[detail.status] && (
                <div className="space-y-2">
                  {NEXT_STATUS[detail.status] === 'DELIVERED' && (
                    <div>
                      <label className="block text-sm font-semibold text-text-primary mb-1">{t('service.actualCostLabel')}</label>
                      <input type="number" value={actualCost} onChange={e => setActualCost(e.target.value)}
                        placeholder="0" className="w-full h-11 px-4 rounded-xl border border-border text-sm focus:outline-none focus:border-brand" />
                    </div>
                  )}
                  <button onClick={() => handleAdvanceStatus(detail)}
                    className="w-full h-11 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand-dark transition-colors">
                    {t(STATUS_LABEL_KEY[NEXT_STATUS[detail.status]] ?? NEXT_STATUS[detail.status])}
                  </button>
                  {detail.status === 'IN_REPAIR' && (
                    <button onClick={() => handleSetPendingParts(detail.id)}
                      className="w-full h-11 rounded-xl border border-orange-200 text-orange-700 text-sm font-semibold hover:bg-orange-50 transition-colors">
                      {t('service.waitingForParts')}
                    </button>
                  )}
                  {detail.status !== 'DELIVERED' && detail.status !== 'CANCELLED' && (
                    <button onClick={() => handleCancel(detail.id)}
                      className="w-full h-11 rounded-xl border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 transition-colors">
                      {t('service.cancelJob')}
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="px-6 pb-6">
              <button onClick={() => setDeleteConfirmId(detail.id)}
                className="w-full h-11 rounded-xl border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 transition-colors">
                {t('service.deleteJobCard')}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title={t('service.deleteJobCard')}
        message={t('service.confirmDeleteJob')}
        confirmLabel={t('common.delete')}
      />
    </div>
  )
}
