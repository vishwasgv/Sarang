import React, { useEffect, useState, useCallback } from 'react'
import { FolderOpen, Plus, X, Search, RefreshCw, Edit2, Trash2, CheckSquare, Zap, Clock, AlertCircle, Receipt } from 'lucide-react'
import { api } from '@renderer/services/ipc-client'
import { cn } from '@shared/utils/cn'
import { Card } from '@shared/ui/molecules/Card'
import { KpiCard } from '@shared/ui/molecules/KpiCard'
import { Badge } from '@shared/ui/atoms/Badge'
import { Select } from '@shared/ui/atoms/Select'
import { useIndustryStore } from '@app/store/industry.store'
import { useNotificationStore } from '@app/store/notification.store'
import { ConfirmDialog } from '@shared/ui/molecules/ConfirmDialog'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Milestone {
  id: string
  projectId: string
  milestoneName: string
  milestoneAmount: number | null
  status: string
  dueDate: string | null
  completedDate: string | null
  invoiceId: string | null
  notes: string | null
}

interface Sprint {
  id: string
  projectId: string
  sprintNumber: number
  name: string | null
  goal: string | null
  startDate: string
  endDate: string
  status: string
  issues?: { id: string; status: string }[]
}

interface ServiceProject {
  id: string
  clientId: string
  projectName: string
  projectType: string
  stage: string | null
  status: string
  totalContractValue: number | null
  startDate: string | null
  expectedEndDate: string | null
  completedDate: string | null
  assignedToId: string | null
  notes: string | null
  targetChannel: string | null
  deliverableType: string | null
  adSpendBudget: number | null
  client: { id: string; customerName: string; phone: string | null }
  assignedTo: { id: string; fullName: string } | null
  milestones: Milestone[]
  _count: { timeEntries: number; issues: number }
}

