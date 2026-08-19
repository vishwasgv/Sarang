import React, { useState, useEffect, useCallback } from 'react'
import { ShieldAlert, Plus, Trash2 } from 'lucide-react'
import { api } from '@renderer/services/ipc-client'
import { useAuthStore } from '@app/store/auth.store'
import { Button } from '@shared/ui/atoms/Button'
import { Input } from '@shared/ui/atoms/Input'
import { Select } from '@shared/ui/atoms/Select'
import { Card } from '@shared/ui/molecules/Card'
import { ConfirmDialog } from '@shared/ui/molecules/ConfirmDialog'
import { useNotificationStore } from '@app/store/notification.store'

interface BreedHealthAlert {
  id: string
  species: string
  breed: string
  alertText: string
}

const SPECIES_OPTIONS = ['Dog', 'Cat', 'Bird', 'Rabbit', 'Reptile', 'Other']

// Phase 67 §9.1 item 18.3 — a clinic-maintained reference list, deliberately
// not pre-seeded with any clinical claims (see schema.prisma's own comment
// on why this app doesn't author veterinary medical content). Mirrors
// NormalRangesScreen.tsx's own shape closely — same "one form, one table,
// clinic maintains its own reference data" pattern, different domain.
export function BreedHealthAlertsScreen() {
  const { hasPermission } = useAuthStore()
  const { error: toastError } = useNotificationStore()
  const canWrite = hasPermission('clinicalNotes.write')

  const [alerts, setAlerts] = useState<BreedHealthAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  const [species, setSpecies] = useState('Dog')
  const [breed, setBreed] = useState('')
  const [alertText, setAlertText] = useState('')

  const [deleteTarget, setDeleteTarget] = useState<BreedHealthAlert | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.breedHealthAlert.list()
      if (res.success) setAlerts((res.data as BreedHealthAlert[]) ?? [])
      else toastError('Error', res.error?.message ?? 'Could not load breed health alerts.')
    } catch {
      toastError('Error', 'Could not load breed health alerts.')
    } finally {
      setLoading(false)
    }
  }, [toastError])

  useEffect(() => { load() }, [load])

  function resetForm(): void {
    setSpecies('Dog'); setBreed(''); setAlertText('')
  }

  async function handleSave(): Promise<void> {
    if (!breed.trim() || !alertText.trim()) return
    setSaving(true)
    try {
      const res = await api.breedHealthAlert.save({ species, breed: breed.trim(), alertText: alertText.trim() })
      if (res.success) { setShowForm(false); resetForm(); load() }
      else toastError('Error', res.error?.message ?? 'Could not save breed health alert.')
    } catch {
      toastError('Error', 'Could not save breed health alert.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(): Promise<void> {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await api.breedHealthAlert.delete({ id: deleteTarget.id })
      if (res.success) { setDeleteTarget(null); load() }
      else toastError('Error', res.error?.message ?? 'Could not delete breed health alert.')
    } catch {
      toastError('Error', 'Could not delete breed health alert.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-slate-950">
      <div className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldAlert className="w-6 h-6 text-brand" />
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-slate-100">Breed Health Alerts</h1>
            <p className="text-sm text-gray-500 dark:text-slate-400">Your own notes on breed-specific risks — shown automatically when a matching patient is added or opened</p>
          </div>
        </div>
        {canWrite && !showForm && (
          <Button size="sm" onClick={() => setShowForm(true)}><Plus size={14} className="me-1" /> Add Alert</Button>
        )}
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-4">
        {showForm && (
          <Card padding="md" className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Select label="Species" value={species} onChange={(e) => setSpecies(e.target.value)}>
                {SPECIES_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
              <Input label="Breed" value={breed} onChange={(e) => setBreed(e.target.value)} placeholder="e.g. Golden Retriever" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Alert Text</label>
              <textarea value={alertText} onChange={(e) => setAlertText(e.target.value)} rows={2}
                placeholder="e.g. Ask about hip/joint symptoms at every visit"
                className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-dark dark:text-slate-100 resize-none focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" size="sm" onClick={() => { setShowForm(false); resetForm() }}>Cancel</Button>
              <Button size="sm" loading={saving} onClick={handleSave}>Save Alert</Button>
            </div>
          </Card>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-32 text-gray-500 text-sm dark:text-slate-400">Loading...</div>
        ) : alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-400 dark:text-slate-500">
            <ShieldAlert className="w-8 h-8 mb-2 opacity-40" />
            <p className="text-sm">No breed health alerts saved yet.</p>
          </div>
        ) : (
          <Card padding="none" className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 dark:bg-slate-950 dark:border-slate-700">
                <tr>
                  <th className="text-start px-4 py-3 font-medium text-gray-600 dark:text-slate-400">Species</th>
                  <th className="text-start px-4 py-3 font-medium text-gray-600 dark:text-slate-400">Breed</th>
                  <th className="text-start px-4 py-3 font-medium text-gray-600 dark:text-slate-400">Alert</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {alerts.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-slate-800">
                    <td className="px-4 py-3 text-gray-600 dark:text-slate-400">{a.species}</td>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-slate-100">{a.breed}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-slate-400">{a.alertText}</td>
                    <td className="px-4 py-3 text-end">
                      {canWrite && (
                        <button onClick={() => setDeleteTarget(a)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded dark:text-slate-500">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Remove Breed Health Alert"
        message={`Remove this alert for "${deleteTarget?.breed}"?`}
        confirmLabel="Remove"
      />
    </div>
  )
}
