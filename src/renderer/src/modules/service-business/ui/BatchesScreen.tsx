import { useEffect, useState, useCallback } from 'react'
import { api } from '@renderer/services/ipc-client'
import { Plus, Edit2, Trash2, ChevronDown, ChevronUp, UserPlus, UserMinus, BookOpen } from 'lucide-react'
import { Card } from '@shared/ui/molecules/Card'
import { KpiCard } from '@shared/ui/molecules/KpiCard'
import { Badge } from '@shared/ui/atoms/Badge'
import { Select } from '@shared/ui/atoms/Select'
import { useNotificationStore } from '@app/store/notification.store'

interface Instructor { id: string; fullName: string }
interface BatchCount { enrollments: number }

interface CoachingBatch {
  id: string
  batchName: string
  subjectOrCourse: string
  instructorId: string | null
  instructor: Instructor | null
  scheduleDays: string
  scheduleTime: string | null
  roomOrLocation: string | null
  maxCapacity: number
  startDate: string
  endDate: string | null
  status: string
  feePerMonth: number
  _count: BatchCount
}

interface StudentOption { id: string; customerName: string; phone: string | null }
interface EnrollmentStudent { id: string; customerName: string; phone: string | null }

interface Enrollment {
  id: string
  batchId: string
  studentId: string
  enrolledDate: string
  status: string
  discountType: string
  discountAmount: number
  effectiveFee: number
  notes: string | null
  student: EnrollmentStudent
}

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
// CoachingBatch.status — ACTIVE|COMPLETED|CANCELLED (prisma/schema.prisma)
const STATUS_VARIANT: Record<string, 'success' | 'info' | 'danger'> = {
  ACTIVE: 'success',
  COMPLETED: 'info',
  CANCELLED: 'danger',
}
// CoachingBatchEnrollment.status — ACTIVE|DROPPED|COMPLETED (prisma/schema.prisma)
const ENR_STATUS_VARIANT: Record<string, 'success' | 'danger' | 'neutral'> = {
  ACTIVE: 'success',
  DROPPED: 'danger',
  COMPLETED: 'neutral',
}

const EMPTY_BATCH = {
  batchName: '', subjectOrCourse: '', instructorId: '',
  scheduleDays: [] as string[], scheduleTime: '', roomOrLocation: '',
  maxCapacity: '20', startDate: new Date().toISOString().split('T')[0],
  endDate: '', feePerMonth: '', status: 'ACTIVE',
}

const EMPTY_ENR = {
  studentId: '', discountType: 'NONE', discountAmount: '0', effectiveFee: '', notes: '',
}

