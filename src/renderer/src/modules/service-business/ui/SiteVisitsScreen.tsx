import React, { useState, useEffect, useCallback } from 'react'
import { HardHat, Plus, Trash2, RefreshCw, Paperclip, ChevronDown, ChevronUp } from 'lucide-react'
import { Card } from '@shared/ui/molecules/Card'
import { Button } from '@shared/ui/atoms/Button'
import { Input } from '@shared/ui/atoms/Input'
import { Select } from '@shared/ui/atoms/Select'
import { DocumentPanel } from '@modules/documents/ui/DocumentPanel'
import { useAuthStore } from '@app/store/auth.store'
import { useNotificationStore } from '@app/store/notification.store'

interface Project { id: string; projectName: string; client: { customerName: string } }
interface SiteVisit {
  id: string; projectId: string; visitDate: string; visitType: string
  findings: string | null; weatherConditions: string | null
  recordedBy: { id: string; fullName: string } | null
}

const VISIT_TYPES = ['SURVEY', 'INSPECTION', 'PROGRESS_CHECK', 'HANDOVER']

// Fresh-audit build (2026-07-12) — Civil Engineer real depth. A site visit
// log (survey/inspection/progress-check findings) — genuine, everyday
// civil-practice bookkeeping distinct from an architect's drawing-issue
// workflow. Reuses ServiceProject via a project picker, same pattern as
// DrawingRegisterScreen.
export function SiteVisitsScreen(): React.JSX.Element {
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const canManage = hasPermission('billing.createInvoice')

  const [projects, setProjects] = useState<Project[]>([])
  const [projectId, setProjectId] = useState('')
  const [items, setItems] = useState<SiteVisit[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [visitDate, setVisitDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [visitType, setVisitType] = useState('INSPECTION')
  const [findings, setFindings] = useState('')
  const [weatherConditions, setWeatherConditions] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    window.api.serviceProject.list().then((res) => {
      if (res.success) {
        const list = (res.data as Project[]) ?? []
        setProjects(list)
        if (list.length > 0) setProjectId((prev) => prev || list[0].id)
      }
    })
  }, [])

  const load = useCallback(async (pid: string) => {
    if (!pid) { setItems([]); return }
    setLoading(true)
    try {
      const res = await window.api.siteVisit.list({ projectId: pid })
      if (res.success) setItems((res.data as SiteVisit[]) ?? [])
      else toastError('Error', res.error?.message ?? 'Could not load site visits.')
    } finally {
      setLoading(false)
    }
  }, [toastError])

  useEffect(() => { void load(projectId) }, [projectId, load])

  function resetForm() {
    setVisitDate(new Date().toISOString().slice(0, 10)); setVisitType('INSPECTION'); setFindings(''); setWeatherConditions(''); setError('')
  }

  async function handleCreate() {
    setError('')
    if (!projectId) { setError('Select a project first.'); return }
    if (!visitDate) { setError('Visit date is required.'); return }
    setSaving(true)
    try {
      const res = await window.api.siteVisit.create({
        projectId, visitDate, visitType, findings: findings.trim() || undefined, weatherConditions: weatherConditions.trim() || undefined,
      })
      if (res.success) {
        toastSuccess('Site Visit Recorded', `${visitType.replace(/_/g, ' ')} logged.`)
        setShowForm(false)
        resetForm()
        await load(projectId)
      } else {
        setError(res.error?.message ?? 'Could not save site visit.')
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this site visit record?')) return
    const res = await window.api.siteVisit.delete({ id })
    if (res.success) { toastSuccess('Deleted', 'Site visit removed.'); await load(projectId) }
    else toastError('Error', res.error?.message ?? 'Could not delete.')
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-dark flex items-center gap-2"><HardHat size={20} /> Site Visit Log</h2>
          <p className="text-sm text-slate-400">Record survey, inspection, and progress-check visits per project.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => void load(projectId)} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-500 hover:border-slate-300 transition-colors">
            <RefreshCw size={14} /> Refresh
          </button>
          {canManage && projectId && (
            <Button size="sm" onClick={() => setShowForm((s) => !s)} icon={<Plus size={14} />}>Log Visit</Button>
          )}
        </div>
      </div>

      <Select label="Project" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
        <option value="">Select a project…</option>
        {projects.map((p) => <option key={p.id} value={p.id}>{p.projectName} — {p.client.customerName}</option>)}
      </Select>

      {showForm && canManage && (
        <Card padding="md" className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Visit Date *" type="date" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} />
            <Select label="Visit Type" value={visitType} onChange={(e) => setVisitType(e.target.value)}>
              {VISIT_TYPES.map((v) => <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>)}
            </Select>
          </div>
          <Input label="Weather Conditions" placeholder="Optional" value={weatherConditions} onChange={(e) => setWeatherConditions(e.target.value)} />
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Findings</label>
            <textarea value={findings} onChange={(e) => setFindings(e.target.value)} rows={3} placeholder="What was observed on site…"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-brand resize-none text-slate-700 dark:text-slate-200 placeholder-slate-400" />
          </div>
          {error && <p className="text-xs text-danger bg-red-50 border border-red-100 rounded-md px-3 py-2">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => { setShowForm(false); resetForm() }}>Cancel</Button>
            <Button size="sm" onClick={() => void handleCreate()} loading={saving}>Save</Button>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="text-center py-16 text-slate-400">Loading...</div>
      ) : !projectId ? (
        <Card padding="lg" className="text-center py-12">
          <p className="text-sm text-slate-500">Select a project to view its site visit log.</p>
        </Card>
      ) : items.length === 0 ? (
        <Card padding="lg" className="text-center py-12">
          <HardHat size={32} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No site visits logged yet for this project</p>
        </Card>
      ) : (
        <Card padding="none" className="overflow-hidden">
          <div className="divide-y divide-slate-50 dark:divide-slate-800">
            {items.map((v) => (
              <div key={v.id}>
                <div className="px-5 py-4 flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900 text-sm dark:text-slate-100">{new Date(v.visitDate).toLocaleDateString()}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400">{v.visitType.replace(/_/g, ' ')}</span>
                      {v.weatherConditions && <span className="text-xs text-slate-400">{v.weatherConditions}</span>}
                    </div>
                    {v.findings && <div className="text-sm text-gray-800 mt-1 dark:text-slate-200">{v.findings}</div>}
                    {v.recordedBy && <div className="text-xs text-gray-500 mt-0.5 dark:text-slate-400">Recorded by {v.recordedBy.fullName}</div>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => setExpandedId(expandedId === v.id ? null : v.id)} className="flex items-center gap-1 px-2 py-1.5 text-xs text-gray-500 dark:text-slate-400 hover:text-brand rounded-lg hover:bg-brand/5">
                      <Paperclip size={13} /> Files {expandedId === v.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>
                    {canManage && (
                      <button onClick={() => void handleDelete(v.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg dark:text-slate-500"><Trash2 size={14} /></button>
                    )}
                  </div>
                </div>
                {expandedId === v.id && (
                  <div className="px-5 pb-4 -mt-1">
                    <DocumentPanel entityType="SITE_VISIT" entityId={v.id} compact />
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
