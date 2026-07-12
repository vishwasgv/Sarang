import React, { useEffect, useState, useCallback } from 'react'
import { Plus, Users, Calendar, X, Search, RefreshCw, Layers } from 'lucide-react'
import { api } from '@renderer/services/ipc-client'
import { cn } from '@shared/utils/cn'
import { Card } from '@shared/ui/molecules/Card'
import { Badge } from '@shared/ui/atoms/Badge'
import { Select } from '@shared/ui/atoms/Select'
import { useNotificationStore } from '@app/store/notification.store'

interface BatchClass {
  id: string
  className: string
  instructorId: string | null
  maxCapacity: number
  enrolledMemberIds: string
  scheduleDays: string
  scheduleTime: string
  roomOrLocation: string | null
  startDate: string
  endDate: string | null
  status: string
  instructor: { id: string; fullName: string } | null
}

interface Employee {
  id: string
  fullName: string
}

interface Customer {
  id: string
  customerName: string
  phone: string | null
}

// Exhaustive against BatchClass.status in prisma/schema.prisma (ACTIVE|COMPLETED|CANCELLED)
const STATUS_VARIANT: Record<string, 'success' | 'neutral' | 'danger'> = {
  ACTIVE: 'success',
  COMPLETED: 'neutral',
  CANCELLED: 'danger',
}

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function BatchClassesScreen() {
  const { error: toastError } = useNotificationStore()
  const [classes, setClasses] = useState<BatchClass[]>([])
  const [statusFilter, setStatusFilter] = useState('ACTIVE')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingClass, setEditingClass] = useState<BatchClass | null>(null)
  const [form, setForm] = useState({ className: '', instructorId: '', maxCapacity: 20, scheduleDays: [] as string[], scheduleTime: '07:00', startDate: new Date().toISOString().slice(0, 10), endDate: '', roomOrLocation: '' })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])

  // Enrollment
  const [enrollClass, setEnrollClass] = useState<BatchClass | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [enrollSearch, setEnrollSearch] = useState('')
  const [enrolling, setEnrolling] = useState(false)

  // Attendance
  const [attendanceClass, setAttendanceClass] = useState<BatchClass | null>(null)
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().slice(0, 10))
  const [presentIds, setPresentIds] = useState<Set<string>>(new Set())
  const [savingAttendance, setSavingAttendance] = useState(false)
  const [attendanceSaved, setAttendanceSaved] = useState(false)

  const loadClasses = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.batchClass.list({ status: statusFilter || undefined })
      if (res.success) setClasses(res.data as BatchClass[])
      else setError(res.error?.message ?? 'Could not load classes.')
    } catch {
      setError('Could not load classes.')
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => { loadClasses() }, [loadClasses])

  async function loadEmployees() {
    try {
      const res = await api.hr.listEmployees({ isActive: true })
      if (res.success) setEmployees((res.data as { employees: Employee[] }).employees ?? (res.data as Employee[]))
      else toastError('Error', res.error?.message ?? 'Could not load instructors.')
    } catch {
      toastError('Error', 'Could not load instructors.')
    }
  }

  async function loadCustomers() {
    try {
      const res = await api.customers.list({ limit: 1000 })
      if (res.success) setCustomers((res.data as { customers: Customer[] }).customers ?? [])
      else toastError('Error', res.error?.message ?? 'Could not load members.')
    } catch {
      toastError('Error', 'Could not load members.')
    }
  }

  function openForm(cls?: BatchClass) {
    setEditingClass(cls ?? null)
    setForm(cls ? {
      className: cls.className,
      instructorId: cls.instructorId ?? '',
      maxCapacity: cls.maxCapacity,
      scheduleDays: JSON.parse(cls.scheduleDays || '[]'),
      scheduleTime: cls.scheduleTime,
      startDate: cls.startDate.slice(0, 10),
      endDate: cls.endDate ? cls.endDate.slice(0, 10) : '',
      roomOrLocation: cls.roomOrLocation ?? '',
    } : {
      className: '', instructorId: '', maxCapacity: 20, scheduleDays: [], scheduleTime: '07:00',
      startDate: new Date().toISOString().slice(0, 10), endDate: '', roomOrLocation: '',
    })
    setSaveError(null)
    setShowForm(true)
    loadEmployees()
  }

  function toggleDay(day: string) {
    setForm((prev) => ({
      ...prev,
      scheduleDays: prev.scheduleDays.includes(day) ? prev.scheduleDays.filter((d) => d !== day) : [...prev.scheduleDays, day],
    }))
  }

  async function handleSave() {
    if (!form.className || form.scheduleDays.length === 0 || !form.scheduleTime) {
      setSaveError('Class name, schedule days, and time are required.')
      return
    }
    setSaving(true)
    setSaveError(null)
    const payload = {
      className: form.className,
      instructorId: form.instructorId || undefined,
      maxCapacity: Number(form.maxCapacity),
      scheduleDays: JSON.stringify(form.scheduleDays),
      scheduleTime: form.scheduleTime,
      startDate: form.startDate,
      endDate: form.endDate || undefined,
      roomOrLocation: form.roomOrLocation || undefined,
    }
    const res = editingClass
      ? await api.batchClass.update({ id: editingClass.id, ...payload })
      : await api.batchClass.create(payload)
    setSaving(false)
    if (res.success) {
      setShowForm(false)
      loadClasses()
    } else {
      setSaveError(res.error?.message ?? 'Could not save class.')
    }
  }

  async function handleStatusChange(id: string, status: string) {
    try {
      const res = await api.batchClass.update({ id, status })
      if (res.success) loadClasses()
      else toastError('Error', res.error?.message ?? 'Could not update class status.')
    } catch {
      toastError('Error', 'Could not update class status.')
    }
  }

  function openEnrollment(cls: BatchClass) {
    setEnrollClass(cls)
    setEnrollSearch('')
    loadCustomers()
  }

  async function handleEnroll(memberId: string) {
    if (!enrollClass) return
    setEnrolling(true)
    const res = await api.batchClass.enroll({ batchClassId: enrollClass.id, memberId })
    setEnrolling(false)
    if (res.success) {
      loadClasses()
      setEnrollClass(null)
    } else {
      alert(res.error?.message ?? 'Could not enroll member.')
    }
  }

  async function handleUnenroll(batchClassId: string, memberId: string) {
    try {
      const res = await api.batchClass.unenroll({ batchClassId, memberId })
      if (res.success) loadClasses()
      else toastError('Error', res.error?.message ?? 'Could not remove member from class.')
    } catch {
      toastError('Error', 'Could not remove member from class.')
    }
  }

  async function openAttendance(cls: BatchClass) {
    setAttendanceClass(cls)
    setAttendanceDate(new Date().toISOString().slice(0, 10))
    setAttendanceSaved(false)
    await loadCustomers()
    // Pre-fetch today's existing attendance for this class
    const res = await api.batchClass.getAttendance({ classId: cls.id, sessionDate: new Date().toISOString().slice(0, 10) })
    if (res.success) {
      const existing = (res.data as { memberId: string }[]).map((r) => r.memberId)
      setPresentIds(new Set(existing))
    } else {
      setPresentIds(new Set())
    }
  }

  async function handleSaveAttendance() {
    if (!attendanceClass) return
    setSavingAttendance(true)
    try {
      const res = await api.batchClass.markAttendance({ classId: attendanceClass.id, memberIds: Array.from(presentIds), sessionDate: attendanceDate })
      if (res.success) {
        setAttendanceSaved(true)
      } else {
        toastError('Error', res.error?.message ?? 'Could not save attendance.')
      }
    } catch {
      toastError('Error', 'Could not save attendance.')
    } finally {
      setSavingAttendance(false)
    }
  }

  const enrolledIds = enrollClass ? (JSON.parse(enrollClass.enrolledMemberIds || '[]') as string[]) : []
  const availableCustomers = customers.filter(
    (c) => !enrolledIds.includes(c.id) && (!enrollSearch || c.customerName.toLowerCase().includes(enrollSearch.toLowerCase()))
  )

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark dark:text-slate-100">Group Classes</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Manage batch fitness classes and enrollment</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-auto h-10">
            <option value="">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </Select>
          <button onClick={() => openForm()} className="h-10 px-4 bg-brand text-white rounded-xl text-sm font-medium flex items-center gap-2">
            <Plus size={16} /> New Class
          </button>
        </div>
      </div>

      {error && <div className="text-sm text-danger bg-danger/5 border border-danger/20 rounded-xl px-3 py-2">{error}</div>}

      {/* Classes Grid */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 dark:text-slate-400 text-sm">Loading...</div>
      ) : classes.length === 0 ? (
        <Card padding="none" className="p-12 text-center">
          <Layers size={32} className="mx-auto mb-3 text-slate-300 dark:text-slate-600" />
          <p className="text-slate-500 dark:text-slate-400">No classes found. Create one to get started.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {classes.map((cls) => {
            const enrolled: string[] = JSON.parse(cls.enrolledMemberIds || '[]')
            const days: string[] = JSON.parse(cls.scheduleDays || '[]')
            return (
              <Card key={cls.id} padding="lg" className="space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-dark dark:text-slate-100 text-lg">{cls.className}</p>
                    {cls.instructor && <p className="text-sm text-slate-500 dark:text-slate-400">{cls.instructor.fullName}</p>}
                  </div>
                  <Badge variant={STATUS_VARIANT[cls.status] ?? 'neutral'} size="sm">{cls.status}</Badge>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Schedule</p>
                    <p className="text-dark dark:text-slate-100">{days.join(', ')} at {cls.scheduleTime}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Capacity</p>
                    <p className={cn('font-medium', enrolled.length >= cls.maxCapacity ? 'text-danger' : 'text-dark dark:text-slate-100')}>
                      {enrolled.length} / {cls.maxCapacity}
                    </p>
                  </div>
                  {cls.roomOrLocation && (
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Location</p>
                      <p className="text-dark dark:text-slate-100">{cls.roomOrLocation}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Start Date</p>
                    <p className="text-dark dark:text-slate-100">{formatDate(cls.startDate)}</p>
                  </div>
                </div>

                {/* Capacity Bar */}
                <div className="space-y-1">
                  <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all', enrolled.length >= cls.maxCapacity ? 'bg-danger' : 'bg-brand')}
                      style={{ width: `${Math.min(100, (enrolled.length / cls.maxCapacity) * 100)}%` }}
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <button onClick={() => openEnrollment(cls)} className="flex-1 h-9 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-dark dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center gap-1">
                    <Users size={14} /> Enrollment
                  </button>
                  {cls.status === 'ACTIVE' && (
                    <button onClick={() => openAttendance(cls)} className="flex-1 h-9 rounded-xl border border-brand/40 text-sm text-brand hover:bg-brand/5 flex items-center justify-center gap-1">
                      <Calendar size={14} /> Attendance
                    </button>
                  )}
                  <button onClick={() => openForm(cls)} className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">Edit</button>
                  {cls.status === 'ACTIVE' && (
                    <button onClick={() => handleStatusChange(cls.id, 'COMPLETED')} className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">Done</button>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Class Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-dark dark:text-slate-100">{editingClass ? 'Edit Class' : 'New Class'}</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-500 dark:text-slate-400 hover:text-dark dark:hover:text-slate-100"><X size={18} /></button>
            </div>
            {saveError && <div className="text-sm text-danger bg-danger/5 border border-danger/20 rounded-xl px-3 py-2">{saveError}</div>}
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Class Name *</label>
                <input value={form.className} onChange={(e) => setForm({ ...form, className: e.target.value })} className="w-full h-12 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-dark dark:text-slate-100" placeholder="e.g. Morning Yoga" />
              </div>
              <Select label="Instructor" value={form.instructorId} onChange={(e) => setForm({ ...form, instructorId: e.target.value })}>
                <option value="">Select instructor...</option>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.fullName}</option>)}
              </Select>
              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Schedule Days *</label>
                <div className="flex gap-1 flex-wrap">
                  {DAYS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleDay(d)}
                      className={cn('h-9 px-3 rounded-lg text-sm font-medium transition-colors border', form.scheduleDays.includes(d) ? 'bg-brand text-white border-brand' : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800')}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Time *</label>
                  <input type="time" value={form.scheduleTime} onChange={(e) => setForm({ ...form, scheduleTime: e.target.value })} className="w-full h-12 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-dark dark:text-slate-100" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Capacity *</label>
                  <input type="number" min="1" value={form.maxCapacity} onChange={(e) => setForm({ ...form, maxCapacity: Number(e.target.value) })} className="w-full h-12 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-dark dark:text-slate-100" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Start Date *</label>
                  <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="w-full h-12 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-dark dark:text-slate-100" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">End Date</label>
                  <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="w-full h-12 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-dark dark:text-slate-100" />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Room / Location</label>
                <input value={form.roomOrLocation} onChange={(e) => setForm({ ...form, roomOrLocation: e.target.value })} className="w-full h-12 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-dark dark:text-slate-100" placeholder="Studio 1, Room A..." />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowForm(false)} className="flex-1 h-11 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-dark dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 h-11 bg-brand text-white rounded-xl text-sm font-medium disabled:opacity-50">
                {saving ? 'Saving...' : 'Save Class'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Attendance Modal */}
      {attendanceClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-dark dark:text-slate-100">Mark Attendance</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">{attendanceClass.className}</p>
              </div>
              <button onClick={() => setAttendanceClass(null)} className="text-slate-500 dark:text-slate-400 hover:text-dark dark:hover:text-slate-100"><X size={18} /></button>
            </div>

            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Session Date</label>
              <input
                type="date"
                value={attendanceDate}
                onChange={(e) => {
                  setAttendanceDate(e.target.value)
                  setPresentIds(new Set())
                  setAttendanceSaved(false)
                  api.batchClass.getAttendance({ classId: attendanceClass.id, sessionDate: e.target.value }).then((res) => {
                    if (res.success) setPresentIds(new Set((res.data as { memberId: string }[]).map((r) => r.memberId)))
                    else toastError('Error', res.error?.message ?? 'Could not load attendance for this date.')
                  }).catch(() => {
                    toastError('Error', 'Could not load attendance for this date.')
                  })
                }}
                className="w-full h-12 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-dark dark:text-slate-100"
              />
            </div>

            {(() => {
              const enrolledIds: string[] = JSON.parse(attendanceClass.enrolledMemberIds || '[]')
              const enrolledCustomers = customers.filter((c) => enrolledIds.includes(c.id))
              return (
                <div className="space-y-1">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Mark present ({presentIds.size}/{enrolledCustomers.length})</p>
                  {enrolledCustomers.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">No enrolled members.</p>
                  ) : (
                    enrolledCustomers.map((c) => {
                      const isPresent = presentIds.has(c.id)
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            const next = new Set(presentIds)
                            isPresent ? next.delete(c.id) : next.add(c.id)
                            setPresentIds(next)
                            setAttendanceSaved(false)
                          }}
                          className={cn(
                            'w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm transition-colors',
                            isPresent ? 'border-brand/40 bg-brand/5 text-brand' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-dark dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
                          )}
                        >
                          <span className="font-medium">{c.customerName}</span>
                          <span className={cn('text-xs font-semibold', isPresent ? 'text-brand' : 'text-slate-500 dark:text-slate-400')}>
                            {isPresent ? 'Present' : 'Absent'}
                          </span>
                        </button>
                      )
                    })
                  )}
                </div>
              )
            })()}

            {attendanceSaved && (
              <p className="text-sm text-success text-center">Attendance saved for {attendanceDate}.</p>
            )}
            <div className="flex gap-3 pt-2">
              <button onClick={() => setAttendanceClass(null)} className="flex-1 h-11 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-dark dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800">Close</button>
              <button
                onClick={handleSaveAttendance}
                disabled={savingAttendance}
                className="flex-1 h-11 bg-brand text-white rounded-xl text-sm font-medium disabled:opacity-50"
              >
                {savingAttendance ? 'Saving...' : 'Save Attendance'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Enrollment Modal */}
      {enrollClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-dark dark:text-slate-100">Manage Enrollment</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">{enrollClass.className}</p>
              </div>
              <button onClick={() => setEnrollClass(null)} className="text-slate-500 dark:text-slate-400 hover:text-dark dark:hover:text-slate-100"><X size={18} /></button>
            </div>

            {/* Enrolled Members */}
            {enrolledIds.length > 0 && (
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Enrolled ({enrolledIds.length}/{enrollClass.maxCapacity})</p>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {enrolledIds.map((id) => {
                    const c = customers.find((cu) => cu.id === id)
                    return (
                      <div key={id} className="flex items-center justify-between bg-slate-100 dark:bg-slate-800 rounded-lg px-3 py-2">
                        <span className="text-sm text-dark dark:text-slate-100">{c?.customerName ?? id}</span>
                        <button onClick={() => handleUnenroll(enrollClass.id, id)} className="text-xs text-danger hover:underline">Remove</button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Add Members */}
            {enrolledIds.length < enrollClass.maxCapacity && (
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Add Member</p>
                <div className="relative mb-2">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
                  <input value={enrollSearch} onChange={(e) => setEnrollSearch(e.target.value)} placeholder="Search member..." className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-dark dark:text-slate-100" />
                </div>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {availableCustomers.slice(0, 20).map((c) => (
                    <div key={c.id} className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 rounded-lg px-3 py-2">
                      <div>
                        <p className="text-sm text-dark dark:text-slate-100">{c.customerName}</p>
                        {c.phone && <p className="text-xs text-slate-500 dark:text-slate-400">{c.phone}</p>}
                      </div>
                      <button
                        onClick={() => handleEnroll(c.id)}
                        disabled={enrolling}
                        className="text-xs text-brand font-medium hover:underline disabled:opacity-50"
                      >
                        Enroll
                      </button>
                    </div>
                  ))}
                  {availableCustomers.length === 0 && <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-2">No members available</p>}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
