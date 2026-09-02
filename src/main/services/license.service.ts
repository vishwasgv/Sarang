import { createHash, createHmac, createPublicKey, randomBytes, timingSafeEqual, verify as cryptoVerify, sign as cryptoSign } from 'crypto'
import { hostname, networkInterfaces, platform } from 'os'
import { getPrisma } from '../database/db'
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
  machineFingerprint: 'license_machine_fingerprint',
  enforcementSuspended: 'license_enforcement_suspended',
  revocationToken: 'license_revocation_token'
} as const

// These Setting rows must only ever be written by this file's own functions
// — never by the generic settings:set IPC channel (settings.service.ts's
// setSetting() checks against this set), which has no per-key allowlist.
export const LICENSE_INTERNAL_SETTING_KEYS: ReadonlySet<string> = new Set(Object.values(SETTING_KEYS))

export type LicenseTier = 'TRIAL' | 'PAID'
export type LicenseRegion = 'IN' | 'INTL'
export type LicenseStatus = 'ACTIVE' | 'WARNING' | 'EXPIRED' | 'NOT_ACTIVATED'

// 2026-09-01 — trial length changed from 365 to 100 days (founder decision).
// A PAID key's cycle stays a genuine annual renewal (365 days, matching the
// "/year" pricing shown everywhere) — the two tiers now run on separate
// cycle lengths, whereas before 2026-09-01 they deliberately shared one (see
// the 2026-07-28 note on getLicenseState() below for why that unification
// existed in the first place: PAID must still actually expire, not renew for
// free forever). Both tiers keep the same 30-day warning window before their
// own expiry — LICENSE_WARNING_WINDOW_DAYS is exported separately so
// analytics.service.ts's severity math doesn't need to know which tier it's
// looking at. Named constants, not magic numbers scattered across call sites.
export const LICENSE_WARNING_WINDOW_DAYS = 30
export const LICENSE_TRIAL_EXPIRES_AFTER_DAYS = 100
export const LICENSE_TRIAL_WARNING_AFTER_DAYS = LICENSE_TRIAL_EXPIRES_AFTER_DAYS - LICENSE_WARNING_WINDOW_DAYS
export const LICENSE_PAID_EXPIRES_AFTER_DAYS = 365
export const LICENSE_PAID_WARNING_AFTER_DAYS = LICENSE_PAID_EXPIRES_AFTER_DAYS - LICENSE_WARNING_WINDOW_DAYS

// HMAC secret shared between this app (verification) and the website's
// key-issuance route (signing) — see 59.2. This is necessarily embedded in
// the distributed binary (verification must work fully offline), which is
// exactly the "not hardened DRM" tradeoff documented above and in the spec.
// MUST be overridden via SARANG_LICENSE_HMAC_SECRET at build time before any
// real release — this default is dev/test-only and intentionally obviously
// not production-safe so it can't be mistaken for a real deployed secret.
const LICENSE_HMAC_SECRET = process.env.SARANG_LICENSE_HMAC_SECRET || 'DEV-ONLY-INSECURE-PLACEHOLDER-DO-NOT-SHIP'

// Ed25519 is asymmetric — unlike LICENSE_HMAC_SECRET, this PUBLIC key is
// safe to embed; extracting it gives no way to mint new keys, only to
// verify ones signed by the private key (website-only, never shipped).
// Dev default below is a real, valid public key so createPublicKey() never
// throws — its matching private key is a throwaway test value.
const LICENSE_ED25519_PUBLIC_KEY_PEM = process.env.SARANG_LICENSE_ED25519_PUBLIC_KEY_PEM
  || '-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAMgopXjPtcF4Q7sU8uRUa26nE2FrPjVAj+2kml/jhgu0=\n-----END PUBLIC KEY-----\n'

interface ParsedLicenseKey {
  tier: LicenseTier
  region: LicenseRegion
  issuedAt: Date
}

