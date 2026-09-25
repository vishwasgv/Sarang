import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { MessageCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { api } from '@renderer/services/ipc-client'
import { useNotificationStore } from '@app/store/notification.store'
import { Modal } from '@shared/ui/molecules/Modal'
import { Select } from '@shared/ui/atoms/Select'
import { Button } from '@shared/ui/atoms/Button'

interface TemplateRow {
  key: string
  vertical: string
  label: string
  tokens: string[]
  sendable: boolean
  currentBody: string
}

// Token names that mean "the customer's own name" across the catalog
// (message-template.defaults.ts uses a different name per vertical — a pet
// owner's {{ownerName}}, a patient's {{patientName}}, a donor's {{donorName}},
// etc. — rather than one universal token). Pre-filling whichever of these a
// template actually declares saves the owner from retyping a name that's
// already on the customer record.
const CUSTOMER_NAME_TOKENS = ['customerName', 'name', 'guestName', 'patientName', 'ownerName', 'clientName', 'donorName']

interface SendTemplateMessageModalProps {
  customerId: string
  customerName: string
  customerPhone: string | null
  onClose: () => void
}

/**
 * Ad-hoc "pick a template, fill in the rest, send" flow — reachable from the
 * Customer detail screen. Unlike the scheduled reminders in
 * NotificationQueueScreen.tsx (auto-generated from real order/case/appointment
 * data), this is for a one-off message the owner wants to send right now:
 * they pick any customer-facing template, the customer's own name is
 * pre-filled wherever the template expects it, and they fill in whatever
 * else the message needs (an amount, a date, a case number...) by hand.
 * Sending stays the same "opens WhatsApp, never claims Sent" pattern as
 * ShareMenu.tsx and NotificationQueueScreen.tsx.
 */
export function SendTemplateMessageModal({ customerId, customerName, customerPhone, onClose }: SendTemplateMessageModalProps) {
  const { t } = useTranslation()
  const { info: toastInfo, error: toastError } = useNotificationStore()

  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedKey, setSelectedKey] = useState('')
  const [params, setParams] = useState<Record<string, string>>({})
  const [preview, setPreview] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const res = await api.messageTemplates.list()
        if (!cancelled && res.success) {
          const sendableOnes = ((res.data as TemplateRow[]) ?? []).filter((tpl) => tpl.sendable)
          setTemplates(sendableOnes)
          if (sendableOnes.length) setSelectedKey(sendableOnes[0].key)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const selectedTemplate = useMemo(() => templates.find((tpl) => tpl.key === selectedKey) ?? null, [templates, selectedKey])

  // Reset the form to blank + pre-fill the customer's own name whenever the
  // chosen template changes — a token set from a previous template rarely
  // applies to the next one.
  useEffect(() => {
    if (!selectedTemplate) { setParams({}); return }
    const next: Record<string, string> = {}
    for (const tok of selectedTemplate.tokens) {
      if (CUSTOMER_NAME_TOKENS.includes(tok)) next[tok] = customerName
    }
    setParams(next)
  }, [selectedTemplate, customerName])

  const refreshPreview = useCallback(async (key: string, currentParams: Record<string, string>) => {
    if (!key) { setPreview(''); return }
    try {
      const res = await api.messageTemplates.buildSendLink({ key, params: currentParams })
      if (res.success) setPreview((res.data as { body: string }).body)
    } catch { /* preview is a convenience aid */ }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => refreshPreview(selectedKey, params), 250)
    return () => clearTimeout(timer)
  }, [selectedKey, params, refreshPreview])

  async function handleSend() {
    if (!customerPhone) return
    setSending(true)
    try {
      const res = await api.messageTemplates.buildSendLink({ key: selectedKey, phone: customerPhone, params, customerId })
      if (res.success && (res.data as { link: string | null }).link) {
        window.open((res.data as { link: string }).link, '_blank')
        toastInfo(t('share.openingWhatsApp'))
        onClose()
      } else {
        toastError(t('share.noPhoneTitle'), t('share.noPhoneMessage'))
      }
    } catch {
      toastError(t('common.error'), t('share.shareFailed'))
    } finally {
      setSending(false)
    }
  }

  return (
    <Modal
      open onClose={onClose}
      title={t('customers.sendWhatsAppMessage')}
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>{t('common.cancel')}</Button>
          <Button
            size="sm"
            onClick={handleSend}
            loading={sending}
            disabled={!selectedKey || !customerPhone || loading}
          >
            <MessageCircle size={14} className="me-1" /> {t('share.whatsapp')}
          </Button>
        </div>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <div className="w-7 h-7 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        </div>
      ) : templates.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">{t('customers.noSendableTemplates')}</p>
      ) : (
        <div className="space-y-4">
          <Select
            label={t('customers.chooseTemplate')}
            value={selectedKey}
            onChange={(e) => setSelectedKey(e.target.value)}
          >
            {templates.map((tpl) => (
              <option key={tpl.key} value={tpl.key}>{tpl.label} ({tpl.vertical})</option>
            ))}
          </Select>

          {selectedTemplate && selectedTemplate.tokens.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('customers.fillInDetails')}</p>
              <div className="grid grid-cols-2 gap-3">
                {selectedTemplate.tokens.map((tok) => (
                  <div key={tok} className="flex flex-col gap-1">
                    <label className="text-xs text-slate-500 dark:text-slate-400">{`{{${tok}}}`}</label>
                    <input
                      value={params[tok] ?? ''}
                      onChange={(e) => setParams((p) => ({ ...p, [tok]: e.target.value }))}
                      className="h-10 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm text-dark dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-lg border border-brand/20 bg-brand/5 px-3 py-2">
            <p className="text-[10px] font-semibold text-brand uppercase tracking-wide mb-1">{t('settings.messageTemplates.previewHeading')}</p>
            <p className="text-sm text-dark dark:text-slate-100 whitespace-pre-wrap">{preview || '…'}</p>
          </div>

          {!customerPhone && (
            <p className="text-xs text-danger">{t('share.noPhoneOnFile')}</p>
          )}
        </div>
      )}
    </Modal>
  )
}
