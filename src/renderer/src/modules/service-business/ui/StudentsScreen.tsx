import { useEffect, useState, useCallback } from 'react'
import { api } from '@renderer/services/ipc-client'
import { UserPlus, Search, Edit2, Trash2, CheckCircle, XCircle } from 'lucide-react'
import { Card } from '@shared/ui/molecules/Card'
import { KpiCard } from '@shared/ui/molecules/KpiCard'
import { Badge } from '@shared/ui/atoms/Badge'
import { Select } from '@shared/ui/atoms/Select'
import { CustomerPicker, type CustomerLite } from '@shared/ui/molecules/CustomerPicker'
import { useNotificationStore } from '@app/store/notification.store'
import { ConfirmDialog } from '@shared/ui/molecules/ConfirmDialog'

interface Customer {
  id: string
  customerName: string
  phone: string | null
  email: string | null
}

interface StudentProfile {
  id: string
  customerId: string
  rollNumber: string | null
  classOrGrade: string
  schoolName: string | null
  parentPhone: string | null
  enrollmentDate: string
  isActive: boolean
  customer: Customer
}

const EMPTY_FORM = {
  customerName: '',
  phone: '',
  email: '',
  rollNumber: '',
  classOrGrade: '',
  schoolName: '',
  parentPhone: '',
  enrollmentDate: new Date().toISOString().split('T')[0],
}

