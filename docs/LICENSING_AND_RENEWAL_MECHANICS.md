# Licensing & Renewal — How It Actually Works

Written 2026-07-28, verified directly against the current code (not a summary of a design doc) as part of the pre-installer full audit; updated 2026-07-29 with a second real gap found and closed the same audit. See `PHASE_59_MONETIZATION_LICENSING_MASTER_PROMPT.md` (repo root, one level up) for the original design spec this implements; this document describes **current, live behavior**, including two real gaps found and closed during this audit — see Section 5 (PAID licenses never expiring) and Section 8 (duplicate keys issued to different customers).

## 1. When does the free 12 months actually start?

**Not on install day — on the day the license key is issued.** A visitor submits the "Get Sarang Free" form on `aszurex.com` (name, email, phone, country — all required). The website's `server.js` (`/api/sarang-download` route) immediately calls `generateSarangLicenseKey('TRIAL', region, issuedAt = new Date())`, bakes that timestamp **inside the signed key string itself**, and emails the key + download link together in one message.

The 365-day countdown is always recomputed from that embedded timestamp, never from install date or first-launch date. In practice the two are close together (the email has both the link and the key), but they are not the same moment technically — someone who requests a key and waits two weeks to install has already spent two weeks of their free year.

Inside the app, `SetupWizard.tsx`'s final step **requires** pasting that key and ticking an explicit acknowledgment checkbox — "Launch Dashboard" stays disabled until both are done. This is intentional (see 59.5 in the master spec): it closes a loophole where someone could click through setup with zero enforcement ever applying to that install.

## 2. What happens when the current year expires

This applies identically whether it's a TRIAL key's free year or, as of this audit, a **PAID key's paid year** (see Section 5 — this used not to be true).

- **Days 0–334**: normal operation, no banner.
- **Days 335–364**: a recurring Dashboard banner (`analytics.service.ts`) plus a permanent "Renew" card in Settings → License, showing days remaining.
- **Day 365+**: status becomes `EXPIRED`. Enforcement is **degrade, never brick** (Section 59.6 of the spec): viewing, searching, printing, exporting all existing records, running reports, and backup/restore all keep working without any restriction. What's blocked is creating **new billable documents** — enforced server-side in `billing.service.ts`'s `createInvoice` and `quotation.service.ts`'s `convertToInvoice` (checked directly, not just a disabled button in the UI — a direct IPC call would be blocked too).
- **Deliberate exception**: `returns.service.ts`'s `createReturn` stays ungated even on an expired license — a founder decision made during this same audit, reasoned as "servicing a sale that already happened, not creating new business." Locked in with its own regression test.

## 3. How payment happens

Payment is **never inside the Electron app**. Settings → License has a "Renew" button linking to `aszurex.com/sarang#pricing` — an external browser page, not an embedded checkout. This keeps the app's own "Sarang never processes or verifies your customers' payments" claim clean: this is Aszurex charging for Aszurex's own product, a different thing entirely.

- **India**: a Razorpay Payment Link.
- **International**: Lemon Squeezy, a Merchant of Record — it becomes the legal seller for the transaction and handles VAT/sales-tax collection and remittance in the buyer's own country, taking that compliance burden off the founder.

## 4. How payment is validated, and how the next key reaches the user

Validation happens entirely on the **website**, not in the app. The moment a payment succeeds, Razorpay/Lemon Squeezy call a webhook:

- `POST /api/webhooks/razorpay` — verifies `X-Razorpay-Signature`, an HMAC-SHA256 signature over the **raw, unparsed** request body, keyed with a secret that exists only in the Razorpay dashboard and the server's env config.
- `POST /api/webhooks/lemonsqueezy` — same pattern with `X-Signature`.

Both comparisons use Node's `timingSafeEqual` (constant-time, not vulnerable to timing attacks) and **fail closed**: if the secret isn't configured, or the signature doesn't match, the webhook rejects the payload outright. Nobody can POST a forged "payment succeeded" event to mint a free key — this was confirmed as a real, correctly-implemented gate, not a theoretical one, in this same audit.

Once verified, the server calls `issueRenewalKey()`, which generates a new key with `tier: 'PAID'` and `issuedAt: now`, signed with the **exact same HMAC secret** the compiled app carries — and emails it ("Your renewed Sarang license"). The user copy-pastes it into Settings → License → Activate. That activation is verified **entirely offline**: the app already holds the shared secret, so no server round-trip happens at the moment of entry, and it works even for a shop with no internet connection at all.

