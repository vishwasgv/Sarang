import React, { useEffect, useState, useCallback } from 'react'
import { AlertCircle, Plus, X, Search, RefreshCw, Edit2, Trash2 } from 'lucide-react'
import { api } from '@renderer/services/ipc-client'
import { cn } from '@shared/utils/cn'
import { Card } from '@shared/ui/molecules/Card'
import { KpiCard } from '@shared/ui/molecules/KpiCard'
import { Badge } from '@shared/ui/atoms/Badge'
import { Select } from '@shared/ui/atoms/Select'
import { useNotificationStore } from '@app/store/notification.store'

interface Sprint {
  id: string
  sprintNumber: number
  name: string | null
}

interface Issue {
  id: string
  projectId: string
  title: string
  description: string | null
  priority: string
  status: string
  assignedToId: string | null
  sprintId: string | null
  reportedDate: string
  resolvedDate: string | null
  assignedTo: { id: string; fullName: string } | null
  sprint: { id: string; sprintNumber: number; name: string | null } | null
  project: { id: string; projectName: string } | null
}

interface ServiceProject { id: string; projectName: string; clientId: string }
interface Employee { id: string; fullName: string }

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'brand'

// Verified exhaustive against prisma/schema.prisma Issue.priority ("HIGH|MED|LOW")
const PRIORITY_VARIANT: Record<string, BadgeVariant> = {
  HIGH: 'danger',
  MED: 'warning',
  LOW: 'info',
}

// Verified exhaustive against prisma/schema.prisma Issue.status ("OPEN|IN_PROGRESS|RESOLVED|CLOSED")
const STATUS_VARIANT: Record<string, BadgeVariant> = {
  OPEN: 'neutral',
  IN_PROGRESS: 'info',
  RESOLVED: 'success',
  CLOSED: 'neutral',
}

const PRIORITIES  = ['HIGH', 'MED', 'LOW']
const ISSUE_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']