/**
 * SARANG-<TIER>-<REGION>-<issuedDateBase36Days>-<nonceHex6>-<hmacSignatureHex12>
 *
 * Real bug found+fixed 2026-07-29: the payload used to be built from only
 * TIER-REGION-DAYS — three inputs with no per-request entropy at all, and
 * HMAC-SHA256 is deterministic, so any two people issued a key for the same
 * tier+region on the same *calendar day* (the timestamp component is already
 * floored to day granularity for the 335/365-day trial math — see below)
 * got the byte-for-byte identical key string. Not a shared-on-purpose key
 * (that's a separate, already-documented, accepted risk — see
 * activateLicenseKey()'s doc comment) but two total strangers issued the
 * same "unique" license by the system itself: undermines one-key-per-device
 * between people who never chose to share anything, merges unrelated
 * customers' usage-ping data under one hash, and would collateral-damage an
 * unrelated same-day customer if a refund's kill-switch revocation is ever
 * keyed by hash. Fixed with a random nonce, added as its own payload segment
 * rather than increasing timestamp precision — keeps the day-granularity
 * date math this file's trial/renewal logic already depends on completely
 * unchanged, and is the more conventional "just add a serial" fix. Old
 * 5-part keys (no nonce) — already issued and emailed to real signups before
 * this fix — must keep validating forever, never invalidated; see the
 * two-shape handling in parseAndVerifyLicenseKey() below.
 */
function buildSignedPayload(tier: LicenseTier, region: LicenseRegion, issuedAt: Date, nonce: string): string {
  const daysSinceEpoch = Math.floor(issuedAt.getTime() / 86_400_000)
  return `${tier}-${region}-${daysSinceEpoch.toString(36)}-${nonce}`
}

function sign(payload: string): string {
  return createHmac('sha256', LICENSE_HMAC_SECRET).update(payload).digest('hex').slice(0, 12)
}

// Lazy + cached — createPublicKey() throws on malformed PEM, so this defers
// that to first use rather than crashing the module at import time.
let cachedEd25519PublicKey: ReturnType<typeof createPublicKey> | null | undefined
function getEd25519PublicKey(): ReturnType<typeof createPublicKey> | null {
  if (cachedEd25519PublicKey !== undefined) return cachedEd25519PublicKey
  try {
    cachedEd25519PublicKey = createPublicKey(LICENSE_ED25519_PUBLIC_KEY_PEM)
  } catch {
    cachedEd25519PublicKey = null
  }
  return cachedEd25519PublicKey
}

/** Verifies an Ed25519 signature (full 128-hex-char, never truncated — see the SARANG2 format doc comment below). Never throws. */
function verifyEd25519(payload: string, sigHex: string): boolean {
  const publicKey = getEd25519PublicKey()
  if (!publicKey) return false
  if (!/^[0-9a-f]{128}$/i.test(sigHex)) return false
  try {
    return cryptoVerify(null, Buffer.from(payload), publicKey, Buffer.from(sigHex, 'hex'))
  } catch {
    return false
  }
}

// license_enforcement_suspended used to be a bare 'true'/'false' string —
// now a signed token in the same shape as a license key, so a hand-edited
// Setting row is cryptographically ignored, not just permission-gated.
function buildKillSwitchPayload(suspended: boolean, issuedAt: Date): string {
  const daysSinceEpoch = Math.floor(issuedAt.getTime() / 86_400_000)
  return `KILLSWITCH-${suspended ? 1 : 0}-${daysSinceEpoch.toString(36)}`
}

/** Issues a signed kill-switch token. Used by the website's /api/sarang-heartbeat route (mirrored server-side) and by tests. */
export function signKillSwitchToken(suspended: boolean, issuedAt: Date = new Date()): string {
  const payload = buildKillSwitchPayload(suspended, issuedAt)
  return `SARANG-${payload}-${sign(payload)}`
}

/**
 * Null for anything malformed/tampered/unsigned — callers must treat that
 * as "not suspended." No staleness check by design: the kill switch only
 * ever relaxes enforcement, so a legitimate token should be honored offline
 * forever, like a license key — adding one would reintroduce a network
 * dependency.
 */
export function parseAndVerifyKillSwitchToken(token: string | null | undefined): { suspended: boolean } | null {
  if (!token) return null
  const parts = token.trim().toUpperCase().split('-')
  if (parts[0] !== 'SARANG' || parts[1] !== 'KILLSWITCH' || parts.length !== 5) return null

  const suspendedRaw = parts[2]
  const daysRaw = parts[3]
  const signature = parts[4]
  if (suspendedRaw !== '0' && suspendedRaw !== '1') return null

  const payload = `KILLSWITCH-${suspendedRaw}-${daysRaw.toLowerCase()}`
  const expectedSig = sign(payload)
  const a = Buffer.from(signature.toLowerCase())
  const b = Buffer.from(expectedSig)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  return { suspended: suspendedRaw === '1' }
}

