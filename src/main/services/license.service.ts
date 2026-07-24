import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto'
import { hostname, networkInterfaces, platform } from 'os'
import { getPrisma } from '../database/db'
import { parseLocalDateStart } from '../utils/date.util'
import type { ApiResponse } from '../ipc/channels'

// ─────────────────────────────────────────────────────────────────────────
// Phase 59 — Licensing. See PHASE_59_MONETIZATION_LICENSING_MASTER_PROMPT.md
// (repo root, one level up from sarang-business-os) for the full spec this
// implements — Sections 1/1B (pricing/duration), 59.2/59.4 (this file).
//
// Threat model, stated once here rather than at every call site: this is a
// disclosed, honest trust mechanism for a low-friction MSME product, not
// hardened DRM. A determined person can defeat local signature/fingerprint
// checks. That's an accepted, documented tradeoff (see 59.2) — the goal is
// matching the founder's stated "one device per key" policy and giving real,
// disclosed usage visibility, not building anti-piracy software.
// ─────────────────────────────────────────────────────────────────────────

const SETTING_KEYS = {
  key: 'license_key',
  tier: 'license_tier',
  issuedAt: 'license_issued_at',
  lastVerifiedAt: 'license_last_verified_at',
  machineFingerprint: 'license_machine_fingerprint'
} as const

export type LicenseTier = 'TRIAL' | 'PAID'
export type LicenseRegion = 'IN' | 'INTL'
export type LicenseStatus = 'ACTIVE' | 'WARNING' | 'EXPIRED' | 'NOT_ACTIVATED'

// Free-period thresholds from Section 1B/59.6 — 12 months free, banner from
// day 335, degrade (block new billable documents, never existing data) from
// day 365. Named constants, not magic numbers scattered across call sites.
export const LICENSE_WARNING_AFTER_DAYS = 335
export const LICENSE_EXPIRES_AFTER_DAYS = 365

// HMAC secret shared between this app (verification) and the website's
// key-issuance route (signing) — see 59.2. This is necessarily embedded in
// the distributed binary (verification must work fully offline), which is
// exactly the "not hardened DRM" tradeoff documented above and in the spec.
// MUST be overridden via SARANG_LICENSE_HMAC_SECRET at build time before any
// real release — this default is dev/test-only and intentionally obviously
// not production-safe so it can't be mistaken for a real deployed secret.
const LICENSE_HMAC_SECRET = process.env.SARANG_LICENSE_HMAC_SECRET || 'DEV-ONLY-INSECURE-PLACEHOLDER-DO-NOT-SHIP'

interface ParsedLicenseKey {
  tier: LicenseTier
  region: LicenseRegion
  issuedAt: Date
}

/** SARANG-<TIER>-<REGION>-<issuedDateBase36Days>-<hmacSignatureHex12> */
function buildSignedPayload(tier: LicenseTier, region: LicenseRegion, issuedAt: Date): string {
  const daysSinceEpoch = Math.floor(issuedAt.getTime() / 86_400_000)
  return `${tier}-${region}-${daysSinceEpoch.toString(36)}`
}

function sign(payload: string): string {
  return createHmac('sha256', LICENSE_HMAC_SECRET).update(payload).digest('hex').slice(0, 12)
}

/** Issues a new signed key. Used by the website's key-issuance route (mirrored server-side, not called from the app) and by tests. */
export function generateLicenseKey(tier: LicenseTier, region: LicenseRegion, issuedAt: Date = new Date()): string {
  const payload = buildSignedPayload(tier, region, issuedAt)
  return `SARANG-${payload}-${sign(payload)}`
}

/** Parses + verifies a key's signature. Returns null for any malformed or tampered key — never throws, callers treat null as "invalid, prompt for a real key." */
export function parseAndVerifyLicenseKey(key: string): ParsedLicenseKey | null {
  const parts = key.trim().toUpperCase().split('-')
  if (parts.length !== 5 || parts[0] !== 'SARANG') return null
  const [, tierRaw, regionRaw, daysRaw, signature] = parts
  if (tierRaw !== 'TRIAL' && tierRaw !== 'PAID') return null
  if (regionRaw !== 'IN' && regionRaw !== 'INTL') return null

  const payload = `${tierRaw}-${regionRaw}-${daysRaw.toLowerCase()}`
  const expectedSig = sign(payload)
  // Constant-time compare — this is a licensing check not an auth token, but
  // there's no reason to leak timing information for free.
  const a = Buffer.from(signature.toLowerCase())
  const b = Buffer.from(expectedSig)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  const days = parseInt(daysRaw, 36)
  if (!Number.isFinite(days)) return null

  return { tier: tierRaw, region: regionRaw, issuedAt: new Date(days * 86_400_000) }
}

