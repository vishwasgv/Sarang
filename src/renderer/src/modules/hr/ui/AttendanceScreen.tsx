import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, Save, Users } from 'lucide-react'
import { api } from '@renderer/services/ipc-client'
import { useNotificationStore } from '@app/store/notification.store'
import { Card } from '@shared/ui/molecules/Card'
import { Badge } from '@shared/ui/atoms/Badge'
import { Tabs } from '@shared/ui/molecules/Tabs'

interface Employee {
  id: string
  fullName: string
  department: string | null
  designation: string | null
}

interface AttendanceRecord {
  id: string
  employeeId: string
  date: string
  status: string
  checkIn: string | null
  checkOut: string | null
  notes: string | null
}

const STATUSES = ['PRESENT', 'ABSENT', 'HALF_DAY', 'LEAVE', 'HOLIDAY', 'WEEK_OFF']

const STATUS_STYLE: Record<string, string> = {
  PRESENT:  'bg-green-100 text-green-700 border-green-200',
  ABSENT:   'bg-red-100 text-red-600 border-red-200',
  HALF_DAY: 'bg-amber-100 text-amber-700 border-amber-200',
  LEAVE:    'bg-blue-100 text-blue-700 border-blue-200',
  HOLIDAY:  'bg-purple-100 text-purple-700 border-purple-200',
  WEEK_OFF: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
}

const STATUS_KEY: Record<string, string> = {
  PRESENT:  'hr.attPresent',
  ABSENT:   'hr.attAbsent',
  HALF_DAY: 'hr.attHalfDay',
  LEAVE:    'hr.attLeave',
  HOLIDAY:  'hr.attHoliday',
  WEEK_OFF: 'hr.attWeekOff'
}

const STATUS_VARIANT: Record<string, 'success' | 'danger' | 'warning' | 'info' | 'brand' | 'neutral'> = {
  PRESENT:  'success',
  ABSENT:   'danger',
  HALF_DAY: 'warning',
  LEAVE:    'info',
  HOLIDAY:  'brand',
  WEEK_OFF: 'neutral'
}

