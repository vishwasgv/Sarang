import React, { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, Clock, CheckCircle2, Circle, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { api } from '@renderer/services/ipc-client'
import { useNotificationStore } from '@app/store/notification.store'
import { cn } from '@shared/utils/cn'
import { formatCurrency } from '@shared/utils/currency.util'
import { formatDate } from '@shared/utils/locale.util'
import { Card } from '@shared/ui/molecules/Card'
import { Badge } from '@shared/ui/atoms/Badge'
import { KpiCard } from '@shared/ui/molecules/KpiCard'
import { Select } from '@shared/ui/atoms/Select'

interface ProjectTask {
  id: string; projectId: string; title: string; description: string | null
  status: string; priority: string; estimatedHours: number; dueDate: string | null; completedAt: string | null
}
interface WorkLog {
  id: string; title: string; hours: number; logDate: string; billable: boolean; userName: string | null
}
interface Project {
  id: string; projectNumber: string; title: string; status: string; customerName: string | null
  estimatedHours: number; estimatedAmount: number; totalLoggedHours: number; totalTasks: number; doneTasks: number
}

// Verified exhaustive against project.service.ts's ProjectTask priority union: 'LOW'|'MEDIUM'|'HIGH'|'URGENT'
const PRIORITY_VARIANT: Record<string, 'neutral' | 'info' | 'warning' | 'danger'> = { LOW: 'neutral', MEDIUM: 'info', HIGH: 'warning', URGENT: 'danger' }

export function ProjectDetailScreen() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { success: toastSuccess, error: toastError } = useNotificationStore()

  const [project, setProject] = useState<Project | null>(null)
  const [tasks, setTasks] = useState<ProjectTask[]>([])
  const [logs, setLogs] = useState<WorkLog[]>([])
  const [loading, setLoading] = useState(true)

  const [showTaskForm, setShowTaskForm] = useState(false)
  const [taskForm, setTaskForm] = useState({ title: '', priority: 'MEDIUM', estimatedHours: '', dueDate: '' })
  const [savingTask, setSavingTask] = useState(false)

  const [showLogForm, setShowLogForm] = useState(false)
  const [logForm, setLogForm] = useState({ title: '', hours: '', description: '', logDate: '', billable: true })
  const [savingLog, setSavingLog] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const [pRes, tRes, lRes] = await Promise.all([
        api.projects.get({ id }),
        api.projects.tasks.list({ projectId: id }),
        api.workLogs.list({ projectId: id, limit: 100 })
      ])
      if (pRes.success && pRes.data) setProject(pRes.data as Project)
      else toastError(t('common.error'), pRes.error?.message ?? t('common.error'))
      if (tRes.success && tRes.data) {
        const d = tRes.data as { tasks: ProjectTask[] }
        setTasks(d.tasks ?? [])
      }
      if (lRes.success && lRes.data) {
        const d = lRes.data as { logs: WorkLog[] }
        setLogs(d.logs ?? [])
      }
    } catch {
      toastError(t('common.error'), t('common.error'))
    } finally {
      setLoading(false)
    }
  }, [id, toastError, t])

  useEffect(() => { load() }, [load])

  async function toggleTask(task: ProjectTask) {
    const newStatus = task.status === 'DONE' ? 'PENDING' : 'DONE'
    try {
      const res = await api.projects.tasks.update({ id: task.id, status: newStatus })
      if (res.success) {
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t))
        if (project) setProject(prev => prev ? {
          ...prev,
          doneTasks: newStatus === 'DONE' ? prev.doneTasks + 1 : prev.doneTasks - 1
        } : prev)
      } else {
        toastError(t('service.couldNotUpdateStatus'))
      }
    } catch {
      toastError(t('service.couldNotUpdateStatus'))
    }
  }

  async function handleAddTask() {
    if (!taskForm.title.trim() || !id) return
    setSavingTask(true)
    const res = await api.projects.tasks.create({
      projectId: id,
      title: taskForm.title.trim(),
      priority: taskForm.priority,
      estimatedHours: taskForm.estimatedHours ? Number(taskForm.estimatedHours) : undefined,
      dueDate: taskForm.dueDate || undefined
    })
    setSavingTask(false)
    if (res.success && res.data) {
      setTasks(prev => [...prev, res.data as ProjectTask])
      if (project) setProject(prev => prev ? { ...prev, totalTasks: prev.totalTasks + 1 } : prev)
      toastSuccess(t('service.taskAdded'))
      setShowTaskForm(false)
      setTaskForm({ title: '', priority: 'MEDIUM', estimatedHours: '', dueDate: '' })
    } else {
      toastError(t('service.couldNotAddTask'))
    }
  }

  async function handleDeleteTask(taskId: string, isDone: boolean) {
    const res = await api.projects.tasks.delete({ id: taskId })
    if (res.success) {
      setTasks(prev => prev.filter(t => t.id !== taskId))
      if (project) setProject(prev => prev ? {
        ...prev,
        totalTasks: prev.totalTasks - 1,
        doneTasks: isDone ? prev.doneTasks - 1 : prev.doneTasks
      } : prev)
    } else {
      toastError(t('service.couldNotDeleteTask'))
    }
  }

  async function handleAddLog() {
    if (!logForm.title.trim() || !logForm.hours || !id) return
    setSavingLog(true)
    const res = await api.workLogs.create({
      projectId: id,
      title: logForm.title.trim(),
      hours: Number(logForm.hours),
      description: logForm.description || undefined,
      logDate: logForm.logDate || undefined,
      billable: logForm.billable
    })
    setSavingLog(false)
    if (res.success && res.data) {
      const newLog = res.data as WorkLog
      setLogs(prev => [newLog, ...prev])
      if (project) setProject(prev => prev ? { ...prev, totalLoggedHours: prev.totalLoggedHours + Number(logForm.hours) } : prev)
      toastSuccess(t('service.workLogged'))
      setShowLogForm(false)
      setLogForm({ title: '', hours: '', description: '', logDate: '', billable: true })
    } else {
      toastError(t('service.couldNotLogWork'))
    }
  }

  async function handleDeleteLog(logId: string, hours: number) {
    try {
      const res = await api.workLogs.delete({ id: logId })
      if (res.success) {
        setLogs(prev => prev.filter(l => l.id !== logId))
        if (project) setProject(prev => prev ? { ...prev, totalLoggedHours: Math.max(0, prev.totalLoggedHours - hours) } : prev)
      } else {
        toastError(t('service.couldNotDeleteLog'))
      }
    } catch {
      toastError(t('service.couldNotDeleteLog'))
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full bg-surface">
      <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!project) return (
    <div className="flex flex-col items-center justify-center h-full bg-surface text-text-secondary">
      <p>{t('common.notFound')}</p>
      <button onClick={() => navigate(-1)} className="mt-3 text-brand underline text-sm">{t('billing.goBack')}</button>
    </div>
  )

  const doneTasks = tasks.filter(t => t.status === 'DONE').length
  const pendingTasks = tasks.filter(t => t.status !== 'DONE')
  const completedTasks = tasks.filter(t => t.status === 'DONE')
  const totalHours = logs.reduce((s, l) => s + l.hours, 0)
  const billableHours = logs.filter(l => l.billable).reduce((s, l) => s + l.hours, 0)

  return (
    <div className="flex flex-col h-full bg-surface">
      {/* Header */}
      <div className="shrink-0 px-6 pt-6 pb-4 border-b border-border">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary mb-3">
          <ArrowLeft size={14} /> {t('service.backToProjects')}
        </button>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="font-mono text-xs text-text-secondary">{project.projectNumber}</p>
            <h1 className="text-2xl font-bold text-text-primary mt-0.5">{project.title}</h1>
            {project.customerName && <p className="text-sm text-text-secondary">{project.customerName}</p>}
          </div>
          <button onClick={load} className="h-10 w-10 flex items-center justify-center rounded-lg border border-border text-text-secondary hover:bg-surface-hover transition-colors">
            <RefreshCw size={15} />
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 mt-4">
          <KpiCard label={t('service.tasksLabel')} value={`${doneTasks}/${tasks.length}`} />
          <KpiCard label={t('service.hoursLogged')} value={`${totalHours.toFixed(1)}h`} />
          <KpiCard label={t('service.billableHours')} value={`${billableHours.toFixed(1)}h`} />
          <KpiCard label={t('common.amount')} value={formatCurrency(project.estimatedAmount)} />
        </div>

        {tasks.length > 0 && (
          <div className="mt-3 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-brand rounded-full transition-all" style={{ width: `${tasks.length > 0 ? Math.round((doneTasks / tasks.length) * 100) : 0}%` }} />
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Tasks */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-text-primary">{t('service.tasksLabel')} ({tasks.length})</h2>
            <button onClick={() => setShowTaskForm(v => !v)}
              className="h-9 px-3 flex items-center gap-1.5 text-sm font-semibold text-brand border border-brand/30 rounded-lg hover:bg-brand/5 transition-colors">
              <Plus size={14} /> {t('service.addTask')}
            </button>
          </div>

          {showTaskForm && (
            <Card padding="md" className="mb-3 space-y-3">
              <input value={taskForm.title} onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))}
                placeholder="" className="w-full h-11 px-4 rounded-xl border border-border text-sm focus:outline-none focus:border-brand" />
              <div className="grid grid-cols-3 gap-2">
                <Select value={taskForm.priority} onChange={e => setTaskForm(f => ({ ...f, priority: e.target.value }))}>
                  {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map(p => <option key={p} value={p}>{p}</option>)}
                </Select>
                <input type="number" value={taskForm.estimatedHours} onChange={e => setTaskForm(f => ({ ...f, estimatedHours: e.target.value }))}
                  placeholder={t('service.estHours')} className="h-11 px-3 rounded-xl border border-border text-sm focus:outline-none focus:border-brand" />
                <input type="date" value={taskForm.dueDate} onChange={e => setTaskForm(f => ({ ...f, dueDate: e.target.value }))}
                  className="h-11 px-3 rounded-xl border border-border text-sm focus:outline-none focus:border-brand" />
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setShowTaskForm(false); setTaskForm({ title: '', priority: 'MEDIUM', estimatedHours: '', dueDate: '' }) }}
                  className="flex-1 h-10 rounded-xl border border-border text-sm text-text-secondary font-semibold hover:bg-surface-hover transition-colors">{t('common.cancel')}</button>
                <button onClick={handleAddTask} disabled={savingTask || !taskForm.title.trim()}
                  className="flex-1 h-10 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand-dark transition-colors disabled:opacity-50">
                  {savingTask ? t('cashClose.saving') : t('service.addTask')}
                </button>
              </div>
            </Card>
          )}

          {tasks.length === 0 ? (
            <div className="border-2 border-dashed border-border rounded-xl p-6 text-center text-text-secondary">
              <p className="text-sm">{t('service.noTasksYet')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {[...pendingTasks, ...completedTasks].map(t => (
                <Card key={t.id} padding="sm" className={cn('flex items-start gap-3', t.status === 'DONE' && 'opacity-75')}>
                  <button onClick={() => toggleTask(t)} className="mt-0.5 shrink-0">
                    {t.status === 'DONE'
                      ? <CheckCircle2 size={18} className="text-green-500" />
                      : <Circle size={18} className="text-slate-300 hover:text-brand transition-colors" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm font-medium text-text-primary', t.status === 'DONE' && 'line-through text-text-secondary')}>{t.title}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <Badge variant={PRIORITY_VARIANT[t.priority] ?? 'neutral'} size="sm">{t.priority}</Badge>
                      {t.estimatedHours > 0 && <span className="text-xs text-text-secondary">{t.estimatedHours}h</span>}
                      {t.dueDate && <span className="text-xs text-text-secondary">{formatDate(t.dueDate)}</span>}
                    </div>
                  </div>
                  <button onClick={() => handleDeleteTask(t.id, t.status === 'DONE')} className="text-text-secondary hover:text-red-500 transition-colors shrink-0">
                    <Trash2 size={14} />
                  </button>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Work Logs */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-text-primary">{t('service.workLogLabel')} ({totalHours.toFixed(1)}h)</h2>
            <button onClick={() => setShowLogForm(v => !v)}
              className="h-9 px-3 flex items-center gap-1.5 text-sm font-semibold text-brand border border-brand/30 rounded-lg hover:bg-brand/5 transition-colors">
              <Clock size={14} /> {t('service.logTime')}
            </button>
          </div>

          {showLogForm && (
            <Card padding="md" className="mb-3 space-y-3">
              <input value={logForm.title} onChange={e => setLogForm(f => ({ ...f, title: e.target.value }))}
                placeholder="" className="w-full h-11 px-4 rounded-xl border border-border text-sm focus:outline-none focus:border-brand" />
              <div className="grid grid-cols-2 gap-2">
                <input type="number" step="0.5" value={logForm.hours} onChange={e => setLogForm(f => ({ ...f, hours: e.target.value }))}
                  placeholder={t('service.totalHours')} className="h-11 px-3 rounded-xl border border-border text-sm focus:outline-none focus:border-brand" />
                <input type="date" value={logForm.logDate} onChange={e => setLogForm(f => ({ ...f, logDate: e.target.value }))}
                  className="h-11 px-3 rounded-xl border border-border text-sm focus:outline-none focus:border-brand" />
              </div>
              <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
                <input type="checkbox" checked={logForm.billable} onChange={e => setLogForm(f => ({ ...f, billable: e.target.checked }))} className="w-4 h-4 accent-brand" />
                {t('service.billable')}
              </label>
              <div className="flex gap-2">
                <button onClick={() => { setShowLogForm(false); setLogForm({ title: '', hours: '', description: '', logDate: '', billable: true }) }}
                  className="flex-1 h-10 rounded-xl border border-border text-sm text-text-secondary font-semibold hover:bg-surface-hover transition-colors">{t('common.cancel')}</button>
                <button onClick={handleAddLog} disabled={savingLog || !logForm.title.trim() || !logForm.hours}
                  className="flex-1 h-10 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand-dark transition-colors disabled:opacity-50">
                  {savingLog ? t('cashClose.saving') : t('service.logTime')}
                </button>
              </div>
            </Card>
          )}

          {logs.length === 0 ? (
            <div className="border-2 border-dashed border-border rounded-xl p-6 text-center text-text-secondary">
              <p className="text-sm">{t('service.noLogsYet')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map(l => (
                <Card key={l.id} padding="sm" className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-brand/10 rounded-lg flex items-center justify-center shrink-0">
                    <Clock size={16} className="text-brand" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{l.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-text-secondary">{formatDate(l.logDate)}</span>
                      {l.userName && <span className="text-xs text-text-secondary">· {l.userName}</span>}
                      {!l.billable && <span className="text-xs text-slate-400">{t('service.nonBillable')}</span>}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold text-text-primary">{l.hours}h</p>
                    <button onClick={() => handleDeleteLog(l.id, l.hours)} className="text-text-secondary hover:text-red-500 transition-colors mt-0.5">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
