import { getPrisma } from '../database/db'
import { getSetting } from './settings.service'
import { MESSAGE_TEMPLATE_DEFS, MESSAGE_TEMPLATE_DEFAULTS_BY_KEY, SAMPLE_TOKEN_VALUES } from './message-template.defaults'
import { substitute, templateProblemMessage, rerenderMessage, stripSignature } from './message-tokens.util'

// A dedicated BUSINESS-level setting, deliberately separate from each staff
// member's own UI display language (src/renderer/src/i18n/index.ts's
// `sarang_lang`, per-device localStorage only, never reaches the main
// process). What language a shop's WhatsApp reminders go out in is a
// business decision customers see — it shouldn't silently change because
// one cashier's own screen happens to be set to English. Defaults to 'en'
// when never explicitly set, matching every default body's existing
// (English) wording.
const REMINDER_LANGUAGE_SETTING_KEY = 'reminder_message_language'

async function getReminderMessageLanguage(): Promise<string> {
  try {
    const res = await getSetting(REMINDER_LANGUAGE_SETTING_KEY)
    return (res.success && typeof res.data === 'string' && res.data) ? res.data : 'en'
  } catch {
    return 'en'
  }
}

/** The default body for one template key in the business's chosen reminder-message language, falling back to English. */
function resolveLocalizedDefault(key: string, lang: string): string {
  const def = MESSAGE_TEMPLATE_DEFAULTS_BY_KEY[key]
  if (!def) return ''
  if (lang === 'en') return def.defaultBody
  return def.defaultBodyByLocale?.[lang as keyof typeof def.defaultBodyByLocale] ?? def.defaultBody
}

/**
 * Owner-editable WhatsApp message templates — every reminder/share message
 * this app can send, across every business vertical, made customizable in
 * one place instead of 25+ hardcoded literals scattered across service
 * files. See message-template.defaults.ts for the full catalog and
 * schema.prisma's MessageTemplate model for the sparse-override design.
 */

// Owners may switch off the closing "Powered by Sarang" line. On by default.
export const SIGNATURE_SETTING_KEY = 'message_signature_enabled'

async function signatureEnabled(): Promise<boolean> {
  try {
    const res = await getSetting(SIGNATURE_SETTING_KEY)
    return !(res.success && res.data === 'false')
  } catch {
    return true
  }
}

/** Stored override keys are "KEY" (any language) or "KEY@hi" (one language); the language-specific one wins. */
export function overrideKeysFor(key: string, lang: string): string[] {
  return lang === 'en' ? [key] : [`${key}@${lang}`, key]
}

/** The current effective body for one template key: the owner's wording for the reminder language, else their wording for any language, else the built-in default in that language (English if never set). */
export async function getEffectiveTemplateBody(key: string): Promise<string> {
  const def = MESSAGE_TEMPLATE_DEFAULTS_BY_KEY[key]
  const englishFallback = def?.defaultBody ?? ''
  try {
    const db = getPrisma()
    const lang = await getReminderMessageLanguage()
    const rows = await db.messageTemplate.findMany({ where: { templateKey: { in: overrideKeysFor(key, lang) } } })
    const row = overrideKeysFor(key, lang).map((k) => rows.find((r) => r.templateKey === k)).find(Boolean)
    const body = row ? row.body : (resolveLocalizedDefault(key, lang) || englishFallback)
    return (await signatureEnabled()) ? body : stripSignature(body)
  } catch {
    return englishFallback
  }
}

/** Renders a template body against SAMPLE_TOKEN_VALUES for a live "what would this look like" preview — never sent anywhere, purely a Settings-screen aid. Any token the sample set doesn't cover (shouldn't happen for a catalog key; possible for a not-yet-saved draft with a typo'd token) is left as literal `{{token}}` text, same behavior as the real substitute(). */
export function previewMessageTemplate(body: string): string {
  return substitute(body, SAMPLE_TOKEN_VALUES)
}

/** Renders a message template with the given placeholder values — the drop-in replacement for every hardcoded `Dear ${name}, ...` literal this app used to build inline. */
export async function renderMessageTemplate(key: string, params: Record<string, string>): Promise<string> {
  const body = await getEffectiveTemplateBody(key)
  return substitute(body, params)
}

export interface MessageTemplateListItem {
  key: string
  vertical: string
  label: string
  tokens: string[]
  sendable: boolean
  defaultBody: string
  currentBody: string
  isCustomized: boolean
}

