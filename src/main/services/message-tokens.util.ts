// Helpers for the {{token}} placeholders in message templates.

const TOKEN = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g

/** Same plain substitution the templates have always used. A token with no value is left as text. */
export function substitute(template: string, params: Record<string, string>): string {
  let out = template
  for (const [k, v] of Object.entries(params)) out = out.split(`{{${k}}}`).join(v)
  return out
}

/** Problems in a template body: tokens the message can never fill in, and braces that do not pair up. */
export function checkTemplateBody(body: string, allowed: string[]): { unknown: string[]; malformed: boolean } {
  const unknown = new Set<string>()
  for (const m of body.matchAll(TOKEN)) if (!allowed.includes(m[1])) unknown.add(m[1])
  const stripped = body.replace(TOKEN, '')
  return { unknown: [...unknown], malformed: /\{\{|\}\}|\{[A-Za-z0-9_]+\}/.test(stripped) }
}

export function templateProblemMessage(body: string, allowed: string[]): string | null {
  const { unknown, malformed } = checkTemplateBody(body, allowed)
  if (unknown.length > 0) return `These placeholders are not available in this message: ${unknown.map((u) => `{{${u}}}`).join(', ')}. Available: ${allowed.map((a) => `{{${a}}}`).join(', ') || 'none'}.`
  if (malformed) return 'A placeholder is not written correctly. Placeholders look like {{name}} with two curly brackets on each side.'
  return null
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Reads back the values that were put into `oldBody` to make `rendered`. Null when the text no longer fits the template. */
export function extractParams(oldBody: string, rendered: string): Record<string, string> | null {
  const names: string[] = []
  let pattern = ''
  let last = 0
  for (const m of oldBody.matchAll(TOKEN)) {
    pattern += escapeRegex(oldBody.slice(last, m.index))
    pattern += '([\\s\\S]*?)'
    names.push(m[1])
    last = (m.index ?? 0) + m[0].length
  }
  pattern += escapeRegex(oldBody.slice(last))
  const match = new RegExp(`^${pattern}$`).exec(rendered)
  if (!match) return null
  const params: Record<string, string> = {}
  names.forEach((n, i) => { if (!(n in params)) params[n] = match[i + 1] })
  // The values must rebuild the exact same text, otherwise the split was ambiguous.
  return substitute(oldBody, params) === rendered ? params : null
}

/** The message as it would read under `newBody`, or null when it cannot be worked out (a new placeholder with no known value). */
export function rerenderMessage(oldBody: string, newBody: string, rendered: string): string | null {
  const params = extractParams(oldBody, rendered)
  if (!params) return null
  const out = substitute(newBody, params)
  return /\{\{\s*[A-Za-z0-9_]+\s*\}\}/.test(out) ? null : out
}

const SIGNATURE = /[\s—–-]*Powered by Sarang(?:\s*\|\s*www\.aszurex\.com)?\s*$/i

/** Removes the closing "Powered by Sarang | www.aszurex.com" line from a message body. */
export function stripSignature(body: string): string {
  return body.replace(SIGNATURE, '').trimEnd()
}

/** "KEY@hi" -> { key: "KEY", lang: "hi" }; "KEY" -> { key: "KEY", lang: null }. */
export function splitTemplateKey(stored: string): { key: string; lang: string | null } {
  const i = stored.indexOf('@')
  return i < 0 ? { key: stored, lang: null } : { key: stored.slice(0, i), lang: stored.slice(i + 1) }
}