export default function IssuesScreen(): React.ReactElement {
  const { error: toastError } = useNotificationStore()
  const [issues, setIssues]           = useState<Issue[]>([])
  const [projects, setProjects]       = useState<ServiceProject[]>([])
  const [employees, setEmployees]     = useState<Employee[]>([])
  const [sprints, setSprints]         = useState<Sprint[]>([])
  const [loading, setLoading]         = useState(false)
  const [search, setSearch]           = useState('')
  const [filterStatus, setFilterStatus]   = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [filterProjectId, setFilterProjectId] = useState('')

  // KPI
  const [kpiIssues, setKpiIssues] = useState<Issue[]>([])

  // Form
  const [showForm, setShowForm]   = useState(false)
  const [editIssue, setEditIssue] = useState<Issue | null>(null)
  const [saving, setSaving]       = useState(false)

  const [fProjectId, setFProjectId]   = useState('')
  const [fTitle, setFTitle]           = useState('')
  const [fDesc, setFDesc]             = useState('')
  const [fPriority, setFPriority]     = useState('MED')
  const [fStatus, setFStatus]         = useState('OPEN')
  const [fAssignedToId, setFAssignedToId] = useState('')
  const [fSprintId, setFSprintId]     = useState('')

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const filters: Record<string, string> = {}
      if (filterStatus) filters.status = filterStatus
      if (filterPriority) filters.priority = filterPriority
      if (filterProjectId) filters.projectId = filterProjectId

      const [issueRes, kpiRes, projRes, empRes] = await Promise.all([
        api.issue.list(Object.keys(filters).length ? filters : undefined),
        api.issue.list(),
        api.serviceProject.list(),
        api.hr.listEmployees(),
      ])
      if (issueRes.success && issueRes.data) setIssues(issueRes.data as Issue[])
      else toastError('Error', issueRes.error?.message ?? 'Could not load issues.')
      if (kpiRes.success && kpiRes.data) setKpiIssues(kpiRes.data as Issue[])
      if (projRes.success && projRes.data) setProjects(projRes.data as ServiceProject[])
      if (empRes.success && empRes.data) {
        const d = empRes.data as { employees?: Employee[] } | Employee[]
        setEmployees(Array.isArray(d) ? d : (d.employees ?? []))
      }
    } catch {
      toastError('Error', 'Could not load issues.')
    } finally {
      setLoading(false)
    }
  }, [filterStatus, filterPriority, filterProjectId, toastError])

  // Load sprints when project changes in form
  const loadSprints = useCallback(async (projectId: string) => {
    if (!projectId) { setSprints([]); return }
    try {
      const res = await api.sprint.list({ projectId })
      if (res.success && res.data) {
        setSprints(res.data as Sprint[])
      } else {
        setSprints([])
        toastError('Error', res.error?.message ?? 'Could not load sprints for this project.')
      }
    } catch {
      setSprints([])
      toastError('Error', 'Could not load sprints for this project.')
    }
  }, [toastError])

  useEffect(() => { loadAll() }, [loadAll])

  function resetForm(): void {
    setFProjectId(''); setFTitle(''); setFDesc(''); setFPriority('MED')
    setFStatus('OPEN'); setFAssignedToId(''); setFSprintId(''); setSprints([])
  }

  function openNew(): void { setEditIssue(null); resetForm(); setShowForm(true) }

  function openEdit(issue: Issue): void {
    setEditIssue(issue)
    setFProjectId(issue.projectId); setFTitle(issue.title)
    setFDesc(issue.description ?? ''); setFPriority(issue.priority)
    setFStatus(issue.status); setFAssignedToId(issue.assignedToId ?? '')
    setFSprintId(issue.sprintId ?? '')
    loadSprints(issue.projectId)
    setShowForm(true)
  }

  async function handleSave(): Promise<void> {
    if (!fProjectId || !fTitle.trim()) return
    setSaving(true)
    try {
      let res
      if (editIssue) {
        res = await api.issue.update({
          id:           editIssue.id,
          title:        fTitle.trim(),
          description:  fDesc || null,
          priority:     fPriority,
          status:       fStatus,
          assignedToId: fAssignedToId || null,
          sprintId:     fSprintId || null,
        })
      } else {
        res = await api.issue.create({
          projectId:    fProjectId,
          title:        fTitle.trim(),
          description:  fDesc || undefined,
          priority:     fPriority,
          status:       fStatus,
          assignedToId: fAssignedToId || undefined,
          sprintId:     fSprintId || undefined,
        })
      }
      if (res.success) { setShowForm(false); resetForm(); loadAll() }
      else toastError('Error', res.error?.message ?? 'Could not save issue.')
    } catch {
      toastError('Error', 'Could not save issue.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string): Promise<void> {
    if (!window.confirm('Delete this issue?')) return
    try {
      const res = await api.issue.delete({ id })
      if (res.success) loadAll()
      else toastError('Error', res.error?.message ?? 'Could not delete issue.')
    } catch {
      toastError('Error', 'Could not delete issue.')
    }
  }

  const displayed = issues.filter((i) => {
    const q = search.toLowerCase()
    return !q || i.title.toLowerCase().includes(q) || (i.description ?? '').toLowerCase().includes(q)
  })

  // KPI
  const kpiOpen       = kpiIssues.filter((i) => i.status === 'OPEN').length
  const kpiInProgress = kpiIssues.filter((i) => i.status === 'IN_PROGRESS').length
  const kpiHigh       = kpiIssues.filter((i) => i.priority === 'HIGH' && !['RESOLVED', 'CLOSED'].includes(i.status)).length

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-slate-950">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-gray-200 px-6 py-4 flex items-center justify-between dark:border-slate-700">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-6 h-6 text-indigo-600" />
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-slate-100">Issues</h1>
            <p className="text-sm text-gray-500 dark:text-slate-400">Track bugs, tasks and sprint backlog</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadAll} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200">
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </button>
          <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium text-sm">
            <Plus className="w-4 h-4" /> New Issue
          </button>
        </div>
      </div>

      {/* KPI Bar */}
      <div className="bg-white dark:bg-slate-900 border-b border-gray-200 px-6 py-3 grid grid-cols-4 gap-4 dark:border-slate-700">
        <KpiCard label="Total Issues" value={kpiIssues.length} color="neutral" />
        <KpiCard label="Open" value={kpiOpen} color="neutral" />
        <KpiCard label="In Progress" value={kpiInProgress} color="info" />
        <KpiCard label="High Priority Open" value={kpiHigh} color="danger" />
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 border-b border-gray-200 px-6 py-3 flex items-center gap-3 flex-wrap dark:border-slate-700">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search issues..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
        </div>
        <select value={filterProjectId} onChange={(e) => setFilterProjectId(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100">
          <option value="">All Projects</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.projectName}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100">
          <option value="">All Statuses</option>
          {ISSUE_STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
        <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100">
          <option value="">All Priorities</option>
          {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-gray-500 text-sm dark:text-slate-400">Loading...</div>
        ) : displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-400 dark:text-slate-500">
            <AlertCircle className="w-8 h-8 mb-2 opacity-40" />
            <p className="text-sm">No issues found</p>
          </div>
        ) : (
          <Card padding="none" className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 dark:bg-slate-950 dark:border-slate-700">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-slate-400">Title</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-slate-400">Project</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-slate-400">Priority</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-slate-400">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-slate-400">Sprint</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-slate-400">Assigned To</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-slate-400">Reported</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {displayed.map((i) => (
                  <tr key={i.id} className="hover:bg-gray-50 dark:hover:bg-slate-800">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 dark:text-slate-100">{i.title}</div>
                      {i.description && <div className="text-xs text-gray-400 truncate max-w-xs dark:text-slate-500">{i.description}</div>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap dark:text-slate-400">{i.project?.projectName ?? '—'}</td>
                    <td className="px-4 py-3">
                      <Badge variant={PRIORITY_VARIANT[i.priority] ?? 'neutral'} size="sm">{i.priority}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_VARIANT[i.status] ?? 'neutral'} size="sm">{i.status.replace('_', ' ')}</Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs dark:text-slate-400">
                      {i.sprint ? `Sprint ${i.sprint.sprintNumber}${i.sprint.name ? ` — ${i.sprint.name}` : ''}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-slate-400">{i.assignedTo?.fullName ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs dark:text-slate-400">{fmtDate(i.reportedDate)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => openEdit(i)} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded dark:text-slate-500">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(i.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded dark:text-slate-500">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700">
              <h2 className="font-semibold text-gray-900 dark:text-slate-100">{editIssue ? 'Edit Issue' : 'New Issue'}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              <Select
                label="Project"
                required
                value={fProjectId}
                onChange={(e) => { setFProjectId(e.target.value); setFSprintId(''); loadSprints(e.target.value) }}
                disabled={!!editIssue}
              >
                <option value="">Select project...</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.projectName}</option>)}
              </Select>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Title *</label>
                <input value={fTitle} onChange={(e) => setFTitle(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Description</label>
                <textarea value={fDesc} onChange={(e) => setFDesc(e.target.value)} rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Select label="Priority" value={fPriority} onChange={(e) => setFPriority(e.target.value)}>
                  {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                </Select>
                <Select label="Status" value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
                  {ISSUE_STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Select label="Assigned To" value={fAssignedToId} onChange={(e) => setFAssignedToId(e.target.value)}>
                  <option value="">Unassigned</option>
                  {employees.map((e) => <option key={e.id} value={e.id}>{e.fullName}</option>)}
                </Select>
                <Select
                  label="Sprint"
                  value={fSprintId}
                  onChange={(e) => setFSprintId(e.target.value)}
                  disabled={!fProjectId || sprints.length === 0}
                >
                  <option value="">No Sprint / Backlog</option>
                  {sprints.map((s) => <option key={s.id} value={s.id}>Sprint {s.sprintNumber}{s.name ? ` — ${s.name}` : ''}</option>)}
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-slate-700">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800">Cancel</button>
              <button onClick={handleSave} disabled={saving || !fProjectId || !fTitle.trim()}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                {saving ? 'Saving...' : editIssue ? 'Update Issue' : 'Create Issue'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
