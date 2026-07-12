import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Stethoscope, Search, Lock, FileText, RefreshCw } from 'lucide-react'
import { api } from '@renderer/services/ipc-client'
import { Input } from '@shared/ui/atoms/Input'
import { Card } from '@shared/ui/molecules/Card'
import { Badge } from '@shared/ui/atoms/Badge'
import { cn } from '@shared/utils/cn'
import { useNotificationStore } from '@app/store/notification.store'

interface NoteItem {
  id: string
  appointmentId: string
  patientName: string
  patientAge: string | null
  chiefComplaint: string | null
  assessment: string | null
  isFinalized: boolean
  createdAt: string
  appointment: {
    id: string
    scheduledDate: string
    scheduledTime: string
    serviceTitle: string
    provider: { id: string; fullName: string } | null
  } | null
}

export function ClinicalNotesListScreen() {
  const navigate = useNavigate()
  const { error: toastError } = useNotificationStore()

  const [notes, setNotes] = useState<NoteItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [filterFinalized, setFilterFinalized] = useState<'ALL' | 'DRAFT' | 'FINAL'>('ALL')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const payload: Record<string, unknown> = { limit: 50 }
      if (search.trim()) payload.search = search.trim()
      if (filterFinalized === 'DRAFT') payload.isFinalized = false
      if (filterFinalized === 'FINAL') payload.isFinalized = true
      const res = await api.visitNotes.list(payload)
      if (res.success && res.data) {
        const d = res.data as { items: NoteItem[]; total: number }
        setNotes(d.items)
        setTotal(d.total)
      } else {
        toastError('Error', res.error?.message ?? 'Could not load clinical notes.')
      }
    } catch {
      toastError('Error', 'Could not load clinical notes.')
    } finally {
      setLoading(false)
    }
  }, [search, filterFinalized, toastError])

  useEffect(() => {
    const t = setTimeout(() => load(), 200)
    return () => clearTimeout(t)
  }, [load])

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-brand flex items-center justify-center">
            <Stethoscope size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-dark dark:text-slate-100">Clinical Notes</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">{total} consultation note{total !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <button onClick={load} className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Filters */}
      <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-3 shrink-0">
        <div className="flex gap-1">
          {(['ALL', 'DRAFT', 'FINAL'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilterFinalized(f)}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded-full border transition-colors',
                filterFinalized === f ? 'border-brand text-brand bg-brand/5' : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300'
              )}
            >
              {f === 'ALL' ? 'All' : f === 'DRAFT' ? 'In Progress' : 'Finalized'}
            </button>
          ))}
        </div>
        <div className="flex-1 max-w-xs">
          <Input
            placeholder="Search patient name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading && notes.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          </div>
        ) : notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileText size={32} className="text-slate-300 mb-3" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">No clinical notes found</p>
            <p className="text-xs text-slate-400 mt-1">Notes are created from the Appointments screen.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notes.map((note) => (
              <motion.div
                key={note.id}
                initial={{ opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card
                  padding="md"
                  onClick={() => navigate(`/clinical/visit/${note.appointmentId}`)}
                  className="flex items-start gap-4 hover:border-brand/30 hover:bg-brand/5 cursor-pointer transition-colors"
                >
                {/* Status icon */}
                <div className={cn(
                  'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
                  note.isFinalized ? 'bg-success/10' : 'bg-warning/10'
                )}>
                  {note.isFinalized
                    ? <Lock size={16} className="text-success" />
                    : <FileText size={16} className="text-warning" />
                  }
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-dark dark:text-slate-100 truncate">{note.patientName}</p>
                    {note.patientAge && <span className="text-xs text-slate-400">{note.patientAge}</span>}
                    <Badge variant={note.isFinalized ? 'success' : 'warning'} size="sm" className="ml-auto shrink-0">
                      {note.isFinalized ? 'Finalized' : 'In Progress'}
                    </Badge>
                  </div>
                  {note.chiefComplaint && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">CC: {note.chiefComplaint}</p>}
                  {note.assessment    && <p className="text-xs text-slate-400 mt-0.5 truncate">Dx: {note.assessment}</p>}
                  <div className="flex items-center gap-3 mt-1.5">
                    {note.appointment && (
                      <>
                        <span className="text-[10px] text-slate-400">
                          {new Date(note.appointment.scheduledDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} @ {note.appointment.scheduledTime}
                        </span>
                        {note.appointment.provider && (
                          <span className="text-[10px] text-slate-400">{note.appointment.provider.fullName}</span>
                        )}
                      </>
                    )}
                  </div>
                </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
