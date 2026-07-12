import { useState, useEffect, useCallback } from 'react'
import { Briefcase, Users, UserCheck, Plus, Pencil, Trash2, X, Receipt, ChevronRight, Search, Printer } from 'lucide-react'
import { aszurexFooterHtml } from '@shared/utils/print-branding'
import { Card } from '@shared/ui/molecules/Card'
import { KpiCard } from '@shared/ui/molecules/KpiCard'
import { Badge } from '@shared/ui/atoms/Badge'
import { Select } from '@shared/ui/atoms/Select'
import { useNotificationStore } from '@app/store/notification.store'

const api = window.api

// ── Types ──────────────────────────────────────────────────────────────────────

interface Candidate {
  id: string; candidateNumber: string; fullName: string; email?: string | null; phone?: string | null
  currentJobTitle?: string | null; currentEmployer?: string | null; totalExperience?: number | null
  skills: string; preferredLocations: string; educationSummary?: string | null; resumeNotes?: string | null
  expectedSalary?: number | null; currentSalary?: number | null; availableFrom?: string | null
  status: string; source: string; notes?: string | null; createdAt: string
}
interface JobOrderRow {
  id: string; orderNumber: string; clientId: string
  client: { id: string; customerName: string; phone?: string | null }
  jobTitle: string; jobDescription?: string | null; requiredSkills: string
  experienceMin?: number | null; experienceMax?: number | null
  salaryBudgetMin?: number | null; salaryBudgetMax?: number | null; location?: string | null
  numberOfPositions: number; status: string; targetDate?: string | null
  commissionType: string; commissionValue: number; notes?: string | null
  _count: { placements: number }; createdAt: string
}
interface PlacementRow {
  id: string; placementNumber: string; candidateId: string; jobOrderId: string; clientId: string
  candidate: { id: string; candidateNumber: string; fullName: string; phone?: string | null }
  jobOrder: { id: string; orderNumber: string; jobTitle: string }
  client: { id: string; customerName: string }
  joiningDate: string; offeredSalary: number; commissionAmount: number
  invoiceId?: string | null; status: string; notes?: string | null; createdAt: string
}
interface Customer { id: string; customerName: string; phone?: string | null }

// ── Constants ──────────────────────────────────────────────────────────────────

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'brand'

const CAND_STATUSES = ['ACTIVE', 'PLACED', 'ON_HOLD', 'BLACKLISTED']
// Verified exhaustive against prisma/schema.prisma Candidate.status ("ACTIVE|PLACED|ON_HOLD|BLACKLISTED")
const CAND_STATUS_VARIANT: Record<string, BadgeVariant> = {
  ACTIVE: 'success',
  PLACED: 'info',
  ON_HOLD: 'warning',
  BLACKLISTED: 'danger',
}
const CAND_SOURCES = ['WALKIN', 'REFERRAL', 'LINKEDIN', 'WEBSITE', 'OTHER']
const JO_STATUSES = ['OPEN', 'IN_PROGRESS', 'ON_HOLD', 'CLOSED', 'CANCELLED']
// Verified exhaustive against prisma/schema.prisma JobOrder.status ("OPEN|IN_PROGRESS|ON_HOLD|CLOSED|CANCELLED")
const JO_STATUS_VARIANT: Record<string, BadgeVariant> = {
  OPEN: 'success',
  IN_PROGRESS: 'info',
  ON_HOLD: 'warning',
  CLOSED: 'neutral',
  CANCELLED: 'danger',
}
const PLC_STATUSES = ['OFFERED', 'JOINED', 'INVOICED', 'CANCELLED']
// Verified exhaustive against prisma/schema.prisma Placement.status ("OFFERED|JOINED|INVOICED|CANCELLED")
const PLC_STATUS_VARIANT: Record<string, BadgeVariant> = {
  OFFERED: 'warning',
  JOINED: 'info',
  INVOICED: 'success',
  CANCELLED: 'danger',
}
// Only OFFERED can be advanced to JOINED
const PLC_STATUS_NEXT: Record<string, string> = { OFFERED: 'JOINED' }

const parseSafe = <T,>(raw: string, fallback: T): T => { try { return JSON.parse(raw) as T } catch { return fallback } }
const toNum = (s: string) => { const n = parseFloat(s); return isNaN(n) ? undefined : n }
const toInt = (s: string) => { const n = parseInt(s, 10); return isNaN(n) ? undefined : n }
const fmt = (n: number) => new Intl.NumberFormat('en-IN').format(n)
const fmtDate = (s: string) => new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
// DateTime fields survive Electron's IPC as real Date instances (not strings),
// so a direct `.slice(0, 10)` throws "d.slice is not a function".
const dateSlice = (d: unknown): string => {
  if (!d) return ''
  return (d instanceof Date ? d.toISOString() : String(d)).slice(0, 10)
}

// ── Empty form factories ───────────────────────────────────────────────────────

function emptyCandForm() {
  return {
    fullName: '', email: '', phone: '', currentJobTitle: '', currentEmployer: '',
    totalExperience: '', skills: [] as string[], preferredLocations: [] as string[],
    educationSummary: '', resumeNotes: '', expectedSalary: '', currentSalary: '',
    availableFrom: '', source: 'WALKIN', status: 'ACTIVE', notes: '',
  }
}
function emptyJOForm() {
  return {
    clientId: '', jobTitle: '', jobDescription: '', requiredSkills: [] as string[],
    experienceMin: '', experienceMax: '', salaryBudgetMin: '', salaryBudgetMax: '',
    location: '', numberOfPositions: '1', targetDate: '', status: 'OPEN',
    commissionType: 'PERCENTAGE', commissionValue: '', notes: '',
  }
}
function emptyPLCForm() {
  return {
    candidateId: '', jobOrderId: '', clientId: '',
    joiningDate: '', offeredSalary: '', commissionAmount: '', status: 'OFFERED', notes: '',
  }
}

// ── Tag input helper ───────────────────────────────────────────────────────────

