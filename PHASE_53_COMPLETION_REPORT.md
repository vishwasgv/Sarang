# Phase 53 — Legal Safety & Consent Audit: Completion Report

## Scope

Per `PRODUCT_HARDENING_MASTER_PROMPT.md`'s Phase 53 entry: audit every point in the app where data is collected, displayed, or used to generate an external artifact, confirm consent is captured wherever legally/ethically necessary (extending the existing `DisclaimerScreen` pattern, not inventing a parallel one), and cross-check the app's actual behavior against its own privacy/offline claims — the claims must be provably true, not just stated. Explicitly required to cover the 5 new verticals from Phases 47–51, not just the pre-existing product/service businesses.

## Existing disclaimer pattern — confirmed adequate

`DisclaimerScreen.tsx` is a one-time, app-wide gate shown before *any* screen (including `SetupWizard`, before a business type is even chosen) — confirmed via `router.tsx`'s `disclaimerAccepted` gate. Its text is already broad enough to cover every vertical, including the new health-data-heavy ones: *"It is not a medical record system, accounting software, legal advice tool, or licensed financial product... Users are solely responsible for compliance with applicable laws and professional regulations."* Because it's shown once, globally, before business-type selection, it doesn't need vertical-specific variants — a vertical-specific disclaimer would in fact violate this project's own "no template-specific if/else, configuration flags only" architectural rule for no real benefit, since the existing text already generically covers the concern.

## Real findings — 2 confirmed, both fixed

**The audit's core job — cross-checking in-app privacy claims against actual behavior — found a genuine, provable discrepancy.** A full-codebase sweep for outbound network calls (`fetch`/`https.request`/`axios`, and every telemetry/analytics SDK name) found exactly **one** network call anywhere in the app: `app:checkForUpdates` in `app.handler.ts`, a manual, user-initiated GitHub releases lookup (confirmed by tracing its only caller, a button click in `AboutScreen.tsx` — never auto-triggered on launch). This call itself is benign (sends only a `User-Agent` header with the version number, receives back a release tag) and doesn't contradict the app's privacy positioning on its own. But **two in-app claims stated an absolute that this very feature contradicts**:

1. `AboutScreen.tsx`: *"No internet connection required to use any feature."* — literally false the moment you look a few lines down the same screen at the "Check for Updates" button, which requires exactly that.
2. `SetupWizard.tsx`'s welcome step: *"Works Offline / No internet required, ever."* — the same overreach, shown during onboarding.

**Fixed both** by scoping the claims accurately rather than removing the reassurance entirely: (1) *"No internet connection required for any core business feature — billing, inventory, customers, and reports all work fully offline. (Checking for software updates below is the one optional exception, and only runs when you choose to check.)"* — also added a short transparency note directly next to the "Check for Updates" button itself (*"Only runs when you click the button below — sends nothing but the app's own version number, no business or customer data"*), so the two sections of the same screen no longer read as contradictory. (2) *"No internet needed for daily use"* — same fix, fitted to the tight 3-word-title/short-desc onboarding grid. All other "100% offline"/"no cloud, no tracking" claims found elsewhere (`BackupScreen.tsx`, `ImportWizardScreen.tsx`, the disclaimer itself) were already correctly scoped to their specific feature and left untouched.

Verified live: launched the real app, navigated to the About screen, confirmed both the corrected claim and the new transparency note render correctly with no layout regression.

## New verticals — confirmed clean, no fixes needed

