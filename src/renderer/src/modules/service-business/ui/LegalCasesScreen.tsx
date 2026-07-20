import React, { useEffect, useState, useCallback } from 'react'
import { Scale, Plus, X, Search, RefreshCw, Clock, ExternalLink, ChevronRight, CheckCircle, AlertTriangle, Calendar } from 'lucide-react'
import { api } from '@renderer/services/ipc-client'
import { cn } from '@shared/utils/cn'
import { Card } from '@shared/ui/molecules/Card'
import { KpiCard } from '@shared/ui/molecules/KpiCard'
import { Tabs } from '@shared/ui/molecules/Tabs'
import { Badge } from '@shared/ui/atoms/Badge'
import { Select } from '@shared/ui/atoms/Select'
import { useNotificationStore } from '@app/store/notification.store'
import { DocumentPanel } from '@modules/documents/ui/DocumentPanel'

// ── Types ─────────────────────────────────────────────────────────────────────

interface LegalCase {
  id: string
  caseNumber: string
  caseTitle: string
  caseType: string
  courtName: string
  courtDistrict: string | null
  courtState: string | null
  eCourtId: string | null
  clientId: string
  advocateId: string | null
  status: string
  filingDate: string | null
  nextHearingDate: string | null
  opposingPartyName: string | null
  limitationDate: string | null
  feeAgreed: number | null
  feeCollected: number
  notes: string | null
  client: { id: string; customerName: string; phone: string | null }
  advocate: { id: string; fullName: string } | null
  _count: { hearings: number; timeEntries: number }
}

interface LegalCaseDetail extends LegalCase {
  hearings: Hearing[]
  timeEntries: TimeEntry[]
}

interface Hearing {
  id: string
  caseId: string
  hearingDate: string
  hearingTime: string | null
  courtRoom: string | null
  purpose: string | null
  status: string
  outcome: string | null
  nextDate: string | null
  notes: string | null
  case?: { id: string; caseNumber: string; caseTitle: string; caseType: string; courtName: string; client: { id: string; customerName: string } }
}

interface TimeEntry {
  id: string
  date: string
  description: string
  hours: number
  ratePerHour: number
  amount: number
  isBilled: boolean
  employee: { id: string; fullName: string } | null
  case: { id: string; caseNumber: string; caseTitle: string } | null
}

interface Customer { id: string; customerName: string; phone: string | null }
interface Employee { id: string; fullName: string }

// ── Constants ─────────────────────────────────────────────────────────────────

const CASE_TYPES = ['CIVIL', 'CRIMINAL', 'FAMILY', 'CORPORATE', 'PROPERTY', 'ARBITRATION', 'OTHER']
const PURPOSES = ['Arguments', 'Evidence', 'Framing of Issues', 'Judgment', 'Bail Hearing', 'Interim Order', 'Other']

// Exhaustive against LegalCase.status in prisma/schema.prisma (ACTIVE|CLOSED|STAYED|DISPOSED|TRANSFERRED)
const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'info' | 'neutral'> = {
  ACTIVE: 'success',
  CLOSED: 'neutral',
  STAYED: 'warning',
  DISPOSED: 'info',
  TRANSFERRED: 'neutral',
}

