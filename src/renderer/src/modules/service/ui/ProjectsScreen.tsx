import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Briefcase, Plus, RefreshCw, ChevronRight, CheckCircle2, CircleDashed, PauseCircle, XCircle, Receipt } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { api } from '@renderer/services/ipc-client'
import { useNotificationStore } from '@app/store/notification.store'
import { formatCurrency } from '@shared/utils/currency.util'
import { formatDate } from '@shared/utils/locale.util'
import { Badge } from '@shared/ui/atoms/Badge'
import { Tabs } from '@shared/ui/molecules/Tabs'
import { Select } from '@shared/ui/atoms/Select'
import { KpiCard } from '@shared/ui/molecules/KpiCard'
import { ConfirmDialog } from '@shared/ui/molecules/ConfirmDialog'

interface Customer { id: string; customerName: string }
interface User { id: string; fullName: string }
interface Project {
  id: string; projectNumber: string; title: string; description: string | null
  status: string; priority: string; customerId: string | null; customerName: string | null
  assignedToId: string | null; assignedToName: string | null
  estimatedHours: number; estimatedAmount: number; dueDate: string | null
  totalTasks: number; doneTasks: number; totalLoggedHours: number; invoiceId: string | null; createdAt: string
}

const STATUS_TABS = ['ALL', 'OPEN', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED']
const STATUS_LABEL_KEY: Record<string, string> = {
  OPEN: 'service.projectStOpen', IN_PROGRESS: 'service.projectStInProgress',
  ON_HOLD: 'service.projectStOnHold', COMPLETED: 'service.projectStCompleted', CANCELLED: 'service.projectStCancelled'
}
const STATUS_ICON: Record<string, React.ReactNode> = {
  OPEN: <CircleDashed size={13} />, IN_PROGRESS: <RefreshCw size={13} />, ON_HOLD: <PauseCircle size={13} />,
  COMPLETED: <CheckCircle2 size={13} />, CANCELLED: <XCircle size={13} />
}
// Verified exhaustive against project.service.ts's ProjectRecord.status union:
// 'OPEN'|'IN_PROGRESS'|'ON_HOLD'|'COMPLETED'|'CANCELLED'
const STATUS_VARIANT: Record<string, 'info' | 'warning' | 'neutral' | 'success' | 'danger'> = {
  OPEN: 'info', IN_PROGRESS: 'warning', ON_HOLD: 'neutral',
  COMPLETED: 'success', CANCELLED: 'danger'
}
// Verified exhaustive against project.service.ts's ProjectRecord.priority union: 'LOW'|'MEDIUM'|'HIGH'|'URGENT'
const PRIORITY_VARIANT: Record<string, 'neutral' | 'info' | 'warning' | 'danger'> = { LOW: 'neutral', MEDIUM: 'info', HIGH: 'warning', URGENT: 'danger' }

const BLANK_FORM = { title: '', description: '', priority: 'MEDIUM', customerId: '', assignedToId: '', estimatedHours: '', estimatedAmount: '', dueDate: '', notes: '' }

export function ProjectsScreen() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const [projects, setProjects] = useState<Project[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [activeTab, setActiveTab] = useState('ALL')
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ ...BLANK_FORM })
  const [saving, setSaving] = useState(false)
  const [detail, setDetail] = useState<Project | null>(null)
  const [editStatus, setEditStatus] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [generatingInvoice, setGeneratingInvoice] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [pRes, cRes, uRes] = await Promise.all([
        api.projects.list({}),
        api.customers.list({ limit: 500 }),
        api.users.list()
      ])
      if (pRes.success && pRes.data) {
        const d = pRes.data as { projects: Project[] }
        setProjects(d.projects ?? [])
      } else {
        toastError(t('common.error'), pRes.error?.message ?? t('common.error'))
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

  const visible = activeTab === 'ALL' ? projects : projects.filter(p => p.status === activeTab)

  async function handleCreate() {
    if (!form.title.trim()) return
    setSaving(true)
    const res = await api.projects.create({
      title: form.title.trim(),
      description: form.description || undefined,
      priority: form.priority,
      customerId: form.customerId || undefined,
      assignedToId: form.assignedToId || undefined,
      estimatedHours: form.estimatedHours ? Number(form.estimatedHours) : undefined,
      estimatedAmount: form.estimatedAmount ? Number(form.estimatedAmount) : undefined,
      dueDate: form.dueDate || undefined,
      notes: form.notes || undefined,
    })
    setSaving(false)
    if (res.success) {
      toastSuccess(t('service.projectCreated'))
      setShowCreate(false)
      setForm({ ...BLANK_FORM })
      load()
    } else {
      toastError((res.error as any)?.message ?? 'Could not create project')
    }
  }

  async function handleStatusChange(projectId: string, status: string) {
    const res = await api.projects.update({ id: projectId, status })
    if (res.success) {
      toastSuccess(t('service.projectStatusUpdated'))
      setDetail(prev => prev ? { ...prev, status } : prev)
      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, status } : p))
    } else {
      toastError(t('service.couldNotUpdateStatus'))
    }
  }

  async function handleDelete(projectId: string) {
    setDeleting(true)
    const res = await api.projects.delete({ id: projectId })
    setDeleting(false)
    if (res.success) {
      toastSuccess(t('service.projectDeleted'))
      setDetail(null)
      setConfirmDelete(false)
      setProjects(prev => prev.filter(p => p.id !== projectId))
    } else {
      toastError((res.error as any)?.message ?? 'Could not delete project')
    }
  }

  async function handleGenerateInvoice(projectId: string) {
    setGeneratingInvoice(true)
    const res = await api.projects.generateInvoice({ id: projectId })
    setGeneratingInvoice(false)
    if (res.success) {
      const data = res.data as { invoiceId: string }
      toastSuccess('Invoice generated')
      setDetail(prev => prev ? { ...prev, invoiceId: data.invoiceId } : prev)
      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, invoiceId: data.invoiceId } : p))
    } else {
      toastError((res.error as any)?.message ?? 'Could not generate invoice')
    }
  }

  const tabCounts = STATUS_TABS.slice(1).reduce<Record<string, number>>((acc, s) => {
    acc[s] = projects.filter(p => p.status === s).length
    return acc
  }, {})

  return (
    <div className="flex flex-col h-full bg-surface">
      {/* Header */}
      <div className="shrink-0 px-6 pt-6 pb-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
              <Briefcase size={24} className="text-brand" />
              {t('service.projects')}
            </h1>
            <p className="text-sm text-text-secondary mt-0.5">
              {projects.filter(p => p.status === 'IN_PROGRESS').length} {t('manufacturing.statusInProgress').toLowerCase()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="h-11 w-11 flex items-center justify-center rounded-lg border border-border text-text-secondary hover:bg-surface-hover transition-colors">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={() => setShowCreate(true)} className="h-11 px-4 flex items-center gap-2 rounded-lg bg-brand text-white text-sm font-semibold hover:bg-brand-dark transition-colors">
              <Plus size={16} /> {t('service.newProjectModal')}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-4 overflow-x-auto">
          <Tabs
            tabs={STATUS_TABS.map(tab => ({
              id: tab,
              label: tab === 'ALL' ? `${t('common.all')} (${projects.length})` : `${t(STATUS_LABEL_KEY[tab] ?? tab)} (${tabCounts[tab] ?? 0})`
            }))}
            active={activeTab}
            onChange={setActiveTab}
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-text-secondary">
            <Briefcase size={40} className="mb-3 opacity-30" />
            <p className="text-base font-medium">{t('service.noProjects')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {visible.map(p => {
              const pct = p.totalTasks > 0 ? Math.round((p.doneTasks / p.totalTasks) * 100) : 0
              return (
                <button key={p.id} onClick={() => { setDetail(p); setEditStatus(p.status) }}
                  className="w-full text-left bg-white dark:bg-slate-900 rounded-xl border border-border p-4 hover:border-brand/40 hover:shadow-sm transition-all">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs text-text-secondary">{p.projectNumber}</span>
                        <Badge variant={STATUS_VARIANT[p.status] ?? 'neutral'} size="sm" icon={STATUS_ICON[p.status]}>
                          {t(STATUS_LABEL_KEY[p.status] ?? p.status)}
                        </Badge>
                        <Badge variant={PRIORITY_VARIANT[p.priority] ?? 'neutral'} size="sm">{p.priority}</Badge>
                      </div>
                      <p className="mt-1 font-semibold text-text-primary truncate">{p.title}</p>
                      {p.customerName && <p className="text-sm text-text-secondary truncate">{p.customerName}</p>}
                    </div>
                    <ChevronRight size={16} className="text-text-secondary shrink-0 mt-1" />
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-3 text-center">
                    <div>
                      <p className="text-xs text-text-secondary">{t('service.tasksLabel')}</p>
                      <p className="text-sm font-bold text-text-primary">{p.doneTasks}/{p.totalTasks}</p>
                    </div>
                    <div>
                      <p className="text-xs text-text-secondary">{t('service.hoursLogged')}</p>
                      <p className="text-sm font-bold text-text-primary">{p.totalLoggedHours.toFixed(1)}h</p>
                    </div>
                    <div>
                      <p className="text-xs text-text-secondary">{t('service.due')}</p>
                      <p className="text-sm font-bold text-text-primary">
                        {p.dueDate ? formatDate(p.dueDate) : '—'}
                      </p>
                    </div>
                  </div>

                  {p.totalTasks > 0 && (
                    <div className="mt-3">
                      <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-brand rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-xs text-text-secondary mt-1">{pct}%</p>
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
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-auto">
            <div className="px-6 py-5 border-b border-border">
              <h2 className="text-xl font-bold text-text-primary">{t('service.newProjectModal')}</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">{t('service.projectTitleLabel')}</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="" className="w-full h-12 px-4 rounded-xl border border-border text-base focus:outline-none focus:border-brand" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">{t('common.description')}</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={2} placeholder="" className="w-full px-4 py-3 rounded-xl border border-border text-base focus:outline-none focus:border-brand resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Select label={t('service.priority')} value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                    {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map(p => <option key={p} value={p}>{p}</option>)}
                  </Select>
                </div>
                <div>
                  <Select label={t('billing.customer')} value={form.customerId} onChange={e => setForm(f => ({ ...f, customerId: e.target.value }))}>
                    <option value="">{t('service.noCustomer')}</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.customerName}</option>)}
                  </Select>
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">{t('service.estHours')}</label>
                  <input type="number" value={form.estimatedHours} onChange={e => setForm(f => ({ ...f, estimatedHours: e.target.value }))}
                    placeholder="0" min="0" className="w-full h-12 px-4 rounded-xl border border-border text-base focus:outline-none focus:border-brand" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">{t('common.amount')}</label>
                  <input type="number" value={form.estimatedAmount} onChange={e => setForm(f => ({ ...f, estimatedAmount: e.target.value }))}
                    placeholder="0" min="0" className="w-full h-12 px-4 rounded-xl border border-border text-base focus:outline-none focus:border-brand" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">{t('service.due')}</label>
                <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                  className="w-full h-12 px-4 rounded-xl border border-border text-base focus:outline-none focus:border-brand" />
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => { setShowCreate(false); setForm({ ...BLANK_FORM }) }}
                className="flex-1 h-12 rounded-xl border border-border text-text-secondary font-semibold hover:bg-surface-hover transition-colors">{t('common.cancel')}</button>
              <button onClick={handleCreate} disabled={saving || !form.title.trim()}
                className="flex-1 h-12 rounded-xl bg-brand text-white font-semibold hover:bg-brand-dark transition-colors disabled:opacity-50">
                {saving ? t('cashClose.saving') : t('service.newProjectModal')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detail && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-auto">
            <div className="px-6 py-5 border-b border-border flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-mono text-xs text-text-secondary">{detail.projectNumber}</p>
                <h2 className="text-xl font-bold text-text-primary mt-0.5 truncate">{detail.title}</h2>
                {detail.customerName && <p className="text-sm text-text-secondary">{detail.customerName}</p>}
              </div>
              <button onClick={() => setDetail(null)} className="text-text-secondary hover:text-text-primary text-2xl leading-none shrink-0">×</button>
            </div>
            <div className="p-6 space-y-5">
              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                <KpiCard label={t('service.tasksLabel')} value={`${detail.doneTasks}/${detail.totalTasks}`} />
                <KpiCard label={t('service.hoursLogged')} value={`${detail.totalLoggedHours.toFixed(1)}h`} />
                <KpiCard label={t('common.amount')} value={formatCurrency(detail.estimatedAmount)} color="brand" />
              </div>

              {/* Status Change */}
              <div>
                <p className="text-sm font-semibold text-text-primary mb-2">{t('service.changeStatusLabel')}</p>
                <Tabs
                  tabs={['OPEN', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED'].map(s => ({ id: s, label: t(STATUS_LABEL_KEY[s] ?? s) }))}
                  active={editStatus}
                  onChange={(s) => { handleStatusChange(detail.id, s); setEditStatus(s) }}
                  className="flex-wrap"
                />
              </div>

              {/* Info */}
              <div className="space-y-2 text-sm">
                {detail.description && (
                  <div><p className="text-text-secondary">{t('common.description')}</p><p className="text-text-primary mt-0.5">{detail.description}</p></div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-text-secondary">{t('service.priority')}</span>
                  <Badge variant={PRIORITY_VARIANT[detail.priority] ?? 'neutral'} size="sm">{detail.priority}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">{t('service.assignTo')}</span>
                  <span className="text-text-primary font-medium">{detail.assignedToName ?? '—'}</span>
                </div>
                {detail.dueDate && (
                  <div className="flex justify-between">
                    <span className="text-text-secondary">{t('service.due')}</span>
                    <span className="text-text-primary font-medium">{formatDate(detail.dueDate)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-text-secondary">{t('service.estHours')}</span>
                  <span className="text-text-primary font-medium">{detail.estimatedHours}h</span>
                </div>
              </div>

              <button onClick={() => { setDetail(null); navigate(`/service/projects/${detail.id}`) }}
                className="w-full h-11 rounded-xl bg-brand/10 text-brand text-sm font-semibold hover:bg-brand/20 transition-colors">
                {t('service.openProjectDetail')}
              </button>
            </div>
            <div className="px-6 pb-6 space-y-2">
              {detail.customerId && (
                detail.invoiceId ? (
                  <span className="w-full h-11 rounded-xl bg-success/10 text-success text-sm font-semibold flex items-center justify-center gap-2">
                    <Receipt size={14} /> Invoice Generated
                  </span>
                ) : (
                  <button onClick={() => handleGenerateInvoice(detail.id)} disabled={generatingInvoice || detail.estimatedAmount <= 0}
                    className="w-full h-11 rounded-xl border border-brand text-brand text-sm font-semibold hover:bg-brand/5 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                    <Receipt size={14} /> {generatingInvoice ? 'Generating...' : 'Generate Invoice'}
                  </button>
                )
              )}
              <button onClick={() => setConfirmDelete(true)}
                className="w-full h-11 rounded-xl border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 transition-colors">
                {t('service.deleteProject')}
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
        title={t('service.deleteProject')}
        message={t('service.confirmDeleteProject')}
        confirmLabel={t('common.delete')}
      />
    </div>
  )
}
