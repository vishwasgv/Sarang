import React, { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Route, Plus, ChevronDown, ChevronUp, Trash2, ArrowUp, ArrowDown, UserPlus } from 'lucide-react'
import { api } from '@renderer/services/ipc-client'
import { useNotificationStore } from '@app/store/notification.store'
import { Card } from '@shared/ui/molecules/Card'
import { Badge } from '@shared/ui/atoms/Badge'
import { ConfirmDialog } from '@shared/ui/molecules/ConfirmDialog'

// Phase 67 §9.1 — Distributor item 2: Beat-Plan Route Sequencing. A field
// rep's set visiting order per day/route — a genuinely new DistributorBeat/
// DistributorBeatStop pair (NOT a reuse of Shipment/ShipmentStop, which is a
// delivery-vehicle freight route, semantically unrelated despite the naming
// overlap — see distributor-beat.service.ts's own comment). Mirrors
// FieldOrdersScreen.tsx's structure for this same vertical.

interface BeatStop { id: string; customerId: string; customerName: string; sequenceOrder: number }
interface Beat { id: string; name: string; repName: string; dayOfWeek: number | null; isActive: boolean; stops: BeatStop[] }
interface CustomerOption { id: string; customerName: string }

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

export function BeatPlansScreen() {
  const { t } = useTranslation()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const [beats, setBeats] = useState<Beat[]>([])
  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [addCustomerId, setAddCustomerId] = useState<Record<string, string>>({})

  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState({ name: '', repName: '', dayOfWeek: '' as string })
  const [submitting, setSubmitting] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<Beat | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await api.distributor.listBeats()
      if (res.success && res.data) setBeats(res.data as Beat[])
      else toastError(t('distributor.beats.error'), res.error?.message ?? t('distributor.beats.couldNotLoad'))
    } catch {
      toastError(t('distributor.beats.error'), t('distributor.beats.couldNotLoad'))
    } finally {
      setLoading(false)
    }
  }, [toastError, t])

  const loadCustomers = useCallback(async () => {
    try {
      const res = await api.customers.list({ limit: 500 })
      if (res.success && res.data) setCustomers((res.data as { customers: CustomerOption[] }).customers ?? [])
    } catch {
      // customer picker failing to populate must not block the beat list above
    }
  }, [])

  useEffect(() => { load(); loadCustomers() }, [load, loadCustomers])

  async function handleCreate() {
    if (!form.name.trim() || !form.repName.trim()) return
    setSubmitting(true)
    try {
      const res = await api.distributor.createBeat({
        name: form.name.trim(), repName: form.repName.trim(),
        dayOfWeek: form.dayOfWeek === '' ? null : Number(form.dayOfWeek)
      })
      if (res.success) {
        setCreateOpen(false)
        setForm({ name: '', repName: '', dayOfWeek: '' })
        toastSuccess(t('distributor.beats.created'), '')
        load()
      } else {
        toastError(t('distributor.beats.error'), res.error?.message ?? t('distributor.beats.couldNotCreate'))
      }
    } catch {
      toastError(t('distributor.beats.error'), t('distributor.beats.couldNotCreate'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await api.distributor.deleteBeat({ id: deleteTarget.id })
      if (res.success) {
        toastSuccess(t('distributor.beats.deleted'), '')
        setDeleteTarget(null)
        load()
      } else {
        toastError(t('distributor.beats.error'), res.error?.message ?? t('distributor.beats.couldNotDelete'))
      }
    } catch {
      toastError(t('distributor.beats.error'), t('distributor.beats.couldNotDelete'))
    } finally {
      setDeleting(false)
    }
  }

  async function handleAddStop(beatId: string) {
    const customerId = addCustomerId[beatId]
    if (!customerId) return
    try {
      const res = await api.distributor.addBeatStop({ beatId, customerId })
      if (res.success) {
        setAddCustomerId((s) => ({ ...s, [beatId]: '' }))
        load()
      } else {
        toastError(t('distributor.beats.error'), res.error?.message ?? t('distributor.beats.couldNotAddStop'))
      }
    } catch {
      toastError(t('distributor.beats.error'), t('distributor.beats.couldNotAddStop'))
    }
  }

  async function handleRemoveStop(id: string) {
    try {
      const res = await api.distributor.removeBeatStop({ id })
      if (!res.success) toastError(t('distributor.beats.error'), res.error?.message ?? t('distributor.beats.couldNotRemoveStop'))
    } catch {
      toastError(t('distributor.beats.error'), t('distributor.beats.couldNotRemoveStop'))
    } finally {
      load()
    }
  }

  async function handleMoveStop(id: string, direction: 'UP' | 'DOWN') {
    try {
      const res = await api.distributor.moveBeatStop({ id, direction })
      if (!res.success) toastError(t('distributor.beats.error'), res.error?.message ?? t('distributor.beats.couldNotMoveStop'))
    } catch {
      toastError(t('distributor.beats.error'), t('distributor.beats.couldNotMoveStop'))
    } finally {
      load()
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-dark dark:text-slate-100 flex items-center gap-2">
            <Route size={18} /> {t('distributor.beats.title')}
          </h2>
          <p className="text-sm text-slate-400">{t('distributor.beats.subtitle')}</p>
        </div>
        <button onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand/90 transition-colors">
          <Plus size={15} /> {t('distributor.beats.newBeat')}
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">{t('distributor.beats.loading')}</p>
      ) : beats.length === 0 ? (
        <Card padding="lg"><p className="text-sm text-slate-400 text-center">{t('distributor.beats.empty')}</p></Card>
      ) : (
        <div className="space-y-3">
          {beats.map((beat) => {
            const expanded = expandedId === beat.id
            const usedIds = new Set(beat.stops.map((s) => s.customerId))
            const available = customers.filter((c) => !usedIds.has(c.id))
            return (
              <Card key={beat.id} padding="lg" className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <button className="flex items-start gap-2 text-left min-w-0" onClick={() => setExpandedId(expanded ? null : beat.id)}>
                    {expanded ? <ChevronUp size={16} className="mt-0.5 shrink-0 text-slate-400" /> : <ChevronDown size={16} className="mt-0.5 shrink-0 text-slate-400" />}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-dark dark:text-slate-100">{beat.name}</p>
                      <p className="text-xs text-slate-400">
                        {beat.repName}
                        {beat.dayOfWeek !== null && ` · ${t(`distributor.beats.day.${DAY_KEYS[beat.dayOfWeek]}`)}`}
                        {' · '}{t('distributor.beats.stopCount', { count: beat.stops.length })}
                      </p>
                    </div>
                  </button>
                  <div className="flex items-center gap-2 shrink-0">
                    {!beat.isActive && <Badge variant="neutral" size="sm">{t('distributor.beats.inactive')}</Badge>}
                    <button onClick={() => setDeleteTarget(beat)} className="text-slate-400 hover:text-danger transition-colors p-1">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {expanded && (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                    {beat.stops.length === 0 ? (
                      <p className="text-xs text-slate-400">{t('distributor.beats.noStops')}</p>
                    ) : (
                      <ol className="space-y-1.5">
                        {beat.stops.map((stop, idx) => (
                          <li key={stop.id} className="flex items-center gap-2 text-sm">
                            <span className="w-5 text-xs text-slate-400 text-right shrink-0">{idx + 1}.</span>
                            <span className="flex-1 text-dark dark:text-slate-100">{stop.customerName}</span>
                            <button onClick={() => handleMoveStop(stop.id, 'UP')} disabled={idx === 0}
                              className="text-slate-400 hover:text-brand transition-colors disabled:opacity-25 disabled:hover:text-slate-400">
                              <ArrowUp size={14} />
                            </button>
                            <button onClick={() => handleMoveStop(stop.id, 'DOWN')} disabled={idx === beat.stops.length - 1}
                              className="text-slate-400 hover:text-brand transition-colors disabled:opacity-25 disabled:hover:text-slate-400">
                              <ArrowDown size={14} />
                            </button>
                            <button onClick={() => handleRemoveStop(stop.id)} className="text-slate-400 hover:text-danger transition-colors">
                              <Trash2 size={13} />
                            </button>
                          </li>
                        ))}
                      </ol>
                    )}
                    <div className="flex items-center gap-2 pt-1">
                      <select value={addCustomerId[beat.id] ?? ''} onChange={(e) => setAddCustomerId((s) => ({ ...s, [beat.id]: e.target.value }))}
                        className="flex-1 px-2.5 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-brand bg-white dark:bg-slate-900">
                        <option value="">{t('distributor.beats.selectCustomer')}</option>
                        {available.map((c) => <option key={c.id} value={c.id}>{c.customerName}</option>)}
                      </select>
                      <button onClick={() => handleAddStop(beat.id)} disabled={!addCustomerId[beat.id]}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 hover:border-brand hover:text-brand transition-colors disabled:opacity-40">
                        <UserPlus size={13} /> {t('distributor.beats.addStop')}
                      </button>
                    </div>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {createOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-lg font-bold text-dark dark:text-slate-100">{t('distributor.beats.newBeat')}</h2>
            <div>
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t('distributor.beats.beatName')}</label>
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full mt-1 px-3 py-2.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-brand bg-white dark:bg-slate-900" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t('distributor.beats.repName')}</label>
              <input value={form.repName} onChange={(e) => setForm((f) => ({ ...f, repName: e.target.value }))}
                className="w-full mt-1 px-3 py-2.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-brand bg-white dark:bg-slate-900" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t('distributor.beats.dayOfWeek')}</label>
              <select value={form.dayOfWeek} onChange={(e) => setForm((f) => ({ ...f, dayOfWeek: e.target.value }))}
                className="w-full mt-1 px-3 py-2.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-brand bg-white dark:bg-slate-900">
                <option value="">{t('distributor.beats.anyDay')}</option>
                {DAY_KEYS.map((k, idx) => <option key={k} value={idx}>{t(`distributor.beats.day.${k}`)}</option>)}
              </select>
            </div>
            <div className="flex gap-3">
              <button onClick={handleCreate} disabled={submitting || !form.name.trim() || !form.repName.trim()}
                className="flex-1 px-4 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand/90 transition-colors disabled:opacity-50">
                {submitting ? t('distributor.beats.creating') : t('common.create')}
              </button>
              <button onClick={() => setCreateOpen(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-300 hover:border-slate-300 transition-colors">
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title={t('distributor.beats.deleteTitle')}
        message={t('distributor.beats.deleteConfirm', { name: deleteTarget?.name ?? '' })}
        confirmLabel={t('common.delete')}
      />
    </div>
  )
}