// Exhaustive against Hearing.status in prisma/schema.prisma (SCHEDULED|COMPLETED|ADJOURNED|CANCELLED)
const HEARING_STATUS_VARIANT: Record<string, 'success' | 'warning' | 'info' | 'danger'> = {
  SCHEDULED: 'info',
  COMPLETED: 'success',
  ADJOURNED: 'warning',
  CANCELLED: 'danger',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function isToday(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
}

function isSoon(iso: string) {
  const diff = (new Date(iso).getTime() - Date.now()) / 86400000
  return diff >= 0 && diff <= 3
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export function LegalCasesScreen() {
  const { error: toastError } = useNotificationStore()
  const [tab, setTab] = useState<'cases' | 'hearings' | 'time'>('cases')

  // Cases state
  const [cases, setCases] = useState<LegalCase[]>([])
  const [kpiCases, setKpiCases] = useState<LegalCase[]>([])
  const [statusFilter, setStatusFilter] = useState('ACTIVE')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedCase, setSelectedCase] = useState<LegalCaseDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  // New Case form
  const [showCaseForm, setShowCaseForm] = useState(false)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [caseForm, setCaseForm] = useState({ caseNumber: '', caseTitle: '', caseType: 'CIVIL', courtName: '', courtDistrict: '', courtState: '', eCourtId: '', clientId: '', advocateId: '', filingDate: '', opposingPartyName: '', limitationDate: '', feeAgreed: '', notes: '' })
  const [savingCase, setSavingCase] = useState(false)
  const [caseError, setCaseError] = useState<string | null>(null)

  // Basic conflict-of-interest check (Phase 58 §2) — advisory, live-checked
  // as the New Case form is filled, mirrors Blood Bank's live compatibility
  // note pattern but never blocks submission (a real conflict call needs
  // professional judgment, unlike an objective safety fact).
  const [conflicts, setConflicts] = useState<Array<{ caseId: string; caseNumber: string; caseTitle: string; reason: string }>>([])
  const [checkingConflicts, setCheckingConflicts] = useState(false)

  // Inline limitation-date editor (Phase 58 §2) — a case may not have a
  // known deadline at intake, so this is settable/updatable at any time from
  // the detail panel rather than only at creation.
  const [limitationForm, setLimitationForm] = useState('')
  const [savingLimitation, setSavingLimitation] = useState(false)

  // Hearings state (global tab)
  const [hearings, setHearings] = useState<Hearing[]>([])
  const [hearingDateFilter, setHearingDateFilter] = useState<'upcoming' | 'today' | 'all'>('upcoming')
  const [loadingHearings, setLoadingHearings] = useState(false)

  // Add Hearing form (inside case detail)
  const [showHearingForm, setShowHearingForm] = useState(false)
  const [hearingForm, setHearingForm] = useState({ hearingDate: '', hearingTime: '', courtRoom: '', purpose: '', notes: '' })
  const [savingHearing, setSavingHearing] = useState(false)
  const [hearingError, setHearingError] = useState<string | null>(null)

  // Adjourn modal
  const [adjournHearing, setAdjournHearing] = useState<Hearing | null>(null)
  const [adjournForm, setAdjournForm] = useState({ outcome: '', nextDate: '' })
  const [savingAdjourn, setSavingAdjourn] = useState(false)

  // Time entry form (inside case detail)
  const [showTimeForm, setShowTimeForm] = useState(false)
  const [timeForm, setTimeForm] = useState({ date: new Date().toISOString().slice(0, 10), description: '', hours: '', ratePerHour: '', employeeId: '' })
  const [savingTime, setSavingTime] = useState(false)
  const [timeError, setTimeError] = useState<string | null>(null)

  // Time entries global tab
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([])
  const [loadingTime, setLoadingTime] = useState(false)
  const [billedFilter, setBilledFilter] = useState<'all' | 'unbilled' | 'billed'>('unbilled')
  const [selectedTimeIds, setSelectedTimeIds] = useState<Set<string>>(new Set())
  const [markingBilled, setMarkingBilled] = useState(false)

  // ── Loaders ──────────────────────────────────────────────────────────────────

  const loadCases = useCallback(async () => {
    setLoading(true)
    setError(null)
    const res = await api.legalCase.list({ status: statusFilter || undefined, search: search || undefined })
    if (res.success) setCases(res.data as LegalCase[])
    else setError(res.error?.message ?? 'Could not load cases.')
    setLoading(false)
  }, [statusFilter, search])

  const loadHearings = useCallback(async () => {
    setLoadingHearings(true)
    try {
      const filters: Record<string, unknown> = { status: 'SCHEDULED' }
      if (hearingDateFilter === 'today') {
        const now = new Date()
        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
        filters.fromDate = today; filters.toDate = today
      } else if (hearingDateFilter === 'upcoming') {
        const now = new Date()
        filters.fromDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
      } else {
        delete filters.status
      }
      const res = await api.hearing.list(filters)
      if (res.success) setHearings(res.data as Hearing[])
      else toastError('Error', res.error?.message ?? 'Could not load hearings.')
    } catch {
      toastError('Error', 'Could not load hearings.')
    } finally {
      setLoadingHearings(false)
    }
  }, [hearingDateFilter, toastError])

  const loadTimeEntries = useCallback(async () => {
    setLoadingTime(true)
    try {
      const filters: Record<string, unknown> = {}
      if (billedFilter === 'unbilled') filters.isBilled = false
      if (billedFilter === 'billed') filters.isBilled = true
      const res = await api.timeEntry.list(filters)
      if (res.success) setTimeEntries(res.data as TimeEntry[])
      else toastError('Error', res.error?.message ?? 'Could not load time entries.')
    } catch {
      toastError('Error', 'Could not load time entries.')
    } finally {
      setLoadingTime(false)
    }
  }, [billedFilter, toastError])

  const loadCaseDetail = useCallback(async (id: string) => {
    setLoadingDetail(true)
    try {
      const res = await api.legalCase.get({ id })
      if (res.success) {
        const detail = res.data as LegalCaseDetail
        setSelectedCase(detail)
        setLimitationForm(detail.limitationDate ? detail.limitationDate.slice(0, 10) : '')
      } else {
        toastError('Error', res.error?.message ?? 'Could not load case detail.')
      }
    } catch {
      toastError('Error', 'Could not load case detail.')
    } finally {
      setLoadingDetail(false)
    }
  }, [toastError])

  const loadKpiStats = useCallback(async () => {
    try {
      const res = await api.legalCase.list({})
      if (res.success) setKpiCases(res.data as LegalCase[])
    } catch { /* KPI strip is supplementary — cases list itself already surfaces load errors */ }
  }, [])

  useEffect(() => {
    if (tab === 'cases') { loadCases(); loadKpiStats() }
    else if (tab === 'hearings') loadHearings()
    else loadTimeEntries()
  }, [tab, loadCases, loadHearings, loadTimeEntries, loadKpiStats])

  async function loadFormData() {
    try {
      const [cRes, eRes] = await Promise.all([
        api.customers.list({ limit: 1000 }),
        api.hr.listEmployees({ isActive: true }),
      ])
      if (cRes.success) setCustomers((cRes.data as { customers: Customer[] }).customers ?? [])
      else toastError('Error', cRes.error?.message ?? 'Could not load clients.')
      if (eRes.success) {
        setEmployees((eRes.data as { employees?: Employee[] }).employees ?? (eRes.data as Employee[]))
      } else {
        toastError('Error', eRes.error?.message ?? 'Could not load advocates.')
      }
    } catch {
      toastError('Error', 'Could not load form data.')
    }
  }

  // Live conflict-of-interest check, debounced, as the New Case form is
  // filled — advisory only, never blocks handleSaveCase below.
  useEffect(() => {
    if (!showCaseForm) return
    if (!caseForm.clientId && !caseForm.opposingPartyName.trim()) { setConflicts([]); return }
    setCheckingConflicts(true)
    const t = setTimeout(async () => {
      try {
        const res = await api.legalCase.checkConflict({
          clientId: caseForm.clientId || undefined,
          opposingPartyName: caseForm.opposingPartyName.trim() || undefined,
        })
        if (res.success) setConflicts((res.data as { conflicts: typeof conflicts }).conflicts)
      } finally {
        setCheckingConflicts(false)
      }
    }, 400)
    return () => clearTimeout(t)
  }, [showCaseForm, caseForm.clientId, caseForm.opposingPartyName])

  // ── Case handlers ─────────────────────────────────────────────────────────────

  async function handleSaveCase() {
    if (!caseForm.caseNumber.trim() || !caseForm.caseTitle.trim() || !caseForm.courtName.trim() || !caseForm.clientId) {
      setCaseError('Case number, title, court name, and client are required.')
      return
    }
    setSavingCase(true)
    setCaseError(null)
    const res = await api.legalCase.create({
      caseNumber: caseForm.caseNumber.trim(),
      caseTitle: caseForm.caseTitle.trim(),
      caseType: caseForm.caseType,
      courtName: caseForm.courtName.trim(),
      courtDistrict: caseForm.courtDistrict || undefined,
      courtState: caseForm.courtState || undefined,
      eCourtId: caseForm.eCourtId || undefined,
      clientId: caseForm.clientId,
      advocateId: caseForm.advocateId || undefined,
      filingDate: caseForm.filingDate || undefined,
      opposingPartyName: caseForm.opposingPartyName.trim() || undefined,
      limitationDate: caseForm.limitationDate || undefined,
      feeAgreed: caseForm.feeAgreed ? Number(caseForm.feeAgreed) : undefined,
      notes: caseForm.notes || undefined,
    })
    setSavingCase(false)
    if (res.success) {
      setShowCaseForm(false)
      loadCases()
      loadKpiStats()
    } else {
      setCaseError(res.error?.message ?? 'Could not save case.')
    }
  }

  async function handleSaveLimitationDate() {
    if (!selectedCase) return
    setSavingLimitation(true)
    const res = await api.legalCase.update({ id: selectedCase.id, limitationDate: limitationForm || null })
    setSavingLimitation(false)
    if (res.success) {
      loadCaseDetail(selectedCase.id)
    } else {
      toastError('Error', res.error?.message ?? 'Could not update deadline.')
    }
  }

  async function handleCaseStatusChange(id: string, status: string) {
    try {
      const res = await api.legalCase.update({ id, status })
      if (res.success) {
        loadCases()
        loadKpiStats()
        if (selectedCase?.id === id) loadCaseDetail(id)
      } else {
        toastError('Error', res.error?.message ?? 'Could not update case status.')
      }
    } catch {
      toastError('Error', 'Could not update case status.')
    }
  }

  // ── Hearing handlers ──────────────────────────────────────────────────────────

  async function handleSaveHearing() {
    if (!selectedCase || !hearingForm.hearingDate) { setHearingError('Hearing date is required.'); return }
    setSavingHearing(true)
    setHearingError(null)
    const res = await api.hearing.create({
      caseId: selectedCase.id,
      hearingDate: hearingForm.hearingDate,
      hearingTime: hearingForm.hearingTime || undefined,
      courtRoom: hearingForm.courtRoom || undefined,
      purpose: hearingForm.purpose || undefined,
      notes: hearingForm.notes || undefined,
    })
    setSavingHearing(false)
    if (res.success) {
      setShowHearingForm(false)
      setHearingForm({ hearingDate: '', hearingTime: '', courtRoom: '', purpose: '', notes: '' })
      loadCaseDetail(selectedCase.id)
      loadCases()
      loadKpiStats()
    } else {
      setHearingError(res.error?.message ?? 'Could not add hearing.')
    }
  }

  async function handleCompleteHearing(id: string) {
    try {
      const res = await api.hearing.update({ id, status: 'COMPLETED', outcome: 'Hearing completed.' })
      if (res.success) {
        if (selectedCase) loadCaseDetail(selectedCase.id)
        loadCases()
        loadKpiStats()
        if (tab === 'hearings') loadHearings()
      } else {
        toastError('Error', res.error?.message ?? 'Could not complete hearing.')
      }
    } catch {
      toastError('Error', 'Could not complete hearing.')
    }
  }

  async function handleAdjourn() {
    if (!adjournHearing) return
    setSavingAdjourn(true)
    try {
      const res = await api.hearing.update({ id: adjournHearing.id, status: 'ADJOURNED', outcome: adjournForm.outcome || undefined, nextDate: adjournForm.nextDate || undefined })
      if (res.success) {
        setAdjournHearing(null)
        setAdjournForm({ outcome: '', nextDate: '' })
        if (selectedCase) loadCaseDetail(selectedCase.id)
        loadCases()
        loadKpiStats()
        if (tab === 'hearings') loadHearings()
      } else {
        toastError('Error', res.error?.message ?? 'Could not adjourn hearing.')
      }
    } catch {
      toastError('Error', 'Could not adjourn hearing.')
    } finally {
      setSavingAdjourn(false)
    }
  }

  // ── Time entry handlers ───────────────────────────────────────────────────────

  async function handleSaveTime() {
    if (!selectedCase || !timeForm.description.trim() || !timeForm.hours || !timeForm.date) {
      setTimeError('Date, description, and hours are required.')
      return
    }
    setSavingTime(true)
    setTimeError(null)
    const res = await api.timeEntry.create({
      caseId: selectedCase.id,
      employeeId: timeForm.employeeId || undefined,
      date: timeForm.date,
      description: timeForm.description.trim(),
      hours: Number(timeForm.hours),
      ratePerHour: Number(timeForm.ratePerHour) || 0,
    })
    setSavingTime(false)
    if (res.success) {
      setShowTimeForm(false)
      setTimeForm({ date: new Date().toISOString().slice(0, 10), description: '', hours: '', ratePerHour: '', employeeId: '' })
      loadCaseDetail(selectedCase.id)
    } else {
      setTimeError(res.error?.message ?? 'Could not log time.')
    }
  }

  async function handleDeleteTime(id: string) {
    try {
      const res = await api.timeEntry.delete({ id })
      if (res.success) {
        if (selectedCase) loadCaseDetail(selectedCase.id)
        if (tab === 'time') loadTimeEntries()
      } else {
        toastError('Error', res.error?.message ?? 'Could not delete time entry.')
      }
    } catch {
      toastError('Error', 'Could not delete time entry.')
    }
  }

  async function handleMarkBilled() {
    if (selectedTimeIds.size === 0) return
    setMarkingBilled(true)
    try {
      const res = await api.timeEntry.markBilled({ ids: Array.from(selectedTimeIds) })
      if (res.success) {
        setSelectedTimeIds(new Set())
        loadTimeEntries()
      } else {
        toastError('Error', res.error?.message ?? 'Could not mark entries as billed.')
      }
    } catch {
      toastError('Error', 'Could not mark entries as billed.')
    } finally {
      setMarkingBilled(false)
    }
  }

  function toggleTimeId(id: string) {
    setSelectedTimeIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  // ── KPIs ─────────────────────────────────────────────────────────────────────

  const active = kpiCases.filter((c) => c.status === 'ACTIVE').length
  const todayHearings = kpiCases.filter((c) => c.nextHearingDate && isToday(c.nextHearingDate)).length
  const soonHearings = kpiCases.filter((c) => c.nextHearingDate && isSoon(c.nextHearingDate) && !isToday(c.nextHearingDate)).length
  const closed = kpiCases.filter((c) => c.status === 'CLOSED' || c.status === 'DISPOSED').length

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Legal Cases</h1>
          <p className="text-sm text-muted-foreground">Manage cases, hearings, and time entries</p>
        </div>
        {tab === 'cases' && (
          <button
            onClick={() => { setShowCaseForm(true); setCaseError(null); setConflicts([]); setCaseForm({ caseNumber: '', caseTitle: '', caseType: 'CIVIL', courtName: '', courtDistrict: '', courtState: '', eCourtId: '', clientId: '', advocateId: '', filingDate: '', opposingPartyName: '', limitationDate: '', feeAgreed: '', notes: '' }); loadFormData() }}
            className="h-10 px-4 bg-primary text-primary-foreground rounded-xl text-sm font-medium flex items-center gap-2"
          >
            <Plus size={16} /> New Case
          </button>
        )}
      </div>

      {/* KPIs (visible on Cases tab) */}
      {tab === 'cases' && (
        <div className="grid grid-cols-4 gap-4">
          <KpiCard label="Active Cases" value={active} color="neutral" />
          <KpiCard label="Today's Hearings" value={todayHearings} color="danger" />
          <KpiCard label="Hearings in 3 Days" value={soonHearings} color="warning" />
          <KpiCard label="Closed / Disposed" value={closed} color="neutral" />
        </div>
      )}

      {/* Tabs */}
      <Tabs
        tabs={[
          { id: 'cases', label: 'Cases' },
          { id: 'hearings', label: 'Upcoming Hearings' },
          { id: 'time', label: 'Time Entries' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {error && <div className="text-sm text-danger bg-danger/5 border border-danger/20 rounded-xl px-3 py-2">{error}</div>}

      {/* ── CASES TAB ──────────────────────────────────────────────────────────── */}
      {tab === 'cases' && (
        <div className="flex gap-6">
          {/* Left: Cases list */}
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-xs">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search case, title, court..." className="w-full h-10 pl-9 pr-3 rounded-xl border border-border bg-card text-sm text-foreground" />
              </div>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-10 px-3 rounded-xl border border-border bg-card text-sm text-foreground">
                <option value="">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="STAYED">Stayed</option>
                <option value="DISPOSED">Disposed</option>
                <option value="CLOSED">Closed</option>
                <option value="TRANSFERRED">Transferred</option>
              </select>
              <button onClick={loadCases} className="h-10 w-10 flex items-center justify-center rounded-xl border border-border hover:bg-muted/50 text-muted-foreground">
                <RefreshCw size={16} />
              </button>
            </div>

            <Card padding="none" className="overflow-hidden">
              {loading ? (
                <div className="p-12 text-center text-muted-foreground text-sm">Loading...</div>
              ) : cases.length === 0 ? (
                <div className="p-12 text-center">
                  <Scale size={32} className="mx-auto mb-3 text-muted-foreground/40" />
                  <p className="text-muted-foreground">No cases found. Add your first case.</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/20">
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Case</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Client</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Next Hearing</th>
                      <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                      <th className="text-center px-4 py-3 font-medium text-muted-foreground"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cases.map((c) => (
                      <tr
                        key={c.id}
                        onClick={() => { setSelectedCase(null); setShowHearingForm(false); setShowTimeForm(false); loadCaseDetail(c.id) }}
                        className={cn('border-b border-border/50 cursor-pointer transition-colors', selectedCase?.id === c.id ? 'bg-primary/5 border-l-2 border-l-primary' : 'hover:bg-muted/20')}
                      >
                        <td className="px-4 py-3">
                          <p className="font-semibold text-foreground">{c.caseNumber}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[220px]">{c.caseTitle}</p>
                          <p className="text-xs text-muted-foreground">{c.courtName}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-foreground">{c.client.customerName}</p>
                          {c.client.phone && <p className="text-xs text-muted-foreground">{c.client.phone}</p>}
                        </td>
                        <td className="px-4 py-3">
                          {c.nextHearingDate ? (
                            <p className={cn('text-sm font-medium', isToday(c.nextHearingDate) ? 'text-danger' : isSoon(c.nextHearingDate) ? 'text-warning' : 'text-foreground')}>
                              {formatDate(c.nextHearingDate)}
                            </p>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant={STATUS_VARIANT[c.status] ?? 'neutral'} size="sm">{c.status}</Badge>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <ChevronRight size={16} className="text-muted-foreground mx-auto" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          </div>

          {/* Right: Case Detail Panel */}
          {(selectedCase || loadingDetail) && (
            <div className="w-96 shrink-0 space-y-4">
              {loadingDetail ? (
                <Card padding="lg" className="text-center text-muted-foreground text-sm">Loading...</Card>
              ) : selectedCase ? (
                <>
                  {/* Case Info */}
                  <Card padding="lg" className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-bold text-foreground text-base">{selectedCase.caseNumber}</p>
                        <p className="text-sm text-foreground">{selectedCase.caseTitle}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {selectedCase.eCourtId && (
                          <button
                            onClick={() => window.open(`https://services.ecourts.gov.in/ecourtindia_v6/?p=casestatus/index`, '_blank')}
                            className="h-8 px-2 rounded-lg border border-border text-xs text-info hover:bg-info/5 flex items-center gap-1"
                            title={`eCourt ID: ${selectedCase.eCourtId}`}
                          >
                            <ExternalLink size={11} /> eCourt
                          </button>
                        )}
                        <button onClick={() => setSelectedCase(null)} className="text-muted-foreground hover:text-foreground">
                          <X size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                      <div><span className="text-muted-foreground">Type: </span><span className="text-foreground">{selectedCase.caseType}</span></div>
                      <div><span className="text-muted-foreground">Status: </span><span className={cn('font-medium', selectedCase.status === 'ACTIVE' ? 'text-success' : 'text-muted-foreground')}>{selectedCase.status}</span></div>
                      <div><span className="text-muted-foreground">Court: </span><span className="text-foreground">{selectedCase.courtName}</span></div>
                      {selectedCase.advocate && <div><span className="text-muted-foreground">Advocate: </span><span className="text-foreground">{selectedCase.advocate.fullName}</span></div>}
                      {selectedCase.filingDate && <div><span className="text-muted-foreground">Filed: </span><span className="text-foreground">{formatDate(selectedCase.filingDate)}</span></div>}
                      {selectedCase.opposingPartyName && <div className="col-span-2"><span className="text-muted-foreground">Opposing Party: </span><span className="text-foreground">{selectedCase.opposingPartyName}</span></div>}
                      {selectedCase.feeAgreed != null && (
                        <div className="col-span-2">
                          <span className="text-muted-foreground">Fee: </span>
                          <span className="text-foreground">₹{Number(selectedCase.feeAgreed).toLocaleString('en-IN')} agreed · ₹{Number(selectedCase.feeCollected).toLocaleString('en-IN')} collected</span>
                        </div>
                      )}
                    </div>

                    {selectedCase.status === 'ACTIVE' && (
                      <div className="flex gap-2 pt-1">
                        <button onClick={() => handleCaseStatusChange(selectedCase.id, 'CLOSED')} className="flex-1 h-8 rounded-lg border border-border text-xs text-muted-foreground hover:bg-muted/50">Close Case</button>
                        <button onClick={() => handleCaseStatusChange(selectedCase.id, 'DISPOSED')} className="flex-1 h-8 rounded-lg border border-border text-xs text-muted-foreground hover:bg-muted/50">Mark Disposed</button>
                      </div>
                    )}

                    <div className="border border-border rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-foreground flex items-center gap-1.5"><Clock size={13} /> Limitation / Deadline Date</p>
                        {selectedCase.limitationDate && (
                          <span className={cn('text-xs font-medium', isSoon(selectedCase.limitationDate) || isToday(selectedCase.limitationDate) ? 'text-danger' : 'text-muted-foreground')}>
                            {formatDate(selectedCase.limitationDate)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="date" value={limitationForm} onChange={(e) => setLimitationForm(e.target.value)} className="flex-1 h-9 px-2 rounded-lg border border-border bg-background text-foreground text-xs" />
                        <button onClick={handleSaveLimitationDate} disabled={savingLimitation} className="h-9 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50">
                          {savingLimitation ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground">Client gets a WhatsApp reminder 30 and 7 days before this date.</p>
                    </div>

                    <DocumentPanel entityType="LEGAL_CASE" entityId={selectedCase.id} compact />
                  </Card>

                  {/* Hearings */}
                  <Card padding="lg" className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-foreground text-sm">Hearings ({selectedCase.hearings.length})</p>
                      <button
                        onClick={() => { setShowHearingForm(true); setHearingError(null); setHearingForm({ hearingDate: '', hearingTime: '', courtRoom: '', purpose: '', notes: '' }) }}
                        className="h-7 px-2 bg-primary text-primary-foreground rounded-lg text-xs font-medium flex items-center gap-1"
                      >
                        <Plus size={11} /> Add
                      </button>
                    </div>

                    {showHearingForm && (
                      <div className="border border-border rounded-xl p-3 space-y-2 bg-muted/10">
                        {hearingError && <p className="text-xs text-danger">{hearingError}</p>}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs text-muted-foreground mb-0.5 block">Date *</label>
                            <input type="date" value={hearingForm.hearingDate} onChange={(e) => setHearingForm({ ...hearingForm, hearingDate: e.target.value })} className="w-full h-9 px-2 rounded-lg border border-border bg-background text-foreground text-sm" />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground mb-0.5 block">Time</label>
                            <input type="time" value={hearingForm.hearingTime} onChange={(e) => setHearingForm({ ...hearingForm, hearingTime: e.target.value })} className="w-full h-9 px-2 rounded-lg border border-border bg-background text-foreground text-sm" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs text-muted-foreground mb-0.5 block">Purpose</label>
                            <select value={hearingForm.purpose} onChange={(e) => setHearingForm({ ...hearingForm, purpose: e.target.value })} className="w-full h-9 px-2 rounded-lg border border-border bg-background text-foreground text-sm">
                              <option value="">Select...</option>
                              {PURPOSES.map((p) => <option key={p} value={p}>{p}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground mb-0.5 block">Court Room</label>
                            <input value={hearingForm.courtRoom} onChange={(e) => setHearingForm({ ...hearingForm, courtRoom: e.target.value })} className="w-full h-9 px-2 rounded-lg border border-border bg-background text-foreground text-sm" placeholder="Room 5..." />
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button onClick={() => setShowHearingForm(false)} className="flex-1 h-8 rounded-lg border border-border text-xs text-foreground hover:bg-muted/50">Cancel</button>
                          <button onClick={handleSaveHearing} disabled={savingHearing} className="flex-1 h-8 bg-primary text-primary-foreground rounded-lg text-xs font-medium disabled:opacity-50">
                            {savingHearing ? 'Adding...' : 'Add Hearing'}
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {selectedCase.hearings.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-3">No hearings recorded.</p>
                      ) : (
                        selectedCase.hearings.map((h) => (
                          <div key={h.id} className={cn('rounded-xl border p-3 space-y-1', h.status === 'SCHEDULED' ? 'border-info/30 bg-info/5' : 'border-border bg-muted/5')}>
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-semibold text-foreground">{formatDate(h.hearingDate)} {h.hearingTime && `· ${h.hearingTime}`}</p>
                              <Badge variant={HEARING_STATUS_VARIANT[h.status] ?? 'neutral'} size="sm">{h.status}</Badge>
                            </div>
                            {h.purpose && <p className="text-xs text-muted-foreground">{h.purpose}{h.courtRoom ? ` · ${h.courtRoom}` : ''}</p>}
                            {h.outcome && <p className="text-xs text-foreground italic">{h.outcome}</p>}
                            {h.nextDate && <p className="text-xs text-warning">Next: {formatDate(h.nextDate)}</p>}
                            {h.status === 'SCHEDULED' && (
                              <div className="flex gap-2 pt-1">
                                <button onClick={() => handleCompleteHearing(h.id)} className="flex-1 h-7 rounded-lg border border-success/30 text-xs text-success hover:bg-success/5 flex items-center justify-center gap-1">
                                  <CheckCircle size={11} /> Done
                                </button>
                                <button onClick={() => { setAdjournHearing(h); setAdjournForm({ outcome: '', nextDate: '' }) }} className="flex-1 h-7 rounded-lg border border-warning/30 text-xs text-warning hover:bg-warning/5 flex items-center justify-center gap-1">
                                  <AlertTriangle size={11} /> Adjourn
                                </button>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </Card>

                  {/* Time Entries */}
                  <Card padding="lg" className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-foreground text-sm">Time Entries ({selectedCase.timeEntries.length})</p>
                        {selectedCase.timeEntries.length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            ₹{selectedCase.timeEntries.filter((e) => !e.isBilled).reduce((s, e) => s + Number(e.amount), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} unbilled
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => { setShowTimeForm(true); setTimeError(null); setTimeForm({ date: new Date().toISOString().slice(0, 10), description: '', hours: '', ratePerHour: '', employeeId: '' }); loadFormData() }}
                        className="h-7 px-2 bg-primary text-primary-foreground rounded-lg text-xs font-medium flex items-center gap-1"
                      >
                        <Plus size={11} /> Log Time
                      </button>
                    </div>

                    {showTimeForm && (
                      <div className="border border-border rounded-xl p-3 space-y-2 bg-muted/10">
                        {timeError && <p className="text-xs text-danger">{timeError}</p>}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs text-muted-foreground mb-0.5 block">Date *</label>
                            <input type="date" value={timeForm.date} onChange={(e) => setTimeForm({ ...timeForm, date: e.target.value })} className="w-full h-9 px-2 rounded-lg border border-border bg-background text-foreground text-sm" />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground mb-0.5 block">Hours *</label>
                            <input type="number" min="0.25" step="0.25" value={timeForm.hours} onChange={(e) => setTimeForm({ ...timeForm, hours: e.target.value })} className="w-full h-9 px-2 rounded-lg border border-border bg-background text-foreground text-sm" placeholder="0.5" />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground mb-0.5 block">Description *</label>
                          <input value={timeForm.description} onChange={(e) => setTimeForm({ ...timeForm, description: e.target.value })} className="w-full h-9 px-2 rounded-lg border border-border bg-background text-foreground text-sm" placeholder="Drafted petition, reviewed documents..." />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs text-muted-foreground mb-0.5 block">Rate / Hour (₹)</label>
                            <input type="number" min="0" value={timeForm.ratePerHour} onChange={(e) => setTimeForm({ ...timeForm, ratePerHour: e.target.value })} className="w-full h-9 px-2 rounded-lg border border-border bg-background text-foreground text-sm" placeholder="500" />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground mb-0.5 block">Advocate</label>
                            <select value={timeForm.employeeId} onChange={(e) => setTimeForm({ ...timeForm, employeeId: e.target.value })} className="w-full h-9 px-2 rounded-lg border border-border bg-background text-foreground text-sm">
                              <option value="">— Select —</option>
                              {employees.map((e) => <option key={e.id} value={e.id}>{e.fullName}</option>)}
                            </select>
                          </div>
                        </div>
                        {timeForm.hours && timeForm.ratePerHour && (
                          <p className="text-xs text-success font-medium">Amount: ₹{(Number(timeForm.hours) * Number(timeForm.ratePerHour)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                        )}
                        <div className="flex gap-2">
                          <button onClick={() => setShowTimeForm(false)} className="flex-1 h-8 rounded-lg border border-border text-xs text-foreground hover:bg-muted/50">Cancel</button>
                          <button onClick={handleSaveTime} disabled={savingTime} className="flex-1 h-8 bg-primary text-primary-foreground rounded-lg text-xs font-medium disabled:opacity-50">
                            {savingTime ? 'Saving...' : 'Log Time'}
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {selectedCase.timeEntries.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-3">No time entries yet.</p>
                      ) : (
                        selectedCase.timeEntries.map((e) => (
                          <div key={e.id} className="flex items-start justify-between rounded-lg bg-muted/10 px-3 py-2">
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-foreground truncate">{e.description}</p>
                              <p className="text-xs text-muted-foreground">{formatDate(e.date)} · {Number(e.hours)}h{e.ratePerHour ? ` · ₹${Number(e.amount).toLocaleString('en-IN')}` : ''}</p>
                            </div>
                            <div className="flex items-center gap-2 ml-2 shrink-0">
                              <span className={cn('text-xs font-medium', e.isBilled ? 'text-muted-foreground' : 'text-warning')}>
                                {e.isBilled ? 'Billed' : 'Unbilled'}
                              </span>
                              {!e.isBilled && (
                                <button onClick={() => handleDeleteTime(e.id)} className="text-muted-foreground hover:text-danger">
                                  <X size={12} />
                                </button>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </Card>
                </>
              ) : null}
            </div>
          )}
        </div>
      )}

      {/* ── HEARINGS TAB ────────────────────────────────────────────────────────── */}
      {tab === 'hearings' && (
        <div className="space-y-3">
          <Tabs
            tabs={[
              { id: 'upcoming', label: 'Upcoming' },
              { id: 'today', label: 'Today' },
              { id: 'all', label: 'All' },
            ]}
            active={hearingDateFilter}
            onChange={setHearingDateFilter}
          />

          <Card padding="none" className="overflow-hidden">
            {loadingHearings ? (
              <div className="p-12 text-center text-muted-foreground text-sm">Loading...</div>
            ) : hearings.length === 0 ? (
              <div className="p-12 text-center">
                <Calendar size={32} className="mx-auto mb-3 text-muted-foreground/40" />
                <p className="text-muted-foreground">No hearings found.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/20">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date & Time</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Case</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Client</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Court</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Purpose</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {hearings.map((h) => (
                    <tr key={h.id} className={cn('border-b border-border/50', isToday(h.hearingDate) ? 'bg-danger/5' : isSoon(h.hearingDate) ? 'bg-warning/5' : 'hover:bg-muted/20')}>
                      <td className="px-4 py-3">
                        <p className={cn('font-semibold', isToday(h.hearingDate) ? 'text-danger' : isSoon(h.hearingDate) ? 'text-warning' : 'text-foreground')}>{formatDate(h.hearingDate)}</p>
                        {h.hearingTime && <p className="text-xs text-muted-foreground">{h.hearingTime}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{h.case?.caseNumber}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[180px]">{h.case?.caseTitle}</p>
                      </td>
                      <td className="px-4 py-3 text-foreground">{h.case?.client.customerName}</td>
                      <td className="px-4 py-3 text-foreground">{h.case?.courtName}</td>
                      <td className="px-4 py-3 text-muted-foreground">{h.purpose ?? '—'}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={HEARING_STATUS_VARIANT[h.status] ?? 'neutral'} size="sm">{h.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {h.status === 'SCHEDULED' && (
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => handleCompleteHearing(h.id)} className="h-7 px-2 rounded-lg border border-success/30 text-xs text-success hover:bg-success/5 flex items-center gap-1">
                              <CheckCircle size={11} /> Done
                            </button>
                            <button onClick={() => { setAdjournHearing(h); setAdjournForm({ outcome: '', nextDate: '' }) }} className="h-7 px-2 rounded-lg border border-warning/30 text-xs text-warning hover:bg-warning/5 flex items-center gap-1">
                              <AlertTriangle size={11} /> Adjourn
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      )}

      {/* ── TIME ENTRIES TAB ─────────────────────────────────────────────────────── */}
      {tab === 'time' && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Tabs
              tabs={[
                { id: 'unbilled', label: 'Unbilled' },
                { id: 'billed', label: 'Billed' },
                { id: 'all', label: 'All' },
              ]}
              active={billedFilter}
              onChange={setBilledFilter}
            />
            {selectedTimeIds.size > 0 && (
              <button onClick={handleMarkBilled} disabled={markingBilled} className="h-9 px-4 bg-success text-white rounded-xl text-sm font-medium disabled:opacity-50">
                {markingBilled ? 'Marking...' : `Mark ${selectedTimeIds.size} as Billed`}
              </button>
            )}
            <div className="ml-auto text-sm text-muted-foreground">
              Total unbilled: <span className="text-warning font-semibold">
                ₹{timeEntries.filter((e) => !e.isBilled).reduce((s, e) => s + Number(e.amount), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <Card padding="none" className="overflow-hidden">
            {loadingTime ? (
              <div className="p-12 text-center text-muted-foreground text-sm">Loading...</div>
            ) : timeEntries.length === 0 ? (
              <div className="p-12 text-center">
                <Clock size={32} className="mx-auto mb-3 text-muted-foreground/40" />
                <p className="text-muted-foreground">No time entries found.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/20">
                    <th className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedTimeIds.size === timeEntries.filter((e) => !e.isBilled).length && timeEntries.filter((e) => !e.isBilled).length > 0}
                        onChange={() => {
                          const unbilled = timeEntries.filter((e) => !e.isBilled)
                          if (selectedTimeIds.size === unbilled.length) setSelectedTimeIds(new Set())
                          else setSelectedTimeIds(new Set(unbilled.map((e) => e.id)))
                        }}
                        className="rounded"
                      />
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Case</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Description</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Advocate</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Hours</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Amount</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {timeEntries.map((e) => (
                    <tr key={e.id} className="border-b border-border/50 hover:bg-muted/20">
                      <td className="px-4 py-3 text-center">
                        {!e.isBilled && (
                          <input type="checkbox" checked={selectedTimeIds.has(e.id)} onChange={() => toggleTimeId(e.id)} className="rounded" />
                        )}
                      </td>
                      <td className="px-4 py-3 text-foreground">{formatDate(e.date)}</td>
                      <td className="px-4 py-3">
                        {e.case ? (
                          <>
                            <p className="text-foreground font-medium">{e.case.caseNumber}</p>
                            <p className="text-xs text-muted-foreground truncate max-w-[140px]">{e.case.caseTitle}</p>
                          </>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3 text-foreground">{e.description}</td>
                      <td className="px-4 py-3 text-muted-foreground">{e.employee?.fullName ?? '—'}</td>
                      <td className="px-4 py-3 text-right text-foreground">{Number(e.hours)}h</td>
                      <td className="px-4 py-3 text-right font-semibold text-foreground">₹{Number(e.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={cn('text-xs font-medium', e.isBilled ? 'text-muted-foreground' : 'text-warning')}>
                          {e.isBilled ? 'Billed' : 'Unbilled'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      )}

      {/* ── NEW CASE MODAL ───────────────────────────────────────────────────────── */}
      {showCaseForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">New Legal Case</h2>
              <button onClick={() => setShowCaseForm(false)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
            </div>
            {caseError && <div className="text-sm text-danger bg-danger/5 border border-danger/20 rounded-xl px-3 py-2">{caseError}</div>}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Case Number *</label>
                  <input value={caseForm.caseNumber} onChange={(e) => setCaseForm({ ...caseForm, caseNumber: e.target.value })} className="w-full h-12 px-3 rounded-xl border border-border bg-background text-foreground" placeholder="OS/123/2024" />
                </div>
                <Select label="Case Type" value={caseForm.caseType} onChange={(e) => setCaseForm({ ...caseForm, caseType: e.target.value })}>
                  {CASE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Case Title *</label>
                <input value={caseForm.caseTitle} onChange={(e) => setCaseForm({ ...caseForm, caseTitle: e.target.value })} className="w-full h-12 px-3 rounded-xl border border-border bg-background text-foreground" placeholder="Ramesh Sharma vs State of Maharashtra" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Opposing Party (for conflict check)</label>
                <input value={caseForm.opposingPartyName} onChange={(e) => setCaseForm({ ...caseForm, opposingPartyName: e.target.value })} className="w-full h-12 px-3 rounded-xl border border-border bg-background text-foreground" placeholder="State of Maharashtra" />
              </div>
              {checkingConflicts && <p className="text-xs text-muted-foreground">Checking for conflicts of interest…</p>}
              {conflicts.length > 0 && (
                <div className="text-sm text-warning bg-warning/5 border border-warning/20 rounded-xl px-3 py-2 space-y-1">
                  <p className="font-medium flex items-center gap-1.5"><AlertTriangle size={14} /> Possible conflict of interest</p>
                  {conflicts.map((c) => (
                    <p key={c.caseId} className="text-xs">{c.reason}</p>
                  ))}
                  <p className="text-xs text-muted-foreground">This is advisory only — review before proceeding.</p>
                </div>
              )}
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Court Name *</label>
                <input value={caseForm.courtName} onChange={(e) => setCaseForm({ ...caseForm, courtName: e.target.value })} className="w-full h-12 px-3 rounded-xl border border-border bg-background text-foreground" placeholder="District Court, Mumbai" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">District</label>
                  <input value={caseForm.courtDistrict} onChange={(e) => setCaseForm({ ...caseForm, courtDistrict: e.target.value })} className="w-full h-12 px-3 rounded-xl border border-border bg-background text-foreground" placeholder="Mumbai" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">State</label>
                  <input value={caseForm.courtState} onChange={(e) => setCaseForm({ ...caseForm, courtState: e.target.value })} className="w-full h-12 px-3 rounded-xl border border-border bg-background text-foreground" placeholder="Maharashtra" />
                </div>
              </div>
              <Select label="Client" required value={caseForm.clientId} onChange={(e) => setCaseForm({ ...caseForm, clientId: e.target.value })}>
                <option value="">Select client...</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.customerName}{c.phone ? ` · ${c.phone}` : ''}</option>)}
              </Select>
              <Select label="Advocate (Handling)" value={caseForm.advocateId} onChange={(e) => setCaseForm({ ...caseForm, advocateId: e.target.value })}>
                <option value="">Select advocate...</option>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.fullName}</option>)}
              </Select>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Filing Date</label>
                  <input type="date" value={caseForm.filingDate} onChange={(e) => setCaseForm({ ...caseForm, filingDate: e.target.value })} className="w-full h-12 px-3 rounded-xl border border-border bg-background text-foreground" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Agreed Fee (₹)</label>
                  <input type="number" min="0" value={caseForm.feeAgreed} onChange={(e) => setCaseForm({ ...caseForm, feeAgreed: e.target.value })} className="w-full h-12 px-3 rounded-xl border border-border bg-background text-foreground" placeholder="50000" />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Limitation / Deadline Date</label>
                <input type="date" value={caseForm.limitationDate} onChange={(e) => setCaseForm({ ...caseForm, limitationDate: e.target.value })} className="w-full h-12 px-3 rounded-xl border border-border bg-background text-foreground" />
                <p className="text-xs text-muted-foreground mt-1">Statute-of-limitations / filing deadline — client gets a WhatsApp reminder 30 and 7 days before.</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">eCourt Case ID</label>
                <input value={caseForm.eCourtId} onChange={(e) => setCaseForm({ ...caseForm, eCourtId: e.target.value })} className="w-full h-12 px-3 rounded-xl border border-border bg-background text-foreground" placeholder="MH000123456" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Notes</label>
                <textarea value={caseForm.notes} onChange={(e) => setCaseForm({ ...caseForm, notes: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm resize-none" placeholder="Background, special instructions..." />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowCaseForm(false)} className="flex-1 h-11 rounded-xl border border-border text-sm text-foreground hover:bg-muted/50">Cancel</button>
              <button onClick={handleSaveCase} disabled={savingCase} className="flex-1 h-11 bg-primary text-primary-foreground rounded-xl text-sm font-medium disabled:opacity-50">
                {savingCase ? 'Saving...' : 'Create Case'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ADJOURN MODAL ────────────────────────────────────────────────────────── */}
      {adjournHearing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Adjourn Hearing</h2>
              <button onClick={() => setAdjournHearing(null)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
            </div>
            <p className="text-sm text-muted-foreground">Hearing on {formatDate(adjournHearing.hearingDate)}</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Next Hearing Date</label>
                <input type="date" value={adjournForm.nextDate} onChange={(e) => setAdjournForm({ ...adjournForm, nextDate: e.target.value })} className="w-full h-12 px-3 rounded-xl border border-border bg-background text-foreground" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Outcome / Reason</label>
                <input value={adjournForm.outcome} onChange={(e) => setAdjournForm({ ...adjournForm, outcome: e.target.value })} className="w-full h-12 px-3 rounded-xl border border-border bg-background text-foreground" placeholder="Adjourned for arguments..." />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setAdjournHearing(null)} className="flex-1 h-11 rounded-xl border border-border text-sm text-foreground hover:bg-muted/50">Cancel</button>
              <button onClick={handleAdjourn} disabled={savingAdjourn} className="flex-1 h-11 bg-warning text-white rounded-xl text-sm font-medium disabled:opacity-50">
                {savingAdjourn ? 'Saving...' : 'Adjourn'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