interface Customer { id: string; customerName: string; phone: string | null }
interface Employee { id: string; fullName: string }

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtAmount(n: number | null): string {
  if (n == null) return '—'
  return `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

// Verified exhaustive against ServiceProject.status in prisma/schema.prisma
// ("ACTIVE|ON_HOLD|COMPLETED|CANCELLED") and
// src/main/services/service-project.service.ts (create defaults to 'ACTIVE';
// update auto-manages completedDate on COMPLETED/ACTIVE/ON_HOLD transitions
// but never introduces a status value outside this set).
const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  ACTIVE:    'success',
  ON_HOLD:   'warning',
  COMPLETED: 'info',
  CANCELLED: 'danger',
}

// Verified exhaustive against ServiceProjectMilestone.status in
// prisma/schema.prisma ("UPCOMING|IN_PROGRESS|COMPLETED|INVOICED|PAID") and
// src/main/services/service-project-milestone.service.ts (create defaults to
// 'UPCOMING'; generateInvoice() sets 'INVOICED' — the only secondary
// state-transition path — never anything outside this set).
const MILESTONE_STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'brand'> = {
  UPCOMING:    'neutral',
  IN_PROGRESS: 'info',
  COMPLETED:   'success',
  INVOICED:    'brand',
  PAID:        'success',
}

// Verified exhaustive against Sprint.status in prisma/schema.prisma
// ("PLANNING|ACTIVE|COMPLETED") and src/main/services/sprint.service.ts
// (create defaults to 'PLANNING'; update passes through caller-supplied
// status only — never anything outside this set).
const SPRINT_STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  PLANNING:  'neutral',
  ACTIVE:    'success',
  COMPLETED: 'info',
}

const PROJECT_STATUSES   = ['ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED']
const MILESTONE_STATUSES = ['UPCOMING', 'IN_PROGRESS', 'COMPLETED', 'INVOICED', 'PAID']
const SPRINT_STATUSES    = ['PLANNING', 'ACTIVE', 'COMPLETED']
const PROJECT_TYPES = [
  'GENERAL', 'RESIDENTIAL', 'COMMERCIAL', 'RENOVATION',
  'PRODUCT_BUILD', 'FEATURE_DEVELOPMENT', 'MAINTENANCE_RETAINER', 'CONSULTING', 'MARKETING_CAMPAIGN',
]
// Marketing Agency depth (marketing_campaigns module) — free-text, not a
// fixed enum, same convention as everything else on this generic form.
const MARKETING_CHANNELS = ['Google Ads', 'Meta Ads', 'SEO', 'Email', 'Social Media', 'Content', 'Influencer', 'Other']
const MARKETING_DELIVERABLE_TYPES = ['Campaign Launch', 'Creative Asset Set', 'Monthly Report', 'Website', 'Content Calendar', 'Other']

// ── Component ─────────────────────────────────────────────────────────────────

export default function ProjectsScreen(): React.ReactElement {
  const isMarketingAgency = useIndustryStore((s) => s.isModuleEnabled('marketing_campaigns'))
  const { error: toastError } = useNotificationStore()
  const [projects, setProjects]   = useState<ServiceProject[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading]     = useState(false)
  const [search, setSearch]       = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  // Milestone invoice generation
  const [generatingMilestoneId, setGeneratingMilestoneId] = useState<string | null>(null)
  const [invoiceError, setInvoiceError] = useState('')

  // Expand state: 'milestones' | 'sprints' per project
  const [expandedTab, setExpandedTab] = useState<Record<string, 'milestones' | 'sprints' | null>>({})
  // Sprints loaded per project
  const [sprintMap, setSprintMap] = useState<Record<string, Sprint[]>>({})

  // KPI
  const [kpiProjects, setKpiProjects] = useState<ServiceProject[]>([])

  // ── Project form state ──────────────────────────────────────────────────────
  const [showPForm, setShowPForm]     = useState(false)
  const [editProject, setEditProject] = useState<ServiceProject | null>(null)
  const [pSaving, setPSaving]         = useState(false)
  const [pClientId, setPClientId]     = useState('')
  const [pName, setPName]             = useState('')
  const [pType, setPType]             = useState('GENERAL')
  const [pStage, setPStage]           = useState('')
  const [pStatus, setPStatus]         = useState('ACTIVE')
  const [pContractValue, setPContractValue] = useState('')
  const [pStartDate, setPStartDate]   = useState('')
  const [pEndDate, setPEndDate]       = useState('')
  const [pAssignedToId, setPAssignedToId] = useState('')
  const [pNotes, setPNotes]           = useState('')
  const [pTargetChannel, setPTargetChannel] = useState('')
  const [pDeliverableType, setPDeliverableType] = useState('')
  const [pAdSpendBudget, setPAdSpendBudget] = useState('')

  // ── Milestone form state ────────────────────────────────────────────────────
  const [showMForm, setShowMForm]       = useState(false)
  const [mProjectId, setMProjectId]     = useState('')
  const [editMilestone, setEditMilestone] = useState<Milestone | null>(null)
  const [mSaving, setMSaving]           = useState(false)
  const [mName, setMName]               = useState('')
  const [mAmount, setMAmount]           = useState('')
  const [mStatus, setMStatus]           = useState('UPCOMING')
  const [mDueDate, setMDueDate]         = useState('')
  const [mNotes, setMNotes]             = useState('')

  // ── Sprint form state ───────────────────────────────────────────────────────
  const [showSForm, setShowSForm]     = useState(false)
  const [sProjectId, setSProjectId]   = useState('')
  const [editSprint, setEditSprint]   = useState<Sprint | null>(null)
  const [sSaving, setSSaving]         = useState(false)
  const [sName, setSName]             = useState('')
  const [sGoal, setSGoal]             = useState('')
  const [sStartDate, setSStartDate]   = useState('')
  const [sEndDate, setSEndDate]       = useState('')
  const [sStatus, setSStatus]         = useState('PLANNING')

  // ── Delete confirmation state ───────────────────────────────────────────────
  type DeleteTarget =
    | { kind: 'project'; id: string }
    | { kind: 'milestone'; id: string }
    | { kind: 'sprint'; id: string; projectId: string }
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const [deleting, setDeleting] = useState(false)

  // ── Load ───────────────────────────────────────────────────────────────────

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [projRes, kpiRes, custRes, empRes] = await Promise.all([
        api.serviceProject.list(filterStatus ? { status: filterStatus } : undefined),
        api.serviceProject.list(),
        api.customers.list(),
        api.hr.listEmployees(),
      ])
      if (projRes.success && projRes.data) setProjects(projRes.data as ServiceProject[])
      else toastError('Error', projRes.error?.message ?? 'Failed to load projects.')
      if (kpiRes.success && kpiRes.data) setKpiProjects(kpiRes.data as ServiceProject[])
      if (custRes.success && custRes.data) {
        const d = custRes.data as { customers?: Customer[] } | Customer[]
        setCustomers(Array.isArray(d) ? d : (d.customers ?? []))
      }
      if (empRes.success && empRes.data) {
        const d = empRes.data as { employees?: Employee[] } | Employee[]
        setEmployees(Array.isArray(d) ? d : (d.employees ?? []))
      }
    } catch {
      toastError('Error', 'Failed to load projects.')
    } finally {
      setLoading(false)
    }
  }, [filterStatus, toastError])

  useEffect(() => { loadAll() }, [loadAll])

  const loadSprints = useCallback(async (projectId: string) => {
    try {
      const res = await api.sprint.list({ projectId })
      if (res.success && res.data) {
        setSprintMap((prev) => ({ ...prev, [projectId]: res.data as Sprint[] }))
      } else {
        toastError('Error', res.error?.message ?? 'Could not load sprints.')
      }
    } catch {
      toastError('Error', 'Could not load sprints.')
    }
  }, [toastError])

  // ── Expand tab toggle ──────────────────────────────────────────────────────

  function toggleTab(projectId: string, tab: 'milestones' | 'sprints'): void {
    setExpandedTab((prev) => {
      const current = prev[projectId]
      const next = current === tab ? null : tab
      if (next === 'sprints') loadSprints(projectId)
      return { ...prev, [projectId]: next }
    })
  }

  // ── Project CRUD ───────────────────────────────────────────────────────────

  function resetPForm(): void {
    setPClientId(''); setPName(''); setPType('GENERAL'); setPStage('')
    setPStatus('ACTIVE'); setPContractValue(''); setPStartDate('')
    setPEndDate(''); setPAssignedToId(''); setPNotes('')
    setPTargetChannel(''); setPDeliverableType(''); setPAdSpendBudget('')
  }

  function openNewProject(): void { setEditProject(null); resetPForm(); setShowPForm(true) }

  function openEditProject(p: ServiceProject): void {
    setEditProject(p)
    setPClientId(p.clientId); setPName(p.projectName); setPType(p.projectType)
    setPStage(p.stage ?? ''); setPStatus(p.status)
    setPContractValue(p.totalContractValue != null ? String(p.totalContractValue) : '')
    setPStartDate(p.startDate ? p.startDate.slice(0, 10) : '')
    setPEndDate(p.expectedEndDate ? p.expectedEndDate.slice(0, 10) : '')
    setPAssignedToId(p.assignedToId ?? ''); setPNotes(p.notes ?? '')
    setPTargetChannel(p.targetChannel ?? ''); setPDeliverableType(p.deliverableType ?? '')
    setPAdSpendBudget(p.adSpendBudget != null ? String(p.adSpendBudget) : '')
    setShowPForm(true)
  }

  async function handleSaveProject(): Promise<void> {
    if (!pClientId || !pName.trim()) return
    setPSaving(true)
    try {
      let res
      if (editProject) {
        res = await api.serviceProject.update({
          id:                 editProject.id,
          projectName:        pName.trim(),
          projectType:        pType,
          stage:              pStage || null,
          status:             pStatus,
          totalContractValue: pContractValue ? Number(pContractValue) : null,
          startDate:          pStartDate || null,
          expectedEndDate:    pEndDate || null,
          assignedToId:       pAssignedToId || null,
          notes:              pNotes || null,
          targetChannel:      pTargetChannel || null,
          deliverableType:    pDeliverableType || null,
          adSpendBudget:      pAdSpendBudget ? Number(pAdSpendBudget) : null,
        })
      } else {
        res = await api.serviceProject.create({
          clientId:           pClientId,
          projectName:        pName.trim(),
          projectType:        pType,
          stage:              pStage || undefined,
          status:             pStatus,
          totalContractValue: pContractValue ? Number(pContractValue) : undefined,
          startDate:          pStartDate || undefined,
          expectedEndDate:    pEndDate || undefined,
          assignedToId:       pAssignedToId || undefined,
          notes:              pNotes || undefined,
          targetChannel:      pTargetChannel || undefined,
          deliverableType:    pDeliverableType || undefined,
          adSpendBudget:      pAdSpendBudget ? Number(pAdSpendBudget) : undefined,
        })
      }
      if (res.success) { setShowPForm(false); resetPForm(); loadAll() }
      else toastError('Error', res.error?.message ?? 'Could not save project.')
    } catch {
      toastError('Error', 'Could not save project.')
    } finally {
      setPSaving(false)
    }
  }

  async function handleDeleteProject(id: string): Promise<void> {
    setDeleting(true)
    try {
      const res = await api.serviceProject.delete({ id })
      if (res.success) { setDeleteTarget(null); loadAll() }
      else toastError('Error', res.error?.message ?? 'Could not delete project.')
    } catch {
      toastError('Error', 'Could not delete project.')
    } finally {
      setDeleting(false)
    }
  }

  // ── Milestone CRUD ─────────────────────────────────────────────────────────

  function openNewMilestone(projectId: string): void {
    setEditMilestone(null); setMProjectId(projectId)
    setMName(''); setMAmount(''); setMStatus('UPCOMING'); setMDueDate(''); setMNotes('')
    setShowMForm(true)
  }

  function openEditMilestone(m: Milestone, projectId: string): void {
    setEditMilestone(m); setMProjectId(projectId)
    setMName(m.milestoneName); setMAmount(m.milestoneAmount != null ? String(m.milestoneAmount) : '')
    setMStatus(m.status); setMDueDate(m.dueDate ? m.dueDate.slice(0, 10) : ''); setMNotes(m.notes ?? '')
    setShowMForm(true)
  }

  async function handleSaveMilestone(): Promise<void> {
    if (!mName.trim()) return
    setMSaving(true)
    try {
      let res
      if (editMilestone) {
        res = await api.milestone.update({
          id:              editMilestone.id,
          milestoneName:   mName.trim(),
          milestoneAmount: mAmount ? Number(mAmount) : null,
          status:          mStatus,
          dueDate:         mDueDate || null,
          notes:           mNotes || null,
        })
      } else {
        res = await api.milestone.create({
          projectId:       mProjectId,
          milestoneName:   mName.trim(),
          milestoneAmount: mAmount ? Number(mAmount) : undefined,
          status:          mStatus,
          dueDate:         mDueDate || undefined,
          notes:           mNotes || undefined,
        })
      }
      if (res.success) { setShowMForm(false); loadAll() }
      else toastError('Error', res.error?.message ?? 'Could not save milestone.')
    } catch {
      toastError('Error', 'Could not save milestone.')
    } finally {
      setMSaving(false)
    }
  }

  async function handleDeleteMilestone(id: string): Promise<void> {
    setDeleting(true)
    try {
      const res = await api.milestone.delete({ id })
      if (res.success) { setDeleteTarget(null); loadAll() }
      else toastError('Error', res.error?.message ?? 'Could not delete milestone.')
    } catch {
      toastError('Error', 'Could not delete milestone.')
    } finally {
      setDeleting(false)
    }
  }

  async function handleGenerateMilestoneInvoice(id: string): Promise<void> {
    setInvoiceError('')
    setGeneratingMilestoneId(id)
    try {
      const res = await api.milestone.generateInvoice({ id })
      if (res.success) {
        await loadAll()
      } else {
        setInvoiceError(res.error?.message ?? 'Could not generate invoice.')
      }
    } catch {
      setInvoiceError('Could not generate invoice.')
    } finally {
      setGeneratingMilestoneId(null)
    }
  }

  // ── Sprint CRUD ────────────────────────────────────────────────────────────

  function openNewSprint(projectId: string): void {
    setEditSprint(null); setSProjectId(projectId)
    setSName(''); setSGoal(''); setSStartDate(''); setSEndDate(''); setSStatus('PLANNING')
    setShowSForm(true)
  }

  function openEditSprint(s: Sprint): void {
    setEditSprint(s); setSProjectId(s.projectId)
    setSName(s.name ?? ''); setSGoal(s.goal ?? '')
    setSStartDate(s.startDate.slice(0, 10)); setSEndDate(s.endDate.slice(0, 10))
    setSStatus(s.status)
    setShowSForm(true)
  }

  async function handleSaveSprint(): Promise<void> {
    if (!sStartDate || !sEndDate) return
    setSSaving(true)
    try {
      const payload = {
        projectId: sProjectId, name: sName || undefined,
        goal: sGoal || undefined, startDate: sStartDate, endDate: sEndDate,
      }
      const res = editSprint
        ? await api.sprint.update({ id: editSprint.id, name: sName || null, goal: sGoal || null, startDate: sStartDate, endDate: sEndDate, status: sStatus })
        : await api.sprint.create(payload)
      if (res.success) { setShowSForm(false); loadSprints(sProjectId) }
      else toastError('Error', res.error?.message ?? 'Could not save sprint.')
    } catch {
      toastError('Error', 'Could not save sprint.')
    } finally {
      setSSaving(false)
    }
  }

  async function handleDeleteSprint(id: string, projectId: string): Promise<void> {
    setDeleting(true)
    try {
      const res = await api.sprint.delete({ id })
      if (res.success) { setDeleteTarget(null); loadSprints(projectId) }
      else toastError('Error', res.error?.message ?? 'Could not delete sprint.')
    } catch {
      toastError('Error', 'Could not delete sprint.')
    } finally {
      setDeleting(false)
    }
  }

  async function handleConfirmDelete(): Promise<void> {
    if (!deleteTarget) return
    if (deleteTarget.kind === 'project') await handleDeleteProject(deleteTarget.id)
    else if (deleteTarget.kind === 'milestone') await handleDeleteMilestone(deleteTarget.id)
    else await handleDeleteSprint(deleteTarget.id, deleteTarget.projectId)
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const displayed = projects.filter((p) => {
    const q = search.toLowerCase()
    return !q || p.projectName.toLowerCase().includes(q) || p.client.customerName.toLowerCase().includes(q)
  })

  const kpiActive    = kpiProjects.filter((p) => p.status === 'ACTIVE').length
  const kpiCompleted = kpiProjects.filter((p) => p.status === 'COMPLETED').length
  const kpiValue     = kpiProjects.reduce((s, p) => s + Number(p.totalContractValue ?? 0), 0)

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-slate-950">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-gray-200 px-6 py-4 flex items-center justify-between dark:border-slate-700">
        <div className="flex items-center gap-3">
          <FolderOpen className="w-6 h-6 text-indigo-600" />
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-slate-100">Projects</h1>
            <p className="text-sm text-gray-500 dark:text-slate-400">Manage client projects, milestones and sprints</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadAll} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200">
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </button>
          <button onClick={openNewProject} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium text-sm">
            <Plus className="w-4 h-4" /> New Project
          </button>
        </div>
      </div>

      {/* KPI Bar */}
      <div className="grid grid-cols-4 gap-4 px-6 py-4">
        <KpiCard label="Total Projects" value={kpiProjects.length} />
        <KpiCard label="Active" value={kpiActive} color="success" />
        <KpiCard label="Completed" value={kpiCompleted} color="info" />
        <KpiCard label="Total Contract Value" value={fmtAmount(kpiValue)} color="brand" />
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 border-b border-gray-200 px-6 py-3 flex items-center gap-3 dark:border-slate-700">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by project name or client..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
        </div>
        <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          {PROJECT_STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </Select>
      </div>

      {invoiceError && (
        <div className="px-6 py-2 bg-red-50 border-b border-red-100 text-sm text-red-600">{invoiceError}</div>
      )}

      {/* Project List */}
      <div className="flex-1 overflow-auto px-6 py-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-gray-500 text-sm dark:text-slate-400">Loading...</div>
        ) : displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-400 dark:text-slate-500">
            <FolderOpen className="w-8 h-8 mb-2 opacity-40" />
            <p className="text-sm">No projects found</p>
          </div>
        ) : (
          displayed.map((p) => {
            const tab = expandedTab[p.id] ?? null
            const sprints = sprintMap[p.id] ?? []
            return (
              <Card key={p.id} padding="none">
                {/* Project row */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900 text-sm dark:text-slate-100">{p.projectName}</span>
                      <Badge variant={STATUS_VARIANT[p.status] ?? 'neutral'} size="sm">{p.status.replace('_', ' ')}</Badge>
                      {/* _count badges */}
                      {p._count.timeEntries > 0 && (
                        <Badge variant="neutral" size="sm" icon={<Clock className="w-3 h-3" />}>{p._count.timeEntries}</Badge>
                      )}
                      {p._count.issues > 0 && (
                        <Badge variant="neutral" size="sm" icon={<AlertCircle className="w-3 h-3" />}>{p._count.issues}</Badge>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5 dark:text-slate-400">
                      {p.client.customerName} · {p.projectType.replace(/_/g, ' ')}
                      {p.stage && ` · ${p.stage.replace(/_/g, ' ')}`}
                      {p.targetChannel && ` · ${p.targetChannel}`}
                      {p.deliverableType && ` · ${p.deliverableType}`}
                      {p.adSpendBudget != null && ` · Ad spend ${fmtAmount(p.adSpendBudget)}`}
                    </div>
                  </div>
                  <div className="text-right text-sm hidden sm:block">
                    <div className="font-medium text-gray-900 dark:text-slate-100">{fmtAmount(p.totalContractValue)}</div>
                    <div className="text-xs text-gray-400 dark:text-slate-500">{fmtDate(p.startDate)} – {fmtDate(p.expectedEndDate)}</div>
                  </div>
                  {/* Action buttons */}
                  <div className="flex items-center gap-1 ml-2">
                    <button onClick={() => toggleTab(p.id, 'milestones')}
                      className={cn('flex items-center gap-1 px-2 py-1 rounded text-xs font-medium',
                        tab === 'milestones' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' : 'text-gray-500 hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-slate-800')}
                      title="Milestones">
                      <CheckSquare className="w-3.5 h-3.5" />
                      <span>{p.milestones.length}</span>
                    </button>
                    <button onClick={() => toggleTab(p.id, 'sprints')}
                      className={cn('flex items-center gap-1 px-2 py-1 rounded text-xs font-medium',
                        tab === 'sprints' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' : 'text-gray-500 hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-slate-800')}
                      title="Sprints">
                      <Zap className="w-3.5 h-3.5" />
                      <span>Sprints</span>
                    </button>
                    <button onClick={() => openEditProject(p)} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded dark:text-slate-500">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => setDeleteTarget({ kind: 'project', id: p.id })} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded dark:text-slate-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Milestones tab */}
                {tab === 'milestones' && (
                  <div className="border-t border-gray-100 px-4 pb-3 dark:border-slate-800">
                    <div className="flex items-center justify-between py-2">
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide dark:text-slate-400">Milestones</span>
                      <button onClick={() => openNewMilestone(p.id)}
                        className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                        <Plus className="w-3 h-3" /> Add
                      </button>
                    </div>
                    {p.milestones.length === 0 ? (
                      <p className="text-xs text-gray-400 py-1 dark:text-slate-500">No milestones yet.</p>
                    ) : (
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-gray-500 dark:text-slate-400">
                            <th className="text-left py-1 pl-2">Milestone</th>
                            <th className="text-right py-1">Amount</th>
                            <th className="text-left py-1 px-3">Status</th>
                            <th className="text-left py-1">Due</th>
                            <th className="py-1" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {p.milestones.map((m) => (
                            <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-slate-800">
                              <td className="py-1.5 pl-2 text-gray-800 dark:text-slate-200">{m.milestoneName}</td>
                              <td className="py-1.5 text-right text-gray-700 dark:text-slate-300">{fmtAmount(m.milestoneAmount)}</td>
                              <td className="py-1.5 px-3">
                                <Badge variant={MILESTONE_STATUS_VARIANT[m.status] ?? 'neutral'} size="sm">{m.status.replace('_', ' ')}</Badge>
                              </td>
                              <td className="py-1.5 text-gray-500 dark:text-slate-400">{fmtDate(m.dueDate)}</td>
                              <td className="py-1.5">
                                <div className="flex items-center gap-1 justify-end">
                                  {!m.invoiceId && m.milestoneAmount != null && m.milestoneAmount > 0 && (
                                    <button
                                      onClick={() => void handleGenerateMilestoneInvoice(m.id)}
                                      disabled={generatingMilestoneId === m.id}
                                      title="Generate Invoice"
                                      className="p-1 text-gray-400 hover:text-green-600 rounded disabled:opacity-50 dark:text-slate-500"
                                    >
                                      <Receipt className="w-3 h-3" />
                                    </button>
                                  )}
                                  <button onClick={() => openEditMilestone(m, p.id)} className="p-1 text-gray-400 hover:text-indigo-600 rounded dark:text-slate-500">
                                    <Edit2 className="w-3 h-3" />
                                  </button>
                                  <button onClick={() => setDeleteTarget({ kind: 'milestone', id: m.id })} className="p-1 text-gray-400 hover:text-red-600 rounded dark:text-slate-500">
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}

                {/* Sprints tab */}
                {tab === 'sprints' && (
                  <div className="border-t border-gray-100 px-4 pb-3 dark:border-slate-800">
                    <div className="flex items-center justify-between py-2">
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide dark:text-slate-400">Sprints</span>
                      <button onClick={() => openNewSprint(p.id)}
                        className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                        <Plus className="w-3 h-3" /> New Sprint
                      </button>
                    </div>
                    {sprints.length === 0 ? (
                      <p className="text-xs text-gray-400 py-1 dark:text-slate-500">No sprints yet. Create one to start assigning issues.</p>
                    ) : (
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-gray-500 dark:text-slate-400">
                            <th className="text-left py-1 pl-2">Sprint</th>
                            <th className="text-left py-1 px-3">Status</th>
                            <th className="text-left py-1">Period</th>
                            <th className="text-left py-1">Goal</th>
                            <th className="text-right py-1 px-3">Issues</th>
                            <th className="py-1" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {sprints.map((s) => {
                            const issueCount  = s.issues?.length ?? 0
                            const openCount   = s.issues?.filter((i) => i.status === 'OPEN' || i.status === 'IN_PROGRESS').length ?? 0
                            return (
                            <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-slate-800">
                              <td className="py-1.5 pl-2 font-medium text-gray-800 dark:text-slate-200">
                                Sprint {s.sprintNumber}{s.name ? ` — ${s.name}` : ''}
                              </td>
                              <td className="py-1.5 px-3">
                                <Badge variant={SPRINT_STATUS_VARIANT[s.status] ?? 'neutral'} size="sm">{s.status}</Badge>
                              </td>
                              <td className="py-1.5 text-gray-500 dark:text-slate-400">
                                {fmtDate(s.startDate)} – {fmtDate(s.endDate)}
                              </td>
                              <td className="py-1.5 text-gray-500 truncate max-w-[200px] dark:text-slate-400">{s.goal ?? '—'}</td>
                              <td className="py-1.5 text-right px-3">
                                {issueCount > 0 ? (
                                  <span className="text-xs text-gray-600 dark:text-slate-400">
                                    {openCount} open / {issueCount} total
                                  </span>
                                ) : (
                                  <span className="text-xs text-gray-400 dark:text-slate-500">—</span>
                                )}
                              </td>
                              <td className="py-1.5">
                                <div className="flex items-center gap-1 justify-end">
                                  <button onClick={() => openEditSprint(s)} className="p-1 text-gray-400 hover:text-indigo-600 rounded dark:text-slate-500">
                                    <Edit2 className="w-3 h-3" />
                                  </button>
                                  <button onClick={() => setDeleteTarget({ kind: 'sprint', id: s.id, projectId: p.id })} className="p-1 text-gray-400 hover:text-red-600 rounded dark:text-slate-500">
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </Card>
            )
          })
        )}
      </div>

      {/* ── Project Form Modal ───────────────────────────────────────────────── */}
      {showPForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700">
              <h2 className="font-semibold text-gray-900 dark:text-slate-100">{editProject ? 'Edit Project' : 'New Project'}</h2>
              <button onClick={() => setShowPForm(false)} className="text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-200"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              <Select label="Client" required value={pClientId} onChange={(e) => setPClientId(e.target.value)}>
                <option value="">Select client...</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.customerName}</option>)}
              </Select>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Project Name *</label>
                <input value={pName} onChange={(e) => setPName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Select label="Type" value={pType} onChange={(e) => setPType(e.target.value)}>
                  {PROJECT_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                </Select>
                <Select label="Status" value={pStatus} onChange={(e) => setPStatus(e.target.value)}>
                  {PROJECT_STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Stage (optional)</label>
                <input value={pStage} onChange={(e) => setPStage(e.target.value)}
                  placeholder="e.g. DESIGN, CONSTRUCTION, SCHEMATIC..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Total Contract Value (₹)</label>
                <input type="number" min="0" value={pContractValue} onChange={(e) => setPContractValue(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
              </div>
              {isMarketingAgency && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Target Channel</label>
                      <input list="marketing-channels" value={pTargetChannel} onChange={(e) => setPTargetChannel(e.target.value)}
                        placeholder="e.g. Google Ads"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                      <datalist id="marketing-channels">
                        {MARKETING_CHANNELS.map((c) => <option key={c} value={c} />)}
                      </datalist>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Deliverable Type</label>
                      <input list="marketing-deliverables" value={pDeliverableType} onChange={(e) => setPDeliverableType(e.target.value)}
                        placeholder="e.g. Campaign Launch"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                      <datalist id="marketing-deliverables">
                        {MARKETING_DELIVERABLE_TYPES.map((d) => <option key={d} value={d} />)}
                      </datalist>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Ad Spend Budget (₹)</label>
                    <input type="number" min="0" value={pAdSpendBudget} onChange={(e) => setPAdSpendBudget(e.target.value)}
                      placeholder="Client's media/ad budget — separate from your agency fee above"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                  </div>
                </>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Start Date</label>
                  <input type="date" value={pStartDate} onChange={(e) => setPStartDate(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Expected End Date</label>
                  <input type="date" value={pEndDate} onChange={(e) => setPEndDate(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                </div>
              </div>
              <Select label="Assigned To" value={pAssignedToId} onChange={(e) => setPAssignedToId(e.target.value)}>
                <option value="">Unassigned</option>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.fullName}</option>)}
              </Select>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Notes</label>
                <textarea value={pNotes} onChange={(e) => setPNotes(e.target.value)} rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-slate-700">
              <button onClick={() => setShowPForm(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800">Cancel</button>
              <button onClick={handleSaveProject} disabled={pSaving || !pClientId || !pName.trim()}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                {pSaving ? 'Saving...' : editProject ? 'Update Project' : 'Create Project'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Milestone Form Modal ─────────────────────────────────────────────── */}
      {showMForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700">
              <h2 className="font-semibold text-gray-900 dark:text-slate-100">{editMilestone ? 'Edit Milestone' : 'New Milestone'}</h2>
              <button onClick={() => setShowMForm(false)} className="text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-200"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Milestone Name *</label>
                <input value={mName} onChange={(e) => setMName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Amount (₹)</label>
                  <input type="number" min="0.01" step="0.01" value={mAmount} onChange={(e) => setMAmount(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                </div>
                <Select label="Status" value={mStatus} onChange={(e) => setMStatus(e.target.value)}>
                  {MILESTONE_STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Due Date</label>
                <input type="date" value={mDueDate} onChange={(e) => setMDueDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Notes</label>
                <textarea value={mNotes} onChange={(e) => setMNotes(e.target.value)} rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-slate-700">
              <button onClick={() => setShowMForm(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800">Cancel</button>
              <button onClick={handleSaveMilestone} disabled={mSaving || !mName.trim()}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                {mSaving ? 'Saving...' : editMilestone ? 'Update' : 'Add Milestone'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Sprint Form Modal ────────────────────────────────────────────────── */}
      {showSForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700">
              <h2 className="font-semibold text-gray-900 dark:text-slate-100">{editSprint ? 'Edit Sprint' : 'New Sprint'}</h2>
              <button onClick={() => setShowSForm(false)} className="text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-200"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Sprint Name (optional)</label>
                <input value={sName} onChange={(e) => setSName(e.target.value)}
                  placeholder="e.g. MVP Core, Auth & Onboarding..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Goal</label>
                <textarea value={sGoal} onChange={(e) => setSGoal(e.target.value)} rows={2}
                  placeholder="What will this sprint deliver?"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Start Date *</label>
                  <input type="date" value={sStartDate} onChange={(e) => setSStartDate(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">End Date *</label>
                  <input type="date" value={sEndDate} onChange={(e) => setSEndDate(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                </div>
              </div>
              {editSprint && (
                <Select label="Status" value={sStatus} onChange={(e) => setSStatus(e.target.value)}>
                  {SPRINT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </Select>
              )}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-slate-700">
              <button onClick={() => setShowSForm(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800">Cancel</button>
              <button onClick={handleSaveSprint} disabled={sSaving || !sStartDate || !sEndDate}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                {sSaving ? 'Saving...' : editSprint ? 'Update Sprint' : 'Create Sprint'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        loading={deleting}
        title={
          deleteTarget?.kind === 'project' ? 'Delete Project' :
          deleteTarget?.kind === 'milestone' ? 'Delete Milestone' : 'Delete Sprint'
        }
        message={
          deleteTarget?.kind === 'project' ? 'Delete this project and all its data?' :
          deleteTarget?.kind === 'milestone' ? 'Delete this milestone?' :
          'Delete this sprint? Issues will move to backlog.'
        }
        confirmLabel="Delete"
      />
    </div>
  )
}
