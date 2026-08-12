import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { ShieldCheck, RefreshCw, Plus, Trash2 } from 'lucide-react'
import { Button } from '@shared/ui/atoms/Button'
import { Input } from '@shared/ui/atoms/Input'
import { Select } from '@shared/ui/atoms/Select'
import { Badge } from '@shared/ui/atoms/Badge'
import { Modal } from '@shared/ui/molecules/Modal'
import { ConfirmDialog } from '@shared/ui/molecules/ConfirmDialog'
import { SkeletonTable } from '@shared/ui/Skeleton'
import { useNotificationStore } from '@app/store/notification.store'
import { useAuthStore } from '@app/store/auth.store'

interface ApprovalStepRow { id: string; sequenceOrder: number; approverRoleId: string | null; approverUserId: string | null; minAmountThreshold: number }
interface ApprovalWorkflow { id: string; documentType: string; name: string; isActive: boolean; steps: ApprovalStepRow[] }
interface Role { id: string; roleName: string }
interface UserRow { id: string; fullName: string }

interface StepFormRow { approverType: 'ROLE' | 'USER'; approverId: string; minAmountThreshold: string }
const EMPTY_STEP: StepFormRow = { approverType: 'ROLE', approverId: '', minAmountThreshold: '0' }

const DOC_TYPES = ['SALES_ORDER', 'PURCHASE_ORDER'] as const

