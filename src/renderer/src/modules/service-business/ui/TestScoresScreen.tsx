import { useEffect, useState, useCallback } from 'react'
import { api } from '@renderer/services/ipc-client'
import { Plus, Edit2, Trash2, GraduationCap } from 'lucide-react'
import { KpiCard } from '@shared/ui/molecules/KpiCard'
import { Badge } from '@shared/ui/atoms/Badge'
import { Select } from '@shared/ui/atoms/Select'
import { Card } from '@shared/ui/molecules/Card'
import { useNotificationStore } from '@app/store/notification.store'
import { ConfirmDialog } from '@shared/ui/molecules/ConfirmDialog'

interface CoachingBatch { id: string; batchName: string; subjectOrCourse: string }
interface EnrolledStudent { id: string; studentId: string; status: string; student: { id: string; customerName: string } }

interface TestScore {
  id: string
  enrollmentId: string
  testName: string
  subject: string | null
  marksObtained: number
  maxMarks: number
  testDate: string
  grade: string | null
  notes: string | null
  enrollment: {
    id: string
    batchId: string
    student: { id: string; customerName: string }
    batch: { id: string; batchName: string; subjectOrCourse: string }
  }
}

const EMPTY_FORM = {
  batchId: '', enrollmentId: '', testName: '', subject: '',
  marksObtained: '', maxMarks: '', testDate: new Date().toISOString().split('T')[0],
  grade: '', notes: '',
}

// A rough, common Indian grading scale — purely a convenience prefill, never
// forced: grade stays a free-text field so an institute using a different
// scale (or no letter grades at all) can just leave/overwrite it.
function suggestGrade(pct: number): string {
  if (pct >= 90) return 'A+'
  if (pct >= 80) return 'A'
  if (pct >= 70) return 'B+'
  if (pct >= 60) return 'B'
  if (pct >= 50) return 'C'
  if (pct >= 33) return 'D'
  return 'F'
}

