import React, { useState, useEffect, useCallback } from 'react'
import { FileStack, Plus, Trash2, RefreshCw, Paperclip, ChevronDown, ChevronUp } from 'lucide-react'
import { Card } from '@shared/ui/molecules/Card'
import { Button } from '@shared/ui/atoms/Button'
import { Input } from '@shared/ui/atoms/Input'
import { Select } from '@shared/ui/atoms/Select'
import { Badge } from '@shared/ui/atoms/Badge'
import { DocumentPanel } from '@modules/documents/ui/DocumentPanel'
import { useAuthStore } from '@app/store/auth.store'
import { useNotificationStore } from '@app/store/notification.store'

interface Project { id: string; projectName: string; client: { customerName: string } }
interface DrawingRevision {
  id: string; projectId: string; drawingNumber: string; title: string
  discipline: string; revisionNumber: string; status: string
  issuedDate: string | null; notes: string | null
}

const DISCIPLINES = ['ARCHITECTURAL', 'STRUCTURAL', 'MEP', 'LANDSCAPE', 'INTERIOR']
const STATUSES = ['DRAFT', 'ISSUED_FOR_REVIEW', 'APPROVED', 'SUPERSEDED']
const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  DRAFT: 'neutral', ISSUED_FOR_REVIEW: 'warning', APPROVED: 'success', SUPERSEDED: 'danger',
}

// Fresh-audit build (2026-07-12) — Architect real depth. A drawing register
// (which drawing, which revision, current status) — genuine, everyday
// architectural-practice bookkeeping. Reuses ServiceProject (no parallel
// project entity) via a project picker, same reuse-over-parallel-schema
// pattern this codebase has followed repeatedly.
export function DrawingRegisterScreen(): React.JSX.Element {
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const canManage = hasPermission('billing.createInvoice')

  const [projects, setProjects] = useState<Project[]>([])
  const [projectId, setProjectId] = useState('')
  const [items, setItems] = useState<DrawingRevision[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [drawingNumber, setDrawingNumber] = useState('')
  const [title, setTitle] = useState('')
  const [discipline, setDiscipline] = useState('ARCHITECTURAL')
  const [revisionNumber, setRevisionNumber] = useState('A')
  const [status, setStatus] = useState('DRAFT')
  const [issuedDate, setIssuedDate] = useState('')
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
      const res = await window.api.drawingRevision.list({ projectId: pid })
      if (res.success) setItems((res.data as DrawingRevision[]) ?? [])
      else toastError('Error', res.error?.message ?? 'Could not load drawing register.')
    } finally {
      setLoading(false)
    }
  }, [toastError])

  useEffect(() => { void load(projectId) }, [projectId, load])

  function resetForm() {
    setDrawingNumber(''); setTitle(''); setDiscipline('ARCHITECTURAL'); setRevisionNumber('A'); setStatus('DRAFT'); setIssuedDate(''); setError('')
  }

  async function handleCreate() {
    setError('')
    if (!projectId) { setError('Select a project first.'); return }
    if (!drawingNumber.trim()) { setError('Drawing number is required.'); return }
    if (!title.trim()) { setError('Title is required.'); return }
    setSaving(true)
    try {
      const res = await window.api.drawingRevision.create({
        projectId, drawingNumber: drawingNumber.trim(), title: title.trim(), discipline, revisionNumber: revisionNumber.trim() || 'A', status,
        issuedDate: issuedDate || undefined,
      })
      if (res.success) {
        toastSuccess('Drawing Added', `${drawingNumber} Rev ${revisionNumber} recorded.`)
        setShowForm(false)
        resetForm()
        await load(projectId)
      } else {
        setError(res.error?.message ?? 'Could not save drawing.')
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleStatusChange(item: DrawingRevision, next: string) {
    const res = await window.api.drawingRevision.update({ id: item.id, status: next })
    if (res.success) await load(projectId)
    else toastError('Error', res.error?.message ?? 'Could not update status.')
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this drawing revision record?')) return
    const res = await window.api.drawingRevision.delete({ id })
    if (res.success) { toastSuccess('Deleted', 'Drawing revision removed.'); await load(projectId) }
    else toastError('Error', res.error?.message ?? 'Could not delete.')
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-dark flex items-center gap-2"><FileStack size={20} /> Drawing Register</h2>
          <p className="text-sm text-slate-400">Track drawing issue status and revisions per project.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => void load(projectId)} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-500 hover:border-slate-300 transition-colors">
            <RefreshCw size={14} /> Refresh
          </button>
          {canManage && projectId && (
            <Button size="sm" onClick={() => setShowForm((s) => !s)} icon={<Plus size={14} />}>Add Drawing</Button>
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
            <Input label="Drawing Number *" value={drawingNumber} onChange={(e) => setDrawingNumber(e.target.value)} />
            <Input label="Title *" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid grid-cols-4 gap-3">
            <Select label="Discipline" value={discipline} onChange={(e) => setDiscipline(e.target.value)}>
              {DISCIPLINES.map((d) => <option key={d} value={d}>{d}</option>)}
            </Select>
            <Input label="Revision" value={revisionNumber} onChange={(e) => setRevisionNumber(e.target.value)} />
            <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </Select>
            <Input label="Issued Date" type="date" value={issuedDate} onChange={(e) => setIssuedDate(e.target.value)} />
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
          <p className="text-sm text-slate-500">Select a project to view its drawing register.</p>
        </Card>
      ) : items.length === 0 ? (
        <Card padding="lg" className="text-center py-12">
          <FileStack size={32} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No drawings recorded yet for this project</p>
        </Card>
      ) : (
        <Card padding="none" className="overflow-hidden">
          <div className="divide-y divide-slate-50 dark:divide-slate-800">
            {items.map((d) => (
              <div key={d.id}>
                <div className="px-5 py-4 flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900 text-sm dark:text-slate-100">{d.drawingNumber}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400">Rev {d.revisionNumber}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400">{d.discipline}</span>
                      <Badge variant={STATUS_VARIANT[d.status] ?? 'neutral'} size="sm">{d.status.replace(/_/g, ' ')}</Badge>
                    </div>
                    <div className="text-sm text-gray-800 mt-1 dark:text-slate-200">{d.title}</div>
                    {d.issuedDate && <div className="text-xs text-gray-500 mt-0.5 dark:text-slate-400">Issued {new Date(d.issuedDate).toLocaleDateString()}</div>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => setExpandedId(expandedId === d.id ? null : d.id)} className="flex items-center gap-1 px-2 py-1.5 text-xs text-gray-500 dark:text-slate-400 hover:text-brand rounded-lg hover:bg-brand/5">
                      <Paperclip size={13} /> Files {expandedId === d.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>
                    {canManage && (
                      <>
                        <Select value={d.status} onChange={(e) => void handleStatusChange(d, e.target.value)} className="!h-9 !py-0 text-xs">
                          {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                        </Select>
                        <button onClick={() => void handleDelete(d.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg dark:text-slate-500"><Trash2 size={14} /></button>
                      </>
                    )}
                  </div>
                </div>
                {expandedId === d.id && (
                  <div className="px-5 pb-4 -mt-1">
                    <DocumentPanel entityType="DRAWING_REVISION" entityId={d.id} compact />
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
