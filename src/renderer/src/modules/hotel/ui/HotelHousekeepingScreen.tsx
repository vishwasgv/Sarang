import { useState, useEffect, useCallback } from 'react'
import { Sparkles } from 'lucide-react'
import { api } from '@renderer/services/ipc-client'
import { Card } from '@shared/ui/molecules/Card'
import { Button } from '@shared/ui/atoms/Button'
import { useAuthStore } from '@app/store/auth.store'
import { useNotificationStore } from '@app/store/notification.store'

// Hotel/Lodge is a languageLock: 'en' business type — see HotelRoomsScreen.tsx's
// header comment for the full reasoning; plain English strings here are not a
// missing-i18n gap.

interface HousekeepingTask {
  id: string; roomId: string; roomNumber: string; bookingId: string | null
  taskLabel: string; status: 'PENDING' | 'IN_PROGRESS' | 'DONE'
  assignedToId: string | null; assignedToName: string | null
  notes: string | null; createdAt: string
}
interface Employee { id: string; fullName: string }

const STATUS_FILTERS = ['', 'PENDING', 'IN_PROGRESS', 'DONE']

export function HotelHousekeepingScreen() {
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const { error: toastError, success: toastSuccess } = useNotificationStore()
  const canManage = hasPermission('hotel.manage')

  const [tasks, setTasks] = useState<HousekeepingTask[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.hotel.listHousekeepingTasks(statusFilter ? { status: statusFilter } : undefined)
      if (res.success && res.data) setTasks((res.data as { tasks: HousekeepingTask[] }).tasks)
      else toastError('Error', res.error?.message ?? 'Could not load housekeeping tasks.')
    } catch {
      toastError('Error', 'Could not load housekeeping tasks.')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, toastError])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    api.hr.listEmployees({ isActive: true }).then((res) => {
      if (res.success && res.data) setEmployees((res.data as { employees: Employee[] }).employees ?? [])
    }).catch(() => { /* assignee picker is supplementary — the task list itself already surfaces errors */ })
  }, [])

  async function handleAssign(taskId: string, assignedToId: string) {
    const res = await api.hotel.assignHousekeepingTask({ id: taskId, assignedToId: assignedToId || null })
    if (res.success) await load()
    else toastError('Error', res.error?.message ?? 'Could not assign task.')
  }

  async function handleStatus(taskId: string, status: 'PENDING' | 'IN_PROGRESS' | 'DONE') {
    const res = await api.hotel.updateHousekeepingTaskStatus({ id: taskId, status })
    if (res.success) {
      if (status === 'DONE') toastSuccess('Task completed', '')
      await load()
    } else {
      toastError('Error', res.error?.message ?? 'Could not update task.')
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-dark dark:text-slate-100">Housekeeping</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Room turnover tasks, queued automatically at checkout</p>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {STATUS_FILTERS.map((s) => (
          <button key={s || 'all'} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${statusFilter === s ? 'bg-brand text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>
            {s ? s.replace(/_/g, ' ') : 'All'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><div className="w-7 h-7 border-2 border-brand border-t-transparent rounded-full animate-spin" /></div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-12">
          <Sparkles size={36} className="mx-auto text-slate-300 mb-2" />
          <p className="text-slate-500 dark:text-slate-400">No housekeeping tasks{statusFilter ? ` with status ${statusFilter.replace(/_/g, ' ').toLowerCase()}` : ''}.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tasks.map((task) => (
            <Card key={task.id} className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-dark dark:text-slate-100">Room {task.roomNumber}</p>
                <span className={`text-xs font-semibold rounded-full px-2.5 py-0.5 ${task.status === 'DONE' ? 'bg-success/10 text-success' : task.status === 'IN_PROGRESS' ? 'bg-brand/10 text-brand' : 'bg-warning/10 text-warning'}`}>
                  {task.status.replace(/_/g, ' ')}
                </span>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300">{task.taskLabel}</p>

              {canManage && employees.length > 0 && (
                <select value={task.assignedToId ?? ''} onChange={(e) => handleAssign(task.id, e.target.value)}
                  title="Assign housekeeping staff" className="w-full text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5">
                  <option value="">— Unassigned —</option>
                  {employees.map((e) => <option key={e.id} value={e.id}>{e.fullName}</option>)}
                </select>
              )}
              {!canManage && task.assignedToName && (
                <p className="text-xs text-slate-400">Assigned: {task.assignedToName}</p>
              )}

              {canManage && task.status !== 'DONE' && (
                <div className="flex gap-2">
                  {task.status === 'PENDING' && (
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => handleStatus(task.id, 'IN_PROGRESS')}>Start</Button>
                  )}
                  <Button size="sm" className="flex-1" onClick={() => handleStatus(task.id, 'DONE')}>Mark Done</Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