export default function BatchesScreen() {
  const { error: toastError } = useNotificationStore()
  const [batches, setBatches] = useState<CoachingBatch[]>([])
  const [employees, setEmployees] = useState<Instructor[]>([])
  const [allStudents, setAllStudents] = useState<StudentOption[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('')

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [enrollments, setEnrollments] = useState<Record<string, Enrollment[]>>({})

  const [batchKpis, setBatchKpis] = useState<{ totalBatches: number; activeBatches: number; totalEnrolled: number; totalMonthlyRevenue: number } | null>(null)

  const [showBatchForm, setShowBatchForm] = useState(false)
  const [editBatch, setEditBatch] = useState<CoachingBatch | null>(null)
  const [batchForm, setBatchForm] = useState({ ...EMPTY_BATCH })
  const [batchSaving, setBatchSaving] = useState(false)
  const [batchError, setBatchError] = useState('')

  const [showEnrForm, setShowEnrForm] = useState(false)
  const [enrBatchId, setEnrBatchId] = useState('')
  const [enrForm, setEnrForm] = useState({ ...EMPTY_ENR })
  const [enrSaving, setEnrSaving] = useState(false)
  const [enrError, setEnrError] = useState('')

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [batchRes, empRes, stuRes, kpiRes] = await Promise.all([
        api.coachingBatch.list({}),
        api.hr.listEmployees(),
        api.student.list({}),
        api.coachingBatch.kpis(),
      ])
      if (batchRes.success && batchRes.data) setBatches(batchRes.data as CoachingBatch[])
      else toastError('Error', batchRes.error?.message ?? 'Could not load batches.')
      if (empRes.success && empRes.data) {
        const d = empRes.data as { employees?: Instructor[] } | Instructor[]
        setEmployees(Array.isArray(d) ? d : (d.employees ?? []))
      } else {
        toastError('Error', empRes.error?.message ?? 'Could not load instructors.')
      }
      if (stuRes.success && stuRes.data) {
        const profiles = stuRes.data as Array<{ customer: StudentOption }>
        setAllStudents(profiles.map((p) => p.customer))
      } else {
        toastError('Error', stuRes.error?.message ?? 'Could not load students.')
      }
      if (kpiRes.success && kpiRes.data) setBatchKpis(kpiRes.data as typeof batchKpis)
      else toastError('Error', kpiRes.error?.message ?? 'Could not load batch KPIs.')
    } catch {
      toastError('Error', 'Could not load batches.')
    } finally {
      setLoading(false)
    }
  }, [toastError])

  useEffect(() => { loadAll() }, [loadAll])

  async function loadEnrollments(batchId: string) {
    try {
      const res = await api.enrollment.listByBatch({ batchId })
      if (res.success && res.data) {
        setEnrollments((prev) => ({ ...prev, [batchId]: res.data as Enrollment[] }))
      } else {
        toastError('Error', res.error?.message ?? 'Could not load enrollments.')
      }
    } catch {
      toastError('Error', 'Could not load enrollments.')
    }
  }

  function toggleExpand(id: string) {
    if (expandedId === id) { setExpandedId(null); return }
    setExpandedId(id)
    loadEnrollments(id)
  }

  // Batch form
  function openNewBatch() {
    setEditBatch(null)
    setBatchForm({ ...EMPTY_BATCH })
    setBatchError('')
    setShowBatchForm(true)
  }
  function openEditBatch(b: CoachingBatch) {
    setEditBatch(b)
    setBatchForm({
      batchName: b.batchName, subjectOrCourse: b.subjectOrCourse,
      instructorId: b.instructorId ?? '', scheduleDays: JSON.parse(b.scheduleDays),
      scheduleTime: b.scheduleTime ?? '', roomOrLocation: b.roomOrLocation ?? '',
      maxCapacity: String(b.maxCapacity), startDate: b.startDate.split('T')[0],
      endDate: b.endDate ? b.endDate.split('T')[0] : '', feePerMonth: String(b.feePerMonth),
      status: b.status,
    })
    setBatchError('')
    setShowBatchForm(true)
  }
  function toggleDay(day: string) {
    setBatchForm((f) => ({
      ...f,
      scheduleDays: f.scheduleDays.includes(day)
        ? f.scheduleDays.filter((d) => d !== day)
        : [...f.scheduleDays, day],
    }))
  }

  async function handleSaveBatch() {
    if (!batchForm.batchName.trim() || !batchForm.subjectOrCourse.trim() || !batchForm.startDate || !batchForm.feePerMonth) {
      setBatchError('Batch name, subject, start date and fee are required.')
      return
    }
    setBatchSaving(true)
    setBatchError('')
    try {
      const payload = {
        batchName: batchForm.batchName.trim(),
        subjectOrCourse: batchForm.subjectOrCourse.trim(),
        instructorId: batchForm.instructorId || undefined,
        scheduleDays: batchForm.scheduleDays,
        scheduleTime: batchForm.scheduleTime || undefined,
        roomOrLocation: batchForm.roomOrLocation || undefined,
        maxCapacity: Number(batchForm.maxCapacity) || 20,
        startDate: batchForm.startDate,
        endDate: batchForm.endDate || undefined,
        feePerMonth: Number(batchForm.feePerMonth),
        status: batchForm.status,
      }
      let res
      if (editBatch) {
        res = await api.coachingBatch.update({ id: editBatch.id, ...payload,
          instructorId: batchForm.instructorId || null,
          scheduleTime: batchForm.scheduleTime || null,
          roomOrLocation: batchForm.roomOrLocation || null,
          endDate: batchForm.endDate || null,
        })
      } else {
        res = await api.coachingBatch.create(payload)
      }
      if (res.success) { setShowBatchForm(false); loadAll() }
      else setBatchError(res.error?.message ?? 'Failed to save batch.')
    } catch {
      setBatchError('Failed to save batch.')
    } finally {
      setBatchSaving(false)
    }
  }

  async function handleDeleteBatch(b: CoachingBatch) {
    if (!confirm(`Delete batch "${b.batchName}"? All enrollments and fee records will be deleted.`)) return
    try {
      const res = await api.coachingBatch.delete({ id: b.id })
      if (res.success) loadAll()
      else toastError('Error', res.error?.message ?? 'Failed to delete batch.')
    } catch {
      toastError('Error', 'Failed to delete batch.')
    }
  }

  // Enrollment form
  function openEnrForm(batchId: string, batch: CoachingBatch) {
    setEnrBatchId(batchId)
    setEnrForm({ ...EMPTY_ENR, effectiveFee: String(batch.feePerMonth) })
    setEnrError('')
    setShowEnrForm(true)
  }
  async function handleSaveEnrollment() {
    if (!enrForm.studentId || !enrForm.effectiveFee) {
      setEnrError('Student and effective fee are required.')
      return
    }
    setEnrSaving(true)
    setEnrError('')
    try {
      const res = await api.enrollment.create({
        batchId: enrBatchId,
        studentId: enrForm.studentId,
        discountType: enrForm.discountType,
        discountAmount: Number(enrForm.discountAmount) || 0,
        effectiveFee: Number(enrForm.effectiveFee),
        notes: enrForm.notes || undefined,
      })
      if (res.success) {
        setShowEnrForm(false)
        loadEnrollments(enrBatchId)
        api.coachingBatch.kpis().then((r) => { if (r.success && r.data) setBatchKpis(r.data as typeof batchKpis) })
      } else setEnrError(res.error?.message ?? 'Failed to enroll student.')
    } catch {
      setEnrError('Failed to enroll student.')
    } finally {
      setEnrSaving(false)
    }
  }

  async function handleDropEnrollment(enr: Enrollment) {
    try {
      const res = await api.enrollment.update({ id: enr.id, status: 'DROPPED' })
      if (res.success) {
        loadEnrollments(enr.batchId)
        api.coachingBatch.kpis().then((r) => { if (r.success && r.data) setBatchKpis(r.data as typeof batchKpis) })
      } else {
        toastError('Error', res.error?.message ?? 'Failed to drop student from batch.')
      }
    } catch {
      toastError('Error', 'Failed to drop student from batch.')
    }
  }

  const filtered = batches.filter((b) => !filterStatus || b.status === filterStatus)

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Batches</h1>
        <button onClick={openNewBatch} className="flex items-center gap-2 bg-brand text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors">
          <Plus size={16} /> New Batch
        </button>
      </div>

      {/* KPIs — always accurate, computed server-side */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <KpiCard label="Total Batches" value={batchKpis?.totalBatches ?? batches.length} />
        <KpiCard label="Active Batches" value={batchKpis?.activeBatches ?? batches.filter((b) => b.status === 'ACTIVE').length} color="success" />
        <KpiCard label="Students Enrolled" value={batchKpis?.totalEnrolled ?? '—'} color="info" />
        <KpiCard label="Monthly Revenue" value={batchKpis ? `₹${batchKpis.totalMonthlyRevenue.toLocaleString()}` : '—'} color="brand" />
      </div>

      {/* Filter */}
      <div className="mb-4">
        <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-auto">
          <option value="">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </Select>
      </div>

      {/* Batch list */}
      <div className="space-y-3">
        {loading ? (
          <Card padding="none" className="p-12 text-center text-gray-400 dark:text-slate-500">Loading...</Card>
        ) : filtered.length === 0 ? (
          <Card padding="none" className="p-12 text-center text-gray-400 dark:text-slate-500">No batches found</Card>
        ) : filtered.map((b) => {
          const days: string[] = JSON.parse(b.scheduleDays)
          const isOpen = expandedId === b.id
          const enrs = enrollments[b.id] ?? []
          const activeEnrs = enrs.filter((e) => e.status === 'ACTIVE')
          const atCapacity = isOpen && activeEnrs.length >= b.maxCapacity
          return (
            <Card key={b.id} padding="none" className="overflow-hidden">
              {/* Batch header row */}
              <div className="flex items-center gap-4 p-4">
                <button onClick={() => toggleExpand(b.id)} className="text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-200">
                  {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900 dark:text-slate-100">{b.batchName}</span>
                    <Badge variant={STATUS_VARIANT[b.status] ?? 'neutral'} size="sm">{b.status}</Badge>
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5 dark:text-slate-400">
                    {b.subjectOrCourse}
                    {b.instructor && ` · ${b.instructor.fullName}`}
                    {days.length > 0 && ` · ${days.join(', ')}`}
                    {b.scheduleTime && ` at ${b.scheduleTime}`}
                    {b.roomOrLocation && ` · ${b.roomOrLocation}`}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-semibold text-gray-900 dark:text-slate-100">₹{Number(b.feePerMonth).toLocaleString()}/mo</p>
                  <p className="text-xs text-gray-500 dark:text-slate-400">{activeEnrs.length}/{b.maxCapacity} students</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => openEditBatch(b)} className="p-1.5 text-gray-400 hover:text-indigo-600 rounded dark:text-slate-500" title="Edit">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => handleDeleteBatch(b)} className="p-1.5 text-gray-400 hover:text-red-600 rounded dark:text-slate-500" title="Delete">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Enrollments panel */}
              {isOpen && (
                <div className="border-t border-gray-100 bg-gray-50 p-4 dark:bg-slate-950 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5 dark:text-slate-300">
                      <BookOpen size={14} /> Enrollments
                    </h3>
                    {atCapacity ? (
                      <Badge variant="danger">Batch Full</Badge>
                    ) : (
                      <button onClick={() => openEnrForm(b.id, b)}
                        className="flex items-center gap-1.5 text-xs bg-white dark:bg-slate-900 border border-gray-300 px-3 py-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 font-medium dark:border-slate-600">
                        <UserPlus size={12} /> Enroll Student
                      </button>
                    )}
                  </div>
                  {enrs.length === 0 ? (
                    <p className="text-sm text-gray-400 py-4 text-center dark:text-slate-500">No students enrolled yet</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-gray-500 dark:text-slate-400">
                          <th className="pb-2 font-medium">Student</th>
                          <th className="pb-2 font-medium">Phone</th>
                          <th className="pb-2 font-medium">Discount</th>
                          <th className="pb-2 font-medium text-right">Eff. Fee</th>
                          <th className="pb-2 font-medium">Status</th>
                          <th className="pb-2" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                        {enrs.map((e) => (
                          <tr key={e.id}>
                            <td className="py-2 font-medium text-gray-900 dark:text-slate-100">{e.student.customerName}</td>
                            <td className="py-2 text-gray-500 dark:text-slate-400">{e.student.phone ?? '—'}</td>
                            <td className="py-2 text-gray-500 dark:text-slate-400">
                              {e.discountType !== 'NONE' ? `${e.discountType} ₹${Number(e.discountAmount).toLocaleString()}` : '—'}
                            </td>
                            <td className="py-2 text-right font-medium text-gray-900 dark:text-slate-100">₹{Number(e.effectiveFee).toLocaleString()}</td>
                            <td className="py-2">
                              <Badge variant={ENR_STATUS_VARIANT[e.status] ?? 'neutral'} size="sm">{e.status}</Badge>
                            </td>
                            <td className="py-2 text-right">
                              {e.status === 'ACTIVE' && (
                                <button onClick={() => handleDropEnrollment(e)} className="text-red-500 hover:text-red-700" title="Drop student">
                                  <UserMinus size={14} />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </Card>
          )
        })}
      </div>

      {/* Batch form modal */}
      {showBatchForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 dark:text-slate-100">{editBatch ? 'Edit Batch' : 'New Batch'}</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Batch Name *</label>
                <input value={batchForm.batchName} onChange={(e) => setBatchForm((f) => ({ ...f, batchName: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100"
                  placeholder="e.g. JEE 2027 Morning Batch" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Subject / Course *</label>
                <input value={batchForm.subjectOrCourse} onChange={(e) => setBatchForm((f) => ({ ...f, subjectOrCourse: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100"
                  placeholder="e.g. Mathematics, Carnatic Vocal" />
              </div>
              <Select label="Instructor" value={batchForm.instructorId} onChange={(e) => setBatchForm((f) => ({ ...f, instructorId: e.target.value }))}>
                <option value="">No instructor assigned</option>
                {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.fullName}</option>)}
              </Select>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-slate-300">Schedule Days</label>
                <div className="flex gap-2 flex-wrap">
                  {DAYS.map((day) => (
                    <button key={day} type="button"
                      onClick={() => toggleDay(day)}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${batchForm.scheduleDays.includes(day) ? 'bg-brand text-white border-brand' : 'bg-white dark:bg-slate-900 text-gray-600 dark:text-slate-400 border-gray-300 dark:border-slate-600 hover:border-brand'}`}>
                      {day}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Schedule Time</label>
                  <input value={batchForm.scheduleTime} onChange={(e) => setBatchForm((f) => ({ ...f, scheduleTime: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100"
                    placeholder="e.g. 07:00 AM" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Room / Location</label>
                  <input value={batchForm.roomOrLocation} onChange={(e) => setBatchForm((f) => ({ ...f, roomOrLocation: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100"
                    placeholder="e.g. Room 3A" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Max Capacity</label>
                  <input type="number" min={1} value={batchForm.maxCapacity} onChange={(e) => setBatchForm((f) => ({ ...f, maxCapacity: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Fee / Month (₹) *</label>
                  <input type="number" min={0} value={batchForm.feePerMonth} onChange={(e) => setBatchForm((f) => ({ ...f, feePerMonth: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Start Date *</label>
                  <input type="date" value={batchForm.startDate} onChange={(e) => setBatchForm((f) => ({ ...f, startDate: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">End Date</label>
                  <input type="date" value={batchForm.endDate} onChange={(e) => setBatchForm((f) => ({ ...f, endDate: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                </div>
              </div>
              {editBatch && (
                <Select label="Status" value={batchForm.status} onChange={(e) => setBatchForm((f) => ({ ...f, status: e.target.value }))}>
                  <option value="ACTIVE">Active</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="CANCELLED">Cancelled</option>
                </Select>
              )}
            </div>
            {batchError && <p className="text-red-600 text-sm mt-3">{batchError}</p>}
            <div className="flex gap-3 mt-5 justify-end">
              <button onClick={() => setShowBatchForm(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-800">Cancel</button>
              <button onClick={handleSaveBatch} disabled={batchSaving} className="px-4 py-2 text-sm bg-brand text-white rounded-lg hover:bg-blue-600 disabled:opacity-50">
                {batchSaving ? 'Saving...' : editBatch ? 'Update Batch' : 'Create Batch'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Enrollment form modal */}
      {showEnrForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 dark:text-slate-100">Enroll Student</h2>
            <div className="space-y-3">
              <Select label="Student" required value={enrForm.studentId} onChange={(e) => setEnrForm((f) => ({ ...f, studentId: e.target.value }))}>
                <option value="">Select student...</option>
                {allStudents.map((s) => <option key={s.id} value={s.id}>{s.customerName}{s.phone ? ` — ${s.phone}` : ''}</option>)}
              </Select>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Select label="Discount Type" value={enrForm.discountType}
                    onChange={(e) => { setEnrForm((f) => ({ ...f, discountType: e.target.value })); }}>
                    <option value="NONE">None</option>
                    <option value="SCHOLARSHIP">Scholarship</option>
                    <option value="SIBLING">Sibling</option>
                    <option value="REFERRAL">Referral</option>
                    <option value="CUSTOM">Custom</option>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Discount Amount (₹)</label>
                  <input type="number" min={0} value={enrForm.discountAmount}
                    onChange={(e) => {
                      setEnrForm((f) => ({ ...f, discountAmount: e.target.value }))
                      const batch = batches.find((b) => b.id === enrBatchId)
                      if (batch) {
                        const fee = Number(batch.feePerMonth) - Number(e.target.value || 0)
                        setEnrForm((f) => ({ ...f, discountAmount: e.target.value, effectiveFee: String(Math.max(0, fee)) }))
                      }
                    }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Effective Fee (₹) *</label>
                <input type="number" min={0} value={enrForm.effectiveFee}
                  onChange={(e) => setEnrForm((f) => ({ ...f, effectiveFee: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                <p className="text-xs text-gray-400 mt-1 dark:text-slate-500">Auto-computed from batch fee minus discount</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Notes</label>
                <input value={enrForm.notes} onChange={(e) => setEnrForm((f) => ({ ...f, notes: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100"
                  placeholder="Optional notes" />
              </div>
            </div>
            {enrError && <p className="text-red-600 text-sm mt-3">{enrError}</p>}
            <div className="flex gap-3 mt-5 justify-end">
              <button onClick={() => setShowEnrForm(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-800">Cancel</button>
              <button onClick={handleSaveEnrollment} disabled={enrSaving} className="px-4 py-2 text-sm bg-brand text-white rounded-lg hover:bg-blue-600 disabled:opacity-50">
                {enrSaving ? 'Enrolling...' : 'Enroll'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