export function AttendanceScreen() {
  const { t } = useTranslation()
  const today = new Date()
  const [selectedDate, setSelectedDate] = useState(today.toISOString().split('T')[0])
  const [viewMonth, setViewMonth] = useState({ year: today.getFullYear(), month: today.getMonth() + 1 })
  const [mode, setMode] = useState<'daily' | 'monthly'>('daily')

  const [employees, setEmployees] = useState<Employee[]>([])
  const [attendance, setAttendance] = useState<Record<string, string>>({}) // employeeId → status
  const [monthRecords, setMonthRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { success: toastSuccess, error: toastError } = useNotificationStore()

  const loadEmployees = useCallback(async () => {
    try {
      const res = await api.hr.listEmployees({ isActive: true })
      if (res.success && res.data) {
        setEmployees((res.data as any).employees)
      } else {
        toastError(res.error?.message ?? t('hr.actionFailed'))
      }
    } catch {
      toastError(t('hr.actionFailed'))
    }
  }, [toastError, t])

  const loadDayAttendance = useCallback(async () => {
    setLoading(true)
    try {
      const [year, month, day] = selectedDate.split('-').map(Number)
      const res = await api.hr.getMonthAttendance({ year, month })
      if (res.success && res.data) {
        const map: Record<string, string> = {}
        for (const r of (res.data as any).records) {
          const d = new Date(r.date)
          if (d.getUTCDate() === day) map[r.employeeId] = r.status
        }
        setAttendance(map)
      } else {
        toastError(res.error?.message ?? t('hr.actionFailed'))
      }
    } catch {
      toastError(t('hr.actionFailed'))
    } finally {
      setLoading(false)
    }
  }, [selectedDate, toastError, t])

  const loadMonthRecords = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.hr.getMonthAttendance({ year: viewMonth.year, month: viewMonth.month })
      if (res.success && res.data) {
        setMonthRecords((res.data as any).records)
      } else {
        toastError(res.error?.message ?? t('hr.actionFailed'))
      }
    } catch {
      toastError(t('hr.actionFailed'))
    } finally {
      setLoading(false)
    }
  }, [viewMonth, toastError, t])

  useEffect(() => { loadEmployees() }, [loadEmployees])
  useEffect(() => {
    if (mode === 'daily') loadDayAttendance()
    else loadMonthRecords()
  }, [mode, loadDayAttendance, loadMonthRecords])

  function setStatus(empId: string, status: string) {
    setAttendance(prev => ({ ...prev, [empId]: status }))
  }

  async function saveDailyAttendance() {
    if (employees.length === 0) return
    setSaving(true)
    try {
      const records = employees.map(e => ({ employeeId: e.id, status: attendance[e.id] ?? 'PRESENT' }))
      const res = await api.hr.bulkMarkAttendance({ date: selectedDate, records })
      if (res.success) {
        toastSuccess(t('hr.attendanceSaved'))
      } else {
        toastError(res.error?.message ?? t('hr.saveFailed'))
      }
    } catch {
      toastError(t('hr.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  function prevMonth() {
    setViewMonth(prev => {
      if (prev.month === 1) return { year: prev.year - 1, month: 12 }
      return { ...prev, month: prev.month - 1 }
    })
  }
  function nextMonth() {
    setViewMonth(prev => {
      if (prev.month === 12) return { year: prev.year + 1, month: 1 }
      return { ...prev, month: prev.month + 1 }
    })
  }

  const monthName = new Date(viewMonth.year, viewMonth.month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })
  const daysInMonth = new Date(viewMonth.year, viewMonth.month, 0).getDate()

  // Build attendance map for month view: empId → dayNum → status
  // Use getUTCDate() because records are stored as UTC midnight
  const monthMap: Record<string, Record<number, string>> = {}
  for (const r of monthRecords) {
    const d = new Date(r.date).getUTCDate()
    if (!monthMap[r.employeeId]) monthMap[r.employeeId] = {}
    monthMap[r.employeeId][d] = r.status
  }

  const statusShort: Record<string, string> = {
    PRESENT: 'P', ABSENT: 'A', HALF_DAY: 'H', LEAVE: 'L', HOLIDAY: 'Ho', WEEK_OFF: 'W'
  }

  const statusShortStyle: Record<string, string> = {
    PRESENT: 'bg-green-100 text-green-700', ABSENT: 'bg-red-100 text-red-600',
    HALF_DAY: 'bg-amber-100 text-amber-700', LEAVE: 'bg-blue-100 text-blue-700',
    HOLIDAY: 'bg-purple-100 text-purple-700', WEEK_OFF: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark dark:text-slate-100">{t('hr.attendance')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{t('hr.attendanceDesc')}</p>
        </div>
        <Tabs
          tabs={[
            { id: 'daily', label: t('hr.daily') },
            { id: 'monthly', label: t('hr.monthly') }
          ]}
          active={mode}
          onChange={setMode}
        />
      </div>

      {/* Daily Mode */}
      {mode === 'daily' && (
        <>
          <div className="flex items-center gap-4">
            <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
              className="px-3 py-2 bg-white dark:bg-slate-800 text-dark dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
            <div className="flex-1" />
            <button onClick={saveDailyAttendance} disabled={saving || employees.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand/90 disabled:opacity-50 transition-colors">
              <Save size={16} />{saving ? t('cashClose.saving') : t('hr.saveAttendance')}
            </button>
          </div>

          {/* Shortcut row */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">{t('hr.markAll')}:</span>
            {STATUSES.slice(0, 4).map(s => (
              <button key={s} onClick={() => employees.forEach(e => setStatus(e.id, s))}
                className={`text-xs px-3 py-1 rounded-full border font-medium transition-colors ${STATUS_STYLE[s]}`}>
                {t(STATUS_KEY[s])}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-8"><div className="w-7 h-7 border-2 border-brand border-t-transparent rounded-full animate-spin" /></div>
          ) : employees.length === 0 ? (
            <div className="text-center py-12">
              <Users size={36} className="mx-auto text-slate-300 mb-2" />
              <p className="text-slate-500 dark:text-slate-400">{t('hr.noEmployeesForAttendance')}</p>
            </div>
          ) : (
            <Card padding="none" className="overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-300">{t('hr.employee')}</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-300">{t('hr.statusLabel')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {employees.map(emp => (
                    <tr key={emp.id} className="hover:bg-slate-50 dark:hover:bg-slate-700">
                      <td className="px-4 py-3">
                        <p className="font-medium text-dark dark:text-slate-100">{emp.fullName}</p>
                        {emp.designation && <p className="text-xs text-slate-400">{emp.designation}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 flex-wrap">
                          {STATUSES.map(s => (
                            <button key={s} onClick={() => setStatus(emp.id, s)}
                              className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-all ${(attendance[emp.id] ?? 'PRESENT') === s ? STATUS_STYLE[s] + ' ring-2 ring-offset-1 ring-brand' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                              {t(STATUS_KEY[s])}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </>
      )}

      {/* Monthly Mode */}
      {mode === 'monthly' && (
        <>
          <div className="flex items-center gap-4">
            <button onClick={prevMonth} className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"><ChevronLeft size={16} /></button>
            <span className="font-semibold text-dark dark:text-slate-100">{monthName}</span>
            <button onClick={nextMonth} className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"><ChevronRight size={16} /></button>
          </div>

          {/* Legend */}
          <div className="flex gap-3 flex-wrap">
            {STATUSES.map(s => (
              <Badge key={s} variant={STATUS_VARIANT[s] ?? 'neutral'} size="sm">{statusShort[s]} = {t(STATUS_KEY[s])}</Badge>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-8"><div className="w-7 h-7 border-2 border-brand border-t-transparent rounded-full animate-spin" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="text-xs border-collapse min-w-full">
                <thead>
                  <tr>
                    <th className="text-left px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 min-w-32 font-medium text-slate-600 dark:text-slate-300">{t('hr.employee')}</th>
                    {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => (
                      <th key={d} className="px-1 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center font-medium text-slate-500 dark:text-slate-400 w-8">{d}</th>
                    ))}
                    <th className="px-2 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center font-medium text-slate-600 dark:text-slate-300">{t('hr.present')}</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map(emp => {
                    const empDays = monthMap[emp.id] ?? {}
                    const presentCount = Object.values(empDays).reduce((s, st) => {
                      if (st === 'PRESENT') return s + 1
                      if (st === 'HALF_DAY') return s + 0.5
                      return s
                    }, 0)
                    return (
                      <tr key={emp.id} className="hover:bg-slate-50 dark:hover:bg-slate-700">
                        <td className="px-3 py-2 border border-slate-200 dark:border-slate-700 font-medium text-dark dark:text-slate-100 whitespace-nowrap">{emp.fullName}</td>
                        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => {
                          const st = empDays[d]
                          return (
                            <td key={d} className="border border-slate-100 dark:border-slate-800 text-center p-0.5">
                              {st ? (
                                <span className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs font-bold ${statusShortStyle[st]}`}>
                                  {statusShort[st]}
                                </span>
                              ) : (
                                <span className="text-slate-200">—</span>
                              )}
                            </td>
                          )
                        })}
                        <td className="border border-slate-200 dark:border-slate-700 text-center font-semibold text-dark dark:text-slate-100">{presentCount}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
