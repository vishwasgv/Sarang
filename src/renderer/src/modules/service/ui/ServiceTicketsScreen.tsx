import React, { useEffect, useState, useCallback } from 'react'
import { Headphones, Plus, RefreshCw, AlertCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { api } from '@renderer/services/ipc-client'
import { useNotificationStore } from '@app/store/notification.store'
import { cn } from '@shared/utils/cn'
import { formatDate } from '@shared/utils/locale.util'
import { Badge } from '@shared/ui/atoms/Badge'
import { Tabs } from '@shared/ui/molecules/Tabs'
import { Select } from '@shared/ui/atoms/Select'
import { ConfirmDialog } from '@shared/ui/molecules/ConfirmDialog'

interface Customer { id: string; customerName: string }
interface User { id: string; fullName: string }
interface Ticket {
  id: string; ticketNumber: string; title: string; description: string | null
  status: string; priority: string; category: string | null
  customerId: string | null; customerName: string | null
  assignedToId: string | null; assignedToName: string | null
  resolvedAt: string | null; closedAt: string | null; resolution: string | null
  createdAt: string
}

const STATUS_TABS = ['ALL', 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']
const STATUS_LABEL_KEY: Record<string, string> = {
  OPEN: 'service.ticketStOpen', IN_PROGRESS: 'service.ticketStInProgress',
  RESOLVED: 'service.ticketStResolved', CLOSED: 'service.ticketStClosed'
}
// Verified exhaustive against service-ticket.service.ts's status union: 'OPEN'|'IN_PROGRESS'|'RESOLVED'|'CLOSED'
const STATUS_VARIANT: Record<string, 'info' | 'warning' | 'success' | 'neutral'> = {
  OPEN: 'info', IN_PROGRESS: 'warning',
  RESOLVED: 'success', CLOSED: 'neutral'
}
const PRIORITY_VARIANT: Record<string, 'neutral' | 'warning' | 'danger'> = {
  LOW: 'neutral', MEDIUM: 'warning',
  HIGH: 'warning', URGENT: 'danger'
}
const STATUS_ACTIONS: Record<string, string[]> = {
  OPEN: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
  IN_PROGRESS: ['RESOLVED', 'CLOSED'],
  RESOLVED: ['CLOSED'],
  CLOSED: []
}

const BLANK_FORM = { title: '', description: '', priority: 'MEDIUM', category: '', customerId: '', assignedToId: '' }

export function ServiceTicketsScreen() {
  const { t } = useTranslation()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [activeTab, setActiveTab] = useState('ALL')
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ ...BLANK_FORM })
  const [saving, setSaving] = useState(false)
  const [detail, setDetail] = useState<Ticket | null>(null)
  const [resolution, setResolution] = useState('')
  const [savingRes, setSavingRes] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [tRes, cRes, uRes] = await Promise.all([
        api.tickets.list({}),
        api.customers.list({ limit: 500 }),
        api.users.list()
      ])
      if (tRes.success && tRes.data) {
        const d = tRes.data as { tickets: Ticket[] }
        setTickets(d.tickets ?? [])
      } else {
        toastError(t('common.error'), tRes.error?.message ?? t('common.error'))
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

  const visible = activeTab === 'ALL' ? tickets : tickets.filter(t => t.status === activeTab)

  const tabCounts = STATUS_TABS.slice(1).reduce<Record<string, number>>((acc, s) => {
    acc[s] = tickets.filter(t => t.status === s).length
    return acc
  }, {})

  async function handleCreate() {
    if (!form.title.trim()) return
    setSaving(true)
    const res = await api.tickets.create({
      title: form.title.trim(),
      description: form.description || undefined,
      priority: form.priority,
      category: form.category || undefined,
      customerId: form.customerId || undefined,
      assignedToId: form.assignedToId || undefined
    })
    setSaving(false)
    if (res.success) {
      toastSuccess(t('service.ticketCreated'))
      setShowCreate(false)
      setForm({ ...BLANK_FORM })
      load()
    } else {
      toastError((res.error as any)?.message ?? 'Could not create ticket')
    }
  }

  async function handleStatusChange(ticketId: string, status: string) {
    const payload: Record<string, unknown> = { id: ticketId, status }
    if (status === 'RESOLVED' && resolution.trim()) payload.resolution = resolution.trim()

    setSavingRes(true)
    const res = await api.tickets.update(payload as any)
    setSavingRes(false)
    if (res.success) {
      toastSuccess(t('service.ticketUpdated'))
      setDetail(prev => prev ? { ...prev, status, resolution: payload.resolution as string ?? prev.resolution } : prev)
      setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status } : t))
      setResolution('')
    } else {
      toastError(t('service.couldNotUpdateTicket'))
    }
  }

  async function handleDelete(ticketId: string) {
    setDeleting(true)
    const res = await api.tickets.delete({ id: ticketId })
    setDeleting(false)
    if (res.success) {
      toastSuccess(t('service.ticketDeleted'))
      setDetail(null)
      setConfirmDelete(false)
      setTickets(prev => prev.filter(t => t.id !== ticketId))
    } else {
      toastError((res.error as any)?.message ?? 'Could not delete ticket')
    }
  }

  const urgentOpen = tickets.filter(t => t.priority === 'URGENT' && t.status !== 'RESOLVED' && t.status !== 'CLOSED').length
  const activeCount = tickets.filter(t => t.status === 'OPEN' || t.status === 'IN_PROGRESS').length

  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="shrink-0 px-6 pt-6 pb-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
              <Headphones size={24} className="text-brand" />
              {t('service.tickets')}
            </h1>
            <p className="text-sm text-text-secondary mt-0.5">
              {urgentOpen > 0 ? (
                <span className="text-red-600 font-semibold">{urgentOpen} {t('service.urgentOpen')}</span>
              ) : `${activeCount} ${t('service.activeTickets')}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="h-11 w-11 flex items-center justify-center rounded-lg border border-border text-text-secondary hover:bg-surface-hover transition-colors">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={() => setShowCreate(true)} className="h-11 px-4 flex items-center gap-2 rounded-lg bg-brand text-white text-sm font-semibold hover:bg-brand-dark transition-colors">
              <Plus size={16} /> {t('service.newServiceTicket')}
            </button>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <Tabs
            tabs={STATUS_TABS.map(tab => ({
              id: tab,
              label: tab === 'ALL' ? `${t('common.all')} (${tickets.length})` : `${t(STATUS_LABEL_KEY[tab] ?? tab)} (${tabCounts[tab] ?? 0})`
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
            <Headphones size={40} className="mb-3 opacity-30" />
            <p className="text-base font-medium">{t('service.noTickets')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {visible.map(ticket => (
              <button key={ticket.id} onClick={() => { setDetail(ticket); setResolution('') }}
                className="w-full text-left bg-white dark:bg-slate-900 rounded-xl border border-border p-4 hover:border-brand/40 hover:shadow-sm transition-all">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs text-text-secondary">{ticket.ticketNumber}</span>
                      <Badge variant={STATUS_VARIANT[ticket.status] ?? 'neutral'} size="sm">{t(STATUS_LABEL_KEY[ticket.status] ?? ticket.status)}</Badge>
                      <Badge variant={PRIORITY_VARIANT[ticket.priority] ?? 'neutral'} size="sm">{ticket.priority}</Badge>
                      {ticket.category && <span className="text-xs text-text-secondary border border-border rounded-full px-2 py-0.5">{ticket.category}</span>}
                    </div>
                    <p className="mt-1 font-semibold text-text-primary">{ticket.title}</p>
                    <div className="flex items-center gap-3 mt-1">
                      {ticket.customerName && <span className="text-xs text-text-secondary">{ticket.customerName}</span>}
                      <span className="text-xs text-text-secondary">{formatDate(ticket.createdAt)}</span>
                    </div>
                  </div>
                  {ticket.priority === 'URGENT' && ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED' && (
                    <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-auto">
            <div className="px-6 py-5 border-b border-border">
              <h2 className="text-xl font-bold text-text-primary">{t('service.newServiceTicket')}</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">{t('service.titleLabel')}</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="" className="w-full h-12 px-4 rounded-xl border border-border text-base focus:outline-none focus:border-brand" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">{t('common.description')}</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={3} placeholder="" className="w-full px-4 py-3 rounded-xl border border-border text-base focus:outline-none focus:border-brand resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Select label={t('service.priority')} value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                    {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map(p => <option key={p} value={p}>{p}</option>)}
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">{t('service.categoryLabel')}</label>
                  <input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    placeholder="" className="w-full h-12 px-4 rounded-xl border border-border text-base focus:outline-none focus:border-brand" />
                </div>
              </div>
              <div>
                <Select label={t('billing.customer')} value={form.customerId} onChange={e => setForm(f => ({ ...f, customerId: e.target.value }))}>
                  <option value="">{t('service.noCustomer')}</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.customerName}</option>)}
                </Select>
              </div>
              {users.length > 0 && (
                <div>
                  <Select label={t('service.assignTo')} value={form.assignedToId} onChange={e => setForm(f => ({ ...f, assignedToId: e.target.value }))}>
                    <option value="">{t('service.unassigned')}</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
                  </Select>
                </div>
              )}
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => { setShowCreate(false); setForm({ ...BLANK_FORM }) }}
                className="flex-1 h-12 rounded-xl border border-border text-text-secondary font-semibold hover:bg-surface-hover transition-colors">{t('common.cancel')}</button>
              <button onClick={handleCreate} disabled={saving || !form.title.trim()}
                className="flex-1 h-12 rounded-xl bg-brand text-white font-semibold hover:bg-brand-dark transition-colors disabled:opacity-50">
                {saving ? t('cashClose.saving') : t('service.createTicket')}
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
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs text-text-secondary">{detail.ticketNumber}</span>
                  <Badge variant={STATUS_VARIANT[detail.status] ?? 'neutral'} size="sm">{t(STATUS_LABEL_KEY[detail.status] ?? detail.status)}</Badge>
                  <Badge variant={PRIORITY_VARIANT[detail.priority] ?? 'neutral'} size="sm">{detail.priority}</Badge>
                </div>
                <h2 className="text-lg font-bold text-text-primary mt-1">{detail.title}</h2>
              </div>
              <button onClick={() => setDetail(null)} className="text-text-secondary hover:text-text-primary text-2xl leading-none shrink-0">×</button>
            </div>
            <div className="p-6 space-y-4">
              {detail.description && <p className="text-sm text-text-secondary">{detail.description}</p>}

              <div className="space-y-2 text-sm">
                {detail.customerName && (
                  <div className="flex justify-between"><span className="text-text-secondary">{t('billing.customer')}</span><span className="text-text-primary font-medium">{detail.customerName}</span></div>
                )}
                {detail.category && (
                  <div className="flex justify-between"><span className="text-text-secondary">{t('service.category')}</span><span className="text-text-primary font-medium">{detail.category}</span></div>
                )}
                <div className="flex justify-between">
                  <span className="text-text-secondary">{t('service.assignTo')}</span>
                  <span className="text-text-primary font-medium">{detail.assignedToName ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">{t('service.createdLabel')}</span>
                  <span className="text-text-primary font-medium">{formatDate(detail.createdAt)}</span>
                </div>
                {detail.resolvedAt && (
                  <div className="flex justify-between"><span className="text-text-secondary">{t('service.resolvedLabel')}</span><span className="text-green-600 font-medium">{formatDate(detail.resolvedAt)}</span></div>
                )}
                {detail.resolution && (
                  <div>
                    <p className="text-text-secondary">{t('service.resolutionLabel')}</p>
                    <p className="text-text-primary mt-0.5">{detail.resolution}</p>
                  </div>
                )}
              </div>

              {(STATUS_ACTIONS[detail.status] ?? []).length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-text-primary mb-2">{t('service.updateStatusLabel')}</p>
                  {detail.status !== 'RESOLVED' && (
                    <textarea value={resolution} onChange={e => setResolution(e.target.value)}
                      placeholder="" rows={2}
                      className="w-full px-4 py-3 rounded-xl border border-border text-sm focus:outline-none focus:border-brand resize-none mb-2" />
                  )}
                  <div className="flex flex-wrap gap-2">
                    {(STATUS_ACTIONS[detail.status] ?? []).map(s => (
                      <button key={s} onClick={() => handleStatusChange(detail.id, s)} disabled={savingRes}
                        className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border',
                          s === 'RESOLVED' ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100'
                            : s === 'CLOSED' ? 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                              : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100')}>
                        {t(STATUS_LABEL_KEY[s] ?? s)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="px-6 pb-6">
              <button onClick={() => setConfirmDelete(true)}
                className="w-full h-11 rounded-xl border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 transition-colors">
                {t('service.deleteTicket')}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => detail && handleDelete(detail.id)}
        loading={deleting}
        title={t('service.deleteTicket')}
        message={t('service.confirmDeleteTicket')}
        confirmLabel={t('common.delete')}
      />
    </div>
  )
}
