import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, X, Check, AlertCircle } from 'lucide-react'
import { api } from '@renderer/services/ipc-client'
import { useNotificationStore } from '@app/store/notification.store'
import { Card } from '@shared/ui/molecules/Card'
import { Badge } from '@shared/ui/atoms/Badge'
import { Select } from '@shared/ui/atoms/Select'
import { Tabs } from '@shared/ui/molecules/Tabs'

interface Employee { id: string; fullName: string }
interface LeaveType { id: string; name: string; maxDays: number; isPaid: boolean; isActive: boolean }
interface LeaveRequest {
  id: string; employeeId: string; employeeName: string
  leaveTypeId: string; leaveTypeName: string
  fromDate: string; toDate: string; days: number
  reason: string | null; status: string; approvedBy: string | null; approvedAt: string | null
  notes: string | null; createdAt: string
}
interface LeaveBalance {
  leaveTypeId: string; name: string; maxDays: number; used: number; remaining: number
}

const STATUS_VARIANT: Record<string, 'warning' | 'success' | 'danger'> = {
  PENDING:  'warning',
  APPROVED: 'success',
  REJECTED: 'danger'
}

const STATUS_KEY: Record<string, string> = {
  PENDING:  'hr.leavePending',
  APPROVED: 'hr.leaveApproved',
  REJECTED: 'hr.leaveRejected'
}

