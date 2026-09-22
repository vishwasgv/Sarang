import { getPrisma } from '../database/db'
import { getSetting } from './settings.service'
import { MESSAGE_TEMPLATE_DEFS, MESSAGE_TEMPLATE_DEFAULTS_BY_KEY, SAMPLE_TOKEN_VALUES } from './message-template.defaults'

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

// Same {{token}} split/join substitution already proven in
// src/main/i18n/dashboardAlerts.ts — deliberately not a templating library
// for a handful of plain substitutions. A {{token}} the caller doesn't
// supply a value for is left as literal text in the output rather than
// silently stripped or thrown on, so an owner who mistypes a token in the
// editor sees their own mistake in the resulting message instead of a
// vanished word.
function substitute(template: string, params: Record<string, string>): string {
  let out = template
  for (const [k, v] of Object.entries(params)) {
    out = out.split(`{{${k}}}`).join(v)
  }
  return out
}

/** The current effective body for one template key — a DB override if the owner customized it, else the built-in default in the business's chosen reminder-message language (English if never set). */
export async function getEffectiveTemplateBody(key: string): Promise<string> {
  const def = MESSAGE_TEMPLATE_DEFAULTS_BY_KEY[key]
  const englishFallback = def?.defaultBody ?? ''
  try {
    const db = getPrisma()
    const row = await db.messageTemplate.findUnique({ where: { templateKey: key } })
    if (row) return row.body
    const lang = await getReminderMessageLanguage()
    return resolveLocalizedDefault(key, lang) || englishFallback
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
    const overrides = await db.messageTemplate.findMany()
    const overrideByKey = new Map(overrides.map((o) => [o.templateKey, o.body]))
    const data: MessageTemplateListItem[] = MESSAGE_TEMPLATE_DEFS.map((def) => {
      const override = overrideByKey.get(def.key)
      const localizedDefault = resolveLocalizedDefault(def.key, lang)
      return {
        key: def.key, vertical: def.vertical, label: def.label, tokens: def.tokens, sendable: def.sendable,
        defaultBody: localizedDefault, currentBody: override ?? localizedDefault, isCustomized: override !== undefined,
      }
    })
    return { success: true, data }
  } catch (err) {
    return { success: false, error: { code: 'MSGTPL-001', message: err instanceof Error ? err.message : 'Could not list message templates.' } }
  }
}

export async function updateMessageTemplate(key: string, body: string): Promise<{ success: true } | { success: false; error: { code: string; message: string } }> {
  if (!MESSAGE_TEMPLATE_DEFAULTS_BY_KEY[key]) {
    return { success: false, error: { code: 'MSGTPL-002', message: 'Unknown template key.' } }
  }
  const trimmed = body.trim()
  if (!trimmed) {
    return { success: false, error: { code: 'MSGTPL-003', message: 'The message cannot be empty.' } }
  }
  try {
    const db = getPrisma()
    await db.messageTemplate.upsert({
      where: { templateKey: key },
      create: { templateKey: key, body: trimmed },
      update: { body: trimmed },
    })
    return { success: true }
  } catch (err) {
    return { success: false, error: { code: 'MSGTPL-004', message: err instanceof Error ? err.message : 'Could not save the template.' } }
  }
}

export async function resetMessageTemplate(key: string): Promise<{ success: true } | { success: false; error: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    await db.messageTemplate.deleteMany({ where: { templateKey: key } })
    return { success: true }
  } catch (err) {
    return { success: false, error: { code: 'MSGTPL-005', message: err instanceof Error ? err.message : 'Could not reset the template.' } }
  }
}