export async function listMessageTemplates(): Promise<{ success: true; data: MessageTemplateListItem[] } | { success: false; error: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const lang = await getReminderMessageLanguage()
    const withSignature = await signatureEnabled()
    const shown = (text: string) => (withSignature ? text : stripSignature(text))
    const overrides = await db.messageTemplate.findMany()
    const overrideByKey = new Map(overrides.map((o) => [o.templateKey, o.body]))
    const data: MessageTemplateListItem[] = MESSAGE_TEMPLATE_DEFS.map((def) => {
      const override = overrideKeysFor(def.key, lang).map((k) => overrideByKey.get(k)).find((b) => b !== undefined)
      const localizedDefault = shown(resolveLocalizedDefault(def.key, lang))
      return {
        key: def.key, vertical: def.vertical, label: def.label, tokens: def.tokens, sendable: def.sendable,
        defaultBody: localizedDefault, currentBody: override !== undefined ? shown(override) : localizedDefault, isCustomized: override !== undefined,
      }
    })
    return { success: true, data }
  } catch (err) {
    return { success: false, error: { code: 'MSGTPL-001', message: err instanceof Error ? err.message : 'Could not list message templates.' } }
  }
}

/**
 * Runs a change to templates or template settings, then brings every reminder still waiting in the queue up to date
 * so it reads the way the new wording says. Reminders whose text can no longer be matched to their template are left as they were.
 */
export async function withPendingRefresh<T>(change: () => Promise<T>): Promise<{ result: T; refreshed: number; untouched: number }> {
  const db = getPrisma()
  const pending = await db.notificationQueue.findMany({ where: { status: 'PENDING' }, select: { id: true, notificationType: true, templateBody: true, customerPhone: true } })
  const keys = [...new Set(pending.map((r) => r.notificationType).filter((k) => MESSAGE_TEMPLATE_DEFAULTS_BY_KEY[k]))]
  const before = new Map<string, string>()
  for (const k of keys) before.set(k, await getEffectiveTemplateBody(k))
  const result = await change()
  let refreshed = 0
  let untouched = 0
  const { buildReminderWhatsAppLink } = await import('./notification-queue.service')
  for (const row of pending) {
    const oldBody = before.get(row.notificationType)
    if (oldBody === undefined) continue
    const newBody = await getEffectiveTemplateBody(row.notificationType)
    if (newBody === oldBody) continue
    const text = rerenderMessage(oldBody, newBody, row.templateBody)
    if (text === null) { untouched++; continue }
    const link = row.customerPhone ? await buildReminderWhatsAppLink(row.customerPhone, text) : null
    await db.notificationQueue.update({ where: { id: row.id }, data: { templateBody: text, ...(link ? { whatsappLink: link } : {}) } })
    refreshed++
  }
  return { result, refreshed, untouched }
}

type Outcome = { success: true; refreshed?: number; untouched?: number } | { success: false; error: { code: string; message: string } }

export async function updateMessageTemplate(key: string, body: string): Promise<Outcome> {
  const def = MESSAGE_TEMPLATE_DEFAULTS_BY_KEY[key]
  if (!def) {
    return { success: false, error: { code: 'MSGTPL-002', message: 'Unknown template key.' } }
  }
  const trimmed = body.trim()
  if (!trimmed) {
    return { success: false, error: { code: 'MSGTPL-003', message: 'The message cannot be empty.' } }
  }
  const problem = templateProblemMessage(trimmed, def.tokens)
  if (problem) return { success: false, error: { code: 'MSGTPL-007', message: problem } }
  try {
    const db = getPrisma()
    const lang = await getReminderMessageLanguage()
    const storeKey = overrideKeysFor(key, lang)[0]
    const { refreshed, untouched } = await withPendingRefresh(() => db.messageTemplate.upsert({
      where: { templateKey: storeKey },
      create: { templateKey: storeKey, body: trimmed },
      update: { body: trimmed },
    }))
    return { success: true, refreshed, untouched }
  } catch (err) {
    return { success: false, error: { code: 'MSGTPL-004', message: err instanceof Error ? err.message : 'Could not save the template.' } }
  }
}

export async function resetMessageTemplate(key: string): Promise<Outcome> {
  try {
    const db = getPrisma()
    const lang = await getReminderMessageLanguage()
    // Removes the wording that is in effect right now: the language-specific one if there is one, else the any-language one.
    const existing = await db.messageTemplate.findMany({ where: { templateKey: { in: overrideKeysFor(key, lang) } }, select: { templateKey: true } })
    const storeKey = overrideKeysFor(key, lang).find((k) => existing.some((e) => e.templateKey === k)) ?? key
    const { refreshed, untouched } = await withPendingRefresh(() => db.messageTemplate.deleteMany({ where: { templateKey: storeKey } }))
    return { success: true, refreshed, untouched }
  } catch (err) {
    return { success: false, error: { code: 'MSGTPL-005', message: err instanceof Error ? err.message : 'Could not reset the template.' } }
  }
}