// Per-key revocation (2026-09-02) — the founder's answer to "the same key
// works on unlimited devices forever": a key spotted on an unusual number of
// distinct devices (via the device-activation Sheet) can be flagged revoked
// on the website, and every device that shares it eventually finds out on
// its next successful daily ping and drops to EXPIRED — same non-destructive
// enforcement as a normal expiry, never a data lock. The token embeds the
// key's own hash so it can never be replayed onto a different key, closing
// the obvious griefing hole a bare boolean would have.
function buildRevocationPayload(keyHash: string): string {
  return `REVOKE-${keyHash.toLowerCase()}`
}

/** Issues a signed revocation token for one specific key (by its hash). Used by the website's /api/sarang-heartbeat route (mirrored server-side) and by tests. */
export function signRevocationToken(keyHash: string): string {
  const payload = buildRevocationPayload(keyHash)
  return `SARANG-${payload}-${sign(payload)}`
}

/**
 * Verifies a revocation token both signs correctly AND names this exact
 * key — a validly-signed token for some OTHER key must never revoke this
 * one. Null/malformed/mismatched/tampered all fail safe as "not revoked."
 */
export function parseAndVerifyRevocationToken(token: string | null | undefined, keyHash: string): boolean {
  if (!token) return false
  const parts = token.trim().toUpperCase().split('-')
  if (parts[0] !== 'SARANG' || parts[1] !== 'REVOKE' || parts.length !== 4) return false

  const keyHashRaw = parts[2]
  const signature = parts[3]
  if (keyHashRaw !== keyHash.toUpperCase()) return false

  const payload = buildRevocationPayload(keyHashRaw)
  const expectedSig = sign(payload)
  const a = Buffer.from(signature.toLowerCase())
  const b = Buffer.from(expectedSig)
  return a.length === b.length && timingSafeEqual(a, b)
}

/**
 * SARANG2-<TIER>-<REGION>-<issuedDateBase36Days>-<nonceHex6>-<ed25519SigHex128>
 *
 * Dispatched on the SARANG2 prefix, not part-count (it also splits into 6
 * parts like the legacy nonce format). Signature must be hex, not base64 —
 * parseAndVerifyLicenseKey() upper-cases the whole key first, and base64's
 * case-sensitive alphabet would get silently corrupted. Full 128 hex chars,
 * never truncated like the HMAC signature — Ed25519 needs the whole (R,S) pair.
 */
function buildSignedPayloadV2(tier: LicenseTier, region: LicenseRegion, issuedAt: Date, nonce: string): string {
  const daysSinceEpoch = Math.floor(issuedAt.getTime() / 86_400_000)
  return `${tier}-${region}-${daysSinceEpoch.toString(36)}-${nonce}`
}

/**
 * privateKeyPem is an explicit parameter, never a constant in this file —
 * the app itself must never hold real signing power. Exists here for tests
 * (an ephemeral test keypair) and as a reference the website's own
 * generateSarangLicenseKeyV2() mirrors.
 */
export function generateLicenseKeyV2(tier: LicenseTier, region: LicenseRegion, issuedAt: Date, privateKeyPem: string): string {
  const nonce = randomBytes(6).toString('hex')
  const payload = buildSignedPayloadV2(tier, region, issuedAt, nonce)
  const sigHex = cryptoSign(null, Buffer.from(payload), privateKeyPem).toString('hex')
  return `SARANG2-${payload}-${sigHex}`
}

/** Issues a new signed key. Used by the website's key-issuance route (mirrored server-side, not called from the app) and by tests. */
export function generateLicenseKey(tier: LicenseTier, region: LicenseRegion, issuedAt: Date = new Date()): string {
  // 6 random bytes (12 hex chars, 48 bits of collision-space) — not a secret,
  // so cryptographic unpredictability isn't required, just uniqueness. Sized
  // from actually measuring the birthday-bound collision rate at 3 bytes
  // (24 bits) live during this fix: ~2.9% chance of any collision at just
  // 1,000 same-day/tier/region signups, rising to ~95% by 10,000 — nowhere
  // near negligible for a product meant to grow. At 6 bytes the same math
  // stays under ~0.002% even at 100,000 same-day signups in one region.
  const nonce = randomBytes(6).toString('hex')
  const payload = buildSignedPayload(tier, region, issuedAt, nonce)
  return `SARANG-${payload}-${sign(payload)}`
}

/**
 * Verifies a SARANG2 (Ed25519) key. Split into its own function since the
 * dispatch in parseAndVerifyLicenseKey() below is by prefix, not part-count.
 */
