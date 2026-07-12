import { Fragment, useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, X, Bug, FileText, Receipt, ChevronDown, ChevronUp, Search } from 'lucide-react'
import { Card } from '@shared/ui/molecules/Card'
import { KpiCard } from '@shared/ui/molecules/KpiCard'
import { Badge } from '@shared/ui/atoms/Badge'
import { Select } from '@shared/ui/atoms/Select'
import { CustomerPicker } from '@shared/ui/molecules/CustomerPicker'
import { ConfirmDialog } from '@shared/ui/molecules/ConfirmDialog'
import { useNotificationStore } from '@app/store/notification.store'

const api = window.api

interface PestServiceContract {
  id: string
  contractNumber: string
  clientId: string
  client: { id: string; customerName: string; phone: string | null }
  propertyAddress: string
  propertyType: string
  pestTypes: string
  serviceFrequency: string
  startDate: string
  endDate?: string | null
  contractValue: number
  status: string
  assignedToId?: string | null
  assignedTo?: { id: string; fullName: string } | null
  notes?: string | null
  lastInvoicedPeriod?: string | null
  _count?: { jobSheets: number }
  createdAt: string
}

interface PestJobSheet {
  id: string
  jobNumber: string
  contractId?: string | null
  clientId: string
  client: { id: string; customerName: string; phone: string | null }
  contract?: { id: string; contractNumber: string; propertyAddress: string } | null
  visitDate: string
  scheduledTime?: string | null
  technicianIds: string
  pesticideUsed?: string | null
  areasServiced: string
  treatmentType: string
  jobAmount: number
  status: string
  completedDate?: string | null
  followUpDate?: string | null
  clientSignature: boolean
  invoiceId?: string | null
  notes?: string | null
  createdAt: string
}

interface Customer { id: string; customerName: string; phone: string | null }
interface Employee { id: string; fullName: string }

const CONTRACT_STATUSES = ['ACTIVE', 'PENDING', 'EXPIRED', 'CANCELLED']
// Verified exhaustive against PestServiceContract.status in prisma/schema.prisma ("ACTIVE|EXPIRED|CANCELLED|PENDING").
const CONTRACT_STATUS_VARIANT: Record<string, 'success' | 'warning' | 'neutral' | 'danger'> = {
  ACTIVE: 'success',
  PENDING: 'warning',
  EXPIRED: 'neutral',
  CANCELLED: 'danger',
}
const PROPERTY_TYPES = ['RESIDENTIAL', 'COMMERCIAL', 'INDUSTRIAL']
const PEST_TYPES_LIST = ['COCKROACHES', 'RODENTS', 'TERMITES', 'ANTS', 'MOSQUITOES', 'BEDBUGS', 'OTHER']
const FREQUENCIES = ['MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY', 'ONE_TIME']
const TREATMENT_TYPES = ['SPRAY', 'GEL', 'FUMIGATION', 'TRAP', 'BAIT', 'COMBINED']
const JOB_STATUSES = ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']
// Verified exhaustive against PestJobSheet.status in prisma/schema.prisma ("SCHEDULED|IN_PROGRESS|COMPLETED|CANCELLED")
// and the only other write site, pest-job-sheet.service.ts's invoice generation, which sets 'COMPLETED'.
const JOB_STATUS_VARIANT: Record<string, 'info' | 'warning' | 'success' | 'danger'> = {
  SCHEDULED: 'info',
  IN_PROGRESS: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'danger',
}
const JOB_STATUS_NEXT: Record<string, string> = { SCHEDULED: 'IN_PROGRESS', IN_PROGRESS: 'COMPLETED' }

const parseSafe = <T,>(raw: string, fallback: T): T => { try { return JSON.parse(raw) as T } catch { return fallback } }

// Prisma DateTime fields survive Electron's IPC structured clone as real
// Date instances, not strings — calling .slice() directly on one throws
// "d.slice is not a function". Handles both shapes so it's safe regardless
// of how the value arrived.
const dateSlice = (d: unknown): string => {
  if (!d) return ''
  return (d instanceof Date ? d.toISOString() : String(d)).slice(0, 10)
}

function emptyContractForm() {
  return {
    propertyAddress: '', propertyType: 'RESIDENTIAL', pestTypes: [] as string[],
    serviceFrequency: 'QUARTERLY', startDate: '', endDate: '', contractValue: '', status: 'ACTIVE',
    assignedToId: '', notes: '',
  }
}
function emptySheetForm() {
  return {
    contractId: '', visitDate: '', scheduledTime: '', technicianIds: [] as string[],
    pesticideUsed: '', areasServiced: [] as string[], treatmentType: 'SPRAY', jobAmount: '',
    clientSignature: false, followUpDate: '', notes: '', status: 'SCHEDULED',
  }
}

