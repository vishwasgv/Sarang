import React, { useEffect, useState, useCallback } from 'react'
import { AlertCircle, Plus, X, Search, RefreshCw, Edit2, Trash2, List, LayoutGrid, MessageSquare, CheckSquare2, Send } from 'lucide-react'
import { api } from '@renderer/services/ipc-client'
import { cn } from '@shared/utils/cn'
import { Card } from '@shared/ui/molecules/Card'
import { KpiCard } from '@shared/ui/molecules/KpiCard'
import { Badge } from '@shared/ui/atoms/Badge'
import { Select } from '@shared/ui/atoms/Select'
import { ConfirmDialog } from '@shared/ui/molecules/ConfirmDialog'
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
  storyPoints: number | null
  reportedDate: string
  resolvedDate: string | null
  assignedTo: { id: string; fullName: string } | null
  sprint: { id: string; sprintNumber: number; name: string | null } | null
  project: { id: string; projectName: string } | null
}

interface IssueComment {
  id: string
  issueId: string
  body: string
  createdAt: string
  author: { id: string; fullName: string } | null
}

interface IssueSubtask {
  id: string
  issueId: string
  title: string
  isDone: boolean
}

interface ServiceProject { id: string; projectName: string; clientId: string }
interface Employee { id: string; fullName: string }

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
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

const STATUS_COLUMN_COLORS: Record<string, string> = {
  OPEN:        'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/40',
  IN_PROGRESS: 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20',
  RESOLVED:    'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20',
  CLOSED:      'border-gray-300 bg-gray-100 dark:border-slate-600 dark:bg-slate-800',
}

const STATUS_HEADER_COLORS: Record<string, string> = {
  OPEN:        'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200',
  IN_PROGRESS: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  RESOLVED:    'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  CLOSED:      'bg-gray-200 text-gray-700 dark:bg-slate-700 dark:text-slate-300',
}