export function LeaveScreen() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<'requests' | 'types'>('requests')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([])
  const [requests, setRequests] = useState<LeaveRequest[]>([])
  const [filterStatus, setFilterStatus] = useState('')
  const [filterEmployee, setFilterEmployee] = useState('')
  const [loading, setLoading] = useState(true)

  const [showRequestForm, setShowRequestForm] = useState(false)
  const [showTypeForm, setShowTypeForm] = useState(false)
  const [reqForm, setReqForm] = useState({ employeeId: '', leaveTypeId: '', fromDate: '', toDate: '', days: '1', reason: '' })
  const [typeForm, setTypeForm] = useState({ name: '', maxDays: '12', isPaid: true })
  const [saving, setSaving] = useState(false)
  const [empBalances, setEmpBalances] = useState<LeaveBalance[]>([])
  const { success: toastSuccess, error: toastError } = useNotificationStore()

  const currentYear = new Date().getFullYear()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [empRes, ltRes, reqRes] = await Promise.all([
        api.hr.listEmployees({ isActive: true }),
        api.hr.listLeaveTypes(),
        api.hr.listLeaveRequests(filterStatus ? { status: filterStatus } : undefined)
      ])
      if (empRes.success && empRes.data && ltRes.success && ltRes.data && reqRes.success && reqRes.data) {
        setEmployees((empRes.data as any).employees)
        setLeaveTypes((ltRes.data as any).leaveTypes)
        setRequests((reqRes.data as any).requests)
      } else {
        toastError((empRes.error ?? ltRes.error ?? reqRes.error)?.message ?? t('hr.actionFailed'))
      }
    } catch {
      toastError(t('hr.actionFailed'))
    } finally {
      setLoading(false)
    }
  }, [filterStatus, toastError, t])

  useEffect(() => { load() }, [load])

  // Load leave balance whenever an employee is selected in the request form.
  // Secondary/supplementary data for the form's balance indicator — a failure
  // here doesn't block the request flow, so we swallow it without a toast but
  // still avoid an unhandled rejection.
  useEffect(() => {
    if (!reqForm.employeeId) { setEmpBalances([]); return }
    api.hr.getLeaveBalance({ employeeId: reqForm.employeeId, year: currentYear })
      .then(res => {
        if (res.success && res.data) setEmpBalances((res.data as any).balances)
      })
      .catch(() => {})
  }, [reqForm.employeeId, currentYear])

  async function saveRequest() {
    if (!reqForm.employeeId || !reqForm.leaveTypeId || !reqForm.fromDate || !reqForm.toDate) {
      toastError(t('hr.fillRequired')); return
    }
    setSaving(true)
    try {
      const res = await api.hr.createLeaveRequest({
        employeeId: reqForm.employeeId,
        leaveTypeId: reqForm.leaveTypeId,
        fromDate: reqForm.fromDate,
        toDate: reqForm.toDate,
        days: parseFloat(reqForm.days) || 1,
        reason: reqForm.reason.trim() || undefined
      })
      if (res.success) {
        toastSuccess(t('hr.leaveRequested'))
        setShowRequestForm(false)
        setReqForm({ employeeId: '', leaveTypeId: '', fromDate: '', toDate: '', days: '1', reason: '' })
        setEmpBalances([])
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

  async function updateStatus(id: string, status: 'APPROVED' | 'REJECTED') {
    try {
      const res = await api.hr.updateLeaveStatus({ id, status })
      if (res.success) {
        toastSuccess(t(status === 'APPROVED' ? 'hr.leaveApproved' : 'hr.leaveRejected'))
        load()
      } else {
        toastError(res.error?.message ?? t('hr.actionFailed'))
      }
    } catch {
      toastError(t('hr.actionFailed'))
    }
  }

  async function saveLeaveType() {
    if (!typeForm.name.trim()) { toastError(t('hr.nameRequired')); return }
    setSaving(true)
    try {
      const res = await api.hr.createLeaveType({ name: typeForm.name.trim(), maxDays: parseInt(typeForm.maxDays) || 0, isPaid: typeForm.isPaid })
      if (res.success) {
        toastSuccess(t('hr.leaveTypeAdded'))
        setShowTypeForm(false)
        setTypeForm({ name: '', maxDays: '12', isPaid: true })
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

  const visible = requests.filter(r =>
    (!filterEmployee || r.employeeId === filterEmployee)
  )

  // Find balance for the currently selected leave type in the form
  const selectedBalance = empBalances.find(b => b.leaveTypeId === reqForm.leaveTypeId) ?? null

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark dark:text-slate-100">{t('hr.leaveManagement')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{t('hr.leaveDesc')}</p>
        </div>
        <button onClick={() => tab === 'requests' ? setShowRequestForm(true) : setShowTypeForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand/90 transition-colors">
          <Plus size={16} />{t(tab === 'requests' ? 'hr.newRequest' : 'hr.newLeaveType')}
        </button>
      </div>

      {/* Tabs */}
      <Tabs
        tabs={[
          { id: 'requests', label: t('hr.leaveRequests') },
          { id: 'types', label: t('hr.leaveTypes') }
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'requests' && (
        <>
          {/* Filters */}
          <div className="flex gap-3 flex-wrap">
            <Select value={filterEmployee} onChange={e => setFilterEmployee(e.target.value)}>
              <option value="">{t('hr.allEmployees')}</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.fullName}</option>)}
            </Select>
            <Select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">{t('hr.allStatuses')}</option>
              <option value="PENDING">{t('hr.leavePending')}</option>
              <option value="APPROVED">{t('hr.leaveApproved')}</option>
              <option value="REJECTED">{t('hr.leaveRejected')}</option>
            </Select>
          </div>

          {loading ? (
            <div className="flex justify-center py-8"><div className="w-7 h-7 border-2 border-brand border-t-transparent rounded-full animate-spin" /></div>
          ) : visible.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle size={36} className="mx-auto text-slate-300 mb-2" />
              <p className="text-slate-500 dark:text-slate-400">{t('hr.noLeaveRequests')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {visible.map(r => (
                <Card key={r.id} padding="md">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-dark dark:text-slate-100">{r.employeeName}</p>
                        <Badge variant={STATUS_VARIANT[r.status] ?? 'neutral'} size="sm">{t(STATUS_KEY[r.status] ?? r.status)}</Badge>
                        {r.leaveTypeName && <Badge variant="neutral" size="sm">{r.leaveTypeName}</Badge>}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-sm text-slate-600 dark:text-slate-300">
                        <span>{new Date(r.fromDate).toLocaleDateString()} — {new Date(r.toDate).toLocaleDateString()}</span>
                        <span className="font-medium">{r.days} {t('hr.days')}</span>
                      </div>
                      {r.reason && <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 italic">"{r.reason}"</p>}
                    </div>
                    {r.status === 'PENDING' && (
                      <div className="flex gap-2 ml-4">
                        <button onClick={() => updateStatus(r.id, 'APPROVED')}
                          className="flex items-center gap-1 px-3 py-1.5 bg-success/10 text-success rounded-lg text-sm font-medium hover:bg-success/20 transition-colors">
                          <Check size={14} />{t('hr.approve')}
                        </button>
                        <button onClick={() => updateStatus(r.id, 'REJECTED')}
                          className="flex items-center gap-1 px-3 py-1.5 bg-danger/10 text-danger rounded-lg text-sm font-medium hover:bg-danger/20 transition-colors">
                          <X size={14} />{t('hr.reject')}
                        </button>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'types' && (
        <div className="space-y-3">
          {leaveTypes.map(lt => (
            <Card key={lt.id} padding="md" className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-dark dark:text-slate-100">{lt.name}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  {lt.maxDays === 0 ? t('hr.unlimited') : `${lt.maxDays} ${t('hr.daysPerYear')}`}
                  {' · '}{lt.isPaid ? t('hr.paid') : t('hr.unpaid')}
                </p>
              </div>
              <Badge variant={lt.isActive ? 'success' : 'neutral'} size="sm">
                {lt.isActive ? t('hr.active') : t('hr.inactive')}
              </Badge>
            </Card>
          ))}
        </div>
      )}

      {/* New Request Form Modal */}
      {showRequestForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-semibold text-dark dark:text-slate-100">{t('hr.newLeaveRequest')}</h2>
              <button onClick={() => setShowRequestForm(false)}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="p-6 space-y-4">
              <Select label={t('hr.employee')} required value={reqForm.employeeId}
                onChange={e => setReqForm(f => ({ ...f, employeeId: e.target.value }))}>
                <option value="">{t('hr.selectEmployee')}</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.fullName}</option>)}
              </Select>
              <div>
                <Select label={t('hr.leaveType')} required value={reqForm.leaveTypeId}
                  onChange={e => setReqForm(f => ({ ...f, leaveTypeId: e.target.value }))}>
                  <option value="">{t('hr.selectLeaveType')}</option>
                  {leaveTypes.filter(lt => lt.isActive).map(lt => <option key={lt.id} value={lt.id}>{lt.name}</option>)}
                </Select>
                {/* Leave balance indicator */}
                {reqForm.employeeId && reqForm.leaveTypeId && selectedBalance && (
                  <div className="mt-2 flex gap-4 text-xs bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2">
                    <span className="text-slate-500 dark:text-slate-400">{t('hr.leaveBalance')}:</span>
                    <span>{t('hr.used')}: <span className="font-medium text-slate-700 dark:text-slate-300">{selectedBalance.used}</span></span>
                    <span>{t('hr.remaining')}: <span className={`font-medium ${selectedBalance.remaining === -1 ? 'text-success' : selectedBalance.remaining <= 2 ? 'text-danger' : 'text-slate-700 dark:text-slate-300'}`}>
                      {selectedBalance.remaining === -1 ? t('hr.unlimited') : selectedBalance.remaining}
                    </span></span>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('hr.fromDate')} *</label>
                  <input type="date" value={reqForm.fromDate}
                    onChange={e => {
                      const newFrom = e.target.value
                      setReqForm(f => {
                        if (newFrom && f.toDate) {
                          const diff = Math.round((new Date(f.toDate).getTime() - new Date(newFrom).getTime()) / 86400000) + 1
                          return { ...f, fromDate: newFrom, days: diff > 0 ? diff.toString() : f.days }
                        }
                        return { ...f, fromDate: newFrom }
                      })
                    }}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 text-dark dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('hr.toDate')} *</label>
                  <input type="date" value={reqForm.toDate}
                    onChange={e => {
                      const newTo = e.target.value
                      setReqForm(f => {
                        if (f.fromDate && newTo) {
                          const diff = Math.round((new Date(newTo).getTime() - new Date(f.fromDate).getTime()) / 86400000) + 1
                          return { ...f, toDate: newTo, days: diff > 0 ? diff.toString() : f.days }
                        }
                        return { ...f, toDate: newTo }
                      })
                    }}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 text-dark dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('hr.numberOfDays')}</label>
                <input type="number" min="0.5" step="0.5" value={reqForm.days} onChange={e => setReqForm(f => ({ ...f, days: e.target.value }))}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 text-dark dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('hr.reason')}</label>
                <textarea value={reqForm.reason} onChange={e => setReqForm(f => ({ ...f, reason: e.target.value }))} rows={2}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 text-dark dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand resize-none" />
              </div>
            </div>
            <div className="flex gap-3 p-6 pt-0">
              <button onClick={() => setShowRequestForm(false)} className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700">{t('common.cancel')}</button>
              <button onClick={saveRequest} disabled={saving} className="flex-1 px-4 py-2.5 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand/90 disabled:opacity-50">{saving ? t('cashClose.saving') : t('common.save')}</button>
            </div>
          </div>
        </div>
      )}

      {/* New Leave Type Form Modal */}
      {showTypeForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-semibold text-dark dark:text-slate-100">{t('hr.newLeaveType')}</h2>
              <button onClick={() => setShowTypeForm(false)}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('hr.leaveTypeName')} *</label>
                <input value={typeForm.name} onChange={e => setTypeForm(f => ({ ...f, name: e.target.value }))}
                  placeholder={t('hr.leaveTypePlaceholder')}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 text-dark dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('hr.maxDays')} <span className="text-slate-400 font-normal">({t('hr.zeroUnlimited')})</span></label>
                <input type="number" min="0" value={typeForm.maxDays} onChange={e => setTypeForm(f => ({ ...f, maxDays: e.target.value }))}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 text-dark dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={typeForm.isPaid} onChange={e => setTypeForm(f => ({ ...f, isPaid: e.target.checked }))} className="rounded" />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('hr.paidLeave')}</span>
              </label>
            </div>
            <div className="flex gap-3 p-6 pt-0">
              <button onClick={() => setShowTypeForm(false)} className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700">{t('common.cancel')}</button>
              <button onClick={saveLeaveType} disabled={saving} className="flex-1 px-4 py-2.5 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand/90 disabled:opacity-50">{saving ? t('cashClose.saving') : t('common.save')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
