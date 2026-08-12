import React, { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, XCircle, Clock } from 'lucide-react'
import { Card } from '@shared/ui/molecules/Card'
import { Badge } from '@shared/ui/atoms/Badge'
import { Button } from '@shared/ui/atoms/Button'
import { useNotificationStore } from '@app/store/notification.store'
import { useAuthStore } from '@app/store/auth.store'
import { formatDate } from '@shared/utils/locale.util'

interface ApprovalStep {
  id: string
  sequenceOrder: number
  approverRoleId: string | null
  approverUserId: string | null
  minAmountThreshold: number
}
interface ApprovalActionRow {
  id: string; stepId: string; action: 'APPROVED' | 'REJECTED'; comment: string | null
  actionById: string; actionedAt: string
}
interface ApprovalInstance {
  id: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  workflow: { id: string; name: string; steps: ApprovalStep[] }
  actions: ApprovalActionRow[]
}
interface Role { id: string; roleName: string }
interface UserRow { id: string; fullName: string }

const STATUS_VARIANT: Record<string, 'warning' | 'success' | 'danger'> = { PENDING: 'warning', APPROVED: 'success', REJECTED: 'danger' }

// Phase 63 — reusable inline approve/reject panel, shown on a
// SalesOrder/PurchaseOrder detail screen whenever an ApprovalInstance
// exists for that document (i.e. its amount crossed an active workflow's
// threshold). Renders nothing when no instance exists — this is invisible
// on every install that never configures a workflow, matching the feature's
// own opt-in design (see approval-workflow.service.ts's own comment).
export function ApprovalPanel({ documentType, documentId, refreshSignal, onActioned }: {
  documentType: 'SALES_ORDER' | 'PURCHASE_ORDER'
  documentId: string
  // Real bug found+fixed during Phase 63 live verification: this panel
  // only ever fetched its ApprovalInstance once, on mount. Confirming a
  // DRAFT order creates a brand-new instance server-side, but the parent
  // detail screen never unmounts/remounts this panel (same documentId, no
  // route change) — so a user who submits an order for approval saw no
  // panel at all until they navigated away and back. Passing the parent's
  // own status field here (so.status/po.status) gives the panel something
  // that actually changes across that exact transition, so its fetch
  // re-runs whenever the document's status changes, not just on mount.
  refreshSignal?: string
  onActioned?: () => void
}) {
  const { t } = useTranslation()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const { hasPermission } = useAuthStore()
  const canAct = hasPermission('approvalWorkflows.act')

  const [instance, setInstance] = useState<ApprovalInstance | null>(null)
  const [roles, setRoles] = useState<Role[]>([])
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [actingStepId, setActingStepId] = useState<string | null>(null)
  const [rejectStepId, setRejectStepId] = useState<string | null>(null)
  const [rejectComment, setRejectComment] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [iRes, rRes, uRes] = await Promise.all([
        window.api.approvalWorkflows.getInstanceForDocument({ documentType, documentId }),
        window.api.roles.list(),
        window.api.users.list()
      ])
      if (iRes.success) setInstance((iRes.data as ApprovalInstance | null) ?? null)
      if (rRes.success) setRoles((rRes.data as Role[]) ?? [])
      if (uRes.success) setUsers((uRes.data as UserRow[]) ?? [])
    } catch {
      // Silent — an approval panel failing to load shouldn't block the rest
      // of the document detail screen from rendering.
    } finally {
      setLoading(false)
    }
  }, [documentType, documentId])

  useEffect(() => { load() }, [load, refreshSignal])

  function approverLabel(step: ApprovalStep): string {
    if (step.approverRoleId) return roles.find(r => r.id === step.approverRoleId)?.roleName ?? t('approvalWorkflows.unknownRole')
    if (step.approverUserId) return users.find(u => u.id === step.approverUserId)?.fullName ?? t('approvalWorkflows.unknownUser')
    return t('approvalWorkflows.unassigned')
  }

  function actionFor(stepId: string): ApprovalActionRow | undefined {
    return instance?.actions.find(a => a.stepId === stepId)
  }

  async function handleApprove(stepId: string) {
    if (!instance) return
    setActingStepId(stepId)
    try {
      const res = await window.api.approvalWorkflows.actOnStep({ instanceId: instance.id, stepId, action: 'APPROVED' })
      if (res.success) {
        toastSuccess(t('approvalWorkflows.stepApproved'))
        load()
        onActioned?.()
      } else {
        toastError(t('common.error'), res.error?.message ?? t('common.error'))
      }
    } catch {
      toastError(t('common.error'), t('common.error'))
    } finally {
      setActingStepId(null)
    }
  }

  async function handleReject() {
    if (!instance || !rejectStepId) return
    setActingStepId(rejectStepId)
    try {
      const res = await window.api.approvalWorkflows.actOnStep({ instanceId: instance.id, stepId: rejectStepId, action: 'REJECTED', comment: rejectComment || undefined })
      if (res.success) {
        toastSuccess(t('approvalWorkflows.stepRejected'))
        setRejectStepId(null)
        setRejectComment('')
        load()
        onActioned?.()
      } else {
        toastError(t('common.error'), res.error?.message ?? t('common.error'))
      }
    } catch {
      toastError(t('common.error'), t('common.error'))
    } finally {
      setActingStepId(null)
    }
  }

  if (loading || !instance) return null

  return (
    <Card padding="lg" className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-dark dark:text-slate-100">{instance.workflow.name}</p>
          <p className="text-xs text-slate-400">{t('approvalWorkflows.title')}</p>
        </div>
        <Badge variant={STATUS_VARIANT[instance.status]} size="sm">{t(`approvalWorkflows.status.${instance.status}`)}</Badge>
      </div>
      <div className="space-y-2">
        {instance.workflow.steps.map(step => {
          const action = actionFor(step.id)
          return (
            <div key={step.id} className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2 min-w-0">
                {action?.action === 'APPROVED' ? <CheckCircle2 size={14} className="text-success shrink-0" />
                  : action?.action === 'REJECTED' ? <XCircle size={14} className="text-danger shrink-0" />
                  : <Clock size={14} className="text-slate-400 shrink-0" />}
                <div className="min-w-0">
                  <p className="text-sm text-dark dark:text-slate-100 truncate">{approverLabel(step)}</p>
                  <p className="text-xs text-slate-400">
                    {t('approvalWorkflows.minThreshold', { amount: step.minAmountThreshold })}
                    {action && ` · ${formatDate(action.actionedAt)}`}
                    {action?.comment && ` · "${action.comment}"`}
                  </p>
                </div>
              </div>
              {!action && instance.status === 'PENDING' && canAct && (
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => handleApprove(step.id)} disabled={actingStepId === step.id}
                    className="text-xs font-semibold text-success hover:text-success/80 transition-colors disabled:opacity-50">
                    {t('approvalWorkflows.approveStep')}
                  </button>
                  <button onClick={() => setRejectStepId(step.id)} disabled={actingStepId === step.id}
                    className="text-xs font-semibold text-danger hover:text-danger/80 transition-colors disabled:opacity-50">
                    {t('approvalWorkflows.rejectStep')}
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {rejectStepId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-semibold text-gray-900 dark:text-slate-100">{t('approvalWorkflows.rejectStep')}</h3>
            <textarea value={rejectComment} onChange={e => setRejectComment(e.target.value)} rows={3}
              placeholder={t('approvalWorkflows.rejectCommentPlaceholder')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand resize-none dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => { setRejectStepId(null); setRejectComment('') }}>{t('common.cancel')}</Button>
              <Button variant="danger" size="sm" onClick={handleReject} loading={actingStepId === rejectStepId}>{t('approvalWorkflows.rejectStep')}</Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}