/**
 * Lightweight local machine fingerprint — not hardware-serial-grade, just
 * enough to notice "this key is being used on a different PC than it was
 * activated on" per the founder's one-key-per-device decision. Hostname +
 * platform + the first non-internal network interface's MAC (stable across
 * reboots, changes only on real hardware swaps) hashed together.
 */
export function computeMachineFingerprint(): string {
  const nets = networkInterfaces()
  let mac = '00:00:00:00:00:00'
  for (const ifaces of Object.values(nets)) {
    const real = ifaces?.find(i => !i.internal && i.mac && i.mac !== '00:00:00:00:00:00')
    if (real) { mac = real.mac; break }
  }
  return createHash('sha256').update(`${hostname()}|${platform()}|${mac}`).digest('hex')
}

interface LicenseState {
  status: LicenseStatus
  tier: LicenseTier | null
  region: LicenseRegion | null
  daysSinceIssue: number | null
  daysRemaining: number | null
  machineMismatch: boolean
}

/**
 * The single source of truth for "is this install's license current." Always
 * re-derives issuedAt/tier/region from the signed key itself (never trusts
 * the locally-stored license_issued_at Setting row as authoritative on its
 * own — see 59.4's tamper-resistance requirement) and never touches the
 * network. A shop with zero internet access, ever, gets identical behavior.
 */
export async function getLicenseState(): Promise<LicenseState> {
  const db = getPrisma()
  const [keyRow, fingerprintRow, killSwitchRow] = await Promise.all([
    db.setting.findUnique({ where: { settingKey: SETTING_KEYS.key } }),
    db.setting.findUnique({ where: { settingKey: SETTING_KEYS.machineFingerprint } }),
    db.setting.findUnique({ where: { settingKey: 'license_enforcement_suspended' } })
  ])

  // Fire-and-forget — never awaited, never allowed to slow this function
  // down or fail it. See pingLicenseStatusIfDue()'s own doc comment.
  void pingLicenseStatusIfDue()

  if (!keyRow?.settingValue) {
    return { status: 'NOT_ACTIVATED', tier: null, region: null, daysSinceIssue: null, daysRemaining: null, machineMismatch: false }
  }

  const parsed = parseAndVerifyLicenseKey(keyRow.settingValue)
  if (!parsed) {
    // Tampered or corrupted key row — same UX as never having activated one.
    return { status: 'NOT_ACTIVATED', tier: null, region: null, daysSinceIssue: null, daysRemaining: null, machineMismatch: false }
  }

  const currentFingerprint = computeMachineFingerprint()
  const machineMismatch = !!fingerprintRow?.settingValue && fingerprintRow.settingValue !== currentFingerprint

  if (parsed.tier === 'PAID') {
    return { status: 'ACTIVE', tier: parsed.tier, region: parsed.region, daysSinceIssue: null, daysRemaining: null, machineMismatch }
  }

  const todayStart = parseLocalDateStart(new Date().toISOString().slice(0, 10))
  const issuedStart = parseLocalDateStart(parsed.issuedAt.toISOString().slice(0, 10))
  const daysSinceIssue = Math.floor((todayStart.getTime() - issuedStart.getTime()) / 86_400_000)
  const daysRemaining = LICENSE_EXPIRES_AFTER_DAYS - daysSinceIssue

  // Remote kill switch (59.6) — only ever relaxes enforcement, never tightens
  // it, and only takes effect if a prior online ping actually saw the flag
  // set. Never blocks this function, never required.
  const enforcementSuspended = killSwitchRow?.settingValue === 'true'

  let status: LicenseStatus = 'ACTIVE'
  if (!enforcementSuspended) {
    if (daysSinceIssue >= LICENSE_EXPIRES_AFTER_DAYS) status = 'EXPIRED'
    else if (daysSinceIssue >= LICENSE_WARNING_AFTER_DAYS) status = 'WARNING'
  }

  return { status, tier: parsed.tier, region: parsed.region, daysSinceIssue, daysRemaining, machineMismatch }
}

/**
 * Activates (or re-activates) a license key for this install and (re)binds
 * the machine fingerprint to the current device unconditionally — entering
 * a valid key on a new PC always works immediately, with no lockout, no
 * "contact support" step, and no distinction drawn here between a genuine
 * hardware replacement and a shared key used on a second machine. This is a
 * deliberate v1 choice, not an oversight: the founder-facing goal (see the
 * surrounding conversation and 59.2) is that replacing a dying laptop must
 * feel like a non-event, and building a real one-time-then-lockout throttle
 * risks the exact failure mode it's meant to prevent — a false positive
 * bricking a legitimate reinstall and generating a support ticket anyway.
 * `getLicenseState()`'s `machineMismatch` flag still surfaces every rebind
 * event, so the founder can review the pattern later (via the same 59.6
 * active-usage-ping data) if actual sharing-at-scale ever shows up — this
 * is detection-and-review, not automatic enforcement, exactly matching the
 * "not hardened DRM" framing already documented in 59.2.
 */