export default function StudentsScreen() {
  const { error: toastError } = useNotificationStore()
  const [students, setStudents] = useState<StudentProfile[]>([])
  const [search, setSearch] = useState('')
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [editStudent, setEditStudent] = useState<StudentProfile | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [pickedCustomer, setPickedCustomer] = useState<CustomerLite | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<StudentProfile | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.student.list({})
      if (res.success && res.data) setStudents(res.data as StudentProfile[])
      else setError(res.error?.message ?? 'Could not load students.')
    } catch {
      setError('Could not load students.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  const filtered = students.filter((s) => {
    const matchSearch =
      !search ||
      s.customer.customerName.toLowerCase().includes(search.toLowerCase()) ||
      (s.rollNumber ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (s.classOrGrade ?? '').toLowerCase().includes(search.toLowerCase())
    const matchActive =
      filterActive === 'all' ||
      (filterActive === 'active' && s.isActive) ||
      (filterActive === 'inactive' && !s.isActive)
    return matchSearch && matchActive
  })

  const total = students.length
  const active = students.filter((s) => s.isActive).length
  const inactive = students.length - active

  function openNew() {
    setEditStudent(null)
    setForm({ ...EMPTY_FORM })
    setPickedCustomer(null)
    setFormError('')
    setShowForm(true)
  }

  function openEdit(s: StudentProfile) {
    setEditStudent(s)
    setForm({
      customerName: s.customer.customerName,
      phone: s.customer.phone ?? '',
      email: s.customer.email ?? '',
      rollNumber: s.rollNumber ?? '',
      classOrGrade: s.classOrGrade,
      schoolName: s.schoolName ?? '',
      parentPhone: s.parentPhone ?? '',
      enrollmentDate: s.enrollmentDate.split('T')[0],
    })
    setFormError('')
    setShowForm(true)
  }

  async function handleSave() {
    if (!editStudent && !pickedCustomer) {
      setFormError('Select or add a student to continue.')
      return
    }
    if (!form.classOrGrade.trim() || (editStudent && !form.customerName.trim())) {
      setFormError('Student name and class/grade are required.')
      return
    }
    setSaving(true)
    setFormError('')
    let res
    if (editStudent) {
      res = await api.student.update({
        id: editStudent.id,
        customerName: form.customerName.trim(),
        phone: form.phone || null,
        email: form.email || null,
        rollNumber: form.rollNumber || null,
        classOrGrade: form.classOrGrade.trim(),
        schoolName: form.schoolName || null,
        parentPhone: form.parentPhone || null,
      })
    } else {
      res = await api.student.create({
        customerId: pickedCustomer!.id,
        customerName: pickedCustomer!.customerName,
        phone: pickedCustomer!.phone || undefined,
        email: pickedCustomer!.email || undefined,
        rollNumber: form.rollNumber || undefined,
        classOrGrade: form.classOrGrade.trim(),
        schoolName: form.schoolName || undefined,
        parentPhone: form.parentPhone || undefined,
        enrollmentDate: form.enrollmentDate || undefined,
      })
    }
    if (res.success) {
      setShowForm(false)
      loadAll()
    } else {
      setFormError(res.error?.message ?? 'Failed to save student.')
    }
    setSaving(false)
  }

  async function handleToggleActive(s: StudentProfile) {
    try {
      const res = await api.student.update({ id: s.id, isActive: !s.isActive })
      if (res.success) loadAll()
      else toastError('Error', res.error?.message ?? 'Could not update student status.')
    } catch {
      toastError('Error', 'Could not update student status.')
    }
  }

  async function handleDelete(s: StudentProfile) {
    setDeleting(true)
    const res = await api.student.delete({ id: s.id })
    setDeleting(false)
    if (res.success) { setDeleteTarget(null); loadAll() }
    else setError(res.error?.message ?? 'Delete failed.')
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Students</h1>
        <button onClick={openNew} className="flex items-center gap-2 bg-brand text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors">
          <UserPlus size={16} /> Add Student
        </button>
      </div>

      {/* KPI bar */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <KpiCard label="Total Students" value={total} />
        <KpiCard label="Active" value={active} color="success" />
        <KpiCard label="Inactive" value={inactive} color="neutral" />
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, roll no, class..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100"
          />
        </div>
        <Select
          value={filterActive}
          onChange={(e) => setFilterActive(e.target.value as 'all' | 'active' | 'inactive')}
          className="w-auto"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </Select>
      </div>

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      {/* Table */}
      <Card padding="none" className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200 dark:bg-slate-950 dark:border-slate-700">
            <tr>
              <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-slate-400">Roll No</th>
              <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-slate-400">Name</th>
              <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-slate-400">Class / Grade</th>
              <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-slate-400">School</th>
              <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-slate-400">Phone</th>
              <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-slate-400">Parent Phone</th>
              <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-slate-400">Enrolled</th>
              <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-slate-400">Status</th>
              <th className="py-3 px-4" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
            {loading ? (
              <tr><td colSpan={9} className="py-12 text-center text-gray-400 dark:text-slate-500">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={9} className="py-12 text-center text-gray-400 dark:text-slate-500">No students found</td></tr>
            ) : filtered.map((s) => (
              <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-slate-800">
                <td className="py-3 px-4 text-gray-500 dark:text-slate-400">{s.rollNumber ?? '—'}</td>
                <td className="py-3 px-4 font-medium text-gray-900 dark:text-slate-100">{s.customer.customerName}</td>
                <td className="py-3 px-4 text-gray-700 dark:text-slate-300">{s.classOrGrade}</td>
                <td className="py-3 px-4 text-gray-500 dark:text-slate-400">{s.schoolName ?? '—'}</td>
                <td className="py-3 px-4 text-gray-500 dark:text-slate-400">{s.customer.phone ?? '—'}</td>
                <td className="py-3 px-4 text-gray-500 dark:text-slate-400">{s.parentPhone ?? '—'}</td>
                <td className="py-3 px-4 text-gray-500 dark:text-slate-400">{new Date(s.enrollmentDate).toLocaleDateString()}</td>
                <td className="py-3 px-4">
                  <Badge variant={s.isActive ? 'success' : 'neutral'} size="sm">{s.isActive ? 'Active' : 'Inactive'}</Badge>
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2 justify-end">
                    <button onClick={() => openEdit(s)} className="p-1.5 text-gray-400 hover:text-indigo-600 rounded dark:text-slate-500" title="Edit">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => handleToggleActive(s)} className="p-1.5 text-gray-400 hover:text-amber-600 rounded dark:text-slate-500" title={s.isActive ? 'Deactivate' : 'Activate'}>
                      {s.isActive ? <XCircle size={14} /> : <CheckCircle size={14} />}
                    </button>
                    <button onClick={() => setDeleteTarget(s)} className="p-1.5 text-gray-400 hover:text-red-600 rounded dark:text-slate-500" title="Remove">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 dark:text-slate-100">{editStudent ? 'Edit Student' : 'Add New Student'}</h2>
            <div className="space-y-3">
              {editStudent ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Student Name *</label>
                    <input value={form.customerName} onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100"
                      placeholder="Full name" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Phone</label>
                      <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100"
                        placeholder="Student phone" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Email</label>
                      <input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100"
                        placeholder="Email" type="email" />
                    </div>
                  </div>
                </>
              ) : (
                <CustomerPicker
                  label="Student *"
                  value={pickedCustomer}
                  onChange={setPickedCustomer}
                  placeholder="Search existing customer by name or phone..."
                />
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Roll Number</label>
                  <input value={form.rollNumber} onChange={(e) => setForm((f) => ({ ...f, rollNumber: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100"
                    placeholder="e.g. 42" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Class / Grade *</label>
                  <input value={form.classOrGrade} onChange={(e) => setForm((f) => ({ ...f, classOrGrade: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100"
                    placeholder="e.g. Class 10, JEE 2027" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">School / College</label>
                <input value={form.schoolName} onChange={(e) => setForm((f) => ({ ...f, schoolName: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100"
                  placeholder="School or college name" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Parent Phone</label>
                  <input value={form.parentPhone} onChange={(e) => setForm((f) => ({ ...f, parentPhone: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100"
                    placeholder="Parent contact" />
                </div>
                {!editStudent && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Enrollment Date</label>
                    <input type="date" value={form.enrollmentDate} onChange={(e) => setForm((f) => ({ ...f, enrollmentDate: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                  </div>
                )}
              </div>
            </div>
            {formError && <p className="text-red-600 text-sm mt-3">{formError}</p>}
            <div className="flex gap-3 mt-5 justify-end">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-800">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm bg-brand text-white rounded-lg hover:bg-blue-600 disabled:opacity-50">
                {saving ? 'Saving...' : editStudent ? 'Update Student' : 'Add Student'}
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
        title="Remove Student"
        message={deleteTarget ? `Remove ${deleteTarget.customer.customerName} from students? Their billing records will be kept.` : ''}
        confirmLabel="Remove"
      />
    </div>
  )
}