function TagInput({ tags, onAdd, onRemove, placeholder }: {
  tags: string[]; onAdd: (v: string) => void; onRemove: (i: number) => void; placeholder: string
}) {
  const [input, setInput] = useState('')
  const add = () => {
    const v = input.trim()
    if (v && !tags.includes(v)) { onAdd(v); setInput('') }
  }
  return (
    <div>
      <div className="flex gap-2">
        <input
          value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          placeholder={placeholder}
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100"
        />
        <button type="button" onClick={add} className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-600">Add</button>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {tags.map((t, i) => (
            <span key={i} className="inline-flex items-center gap-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs px-2 py-1 rounded-full">
              {t}
              <button type="button" onClick={() => onRemove(i)} className="hover:text-blue-900 dark:hover:text-blue-300"><X size={10} /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function printPlacementLetter(p: PlacementRow) {
  const joiningDateLabel = new Date(p.joiningDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
  const printedOn = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Placement Confirmation Letter</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; color: #1a1a1a; padding: 48px 56px; max-width: 720px; margin: 0 auto; line-height: 1.7; }
  .letterhead { text-align: center; margin-bottom: 32px; }
  h1 { font-size: 16px; font-weight: 700; margin: 0 0 4px; text-transform: uppercase; letter-spacing: 1px; }
  .date-line { text-align: right; margin-bottom: 24px; font-size: 12px; }
  .ref { margin-bottom: 20px; font-size: 12px; }
  .body-text { margin-bottom: 16px; }
  .terms { margin-top: 16px; }
  .term-row { display: flex; gap: 12px; margin-bottom: 8px; }
  .term-label { width: 180px; flex-shrink: 0; font-weight: 600; }
  .sig-area { margin-top: 48px; display: flex; justify-content: space-between; }
  .sig-box { text-align: left; }
  .sig-line { border-top: 1px solid #1a1a1a; padding-top: 6px; margin-top: 40px; font-size: 11px; color: #555; }
  .footer { font-size: 10px; color: #555; text-align: center; margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 10px; }
</style></head><body>
<div class="date-line">Date: ${printedOn}</div>
<div class="ref">Ref: ${p.placementNumber}</div>
<div class="body-text">
  <strong>To,</strong><br>
  ${p.candidate.fullName}<br>
  ${p.candidate.phone ? `Phone: ${p.candidate.phone}<br>` : ''}
</div>
<div class="body-text">
  <strong>Subject: Placement Confirmation Letter</strong>
</div>
<p class="body-text">Dear ${p.candidate.fullName},</p>
<p class="body-text">We are pleased to confirm your successful placement with the following details:</p>
<div class="terms">
  <div class="term-row"><span class="term-label">Candidate Name</span><span>${p.candidate.fullName}</span></div>
  <div class="term-row"><span class="term-label">Job Title / Role</span><span>${p.jobOrder.jobTitle}</span></div>
  <div class="term-row"><span class="term-label">Employer / Client</span><span>${p.client.customerName}</span></div>
  <div class="term-row"><span class="term-label">Joining Date</span><span>${joiningDateLabel}</span></div>
  <div class="term-row"><span class="term-label">Offered Salary</span><span>₹${Number(p.offeredSalary).toLocaleString('en-IN')} per month</span></div>
  <div class="term-row"><span class="term-label">Placement Status</span><span>${p.status}</span></div>
</div>
<p class="body-text" style="margin-top:20px">Please report to the employer on the joining date mentioned above. This confirmation is issued by the placement agency as a record of successful placement facilitation.</p>
<div class="sig-area">
  <div class="sig-box">
    <div class="sig-line">Authorised Signatory<br>Placement Agency</div>
  </div>
  <div class="sig-box">
    <div class="sig-line">Acknowledgement Signature<br>Candidate: ${p.candidate.fullName}</div>
  </div>
</div>
<div class="footer">${aszurexFooterHtml(10)}</div>
</body></html>`

  const win = window.open('', '_blank', 'width=800,height=1000')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.focus()
  win.print()
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function PlacementScreen() {
  const { error: toastError } = useNotificationStore()
  const [tab, setTab] = useState<'candidates' | 'orders' | 'placements'>('candidates')

  // Candidates
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [candSearch, setCandSearch] = useState('')
  const [candStatusFilter, setCandStatusFilter] = useState('')
  const [showCandForm, setShowCandForm] = useState(false)
  const [editCand, setEditCand] = useState<Candidate | null>(null)
  const [candForm, setCandForm] = useState(emptyCandForm())
  const [candFormError, setCandFormError] = useState('')
  const [candSaving, setCandSaving] = useState(false)

  // Job Orders
  const [jobOrders, setJobOrders] = useState<JobOrderRow[]>([])
  const [joSearch, setJoSearch] = useState('')
  const [joStatusFilter, setJoStatusFilter] = useState('')
  const [showJOForm, setShowJOForm] = useState(false)
  const [editJO, setEditJO] = useState<JobOrderRow | null>(null)
  const [joForm, setJoForm] = useState(emptyJOForm())
  const [joFormError, setJoFormError] = useState('')
  const [joSaving, setJoSaving] = useState(false)

  // Placements
  const [placements, setPlacements] = useState<PlacementRow[]>([])
  const [plcSearch, setPlcSearch] = useState('')
  const [plcStatusFilter, setPlcStatusFilter] = useState('')
  const [showPLCForm, setShowPLCForm] = useState(false)
  const [editPLC, setEditPLC] = useState<PlacementRow | null>(null)
  const [plcForm, setPlcForm] = useState(emptyPLCForm())
  const [plcFormError, setPlcFormError] = useState('')
  const [plcSaving, setPlcSaving] = useState(false)
  const [invoiceBanners, setInvoiceBanners] = useState<Record<string, { ok: boolean; msg: string }>>({})

  // Shared
  const [loading, setLoading] = useState(true)
  const [actionError, setActionError] = useState<string | null>(null)
  const [kpis, setKpis] = useState({ activeCandidates: 0, openJobOrders: 0, placementsThisMonth: 0, revenueThisMonth: 0 })
  const [customers, setCustomers] = useState<Customer[]>([])
  // Unfiltered lists for form dropdowns — never overwritten by tab filter effects
  const [allCandidates, setAllCandidates] = useState<Candidate[]>([])
  const [allJobOrders, setAllJobOrders] = useState<JobOrderRow[]>([])

  // ── Load helpers (do NOT call setLoading) ────────────────────────────────────

  const loadCandidates = useCallback(async (status?: string, search?: string) => {
    try {
      const res = await api.candidate.list({ status: status || undefined, search: search || undefined })
      if (res.success) setCandidates(res.data as Candidate[])
      else toastError('Error', res.error?.message ?? 'Could not load candidates.')
    } catch { toastError('Error', 'Could not load candidates.') }
  }, [toastError])

  const loadJobOrders = useCallback(async (status?: string, search?: string) => {
    try {
      const res = await api.jobOrder.list({ status: status || undefined, search: search || undefined })
      if (res.success) setJobOrders(res.data as JobOrderRow[])
      else toastError('Error', res.error?.message ?? 'Could not load job orders.')
    } catch { toastError('Error', 'Could not load job orders.') }
  }, [toastError])

  const loadPlacements = useCallback(async (status?: string, search?: string) => {
    try {
      const res = await api.placement.list({ status: status || undefined, search: search || undefined })
      if (res.success) setPlacements(res.data as PlacementRow[])
      else toastError('Error', res.error?.message ?? 'Could not load placements.')
    } catch { toastError('Error', 'Could not load placements.') }
  }, [toastError])

  const loadKpis = useCallback(async () => {
    try {
      const res = await api.placement.kpis()
      if (res.success) setKpis(res.data as typeof kpis)
    } catch { /* KPI strip is supplementary */ }
  }, [])

  const loadCustomers = useCallback(async () => {
    try {
      const res = await api.customers.list()
      if (res.success) {
        const d = res.data as { customers?: Customer[] } | Customer[]
        setCustomers(Array.isArray(d) ? d : (d.customers ?? []))
      } else {
        toastError('Error', res.error?.message ?? 'Could not load clients.')
      }
    } catch { toastError('Error', 'Could not load clients.') }
  }, [toastError])

  const loadAllCandidates = useCallback(async () => {
    try {
      const res = await api.candidate.list()
      if (res.success) setAllCandidates(res.data as Candidate[])
    } catch { /* form-dropdown data is supplementary — the candidates tab itself already surfaces errors */ }
  }, [])

  const loadAllJobOrders = useCallback(async () => {
    try {
      const res = await api.jobOrder.list()
      if (res.success) setAllJobOrders(res.data as JobOrderRow[])
    } catch { /* form-dropdown data is supplementary — the job orders tab itself already surfaces errors */ }
  }, [])

  // ── Initial load ─────────────────────────────────────────────────────────────

  useEffect(() => {
    setLoading(true)
    Promise.all([loadCandidates(), loadJobOrders(), loadPlacements(), loadKpis(), loadCustomers(), loadAllCandidates(), loadAllJobOrders()])
      .finally(() => setLoading(false))
  }, [loadCandidates, loadJobOrders, loadPlacements, loadKpis, loadCustomers, loadAllCandidates, loadAllJobOrders])

  // ── Filter-aware reloads ──────────────────────────────────────────────────────

  useEffect(() => { loadCandidates(candStatusFilter, candSearch) }, [candStatusFilter, candSearch, loadCandidates])
  useEffect(() => { loadJobOrders(joStatusFilter, joSearch) }, [joStatusFilter, joSearch, loadJobOrders])
  useEffect(() => { loadPlacements(plcStatusFilter, plcSearch) }, [plcStatusFilter, plcSearch, loadPlacements])

  // ── Commission auto-calc ──────────────────────────────────────────────────────

  function calcCommission(jobOrderId: string, offeredSalaryStr: string): string {
    // use allJobOrders so calc works regardless of the Job Orders tab filter
    const jo = allJobOrders.find(j => j.id === jobOrderId)
    if (!jo) return ''
    const salary = parseFloat(offeredSalaryStr) || 0
    if (jo.commissionType === 'PERCENTAGE') return String(Math.round(salary * 12 * Number(jo.commissionValue) / 100))
    if (jo.commissionType === 'FIXED') return String(Number(jo.commissionValue))
    return ''
  }

  // ── Candidate handlers ────────────────────────────────────────────────────────

  function openCandCreate() {
    setEditCand(null); setCandForm(emptyCandForm()); setCandFormError(''); setShowCandForm(true)
  }
  function openCandEdit(c: Candidate) {
    setEditCand(c)
    setCandForm({
      fullName: c.fullName, email: c.email ?? '', phone: c.phone ?? '',
      currentJobTitle: c.currentJobTitle ?? '', currentEmployer: c.currentEmployer ?? '',
      totalExperience: c.totalExperience != null ? String(c.totalExperience) : '',
      skills: parseSafe<string[]>(c.skills, []), preferredLocations: parseSafe<string[]>(c.preferredLocations, []),
      educationSummary: c.educationSummary ?? '', resumeNotes: c.resumeNotes ?? '',
      expectedSalary: c.expectedSalary != null ? String(c.expectedSalary) : '',
      currentSalary: c.currentSalary != null ? String(c.currentSalary) : '',
      availableFrom: c.availableFrom ? dateSlice(c.availableFrom) : '',
      source: c.source, status: c.status, notes: c.notes ?? '',
    })
    setCandFormError(''); setShowCandForm(true)
  }
  async function saveCand() {
    if (!candForm.fullName.trim()) { setCandFormError('Full name is required.'); return }
    setCandSaving(true); setCandFormError('')
    try {
      const payload = {
        fullName: candForm.fullName.trim(),
        email: candForm.email || undefined, phone: candForm.phone || undefined,
        currentJobTitle: candForm.currentJobTitle || undefined, currentEmployer: candForm.currentEmployer || undefined,
        totalExperience: toNum(candForm.totalExperience),
        skills: candForm.skills, preferredLocations: candForm.preferredLocations,
        educationSummary: candForm.educationSummary || undefined, resumeNotes: candForm.resumeNotes || undefined,
        expectedSalary: toNum(candForm.expectedSalary), currentSalary: toNum(candForm.currentSalary),
        availableFrom: candForm.availableFrom || undefined, source: candForm.source,
        notes: candForm.notes || undefined,
      }
      const res = editCand
        ? await api.candidate.update({ id: editCand.id, ...payload, status: candForm.status })
        : await api.candidate.create(payload)
      if (!res.success) { setCandFormError(res.error?.message ?? 'Save failed.'); return }
      setShowCandForm(false)
      await loadCandidates(candStatusFilter, candSearch)
      loadAllCandidates()
      loadKpis()
    } finally { setCandSaving(false) }
  }
  async function deleteCand(c: Candidate) {
    if (!window.confirm(`Delete candidate ${c.candidateNumber}?`)) return
    const res = await api.candidate.delete(c.id)
    if (!res.success) { setActionError(res.error?.message ?? 'Delete failed.'); return }
    await loadCandidates(candStatusFilter, candSearch)
    loadKpis()
  }

  // ── Job Order handlers ────────────────────────────────────────────────────────

  function openJOCreate() {
    setEditJO(null); setJoForm(emptyJOForm()); setJoFormError(''); setShowJOForm(true)
  }
  function openJOEdit(jo: JobOrderRow) {
    setEditJO(jo)
    setJoForm({
      clientId: jo.clientId, jobTitle: jo.jobTitle, jobDescription: jo.jobDescription ?? '',
      requiredSkills: parseSafe<string[]>(jo.requiredSkills, []),
      experienceMin: jo.experienceMin != null ? String(jo.experienceMin) : '',
      experienceMax: jo.experienceMax != null ? String(jo.experienceMax) : '',
      salaryBudgetMin: jo.salaryBudgetMin != null ? String(jo.salaryBudgetMin) : '',
      salaryBudgetMax: jo.salaryBudgetMax != null ? String(jo.salaryBudgetMax) : '',
      location: jo.location ?? '', numberOfPositions: String(jo.numberOfPositions),
      targetDate: jo.targetDate ? dateSlice(jo.targetDate) : '',
      status: jo.status, commissionType: jo.commissionType,
      commissionValue: jo.commissionValue != null ? String(jo.commissionValue) : '',
      notes: jo.notes ?? '',
    })
    setJoFormError(''); setShowJOForm(true)
  }
  async function saveJO() {
    if (!joForm.clientId) { setJoFormError('Client is required.'); return }
    if (!joForm.jobTitle.trim()) { setJoFormError('Job title is required.'); return }
    setJoSaving(true); setJoFormError('')
    try {
      const payload = {
        clientId: joForm.clientId, jobTitle: joForm.jobTitle.trim(),
        jobDescription: joForm.jobDescription || undefined,
        requiredSkills: joForm.requiredSkills,
        experienceMin: toNum(joForm.experienceMin), experienceMax: toNum(joForm.experienceMax),
        salaryBudgetMin: toNum(joForm.salaryBudgetMin), salaryBudgetMax: toNum(joForm.salaryBudgetMax),
        location: joForm.location || undefined, numberOfPositions: toInt(joForm.numberOfPositions) ?? 1,
        targetDate: joForm.targetDate || undefined, status: joForm.status,
        commissionType: joForm.commissionType, commissionValue: toNum(joForm.commissionValue) ?? 0,
        notes: joForm.notes || undefined,
      }
      const res = editJO
        ? await api.jobOrder.update({ id: editJO.id, ...payload })
        : await api.jobOrder.create(payload)
      if (!res.success) { setJoFormError(res.error?.message ?? 'Save failed.'); return }
      setShowJOForm(false)
      await loadJobOrders(joStatusFilter, joSearch)
      loadAllJobOrders()
      loadKpis()
    } finally { setJoSaving(false) }
  }
  async function deleteJO(jo: JobOrderRow) {
    if (!window.confirm(`Delete job order ${jo.orderNumber}?`)) return
    const res = await api.jobOrder.delete(jo.id)
    if (!res.success) { setActionError(res.error?.message ?? 'Delete failed.'); return }
    await loadJobOrders(joStatusFilter, joSearch)
    loadKpis()
  }

  // ── Placement handlers ────────────────────────────────────────────────────────

  function openPLCCreate() {
    setEditPLC(null); setPlcForm(emptyPLCForm()); setPlcFormError(''); setShowPLCForm(true)
    loadAllCandidates(); loadAllJobOrders()
  }
  function openPLCEdit(p: PlacementRow) {
    setEditPLC(p)
    setPlcForm({
      candidateId: p.candidateId, jobOrderId: p.jobOrderId, clientId: p.clientId,
      joiningDate: p.joiningDate ? dateSlice(p.joiningDate) : '',
      offeredSalary: String(p.offeredSalary), commissionAmount: String(p.commissionAmount),
      status: p.status, notes: p.notes ?? '',
    })
    setPlcFormError(''); setShowPLCForm(true)
  }
  async function savePLC() {
    if (!plcForm.candidateId) { setPlcFormError('Candidate is required.'); return }
    if (!plcForm.jobOrderId) { setPlcFormError('Job order is required.'); return }
    if (!plcForm.clientId) { setPlcFormError('Hiring company is required.'); return }
    if (!plcForm.joiningDate) { setPlcFormError('Joining date is required.'); return }
    if (!plcForm.offeredSalary) { setPlcFormError('Offered salary is required.'); return }
    setPlcSaving(true); setPlcFormError('')
    try {
      const payload = {
        candidateId: plcForm.candidateId, jobOrderId: plcForm.jobOrderId,
        clientId: plcForm.clientId,
        joiningDate: plcForm.joiningDate,
        offeredSalary: parseFloat(plcForm.offeredSalary) || 0,
        commissionAmount: parseFloat(plcForm.commissionAmount) || 0,
        notes: plcForm.notes || undefined,
      }
      const res = editPLC
        ? await api.placement.update({ id: editPLC.id, ...payload, status: plcForm.status })
        : await api.placement.create(payload)
      if (!res.success) { setPlcFormError(res.error?.message ?? 'Save failed.'); return }
      setShowPLCForm(false)
      await loadPlacements(plcStatusFilter, plcSearch)
      loadKpis()
    } finally { setPlcSaving(false) }
  }
  async function deletePLC(p: PlacementRow) {
    if (!window.confirm(`Delete placement ${p.placementNumber}?`)) return
    const res = await api.placement.delete(p.id)
    if (!res.success) { setActionError(res.error?.message ?? 'Delete failed.'); return }
    await loadPlacements(plcStatusFilter, plcSearch)
    loadKpis()
  }
  async function advancePLC(p: PlacementRow) {
    const next = PLC_STATUS_NEXT[p.status]
    if (!next) return
    const res = await api.placement.update({ id: p.id, status: next })
    if (!res.success) { setActionError(res.error?.message ?? 'Status update failed.'); return }
    await loadPlacements(plcStatusFilter, plcSearch)
    loadKpis()
  }
  async function generatePLCInvoice(p: PlacementRow) {
    const res = await api.placement.generateInvoice(p.id)
    setInvoiceBanners(prev => ({
      ...prev,
      [p.id]: res.success
        ? { ok: true, msg: 'Invoice generated (SAC 999132, 18% GST).' }
        : { ok: false, msg: res.error?.message ?? 'Invoice generation failed.' },
    }))
    if (res.success) {
      await loadPlacements(plcStatusFilter, plcSearch)
      loadKpis()
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-slate-950">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-gray-200 px-6 py-4 flex items-center justify-between dark:border-slate-700">
        <div className="flex items-center gap-3">
          <Briefcase size={22} className="text-blue-600 dark:text-blue-400" />
          <h1 className="text-xl font-semibold text-gray-900 dark:text-slate-100">Placement Agency</h1>
        </div>
      </div>

      {/* KPI bar */}
      <div className="bg-white dark:bg-slate-900 border-b border-gray-100 px-6 py-3 grid grid-cols-4 gap-4 dark:border-slate-800">
        <KpiCard label="Active Candidates" value={kpis.activeCandidates} color="info" />
        <KpiCard label="Open Job Orders" value={kpis.openJobOrders} color="warning" />
        <KpiCard label="Placements This Month" value={kpis.placementsThisMonth} color="success" />
        <KpiCard label="Revenue This Month" value={`₹${fmt(kpis.revenueThisMonth)}`} color="brand" />
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-slate-900 border-b border-gray-200 px-6 flex gap-6 dark:border-slate-700">
        {([['candidates', 'Candidates', Users], ['orders', 'Job Orders', Briefcase], ['placements', 'Placements', UserCheck]] as const).map(
          ([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 py-3 text-sm font-medium border-b-2 transition-colors ${tab === key ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
            >
              <Icon size={15} />{label}
            </button>
          )
        )}
      </div>

      {/* Action error banner — outside tab conditionals so it's visible from all tabs */}
      {actionError && (
        <div className="mx-6 mt-3 text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-2 flex items-center justify-between">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} className="text-red-400 hover:text-red-600 dark:text-red-500 dark:hover:text-red-400"><X size={14} /></button>
        </div>
      )}

      {loading && <div className="flex-1 flex items-center justify-center text-gray-400 text-sm dark:text-slate-500">Loading...</div>}

      {/* ── CANDIDATES TAB ──────────────────────────────────────────────────── */}
      {!loading && tab === 'candidates' && (
        <div className="flex-1 overflow-auto p-6">
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
              <input
                value={candSearch} onChange={e => setCandSearch(e.target.value)}
                placeholder="Search candidates…"
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setCandStatusFilter('')} className={`px-3 py-1.5 rounded-full text-xs font-medium ${!candStatusFilter ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'}`}>All</button>
              {CAND_STATUSES.map(s => (
                <button key={s} onClick={() => setCandStatusFilter(s === candStatusFilter ? '' : s)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium ${candStatusFilter === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'}`}>
                  {s}
                </button>
              ))}
            </div>
            <button onClick={openCandCreate} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 whitespace-nowrap">
              <Plus size={15} />Add Candidate
            </button>
          </div>

          {/* Candidate form panel */}
          {showCandForm && (
            <Card padding="lg" className="mb-4 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900 dark:text-slate-100">{editCand ? 'Edit Candidate' : 'New Candidate'}</h3>
                <button onClick={() => setShowCandForm(false)} className="text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-200"><X size={18} /></button>
              </div>
              {candFormError && <p className="text-sm text-red-600 dark:text-red-400 mb-3">{candFormError}</p>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1 dark:text-slate-400">Full Name *</label>
                  <input value={candForm.fullName} onChange={e => setCandForm(f => ({ ...f, fullName: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1 dark:text-slate-400">Email</label>
                  <input value={candForm.email} onChange={e => setCandForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1 dark:text-slate-400">Phone</label>
                  <input value={candForm.phone} onChange={e => setCandForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1 dark:text-slate-400">Current Job Title</label>
                  <input value={candForm.currentJobTitle} onChange={e => setCandForm(f => ({ ...f, currentJobTitle: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1 dark:text-slate-400">Current Employer</label>
                  <input value={candForm.currentEmployer} onChange={e => setCandForm(f => ({ ...f, currentEmployer: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1 dark:text-slate-400">Total Experience (years)</label>
                  <input type="number" min="0" step="0.5" value={candForm.totalExperience} onChange={e => setCandForm(f => ({ ...f, totalExperience: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1 dark:text-slate-400">Available From</label>
                  <input type="date" value={candForm.availableFrom} onChange={e => setCandForm(f => ({ ...f, availableFrom: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1 dark:text-slate-400">Current Salary (₹/mo)</label>
                  <input type="number" min="0" value={candForm.currentSalary} onChange={e => setCandForm(f => ({ ...f, currentSalary: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1 dark:text-slate-400">Expected Salary (₹/mo)</label>
                  <input type="number" min="0" value={candForm.expectedSalary} onChange={e => setCandForm(f => ({ ...f, expectedSalary: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                </div>
                <Select label="Source" value={candForm.source} onChange={e => setCandForm(f => ({ ...f, source: e.target.value }))}>
                  {CAND_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                </Select>
                {editCand && (
                  <Select label="Status" value={candForm.status} onChange={e => setCandForm(f => ({ ...f, status: e.target.value }))}>
                    {CAND_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </Select>
                )}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1 dark:text-slate-400">Skills</label>
                  <TagInput tags={candForm.skills} onAdd={v => setCandForm(f => ({ ...f, skills: [...f.skills, v] }))}
                    onRemove={i => setCandForm(f => ({ ...f, skills: f.skills.filter((_, idx) => idx !== i) }))}
                    placeholder="e.g. React, TypeScript" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1 dark:text-slate-400">Preferred Locations</label>
                  <TagInput tags={candForm.preferredLocations} onAdd={v => setCandForm(f => ({ ...f, preferredLocations: [...f.preferredLocations, v] }))}
                    onRemove={i => setCandForm(f => ({ ...f, preferredLocations: f.preferredLocations.filter((_, idx) => idx !== i) }))}
                    placeholder="e.g. Bangalore, Mumbai" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1 dark:text-slate-400">Education Summary</label>
                  <textarea rows={2} value={candForm.educationSummary} onChange={e => setCandForm(f => ({ ...f, educationSummary: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1 dark:text-slate-400">Resume Notes</label>
                  <textarea rows={2} value={candForm.resumeNotes} onChange={e => setCandForm(f => ({ ...f, resumeNotes: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1 dark:text-slate-400">Notes</label>
                  <textarea rows={2} value={candForm.notes} onChange={e => setCandForm(f => ({ ...f, notes: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                </div>
              </div>
              <div className="flex gap-3 mt-4">
                <button onClick={saveCand} disabled={candSaving} className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {candSaving ? 'Saving…' : 'Save Candidate'}
                </button>
                <button onClick={() => setShowCandForm(false)} className="px-4 py-2 text-gray-600 rounded-lg text-sm hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-slate-700">Cancel</button>
              </div>
            </Card>
          )}

          {/* Candidates list */}
          {candidates.length === 0
            ? <div className="text-center text-gray-400 py-16 text-sm dark:text-slate-500">No candidates found. Add one above.</div>
            : (
              <div className="space-y-3">
                {candidates.map(c => (
                  <Card key={c.id} padding="md">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-gray-400 font-mono dark:text-slate-500">{c.candidateNumber}</span>
                          <Badge variant={CAND_STATUS_VARIANT[c.status] ?? 'neutral'} size="sm">{c.status}</Badge>
                          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full dark:bg-slate-800 dark:text-slate-400">{c.source}</span>
                        </div>
                        <p className="font-semibold text-gray-900 mt-1 dark:text-slate-100">{c.fullName}</p>
                        {(c.currentJobTitle || c.currentEmployer) && (
                          <p className="text-sm text-gray-600 dark:text-slate-400">
                            {c.currentJobTitle}{c.currentJobTitle && c.currentEmployer ? ' @ ' : ''}{c.currentEmployer}
                            {c.totalExperience != null && ` · ${c.totalExperience} yrs exp`}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-2 mt-1 text-xs text-gray-500 dark:text-slate-400">
                          {c.phone && <span>{c.phone}</span>}
                          {c.email && <span>{c.email}</span>}
                          {c.currentSalary != null && <span>Current: ₹{fmt(c.currentSalary)}/mo</span>}
                          {c.expectedSalary != null && <span>Expected: ₹{fmt(c.expectedSalary)}/mo</span>}
                          {c.availableFrom && <span>Available: {fmtDate(c.availableFrom)}</span>}
                        </div>
                        {parseSafe<string[]>(c.skills, []).length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {parseSafe<string[]>(c.skills, []).slice(0, 8).map((sk, i) => (
                              <span key={i} className="text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full">{sk}</span>
                            ))}
                            {parseSafe<string[]>(c.skills, []).length > 8 && <span className="text-xs text-gray-400 dark:text-slate-500">+{parseSafe<string[]>(c.skills, []).length - 8}</span>}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => openCandEdit(c)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg dark:text-slate-500"><Pencil size={15} /></button>
                        <button onClick={() => deleteCand(c)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg dark:text-slate-500"><Trash2 size={15} /></button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
        </div>
      )}

      {/* ── JOB ORDERS TAB ──────────────────────────────────────────────────── */}
      {!loading && tab === 'orders' && (
        <div className="flex-1 overflow-auto p-6">
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
              <input value={joSearch} onChange={e => setJoSearch(e.target.value)} placeholder="Search job orders…"
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
            </div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setJoStatusFilter('')} className={`px-3 py-1.5 rounded-full text-xs font-medium ${!joStatusFilter ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'}`}>All</button>
              {JO_STATUSES.map(s => (
                <button key={s} onClick={() => setJoStatusFilter(s === joStatusFilter ? '' : s)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium ${joStatusFilter === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'}`}>
                  {s.replace('_', ' ')}
                </button>
              ))}
            </div>
            <button onClick={openJOCreate} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 whitespace-nowrap">
              <Plus size={15} />New Job Order
            </button>
          </div>

          {/* Job Order form panel */}
          {showJOForm && (
            <Card padding="lg" className="mb-4 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900 dark:text-slate-100">{editJO ? 'Edit Job Order' : 'New Job Order'}</h3>
                <button onClick={() => setShowJOForm(false)} className="text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-200"><X size={18} /></button>
              </div>
              {joFormError && <p className="text-sm text-red-600 dark:text-red-400 mb-3">{joFormError}</p>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <Select label="Hiring Company" required value={joForm.clientId} onChange={e => setJoForm(f => ({ ...f, clientId: e.target.value }))}>
                    <option value="">Select client…</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.customerName}</option>)}
                  </Select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1 dark:text-slate-400">Job Title *</label>
                  <input value={joForm.jobTitle} onChange={e => setJoForm(f => ({ ...f, jobTitle: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1 dark:text-slate-400">Location</label>
                  <input value={joForm.location} onChange={e => setJoForm(f => ({ ...f, location: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1 dark:text-slate-400">No. of Positions</label>
                  <input type="number" min="1" value={joForm.numberOfPositions} onChange={e => setJoForm(f => ({ ...f, numberOfPositions: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1 dark:text-slate-400">Experience Min (yrs)</label>
                  <input type="number" min="0" step="0.5" value={joForm.experienceMin} onChange={e => setJoForm(f => ({ ...f, experienceMin: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1 dark:text-slate-400">Experience Max (yrs)</label>
                  <input type="number" min="0" step="0.5" value={joForm.experienceMax} onChange={e => setJoForm(f => ({ ...f, experienceMax: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1 dark:text-slate-400">Salary Budget Min (₹/mo)</label>
                  <input type="number" min="0" value={joForm.salaryBudgetMin} onChange={e => setJoForm(f => ({ ...f, salaryBudgetMin: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1 dark:text-slate-400">Salary Budget Max (₹/mo)</label>
                  <input type="number" min="0" value={joForm.salaryBudgetMax} onChange={e => setJoForm(f => ({ ...f, salaryBudgetMax: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1 dark:text-slate-400">Target Date</label>
                  <input type="date" value={joForm.targetDate} onChange={e => setJoForm(f => ({ ...f, targetDate: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                </div>
                <Select label="Commission Type" value={joForm.commissionType} onChange={e => setJoForm(f => ({ ...f, commissionType: e.target.value }))}>
                  <option value="PERCENTAGE">Percentage of Annual CTC</option>
                  <option value="FIXED">Fixed Amount</option>
                </Select>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1 dark:text-slate-400">
                    {joForm.commissionType === 'PERCENTAGE' ? 'Commission %' : 'Commission Amount (₹)'}
                  </label>
                  <input type="number" min="0" step={joForm.commissionType === 'PERCENTAGE' ? '0.5' : '1'} value={joForm.commissionValue}
                    onChange={e => setJoForm(f => ({ ...f, commissionValue: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                </div>
                {editJO && (
                  <Select label="Status" value={joForm.status} onChange={e => setJoForm(f => ({ ...f, status: e.target.value }))}>
                    {JO_STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                  </Select>
                )}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1 dark:text-slate-400">Required Skills</label>
                  <TagInput tags={joForm.requiredSkills} onAdd={v => setJoForm(f => ({ ...f, requiredSkills: [...f.requiredSkills, v] }))}
                    onRemove={i => setJoForm(f => ({ ...f, requiredSkills: f.requiredSkills.filter((_, idx) => idx !== i) }))}
                    placeholder="e.g. Java, Spring Boot" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1 dark:text-slate-400">Job Description</label>
                  <textarea rows={3} value={joForm.jobDescription} onChange={e => setJoForm(f => ({ ...f, jobDescription: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1 dark:text-slate-400">Notes</label>
                  <textarea rows={2} value={joForm.notes} onChange={e => setJoForm(f => ({ ...f, notes: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                </div>
              </div>
              <div className="flex gap-3 mt-4">
                <button onClick={saveJO} disabled={joSaving} className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {joSaving ? 'Saving…' : 'Save Job Order'}
                </button>
                <button onClick={() => setShowJOForm(false)} className="px-4 py-2 text-gray-600 rounded-lg text-sm hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-slate-700">Cancel</button>
              </div>
            </Card>
          )}

          {jobOrders.length === 0
            ? <div className="text-center text-gray-400 py-16 text-sm dark:text-slate-500">No job orders found. Add one above.</div>
            : (
              <div className="space-y-3">
                {jobOrders.map(jo => (
                  <Card key={jo.id} padding="md">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-gray-400 font-mono dark:text-slate-500">{jo.orderNumber}</span>
                          <Badge variant={JO_STATUS_VARIANT[jo.status] ?? 'neutral'} size="sm">{jo.status.replace('_', ' ')}</Badge>
                          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full dark:bg-slate-800 dark:text-slate-400">{jo._count.placements} placement{jo._count.placements !== 1 ? 's' : ''}</span>
                        </div>
                        <p className="font-semibold text-gray-900 mt-1 dark:text-slate-100">{jo.jobTitle}</p>
                        <p className="text-sm text-gray-600 dark:text-slate-400">{jo.client.customerName}{jo.location ? ` · ${jo.location}` : ''}</p>
                        <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-500 dark:text-slate-400">
                          <span>{jo.numberOfPositions} position{jo.numberOfPositions !== 1 ? 's' : ''}</span>
                          {(jo.experienceMin != null || jo.experienceMax != null) && (
                            <span>{jo.experienceMin ?? 0}–{jo.experienceMax ?? '∞'} yrs</span>
                          )}
                          {(jo.salaryBudgetMin != null || jo.salaryBudgetMax != null) && (
                            <span>₹{fmt(Number(jo.salaryBudgetMin ?? 0))}–₹{fmt(Number(jo.salaryBudgetMax ?? 0))}/mo</span>
                          )}
                          <span className="font-medium text-blue-600 dark:text-blue-400">
                            Commission: {jo.commissionType === 'PERCENTAGE' ? `${jo.commissionValue}% of CTC` : `₹${fmt(Number(jo.commissionValue))}`}
                          </span>
                          {jo.targetDate && <span>Target: {fmtDate(jo.targetDate)}</span>}
                        </div>
                        {parseSafe<string[]>(jo.requiredSkills, []).length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {parseSafe<string[]>(jo.requiredSkills, []).slice(0, 6).map((sk, i) => (
                              <span key={i} className="text-xs bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 px-2 py-0.5 rounded-full">{sk}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => openJOEdit(jo)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg dark:text-slate-500"><Pencil size={15} /></button>
                        <button onClick={() => deleteJO(jo)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg dark:text-slate-500"><Trash2 size={15} /></button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
        </div>
      )}

      {/* ── PLACEMENTS TAB ──────────────────────────────────────────────────── */}
      {!loading && tab === 'placements' && (
        <div className="flex-1 overflow-auto p-6">
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
              <input value={plcSearch} onChange={e => setPlcSearch(e.target.value)} placeholder="Search placements…"
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
            </div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setPlcStatusFilter('')} className={`px-3 py-1.5 rounded-full text-xs font-medium ${!plcStatusFilter ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'}`}>All</button>
              {PLC_STATUSES.map(s => (
                <button key={s} onClick={() => setPlcStatusFilter(s === plcStatusFilter ? '' : s)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium ${plcStatusFilter === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'}`}>
                  {s}
                </button>
              ))}
            </div>
            <button onClick={openPLCCreate} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 whitespace-nowrap">
              <Plus size={15} />New Placement
            </button>
          </div>

          {/* Placement form panel */}
          {showPLCForm && (
            <Card padding="lg" className="mb-4 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900 dark:text-slate-100">{editPLC ? 'Edit Placement' : 'New Placement'}</h3>
                <button onClick={() => setShowPLCForm(false)} className="text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-200"><X size={18} /></button>
              </div>
              {plcFormError && <p className="text-sm text-red-600 dark:text-red-400 mb-3">{plcFormError}</p>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Select label="Candidate" required value={plcForm.candidateId}
                  onChange={e => setPlcForm(f => ({ ...f, candidateId: e.target.value }))}>
                  <option value="">Select candidate…</option>
                  {allCandidates.map(c => (
                    <option key={c.id} value={c.id}>{c.fullName} ({c.candidateNumber})</option>
                  ))}
                </Select>
                <Select label="Job Order" required value={plcForm.jobOrderId}
                  onChange={e => {
                    const joId = e.target.value
                    const jo = jobOrders.find(j => j.id === joId)
                    const clientId = jo?.clientId ?? ''
                    const commission = calcCommission(joId, plcForm.offeredSalary)
                    setPlcForm(f => ({ ...f, jobOrderId: joId, clientId, commissionAmount: commission || f.commissionAmount }))
                  }}>
                  <option value="">Select job order…</option>
                  {allJobOrders.filter(jo => ['OPEN', 'IN_PROGRESS'].includes(jo.status) || jo.id === plcForm.jobOrderId).map(jo => (
                    <option key={jo.id} value={jo.id}>{jo.jobTitle} – {jo.client.customerName} ({jo.orderNumber})</option>
                  ))}
                </Select>
                <Select label="Hiring Company" value={plcForm.clientId} onChange={e => setPlcForm(f => ({ ...f, clientId: e.target.value }))}>
                  <option value="">Select client…</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.customerName}</option>)}
                </Select>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1 dark:text-slate-400">Joining Date *</label>
                  <input type="date" value={plcForm.joiningDate} onChange={e => setPlcForm(f => ({ ...f, joiningDate: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1 dark:text-slate-400">Offered Salary (₹/mo) *</label>
                  <input type="number" min="0" value={plcForm.offeredSalary}
                    onChange={e => {
                      const salary = e.target.value
                      const commission = calcCommission(plcForm.jobOrderId, salary)
                      setPlcForm(f => ({ ...f, offeredSalary: salary, commissionAmount: commission || f.commissionAmount }))
                    }}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1 dark:text-slate-400">Commission Amount (₹)</label>
                  <input type="number" min="0" value={plcForm.commissionAmount} onChange={e => setPlcForm(f => ({ ...f, commissionAmount: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                  {plcForm.jobOrderId && (
                    <p className="text-xs text-gray-400 mt-1 dark:text-slate-500">
                      {(() => {
                        const jo = allJobOrders.find(j => j.id === plcForm.jobOrderId)
                        return jo ? `Auto from job order: ${jo.commissionType === 'PERCENTAGE' ? `${jo.commissionValue}% of annual CTC` : `Fixed ₹${fmt(Number(jo.commissionValue))}`}` : ''
                      })()}
                    </p>
                  )}
                </div>
                {editPLC && (
                  <Select label="Status" value={plcForm.status} onChange={e => setPlcForm(f => ({ ...f, status: e.target.value }))}>
                    {PLC_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </Select>
                )}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1 dark:text-slate-400">Notes</label>
                  <textarea rows={2} value={plcForm.notes} onChange={e => setPlcForm(f => ({ ...f, notes: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                </div>
              </div>
              <div className="flex gap-3 mt-4">
                <button onClick={savePLC} disabled={plcSaving} className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {plcSaving ? 'Saving…' : 'Save Placement'}
                </button>
                <button onClick={() => setShowPLCForm(false)} className="px-4 py-2 text-gray-600 rounded-lg text-sm hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-slate-700">Cancel</button>
              </div>
            </Card>
          )}

          {placements.length === 0
            ? <div className="text-center text-gray-400 py-16 text-sm dark:text-slate-500">No placements found. Add one above.</div>
            : (
              <div className="space-y-3">
                {placements.map(p => (
                  <Card key={p.id} padding="md">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-gray-400 font-mono dark:text-slate-500">{p.placementNumber}</span>
                            <Badge variant={PLC_STATUS_VARIANT[p.status] ?? 'neutral'} size="sm">{p.status}</Badge>
                            {p.invoiceId && <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full flex items-center gap-1"><Receipt size={10} />Invoiced</span>}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <p className="font-semibold text-gray-900 dark:text-slate-100">{p.candidate.fullName}</p>
                            <ChevronRight size={14} className="text-gray-400 dark:text-slate-500" />
                            <p className="font-semibold text-gray-900 dark:text-slate-100">{p.jobOrder.jobTitle}</p>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-slate-400">Client: {p.client.customerName} · Joining: {fmtDate(p.joiningDate)}</p>
                          <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-500 dark:text-slate-400">
                            <span>Offered: ₹{fmt(Number(p.offeredSalary))}/mo</span>
                            <span className="font-medium text-purple-600 dark:text-purple-400">Commission: ₹{fmt(Number(p.commissionAmount))}</span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1 shrink-0 items-end">
                          <div className="flex gap-2">
                            <button onClick={() => printPlacementLetter(p)} title="Print confirmation letter" className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg dark:text-slate-500"><Printer size={15} /></button>
                            <button onClick={() => openPLCEdit(p)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg dark:text-slate-500"><Pencil size={15} /></button>
                            <button onClick={() => deletePLC(p)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg dark:text-slate-500"><Trash2 size={15} /></button>
                          </div>
                          {PLC_STATUS_NEXT[p.status] && (
                            <button onClick={() => advancePLC(p)} className="flex items-center gap-1 text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 px-3 py-1 rounded-full">
                              Mark {PLC_STATUS_NEXT[p.status]} <ChevronRight size={12} />
                            </button>
                          )}
                          {p.status === 'JOINED' && !p.invoiceId && (
                            <button onClick={() => generatePLCInvoice(p)} className="flex items-center gap-1 text-xs bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/50 px-3 py-1 rounded-full">
                              <Receipt size={12} />Generate Invoice
                            </button>
                          )}
                        </div>
                      </div>
                      {invoiceBanners[p.id] && (
                        <div className={`mt-2 text-xs px-3 py-1.5 rounded-lg flex items-center justify-between ${invoiceBanners[p.id].ok ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'}`}>
                          <span>{invoiceBanners[p.id].msg}</span>
                          <button onClick={() => setInvoiceBanners(prev => { const n = { ...prev }; delete n[p.id]; return n })} className="ml-2 opacity-60 hover:opacity-100"><X size={12} /></button>
                        </div>
                      )}
                  </Card>
                ))}
              </div>
            )}
        </div>
      )}
    </div>
  )
}