- **QR Table Ordering (Phase 47)** — the one genuinely new *unauthenticated* data-collection surface in this codebase (a customer submits data from their own phone, no staff mediation). Read `qr-order-server.ts` and the `TableOrderRequest`/`TableOrderRequestItem` schema directly: the order submission endpoint collects **zero personal data** — only a table ID and item selections. The customer's IP is logged only transiently, in-memory, for rate-limiting, never persisted. The optional UPI payment QR shown back to the customer is purely a display artifact (a standard `upi://pay` deep link), with no data flowing back from the customer's payment app. There is genuinely nothing to consent to here.
- **Diagnostic Labs (Phase 50) / Blood Bank (Phase 51)** — both handle sensitive health-adjacent data (screening pass/fail, blood group, test results). Printed output that exists (`LabReportPrint.tsx`, `VisitNoteScreen.tsx`'s summary) already carries an explicit *"NOT a validated medical record... verify before clinical use"* disclaimer (built in Phase 50, confirmed still present). Blood Bank currently has no print output at all (noted, not a Phase 53 finding — a Phase 51 feature-completeness question, out of this audit's scope, since "no printed document" can't misrepresent anything). The generic app-wide disclaimer's "not a medical record system... solely responsible for compliance" language already covers the underlying liability question for both verticals without needing a bespoke addition.

## WhatsApp/SMS reminder consent — confirmed clean, existing design is appropriately conservative

Traced the actual mechanism (`generateWhatsAppLink` in `notification-queue.service.ts`, `NotificationQueueScreen.tsx`): reminders are never auto-sent. They're queued as `wa.me` deep links that a staff member must explicitly open and press "send" on inside WhatsApp itself — a real human reviews and dispatches every single message, nothing is blasted silently. The underlying question of whether the business has consent to contact a given customer/donor by phone is a relationship between the business and its own customer that exists outside the software (the same way no CRM or scheduling tool obtains consent on behalf of the businesses using it) — correctly left to the business owner's own responsibility, matching the disclaimer's existing "solely responsible for compliance" framing. Adding a redundant consent-reminder at every phone-number entry field across dozens of screens would add friction without a mechanism to actually verify or enforce anything, contradicting this project's own UX-simplicity standard.

## Other checks performed, confirmed clean

- **No telemetry/analytics SDK** anywhere in `package.json` (checked for Sentry, Mixpanel, Amplitude, PostHog, Segment, Bugsnag, Datadog, Firebase, Google Analytics, Hotjar, FullStory — none present).
- **Audit log access** (`audit.view`/`audit.export`, which can surface PII in before/after snapshots) is correctly restricted to Admin/Manager only in `seed.ts` — Cashier/Staff cannot view it.
- **No specific DPDP Act or GDPR compliance certification is claimed anywhere in-app** — the app only makes general, now-verified-true privacy behavior claims (no cloud, no telemetry, local-only storage), not a specific regulatory certification that would require a much heavier compliance-verification bar. This is the right, safe positioning.
- **Data correction is possible everywhere** (every record type supports editing); **erasure is soft-delete** (`isActive: false`) rather than hard-delete across the app, consistent with standard business-record retention practice and not something this phase's audit found reason to redesign.

## Final state

0 TypeScript errors (both `tsconfig.node.json` and `tsconfig.web.json`), all 756 existing tests still passing (no new automated tests added — this phase's fixes are copy/text corrections in 2 renderer components with no new business logic to unit-test; verified instead via a live rendered check in the real app, per this project's established preference for visual confirmation over test-writing when the change *is* the visible text).

## Deliberately not done (documented, not silently skipped)

- **No new consent-capture UI added anywhere** — every place personal data is collected already sits inside the business's own direct relationship with its customer/donor/patient (staff entering data during a real-world interaction), not a self-service online form where a consent checkbox would naturally belong. Inventing one would be scope creep beyond what this audit's findings actually support.
- **No Blood Bank print template added** — a genuine feature gap noted in passing, but a Phase 51 feature-completeness matter, not a legal-safety finding (nothing is being printed incorrectly if nothing is printed at all).
- **No formal data-subject erasure-request workflow** — the existing soft-delete pattern is consistent across the whole app and matches ordinary business-record retention norms; building a dedicated "right to erasure" flow was judged out of proportion for what this audit's actual findings warranted.

## How to apply

Phase 53 is done — found and fixed 2 real, provable claim-vs-behavior discrepancies (the only network call in the app was correctly benign, but two in-app claims overstated "never" when the truth was "only when you explicitly ask"), and confirmed the rest of the app's privacy/consent posture — including all 5 new verticals — is already sound. Per `PRODUCT_HARDENING_MASTER_PROMPT.md`'s renumbered plan, Phase 54 (Reports & Analytics Overhaul) is next — check that file directly before citing phase numbers, as this bundle has been renumbered multiple times already.