const COMMON_AREAS = ['Kitchen', 'Bathrooms', 'Bedroom', 'Store Room', 'Terrace', 'Garden', 'Basement', 'Office', 'Warehouse', 'Restaurant Kitchen', 'Common Areas']

// Matches pest-contract.service.ts's generateContractInvoice default period
// key ("YYYY-MM" of `new Date()` when no explicit period is passed).
const currentContractPeriod = new Date().toISOString().slice(0, 7)

export default function PestControlScreen() {
  const { error: toastError } = useNotificationStore()
  const [tab, setTab] = useState<'contracts' | 'jobs'>('contracts')
  const [contracts, setContracts] = useState<PestServiceContract[]>([])
  const [jobs, setJobs] = useState<PestJobSheet[]>([])
  const [contractStatusFilter, setContractStatusFilter] = useState('')
  const [contractSearch, setContractSearch] = useState('')
  const [jobStatusFilter, setJobStatusFilter] = useState('')
  const [jobSearch, setJobSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [kpis, setKpis] = useState({ activeContracts: 0, pendingJobSheets: 0, scheduledThisWeek: 0 })
  const [expandedContractId, setExpandedContractId] = useState<string | null>(null)
  const [showContractForm, setShowContractForm] = useState(false)
  const [editContract, setEditContract] = useState<PestServiceContract | null>(null)
  const [contractForm, setContractForm] = useState(emptyContractForm())
  const [contractFormError, setContractFormError] = useState('')
  const [contractSaving, setContractSaving] = useState(false)
  const [showSheetForm, setShowSheetForm] = useState(false)
  const [editSheet, setEditSheet] = useState<PestJobSheet | null>(null)
  const [sheetForm, setSheetForm] = useState(emptySheetForm())
  const [sheetFormError, setSheetFormError] = useState('')
  const [sheetSaving, setSheetSaving] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [invoiceBanners, setInvoiceBanners] = useState<Record<string, { ok: boolean; msg: string }>>({})
  const [invoiceLoading, setInvoiceLoading] = useState<string | null>(null)
  const [pickedContractClient, setPickedContractClient] = useState<Customer | null>(null)
  const [pickedSheetClient, setPickedSheetClient] = useState<Customer | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [deleteContractTarget, setDeleteContractTarget] = useState<PestServiceContract | null>(null)
  const [deletingContract, setDeletingContract] = useState(false)
  const [deleteSheetTarget, setDeleteSheetTarget] = useState<PestJobSheet | null>(null)
  const [deletingSheet, setDeletingSheet] = useState(false)

  const loadKpis = useCallback(() => {
    api.pestContract.kpis().then(r => { if (r.success) setKpis(r.data as typeof kpis) })
  }, [])

  const loadContracts = useCallback(async (status?: string, q?: string) => {
    try {
      const filters: { status?: string; search?: string } = {}
      if (status) filters.status = status
      if (q) filters.search = q
      const res = await api.pestContract.list(filters)
      if (res.success) setContracts(res.data as PestServiceContract[])
      else toastError('Error', res.error?.message ?? 'Could not load contracts.')
    } catch { toastError('Error', 'Could not load contracts.') }
  }, [toastError])

  const loadJobs = useCallback(async (status?: string, q?: string) => {
    try {
      const filters: { status?: string; search?: string } = {}
      if (status) filters.status = status
      if (q) filters.search = q
      const res = await api.pestJobSheet.list(filters)
      if (res.success) setJobs(res.data as PestJobSheet[])
      else toastError('Error', res.error?.message ?? 'Could not load job sheets.')
    } catch { toastError('Error', 'Could not load job sheets.') }
  }, [toastError])

  useEffect(() => {
    setLoading(true)
    Promise.all([
      loadContracts(),
      loadJobs(),
      loadKpis(),
      api.hr.listEmployees({ isActive: true }).then((r: { success: boolean; data?: unknown }) => {
        if (!r.success) return
        const d = r.data as { employees?: Employee[] } | Employee[]
        setEmployees(Array.isArray(d) ? d : (d.employees ?? []))
      }),
    ]).finally(() => setLoading(false))
  }, [])

  function openCreateContract() {
    setEditContract(null)
    setContractForm(emptyContractForm())
    setPickedContractClient(null)
    setContractFormError('')
    setShowContractForm(true)
  }

  function openEditContract(c: PestServiceContract) {
    setEditContract(c)
    setPickedContractClient(c.client)
    setContractForm({
      propertyAddress: c.propertyAddress, propertyType: c.propertyType,
      pestTypes: parseSafe<string[]>(c.pestTypes, []), serviceFrequency: c.serviceFrequency,
      startDate: dateSlice(c.startDate), endDate: dateSlice(c.endDate),
      contractValue: String(c.contractValue), status: c.status,
      assignedToId: c.assignedToId ?? '', notes: c.notes ?? '',
    })
    setContractFormError('')
    setShowContractForm(true)
  }

  async function handleSaveContract() {
    if (!editContract && !pickedContractClient) { setContractFormError('Client is required.'); return }
    if (!contractForm.propertyAddress.trim()) { setContractFormError('Property address is required.'); return }
    if (!contractForm.startDate) { setContractFormError('Start date is required.'); return }
    const contractValue = parseFloat(contractForm.contractValue)
    if (isNaN(contractValue) || contractValue < 0) { setContractFormError('Contract value must be a valid number.'); return }
    setContractSaving(true)
    setContractFormError('')
    const payload = {
      clientId: editContract ? editContract.clientId : pickedContractClient!.id, propertyAddress: contractForm.propertyAddress,
      propertyType: contractForm.propertyType, pestTypes: contractForm.pestTypes,
      serviceFrequency: contractForm.serviceFrequency, startDate: contractForm.startDate,
      endDate: contractForm.endDate || undefined, contractValue, status: contractForm.status,
      assignedToId: contractForm.assignedToId || undefined, notes: contractForm.notes || undefined,
    }
    const res = editContract
      ? await api.pestContract.update({ id: editContract.id, ...payload })
      : await api.pestContract.create(payload)
    setContractSaving(false)
    if (res.success) { setShowContractForm(false); await loadContracts(contractStatusFilter || undefined, contractSearch || undefined); loadKpis() }
    else setContractFormError(res.error?.message ?? 'Save failed.')
  }

  async function handleDeleteContract() {
    if (!deleteContractTarget) return
    setDeletingContract(true)
    setActionError(null)
    const res = await api.pestContract.delete(deleteContractTarget.id)
    if (res.success) { setDeleteContractTarget(null); await loadContracts(contractStatusFilter || undefined, contractSearch || undefined); loadKpis() }
    else setActionError(res.error?.message ?? 'Failed to delete contract.')
    setDeletingContract(false)
  }

  function openCreateSheet(contractId?: string, client?: Customer) {
    setEditSheet(null)
    setSheetForm({ ...emptySheetForm(), contractId: contractId ?? '' })
    setPickedSheetClient(client ?? null)
    setSheetFormError('')
    setShowSheetForm(true)
  }

  function openEditSheet(s: PestJobSheet) {
    setEditSheet(s)
    setPickedSheetClient(s.client)
    setSheetForm({
      contractId: s.contractId ?? '',
      visitDate: dateSlice(s.visitDate), scheduledTime: s.scheduledTime ?? '',
      technicianIds: parseSafe<string[]>(s.technicianIds, []), pesticideUsed: s.pesticideUsed ?? '',
      areasServiced: parseSafe<string[]>(s.areasServiced, []), treatmentType: s.treatmentType,
      jobAmount: String(s.jobAmount), clientSignature: s.clientSignature,
      followUpDate: dateSlice(s.followUpDate), notes: s.notes ?? '',
      status: s.status,
    })
    setSheetFormError('')
    setShowSheetForm(true)
  }

  async function handleSaveSheet() {
    if (!editSheet && !pickedSheetClient) { setSheetFormError('Client is required.'); return }
    if (!sheetForm.visitDate) { setSheetFormError('Visit date is required.'); return }
    setSheetSaving(true)
    setSheetFormError('')
    const payload = {
      contractId: sheetForm.contractId || undefined, clientId: editSheet ? editSheet.clientId : pickedSheetClient!.id,
      visitDate: sheetForm.visitDate, scheduledTime: sheetForm.scheduledTime || undefined,
      technicianIds: sheetForm.technicianIds, pesticideUsed: sheetForm.pesticideUsed || undefined,
      areasServiced: sheetForm.areasServiced, treatmentType: sheetForm.treatmentType,
      jobAmount: parseFloat(sheetForm.jobAmount) || 0,
      clientSignature: sheetForm.clientSignature, status: editSheet ? sheetForm.status : undefined,
      followUpDate: sheetForm.followUpDate || undefined, notes: sheetForm.notes || undefined,
    }
    const res = editSheet
      ? await api.pestJobSheet.update({ id: editSheet.id, ...payload })
      : await api.pestJobSheet.create(payload)
    setSheetSaving(false)
    if (res.success) {
      setShowSheetForm(false)
      await Promise.all([
        loadJobs(jobStatusFilter || undefined, jobSearch || undefined),
        loadContracts(contractStatusFilter || undefined, contractSearch || undefined),
      ])
      loadKpis()
    } else setSheetFormError(res.error?.message ?? 'Save failed.')
  }

  async function handleDeleteSheet() {
    if (!deleteSheetTarget) return
    setDeletingSheet(true)
    setActionError(null)
    const res = await api.pestJobSheet.delete(deleteSheetTarget.id)
    if (res.success) {
      setDeleteSheetTarget(null)
      await Promise.all([
        loadJobs(jobStatusFilter || undefined, jobSearch || undefined),
        loadContracts(contractStatusFilter || undefined, contractSearch || undefined),
      ])
      loadKpis()
    } else setActionError(res.error?.message ?? 'Failed to delete job sheet.')
    setDeletingSheet(false)
  }

  async function handleAdvanceJobStatus(sheet: PestJobSheet) {
    const next = JOB_STATUS_NEXT[sheet.status]
    if (!next) return
    setActionError(null)
    const payload = { id: sheet.id, status: next, ...(next === 'COMPLETED' ? { completedDate: new Date().toISOString().slice(0, 10) } : {}) }
    const res = await api.pestJobSheet.update(payload)
    if (res.success) { await loadJobs(jobStatusFilter || undefined, jobSearch || undefined); loadKpis() }
    else setActionError(res.error?.message ?? 'Failed to update status.')
  }

  async function handleGenerateJobInvoice(sheet: PestJobSheet) {
    setInvoiceLoading(sheet.id)
    setInvoiceBanners(prev => { const n = { ...prev }; delete n[sheet.id]; return n })
    const res = await api.pestJobSheet.generateInvoice(sheet.id)
    setInvoiceLoading(null)
    if (res.success) {
      setInvoiceBanners(prev => ({ ...prev, [sheet.id]: { ok: true, msg: 'Invoice generated (SAC 998534, 18% GST).' } }))
      await loadJobs(jobStatusFilter || undefined, jobSearch || undefined)
      loadKpis()
    } else {
      setInvoiceBanners(prev => ({ ...prev, [sheet.id]: { ok: false, msg: res.error?.message ?? 'Invoice generation failed.' } }))
    }
  }

  // Contract-level recurring fee invoicing (contractValue was previously
  // never billed anywhere — only ad-hoc job sheets invoiced). Gated on
  // lastInvoicedPeriod rather than a one-shot flag so the SAME contract can
  // be re-invoiced every period it recurs (monthly/quarterly/etc, per the
  // contract's own serviceFrequency — staff trigger it manually at whatever
  // cadence matches).
  async function handleGenerateContractInvoice(c: PestServiceContract) {
    setInvoiceLoading(c.id)
    setInvoiceBanners(prev => { const n = { ...prev }; delete n[c.id]; return n })
    const res = await api.pestContract.generateInvoice({ id: c.id })
    setInvoiceLoading(null)
    if (res.success) {
      setInvoiceBanners(prev => ({ ...prev, [c.id]: { ok: true, msg: 'Contract invoice generated (SAC 998534, 18% GST).' } }))
      await loadContracts(contractStatusFilter || undefined, contractSearch || undefined)
      loadKpis()
    } else {
      setInvoiceBanners(prev => ({ ...prev, [c.id]: { ok: false, msg: res.error?.message ?? 'Invoice generation failed.' } }))
    }
  }

  function togglePestType(type: string) {
    setContractForm(f => ({
      ...f,
      pestTypes: f.pestTypes.includes(type) ? f.pestTypes.filter(t => t !== type) : [...f.pestTypes, type],
    }))
  }

  function toggleArea(area: string) {
    setSheetForm(f => ({
      ...f,
      areasServiced: f.areasServiced.includes(area) ? f.areasServiced.filter(a => a !== area) : [...f.areasServiced, area],
    }))
  }

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-slate-950">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-gray-200 px-6 py-4 flex items-center justify-between dark:border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center">
            <Bug size={18} className="text-green-700" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Pest Control</h1>
            <p className="text-xs text-gray-500 dark:text-slate-400">Contracts & job sheets</p>
          </div>
        </div>
        <button onClick={tab === 'contracts' ? openCreateContract : () => openCreateSheet()} className="flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white text-sm font-medium px-4 py-2 rounded-lg">
          <Plus size={16} />{tab === 'contracts' ? 'New Contract' : 'New Job Sheet'}
        </button>
      </div>

      {/* KPI bar */}
      <div className="grid grid-cols-3 gap-4 px-6 py-4">
        <KpiCard label="Active Contracts" value={kpis.activeContracts} color="success" />
        <KpiCard label="Pending Job Sheets" value={kpis.pendingJobSheets} color="warning" />
        <KpiCard label="Scheduled This Week" value={kpis.scheduledThisWeek} color="info" />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 bg-white dark:bg-slate-900 px-6 dark:border-slate-700">
        {(['contracts', 'jobs'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === t ? 'border-green-700 text-green-700 dark:text-green-400' : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'}`}>
            {t === 'contracts' ? 'Service Contracts' : 'Job Sheets'}
          </button>
        ))}
      </div>

      {actionError && (
        <div className="mx-6 mt-3 text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-2 flex items-center justify-between">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} className="text-red-400 dark:text-red-500 hover:text-red-600 dark:hover:text-red-400"><X size={14} /></button>
        </div>
      )}

      {/* Contracts tab */}
      {tab === 'contracts' && (
        <>
          <div className="px-6 pt-3 flex items-center gap-3 flex-wrap">
            <div className="flex gap-2 flex-wrap">
              {['', ...CONTRACT_STATUSES].map(s => (
                <button key={s} onClick={() => { setContractStatusFilter(s); loadContracts(s || undefined, contractSearch || undefined) }} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${contractStatusFilter === s ? 'bg-green-700 text-white border-green-700' : 'bg-white dark:bg-slate-900 text-gray-600 dark:text-slate-400 border-gray-300 dark:border-slate-600 hover:border-green-500'}`}>
                  {s || 'All'}
                </button>
              ))}
            </div>
            <div className="relative ml-auto">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
              <input
                value={contractSearch}
                onChange={e => { setContractSearch(e.target.value); loadContracts(contractStatusFilter || undefined, e.target.value || undefined) }}
                placeholder="Contract #, Address, Client…"
                className="pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg text-xs w-52 focus:ring-2 focus:ring-green-500 focus:border-transparent dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100"
              />
            </div>
          </div>
          <div className="flex-1 overflow-auto px-6 py-4">
            {loading ? (
              <div className="text-center py-20 text-gray-400 dark:text-slate-500">Loading...</div>
            ) : contracts.length === 0 ? (
              <div className="text-center py-20 text-gray-400 dark:text-slate-500">
                <Bug size={40} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">No contracts found. Create one to get started.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {contracts.map(c => {
                  const pestTypes = parseSafe<string[]>(c.pestTypes, [])
                  const isExpanded = expandedContractId === c.id
                  const banner = invoiceBanners[c.id]
                  const alreadyInvoicedThisPeriod = c.lastInvoicedPeriod === currentContractPeriod
                  return (
                    <Card key={c.id} padding="none" className="overflow-hidden">
                      <div className="px-5 py-4 flex items-start gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-gray-900 text-sm dark:text-slate-100">{c.contractNumber}</span>
                            <Badge variant={CONTRACT_STATUS_VARIANT[c.status] ?? 'neutral'} size="sm">{c.status}</Badge>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400">{c.serviceFrequency}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400">{c.propertyType}</span>
                          </div>
                          <div className="text-sm text-gray-800 mt-1 dark:text-slate-200">{c.propertyAddress}</div>
                          <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-3 flex-wrap dark:text-slate-400">
                            <span>{c.client.customerName}{c.client.phone ? ` · ${c.client.phone}` : ''}</span>
                            <span>Value: ₹{Number(c.contractValue).toFixed(2)}</span>
                            <span>From: {dateSlice(c.startDate)}</span>
                            {c.endDate && <span>To: {dateSlice(c.endDate)}</span>}
                            {c._count?.jobSheets != null && <span>{c._count.jobSheets} job sheet(s)</span>}
                          </div>
                          {pestTypes.length > 0 && (
                            <div className="flex gap-1 flex-wrap mt-1">
                              {pestTypes.map(p => <span key={p} className="text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 px-1.5 py-0.5 rounded">{p}</span>)}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {c.status === 'ACTIVE' && Number(c.contractValue) > 0 && (
                            alreadyInvoicedThisPeriod ? (
                              <span className="text-xs px-2 py-1 rounded bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800 flex items-center gap-1"><FileText size={10} /> Invoiced ({currentContractPeriod})</span>
                            ) : (
                              <button onClick={() => handleGenerateContractInvoice(c)} disabled={invoiceLoading === c.id} className="text-xs px-2 py-1 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 flex items-center gap-1 disabled:opacity-50" title={c.lastInvoicedPeriod ? `Generate invoice for ${currentContractPeriod}` : 'Generate contract invoice'}>
                                <Receipt size={10} />{invoiceLoading === c.id ? '...' : 'Invoice'}
                              </button>
                            )
                          )}
                          <button onClick={() => openCreateSheet(c.id, c.client)} className="text-xs px-3 py-1.5 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/40 flex items-center gap-1 font-medium">
                            <Plus size={12} /> Job Sheet
                          </button>
                          <button onClick={() => openEditContract(c)} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-200"><Pencil size={15} /></button>
                          <button onClick={() => setDeleteContractTarget(c)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg dark:text-slate-500"><X size={15} /></button>
                          <button onClick={() => setExpandedContractId(isExpanded ? null : c.id)} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-200">
                            {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                          </button>
                        </div>
                      </div>
                      {banner && (
                        <div className={`border-t px-5 py-2 text-xs flex items-center justify-between ${banner.ok ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800' : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'}`}>
                          <span>{banner.msg}</span>
                        </div>
                      )}
                      {isExpanded && c.notes && (
                        <div className="border-t border-gray-100 px-5 py-3 text-xs text-gray-500 dark:border-slate-800 dark:text-slate-400">{c.notes}</div>
                      )}
                    </Card>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* Job sheets tab */}
      {tab === 'jobs' && (
        <>
          <div className="px-6 pt-3 flex items-center gap-3 flex-wrap">
            <div className="flex gap-2 flex-wrap">
              {['', ...JOB_STATUSES].map(s => (
                <button key={s} onClick={() => { setJobStatusFilter(s); loadJobs(s || undefined, jobSearch || undefined) }} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${jobStatusFilter === s ? 'bg-green-700 text-white border-green-700' : 'bg-white dark:bg-slate-900 text-gray-600 dark:text-slate-400 border-gray-300 dark:border-slate-600 hover:border-green-500'}`}>
                  {s || 'All'}
                </button>
              ))}
            </div>
            <div className="relative ml-auto">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
              <input
                value={jobSearch}
                onChange={e => { setJobSearch(e.target.value); loadJobs(jobStatusFilter || undefined, e.target.value || undefined) }}
                placeholder="Job #, Client, Area, Pesticide…"
                className="pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg text-xs w-52 focus:ring-2 focus:ring-green-500 focus:border-transparent dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100"
              />
            </div>
          </div>
          <div className="flex-1 overflow-auto px-6 py-4">
            {loading ? (
              <div className="text-center py-20 text-gray-400 dark:text-slate-500">Loading...</div>
            ) : jobs.length === 0 ? (
              <div className="text-center py-20 text-gray-400 dark:text-slate-500">
                <FileText size={40} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">No job sheets found.</p>
              </div>
            ) : (
              <Card padding="none" className="overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200 dark:bg-slate-950 dark:border-slate-700">
                    <tr>
                      {['Job #', 'Client / Contract', 'Visit Date', 'Treatment', 'Amount', 'Status', 'Actions'].map(h => (
                        <th key={h} className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3 dark:text-slate-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                    {jobs.map(sheet => {
                      const areas = parseSafe<string[]>(sheet.areasServiced, [])
                      const nextStatus = JOB_STATUS_NEXT[sheet.status]
                      const banner = invoiceBanners[sheet.id]
                      return (
                        <Fragment key={sheet.id}>
                          <tr className="hover:bg-gray-50 dark:hover:bg-slate-800">
                            <td className="px-4 py-3 font-medium">{sheet.jobNumber}</td>
                            <td className="px-4 py-3">
                              <div>{sheet.client.customerName}</div>
                              {sheet.contract && <div className="text-xs text-gray-400 dark:text-slate-500">{sheet.contract.contractNumber}</div>}
                            </td>
                            <td className="px-4 py-3">
                              <div>{dateSlice(sheet.visitDate)}</div>
                              {sheet.scheduledTime && <div className="text-xs text-gray-400 dark:text-slate-500">{sheet.scheduledTime}</div>}
                            </td>
                            <td className="px-4 py-3">
                              <div>{sheet.treatmentType}</div>
                              {areas.length > 0 && <div className="text-xs text-gray-400 dark:text-slate-500">{areas.slice(0, 2).join(', ')}{areas.length > 2 ? '...' : ''}</div>}
                            </td>
                            <td className="px-4 py-3 font-medium">₹{Number(sheet.jobAmount).toFixed(2)}</td>
                            <td className="px-4 py-3">
                              <Badge variant={JOB_STATUS_VARIANT[sheet.status] ?? 'neutral'} size="sm">{sheet.status}</Badge>
                              {sheet.clientSignature && <div className="text-xs text-green-600 dark:text-green-400 mt-0.5">✓ Signed</div>}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1 flex-wrap">
                                {nextStatus && (
                                  <button onClick={() => handleAdvanceJobStatus(sheet)} className="text-xs px-2 py-1 rounded bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/40">
                                    → {nextStatus}
                                  </button>
                                )}
                                {sheet.status === 'COMPLETED' && !sheet.invoiceId && Number(sheet.jobAmount) > 0 && (
                                  <button onClick={() => handleGenerateJobInvoice(sheet)} disabled={invoiceLoading === sheet.id} className="text-xs px-2 py-1 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 flex items-center gap-1 disabled:opacity-50">
                                    <Receipt size={10} />{invoiceLoading === sheet.id ? '...' : 'Invoice'}
                                  </button>
                                )}
                                {sheet.invoiceId && <span className="text-xs px-2 py-1 rounded bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800 flex items-center gap-1"><FileText size={10} /> Invoiced</span>}
                                <button onClick={() => openEditSheet(sheet)} className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-200"><Pencil size={13} /></button>
                                <button onClick={() => setDeleteSheetTarget(sheet)} className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded dark:text-slate-500"><X size={13} /></button>
                              </div>
                            </td>
                          </tr>
                          {banner && (
                            <tr>
                              <td colSpan={7} className="px-4 pb-2">
                                <div className={`text-xs rounded-lg px-3 py-1.5 flex items-center justify-between ${banner.ok ? 'bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800' : 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'}`}>
                                  <span>{banner.msg}</span>
                                  <button onClick={() => setInvoiceBanners(prev => { const n = { ...prev }; delete n[sheet.id]; return n })}><X size={11} /></button>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </Card>
            )}
          </div>
        </>
      )}

      {/* Contract form modal */}
      {showContractForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700">
              <h2 className="text-base font-semibold">{editContract ? `Edit Contract — ${editContract.contractNumber}` : 'New Service Contract'}</h2>
              <button onClick={() => setShowContractForm(false)} className="text-gray-400 hover:text-gray-700 dark:text-slate-500 dark:hover:text-slate-200"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {contractFormError && <div className="text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-2">{contractFormError}</div>}
              <div className="grid grid-cols-2 gap-4">
                {editContract ? (
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block dark:text-slate-400">Client</label>
                    <div className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 dark:border-slate-700 dark:bg-slate-800 text-gray-500 dark:text-slate-400">
                      {editContract.client.customerName}
                    </div>
                  </div>
                ) : (
                  <CustomerPicker label="Client *" value={pickedContractClient} onChange={setPickedContractClient} placeholder="Search by name or phone..." />
                )}
                <Select label="Property Type" value={contractForm.propertyType} onChange={e => setContractForm(f => ({ ...f, propertyType: e.target.value }))}>
                  {PROPERTY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </Select>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-gray-600 mb-1 block dark:text-slate-400">Property Address *</label>
                  <input value={contractForm.propertyAddress} onChange={e => setContractForm(f => ({ ...f, propertyAddress: e.target.value }))} placeholder="Full address" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                </div>
                <Select label="Service Frequency" value={contractForm.serviceFrequency} onChange={e => setContractForm(f => ({ ...f, serviceFrequency: e.target.value }))}>
                  {FREQUENCIES.map(f => <option key={f} value={f}>{f.replace(/_/g, ' ')}</option>)}
                </Select>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block dark:text-slate-400">Contract Value (₹) *</label>
                  <input type="number" min="0" value={contractForm.contractValue} onChange={e => setContractForm(f => ({ ...f, contractValue: e.target.value }))} placeholder="0.00" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block dark:text-slate-400">Start Date *</label>
                  <input type="date" value={contractForm.startDate} onChange={e => setContractForm(f => ({ ...f, startDate: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block dark:text-slate-400">End Date</label>
                  <input type="date" value={contractForm.endDate} onChange={e => setContractForm(f => ({ ...f, endDate: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                </div>
                <Select label="Assigned To" value={contractForm.assignedToId} onChange={e => setContractForm(f => ({ ...f, assignedToId: e.target.value }))}>
                  <option value="">Unassigned</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.fullName}</option>)}
                </Select>
                {editContract && (
                  <Select label="Status" value={contractForm.status} onChange={e => setContractForm(f => ({ ...f, status: e.target.value }))}>
                    {CONTRACT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </Select>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-2 block dark:text-slate-400">Pest Types</label>
                <div className="flex gap-2 flex-wrap">
                  {PEST_TYPES_LIST.map(p => (
                    <button key={p} type="button" onClick={() => togglePestType(p)} className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${contractForm.pestTypes.includes(p) ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700' : 'bg-white dark:bg-slate-900 text-gray-600 dark:text-slate-400 border-gray-300 dark:border-slate-600 hover:border-amber-400'}`}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block dark:text-slate-400">Notes</label>
                <textarea value={contractForm.notes} onChange={e => setContractForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3 dark:border-slate-700">
              <button onClick={() => setShowContractForm(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-800">Cancel</button>
              <button onClick={handleSaveContract} disabled={contractSaving} className="px-5 py-2 text-sm font-medium bg-green-700 hover:bg-green-800 text-white rounded-lg disabled:opacity-50">
                {contractSaving ? 'Saving...' : editContract ? 'Update Contract' : 'Create Contract'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Job sheet form modal */}
      {showSheetForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700">
              <h2 className="text-base font-semibold">{editSheet ? `Edit Job Sheet — ${editSheet.jobNumber}` : 'New Job Sheet'}</h2>
              <button onClick={() => setShowSheetForm(false)} className="text-gray-400 hover:text-gray-700 dark:text-slate-500 dark:hover:text-slate-200"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {sheetFormError && <div className="text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-2">{sheetFormError}</div>}
              <div className="grid grid-cols-2 gap-4">
                {editSheet ? (
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block dark:text-slate-400">Client</label>
                    <div className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 dark:border-slate-700 dark:bg-slate-800 text-gray-500 dark:text-slate-400">
                      {editSheet.client.customerName}
                    </div>
                  </div>
                ) : (
                  <CustomerPicker label="Client *" value={pickedSheetClient} onChange={setPickedSheetClient} placeholder="Search by name or phone..." />
                )}
                <Select label="Contract (optional)" value={sheetForm.contractId} onChange={e => setSheetForm(f => ({ ...f, contractId: e.target.value }))}>
                  <option value="">One-time / Ad-hoc</option>
                  {contracts.filter(c => c.status === 'ACTIVE').map(c => <option key={c.id} value={c.id}>{c.contractNumber} — {c.client.customerName}</option>)}
                </Select>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block dark:text-slate-400">Visit Date *</label>
                  <input type="date" value={sheetForm.visitDate} onChange={e => setSheetForm(f => ({ ...f, visitDate: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block dark:text-slate-400">Scheduled Time</label>
                  <input type="time" value={sheetForm.scheduledTime} onChange={e => setSheetForm(f => ({ ...f, scheduledTime: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                </div>
                <Select label="Treatment Type" value={sheetForm.treatmentType} onChange={e => setSheetForm(f => ({ ...f, treatmentType: e.target.value }))}>
                  {TREATMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </Select>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block dark:text-slate-400">Job Amount (₹)</label>
                  <input type="number" min="0" value={sheetForm.jobAmount} onChange={e => setSheetForm(f => ({ ...f, jobAmount: e.target.value }))} placeholder="0.00" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-gray-600 mb-1 block dark:text-slate-400">Pesticide Used</label>
                  <input value={sheetForm.pesticideUsed} onChange={e => setSheetForm(f => ({ ...f, pesticideUsed: e.target.value }))} placeholder="e.g. Cypermethrin 25 EC" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-2 block dark:text-slate-400">Areas Serviced</label>
                <div className="flex gap-2 flex-wrap">
                  {COMMON_AREAS.map(a => (
                    <button key={a} type="button" onClick={() => toggleArea(a)} className={`text-xs px-2.5 py-1.5 rounded-full border font-medium transition-colors ${sheetForm.areasServiced.includes(a) ? 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700' : 'bg-white dark:bg-slate-900 text-gray-600 dark:text-slate-400 border-gray-300 dark:border-slate-600 hover:border-green-400'}`}>
                      {a}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-2 block dark:text-slate-400">Technicians ({sheetForm.technicianIds.length} selected)</label>
                <div className="grid grid-cols-3 gap-2 max-h-24 overflow-y-auto border border-gray-200 rounded-lg p-2 dark:border-slate-700">
                  {employees.map(e => (
                    <label key={e.id} className="flex items-center gap-2 text-xs cursor-pointer">
                      <input type="checkbox" checked={sheetForm.technicianIds.includes(e.id)} onChange={ev => setSheetForm(f => ({ ...f, technicianIds: ev.target.checked ? [...f.technicianIds, e.id] : f.technicianIds.filter(x => x !== e.id) }))} className="rounded" />
                      {e.fullName}
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block dark:text-slate-400">Follow-up Date</label>
                  <input type="date" value={sheetForm.followUpDate} onChange={e => setSheetForm(f => ({ ...f, followUpDate: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block dark:text-slate-400">Notes</label>
                  <input value={sheetForm.notes} onChange={e => setSheetForm(f => ({ ...f, notes: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                </div>
                {editSheet && (
                  <Select label="Status" value={sheetForm.status} onChange={e => setSheetForm(f => ({ ...f, status: e.target.value }))}>
                    {JOB_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </Select>
                )}
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={sheetForm.clientSignature} onChange={e => setSheetForm(f => ({ ...f, clientSignature: e.target.checked }))} className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500 dark:border-slate-600" />
                <span className="text-sm text-gray-700 dark:text-slate-300">Client Signature Obtained</span>
              </label>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3 dark:border-slate-700">
              <button onClick={() => setShowSheetForm(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-800">Cancel</button>
              <button onClick={handleSaveSheet} disabled={sheetSaving} className="px-5 py-2 text-sm font-medium bg-green-700 hover:bg-green-800 text-white rounded-lg disabled:opacity-50">
                {sheetSaving ? 'Saving...' : editSheet ? 'Update' : 'Create Job Sheet'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteContractTarget}
        onClose={() => setDeleteContractTarget(null)}
        onConfirm={handleDeleteContract}
        loading={deletingContract}
        title="Delete Contract"
        message="Delete this contract? This will fail if the contract has existing job sheets."
        confirmLabel="Delete"
      />

      <ConfirmDialog
        open={!!deleteSheetTarget}
        onClose={() => setDeleteSheetTarget(null)}
        onConfirm={handleDeleteSheet}
        loading={deletingSheet}
        title="Delete Job Sheet"
        message="Delete this job sheet?"
        confirmLabel="Delete"
      />
    </div>
  )
}