Re-activating on the same device, or on a brand-new device (e.g. replacing a laptop), always succeeds immediately with no lockout and no support ticket — a deliberate v1 choice (see `license.service.ts`'s `activateLicenseKey` doc comment) to make hardware replacement a non-event, at the accepted cost that a shared key also "works" on a second machine. The founder can review that pattern later via the optional daily usage ping (Section 6) if sharing-at-scale ever becomes a real problem; this is detection-and-review, not automatic enforcement.

## 5. Year 2 and beyond — the gap found and closed in this audit

**Before this audit (2026-07-28): nothing triggered a second payment ask, ever.** `getLicenseState()` short-circuited any `PAID` tier straight to `ACTIVE` with no date check at all, and there was an explicit passing unit test asserting exactly this: *"a PAID key is always ACTIVE regardless of age"* (tested with a key issued 900 days in the past). The Settings → License "Renew" card was also coded to permanently disappear the instant `tier === 'PAID'`. In effect: pay once after the free year, and Sarang would never ask again — a permanent unlock, not the annual subscription every piece of pricing copy describes.

This was checked against the original Phase 59 spec: it thoroughly designs the TRIAL→PAID transition (59.9) but never once addresses what should happen when a PAID key itself gets old. It read as an unclosed gap, not a documented decision.

**Fixed, per explicit founder decision during this audit**: `getLicenseState()` no longer special-cases `PAID` at all — every key, regardless of tier, runs through the identical `daysSinceIssue` → WARNING(335d)/EXPIRED(365d) computation, always re-derived from that key's own signed `issuedAt`, exactly as tamper-resistant as the original TRIAL enforcement (Section 59.4 — the issued date is never trusted from the local `Setting` row alone, always re-verified against the signature). A PAID key's "year" starts the moment that payment's webhook fires, not from the original TRIAL activation date.

Consequences of the fix, all covered by regression tests:
- `billing.service.ts`/`quotation.service.ts`'s enforcement gates now check `status === 'EXPIRED'` regardless of tier (previously `tier === 'TRIAL' && status === 'EXPIRED'`), with tier-aware error copy ("Your license has expired" for PAID vs. "Your free year has ended" for TRIAL).
- The Dashboard banner and Settings → License screen (badge, days-remaining, Renew card) all now key off `status` instead of hardcoding `tier === 'TRIAL'`, so a PAID user approaching or past their renewal date sees the same warning/degrade experience a TRIAL user always did.
- **A real second-year renewal now requires exactly the same flow as the first**: pay again via the same Razorpay/Lemon Squeezy link, receive a new `PAID` key by email, paste it in. There is no auto-renewal or stored payment method — every year is a fresh manual key, by design (matches the app's offline-first, no-stored-payment-details posture).

## 6. Privacy — what's actually transmitted

At most once per day, if online, `pingLicenseStatusIfDue()` fire-and-forget POSTs a **one-way SHA-256 hash of the license key** (never the raw key) to `aszurex.com/api/sarang-heartbeat`. Never awaited, never retried aggressively, never blocks or delays app startup — fully consistent with the offline-first rule that no network call is ever load-bearing. The response can optionally carry `{ enforcementSuspended: boolean }`, a remote kill-switch the founder can flip on the website side without shipping a new app build, in case the day-335/365 logic ever has a bug (this project has a real, repeated history of exactly that class of bug — see the timezone-bug saga across v1.1.0/v1.1.1/the 2026-07-23 and 2026-07-28 audits).

**Known gap, found during this audit, not yet closed**: the `/api/sarang-heartbeat` endpoint referenced by the app **does not exist yet** in the website's `server.js` — only `/api/sarang-download`, `/api/sarang-usage`, and the two payment webhooks are implemented. The ping is fire-and-forget and fails silently (caught, never surfaced), so this causes no user-visible problem today — but it does mean the remote kill-switch described above is not actually reachable yet. Worth building before it's ever needed in an emergency, not after.

Separately, `usage-metrics.service.ts` sends at most once per day (if online): a one-way key hash, region, and `{date, minutesUsed}` entries — never any business data, never anything identifying. Confirmed directly in this audit by reading the actual payload construction, not assumed from documentation.

## 7. One-device-per-key policy

Enforced via a lightweight machine fingerprint (`hostname + platform + first non-internal MAC`, hashed) stored alongside the key. Activating a key on a new fingerprint always succeeds (Section 4 above) — this is intentionally not a hard lock, since the product's own "not hardened DRM" threat model (stated at the top of `license.service.ts`) explicitly accepts that a determined person can share a key, in exchange for never risking a false-positive lockout on a legitimate device replacement.

## 8. Key uniqueness — a second real gap found and closed, 2026-07-29

**Before this fix: two different, unrelated people could be issued the exact same license key.** The signed-key payload was built from only three inputs — `tier`, `region`, and the issuance day (floored to day granularity for the 335/365-day math) — with zero per-request randomness. HMAC-SHA256 is deterministic: the same three inputs always produce the same signature, so **any two people who requested a TRIAL key from the same region on the same calendar day got the byte-for-byte identical key string**, and the same for two customers whose PAID renewal payments happened to be issued on the same day.

This is a different, more serious problem than the already-documented one-device-per-key tradeoff in Section 7 above. That section is about a *single rightful key holder* choosing to share their own key with a friend — an accepted, reasoned risk. This was the *system itself* handing two total strangers, who never chose to share anything, an identical credential. Concretely, before the fix:
- The one-key-per-device policy was undermined between people who did nothing wrong — both would appear to be "the same device history" to the machine-fingerprint check.
- The daily usage-ping hash (`hashLicenseKeyForPing`, Section 6) would merge two unrelated customers' usage under one hash, silently undercounting real active installs.
- If a refund's kill-switch revocation is ever keyed by hash (Section 6), it would have silently degraded an unrelated same-day customer's working license too.

**Fixed** by adding a random nonce as its own segment in the signed payload (`SARANG-<TIER>-<REGION>-<day>-<nonce>-<signature>`), leaving the day-granularity date math the trial/renewal logic depends on completely untouched. `parseAndVerifyLicenseKey()` accepts both the new 6-part format and the old 5-part (no-nonce) format — **every key already issued and emailed to a real signup before this fix keeps validating forever**, nothing already in a customer's inbox breaks.

**Nonce size, chosen from actually measuring it, not guessing**: a first attempt at 3 random bytes (24 bits) was stress-tested live and found genuinely insufficient for a product meant to grow — the measured/predicted collision rate (birthday bound) was ~2.9% at just 1,000 same-day/tier/region signups in one region, rising to ~95% by 10,000. Widened to 6 random bytes (48 bits), which measured **zero collisions across 100,000 same-day signups** in the same test, matching the predicted <0.002% bound at that volume. The website repo's mirrored `generateSarangLicenseKey()` in `server.js` — the actual production key issuer — was updated to match exactly; cross-interop was verified directly (keys generated by the website's exact logic all validate correctly against the app's verifier, and vice versa) rather than assumed from the two implementations merely looking similar.
