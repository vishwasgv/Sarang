import React, { useEffect, useState, useCallback } from 'react'
import { Clock, Plus, RefreshCw, Trash2, TrendingUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { api } from '@renderer/services/ipc-client'
import { useNotificationStore } from '@app/store/notification.store'
import { cn } from '@shared/utils/cn'
import { formatDate } from '@shared/utils/locale.util'
import { Card } from '@shared/ui/molecules/Card'
import { KpiCard } from '@shared/ui/molecules/KpiCard'
import { Tabs } from '@shared/ui/molecules/Tabs'
import { Select } from '@shared/ui/atoms/Select'

interface Project { id: string; projectNumber: string; title: string }
interface Ticket { id: string; ticketNumber: string; title: string }
interface JobCard { id: string; jobNumber: string; title: string }
interface WorkLog {
  id: string; title: string; hours: number; logDate: string; billable: boolean
  userName: string | null; projectId: string | null; ticketId: string | null; jobCardId: string | null
}

export function WorkTrackingScreen() {
  const { t } = useTranslation()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const [logs, setLogs] = useState<WorkLog[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [jobCards, setJobCards] = useState<JobCard[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    entityType: 'project' as 'project' | 'ticket' | 'jobCard',
    projectId: '', ticketId: '', jobCardId: '',
    title: '', description: '', hours: '', logDate: '', billable: true
  })
  const [saving, setSaving] = useState(false)
  const [filterBillable, setFilterBillable] = useState<'all' | 'billable' | 'non-billable'>('all')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [lRes, pRes, tRes, jRes] = await Promise.all([
        api.workLogs.list({ limit: 200 }),
        api.projects.list({ limit: 200 }),
        api.tickets.list({ limit: 200 }),
        api.jobCards.list({ limit: 200 })
      ])
      if (lRes.success && lRes.data) {
        const d = lRes.data as { logs: WorkLog[] }
        setLogs(d.logs ?? [])
      } else {
        toastError(t('common.error'), lRes.error?.message ?? t('common.error'))
      }
      if (pRes.success && pRes.data) {
        const d = pRes.data as { projects: Project[] }
        setProjects(d.projects ?? [])
      }
      if (tRes.success && tRes.data) {
        const d = tRes.data as { tickets: Ticket[] }
        setTickets(d.tickets ?? [])
      }
      if (jRes.success && jRes.data) {
        const d = jRes.data as { jobCards: JobCard[] }
        setJobCards(d.jobCards ?? [])
      }
    } catch {
      toastError(t('common.error'), t('common.error'))
    } finally {
      setLoading(false)
    }
  }, [toastError, t])

  useEffect(() => { load() }, [load])

  async function handleCreate() {
    const hours = Number(form.hours)
    if (!form.title.trim() || !hours) return
    const entityId = form.entityType === 'project' ? form.projectId : form.entityType === 'ticket' ? form.ticketId : form.jobCardId
    if (!entityId) { toastError(t('service.selectEntity')); return }

    setSaving(true)
    const payload: Record<string, unknown> = {
      title: form.title.trim(),
      hours,
      billable: form.billable,
      logDate: form.logDate || undefined,
      description: form.description || undefined
    }
    if (form.entityType === 'project') payload.projectId = form.projectId
    if (form.entityType === 'ticket') payload.ticketId = form.ticketId
    if (form.entityType === 'jobCard') payload.jobCardId = form.jobCardId

    const res = await api.workLogs.create(payload as any)
    setSaving(false)
    if (res.success) {
      toastSuccess(t('service.workLogged'))
      setShowForm(false)
      setForm({ entityType: 'project', projectId: '', ticketId: '', jobCardId: '', title: '', description: '', hours: '', logDate: '', billable: true })
      load()
    } else {
      toastError((res.error as any)?.message ?? t('service.couldNotLogWork'))
    }
  }

  async function handleDelete(logId: string) {
    const res = await api.workLogs.delete({ id: logId })
    if (res.success) {
      setLogs(prev => prev.filter(l => l.id !== logId))
    } else {
      toastError(t('service.couldNotDeleteLog'))
    }
  }

  const filteredLogs = filterBillable === 'all' ? logs
    : filterBillable === 'billable' ? logs.filter(l => l.billable)
      : logs.filter(l => !l.billable)

  const totalHours = logs.reduce((s, l) => s + l.hours, 0)
  const billableHours = logs.filter(l => l.billable).reduce((s, l) => s + l.hours, 0)
  const nonBillableHours = logs.filter(l => !l.billable).reduce((s, l) => s + l.hours, 0)

  function getEntityLabel(log: WorkLog): string {
    if (log.projectId) {
      const p = projects.find(p => p.id === log.projectId)
      return p ? `${p.projectNumber} — ${p.title}` : t('service.projects')
    }
    if (log.ticketId) {
      const ticket = tickets.find(t => t.id === log.ticketId)
      return ticket ? `${ticket.ticketNumber} — ${ticket.title}` : t('service.tickets')
    }
    if (log.jobCardId) {
      const j = jobCards.find(j => j.id === log.jobCardId)
      return j ? `${j.jobNumber} — ${j.title}` : t('service.jobCards')
    }
    return '—'
  }

  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="shrink-0 px-6 pt-6 pb-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
              <Clock size={24} className="text-brand" />
              {t('service.workTracking')}
            </h1>
            <p className="text-sm text-text-secondary mt-0.5">{t('service.workTrackingSubtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="h-11 w-11 flex items-center justify-center rounded-lg border border-border text-text-secondary hover:bg-surface-hover transition-colors">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={() => setShowForm(true)} className="h-11 px-4 flex items-center gap-2 rounded-lg bg-brand text-white text-sm font-semibold hover:bg-brand-dark transition-colors">
              <Plus size={16} /> {t('service.logTime')}
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-5">
        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4">
          <KpiCard label={t('service.totalHours')} value={`${totalHours.toFixed(1)}h`} />
          <KpiCard label={t('service.billable')} value={`${billableHours.toFixed(1)}h`} color="success" />
          <KpiCard label={t('service.nonBillable')} value={`${nonBillableHours.toFixed(1)}h`} color="neutral" />
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2">
          <Tabs
            tabs={(['all', 'billable', 'non-billable'] as const).map(f => ({
              id: f,
              label: f === 'all' ? t('common.all') : f === 'billable' ? t('service.billable') : t('service.nonBillable')
            }))}
            active={filterBillable}
            onChange={setFilterBillable}
          />
          <span className="ml-auto text-sm text-text-secondary self-center">{filteredLogs.length} {t('service.entries')}</span>
        </div>

        {/* Log list */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-text-secondary border-2 border-dashed border-border rounded-xl">
            <TrendingUp size={36} className="mb-3 opacity-30" />
            <p className="text-base font-medium">{t('service.noLogsYet')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredLogs.map(l => (
              <Card key={l.id} padding="md" className="flex items-start gap-3">
                <div className="w-10 h-10 bg-brand/10 rounded-lg flex items-center justify-center shrink-0">
                  <Clock size={16} className="text-brand" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-text-primary text-sm">{l.title}</p>
                  <p className="text-xs text-text-secondary truncate mt-0.5">{getEntityLabel(l)}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-text-secondary">{formatDate(l.logDate)}</span>
                    {l.userName && <span className="text-xs text-text-secondary">{l.userName}</span>}
                    <span className={cn('text-xs font-semibold', l.billable ? 'text-green-600' : 'text-slate-400')}>
                      {l.billable ? t('service.billable') : t('service.nonBillable')}
                    </span>
                  </div>
                </div>
                <div className="shrink-0 text-right flex flex-col items-end gap-1">
                  <p className="text-base font-bold text-text-primary">{l.hours}h</p>
                  <button onClick={() => handleDelete(l.id)} className="text-text-secondary hover:text-red-500 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Log Work Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-auto">
            <div className="px-6 py-5 border-b border-border">
              <h2 className="text-xl font-bold text-text-primary">{t('service.logWorkHours')}</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">{t('service.linkTo')}</label>
                <div className="flex gap-2">
                  {(['project', 'ticket', 'jobCard'] as const).map(type => (
                    <button key={type} onClick={() => setForm(f => ({ ...f, entityType: type }))}
                      className={cn('flex-1 h-10 rounded-xl text-sm font-semibold border transition-colors',
                        form.entityType === type ? 'bg-brand text-white border-brand' : 'border-border text-text-secondary hover:border-brand hover:text-brand')}>
                      {type === 'project' ? t('service.projects') : type === 'ticket' ? t('service.tickets') : t('service.jobCards')}
                    </button>
                  ))}
                </div>
              </div>

              {form.entityType === 'project' && (
                <Select required value={form.projectId} onChange={e => setForm(f => ({ ...f, projectId: e.target.value }))}>
                  <option value="">{t('common.select')}…</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.projectNumber} — {p.title}</option>)}
                </Select>
              )}
              {form.entityType === 'ticket' && (
                <Select required value={form.ticketId} onChange={e => setForm(f => ({ ...f, ticketId: e.target.value }))}>
                  <option value="">{t('common.select')}…</option>
                  {tickets.map(t => <option key={t.id} value={t.id}>{t.ticketNumber} — {t.title}</option>)}
                </Select>
              )}
              {form.entityType === 'jobCard' && (
                <Select required value={form.jobCardId} onChange={e => setForm(f => ({ ...f, jobCardId: e.target.value }))}>
                  <option value="">{t('common.select')}…</option>
                  {jobCards.map(j => <option key={j.id} value={j.id}>{j.jobNumber} — {j.title}</option>)}
                </Select>
              )}

              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">{t('common.description')} *</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="" className="w-full h-12 px-4 rounded-xl border border-border text-base focus:outline-none focus:border-brand" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">{t('service.totalHours')} *</label>
                  <input type="number" step="0.5" min="0.5" value={form.hours} onChange={e => setForm(f => ({ ...f, hours: e.target.value }))}
                    placeholder="0" className="w-full h-12 px-4 rounded-xl border border-border text-base focus:outline-none focus:border-brand" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">{t('common.date')}</label>
                  <input type="date" value={form.logDate} onChange={e => setForm(f => ({ ...f, logDate: e.target.value }))}
                    className="w-full h-12 px-4 rounded-xl border border-border text-base focus:outline-none focus:border-brand" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
                <input type="checkbox" checked={form.billable} onChange={e => setForm(f => ({ ...f, billable: e.target.checked }))} className="w-4 h-4 accent-brand" />
                {t('service.billableHours')}
              </label>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => setShowForm(false)}
                className="flex-1 h-12 rounded-xl border border-border text-text-secondary font-semibold hover:bg-surface-hover transition-colors">{t('common.cancel')}</button>
              <button onClick={handleCreate} disabled={saving || !form.title.trim() || !form.hours}
                className="flex-1 h-12 rounded-xl bg-brand text-white font-semibold hover:bg-brand-dark transition-colors disabled:opacity-50">
                {saving ? t('cashClose.saving') : t('service.logTime')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