const PRIORITY_CARD_BORDER: Record<string, string> = {
  HIGH: 'border-l-4 border-l-red-500',
  MED:  'border-l-4 border-l-amber-500',
  LOW:  'border-l-4 border-l-blue-400',
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
  const [viewMode, setViewMode] = useState<'list' | 'board'>('list')

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
  const [fStoryPoints, setFStoryPoints] = useState('')

  const [deleteTarget, setDeleteTarget] = useState<Issue | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Kanban drag state
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverCol, setDragOverCol] = useState<string | null>(null)

  // Issue detail modal (comments + subtasks)
  const [detailIssue, setDetailIssue] = useState<Issue | null>(null)
  const [comments, setComments] = useState<IssueComment[]>([])
  const [subtasks, setSubtasks] = useState<IssueSubtask[]>([])
  const [newComment, setNewComment] = useState('')
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('')
  const [commentSaving, setCommentSaving] = useState(false)
  const [subtaskSaving, setSubtaskSaving] = useState(false)

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
    setFStatus('OPEN'); setFAssignedToId(''); setFSprintId(''); setFStoryPoints(''); setSprints([])
  }

  function openNew(): void { setEditIssue(null); resetForm(); setShowForm(true) }

  function openEdit(issue: Issue): void {
    setEditIssue(issue)
    setFProjectId(issue.projectId); setFTitle(issue.title)
    setFDesc(issue.description ?? ''); setFPriority(issue.priority)
    setFStatus(issue.status); setFAssignedToId(issue.assignedToId ?? '')
    setFSprintId(issue.sprintId ?? ''); setFStoryPoints(issue.storyPoints != null ? String(issue.storyPoints) : '')
    loadSprints(issue.projectId)
    setShowForm(true)
  }

  async function handleSave(): Promise<void> {
    if (!fProjectId || !fTitle.trim()) return
    setSaving(true)
    try {
      let res
      const storyPoints = fStoryPoints.trim() ? Number(fStoryPoints) : null
      if (editIssue) {
        res = await api.issue.update({
          id:           editIssue.id,
          title:        fTitle.trim(),
          description:  fDesc || null,
          priority:     fPriority,
          status:       fStatus,
          assignedToId: fAssignedToId || null,
          sprintId:     fSprintId || null,
          storyPoints,
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
          storyPoints:  storyPoints ?? undefined,
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

  async function handleDelete(): Promise<void> {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await api.issue.delete({ id: deleteTarget.id })
      if (res.success) { setDeleteTarget(null); loadAll() }
      else toastError('Error', res.error?.message ?? 'Could not delete issue.')
    } catch {
      toastError('Error', 'Could not delete issue.')
    } finally {
      setDeleting(false)
    }
  }

  // Move an issue to a new status column via drag-and-drop (Kanban board)
  async function handleDrop(newStatus: string): Promise<void> {
    if (!draggingId) return
    const issue = issues.find((i) => i.id === draggingId)
    if (!issue || issue.status === newStatus) { setDraggingId(null); setDragOverCol(null); return }
    setDraggingId(null); setDragOverCol(null)
    const res = await api.issue.update({ id: issue.id, status: newStatus })
    if (!res.success) toastError('Error', res.error?.message ?? 'Could not move issue.')
    void loadAll()
  }

  // ── Issue detail modal (comments + subtasks) ────────────────────────────────

  async function openDetail(issue: Issue): Promise<void> {
    setDetailIssue(issue)
    setNewComment(''); setNewSubtaskTitle('')
    const [cRes, sRes] = await Promise.all([
      api.issueComment.list({ issueId: issue.id }),
      api.issueSubtask.list({ issueId: issue.id }),
    ])
    setComments(cRes.success && cRes.data ? (cRes.data as IssueComment[]) : [])
    setSubtasks(sRes.success && sRes.data ? (sRes.data as IssueSubtask[]) : [])
  }

  async function handleAddComment(): Promise<void> {
    if (!detailIssue || !newComment.trim()) return
    setCommentSaving(true)
    try {
      const res = await api.issueComment.add({ issueId: detailIssue.id, body: newComment.trim() })
      if (res.success) {
        setNewComment('')
        const cRes = await api.issueComment.list({ issueId: detailIssue.id })
        setComments(cRes.success && cRes.data ? (cRes.data as IssueComment[]) : [])
      } else toastError('Error', res.error?.message ?? 'Could not add comment.')
    } finally {
      setCommentSaving(false)
    }
  }

  async function handleDeleteComment(id: string): Promise<void> {
    if (!detailIssue) return
    const res = await api.issueComment.delete({ id })
    if (res.success) setComments((prev) => prev.filter((c) => c.id !== id))
    else toastError('Error', res.error?.message ?? 'Could not delete comment.')
  }

  async function handleAddSubtask(): Promise<void> {
    if (!detailIssue || !newSubtaskTitle.trim()) return
    setSubtaskSaving(true)
    try {
      const res = await api.issueSubtask.create({ issueId: detailIssue.id, title: newSubtaskTitle.trim() })
      if (res.success) {
        setNewSubtaskTitle('')
        const sRes = await api.issueSubtask.list({ issueId: detailIssue.id })
        setSubtasks(sRes.success && sRes.data ? (sRes.data as IssueSubtask[]) : [])
      } else toastError('Error', res.error?.message ?? 'Could not add subtask.')
    } finally {
      setSubtaskSaving(false)
    }
  }

  async function handleToggleSubtask(subtask: IssueSubtask): Promise<void> {
    const res = await api.issueSubtask.toggle({ id: subtask.id, isDone: !subtask.isDone })
    if (res.success) setSubtasks((prev) => prev.map((s) => (s.id === subtask.id ? { ...s, isDone: !s.isDone } : s)))
    else toastError('Error', res.error?.message ?? 'Could not update subtask.')
  }

  async function handleDeleteSubtask(id: string): Promise<void> {
    const res = await api.issueSubtask.delete({ id })
    if (res.success) setSubtasks((prev) => prev.filter((s) => s.id !== id))
    else toastError('Error', res.error?.message ?? 'Could not delete subtask.')
  }

  const displayed = issues.filter((i) => {
    const q = search.toLowerCase()
    return !q || i.title.toLowerCase().includes(q) || (i.description ?? '').toLowerCase().includes(q)
  })

  // KPI
  const kpiOpen       = kpiIssues.filter((i) => i.status === 'OPEN').length
  const kpiInProgress = kpiIssues.filter((i) => i.status === 'IN_PROGRESS').length
  const kpiHigh       = kpiIssues.filter((i) => i.priority === 'HIGH' && !['RESOLVED', 'CLOSED'].includes(i.status)).length

  const colIssues = (status: string) => displayed.filter((i) => i.status === status)
  const doneSubtaskCount = subtasks.filter((s) => s.isDone).length

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
          <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden dark:border-slate-600">
            <button onClick={() => setViewMode('list')} title="List view"
              className={cn('p-2', viewMode === 'list' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-slate-800')}>
              <List className="w-4 h-4" />
            </button>
            <button onClick={() => setViewMode('board')} title="Board view"
              className={cn('p-2', viewMode === 'board' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-slate-800')}>
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
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
        {viewMode === 'list' && (
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100">
            <option value="">All Statuses</option>
            {ISSUE_STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
        )}
        <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100">
          <option value="">All Priorities</option>
          {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {viewMode === 'list' ? (
        /* Table view */
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
                    <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-slate-400">Pts</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-slate-400">Assigned To</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-slate-400">Reported</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                  {displayed.map((i) => (
                    <tr key={i.id} className="hover:bg-gray-50 dark:hover:bg-slate-800">
                      <td className="px-4 py-3">
                        <button onClick={() => void openDetail(i)} className="font-medium text-gray-900 dark:text-slate-100 hover:text-indigo-600 text-left">{i.title}</button>
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
                      <td className="px-4 py-3 text-right text-gray-600 text-xs dark:text-slate-400">{i.storyPoints ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-slate-400">{i.assignedTo?.fullName ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs dark:text-slate-400">{fmtDate(i.reportedDate)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => void openDetail(i)} title="Comments &amp; Subtasks" className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded dark:text-slate-500">
                            <MessageSquare className="w-4 h-4" />
                          </button>
                          <button onClick={() => openEdit(i)} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded dark:text-slate-500">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => setDeleteTarget(i)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded dark:text-slate-500">
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
      ) : (
        /* Kanban board view — same drag-and-drop pattern as LeadsScreen.tsx */
        <div className="flex-1 overflow-x-auto px-4 py-4">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-gray-500 text-sm dark:text-slate-400">Loading...</div>
          ) : (
            <div className="flex gap-3 h-full min-w-max">
              {ISSUE_STATUSES.map((status) => {
                const cards = colIssues(status)
                const isDragOver = dragOverCol === status
                return (
                  <div
                    key={status}
                    className={cn('flex flex-col w-64 rounded-xl border-2 transition-colors', isDragOver ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20' : STATUS_COLUMN_COLORS[status])}
                    onDragOver={(e) => { e.preventDefault(); setDragOverCol(status) }}
                    onDragLeave={() => setDragOverCol(null)}
                    onDrop={() => void handleDrop(status)}
                  >
                    <div className={cn('flex items-center justify-between px-3 py-2 rounded-t-xl', STATUS_HEADER_COLORS[status])}>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wide">{status.replace('_', ' ')}</span>
                        <span className="text-xs font-semibold px-1.5 py-0.5 bg-white/60 rounded-full">{cards.length}</span>
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[120px]">
                      {cards.length === 0 && (
                        <div className="text-xs text-gray-400 text-center py-4 dark:text-slate-500">Drop here</div>
                      )}
                      {cards.map((issue) => (
                        <div
                          key={issue.id}
                          draggable
                          onDragStart={() => setDraggingId(issue.id)}
                          onDragEnd={() => { setDraggingId(null); setDragOverCol(null) }}
                          onClick={() => void openDetail(issue)}
                          className={cn(
                            'bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700 p-3 cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-all',
                            PRIORITY_CARD_BORDER[issue.priority],
                            draggingId === issue.id && 'opacity-40'
                          )}
                        >
                          <div className="font-medium text-gray-900 text-sm leading-tight break-words dark:text-slate-100 mb-1">{issue.title}</div>
                          {issue.project?.projectName && <div className="text-xs text-gray-500 mb-1 dark:text-slate-400">{issue.project.projectName}</div>}
                          <div className="flex items-center justify-between mt-2 gap-1">
                            <Badge variant={PRIORITY_VARIANT[issue.priority] ?? 'neutral'} size="sm">{issue.priority}</Badge>
                            {issue.storyPoints != null && (
                              <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 rounded-full px-1.5 py-0.5">{issue.storyPoints} pt{issue.storyPoints === 1 ? '' : 's'}</span>
                            )}
                          </div>
                          {issue.sprint && (
                            <div className="text-xs text-gray-400 mt-1 dark:text-slate-500">Sprint {issue.sprint.sprintNumber}</div>
                          )}
                          {issue.assignedTo && (
                            <div className="text-xs text-gray-400 mt-1 truncate dark:text-slate-500">{issue.assignedTo.fullName}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

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
              <div className="grid grid-cols-3 gap-3">
                <Select label="Priority" value={fPriority} onChange={(e) => setFPriority(e.target.value)}>
                  {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                </Select>
                <Select label="Status" value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
                  {ISSUE_STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                </Select>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Story Points</label>
                  <input type="number" min="0" max="1000" value={fStoryPoints} onChange={(e) => setFStoryPoints(e.target.value)}
                    placeholder="e.g. 3"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                </div>
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

      {/* Issue Detail Modal — Comments + Subtasks */}
      {detailIssue && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700">
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-slate-100">{detailIssue.title}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={PRIORITY_VARIANT[detailIssue.priority] ?? 'neutral'} size="sm">{detailIssue.priority}</Badge>
                  <Badge variant={STATUS_VARIANT[detailIssue.status] ?? 'neutral'} size="sm">{detailIssue.status.replace('_', ' ')}</Badge>
                  {detailIssue.storyPoints != null && <span className="text-xs text-gray-500 dark:text-slate-400">{detailIssue.storyPoints} pts</span>}
                </div>
              </div>
              <button onClick={() => setDetailIssue(null)} className="text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
              {/* Subtasks */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide dark:text-slate-400 flex items-center gap-1.5">
                    <CheckSquare2 className="w-3.5 h-3.5" /> Subtasks {subtasks.length > 0 && `(${doneSubtaskCount}/${subtasks.length})`}
                  </h3>
                </div>
                {subtasks.length === 0 ? (
                  <p className="text-xs text-gray-400 dark:text-slate-500 mb-2">No subtasks yet.</p>
                ) : (
                  <div className="space-y-1 mb-2">
                    {subtasks.map((s) => (
                      <div key={s.id} className="flex items-center gap-2 text-sm bg-gray-50 dark:bg-slate-800 rounded px-2 py-1.5">
                        <input type="checkbox" checked={s.isDone} onChange={() => void handleToggleSubtask(s)} className="w-4 h-4" />
                        <span className={cn('flex-1', s.isDone && 'line-through text-gray-400 dark:text-slate-500')}>{s.title}</span>
                        <button onClick={() => void handleDeleteSubtask(s.id)} className="text-gray-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <input value={newSubtaskTitle} onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') void handleAddSubtask() }}
                    placeholder="Add a subtask..."
                    className="flex-1 h-9 px-2.5 border border-gray-300 rounded-lg text-sm dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                  <button onClick={() => void handleAddSubtask()} disabled={subtaskSaving || !newSubtaskTitle.trim()}
                    className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Comments */}
              <div>
                <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide dark:text-slate-400 flex items-center gap-1.5 mb-2">
                  <MessageSquare className="w-3.5 h-3.5" /> Comments {comments.length > 0 && `(${comments.length})`}
                </h3>
                {comments.length === 0 ? (
                  <p className="text-xs text-gray-400 dark:text-slate-500 mb-2">No comments yet.</p>
                ) : (
                  <div className="space-y-2 mb-2">
                    {comments.map((c) => (
                      <div key={c.id} className="bg-gray-50 dark:bg-slate-800 rounded-lg px-3 py-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-gray-700 dark:text-slate-300">{c.author?.fullName ?? 'Unknown'}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400 dark:text-slate-500">{fmtDateTime(c.createdAt)}</span>
                            <button onClick={() => void handleDeleteComment(c.id)} className="text-gray-400 hover:text-red-600"><Trash2 className="w-3 h-3" /></button>
                          </div>
                        </div>
                        <p className="text-sm text-gray-800 dark:text-slate-200 mt-1 whitespace-pre-wrap">{c.body}</p>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <textarea value={newComment} onChange={(e) => setNewComment(e.target.value)} rows={2}
                    placeholder="Write a comment..."
                    className="flex-1 px-2.5 py-2 border border-gray-300 rounded-lg text-sm resize-none dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                  <button onClick={() => void handleAddComment()} disabled={commentSaving || !newComment.trim()}
                    className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 self-end">
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete Issue"
        message={`Delete issue "${deleteTarget?.title}"?`}
        confirmLabel="Delete"
      />
    </div>
  )
}
