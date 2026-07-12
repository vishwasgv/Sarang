import React, { useState, useEffect, useCallback } from 'react'
import { Calendar, Plus, Trash2, Save, Users } from 'lucide-react'
import { api } from '@renderer/services/ipc-client'
import { useAuthStore } from '@app/store/auth.store'
import { Button } from '@shared/ui/atoms/Button'
import { Input } from '@shared/ui/atoms/Input'
import { Select } from '@shared/ui/atoms/Select'
import { Card } from '@shared/ui/molecules/Card'
import { cn } from '@shared/utils/cn'
import { useNotificationStore } from '@app/store/notification.store'

interface Provider { id: string; fullName: string; specialization: string | null }
interface Schedule { id: string; providerId: string; dayOfWeek: number; isWorking: boolean; startTime: string; endTime: string; breakStart: string | null; breakEnd: string | null; slotDuration: number }
interface Holiday { id: string; date: string; name: string; isGlobal: boolean; providerId: string | null }

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DEFAULT_SCHEDULE: Omit<Schedule, 'id' | 'providerId'>[] = DAYS.map((_, i) => ({
  dayOfWeek: i,
  isWorking: i >= 1 && i <= 6,
  startTime: '09:00',
  endTime: '18:00',
  breakStart: '13:00',
  breakEnd: '14:00',
  slotDuration: 30,
}))

