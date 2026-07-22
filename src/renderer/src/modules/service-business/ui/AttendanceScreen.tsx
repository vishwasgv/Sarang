import { useEffect, useState, useCallback } from 'react'
import { api } from '@renderer/services/ipc-client'
import { ClipboardCheck, Save, Printer } from 'lucide-react'
import { aszurexFooterHtml } from '@shared/utils/print-branding'
import { Card } from '@shared/ui/molecules/Card'
import { Badge } from '@shared/ui/atoms/Badge'
import { Select } from '@shared/ui/atoms/Select'
import { useNotificationStore } from '@app/store/notification.store'

interface CoachingBatch {
  id: string
  batchName: string
  subjectOrCourse: string
  status: string
}

interface EnrolledStudent {
  id: string
  studentId: string
  status: string
  student: { id: string; customerName: string; phone: string | null }
}

interface AttendanceRecord {
  id: string
  batchId: string
  attendanceDate: string
  presentStudentIds: string
  absentStudentIds: string
}

function printAttendanceSheet(
  batches: CoachingBatch[],
  selectedBatchId: string,
  selectedDate: string,
  enrollments: EnrolledStudent[],
  attendance: Record<string, boolean>
) {
  const batch = batches.find(b => b.id === selectedBatchId)
  const batchLabel = batch ? `${batch.batchName} — ${batch.subjectOrCourse}` : 'Unknown Batch'
  const dateLabel = new Date(selectedDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const printedOn = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  const presentCount = enrollments.filter(e => (attendance[e.studentId] ?? true)).length

  const rows = enrollments.map((e, i) => {
    const present = attendance[e.studentId] ?? true
    return `<tr><td>${i + 1}</td><td>${e.student.customerName}</td><td>${e.student.phone ?? '—'}</td><td style="color:${present ? '#16a34a' : '#dc2626'};font-weight:600">${present ? 'Present' : 'Absent'}</td></tr>`
  }).join('')

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Attendance — ${batchLabel}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 11px; color: #1a1a1a; padding: 32px; }
  h1 { font-size: 18px; margin: 0 0 4px; } h2 { font-size: 13px; margin: 0 0 4px; color: #555; }
  .meta { margin-bottom: 20px; color: #555; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th { background: #f1f5f9; text-align: left; padding: 7px 10px; font-size: 11px; border: 1px solid #e2e8f0; }
  td { padding: 6px 10px; border: 1px solid #e2e8f0; }
  .footer { font-size: 10px; color: #555; text-align: center; margin-top: 12px; border-top: 1px solid #e2e8f0; padding-top: 8px; }
  .summary { margin-bottom: 12px; font-size: 12px; }
</style></head><body>
<h1>Attendance Sheet</h1>
<h2>${batchLabel}</h2>
<div class="meta"><p>Date: ${dateLabel} &nbsp;|&nbsp; Printed: ${printedOn}</p></div>
<div class="summary">Total: ${enrollments.length} &nbsp;|&nbsp; Present: ${presentCount} &nbsp;|&nbsp; Absent: ${enrollments.length - presentCount}</div>
<table>
  <thead><tr><th>#</th><th>Student Name</th><th>Phone</th><th>Status</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="footer">${aszurexFooterHtml(10)}</div>
</body></html>`

  const win = window.open('', '_blank', 'width=720,height=900')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.focus()
  win.print()
}

// Real bug found live 2026-07-22: toISOString() extracts the UTC calendar
// date, lagging the real local date for ~5.5 hours after local midnight in
// any timezone ahead of UTC (IST is +5:30) -- this screen would default to
// YESTERDAY's date for marking attendance during that window every day.
function todayLocalISODate(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export default function AttendanceScreen() {
  const { error: toastError } = useNotificationStore()
  const [batches, setBatches] = useState<CoachingBatch[]>([])
  const [selectedBatchId, setSelectedBatchId] = useState('')
  const [selectedDate, setSelectedDate] = useState(todayLocalISODate())
  const [enrollments, setEnrollments] = useState<EnrolledStudent[]>([])
  const [attendance, setAttendance] = useState<Record<string, boolean>>({}) // studentId → present
  const [existingRecord, setExistingRecord] = useState<AttendanceRecord | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.coachingBatch.list({}).then((res) => {
      if (res.success && res.data) {
        const all = (res.data as CoachingBatch[]).filter((b) => b.status === 'ACTIVE')
        setBatches(all)
        if (all.length > 0) setSelectedBatchId(all[0].id)
      } else {
        toastError('Error', res.error?.message ?? 'Could not load batches.')
      }
    }).catch(() => toastError('Error', 'Could not load batches.'))
  }, [toastError])

  const loadEnrollmentsAndAttendance = useCallback(async () => {
    if (!selectedBatchId || !selectedDate) return
    setLoading(true)
    setSaveMsg('')
    try {
    const [enrRes, attRes] = await Promise.all([
      api.enrollment.listByBatch({ batchId: selectedBatchId }),
      api.coachingAttendance.get({ batchId: selectedBatchId, date: selectedDate }),
    ])

    if (!enrRes.success) toastError('Error', enrRes.error?.message ?? 'Could not load enrollments.')
    const activeEnrollments: EnrolledStudent[] = enrRes.success && enrRes.data
      ? (enrRes.data as EnrolledStudent[]).filter((e) => e.status === 'ACTIVE')
      : []
    setEnrollments(activeEnrollments)

    const existing = attRes.success ? (attRes.data as AttendanceRecord | null) : null
    setExistingRecord(existing)

    if (existing) {
      const presentIds: string[] = JSON.parse(existing.presentStudentIds)
      const map: Record<string, boolean> = {}
      activeEnrollments.forEach((e) => { map[e.studentId] = presentIds.includes(e.studentId) })
      setAttendance(map)
    } else {
      // Default all to present
      const map: Record<string, boolean> = {}
      activeEnrollments.forEach((e) => { map[e.studentId] = true })
      setAttendance(map)
    }
    } catch {
      toastError('Error', 'Could not load enrollments.')
    } finally {
      setLoading(false)
    }
  }, [selectedBatchId, selectedDate, toastError])

  useEffect(() => { loadEnrollmentsAndAttendance() }, [loadEnrollmentsAndAttendance])

  function toggleStudent(studentId: string) {
    setAttendance((prev) => ({ ...prev, [studentId]: !prev[studentId] }))
  }

  function markAll(present: boolean) {
    const map: Record<string, boolean> = {}
    enrollments.forEach((e) => { map[e.studentId] = present })
    setAttendance(map)
  }

  async function handleSave() {
    if (!selectedBatchId || !selectedDate) return
    setSaving(true)
    setSaveMsg('')
    const presentStudentIds = enrollments.filter((e) => (attendance[e.studentId] ?? true)).map((e) => e.studentId)
    const absentStudentIds = enrollments.filter((e) => !(attendance[e.studentId] ?? true)).map((e) => e.studentId)
    const res = await api.coachingAttendance.save({
      batchId: selectedBatchId,
      attendanceDate: selectedDate,
      presentStudentIds,
      absentStudentIds,
    })
    if (res.success) {
      setSaveMsg(`Attendance saved — ${presentStudentIds.length} present, ${absentStudentIds.length} absent.`)
      loadEnrollmentsAndAttendance()
    } else {
      setSaveMsg(res.error?.message ?? 'Failed to save attendance.')
    }
    setSaving(false)
  }

  const presentCount = Object.values(attendance).filter(Boolean).length
  const absentCount = enrollments.length - presentCount

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <ClipboardCheck size={24} className="text-brand" />
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Attendance</h1>
      </div>

      {/* Controls */}
      <Card padding="md" className="mb-6 flex gap-4 flex-wrap">
        <div className="flex-1 min-w-48">
          <Select label="Batch" value={selectedBatchId} onChange={(e) => setSelectedBatchId(e.target.value)}>
            <option value="">Select batch...</option>
            {batches.map((b) => <option key={b.id} value={b.id}>{b.batchName} — {b.subjectOrCourse}</option>)}
          </Select>
        </div>
        <div className="min-w-48">
          <label className="block text-xs font-medium text-slate-500 mb-1 dark:text-slate-400">Date</label>
          <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" />
        </div>
      </Card>

      {!selectedBatchId ? (
        <Card padding="none" className="p-12 text-center text-slate-400 dark:text-slate-500">Select a batch to take attendance</Card>
      ) : loading ? (
        <Card padding="none" className="p-12 text-center text-slate-400 dark:text-slate-500">Loading...</Card>
      ) : enrollments.length === 0 ? (
        <Card padding="none" className="p-12 text-center text-slate-400 dark:text-slate-500">No active students enrolled in this batch</Card>
      ) : (
        <Card padding="none" className="overflow-hidden">
          {/* Summary bar */}
          <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200 dark:bg-slate-950 dark:border-slate-700">
            <div className="flex items-center gap-4 text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-300">{enrollments.length} students</span>
              <span className="text-success font-medium">{presentCount} present</span>
              <span className="text-danger font-medium">{absentCount} absent</span>
              {existingRecord && <Badge variant="warning" size="sm">Updating existing record</Badge>}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => markAll(true)} className="text-xs text-success hover:underline">Mark All Present</button>
              <span className="text-slate-300">|</span>
              <button onClick={() => markAll(false)} className="text-xs text-danger hover:underline">Mark All Absent</button>
              <span className="text-slate-300">|</span>
              <button onClick={() => printAttendanceSheet(batches, selectedBatchId, selectedDate, enrollments, attendance)} className="flex items-center gap-1 text-xs text-slate-600 hover:text-brand transition-colors dark:text-slate-400">
                <Printer size={13} /> Print
              </button>
            </div>
          </div>

          {/* Student rows */}
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {enrollments.map((e, idx) => {
              const isPresent = attendance[e.studentId] ?? true
              return (
                <div key={e.id} className={`flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${isPresent ? '' : 'bg-danger/5 dark:bg-danger/10'}`}
                  onClick={() => toggleStudent(e.studentId)}>
                  <span className="w-7 text-center text-sm text-slate-400 font-mono dark:text-slate-500">{idx + 1}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{e.student.customerName}</p>
                    {e.student.phone && <p className="text-xs text-slate-400 dark:text-slate-500">{e.student.phone}</p>}
                  </div>
                  <div className="w-28 flex justify-center">
                    <Badge variant={isPresent ? 'success' : 'danger'}>{isPresent ? 'Present' : 'Absent'}</Badge>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Save bar */}
          <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-t border-slate-200 dark:bg-slate-950 dark:border-slate-700">
            {saveMsg ? (
              <p className={`text-sm ${saveMsg.startsWith('Attendance saved') ? 'text-success' : 'text-danger'}`}>{saveMsg}</p>
            ) : <span />}
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 bg-brand text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand/90 disabled:opacity-50 transition-colors">
              <Save size={14} /> {saving ? 'Saving...' : existingRecord ? 'Update Attendance' : 'Save Attendance'}
            </button>
          </div>
        </Card>
      )}
    </div>
  )
}
