import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { MessageSquareText, RotateCcw, Save, ChevronDown, ChevronRight, Eye, EyeOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { api } from '@renderer/services/ipc-client'
import { SUPPORTED_LANGUAGES } from '@renderer/i18n'
import { useNotificationStore } from '@app/store/notification.store'
import { useAuthStore } from '@app/store/auth.store'
import { Card } from '@shared/ui/molecules/Card'
import { Badge } from '@shared/ui/atoms/Badge'
import { Button } from '@shared/ui/atoms/Button'
import { Select } from '@shared/ui/atoms/Select'
import { cn } from '@shared/utils/cn'

const REMINDER_LANGUAGE_SETTING_KEY = 'reminder_message_language'
const SIGNATURE_SETTING_KEY = 'message_signature_enabled'

// Placeholders the message can never fill in, so the owner sees the mistake while typing (the server checks again on save).
function unknownTokens(body: string, allowed: string[]): string[] {
  const bad = new Set<string>()
  for (const m of body.matchAll(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g)) if (!allowed.includes(m[1])) bad.add(m[1])
  return [...bad]
}

interface TemplateRow {
  key: string
  vertical: string
  label: string
  tokens: string[]
  sendable: boolean
  defaultBody: string
  currentBody: string
  isCustomized: boolean
}

/**
 * Owner-editable WhatsApp message templates — every reminder this app can
 * send, across every business vertical, in one place. Sibling screen to
 * NotificationQueueScreen.tsx ("WhatsApp Reminders"): that screen sends
 * already-queued reminders one click at a time; this one controls what
 * those reminders SAY. See message-template.defaults.ts (main process) for
 * the full catalog this mirrors.
 */
export function MessageTemplatesScreen() {
  const { t } = useTranslation()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const { hasPermission } = useAuthStore()
  const canManage = hasPermission('messageTemplates.manage')

  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedVertical, setExpandedVertical] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [previewOpenKey, setPreviewOpenKey] = useState<string | null>(null)
  const [previews, setPreviews] = useState<Record<string, string>>({})
  const [reminderLanguage, setReminderLanguageState] = useState('en')
  const [languageSaving, setLanguageSaving] = useState(false)
  const [signatureOn, setSignatureOn] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [listRes, langRes, sigRes] = await Promise.all([
        api.messageTemplates.list(),
        api.settings.get(REMINDER_LANGUAGE_SETTING_KEY),
        api.settings.get(SIGNATURE_SETTING_KEY),
      ])
      setSignatureOn(!(sigRes.success && sigRes.data === 'false'))
      if (listRes.success) {
        const data = (listRes.data as TemplateRow[]) ?? []
        setTemplates(data)
        setDrafts(Object.fromEntries(data.map((tpl) => [tpl.key, tpl.currentBody])))
      } else {
        toastError(t('common.error'), t('settings.messageTemplates.loadFailed'))
      }
      if (langRes.success && typeof langRes.data === 'string' && langRes.data) setReminderLanguageState(langRes.data)
    } catch {
      toastError(t('common.error'), t('settings.messageTemplates.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [toastError, t])

  useEffect(() => { load() }, [load])

  async function handleReminderLanguageChange(code: string) {
    setLanguageSaving(true)
    try {
      const res = await api.settings.set({ key: REMINDER_LANGUAGE_SETTING_KEY, value: code })
      if (res.success) {
        setReminderLanguageState(code)
        await load() // re-fetch — every template's defaultBody/currentBody (for non-customized ones) depends on this
      } else {
        toastError(t('common.error'), res.error?.message ?? t('settings.messageTemplates.saveFailed'))
      }
    } catch {
      toastError(t('common.error'), t('settings.messageTemplates.saveFailed'))
    } finally {
      setLanguageSaving(false)
    }
  }

  async function handleSignatureChange(on: boolean) {
    const res = await api.settings.set({ key: SIGNATURE_SETTING_KEY, value: on ? 'true' : 'false' })
    if (!res.success) { toastError(t('common.error'), res.error?.message ?? t('settings.messageTemplates.saveFailed')); return }
    setSignatureOn(on)
    await load()
  }

  async function handleTogglePreview(key: string) {
    if (previewOpenKey === key) { setPreviewOpenKey(null); return }
    setPreviewOpenKey(key)
    try {
      const res = await api.messageTemplates.preview({ body: drafts[key] ?? '' })
      if (res.success) setPreviews((p) => ({ ...p, [key]: res.data as string }))
    } catch { /* preview is a convenience aid — a failure here just leaves the panel empty */ }
  }

  // Keeps the open preview panel in sync while the owner is still typing —
  // debounced so it isn't re-rendering on every keystroke.
  useEffect(() => {
    if (!previewOpenKey) return
    const timer = setTimeout(async () => {
      try {
        const res = await api.messageTemplates.preview({ body: drafts[previewOpenKey] ?? '' })
        if (res.success) setPreviews((p) => ({ ...p, [previewOpenKey]: res.data as string }))
      } catch { /* preview is a convenience aid */ }
    }, 300)
    return () => clearTimeout(timer)
  }, [previewOpenKey, drafts])

  const byVertical = useMemo(() => {
    const groups = new Map<string, TemplateRow[]>()
    for (const tpl of templates) {
      const list = groups.get(tpl.vertical) ?? []
      list.push(tpl)
      groups.set(tpl.vertical, list)
    }
    return [...groups.entries()]
  }, [templates])

  async function handleSave(key: string) {
    const body = drafts[key] ?? ''
    setSavingKey(key)
    try {
      const res = await api.messageTemplates.update({ key, body })
      if (res.success) {
        const refreshed = (res as { refreshed?: number }).refreshed ?? 0
        toastSuccess(t('settings.messageTemplates.savedTitle'), refreshed > 0 ? t('settings.messageTemplates.savedRefreshed', { count: refreshed }) : t('settings.messageTemplates.savedMessage'))
        await load()
      } else {
        toastError(t('common.error'), res.error?.message ?? t('settings.messageTemplates.saveFailed'))
      }
    } catch {
      toastError(t('common.error'), t('settings.messageTemplates.saveFailed'))
    } finally {
      setSavingKey(null)
    }
  }

  async function handleReset(key: string) {
    setSavingKey(key)
    try {
      const res = await api.messageTemplates.reset({ key })
      if (res.success) {
        toastSuccess(t('settings.messageTemplates.resetTitle'), t('settings.messageTemplates.resetMessage'))
        await load()
      } else {
        toastError(t('common.error'), res.error?.message ?? t('settings.messageTemplates.saveFailed'))
      }
    } catch {
      toastError(t('common.error'), t('settings.messageTemplates.saveFailed'))
    } finally {
      setSavingKey(null)
    }
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center justify-between gap-3 shrink-0 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-brand flex items-center justify-center">
            <MessageSquareText size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-dark dark:text-slate-100">{t('settings.messageTemplates.title')}</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t('settings.messageTemplates.subtitle')}</p>
          </div>
        </div>
        {canManage && (
          <div className="w-56">
            <Select
              label={t('settings.messageTemplates.reminderLanguageLabel')}
              value={reminderLanguage}
              disabled={languageSaving}
              onChange={(e) => handleReminderLanguageChange(e.target.value)}
            >
              {SUPPORTED_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>{l.nativeName} ({l.name})</option>
              ))}
            </Select>
          </div>
        )}
      </div>

      <div className="px-6 py-3 bg-brand/5 border-b border-brand/20 shrink-0 space-y-2">
        <p className="text-xs text-brand">{t('settings.messageTemplates.helpText')}</p>
        <p className="text-xs text-brand">{t('settings.messageTemplates.perLanguageNote')}</p>
        {canManage && (
          <label className="flex items-center gap-2 text-xs text-brand cursor-pointer">
            <input type="checkbox" checked={signatureOn} onChange={(e) => handleSignatureChange(e.target.checked)} className="w-4 h-4 accent-brand" />
            {t('settings.messageTemplates.signatureToggle')}
          </label>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-3">
            {byVertical.map(([vertical, items]) => {
              const isOpen = expandedVertical === vertical
              return (
                <Card key={vertical} padding="none">
                  <button
                    onClick={() => setExpandedVertical(isOpen ? null : vertical)}
                    className="w-full flex items-center justify-between px-4 py-3 text-start"
                  >
                    <div className="flex items-center gap-2">
                      {isOpen ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
                      <span className="text-sm font-semibold text-dark dark:text-slate-100">{vertical}</span>
                      <span className="text-xs text-slate-400">({items.length})</span>
                    </div>
                    {items.some((i) => i.isCustomized) && <Badge variant="success" size="sm">{t('settings.messageTemplates.customizedBadge')}</Badge>}
                  </button>
                  {isOpen && (
                    <div className="border-t border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                      {items.map((tpl) => (
                        <div key={tpl.key} className="px-4 py-3">
                          <div className="flex items-center gap-2 flex-wrap mb-1.5">
                            <span className="text-sm font-medium text-dark dark:text-slate-100">{tpl.label}</span>
                            {tpl.isCustomized && <Badge variant="success" size="sm">{t('settings.messageTemplates.customizedBadge')}</Badge>}
                            {!tpl.sendable && <Badge variant="neutral" size="sm">{t('settings.messageTemplates.internalOnlyBadge')}</Badge>}
                          </div>
                          <textarea
                            value={drafts[tpl.key] ?? ''}
                            onChange={(e) => setDrafts((d) => ({ ...d, [tpl.key]: e.target.value }))}
                            disabled={!canManage}
                            rows={3}
                            className="w-full text-sm text-dark dark:text-slate-100 bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2 border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-brand disabled:opacity-60"
                          />
                          {unknownTokens(drafts[tpl.key] ?? '', tpl.tokens).length > 0 && (
                            <p className="text-xs text-danger mt-1">{t('settings.messageTemplates.unknownTokens', { tokens: unknownTokens(drafts[tpl.key] ?? '', tpl.tokens).map((x) => `{{${x}}}`).join(', ') })}</p>
                          )}
                          <div className="flex items-center justify-between mt-2 gap-3">
                            <p className="text-[11px] text-slate-400 flex-1">
                              {t('settings.messageTemplates.tokensLabel')}: {tpl.tokens.map((tok) => (
                                <code key={tok} className="mx-0.5 px-1 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[10px]">{`{{${tok}}}`}</code>
                              ))}
                            </p>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <Button size="sm" variant="outline" onClick={() => handleTogglePreview(tpl.key)}>
                                {previewOpenKey === tpl.key ? <EyeOff size={12} className="me-1" /> : <Eye size={12} className="me-1" />}
                                {t('settings.messageTemplates.previewButton')}
                              </Button>
                              {canManage && (
                                <>
                                  {tpl.isCustomized && (
                                    <Button size="sm" variant="outline" onClick={() => handleReset(tpl.key)} loading={savingKey === tpl.key}>
                                      <RotateCcw size={12} className="me-1" /> {t('settings.messageTemplates.resetButton')}
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    onClick={() => handleSave(tpl.key)}
                                    loading={savingKey === tpl.key}
                                    disabled={(drafts[tpl.key] ?? '') === tpl.currentBody}
                                  >
                                    <Save size={12} className="me-1" /> {t('common.save')}
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                          {previewOpenKey === tpl.key && (
                            <div className="mt-2 rounded-lg border border-brand/20 bg-brand/5 px-3 py-2">
                              <p className="text-[10px] font-semibold text-brand uppercase tracking-wide mb-1">{t('settings.messageTemplates.previewHeading')}</p>
                              <p className="text-sm text-dark dark:text-slate-100 whitespace-pre-wrap">{previews[tpl.key] ?? '…'}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
