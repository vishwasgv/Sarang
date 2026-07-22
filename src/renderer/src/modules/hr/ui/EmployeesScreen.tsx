import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Search, User, Phone, Briefcase, Calendar, ChevronRight, X, Check } from 'lucide-react'
import { api } from '@renderer/services/ipc-client'
import { useNotificationStore } from '@app/store/notification.store'
import { useIndustryStore } from '@app/store/industry.store'
import { Card } from '@shared/ui/molecules/Card'
import { Badge } from '@shared/ui/atoms/Badge'
import { Select } from '@shared/ui/atoms/Select'
import { ConfirmDialog } from '@shared/ui/molecules/ConfirmDialog'
import { toLocalISODate } from '@shared/utils/locale.util'

interface Employee {
  id: string
  employeeNumber: string | null
  fullName: string
  phone: string | null
  email: string | null
  department: string | null
  designation: string | null
  employeeType: string
  joinDate: string
  exitDate: string | null
  isActive: boolean
  salaryType: string
  basicSalary: number
  allowances: { name: string; amount: number }[]
  notes: string | null
}

const EMPLOYEE_TYPES = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'DAILY_WAGE']
const SALARY_TYPES = ['MONTHLY', 'DAILY', 'HOURLY']

const EMP_TYPE_VARIANT: Record<string, 'success' | 'info' | 'warning' | 'neutral'> = {
  FULL_TIME: 'success',
  PART_TIME: 'info',
  CONTRACT: 'warning',
  DAILY_WAGE: 'neutral'
}