function parseAndVerifyLicenseKeyV2(parts: string[]): ParsedLicenseKey | null {
  if (parts.length !== 6) return null
  const tierRaw = parts[1]
  const regionRaw = parts[2]
  const daysRaw = parts[3]
  const nonce = parts[4]
  const signature = parts[5]

  if (tierRaw !== 'TRIAL' && tierRaw !== 'PAID') return null
  if (regionRaw !== 'IN' && regionRaw !== 'INTL') return null

  const payload = `${tierRaw}-${regionRaw}-${daysRaw.toLowerCase()}-${nonce.toLowerCase()}`
  if (!verifyEd25519(payload, signature.toLowerCase())) return null

  const days = parseInt(daysRaw, 36)
  if (!Number.isFinite(days)) return null

  return { tier: tierRaw, region: regionRaw, issuedAt: new Date(days * 86_400_000) }
}

/** Parses + verifies a key's signature. Returns null for any malformed/tampered key, never throws. Dispatches across three formats — legacy 5-part HMAC, 6-part HMAC, SARANG2 Ed25519 — all validated forever, none ever retired. */
export function parseAndVerifyLicenseKey(key: string): ParsedLicenseKey | null {
  const parts = key.trim().toUpperCase().split('-')
  if (parts[0] === 'SARANG2') return parseAndVerifyLicenseKeyV2(parts)
  if (parts[0] !== 'SARANG') return null
  if (parts.length !== 5 && parts.length !== 6) return null

  // 6 parts = current format (with nonce); 5 parts = pre-2026-07-29 format
  // (no nonce) — still validated exactly as originally issued, never broken.
  const hasNonce = parts.length === 6
  const tierRaw = parts[1]
  const regionRaw = parts[2]
  const daysRaw = parts[3]
  const nonce = hasNonce ? parts[4] : null
  const signature = hasNonce ? parts[5] : parts[4]

  if (tierRaw !== 'TRIAL' && tierRaw !== 'PAID') return null
  if (regionRaw !== 'IN' && regionRaw !== 'INTL') return null

  const payload = hasNonce
    ? `${tierRaw}-${regionRaw}-${daysRaw.toLowerCase()}-${(nonce as string).toLowerCase()}`
    : `${tierRaw}-${regionRaw}-${daysRaw.toLowerCase()}`
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
 *
 * Real gap found+closed 2026-07-28: a PAID key used to short-circuit straight
 * to ACTIVE regardless of age — meaning the very first renewal payment
 * bought a permanent, never-expiring unlock, even though every piece of
 * user-facing pricing copy (SetupWizard, the website pricing page, the
 * renewal email itself) says "₹6,999/year"/"$149/year" (finalized 2026-09-02).
 * A PAID key runs
 * through its own day-335/365 WARNING/EXPIRED threshold math (its 365-day
 * annual cycle, unchanged), computed from that key's own issuedAt (i.e. the
 * date it was paid for) — so year 2 genuinely has to be paid for too,
 * degrading the same non-destructive way (blocks only new billable
 * documents, never existing data) rather than silently granting a lifetime
 * license. A TRIAL key runs the same WARNING/EXPIRED shape on its own
 * shorter 70/100-day cycle (2026-09-01 — trial length changed from 365 to
 * 100 days; see the constants' own comment above for why the two tiers no
 * longer share one cycle length).
 */