export default function TestScoresScreen() {
  const { error: toastError } = useNotificationStore()
  const [scores, setScores] = useState<TestScore[]>([])
  const [batches, setBatches] = useState<CoachingBatch[]>([])
  const [filterBatchId, setFilterBatchId] = useState('')
  const [loading, setLoading] = useState(true)

  const [showForm, setShowForm] = useState(false)
  const [editScore, setEditScore] = useState<TestScore | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [batchStudents, setBatchStudents] = useState<EnrolledStudent[]>([])
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<TestScore | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [scoreRes, batchRes] = await Promise.all([
        api.studentTestScore.list(filterBatchId ? { batchId: filterBatchId } : {}),
        api.coachingBatch.list({}),
      ])
      if (scoreRes.success && scoreRes.data) setScores(scoreRes.data as TestScore[])
      else toastError('Error', scoreRes.error?.message ?? 'Could not load test scores.')
      if (batchRes.success && batchRes.data) setBatches(batchRes.data as CoachingBatch[])
    } catch {
      toastError('Error', 'Could not load test scores.')
    } finally {
      setLoading(false)
    }
  }, [filterBatchId, toastError])

  useEffect(() => { loadAll() }, [loadAll])

  async function loadBatchStudents(batchId: string) {
    if (!batchId) { setBatchStudents([]); return }
    try {
      const res = await api.enrollment.listByBatch({ batchId })
      if (res.success && res.data) {
        setBatchStudents((res.data as EnrolledStudent[]).filter((e) => e.status === 'ACTIVE'))
      } else {
        toastError('Error', res.error?.message ?? 'Could not load enrolled students.')
      }
    } catch {
      toastError('Error', 'Could not load enrolled students.')
    }
  }

  function openNew() {
    setEditScore(null)
    setForm({ ...EMPTY_FORM })
    setBatchStudents([])
    setFormError('')
    setShowForm(true)
  }

  function openEdit(s: TestScore) {
    setEditScore(s)
    setForm({
      batchId: s.enrollment.batchId,
      enrollmentId: s.enrollmentId,
      testName: s.testName,
      subject: s.subject ?? '',
      marksObtained: String(s.marksObtained),
      maxMarks: String(s.maxMarks),
      testDate: s.testDate.split('T')[0],
      grade: s.grade ?? '',
      notes: s.notes ?? '',
    })
    loadBatchStudents(s.enrollment.batchId)
    setFormError('')
    setShowForm(true)
  }

  function applySuggestedGrade(marksStr: string, maxStr: string) {
    const marks = Number(marksStr)
    const max = Number(maxStr)
    if (!Number.isFinite(marks) || !Number.isFinite(max) || max <= 0) return
    setForm((f) => (f.grade ? f : { ...f, grade: suggestGrade((marks / max) * 100) }))
  }

  async function handleSave() {
    const marks = Number(form.marksObtained)
    const max = Number(form.maxMarks)
    if (!form.enrollmentId || !form.testName.trim() || !form.testDate || !form.maxMarks) {
      setFormError('Student, test name, date and max marks are required.')
      return
    }
    if (!Number.isFinite(marks) || !Number.isFinite(max) || max <= 0 || marks < 0 || marks > max) {
      setFormError(`Marks obtained must be a number between 0 and ${form.maxMarks || 'max marks'}.`)
      return
    }
    setSaving(true)
    setFormError('')
    try {
      let res
      if (editScore) {
        res = await api.studentTestScore.update({
          id: editScore.id,
          testName: form.testName.trim(),
          subject: form.subject || null,
          marksObtained: marks,
          maxMarks: max,
          testDate: form.testDate,
          grade: form.grade || null,
          notes: form.notes || null,
        })
      } else {
        res = await api.studentTestScore.create({
          enrollmentId: form.enrollmentId,
          testName: form.testName.trim(),
          subject: form.subject || undefined,
          marksObtained: marks,
          maxMarks: max,
          testDate: form.testDate,
          grade: form.grade || undefined,
          notes: form.notes || undefined,
        })
      }
      if (res.success) { setShowForm(false); loadAll() }
      else setFormError(res.error?.message ?? 'Failed to save test score.')
    } catch {
      setFormError('Failed to save test score.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(s: TestScore) {
    setDeleting(true)
    try {
      const res = await api.studentTestScore.delete({ id: s.id })
      if (res.success) { setDeleteTarget(null); loadAll() }
      else toastError('Error', res.error?.message ?? 'Could not delete test score.')
    } catch {
      toastError('Error', 'Could not delete test score.')
    } finally {
      setDeleting(false)
    }
  }

  const avgPct = scores.length
    ? Math.round((scores.reduce((sum, s) => sum + (s.marksObtained / s.maxMarks) * 100, 0) / scores.length) * 10) / 10
    : 0
  const belowFifty = scores.filter((s) => (s.marksObtained / s.maxMarks) * 100 < 50).length

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2 dark:text-slate-100">
          <GraduationCap size={22} className="text-indigo-600" /> Test Scores
        </h1>
        <button onClick={openNew} className="flex items-center gap-2 bg-brand text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors">
          <Plus size={16} /> Add Test Score
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <KpiCard label="Tests Recorded" value={scores.length} color="neutral" />
        <KpiCard label="Average Score" value={`${avgPct}%`} color="success" />
        <KpiCard label="Below 50%" value={belowFifty} color={belowFifty > 0 ? 'danger' : 'neutral'} />
      </div>

      {/* Filter */}
      <div className="mb-4 max-w-xs">
        <Select value={filterBatchId} onChange={(e) => setFilterBatchId(e.target.value)}>
          <option value="">All Batches</option>
          {batches.map((b) => <option key={b.id} value={b.id}>{b.batchName}</option>)}
        </Select>
      </div>

      {/* Table */}
      <Card padding="none" className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200 dark:bg-slate-950 dark:border-slate-700">
            <tr>
              <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-slate-400">Student</th>
              <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-slate-400">Test</th>
              <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-slate-400">Batch</th>
              <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-slate-400">Date</th>
              <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-slate-400">Score</th>
              <th className="py-3 px-4" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
            {loading ? (
              <tr><td colSpan={6} className="py-12 text-center text-gray-400 dark:text-slate-500">Loading...</td></tr>
            ) : scores.length === 0 ? (
              <tr><td colSpan={6} className="py-12 text-center text-gray-400 dark:text-slate-500">No test scores recorded yet</td></tr>
            ) : scores.map((s) => {
              const pct = Math.round((s.marksObtained / s.maxMarks) * 1000) / 10
              return (
                <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-slate-800">
                  <td className="py-3 px-4 font-medium text-gray-900 dark:text-slate-100">{s.enrollment.student.customerName}</td>
                  <td className="py-3 px-4">
                    <p className="text-gray-700 dark:text-slate-300">{s.testName}</p>
                    {s.subject && <p className="text-xs text-gray-400 dark:text-slate-500">{s.subject}</p>}
                  </td>
                  <td className="py-3 px-4 text-gray-500 dark:text-slate-400">{s.enrollment.batch.batchName}</td>
                  <td className="py-3 px-4 text-gray-700 dark:text-slate-300">{new Date(s.testDate).toLocaleDateString()}</td>
                  <td className="py-3 px-4">
                    <span className="font-medium text-gray-900 dark:text-slate-100">{s.marksObtained}/{s.maxMarks}</span>
                    <Badge variant={pct >= 50 ? 'success' : 'danger'} size="sm" className="ml-2">
                      {pct}% {s.grade ? `· ${s.grade}` : ''}
                    </Badge>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => openEdit(s)} className="p-1.5 text-gray-400 hover:text-indigo-600 rounded dark:text-slate-500"><Edit2 size={14} /></button>
                      <button onClick={() => setDeleteTarget(s)} className="p-1.5 text-gray-400 hover:text-red-600 rounded dark:text-slate-500"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Card>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 dark:text-slate-100">{editScore ? 'Edit Test Score' : 'Add Test Score'}</h2>
            <div className="space-y-3">
              <div>
                <Select
                  label="Batch"
                  required
                  value={form.batchId}
                  onChange={(e) => { setForm((f) => ({ ...f, batchId: e.target.value, enrollmentId: '' })); loadBatchStudents(e.target.value) }}
                  disabled={!!editScore}
                >
                  <option value="">Select batch...</option>
                  {batches.map((b) => <option key={b.id} value={b.id}>{b.batchName} — {b.subjectOrCourse}</option>)}
                </Select>
              </div>
              {batchStudents.length > 0 && (
                <Select
                  label="Student"
                  required
                  value={form.enrollmentId}
                  onChange={(e) => setForm((f) => ({ ...f, enrollmentId: e.target.value }))}
                  disabled={!!editScore}
                >
                  <option value="">Select student...</option>
                  {batchStudents.map((e) => <option key={e.id} value={e.id}>{e.student.customerName}</option>)}
                </Select>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Test Name *</label>
                  <input value={form.testName} onChange={(e) => setForm((f) => ({ ...f, testName: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100"
                    placeholder="e.g. Unit Test 1" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Subject</label>
                  <input value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100"
                    placeholder="e.g. Mathematics" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Marks Obtained *</label>
                  <input type="number" min="0" value={form.marksObtained}
                    onChange={(e) => { setForm((f) => ({ ...f, marksObtained: e.target.value })); applySuggestedGrade(e.target.value, form.maxMarks) }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Max Marks *</label>
                  <input type="number" min="1" value={form.maxMarks}
                    onChange={(e) => { setForm((f) => ({ ...f, maxMarks: e.target.value })); applySuggestedGrade(form.marksObtained, e.target.value) }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Grade</label>
                  <input value={form.grade} onChange={(e) => setForm((f) => ({ ...f, grade: e.target.value }))}
                    placeholder="A+"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Test Date *</label>
                <input type="date" value={form.testDate} onChange={(e) => setForm((f) => ({ ...f, testDate: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100"
                  placeholder="Optional notes" />
              </div>
            </div>
            {formError && <p className="text-red-600 text-sm mt-3">{formError}</p>}
            <div className="flex gap-3 mt-5 justify-end">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-800">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm bg-brand text-white rounded-lg hover:bg-blue-600 disabled:opacity-50">
                {saving ? 'Saving...' : editScore ? 'Update' : 'Add Test Score'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && handleDelete(deleteTarget)}
        loading={deleting}
        title="Delete Test Score"
        message={deleteTarget ? `Delete "${deleteTarget.testName}" for ${deleteTarget.enrollment.student.customerName}?` : ''}
        confirmLabel="Delete"
      />
    </div>
  )
}
