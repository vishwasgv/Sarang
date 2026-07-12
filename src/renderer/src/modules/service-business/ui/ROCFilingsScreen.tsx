import React, { useEffect, useState, useCallback } from 'react'
import { FileStack, Calendar, Plus, X, Search, RefreshCw, Edit2, Trash2, CheckSquare, Square, Printer } from 'lucide-react'
import { api } from '@renderer/services/ipc-client'
import { cn } from '@shared/utils/cn'
import { aszurexFooterHtml } from '@shared/utils/print-branding'
import { KpiCard } from '@shared/ui/molecules/KpiCard'
import { Badge } from '@shared/ui/atoms/Badge'
import { Select } from '@shared/ui/atoms/Select'
import { useNotificationStore } from '@app/store/notification.store'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ROCFiling {
  id: string
  clientId: string
  staffId: string | null
  formType: string
  financialYear: string | null
  purpose: string | null
  dueDate: string | null
  filedOn: string | null
  srn: string | null
  status: string
  govtFee: number | null
  notes: string | null
  client: { id: string; customerName: string; phone: string | null }
  staff: { id: string; fullName: string } | null
}

interface BoardMeeting {
  id: string
  clientId: string
  meetingType: string
  meetingDate: string
  meetingTime: string | null
  venue: string | null
  agenda: string | null
  quorumMet: boolean
  minutesDone: boolean
  minutesText: string | null
  noticesSent: boolean
  notes: string | null
  client: { id: string; customerName: string; phone: string | null }
}

interface BoardResolution {
  id: string
  boardMeetingId: string
  resolutionNumber: string
  resolutionType: string
  resolutionText: string
  passedUnanimously: boolean
}

interface Customer {
  id: string
  customerName: string
  phone: string | null
}