export function EmployeesScreen() {
  const { t } = useTranslation()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  // Phase 58 §2 — Beauty Salon stylist skill-matching (which services this
  // staff member can perform). Reuses the generic service_catalog module
  // gate every service vertical already has — not Beauty-Salon-hardcoded.
  const hasServiceCatalog = useIndustryStore((s) => s.isModuleEnabled('service_catalog'))
  const [serviceCatalog, setServiceCatalog] = useState<{ id: string; serviceName: string }[]>([])
  const [skillIds, setSkillIds] = useState<string[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Employee | null>(null)
  const [detail, setDetail] = useState<Employee | null>(null)
  const [showInactive, setShowInactive] = useState(false)
  const [deactivateTarget, setDeactivateTarget] = useState<Employee | null>(null)
  const [deactivating, setDeactivating] = useState(false)

  const [form, setForm] = useState({
    fullName: '', employeeNumber: '', phone: '', email: '',
    department: '', designation: '', employeeType: 'FULL_TIME',
    joinDate: toLocalISODate(new Date()),
    salaryType: 'MONTHLY', basicSalary: '', notes: '',
    allowances: [] as { name: string; amount: number }[]
  })
  const [newAllowanceName, setNewAllowanceName] = useState('')
  const [newAllowanceAmount, setNewAllowanceAmount] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.hr.listEmployees({ isActive: showInactive ? undefined : true })
      if (res.success && res.data) {
        setEmployees((res.data as any).employees)
      } else {
        toastError(res.error?.message ?? t('hr.actionFailed'))
      }
    } catch {
      toastError(t('hr.actionFailed'))
    } finally {
      setLoading(false)
    }
  }, [showInactive, toastError, t])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!hasServiceCatalog) return
    api.serviceCatalog.list({ isActive: true }).then((res) => {
      if (res.success && Array.isArray(res.data)) setServiceCatalog(res.data as { id: string; serviceName: string }[])
    })
  }, [hasServiceCatalog])

  const visible = employees.filter(e =>
    e.fullName.toLowerCase().includes(search.toLowerCase()) ||
    (e.employeeNumber ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (e.department ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (e.designation ?? '').toLowerCase().includes(search.toLowerCase())
  )

  function openNew() {
    setEditing(null)
    setForm({
      fullName: '', employeeNumber: '', phone: '', email: '',
      department: '', designation: '', employeeType: 'FULL_TIME',
      joinDate: toLocalISODate(new Date()),
      salaryType: 'MONTHLY', basicSalary: '', notes: '',
      allowances: []
    })
    setSkillIds([])
    setNewAllowanceName('')
    setNewAllowanceAmount('')
    setShowForm(true)
  }

  function openEdit(e: Employee) {
    setEditing(e)
    setForm({
      fullName: e.fullName,
      employeeNumber: e.employeeNumber ?? '',
      phone: e.phone ?? '',
      email: e.email ?? '',
      department: e.department ?? '',
      designation: e.designation ?? '',
      employeeType: e.employeeType,
      joinDate: e.joinDate.split('T')[0],
      salaryType: e.salaryType,
      basicSalary: e.basicSalary.toString(),
      notes: e.notes ?? '',
      allowances: [...e.allowances]
    })
    setSkillIds([])
    if (hasServiceCatalog) {
      api.providerSkills.listForEmployee({ employeeId: e.id }).then((res) => {
        if (res.success && Array.isArray(res.data)) setSkillIds(res.data as string[])
      })
    }
    setNewAllowanceName('')
    setNewAllowanceAmount('')
    setShowForm(true)
    setDetail(null)
  }

  function addAllowance() {
    if (!newAllowanceName.trim() || !newAllowanceAmount) return
    setForm(f => ({ ...f, allowances: [...f.allowances, { name: newAllowanceName.trim(), amount: parseFloat(newAllowanceAmount) }] }))
    setNewAllowanceName('')
    setNewAllowanceAmount('')
  }

  function removeAllowance(idx: number) {
    setForm(f => ({ ...f, allowances: f.allowances.filter((_, i) => i !== idx) }))
  }

  async function save() {
    if (!form.fullName.trim()) { toastError(t('hr.nameRequired')); return }
    setSaving(true)
    try {
      const payload = {
        fullName: form.fullName.trim(),
        employeeNumber: form.employeeNumber.trim() || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        department: form.department.trim() || undefined,
        designation: form.designation.trim() || undefined,
        employeeType: form.employeeType,
        joinDate: form.joinDate,
        salaryType: form.salaryType,
        basicSalary: parseFloat(form.basicSalary) || 0,
        allowances: form.allowances,
        notes: form.notes.trim() || undefined
      }
      const res = editing
        ? await api.hr.updateEmployee({ id: editing.id, ...payload })
        : await api.hr.createEmployee(payload)
      if (res.success) {
        // Phase 58 §2 — save the skill checklist as its own call, keyed to
        // whichever employee id we now have (existing or freshly created).
        if (hasServiceCatalog) {
          const employeeId = editing?.id ?? (res.data as { id: string } | undefined)?.id
          if (employeeId) await api.providerSkills.set({ employeeId, serviceCatalogIds: skillIds })
        }
        toastSuccess(t(editing ? 'hr.employeeUpdated' : 'hr.employeeAdded'))
        setShowForm(false)
        load()
      } else {
        toastError(res.error?.message ?? t('hr.saveFailed'))
      }
    } catch {
      toastError(t('hr.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  async function deactivate() {
    if (!deactivateTarget) return
    setDeactivating(true)
    try {
      const res = await api.hr.deactivateEmployee({ id: deactivateTarget.id })
      if (res.success) {
        toastSuccess(t('hr.employeeDeactivated'))
        setDetail(null)
        setDeactivateTarget(null)
        load()
      } else {
        toastError(res.error?.message ?? t('hr.actionFailed'))
      }
    } catch {
      toastError(t('hr.actionFailed'))
    } finally {
      setDeactivating(false)
    }
  }

  const totalSalary = (emp: Employee) => emp.basicSalary + emp.allowances.reduce((s, a) => s + a.amount, 0)

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark dark:text-slate-100">{t('hr.employees')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{t('hr.employeesDesc')}</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2.5 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand/90 transition-colors">
          <Plus size={16} /> {t('hr.addEmployee')}
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('hr.searchEmployees')}
            className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-800 text-dark dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer">
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} className="rounded" />
          {t('hr.showInactive')}
        </label>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" /></div>
      ) : visible.length === 0 ? (
        <div className="text-center py-16">
          <User size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">{t('hr.noEmployees')}</p>
          <p className="text-slate-400 text-sm mt-1">{t('hr.noEmployeesDesc')}</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {visible.map(emp => (
            <Card key={emp.id} padding="md" onClick={() => setDetail(emp)}
              className="flex items-center gap-4 cursor-pointer hover:border-brand hover:shadow-sm transition-all">
              <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center flex-shrink-0">
                <span className="text-brand font-semibold text-sm">{emp.fullName.charAt(0).toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-dark dark:text-slate-100 truncate">{emp.fullName}</p>
                  {!emp.isActive && <Badge variant="danger" size="sm">{t('hr.inactive')}</Badge>}
                  <Badge variant={EMP_TYPE_VARIANT[emp.employeeType] ?? 'neutral'} size="sm">
                    {t(`hr.empType${emp.employeeType}`)}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {emp.designation && <span className="flex items-center gap-1"><Briefcase size={12} />{emp.designation}</span>}
                  {emp.department && <span>{emp.department}</span>}
                  {emp.phone && <span className="flex items-center gap-1"><Phone size={12} />{emp.phone}</span>}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-semibold text-dark dark:text-slate-100">₹{totalSalary(emp).toLocaleString()}</p>
                <p className="text-xs text-slate-400">{t(`hr.salType${emp.salaryType}`)}</p>
              </div>
              <ChevronRight size={16} className="text-slate-400" />
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-semibold text-dark dark:text-slate-100">{t(editing ? 'hr.editEmployee' : 'hr.addEmployee')}</h2>
              <button onClick={() => setShowForm(false)}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('hr.fullName')} *</label>
                  <input value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 text-dark dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('hr.employeeNumber')}</label>
                  <input value={form.employeeNumber} onChange={e => setForm(f => ({ ...f, employeeNumber: e.target.value }))}
                    placeholder="EMP001" className="w-full px-3 py-2 bg-white dark:bg-slate-800 text-dark dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('hr.phone')}</label>
                  <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 text-dark dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('hr.email')}</label>
                  <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 text-dark dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('hr.department')}</label>
                  <input value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 text-dark dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('hr.designation')}</label>
                  <input value={form.designation} onChange={e => setForm(f => ({ ...f, designation: e.target.value }))}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 text-dark dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
                </div>
                <Select label={t('hr.employeeType')} value={form.employeeType} onChange={e => setForm(f => ({ ...f, employeeType: e.target.value }))}>
                  {EMPLOYEE_TYPES.map(et => <option key={et} value={et}>{t(`hr.empType${et}`)}</option>)}
                </Select>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('hr.joinDate')} *</label>
                  <input type="date" value={form.joinDate} onChange={e => setForm(f => ({ ...f, joinDate: e.target.value }))}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 text-dark dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
                </div>
              </div>

              {/* Salary Reference */}
              <div className="border-t pt-4">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">{t('hr.salaryReference')} <span className="text-xs font-normal text-warning">— {t('hr.referenceOnly')}</span></p>
                <div className="grid grid-cols-2 gap-4">
                  <Select label={t('hr.salaryType')} value={form.salaryType} onChange={e => setForm(f => ({ ...f, salaryType: e.target.value }))}>
                    {SALARY_TYPES.map(st => <option key={st} value={st}>{t(`hr.salType${st}`)}</option>)}
                  </Select>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('hr.basicSalary')}</label>
                    <input type="number" min="0" value={form.basicSalary} onChange={e => setForm(f => ({ ...f, basicSalary: e.target.value }))}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 text-dark dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
                  </div>
                </div>
                {/* Allowances */}
                <div className="mt-3">
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-2">{t('hr.allowances')}</p>
                  {form.allowances.map((a, i) => (
                    <div key={i} className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2 mb-1.5 text-sm">
                      <span>{a.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">₹{a.amount.toLocaleString()}</span>
                        <button onClick={() => removeAllowance(i)}><X size={14} className="text-danger/70" /></button>
                      </div>
                    </div>
                  ))}
                  <div className="flex gap-2 mt-2">
                    <input value={newAllowanceName} onChange={e => setNewAllowanceName(e.target.value)}
                      placeholder={t('hr.allowanceName')}
                      className="flex-1 px-3 py-2 bg-white dark:bg-slate-800 text-dark dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
                    <input type="number" value={newAllowanceAmount} onChange={e => setNewAllowanceAmount(e.target.value)}
                      placeholder={t('hr.amount')}
                      className="w-28 px-3 py-2 bg-white dark:bg-slate-800 text-dark dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
                    <button onClick={addAllowance} className="px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 transition-colors">
                      <Plus size={16} className="text-slate-600 dark:text-slate-300" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Phase 58 §2 — Beauty Salon stylist skill-matching */}
              {hasServiceCatalog && serviceCatalog.length > 0 && (
                <div className="border-t pt-4">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">{t('hr.qualifiedServices')}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">{t('hr.qualifiedServicesHint')}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {serviceCatalog.map((s) => {
                      const active = skillIds.includes(s.id)
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setSkillIds((prev) => active ? prev.filter((id) => id !== s.id) : [...prev, s.id])}
                          className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                            active ? 'bg-brand/10 text-brand border-brand/30' : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                          }`}
                        >
                          {s.serviceName}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('hr.notes')}</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 text-dark dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand resize-none" />
              </div>
            </div>
            <div className="flex gap-3 p-6 pt-0">
              <button onClick={() => setShowForm(false)} className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700">{t('common.cancel')}</button>
              <button onClick={save} disabled={saving} className="flex-1 px-4 py-2.5 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand/90 disabled:opacity-50">{saving ? t('cashClose.saving') : t('common.save')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Panel */}
      {detail && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-brand/10 flex items-center justify-center">
                  <span className="text-brand font-bold">{detail.fullName.charAt(0).toUpperCase()}</span>
                </div>
                <div>
                  <p className="font-semibold text-dark dark:text-slate-100">{detail.fullName}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{detail.designation ?? ''}{detail.department ? ` · ${detail.department}` : ''}</p>
                </div>
              </div>
              <button onClick={() => setDetail(null)}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="p-6 space-y-3">
              {detail.phone && <div className="flex items-center gap-2 text-sm"><Phone size={14} className="text-slate-400" />{detail.phone}</div>}
              {detail.email && <div className="flex items-center gap-2 text-sm"><User size={14} className="text-slate-400" />{detail.email}</div>}
              <div className="flex items-center gap-2 text-sm"><Calendar size={14} className="text-slate-400" />{t('hr.joinedOn')} {new Date(detail.joinDate).toLocaleDateString()}</div>
              <div className="flex items-center gap-2 text-sm">
                <Badge variant={EMP_TYPE_VARIANT[detail.employeeType] ?? 'neutral'} size="sm">{t(`hr.empType${detail.employeeType}`)}</Badge>
              </div>
              {/* Salary reference */}
              <div className="bg-warning/10 dark:bg-warning/15 rounded-xl p-4 mt-2">
                <p className="text-xs font-semibold text-warning mb-2 flex items-center gap-1"><Check size={12} />{t('hr.salaryReferenceTitle')}</p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-slate-600 dark:text-slate-300">{t('hr.basicSalary')}</span><span className="font-medium">₹{detail.basicSalary.toLocaleString()}</span></div>
                  {detail.allowances.map((a, i) => (
                    <div key={i} className="flex justify-between"><span className="text-slate-600 dark:text-slate-300">{a.name}</span><span className="font-medium">₹{a.amount.toLocaleString()}</span></div>
                  ))}
                  <div className="flex justify-between border-t pt-1 mt-1"><span className="font-semibold">{t('hr.grossSalary')}</span><span className="font-bold">₹{totalSalary(detail).toLocaleString()}</span></div>
                </div>
                <p className="text-xs text-warning mt-2">{t('hr.salaryDisclaimer')}</p>
              </div>
              {detail.notes && <p className="text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 rounded-lg p-3">{detail.notes}</p>}
            </div>
            <div className="flex gap-3 p-6 pt-0">
              {detail.isActive && (
                <button onClick={() => setDeactivateTarget(detail)} className="flex-1 px-4 py-2.5 border border-danger/30 text-danger rounded-lg text-sm font-medium hover:bg-danger/5">{t('hr.deactivate')}</button>
              )}
              <button onClick={() => openEdit(detail)} className="flex-1 px-4 py-2.5 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand/90">{t('common.edit')}</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deactivateTarget}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={deactivate}
        loading={deactivating}
        title={t('hr.deactivate')}
        message={deactivateTarget ? t('hr.confirmDeactivate', { name: deactivateTarget.fullName }) : ''}
        confirmLabel={t('hr.deactivate')}
      />
    </div>
  )
}