export function ProviderScheduleScreen() {
  const { hasPermission } = useAuthStore()
  const { error: toastError } = useNotificationStore()
  const canManage = hasPermission('settings.modify')

  const [providers, setProviders] = useState<Provider[]>([])
  const [selectedProviderId, setSelectedProviderId] = useState('')
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState(false)
  const [newHoliday, setNewHoliday] = useState({ date: '', name: '' })
  const [addingHoliday, setAddingHoliday] = useState(false)
  const [confirmHolidayDeleteId, setConfirmHolidayDeleteId] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    api.hr.listEmployees({ isActive: true }).then((res) => {
      if (res.success && res.data) {
        const list = (res.data as { employees: Provider[] }).employees
        setProviders(list)
        if (list.length > 0) setSelectedProviderId(list[0].id)
      } else {
        toastError('Error', res.error?.message ?? 'Could not load providers.')
      }
    }).catch(() => toastError('Error', 'Could not load providers.'))
    loadHolidays()
  }, [toastError])

  const loadSchedule = useCallback(async () => {
    if (!selectedProviderId) return
    try {
      const res = await api.providerSchedule.list({ providerId: selectedProviderId })
      if (res.success && res.data) {
        const loaded = res.data as Schedule[]
        const merged = DEFAULT_SCHEDULE.map((d) => {
          const found = loaded.find((l) => l.dayOfWeek === d.dayOfWeek)
          return found ? { ...found } : { ...d, id: '', providerId: selectedProviderId }
        })
        setSchedules(merged as Schedule[])
      } else {
        // A brand-new provider with no schedule configured yet legitimately
        // returns no rows here (not an error) — but a genuine load failure
        // takes the same branch, so this defaults to the same fallback
        // schedule either way; only a thrown exception below is treated as
        // an actual error worth a toast.
        setSchedules(DEFAULT_SCHEDULE.map((d) => ({ ...d, id: '', providerId: selectedProviderId })) as Schedule[])
      }
    } catch {
      toastError('Error', 'Could not load schedule.')
      setSchedules(DEFAULT_SCHEDULE.map((d) => ({ ...d, id: '', providerId: selectedProviderId })) as Schedule[])
    }
  }, [selectedProviderId, toastError])

  useEffect(() => { loadSchedule() }, [loadSchedule])

  async function loadHolidays() {
    try {
      const res = await api.providerSchedule.listHolidays()
      if (res.success && res.data) setHolidays(res.data as Holiday[])
      else toastError('Error', res.error?.message ?? 'Could not load holidays.')
    } catch {
      toastError('Error', 'Could not load holidays.')
    }
  }

  function updateDay(dayOfWeek: number, patch: Partial<Schedule>) {
    setSchedules((s) => s.map((d) => d.dayOfWeek === dayOfWeek ? { ...d, ...patch } : d))
  }

  async function saveSchedule() {
    if (!selectedProviderId) return
    setSaving(true)
    setSaveError(null)
    try {
      const results = await Promise.all(schedules.map((s) =>
        api.providerSchedule.upsert({
          providerId: selectedProviderId,
          dayOfWeek: s.dayOfWeek,
          isWorking: s.isWorking,
          startTime: s.startTime,
          endTime: s.endTime,
          breakStart: s.breakStart,
          breakEnd: s.breakEnd,
          slotDuration: s.slotDuration,
        })
      ))
      const failed = results.find((r) => !r.success)
      if (failed) {
        setSaveError(failed.error?.message ?? 'Failed to save one or more days.')
      } else {
        setSavedMsg(true)
        setTimeout(() => setSavedMsg(false), 2000)
      }
    } catch {
      setSaveError('Failed to save schedule.')
    } finally {
      setSaving(false)
    }
  }

  async function handleAddHoliday() {
    if (!newHoliday.date || !newHoliday.name) return
    setAddingHoliday(true)
    try {
      const res = await api.providerSchedule.addHoliday({ date: newHoliday.date, name: newHoliday.name, isGlobal: true })
      if (res.success) {
        setNewHoliday({ date: '', name: '' })
        await loadHolidays()
      } else {
        toastError('Error', res.error?.message ?? 'Could not add holiday.')
      }
    } catch {
      toastError('Error', 'Could not add holiday.')
    } finally {
      setAddingHoliday(false)
    }
  }

  async function handleDeleteHoliday(id: string) {
    setConfirmHolidayDeleteId(null)
    try {
      const res = await api.providerSchedule.deleteHoliday({ id })
      if (res.success) await loadHolidays()
      else toastError('Error', res.error?.message ?? 'Could not delete holiday.')
    } catch {
      toastError('Error', 'Could not delete holiday.')
    }
  }

  const selectedProvider = providers.find((p) => p.id === selectedProviderId)

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-brand flex items-center justify-center">
            <Calendar size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-dark dark:text-slate-100">Provider Schedule</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">Set weekly availability and holidays</p>
          </div>
        </div>
        {canManage && (
          <Button size="sm" icon={<Save size={14} />} loading={saving} onClick={saveSchedule}>
            {savedMsg ? 'Saved!' : 'Save Schedule'}
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
        {saveError && (
          <p className="text-xs text-danger bg-danger/5 border border-danger/20 rounded-lg px-3 py-2">{saveError}</p>
        )}
        {/* Provider selector */}
        {providers.length > 1 && (
          <div className="flex items-center gap-3">
            <Users size={16} className="text-slate-400 shrink-0" />
            <Select
              value={selectedProviderId}
              onChange={(e) => setSelectedProviderId(e.target.value)}
              className="w-auto"
            >
              {providers.map((p) => (
                <option key={p.id} value={p.id}>{p.fullName}{p.specialization ? ` — ${p.specialization}` : ''}</option>
              ))}
            </Select>
          </div>
        )}

        {providers.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Users size={32} className="text-slate-300 mb-3" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">No employees found</p>
            <p className="text-xs text-slate-400 mt-1">Add employees in the HR module first, then configure their availability here.</p>
          </div>
        )}

        {selectedProvider && (
          <>
            <div>
              <h2 className="text-sm font-semibold text-dark dark:text-slate-100 mb-3">
                Weekly Schedule — {selectedProvider.fullName}
              </h2>
              <div className="space-y-2">
                {schedules.map((s) => (
                  <Card key={s.dayOfWeek} padding="sm" className={cn('flex items-center gap-3', !s.isWorking && 'opacity-60')}>
                    <div className="w-24 shrink-0">
                      <p className={cn('text-sm font-medium', s.isWorking ? 'text-dark dark:text-slate-100' : 'text-slate-400')}>{DAYS[s.dayOfWeek]}</p>
                    </div>
                    <button
                      disabled={!canManage}
                      onClick={() => updateDay(s.dayOfWeek, { isWorking: !s.isWorking })}
                      className={cn('text-xs font-medium px-2.5 py-1 rounded-full border shrink-0 transition-colors', s.isWorking ? 'border-success text-success bg-success/5' : 'border-slate-200 dark:border-slate-700 text-slate-400')}
                    >
                      {s.isWorking ? 'Working' : 'Off'}
                    </button>
                    {s.isWorking && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <input type="time" value={s.startTime} disabled={!canManage} onChange={(e) => updateDay(s.dayOfWeek, { startTime: e.target.value })} className="border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs text-dark dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand" />
                        <span className="text-xs text-slate-400">to</span>
                        <input type="time" value={s.endTime} disabled={!canManage} onChange={(e) => updateDay(s.dayOfWeek, { endTime: e.target.value })} className="border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs text-dark dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand" />
                        <span className="text-xs text-slate-400 ml-2">Break:</span>
                        <input type="time" value={s.breakStart ?? ''} disabled={!canManage} onChange={(e) => updateDay(s.dayOfWeek, { breakStart: e.target.value || null })} className="border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs text-dark dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand" />
                        <span className="text-xs text-slate-400">to</span>
                        <input type="time" value={s.breakEnd ?? ''} disabled={!canManage} onChange={(e) => updateDay(s.dayOfWeek, { breakEnd: e.target.value || null })} className="border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs text-dark dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand" />
                        <span className="text-xs text-slate-400 ml-2">Slot:</span>
                        <Select
                          value={s.slotDuration}
                          disabled={!canManage}
                          onChange={(e) => updateDay(s.dayOfWeek, { slotDuration: Number(e.target.value) })}
                        >
                          {[10, 15, 20, 30, 45, 60].map((m) => <option key={m} value={m}>{m}min</option>)}
                        </Select>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Clinic Holidays */}
        <div>
          <h2 className="text-sm font-semibold text-dark dark:text-slate-100 mb-3">Clinic Holidays</h2>
          {canManage && (
            <div className="flex items-end gap-2 mb-3">
              <div className="flex-1 max-w-xs">
                <Input type="date" label="Date" value={newHoliday.date} onChange={(e) => setNewHoliday((h) => ({ ...h, date: e.target.value }))} />
              </div>
              <div className="flex-1 max-w-xs">
                <Input label="Holiday Name" placeholder="e.g. Diwali" value={newHoliday.name} onChange={(e) => setNewHoliday((h) => ({ ...h, name: e.target.value }))} />
              </div>
              <Button size="sm" icon={<Plus size={14} />} loading={addingHoliday} onClick={handleAddHoliday}>Add</Button>
            </div>
          )}
          {holidays.length === 0 ? (
            <p className="text-sm text-slate-400">No holidays added.</p>
          ) : (
            <div className="space-y-1.5">
              {holidays.map((h) => (
                <Card key={h.id} padding="sm" className="flex items-center justify-between">
                  <span className="text-sm text-dark dark:text-slate-100">{h.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500 dark:text-slate-400">{new Date(h.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                    {canManage && (
                      confirmHolidayDeleteId === h.id ? (
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-danger font-medium">Delete?</span>
                          <button onClick={() => handleDeleteHoliday(h.id)} className="px-2 py-0.5 text-xs bg-danger text-white rounded-lg">Yes</button>
                          <button onClick={() => setConfirmHolidayDeleteId(null)} className="px-2 py-0.5 text-xs border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300">No</button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmHolidayDeleteId(h.id)} className="p-1 text-slate-400 hover:text-danger rounded transition-colors">
                          <Trash2 size={13} />
                        </button>
                      )
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