interface Employee {
  id: string
  fullName: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtAmt(n: number | null): string {
  if (n == null) return '—'
  return `₹${Number(n).toLocaleString('en-IN')}`
}

function daysUntil(iso: string): number {
  const d = new Date(iso); d.setHours(0, 0, 0, 0)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return Math.ceil((d.getTime() - today.getTime()) / 86400000)
}

function urgencyClass(iso: string | null, status: string): string {
  if (!iso || status === 'FILED' || status === 'ACKNOWLEDGED') return ''
  const d = daysUntil(iso)
  if (d < 0) return 'text-red-600 dark:text-red-400 font-semibold'
  if (d <= 7) return 'text-amber-600 dark:text-amber-400 font-semibold'
  return ''
}

const ROC_STATUS_LABELS: Record<string, string> = {
  PENDING:      'Pending',
  IN_PROGRESS:  'In Progress',
  FILED:        'Filed',
  ACKNOWLEDGED: 'Acknowledged',
  DEFECTIVE:    'Defective',
}

// Exhaustive against ROCFiling.status in prisma/schema.prisma (PENDING|IN_PROGRESS|FILED|ACKNOWLEDGED|DEFECTIVE)
const ROC_STATUS_VARIANT: Record<string, 'neutral' | 'info' | 'success' | 'brand' | 'danger'> = {
  PENDING:      'neutral',
  IN_PROGRESS:  'info',
  FILED:        'success',
  ACKNOWLEDGED: 'brand',
  DEFECTIVE:    'danger',
}

const MEETING_TYPE_LABELS: Record<string, string> = {
  BOARD: 'Board Meeting', AGM: 'AGM', EGM: 'EGM', AUDIT_COMMITTEE: 'Audit Committee', NRC: 'NRC',
}

const ROC_STATUSES  = ['PENDING', 'IN_PROGRESS', 'FILED', 'ACKNOWLEDGED', 'DEFECTIVE']
const FORM_TYPES    = ['MGT-7', 'AOC-4', 'DIR-12', 'INC-22', 'PAS-3', 'ADT-1', 'MBP-1', 'OTHER']
const MEETING_TYPES = ['BOARD', 'AGM', 'EGM', 'AUDIT_COMMITTEE', 'NRC']

function printBoardMeetingMinutes(m: BoardMeeting) {
  const dateLabel = new Date(m.meetingDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const printedOn = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  const typeLabel = MEETING_TYPE_LABELS[m.meetingType] ?? m.meetingType

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Board Meeting Minutes</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; color: #1a1a1a; padding: 40px; max-width: 700px; margin: 0 auto; }
  h1 { font-size: 20px; margin: 0 0 4px; text-align: center; } .subtitle { text-align: center; color: #555; margin-bottom: 24px; }
  .row { display: flex; gap: 12px; padding: 7px 0; border-bottom: 1px solid #f1f5f9; }
  .label { color: #555; width: 140px; flex-shrink: 0; } .value { font-weight: 500; flex: 1; }
  .section-title { font-size: 13px; font-weight: 700; margin: 20px 0 8px; color: #1e293b; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
  .agenda-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; white-space: pre-wrap; line-height: 1.7; }
  .checkbox { display: inline-block; width: 14px; height: 14px; border: 1px solid #94a3b8; border-radius: 2px; margin-right: 6px; text-align: center; font-size: 10px; }
  .checked { background: #16a34a; color: white; border-color: #16a34a; }
  .sig-row { display: flex; gap: 40px; margin-top: 40px; }
  .sig-box { flex: 1; border-top: 1px solid #1a1a1a; padding-top: 6px; font-size: 11px; color: #555; }
  .footer { font-size: 10px; color: #555; text-align: center; margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 10px; }
</style></head><body>
<h1>${typeLabel} Meeting Minutes</h1>
<div class="subtitle">${m.client.customerName}</div>
<div class="row"><span class="label">Meeting Date</span><span class="value">${dateLabel}</span></div>
${m.meetingTime ? `<div class="row"><span class="label">Time</span><span class="value">${m.meetingTime}</span></div>` : ''}
${m.venue ? `<div class="row"><span class="label">Venue</span><span class="value">${m.venue}</span></div>` : ''}
<div class="row"><span class="label">Meeting Type</span><span class="value">${typeLabel}</span></div>
<div class="row">
  <span class="label">Quorum Met</span>
  <span class="value"><span class="checkbox ${m.quorumMet ? 'checked' : ''}">${m.quorumMet ? '✓' : ''}</span>${m.quorumMet ? 'Yes — Quorum was met' : 'No — Quorum not met'}</span>
</div>
<div class="row">
  <span class="label">Notices Sent</span>
  <span class="value"><span class="checkbox ${m.noticesSent ? 'checked' : ''}">${m.noticesSent ? '✓' : ''}</span>${m.noticesSent ? 'Yes' : 'No'}</span>
</div>
<div class="row">
  <span class="label">Minutes Done</span>
  <span class="value"><span class="checkbox ${m.minutesDone ? 'checked' : ''}">${m.minutesDone ? '✓' : ''}</span>${m.minutesDone ? 'Yes' : 'Pending'}</span>
</div>
${m.agenda ? `<div class="section-title">Agenda / Matters Discussed</div><div class="agenda-box">${m.agenda}</div>` : ''}
${m.notes ? `<div class="section-title">Notes / Resolutions</div><div class="agenda-box">${m.notes}</div>` : ''}
<div class="sig-row">
  <div class="sig-box">Chairperson Signature</div>
  <div class="sig-box">Company Secretary / Authorised Signatory</div>
</div>
<div class="row" style="margin-top:16px"><span class="label">Printed On</span><span>${printedOn}</span></div>
<div class="footer">${aszurexFooterHtml(10)}</div>
</body></html>`

  const win = window.open('', '_blank', 'width=780,height=980')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.focus()
  win.print()
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ROCFilingsScreen(): React.JSX.Element {
  const { error: toastError } = useNotificationStore()
  const [tab, setTab] = useState<'filings' | 'meetings'>('filings')

  // ROC Filings state
  const [filings, setFilings] = useState<ROCFiling[]>([])
  const [kpiFilings, setKpiFilings] = useState<ROCFiling[]>([])
  const [loadingFilings, setLoadingFilings] = useState(false)
  const [filingsSearch, setFilingsSearch] = useState('')
  const [filingsStatusFilter, setFilingsStatusFilter] = useState('')
  const [filingsClientFilter, setFilingsClientFilter] = useState('')

  const [showFilingForm, setShowFilingForm] = useState(false)
  const [editFiling, setEditFiling] = useState<ROCFiling | null>(null)
  const [fFormClientId, setFFormClientId] = useState('')
  const [fFormStaffId, setFFormStaffId] = useState('')
  const [fFormType, setFFormType] = useState('MGT-7')
  const [fFormFY, setFFormFY] = useState('')
  const [fFormPurpose, setFFormPurpose] = useState('')
  const [fFormDueDate, setFFormDueDate] = useState('')
  const [fFormFiledOn, setFFormFiledOn] = useState('')
  const [fFormSRN, setFFormSRN] = useState('')
  const [fFormStatus, setFFormStatus] = useState('PENDING')
  const [fFormGovtFee, setFFormGovtFee] = useState('')
  const [fFormNotes, setFFormNotes] = useState('')
  const [fFormSaving, setFFormSaving] = useState(false)

  // Board Meetings state
  const [meetings, setMeetings] = useState<BoardMeeting[]>([])
  const [kpiMeetings, setKpiMeetings] = useState<BoardMeeting[]>([])
  const [loadingMeetings, setLoadingMeetings] = useState(false)
  const [meetingsSearch, setMeetingsSearch] = useState('')
  const [meetingsClientFilter, setMeetingsClientFilter] = useState('')
  const [meetingsTypeFilter, setMeetingsTypeFilter] = useState('')

  const [showMeetingForm, setShowMeetingForm] = useState(false)
  const [editMeeting, setEditMeeting] = useState<BoardMeeting | null>(null)
  const [mFormClientId, setMFormClientId] = useState('')
  const [mFormType, setMFormType] = useState('BOARD')
  const [mFormDate, setMFormDate] = useState('')
  const [mFormTime, setMFormTime] = useState('')
  const [mFormVenue, setMFormVenue] = useState('')
  const [mFormAgenda, setMFormAgenda] = useState('')
  const [mFormNotes, setMFormNotes] = useState('')
  const [mFormQuorum, setMFormQuorum] = useState(false)
  const [mFormMinutes, setMFormMinutes] = useState(false)
  const [mFormMinutesText, setMFormMinutesText] = useState('')
  const [mFormNotices, setMFormNotices] = useState(false)
  const [mFormSaving, setMFormSaving] = useState(false)

  // Resolution register (F.12) — a modal on top of the meetings table, same
  // pattern as the meeting/filing forms already on this screen.
  const [resolutionMeeting, setResolutionMeeting] = useState<BoardMeeting | null>(null)
  const [resolutions, setResolutions] = useState<BoardResolution[]>([])
  const [resolutionsLoading, setResolutionsLoading] = useState(false)
  const [resNumber, setResNumber] = useState('')
  const [resType, setResType] = useState('ORDINARY')
  const [resText, setResText] = useState('')
  const [resUnanimous, setResUnanimous] = useState(true)
  const [resSaving, setResSaving] = useState(false)

  // Shared
  const [clients, setClients] = useState<Customer[]>([])
  const [staff, setStaff] = useState<Employee[]>([])

  const loadFilings = useCallback(async () => {
    setLoadingFilings(true)
    try {
      const filters: Record<string, unknown> = {}
      if (filingsStatusFilter) filters.status = filingsStatusFilter
      if (filingsClientFilter) filters.clientId = filingsClientFilter
      const [res, kpiRes] = await Promise.all([
        api.rocFiling.list(filters),
        api.rocFiling.list({}),
      ])
      if (res.success) setFilings(res.data as ROCFiling[])
      else toastError('Error', res.error?.message ?? 'Could not load ROC filings.')
      if (kpiRes.success) setKpiFilings(kpiRes.data as ROCFiling[])
    } catch {
      toastError('Error', 'Could not load ROC filings.')
    } finally {
      setLoadingFilings(false)
    }
  }, [filingsStatusFilter, filingsClientFilter, toastError])

  const loadMeetings = useCallback(async () => {
    setLoadingMeetings(true)
    try {
      const filters: Record<string, unknown> = {}
      if (meetingsClientFilter) filters.clientId = meetingsClientFilter
      if (meetingsTypeFilter) filters.meetingType = meetingsTypeFilter
      const [res, kpiRes] = await Promise.all([
        api.boardMeeting.list(filters),
        api.boardMeeting.list({}),
      ])
      if (res.success) setMeetings(res.data as BoardMeeting[])
      else toastError('Error', res.error?.message ?? 'Could not load board meetings.')
      if (kpiRes.success) setKpiMeetings(kpiRes.data as BoardMeeting[])
    } catch {
      toastError('Error', 'Could not load board meetings.')
    } finally {
      setLoadingMeetings(false)
    }
  }, [meetingsClientFilter, meetingsTypeFilter, toastError])

  const loadClients = useCallback(async () => {
    try {
      const res = await api.customers.list({ limit: 1000 })
      if (res.success) setClients((res.data as { customers: Customer[] }).customers ?? [])
      else toastError('Error', res.error?.message ?? 'Could not load clients.')
    } catch {
      toastError('Error', 'Could not load clients.')
    }
  }, [toastError])

  const loadStaff = useCallback(async () => {
    try {
      const res = await api.hr.listEmployees({ isActive: true })
      if (res.success) setStaff((res.data as { employees: Employee[] }).employees ?? [])
      else toastError('Error', res.error?.message ?? 'Could not load staff.')
    } catch {
      toastError('Error', 'Could not load staff.')
    }
  }, [toastError])

  useEffect(() => {
    void loadFilings()
    void loadMeetings()
    void loadClients()
    void loadStaff()
  }, [loadFilings, loadMeetings, loadClients, loadStaff])

  // ── Filing form ──────────────────────────────────────────────────────────────

  function openAddFiling(): void {
    setEditFiling(null)
    setFFormClientId(''); setFFormStaffId(''); setFFormType('MGT-7'); setFFormFY(''); setFFormPurpose('')
    setFFormDueDate(''); setFFormFiledOn(''); setFFormSRN(''); setFFormStatus('PENDING'); setFFormGovtFee(''); setFFormNotes('')
    setShowFilingForm(true)
  }

  function openEditFiling(f: ROCFiling): void {
    setEditFiling(f)
    setFFormClientId(f.clientId); setFFormStaffId(f.staffId ?? ''); setFFormType(f.formType); setFFormFY(f.financialYear ?? '')
    setFFormPurpose(f.purpose ?? ''); setFFormDueDate(f.dueDate ? f.dueDate.slice(0, 10) : '')
    setFFormFiledOn(f.filedOn ? f.filedOn.slice(0, 10) : ''); setFFormSRN(f.srn ?? ''); setFFormStatus(f.status)
    setFFormGovtFee(f.govtFee != null ? String(f.govtFee) : ''); setFFormNotes(f.notes ?? '')
    setShowFilingForm(true)
  }

  async function handleSaveFiling(): Promise<void> {
    if (!fFormClientId || !fFormType) return
    setFFormSaving(true)
    try {
      const govtFee = fFormGovtFee ? Number(fFormGovtFee) : undefined
      // filedOn and SRN are only meaningful once a filing has been submitted
      const isPostFiled = ['FILED', 'ACKNOWLEDGED', 'DEFECTIVE'].includes(fFormStatus)
      let res
      if (editFiling) {
        res = await api.rocFiling.update({
          id: editFiling.id, staffId: fFormStaffId || null, formType: fFormType,
          financialYear: fFormFY || null, purpose: fFormPurpose || null,
          dueDate: fFormDueDate || null,
          filedOn: isPostFiled ? (fFormFiledOn || null) : null,
          srn: isPostFiled ? (fFormSRN || null) : null,
          status: fFormStatus, govtFee: govtFee ?? null, notes: fFormNotes || null,
        })
      } else {
        res = await api.rocFiling.create({
          clientId: fFormClientId, staffId: fFormStaffId || undefined, formType: fFormType,
          financialYear: fFormFY || undefined, purpose: fFormPurpose || undefined,
          dueDate: fFormDueDate || undefined, govtFee: govtFee, notes: fFormNotes || undefined,
        })
      }
      if (res.success) {
        setShowFilingForm(false)
        await loadFilings()
      } else {
        toastError('Error', res.error?.message ?? 'Could not save ROC filing.')
      }
    } catch {
      toastError('Error', 'Could not save ROC filing.')
    } finally {
      setFFormSaving(false)
    }
  }

  async function handleDeleteFiling(id: string): Promise<void> {
    try {
      const res = await api.rocFiling.delete({ id })
      if (res.success) await loadFilings()
      else toastError('Error', res.error?.message ?? 'Could not delete ROC filing.')
    } catch {
      toastError('Error', 'Could not delete ROC filing.')
    }
  }

  // ── Meeting form ─────────────────────────────────────────────────────────────

  function openAddMeeting(): void {
    setEditMeeting(null)
    setMFormClientId(''); setMFormType('BOARD'); setMFormDate(''); setMFormTime('')
    setMFormVenue(''); setMFormAgenda(''); setMFormNotes('')
    setMFormQuorum(false); setMFormMinutes(false); setMFormNotices(false)
    setShowMeetingForm(true)
  }

  function openEditMeeting(m: BoardMeeting): void {
    setEditMeeting(m)
    setMFormClientId(m.clientId); setMFormType(m.meetingType); setMFormDate(m.meetingDate.slice(0, 10))
    setMFormTime(m.meetingTime ?? ''); setMFormVenue(m.venue ?? ''); setMFormAgenda(m.agenda ?? '')
    setMFormNotes(m.notes ?? ''); setMFormQuorum(m.quorumMet); setMFormMinutes(m.minutesDone); setMFormMinutesText(m.minutesText ?? ''); setMFormNotices(m.noticesSent)
    setShowMeetingForm(true)
  }

  async function handleSaveMeeting(): Promise<void> {
    if (!mFormClientId || !mFormDate) return
    setMFormSaving(true)
    try {
      let res
      if (editMeeting) {
        res = await api.boardMeeting.update({
          id: editMeeting.id, meetingType: mFormType, meetingDate: mFormDate,
          meetingTime: mFormTime || null, venue: mFormVenue || null, agenda: mFormAgenda || null,
          quorumMet: mFormQuorum, minutesDone: mFormMinutes, minutesText: mFormMinutesText || null, noticesSent: mFormNotices, notes: mFormNotes || null,
        })
      } else {
        res = await api.boardMeeting.create({
          clientId: mFormClientId, meetingType: mFormType, meetingDate: mFormDate,
          meetingTime: mFormTime || undefined, venue: mFormVenue || undefined,
          agenda: mFormAgenda || undefined, notes: mFormNotes || undefined,
        })
      }
      if (res.success) {
        setShowMeetingForm(false)
        await loadMeetings()
      } else {
        toastError('Error', res.error?.message ?? 'Could not save board meeting.')
      }
    } catch {
      toastError('Error', 'Could not save board meeting.')
    } finally {
      setMFormSaving(false)
    }
  }

  async function handleDeleteMeeting(id: string): Promise<void> {
    try {
      const res = await api.boardMeeting.delete({ id })
      if (res.success) await loadMeetings()
      else toastError('Error', res.error?.message ?? 'Could not delete board meeting.')
    } catch {
      toastError('Error', 'Could not delete board meeting.')
    }
  }

  async function toggleMeetingFlag(m: BoardMeeting, flag: 'quorumMet' | 'minutesDone' | 'noticesSent'): Promise<void> {
    try {
      const res = await api.boardMeeting.update({ id: m.id, [flag]: !m[flag] })
      if (res.success) await loadMeetings()
      else toastError('Error', res.error?.message ?? 'Could not update meeting.')
    } catch {
      toastError('Error', 'Could not update meeting.')
    }
  }

  // ── Resolutions (F.12) ──────────────────────────────────────────────────────

  async function openResolutions(m: BoardMeeting): Promise<void> {
    setResolutionMeeting(m)
    setResNumber(''); setResType('ORDINARY'); setResText(''); setResUnanimous(true)
    setResolutionsLoading(true)
    try {
      const res = await api.boardResolution.list({ boardMeetingId: m.id })
      if (res.success) setResolutions((res.data as BoardResolution[]) ?? [])
      else toastError('Error', res.error?.message ?? 'Could not load resolutions.')
    } catch {
      toastError('Error', 'Could not load resolutions.')
    } finally {
      setResolutionsLoading(false)
    }
  }

  async function handleAddResolution(): Promise<void> {
    if (!resolutionMeeting || !resNumber.trim() || !resText.trim()) return
    setResSaving(true)
    try {
      const res = await api.boardResolution.create({
        boardMeetingId: resolutionMeeting.id, resolutionNumber: resNumber.trim(),
        resolutionType: resType, resolutionText: resText.trim(), passedUnanimously: resUnanimous,
      })
      if (res.success) {
        setResNumber(''); setResText(''); setResUnanimous(true)
        const listRes = await api.boardResolution.list({ boardMeetingId: resolutionMeeting.id })
        if (listRes.success) setResolutions((listRes.data as BoardResolution[]) ?? [])
        else toastError('Error', listRes.error?.message ?? 'Could not refresh resolutions.')
      } else {
        toastError('Error', res.error?.message ?? 'Could not add resolution.')
      }
    } catch {
      toastError('Error', 'Could not add resolution.')
    } finally {
      setResSaving(false)
    }
  }

  async function handleDeleteResolution(id: string): Promise<void> {
    if (!resolutionMeeting) return
    try {
      const res = await api.boardResolution.delete({ id })
      if (res.success) setResolutions((prev) => prev.filter((r) => r.id !== id))
      else toastError('Error', res.error?.message ?? 'Could not delete resolution.')
    } catch {
      toastError('Error', 'Could not delete resolution.')
    }
  }

  // ── Derived ──────────────────────────────────────────────────────────────────

  const filteredFilings = filings.filter((f) => {
    if (!filingsSearch) return true
    const q = filingsSearch.toLowerCase()
    return f.client.customerName.toLowerCase().includes(q) || f.formType.toLowerCase().includes(q) || (f.srn ?? '').toLowerCase().includes(q)
  })

  const filteredMeetings = meetings.filter((m) => {
    if (!meetingsSearch) return true
    const q = meetingsSearch.toLowerCase()
    return m.client.customerName.toLowerCase().includes(q) || m.meetingType.toLowerCase().includes(q)
  })

  const pendingFilings = kpiFilings.filter((f) => f.status === 'PENDING' || f.status === 'IN_PROGRESS').length
  const filedFilings   = kpiFilings.filter((f) => f.status === 'FILED' || f.status === 'ACKNOWLEDGED').length
  const upcomingMtgs   = kpiMeetings.filter((m) => { const d = daysUntil(m.meetingDate); return d >= 0 && d <= 30 }).length

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-slate-950">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-gray-200 px-6 py-4 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center">
              <FileStack className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">ROC Filings & Meetings</h1>
              <p className="text-sm text-gray-500 dark:text-slate-400">MCA filings and board meeting tracker</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { void loadFilings(); void loadMeetings() }} className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200">
              <RefreshCw className="w-4 h-4" />
            </button>
            {tab === 'filings' && (
              <button onClick={openAddFiling} className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors" style={{ minHeight: 44 }}>
                <Plus className="w-4 h-4" />
                Add Filing
              </button>
            )}
            {tab === 'meetings' && (
              <button onClick={openAddMeeting} className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors" style={{ minHeight: 44 }}>
                <Plus className="w-4 h-4" />
                Add Meeting
              </button>
            )}
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          <KpiCard label="Pending Filings" value={pendingFilings} color="warning" />
          <KpiCard label="Filed / Acknowledged" value={filedFilings} color="success" />
          <KpiCard label="Meetings in 30 Days" value={upcomingMtgs} color="brand" />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4 border-b border-gray-200 dark:border-slate-700">
          {[{ key: 'filings', label: 'ROC Filings', icon: FileStack }, { key: 'meetings', label: 'Board Meetings', icon: Calendar }].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key as 'filings' | 'meetings')}
              className={cn('flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors', tab === key ? 'border-teal-600 text-teal-700' : 'border-transparent text-gray-500 hover:text-gray-700')}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── ROC Filings Tab ──────────────────────────────────────────────────── */}
      {tab === 'filings' && (
        <>
          {/* Filters */}
          <div className="bg-white dark:bg-slate-900 border-b border-gray-200 px-6 py-3 flex items-center gap-3 flex-wrap dark:border-slate-700">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
              <input type="text" placeholder="Search client, form, SRN..." value={filingsSearch} onChange={(e) => setFilingsSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" style={{ minHeight: 48 }} />
            </div>
            <Select value={filingsStatusFilter} onChange={(e) => setFilingsStatusFilter(e.target.value)}>
              <option value="">All Statuses</option>
              {ROC_STATUSES.map((s) => <option key={s} value={s}>{ROC_STATUS_LABELS[s] ?? s}</option>)}
            </Select>
            <Select value={filingsClientFilter} onChange={(e) => setFilingsClientFilter(e.target.value)}>
              <option value="">All Clients</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.customerName}</option>)}
            </Select>
          </div>

          <div className="flex-1 overflow-auto">
            {loadingFilings ? (
              <div className="flex items-center justify-center h-full text-gray-500 text-sm dark:text-slate-400">Loading...</div>
            ) : filteredFilings.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2 dark:text-slate-500">
                <FileStack className="w-12 h-12 opacity-30" />
                <p className="text-sm">No ROC filings found.</p>
                <button onClick={openAddFiling} className="text-sm text-teal-600 hover:underline">Add first filing</button>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-white dark:bg-slate-900 border-b border-gray-200 sticky top-0 dark:border-slate-700">
                  <tr>
                    {['Client', 'Form', 'FY', 'Purpose', 'Due Date', 'Filed On', 'SRN', 'Govt Fee', 'Assigned', 'Status', 'Actions'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap dark:text-slate-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                  {filteredFilings.map((f) => (
                    <tr key={f.id} className="hover:bg-gray-50 transition-colors dark:hover:bg-slate-800">
                      <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap dark:text-slate-100">{f.client.customerName}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded text-xs bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 font-bold">{f.formType}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-600 dark:text-slate-400">{f.financialYear ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600 max-w-xs truncate dark:text-slate-400">{f.purpose ?? '—'}</td>
                      <td className={cn('px-4 py-3 whitespace-nowrap', urgencyClass(f.dueDate, f.status))}>
                        {fmtDate(f.dueDate)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-600 dark:text-slate-400">{fmtDate(f.filedOn)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500 dark:text-slate-400">{f.srn ?? '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-600 dark:text-slate-400">{fmtAmt(f.govtFee)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-600 dark:text-slate-400">{f.staff?.fullName ?? '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Badge variant={ROC_STATUS_VARIANT[f.status] ?? 'neutral'} size="sm">{ROC_STATUS_LABELS[f.status] ?? f.status}</Badge>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEditFiling(f)} className="p-1.5 text-gray-400 hover:text-teal-600 rounded hover:bg-teal-50 transition-colors dark:text-slate-500" style={{ minHeight: 32, minWidth: 32 }}>
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => void handleDeleteFiling(f.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors dark:text-slate-500" style={{ minHeight: 32, minWidth: 32 }}>
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* ── Board Meetings Tab ───────────────────────────────────────────────── */}
      {tab === 'meetings' && (
        <>
          <div className="bg-white dark:bg-slate-900 border-b border-gray-200 px-6 py-3 flex items-center gap-3 flex-wrap dark:border-slate-700">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
              <input type="text" placeholder="Search client, type..." value={meetingsSearch} onChange={(e) => setMeetingsSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" style={{ minHeight: 48 }} />
            </div>
            <Select value={meetingsTypeFilter} onChange={(e) => setMeetingsTypeFilter(e.target.value)}>
              <option value="">All Types</option>
              {MEETING_TYPES.map((t) => <option key={t} value={t}>{MEETING_TYPE_LABELS[t]}</option>)}
            </Select>
            <Select value={meetingsClientFilter} onChange={(e) => setMeetingsClientFilter(e.target.value)}>
              <option value="">All Clients</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.customerName}</option>)}
            </Select>
          </div>

          <div className="flex-1 overflow-auto">
            {loadingMeetings ? (
              <div className="flex items-center justify-center h-full text-gray-500 text-sm dark:text-slate-400">Loading...</div>
            ) : filteredMeetings.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2 dark:text-slate-500">
                <Calendar className="w-12 h-12 opacity-30" />
                <p className="text-sm">No board meetings found.</p>
                <button onClick={openAddMeeting} className="text-sm text-teal-600 hover:underline">Add first meeting</button>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-white dark:bg-slate-900 border-b border-gray-200 sticky top-0 dark:border-slate-700">
                  <tr>
                    {['Date', 'Client', 'Type', 'Venue', 'Notices', 'Quorum', 'Minutes', 'Actions'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap dark:text-slate-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                  {filteredMeetings.map((m) => {
                    const days = daysUntil(m.meetingDate)
                    const dateClass = days < 0 ? '' : days <= 7 ? 'text-amber-600 dark:text-amber-400 font-semibold' : ''
                    return (
                      <tr key={m.id} className="hover:bg-gray-50 transition-colors dark:hover:bg-slate-800">
                        <td className={cn('px-4 py-3 whitespace-nowrap', dateClass)}>
                          <div>{fmtDate(m.meetingDate)}</div>
                          {m.meetingTime && <div className="text-xs text-gray-400 dark:text-slate-500">{m.meetingTime}</div>}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap dark:text-slate-100">{m.client.customerName}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded text-xs bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 font-medium">{MEETING_TYPE_LABELS[m.meetingType] ?? m.meetingType}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-600 max-w-xs truncate dark:text-slate-400">{m.venue ?? '—'}</td>
                        <td className="px-4 py-3">
                          <button onClick={() => void toggleMeetingFlag(m, 'noticesSent')} className="flex items-center gap-1 text-xs hover:text-teal-700 transition-colors" style={{ minHeight: 28 }}>
                            {m.noticesSent ? <CheckSquare className="w-4 h-4 text-green-600" /> : <Square className="w-4 h-4 text-gray-400 dark:text-slate-500" />}
                            {m.noticesSent ? 'Sent' : 'Pending'}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => void toggleMeetingFlag(m, 'quorumMet')} className="flex items-center gap-1 text-xs hover:text-teal-700 transition-colors" style={{ minHeight: 28 }}>
                            {m.quorumMet ? <CheckSquare className="w-4 h-4 text-green-600" /> : <Square className="w-4 h-4 text-gray-400 dark:text-slate-500" />}
                            {m.quorumMet ? 'Met' : 'No'}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => void toggleMeetingFlag(m, 'minutesDone')} className="flex items-center gap-1 text-xs hover:text-teal-700 transition-colors" style={{ minHeight: 28 }}>
                            {m.minutesDone ? <CheckSquare className="w-4 h-4 text-green-600" /> : <Square className="w-4 h-4 text-gray-400 dark:text-slate-500" />}
                            {m.minutesDone ? 'Done' : 'Pending'}
                          </button>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <button onClick={() => void openResolutions(m)} className="p-1.5 text-gray-400 hover:text-teal-600 rounded hover:bg-teal-50 transition-colors dark:text-slate-500" title="Resolutions" style={{ minHeight: 32, minWidth: 32 }}>
                              <FileStack className="w-4 h-4" />
                            </button>
                            <button onClick={() => printBoardMeetingMinutes(m)} className="p-1.5 text-gray-400 hover:text-teal-600 rounded hover:bg-teal-50 transition-colors dark:text-slate-500" title="Print minutes" style={{ minHeight: 32, minWidth: 32 }}>
                              <Printer className="w-4 h-4" />
                            </button>
                            <button onClick={() => openEditMeeting(m)} className="p-1.5 text-gray-400 hover:text-teal-600 rounded hover:bg-teal-50 transition-colors dark:text-slate-500" style={{ minHeight: 32, minWidth: 32 }}>
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => void handleDeleteMeeting(m.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors dark:text-slate-500" style={{ minHeight: 32, minWidth: 32 }}>
                              <Trash2 className="w-4 h-4" />
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
        </>
      )}

      {/* ── ROC Filing Form Modal ─────────────────────────────────────────────── */}
      {showFilingForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">{editFiling ? 'Edit ROC Filing' : 'Add ROC Filing'}</h2>
              <button onClick={() => setShowFilingForm(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-200"><X className="w-4 h-4" /></button>
            </div>

            <div className="space-y-3">
              {!editFiling && (
                <Select label="Client" required value={fFormClientId} onChange={(e) => setFFormClientId(e.target.value)}>
                  <option value="">Select client...</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.customerName}</option>)}
                </Select>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Select label="Form Type" required value={fFormType} onChange={(e) => setFFormType(e.target.value)}>
                  {FORM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </Select>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Financial Year</label>
                  <input type="text" value={fFormFY} onChange={(e) => setFFormFY(e.target.value)} placeholder="e.g. 2025-26" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" style={{ minHeight: 48 }} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Purpose / Description</label>
                <input type="text" value={fFormPurpose} onChange={(e) => setFFormPurpose(e.target.value)} placeholder="e.g. Annual Return for FY 2025-26" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" style={{ minHeight: 48 }} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Due Date</label>
                  <input type="date" value={fFormDueDate} onChange={(e) => setFFormDueDate(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" style={{ minHeight: 48 }} />
                </div>
                <Select label="Assigned CS" value={fFormStaffId} onChange={(e) => setFFormStaffId(e.target.value)}>
                  <option value="">— Unassigned —</option>
                  {staff.map((s) => <option key={s.id} value={s.id}>{s.fullName}</option>)}
                </Select>
              </div>

              {editFiling && (
                <>
                  <Select
                    label="Status"
                    value={fFormStatus}
                    onChange={(e) => {
                      const s = e.target.value
                      setFFormStatus(s)
                      if (!['FILED', 'ACKNOWLEDGED', 'DEFECTIVE'].includes(s)) {
                        setFFormFiledOn(''); setFFormSRN('')
                      }
                    }}
                  >
                    {ROC_STATUSES.map((s) => <option key={s} value={s}>{ROC_STATUS_LABELS[s] ?? s}</option>)}
                  </Select>
                  {['FILED', 'ACKNOWLEDGED', 'DEFECTIVE'].includes(fFormStatus) && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Filed On</label>
                      <input type="date" value={fFormFiledOn} onChange={(e) => setFFormFiledOn(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" style={{ minHeight: 48 }} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">SRN (MCA)</label>
                      <input type="text" value={fFormSRN} onChange={(e) => setFFormSRN(e.target.value)} placeholder="Service Request Number" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" style={{ minHeight: 48 }} />
                    </div>
                  </div>
                  )}
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Govt. Fee (₹)</label>
                <input type="number" value={fFormGovtFee} onChange={(e) => setFFormGovtFee(e.target.value)} placeholder="e.g. 300" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" style={{ minHeight: 48 }} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Notes</label>
                <textarea value={fFormNotes} onChange={(e) => setFFormNotes(e.target.value)} rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-5">
              <button onClick={() => setShowFilingForm(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800" style={{ minHeight: 44 }}>Cancel</button>
              <button onClick={() => void handleSaveFiling()} disabled={fFormSaving || !fFormClientId || !fFormType} className="px-4 py-2 text-sm bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors" style={{ minHeight: 44 }}>
                {fFormSaving ? 'Saving...' : editFiling ? 'Save Changes' : 'Add Filing'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Board Meeting Form Modal ──────────────────────────────────────────── */}
      {showMeetingForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">{editMeeting ? 'Edit Board Meeting' : 'Add Board Meeting'}</h2>
              <button onClick={() => setShowMeetingForm(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-200"><X className="w-4 h-4" /></button>
            </div>

            <div className="space-y-3">
              {!editMeeting && (
                <Select label="Client" required value={mFormClientId} onChange={(e) => setMFormClientId(e.target.value)}>
                  <option value="">Select client...</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.customerName}</option>)}
                </Select>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Select label="Meeting Type" value={mFormType} onChange={(e) => setMFormType(e.target.value)}>
                  {MEETING_TYPES.map((t) => <option key={t} value={t}>{MEETING_TYPE_LABELS[t]}</option>)}
                </Select>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Meeting Date *</label>
                  <input type="date" value={mFormDate} onChange={(e) => setMFormDate(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" style={{ minHeight: 48 }} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Time</label>
                  <input type="time" value={mFormTime} onChange={(e) => setMFormTime(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" style={{ minHeight: 48 }} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Venue</label>
                  <input type="text" value={mFormVenue} onChange={(e) => setMFormVenue(e.target.value)} placeholder="e.g. Registered Office" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" style={{ minHeight: 48 }} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Agenda</label>
                <textarea value={mFormAgenda} onChange={(e) => setMFormAgenda(e.target.value)} rows={3} placeholder="1. Approval of accounts&#10;2. Declaration of dividend&#10;3. ..." className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
              </div>

              {editMeeting && (
                <div className="space-y-2">
                  {[
                    { key: 'mFormNotices', label: 'Notices Sent', value: mFormNotices, set: setMFormNotices },
                    { key: 'mFormQuorum', label: 'Quorum Met', value: mFormQuorum, set: setMFormQuorum },
                    { key: 'mFormMinutes', label: 'Minutes Prepared', value: mFormMinutes, set: setMFormMinutes },
                  ].map(({ key, label, value, set }) => (
                    <label key={key} className="flex items-center gap-3 cursor-pointer">
                      <button type="button" onClick={() => set(!value)} className={cn('w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0', value ? 'bg-teal-600 border-teal-600' : 'bg-white dark:bg-slate-900 border-gray-300')}>
                        {value && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                      </button>
                      <span className="text-sm text-gray-700 dark:text-slate-300">{label}</span>
                    </label>
                  ))}
                </div>
              )}

              {editMeeting && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Minutes</label>
                  <textarea value={mFormMinutesText} onChange={(e) => setMFormMinutesText(e.target.value)} rows={4} placeholder="The actual minutes text — resolved that... noted that..." className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Notes</label>
                <textarea value={mFormNotes} onChange={(e) => setMFormNotes(e.target.value)} rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-5">
              <button onClick={() => setShowMeetingForm(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800" style={{ minHeight: 44 }}>Cancel</button>
              <button onClick={() => void handleSaveMeeting()} disabled={mFormSaving || !mFormClientId || !mFormDate} className="px-4 py-2 text-sm bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors" style={{ minHeight: 44 }}>
                {mFormSaving ? 'Saving...' : editMeeting ? 'Save Changes' : 'Add Meeting'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Resolution Register Modal (F.12) ──────────────────────────────────── */}
      {resolutionMeeting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-2xl mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">Resolutions — {resolutionMeeting.client.customerName}</h2>
              <button onClick={() => setResolutionMeeting(null)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-200"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-xs text-gray-400 dark:text-slate-500 mb-4">{MEETING_TYPE_LABELS[resolutionMeeting.meetingType] ?? resolutionMeeting.meetingType} — {fmtDate(resolutionMeeting.meetingDate)}</p>

            {resolutionsLoading ? (
              <p className="text-sm text-gray-400 py-4">Loading…</p>
            ) : resolutions.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-slate-500 py-2">No resolutions recorded yet.</p>
            ) : (
              <div className="space-y-2 mb-4">
                {resolutions.map((r) => (
                  <div key={r.id} className="flex items-start justify-between gap-3 bg-gray-50 dark:bg-slate-800 rounded-lg px-3 py-2.5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-teal-700 dark:text-teal-400">#{r.resolutionNumber}</span>
                        <Badge variant={r.resolutionType === 'SPECIAL' ? 'warning' : 'neutral'} size="sm">{r.resolutionType === 'SPECIAL' ? 'Special' : 'Ordinary'}</Badge>
                        {!r.passedUnanimously && <span className="text-xs text-amber-600 dark:text-amber-400">Not unanimous</span>}
                      </div>
                      <p className="text-sm text-gray-700 dark:text-slate-300 whitespace-pre-wrap">{r.resolutionText}</p>
                    </div>
                    <button onClick={() => void handleDeleteResolution(r.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors dark:text-slate-500 shrink-0" style={{ minHeight: 32, minWidth: 32 }}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="border-t border-gray-100 dark:border-slate-800 pt-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">Add Resolution</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Resolution No.</label>
                  <input type="text" value={resNumber} onChange={(e) => setResNumber(e.target.value)} placeholder="e.g. 1 or 2026-03" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" style={{ minHeight: 48 }} />
                </div>
                <Select label="Type" value={resType} onChange={(e) => setResType(e.target.value)}>
                  <option value="ORDINARY">Ordinary</option>
                  <option value="SPECIAL">Special</option>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Resolution Text</label>
                <textarea value={resText} onChange={(e) => setResText(e.target.value)} rows={3} placeholder="RESOLVED THAT..." className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <button type="button" onClick={() => setResUnanimous(!resUnanimous)} className={cn('w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0', resUnanimous ? 'bg-teal-600 border-teal-600' : 'bg-white dark:bg-slate-900 border-gray-300')}>
                  {resUnanimous && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                </button>
                <span className="text-sm text-gray-700 dark:text-slate-300">Passed unanimously</span>
              </label>
              <div className="flex justify-end">
                <button onClick={() => void handleAddResolution()} disabled={resSaving || !resNumber.trim() || !resText.trim()} className="px-4 py-2 text-sm bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors" style={{ minHeight: 44 }}>
                  {resSaving ? 'Adding…' : 'Add Resolution'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
