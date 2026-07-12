import { useEffect, useState, useCallback } from 'react'
import { api } from '@renderer/services/ipc-client'
import { Plus, Edit2, Trash2, Music } from 'lucide-react'
import { KpiCard } from '@shared/ui/molecules/KpiCard'
import { Badge } from '@shared/ui/atoms/Badge'
import { Select } from '@shared/ui/atoms/Select'
import { Card } from '@shared/ui/molecules/Card'
import { useNotificationStore } from '@app/store/notification.store'

interface BatchInfo { id: string; batchName: string; subjectOrCourse: string }

interface Performance {
  id: string
  batchId: string
  performanceName: string
  date: string
  venue: string | null
  participatingStudentIds: string
  notes: string | null
  batch: BatchInfo
}

interface CoachingBatch { id: string; batchName: string; subjectOrCourse: string }
interface EnrolledStudent { studentId: string; student: { id: string; customerName: string } }

const EMPTY_FORM = {
  batchId: '', performanceName: '', date: new Date().toISOString().split('T')[0],
  venue: '', participatingStudentIds: [] as string[], notes: '',
}

export default function PerformanceScreen() {
  const { error: toastError } = useNotificationStore()
  const [performances, setPerformances] = useState<Performance[]>([])
  const [batches, setBatches] = useState<CoachingBatch[]>([])
  const [filterBatchId, setFilterBatchId] = useState('')
  const [loading, setLoading] = useState(true)

  const [showForm, setShowForm] = useState(false)
  const [editPerf, setEditPerf] = useState<Performance | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [batchStudents, setBatchStudents] = useState<EnrolledStudent[]>([])
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [perfRes, batchRes] = await Promise.all([
        api.performance.list(filterBatchId ? { batchId: filterBatchId } : {}),
        api.coachingBatch.list({}),
      ])
      if (perfRes.success && perfRes.data) setPerformances(perfRes.data as Performance[])
      else toastError('Error', perfRes.error?.message ?? 'Could not load performances.')
      if (batchRes.success && batchRes.data) setBatches(batchRes.data as CoachingBatch[])
    } catch {
      toastError('Error', 'Could not load performances.')
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
        setBatchStudents((res.data as Array<{ status: string } & EnrolledStudent>).filter((e) => e.status === 'ACTIVE'))
      } else {
        toastError('Error', res.error?.message ?? 'Could not load enrolled students.')
      }
    } catch {
      toastError('Error', 'Could not load enrolled students.')
    }
  }

  function openNew() {
    setEditPerf(null)
    setForm({ ...EMPTY_FORM })
    setBatchStudents([])
    setFormError('')
    setShowForm(true)
  }

  function openEdit(p: Performance) {
    setEditPerf(p)
    const ids: string[] = JSON.parse(p.participatingStudentIds)
    setForm({
      batchId: p.batchId,
      performanceName: p.performanceName,
      date: p.date.split('T')[0],
      venue: p.venue ?? '',
      participatingStudentIds: ids,
      notes: p.notes ?? '',
    })
    loadBatchStudents(p.batchId)
    setFormError('')
    setShowForm(true)
  }

  function toggleParticipant(studentId: string) {
    setForm((f) => ({
      ...f,
      participatingStudentIds: f.participatingStudentIds.includes(studentId)
        ? f.participatingStudentIds.filter((id) => id !== studentId)
        : [...f.participatingStudentIds, studentId],
    }))
  }

  async function handleSave() {
    if (!form.batchId || !form.performanceName.trim() || !form.date) {
      setFormError('Batch, performance name and date are required.')
      return
    }
    setSaving(true)
    setFormError('')
    try {
      let res
      if (editPerf) {
        res = await api.performance.update({
          id: editPerf.id,
          performanceName: form.performanceName.trim(),
          date: form.date,
          venue: form.venue || null,
          participatingStudentIds: form.participatingStudentIds,
          notes: form.notes || null,
        })
      } else {
        res = await api.performance.create({
          batchId: form.batchId,
          performanceName: form.performanceName.trim(),
          date: form.date,
          venue: form.venue || undefined,
          participatingStudentIds: form.participatingStudentIds,
          notes: form.notes || undefined,
        })
      }
      if (res.success) { setShowForm(false); loadAll() }
      else setFormError(res.error?.message ?? 'Failed to save performance.')
    } catch {
      setFormError('Failed to save performance.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(p: Performance) {
    if (!confirm(`Delete performance "${p.performanceName}"?`)) return
    try {
      const res = await api.performance.delete({ id: p.id })
      if (res.success) loadAll()
      else toastError('Error', res.error?.message ?? 'Could not delete performance.')
    } catch {
      toastError('Error', 'Could not delete performance.')
    }
  }

  const now = new Date()
  const upcoming = performances.filter((p) => new Date(p.date) >= now).length
  const past = performances.length - upcoming

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2 dark:text-slate-100">
          <Music size={22} className="text-indigo-600" /> Performances & Recitals
        </h1>
        <button onClick={openNew} className="flex items-center gap-2 bg-brand text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors">
          <Plus size={16} /> Add Performance
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <KpiCard label="Total Performances" value={performances.length} color="neutral" />
        <KpiCard label="Upcoming" value={upcoming} color="success" />
        <KpiCard label="Past" value={past} color="neutral" />
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
              <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-slate-400">Performance</th>
              <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-slate-400">Batch</th>
              <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-slate-400">Date</th>
              <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-slate-400">Venue</th>
              <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-slate-400">Participants</th>
              <th className="py-3 px-4" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
            {loading ? (
              <tr><td colSpan={6} className="py-12 text-center text-gray-400 dark:text-slate-500">Loading...</td></tr>
            ) : performances.length === 0 ? (
              <tr><td colSpan={6} className="py-12 text-center text-gray-400 dark:text-slate-500">No performances recorded</td></tr>
            ) : performances.map((p) => {
              const ids: string[] = JSON.parse(p.participatingStudentIds)
              const isPast = new Date(p.date) < now
              return (
                <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-slate-800">
                  <td className="py-3 px-4">
                    <p className="font-medium text-gray-900 dark:text-slate-100">{p.performanceName}</p>
                    {p.notes && <p className="text-xs text-gray-400 mt-0.5 truncate max-w-48 dark:text-slate-500">{p.notes}</p>}
                  </td>
                  <td className="py-3 px-4">
                    <p className="text-gray-700 dark:text-slate-300">{p.batch.batchName}</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500">{p.batch.subjectOrCourse}</p>
                  </td>
                  <td className="py-3 px-4">
                    <p className="text-gray-700 dark:text-slate-300">{new Date(p.date).toLocaleDateString()}</p>
                    <Badge variant={isPast ? 'neutral' : 'success'} size="sm">
                      {isPast ? 'Past' : 'Upcoming'}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-gray-500 dark:text-slate-400">{p.venue ?? '—'}</td>
                  <td className="py-3 px-4">
                    <span className="text-gray-700 font-medium dark:text-slate-300">{ids.length}</span>
                    <span className="text-gray-400 text-xs ml-1 dark:text-slate-500">students</span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => openEdit(p)} className="p-1.5 text-gray-400 hover:text-indigo-600 rounded dark:text-slate-500"><Edit2 size={14} /></button>
                      <button onClick={() => handleDelete(p)} className="p-1.5 text-gray-400 hover:text-red-600 rounded dark:text-slate-500"><Trash2 size={14} /></button>
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
            <h2 className="text-lg font-semibold text-gray-900 mb-4 dark:text-slate-100">{editPerf ? 'Edit Performance' : 'Add Performance'}</h2>
            <div className="space-y-3">
              <div>
                <Select
                  label="Batch"
                  required
                  value={form.batchId}
                  onChange={(e) => { setForm((f) => ({ ...f, batchId: e.target.value, participatingStudentIds: [] })); loadBatchStudents(e.target.value) }}
                  disabled={!!editPerf}
                >
                  <option value="">Select batch...</option>
                  {batches.map((b) => <option key={b.id} value={b.id}>{b.batchName} — {b.subjectOrCourse}</option>)}
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Performance Name *</label>
                <input value={form.performanceName} onChange={(e) => setForm((f) => ({ ...f, performanceName: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100"
                  placeholder="e.g. Annual Day Recital 2026" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Date *</label>
                  <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Venue</label>
                  <input value={form.venue} onChange={(e) => setForm((f) => ({ ...f, venue: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100"
                    placeholder="e.g. School Auditorium" />
                </div>
              </div>
              {batchStudents.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-slate-300">Participating Students</label>
                  <div className="border border-gray-200 rounded-lg max-h-40 overflow-y-auto divide-y divide-gray-100 dark:border-slate-700 dark:divide-slate-800">
                    {batchStudents.map((e) => (
                      <label key={e.studentId} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800">
                        <input type="checkbox"
                          checked={form.participatingStudentIds.includes(e.studentId)}
                          onChange={() => toggleParticipant(e.studentId)}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600" />
                        <span className="text-sm text-gray-700 dark:text-slate-300">{e.student.customerName}</span>
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-1 dark:text-slate-500">{form.participatingStudentIds.length} selected</p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100"
                  placeholder="Optional notes about this performance" />
              </div>
            </div>
            {formError && <p className="text-red-600 text-sm mt-3">{formError}</p>}
            <div className="flex gap-3 mt-5 justify-end">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-800">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm bg-brand text-white rounded-lg hover:bg-blue-600 disabled:opacity-50">
                {saving ? 'Saving...' : editPerf ? 'Update' : 'Add Performance'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