export async function getLicenseState(): Promise<LicenseState> {
  const db = getPrisma()
  const [keyRow, fingerprintRow, killSwitchRow, revocationRow] = await Promise.all([
    db.setting.findUnique({ where: { settingKey: SETTING_KEYS.key } }),
    db.setting.findUnique({ where: { settingKey: SETTING_KEYS.machineFingerprint } }),
    db.setting.findUnique({ where: { settingKey: SETTING_KEYS.enforcementSuspended } }),
    db.setting.findUnique({ where: { settingKey: SETTING_KEYS.revocationToken } })
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

  // Real bug found+fixed 2026-07-28: this used to round-trip through
  // `.toISOString().slice(0,10)` (UTC calendar date) then re-parse that as a
  // LOCAL date via parseLocalDateStart — for any non-UTC timezone this
  // shifts the day-threshold by up to the timezone's offset (worst case
  // ~14h), cutting the promised free period short for users west of UTC.
  // Raw elapsed-time math sidesteps the UTC/local round-trip entirely: every
  // install gets exactly its tier's cycle length × 24h of use from the exact
  // moment the key was issued, regardless of timezone or DST.
  const cycleDays = parsed.tier === 'TRIAL' ? LICENSE_TRIAL_EXPIRES_AFTER_DAYS : LICENSE_PAID_EXPIRES_AFTER_DAYS
  const warningDays = parsed.tier === 'TRIAL' ? LICENSE_TRIAL_WARNING_AFTER_DAYS : LICENSE_PAID_WARNING_AFTER_DAYS
  const daysSinceIssue = Math.floor((Date.now() - parsed.issuedAt.getTime()) / 86_400_000)
  const daysRemaining = cycleDays - daysSinceIssue

  // Remote kill switch (59.6) — only ever relaxes enforcement, never tightens
  // it, and only takes effect if a prior online ping actually saw the flag
  // set. Never blocks this function, never required. Signature-verified —
  // an unsigned/tampered value fails safe as "not suspended."
  const enforcementSuspended = parseAndVerifyKillSwitchToken(killSwitchRow?.settingValue)?.suspended === true

  // Per-key revocation (59.13) — a key flagged revoked on the website (spotted
  // sharing across too many devices) forces EXPIRED regardless of how much of
  // its cycle is left, the moment this device has picked that up via its
  // daily ping. Same non-destructive enforcement as a normal expiry — never
  // a data lock — just an earlier one. Verified against THIS key's own hash
  // so a stale/mismatched token (e.g. left over after activating a different
  // key on this device) can never wrongly revoke it.
  const thisKeyHash = hashLicenseKeyForPing(keyRow.settingValue)
  const revoked = parseAndVerifyRevocationToken(revocationRow?.settingValue, thisKeyHash)

  let status: LicenseStatus = 'ACTIVE'
  if (revoked) {
    status = 'EXPIRED'
  } else if (!enforcementSuspended) {
    if (daysSinceIssue >= cycleDays) status = 'EXPIRED'
    else if (daysSinceIssue >= warningDays) status = 'WARNING'
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
 * Sends only a one-way hash of the license key plus a one-way hash of this
 * device's machine fingerprint (same hash `activateLicenseKey` already
 * computes locally to rebind on a new device — sending it lets the website
 * log how many distinct devices a given key has been seen on, for the
 * founder to review manually; it is never used to block anything client-side).
 * Never the raw key, never the raw fingerprint, never any business data.
 * Fire-and-forget: never awaited by callers, never retried aggressively,
 * never blocks or delays anything if unreachable — this must stay true to
 * the offline-first rule that no network call is ever load-bearing. Reads
 * back a signed `enforcementToken` (the remote kill-switch, see 59.6) the
 * founder can flip on the website side without shipping a new app build,
 * in case the day-335/365 logic ever has a bug — this project has a real
 * history of shipping date-boundary bugs that looked fine until they weren't.
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
      body: JSON.stringify({ keyHash: hashLicenseKeyForPing(keyRow.settingValue), fingerprintHash: computeMachineFingerprint() }),
      signal: AbortSignal.timeout(5000)
    })
    await db.setting.upsert({
      where: { settingKey: SETTING_KEYS.lastVerifiedAt },
      update: { settingValue: new Date().toISOString() },
      create: { settingKey: SETTING_KEYS.lastVerifiedAt, settingValue: new Date().toISOString(), settingType: 'STRING' }
    })

    if (res.ok) {
      // 2026-09-02 hardening — the server now returns a signed token, not a
      // bare boolean. Verified BEFORE persisting, so a spoofed/garbled
      // response can't even get a bogus value written locally; getLicenseState()
      // verifies again on every read as the real enforcement point, this is
      // just a fail-fast so an obviously-bad value is never stored at all.
      const body = await res.json().catch(() => null) as { enforcementToken?: string; revocationToken?: string } | null
      if (body?.enforcementToken && parseAndVerifyKillSwitchToken(body.enforcementToken)) {
        await db.setting.upsert({
          where: { settingKey: SETTING_KEYS.enforcementSuspended },
          update: { settingValue: body.enforcementToken },
          create: { settingKey: SETTING_KEYS.enforcementSuspended, settingValue: body.enforcementToken, settingType: 'STRING' }
        })
      }
      // Per-key revocation — verified against THIS device's own key hash
      // before persisting, so a token for some other key can never revoke
      // this install (see parseAndVerifyRevocationToken's own doc comment).
      const thisKeyHash = hashLicenseKeyForPing(keyRow.settingValue)
      if (body?.revocationToken && parseAndVerifyRevocationToken(body.revocationToken, thisKeyHash)) {
        await db.setting.upsert({
          where: { settingKey: SETTING_KEYS.revocationToken },
          update: { settingValue: body.revocationToken },
          create: { settingKey: SETTING_KEYS.revocationToken, settingValue: body.revocationToken, settingType: 'STRING' }
        })
      }
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