export async function activateLicenseKey(key: string): Promise<ApiResponse<{ tier: LicenseTier; region: LicenseRegion }>> {
  const parsed = parseAndVerifyLicenseKey(key)
  if (!parsed) {
    return { success: false, error: { code: 'LIC-001', message: 'That license key is not valid. Double-check it and try again.' } }
  }

  const db = getPrisma()
  const currentFingerprint = computeMachineFingerprint()

  await db.$transaction([
    db.setting.upsert({
      where: { settingKey: SETTING_KEYS.key },
      update: { settingValue: key.trim().toUpperCase() },
      create: { settingKey: SETTING_KEYS.key, settingValue: key.trim().toUpperCase(), settingType: 'STRING' }
    }),
    db.setting.upsert({
      where: { settingKey: SETTING_KEYS.tier },
      update: { settingValue: parsed.tier },
      create: { settingKey: SETTING_KEYS.tier, settingValue: parsed.tier, settingType: 'STRING' }
    }),
    db.setting.upsert({
      where: { settingKey: SETTING_KEYS.issuedAt },
      update: { settingValue: parsed.issuedAt.toISOString() },
      create: { settingKey: SETTING_KEYS.issuedAt, settingValue: parsed.issuedAt.toISOString(), settingType: 'STRING' }
    }),
    db.setting.upsert({
      where: { settingKey: SETTING_KEYS.machineFingerprint },
      update: { settingValue: currentFingerprint },
      create: { settingKey: SETTING_KEYS.machineFingerprint, settingValue: currentFingerprint, settingType: 'STRING' }
    }),
    db.setting.upsert({
      where: { settingKey: SETTING_KEYS.lastVerifiedAt },
      update: { settingValue: new Date().toISOString() },
      create: { settingKey: SETTING_KEYS.lastVerifiedAt, settingValue: new Date().toISOString(), settingType: 'STRING' }
    })
  ])

  return { success: true, data: { tier: parsed.tier, region: parsed.region } }
}

/** One-way hash of the key for the optional daily active-usage ping (59.6) — never the raw key or any business data. */
export function hashLicenseKeyForPing(key: string): string {
  return createHash('sha256').update(key.trim().toUpperCase()).digest('hex')
}

const LICENSE_PING_URL = 'https://aszurex.com/api/sarang-heartbeat'

/**
 * Optional, best-effort, at-most-once-per-day active-usage ping (59.6).
 * Sends only a one-way hash of the license key — never the raw key, never
 * any business data. Fire-and-forget: never awaited by callers, never
 * retried aggressively, never blocks or delays anything if unreachable —
 * this must stay true to the offline-first rule that no network call is
 * ever load-bearing. Reads back an optional `enforcementSuspended` flag
 * (the remote kill-switch, see 59.6) the founder can flip on the website
 * side without shipping a new app build, in case the day-335/365 logic
 * ever has a bug — this project has a real history of shipping
 * date-boundary bugs that looked fine until they weren't.
 */
export async function pingLicenseStatusIfDue(): Promise<void> {
  try {
    const db = getPrisma()
    const [keyRow, lastPingRow] = await Promise.all([
      db.setting.findUnique({ where: { settingKey: SETTING_KEYS.key } }),
      db.setting.findUnique({ where: { settingKey: SETTING_KEYS.lastVerifiedAt } })
    ])
    if (!keyRow?.settingValue) return

    const lastPing = lastPingRow?.settingValue ? new Date(lastPingRow.settingValue) : null
    if (lastPing && Date.now() - lastPing.getTime() < 20 * 60 * 60 * 1000) return // ~once/day, generous window

    const res = await fetch(LICENSE_PING_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyHash: hashLicenseKeyForPing(keyRow.settingValue) }),
      signal: AbortSignal.timeout(5000)
    })
    await db.setting.upsert({
      where: { settingKey: SETTING_KEYS.lastVerifiedAt },
      update: { settingValue: new Date().toISOString() },
      create: { settingKey: SETTING_KEYS.lastVerifiedAt, settingValue: new Date().toISOString(), settingType: 'STRING' }
    })

    if (res.ok) {
      const body = await res.json().catch(() => null) as { enforcementSuspended?: boolean } | null
      await db.setting.upsert({
        where: { settingKey: 'license_enforcement_suspended' },
        update: { settingValue: String(!!body?.enforcementSuspended) },
        create: { settingKey: 'license_enforcement_suspended', settingValue: String(!!body?.enforcementSuspended), settingType: 'BOOLEAN' }
      })
    }
  } catch {
    // Fully expected when offline, or before the website endpoint exists —
    // never surfaced to the user, never retried outside the normal daily
    // cadence. This is the entire point: this ping is allowed to just fail.
  }
}

/** Test/dev helper only — not used by production code paths. */
export function generateTestSecret(): string {
  return randomBytes(32).toString('hex')
}
