import { app } from 'electron'
import { join, resolve, relative, isAbsolute } from 'path'

/**
 * Security guard for BusinessProfile.logoPath.
 *
 * logoPath is meant to reference only files this app itself wrote into
 * userData/logos/ via the app:pickAndCopyFile upload flow (app.handler.ts).
 * It must never be trusted as an arbitrary renderer-supplied string:
 *   - print.service.ts interpolates it UNESCAPED into every generated
 *     invoice/payslip/quotation/credit-note/debit-note HTML template
 *     (`<img src="${logoToFileUrl(profile.logoPath)}">`) — an unrestricted
 *     value could break out of the attribute and inject arbitrary HTML.
 *   - auth.handler.ts's businessProfile:update unlink()s the *previous*
 *     logoPath whenever it changes to a different value — an unrestricted
 *     value would let a single crafted profile update cause the app to
 *     delete an arbitrary file on the owner's machine on the NEXT save.
 *
 * Both risks collapse to one root cause: logoPath was validated only as
 * "a string under 1000 chars", never as "a path actually inside the logos
 * folder this app manages". This restores that containment check.
 */
export function isValidLogoPath(p: string | null | undefined): boolean {
  if (!p) return true // null/empty clears the logo — always allowed
  const logoDir = resolve(join(app.getPath('userData'), 'logos'))
  const resolved = resolve(p)
  const rel = relative(logoDir, resolved)
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}