// Phase 63 — multi-level approval workflows, fully opt-in. Configuring a
// workflow here is the only way SalesOrder/PurchaseOrder's own confirm/
// approve actions ever pause for approval at all — see
// approval-workflow.service.ts's own comment for the opt-in design.
export function ApprovalWorkflowsScreen() {
  const { t } = useTranslation()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const { hasPermission } = useAuthStore()
  const canManage = hasPermission('approvalWorkflows.manage')

  const [workflows, setWorkflows] = useState<ApprovalWorkflow[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState<'' | typeof DOC_TYPES[number]>('')
  const [showCreate, setShowCreate] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ApprovalWorkflow | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [formDocumentType, setFormDocumentType] = useState<typeof DOC_TYPES[number]>('SALES_ORDER')
  const [formName, setFormName] = useState('')
  const [formSteps, setFormSteps] = useState<StepFormRow[]>([{ ...EMPTY_STEP }])
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [wRes, rRes, uRes] = await Promise.all([
        window.api.approvalWorkflows.list(typeFilter || undefined),
        window.api.roles.list(),
        window.api.users.list()
      ])
      if (wRes.success) setWorkflows((wRes.data as ApprovalWorkflow[]) ?? [])
      else toastError(t('common.error'), wRes.error?.message ?? t('approvalWorkflows.couldNotLoad'))
      if (rRes.success) setRoles((rRes.data as Role[]) ?? [])
      if (uRes.success) setUsers((uRes.data as UserRow[]) ?? [])
    } catch {
      toastError(t('common.error'), t('approvalWorkflows.couldNotLoad'))
    } finally {
      setLoading(false)
    }
  }, [typeFilter, toastError, t])

  useEffect(() => { load() }, [load])

  function approverLabel(step: ApprovalStepRow) {
    if (step.approverRoleId) return roles.find(r => r.id === step.approverRoleId)?.roleName ?? t('approvalWorkflows.unknownRole')
    if (step.approverUserId) return users.find(u => u.id === step.approverUserId)?.fullName ?? t('approvalWorkflows.unknownUser')
    return t('approvalWorkflows.unassigned')
  }

  function openCreate() {
    setFormDocumentType('SALES_ORDER')
    setFormName('')
    setFormSteps([{ ...EMPTY_STEP }])
    setShowCreate(true)
  }

  function updateStep(index: number, patch: Partial<StepFormRow>) {
    setFormSteps(steps => steps.map((s, i) => i === index ? { ...s, ...patch } : s))
  }

  function addStep() {
    setFormSteps(steps => [...steps, { ...EMPTY_STEP }])
  }

  function removeStep(index: number) {
    setFormSteps(steps => steps.length > 1 ? steps.filter((_, i) => i !== index) : steps)
  }

  async function handleSave() {
    if (!formName.trim()) { toastError(t('approvalWorkflows.missingFields'), t('approvalWorkflows.nameRequired')); return }
    const validSteps = formSteps.filter(s => s.approverId)
    if (validSteps.length === 0) { toastError(t('approvalWorkflows.missingFields'), t('approvalWorkflows.atLeastOneStep')); return }
    setSaving(true)
    try {
      const res = await window.api.approvalWorkflows.create({
        documentType: formDocumentType,
        name: formName.trim(),
        steps: validSteps.map((s, i) => ({
          sequenceOrder: i + 1,
          approverRoleId: s.approverType === 'ROLE' ? s.approverId : undefined,
          approverUserId: s.approverType === 'USER' ? s.approverId : undefined,
          minAmountThreshold: Number(s.minAmountThreshold) || 0
        }))
      })
      if (res.success) {
        toastSuccess(t('approvalWorkflows.workflowCreated'), formName.trim())
        setShowCreate(false)
        load()
      } else {
        toastError(t('common.error'), res.error?.message ?? t('approvalWorkflows.couldNotCreate'))
      }
    } catch {
      toastError(t('common.error'), t('approvalWorkflows.couldNotCreate'))
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(wf: ApprovalWorkflow) {
    try {
      const res = await window.api.approvalWorkflows.update({ id: wf.id, isActive: !wf.isActive })
      if (!res.success) { toastError(t('common.error'), res.error?.message ?? t('approvalWorkflows.couldNotSave')); return }
      load()
    } catch {
      toastError(t('common.error'), t('approvalWorkflows.couldNotSave'))
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await window.api.approvalWorkflows.delete(deleteTarget.id)
      if (res.success) {
        toastSuccess(t('approvalWorkflows.workflowDeleted'), '')
        setDeleteTarget(null)
        load()
      } else {
        toastError(t('common.error'), res.error?.message ?? t('approvalWorkflows.couldNotDelete'))
      }
    } catch {
      toastError(t('common.error'), t('approvalWorkflows.couldNotDelete'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand/10 flex items-center justify-center">
              <ShieldCheck size={18} className="text-brand" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-dark dark:text-slate-100">{t('approvalWorkflows.title')}</h1>
              <p className="text-xs text-slate-400">{t('approvalWorkflows.subtitle', { count: workflows.length })}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-brand hover:border-brand transition-colors">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
            {canManage && (
              <Button size="sm" icon={<Plus size={14} />} onClick={openCreate}>{t('approvalWorkflows.newWorkflow')}</Button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 mt-4">
          {(['', ...DOC_TYPES] as const).map((val) => (
            <button
              key={val || 'ALL'}
              onClick={() => setTypeFilter(val)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${typeFilter === val ? 'bg-brand text-white border-brand' : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-brand'}`}
            >
              {val === '' ? t('common.all') : t(`approvalWorkflows.docType.${val}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto dark:bg-slate-950">
        {loading && workflows.length === 0 ? (
          <div className="p-6"><SkeletonTable rows={5} cols={4} /></div>
        ) : workflows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-2 text-slate-400">
            <ShieldCheck size={40} className="opacity-30" />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('approvalWorkflows.noWorkflowsYet')}</p>
          </div>
        ) : (
          <div className="p-6 space-y-3">
            {workflows.map(wf => (
              <div key={wf.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-semibold text-dark dark:text-slate-100">{wf.name}</p>
                    <Badge variant="info" size="sm">{t(`approvalWorkflows.docType.${wf.documentType}`)}</Badge>
                    <Badge variant={wf.isActive ? 'success' : 'neutral'} size="sm">{wf.isActive ? t('common.active') : t('common.inactive')}</Badge>
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-3">
                      <button onClick={() => toggleActive(wf)} className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-brand transition-colors">
                        {wf.isActive ? t('approvalWorkflows.deactivate') : t('approvalWorkflows.activate')}
                      </button>
                      <button onClick={() => setDeleteTarget(wf)} className="text-xs font-semibold text-danger hover:text-danger/80 transition-colors">{t('common.delete')}</button>
                    </div>
                  )}
                </div>
                <div className="space-y-1.5">
                  {wf.steps.map(step => (
                    <div key={step.id} className="flex items-center justify-between text-xs bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-1.5">
                      <span className="text-slate-600 dark:text-slate-300">{t('approvalWorkflows.stepN', { n: step.sequenceOrder })}: {approverLabel(step)}</span>
                      <span className="text-slate-400">{t('approvalWorkflows.minThreshold', { amount: step.minAmountThreshold })}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <Modal open onClose={() => setShowCreate(false)} title={t('approvalWorkflows.newWorkflow')} size="lg"
          footer={<>
            <Button variant="secondary" onClick={() => setShowCreate(false)} disabled={saving}>{t('common.cancel')}</Button>
            <Button onClick={handleSave} loading={saving}>{t('common.create')}</Button>
          </>}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Select label={t('approvalWorkflows.appliesTo')} value={formDocumentType} onChange={e => setFormDocumentType(e.target.value as typeof formDocumentType)}>
                {DOC_TYPES.map(dt => <option key={dt} value={dt}>{t(`approvalWorkflows.docType.${dt}`)}</option>)}
              </Select>
              <Input label={t('common.name')} value={formName} onChange={e => setFormName(e.target.value)} placeholder={t('approvalWorkflows.namePlaceholder')} />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">{t('approvalWorkflows.steps')}</p>
                <button type="button" onClick={addStep} className="flex items-center gap-1 text-xs font-medium text-brand hover:text-brand/80 transition-colors">
                  <Plus size={12} /> {t('approvalWorkflows.addStep')}
                </button>
              </div>
              <p className="text-xs text-slate-400 mb-2">{t('approvalWorkflows.stepsHint')}</p>
              <div className="space-y-2">
                {formSteps.map((step, index) => (
                  <div key={index} className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t('approvalWorkflows.stepN', { n: index + 1 })}</span>
                      <div className="flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 p-0.5">
                        {(['ROLE', 'USER'] as const).map(at => (
                          <button key={at} type="button" onClick={() => updateStep(index, { approverType: at, approverId: '' })}
                            className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${step.approverType === at ? 'bg-brand text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-900'}`}>
                            {at === 'ROLE' ? t('approvalWorkflows.byRole') : t('approvalWorkflows.byUser')}
                          </button>
                        ))}
                      </div>
                      <span className="flex-1" />
                      <button type="button" onClick={() => removeStep(index)} disabled={formSteps.length === 1}
                        className="p-1.5 rounded text-slate-400 hover:text-danger hover:bg-danger/10 disabled:opacity-30 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <select value={step.approverId} onChange={e => updateStep(index, { approverId: e.target.value })}
                        className="w-full h-8 px-2 rounded border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900">
                        <option value="">{t('common.select')}</option>
                        {step.approverType === 'ROLE'
                          ? roles.map(r => <option key={r.id} value={r.id}>{r.roleName}</option>)
                          : users.map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
                      </select>
                      <input type="number" min="0" step="0.01" placeholder={t('approvalWorkflows.minThresholdPlaceholder')}
                        value={step.minAmountThreshold} onChange={e => updateStep(index, { minAmountThreshold: e.target.value })}
                        className="w-full h-8 px-2 rounded border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <ConfirmDialog
          open
          title={t('approvalWorkflows.deleteWorkflowTitle')}
          message={t('approvalWorkflows.deleteWorkflowMessage')}
          confirmLabel={t('common.delete')}
          loading={deleting}
          onConfirm={handleDelete}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
