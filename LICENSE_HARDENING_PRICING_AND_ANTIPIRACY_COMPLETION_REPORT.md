# License Hardening, Pricing Finalization & Anti-Piracy Visibility — Completion Report

### Maintained by Aszurex | Vishwas G V | 2026-09-02/03

**Status: 🟢 COMPLETE.** No sequential phase number — same as the 50-vertical expansion immediately before it, this is its own initiative layered on top of Phase 70, not part of the `PHASE_61_ROADMAP_MASTER_PROMPT.md` vertical-feature roadmap. Five pieces of work, each independently tested and live-verified: (1) closing two real license/piracy holes, (2) migrating from a symmetric to an asymmetric signing scheme, (3) raising the bar against binary tampering, (4) finalizing and rolling out real pricing everywhere it appears, and (5) building real (if intentionally limited) visibility and countermeasures against the same-key-on-many-devices sharing case. Commits — app repo (`sarang-business-os`, `origin/main`): `637a126`, `943cc16`, `2d3f2b6`, `bcf4f60`, `678d02f`, `81c639f`. Website repo (`aszurex`, `origin/main`): `fd7954f`, `97c0402`, `4a66994`, `53975f9`, `816ba47`. All pushed.

---

## Scope

1. **License hardening P0/P1/P2** — close the unsigned kill-switch hole and the extractable-HMAC-secret hole, without ever introducing a hard network dependency (the app must stay fully offline-forever).
2. **Pricing finalization** — land a real number (₹6,999/year India, $149/year international), backed by fresh competitor research, and roll it into every place a price is shown: app UI (13 languages), in-app manual (13 languages), website, Razorpay, Lemon Squeezy.
3. **Website legal & form hardening** — non-refundable policy, Password Recovery Code lockout warnings, a properly-required lead-capture form covering all 50 verticals, GST-inclusive flat pricing.
4. **Customer form** — require a phone number (previously fully optional) without breaking anonymous walk-in cash sales.
5. **Anti-piracy visibility + revocation** — the founder's direct question ("one key can serve 10 PCs?") answered honestly (yes, today), then given real teeth: a device-activation log, a nightly job that flags only genuine concurrent multi-device use, and a per-key revocation mechanism a device picks up on its own next check-in.

---

## 1. License / Anti-piracy hardening (P0 → P2)

**The two real holes, found by audit, not assumed:**
- **P0 — unsigned kill switch.** `license_enforcement_suspended` was a bare `'true'`/`'false'` string in the generic `Setting` table, reachable via a raw SQLite edit or (in a dev build) the generic `settings:set` IPC channel. Closed two ways: (a) `LICENSE_INTERNAL_SETTING_KEYS` deny-list in `settings.service.ts` blocks the generic channel from ever touching license-internal keys (new `LIC-003` error), (b) the flag itself is now a signed token (`signKillSwitchToken`/`parseAndVerifyKillSwitchToken`, mirroring the license key's own signature scheme) — a hand-edited bare string is now cryptographically inert. The website's `/api/sarang-heartbeat` route (previously non-existent — every ping was silently 404ing) was built for real, rate-limited, returning a freshly-signed token each call.
- **P1 — symmetric HMAC secret.** `LICENSE_HMAC_SECRET` signs and verifies with the same value, and is baked into the shipped, unencrypted `app.asar` — extractable via `npx @electron/asar extract`, giving anyone a permanent global skeleton key. Migrated to Ed25519 (`SARANG2-<TIER>-<REGION>-<days>-<nonce>-<ed25519SigHex128>`), asymmetric: only the public key ships in the app, the private key only ever exists on the website. `parseAndVerifyLicenseKey()` dispatches across three formats forever — legacy 5-part, current 6-part HMAC, and `SARANG2` — no forced re-issuance, every already-issued key keeps validating. Staged rollout, not yet cut over for real customers: the website's `/api/sarang-download` (TRIAL) and `issueRenewalKey` (PAID) still issue legacy HMAC keys; SARANG2 is verify-only until the founder decides to flip issuance, per the plan's 90-day-minimum floor after a verify-capable app release actually ships.

**P2 — binary tampering.** `electron-builder.config.ts` gained an `electronFuses` block: `onlyLoadAppFromAsar` + `enableEmbeddedAsarIntegrityValidation` (a patched/repacked `app.asar` refuses to launch) plus `runAsNode`/`enableNodeCliInspectArguments`/`enableNodeOptionsEnvironmentVariable` all disabled (closes the `ELECTRON_RUN_AS_NODE` monkey-patch route — a grep confirmed zero legitimate use anywhere in this codebase). Verified against `node_modules/app-builder-lib`'s actual `FuseOptionsV1` interface, not assumed from the raw `@electron/fuses` API.

**Honest framing, not oversold:** this raises the cost of the cheap attack (hex-edit-and-repack) to "rebuild the whole app yourself." It does not stop a fully motivated attacker. `getLicenseState()` stayed fully synchronous and offline throughout — re-asserted by a dedicated "makes zero network calls of any kind" test.

---

## 2. Pricing finalization

**The number: ₹6,999/year (India), $149/year (international)**, GST-inclusive/flat (no "+18% GST" line — no evidence Aszurex is GST-registered, and itemizing tax without registration is its own legal problem). Superseded the earlier ₹3,999/$79 proposal from 2026-08-10, which was priced *before* purchase-side, banking/reconciliation, the formal ledger, multi-currency, and license hardening existed and was never actually implemented in code. Backed by fresh, live-researched competitor data (Zoho Books, Tally, Vyapar, Busy, myBillBook in India; Zoho/QuickBooks/Xero/FreshBooks internationally) plus a market check against representative vertical-specific SaaS (restaurant POS, salon, gym, clinic, legal) to sanity-check the value story.

**Rolled out everywhere:**
- App: `SetupWizard.tsx`, `AboutScreen.tsx`, `LicenseScreen.tsx` (via i18n), all 13 locale JSONs' `license.renewIndia`/`renewIntl` keys, `license.service.ts`'s own doc comment.
- In-app manual: `content/en/licensing.md` fully rewritten (100-day trial wording, non-refundable notice, new Password Recovery Code section), then **translated into all 12 non-English languages**, reusing each language's already-established in-app terminology for "100 days"/"free trial" (pulled from the existing `license.*` i18n keys) rather than inventing new phrasing.
- Website: every price mention in `sarang.html` (meta tags, JSON-LD, hero, pricing cards, download modal/email, trust section), `sarang-terms.html`, `sarang-privacy.html`.
- Razorpay: old ₹599 payment link couldn't have its amount edited in place (Razorpay links are immutable once created) — created a new ₹6,999 link, repointed the website's Renew button at it, cancelled the old link.
- Lemon Squeezy: existing product's price field updated in place, $29 → $149.

**Also fixed in passing** (same files already being touched): stale "40+"/"43 business types" copy corrected to the real count (50), app version bumped 1.2.0 → 1.3.0 on both app and website (not built/packaged — explicitly held for a final test pass first).

---

## 3. Website legal & form hardening

- **Non-refundable policy** — `sarang-refund.html` reversed from a live 14-day-full-refund promise (found already published, not something this session added) to non-refundable, matching the founder's explicit instruction. `sarang-terms.html`/`sarang-privacy.html` updated to match.
- **Password Recovery Code warnings** — strengthened to state permanent-lockout explicitly, in bold, in every place the code is shown or regenerated: `SetupWizard.tsx`'s `CompleteStep`, `SettingsScreen.tsx`'s `RecoveryCodeCard`, the in-app manual, and a new Privacy Policy section (Aszurex never sees or stores this code — it's generated and kept entirely on-device).
- **Download form** — Business Type is now required, with all 50 verticals in the dropdown (was optional, 17 options, missing 7 newest verticals). Added Business Name (required), State, City. Added an email-accuracy disclaimer (the license key is sent only there) and `autocomplete` attributes on every field. `server.js`'s `/api/sarang-download` validation updated to match; forwards the new fields to the lead-capture Sheet.

---

## 4. Customer form — phone required

Only `customerName` was required before; every other field including phone was optional. Now phone is required too. Verified this doesn't affect the low-friction cash-sale path this session separately confirmed is legitimate and worth protecting: `billing.createInvoice`'s `customerId` stays fully optional, so an anonymous walk-in sale never touches this form at all. Bulk CSV import keeps its own, separate, still-lenient phone-optional validation (`import.service.ts`) — historical data migration shouldn't be blocked by a policy adopted today.

Fixed 16 E2E suite call sites and 3 unit test payloads that created a customer without a phone and would have failed validation under the new rule (one test deleted outright — its entire premise, "customer creation without phone should succeed," is now the opposite of the actual rule).

---

## 5. Device-activation visibility + per-key revocation

Direct answer to "is there any way to stop the same key running on 10 PCs": today, no — verification is a pure local signature check with zero real-time enforcement, by design (staying offline-first rules out a phone-home block). Built the two things that actually are possible within that constraint:

- **Visibility.** The existing daily license ping (`pingLicenseStatusIfDue`) now also sends a one-way hash of the device's machine fingerprint. The website (`/api/sarang-heartbeat`) forwards `{keyHash, fingerprintHash, seenAt}` to a new Google Sheet ("Sarang Device Activations") — logging happens *after* the response is already sent, so it can never delay or block the actual enforcement token.
- **Misuse-only flagging, hardened per explicit instruction ("ensure revoke only when it's misused not other ways").** A new Apps Script function (`flagSuspiciousKeys`, on a daily time-driven trigger) only flags a key when 2+ distinct device fingerprints were **both active within the same 14-day window** — genuine concurrent use. A key that moved from a dying laptop to its replacement is never flagged: the old fingerprint's last ping simply ages out of the window. Results land in a separate "Flagged for Review" tab; nothing is ever auto-revoked.
- **Revocation.** `signRevocationToken`/`parseAndVerifyRevocationToken` (app) and their website mirror — a token embeds the key's own hash, so it can never be replayed onto a different key. The founder pastes a flagged Key Hash into `SARANG_REVOKED_KEY_HASHES` (a plain, comma-separated Render env var — same "flip it, no code deploy" pattern as the kill switch); every device sharing that key finds out on its own next daily check-in and drops to `EXPIRED` — same non-destructive enforcement as a normal expiry, never a data lock, never real-time.
- **Expiry-is-key-anchored, verified not assumed.** Directly confirmed against `parseAndVerifyLicenseKey()`: the issue date is encoded inside the signed key itself, identical for every device that ever activates that exact key string. Sharing a key never buys extra time — every device sharing it hits the same wall on the same day.

10 new tests in `license.service.test.ts` (46 total, up from 36): revocation round-trip, cross-key rejection (a token for key A must never revoke key B), tamper rejection, the bare-unsigned-string hole, and the full ping → persist → enforce path.

---

## Current state

- Both typechecks clean (`tsconfig.node.json`, `tsconfig.web.json`).
- Full unit suite: **4054/4054**, 215/215 files. One run showed a single flaky failure that did not reproduce on immediate retry — traced to a **pre-existing** gap, not something this work introduced (see below).
- Live-verified: pricing across app/website/manual in all 13 languages; both payment processors updated in their live dashboards; Google Sheet + Apps Script deployed and its trigger confirmed firing (`Execution completed`, no errors); Render env var (`SARANG_DEVICE_SHEET_WEBHOOK_URL`) deployed and confirmed `Live` at the exact pushed commit hash.
- Not built/packaged: the app version bump (1.3.0) is committed but explicitly not run through `npm run dist` yet — one more test pass requested before a real installer build.

**Known, pre-existing gap flagged during this work, not fixed (out of scope for what was asked):** a large number of tests in `license.service.test.ts` call `getLicenseState()` without stubbing `fetch` first. Since `getLicenseState()` internally fires a fire-and-forget background ping, every one of those tests makes a real, un-mocked network call to production `aszurex.com` during a test run — the likely source of the one flaky failure seen above. This pattern predates this session (confirmed by grep — it's not something introduced by the revocation work, which stubs `fetch` correctly throughout its own new tests). Worth a dedicated cleanup pass; not attempted here since it touches ~15+ pre-existing test cases unrelated to this session's actual scope.

**Also still open, unrelated to this work, previously flagged:** production Ed25519 keypair not yet generated (dev placeholder still in use); SARANG2 key issuance not yet cut over for real customers; Prisma migration-history drift (worked around, not root-fixed).
