# Phase 44 — Customer Branding on Documents & Dashboard: Technical Spec

## 0. Scope boundary decided this phase (see master plan for full detail)

The audit found Credit Notes and Debit Notes have **zero print capability at
all** today (no template, no print button — pure CRUD). Adding a logo to
something that doesn't print is a bigger lift than "add a logo," so per
founder decision this is split out into its own new **Phase 45 — Credit Note
& Debit Note Print Templates** (`PRODUCT_HARDENING_MASTER_PROMPT.md`), which
depends on this phase's logo/watermark mechanism but is not part of it. This
spec covers only the surfaces enumerated below.

## 1. Audit findings (ground truth, 2026-07-06)

| Surface | Verdict | Detail |
|---|---|---|
| Invoice (A4) | **EXISTS** | `print.service.ts:187`, `generateInvoiceHtml`, via `logoToFileUrl()`. No change needed. |
| Receipt (thermal 80mm/58mm) | **EXISTS** | `print.service.ts:310`, `generateReceiptHtml`, same helper. No change needed. |
| Quotation (A4) | **NEEDS EXTENSION** | `print.service.ts:343-460`, `generateQuotationHtml` — text-only header today, trivial to add via the same `logoToFileUrl()` pattern already proven on Invoice/Receipt. |
| Delivery Challan | **NEEDS EXTENSION (harder)** | `ChallanScreen.tsx:186-191`, raw `window.open('', '_blank'); document.write(html); w.print()` — this popup has **no resolvable base URL**, so a `file:///...` `<img>` src will not reliably load (this is exactly why `print-branding.ts`'s Aszurex partnership mark is embedded as a base64 data URI, not a file path, for this exact delivery mechanism). Fix: read the logo file and inline it as `data:image/...;base64,...` before interpolating into the HTML string, mirroring the existing partnership-mark pattern — do not attempt a raw file path here. |
| Vaccination Certificate | **NEEDS EXTENSION** | `VaccinationCertificate.tsx` — in-app `window.print()` on the live DOM (same process/document as the rest of the app), already has `profile` (incl. `logoPath`) via `useBusinessStore`. `file:///` should work directly, same technique as `SettingsScreen.tsx`'s own logo preview. |
| Visit Summary | **NEEDS EXTENSION** | `VisitNoteScreen.tsx`'s `SummaryBody` — same pattern as above. |
| Physio HEP | **NEEDS EXTENSION** | `PhysioPatientScreen.tsx`'s `HEPBody` — same pattern as above. |
| Dashboard | **MISSING** | `DashboardScreen.tsx:239` — text only (`businessName`), no `<img>` anywhere. |
| Watermark mode | **MISSING entirely** | Zero code hits anywhere in `src/` or `prisma/` — confirmed via full-repo grep. Only forward-looking doc mentions (`PHASE_39_COMPLETION_REPORT.md`, `SARANG_FOUNDER_NOTES.md`), explicitly deferred to this phase. |
| KOT, barcode/price labels | **Out of scope, by design** | KOT is kitchen-internal, not customer-facing; labels already carry no business-identity text at all (app-brand only) — neither is a place a business logo belongs. |
| Reports (PDF/CSV export) | **Out of scope for this phase** | Text-only today; adding logo here is a natural Phase 48 (Reports & Analytics Overhaul) concern, not this phase's — flagged, not built, to avoid scope creep into an already-planned later phase. |

**Adjacent pre-existing issues found, bundled into this phase's diff** (all sit
directly in code this phase already touches):
1. No file-size validation on logo upload (`app.handler.ts`'s `dialog:openFile`) — add a reasonable cap (2MB).
2. Old logo files in `userData/logos/` are never deleted on replace or remove (`SetupWizard.tsx`, `SettingsScreen.tsx`) — actually delete the previous file when superseded.
3. `businessProfile:update` (`auth.handler.ts:55-63`) has **zero Zod validation** — any payload shape reaches Prisma directly. Add a schema matching every other mutation handler's convention.
4. `SetupWizard.tsx:566`'s logo preview uses a raw `file://${logoPath}` (backslashes, double-slash) instead of the `logoToFileUrl()`-style normalization every other render site uses — fix for consistency and Windows robustness.
5. `ChallanScreen.tsx:188` calls `aszurexFooterHtml(10)` — an `async` function — without `await`, likely printing `[object Promise]` today. Unrelated to logo, but this phase is already rewriting this exact file's HTML-assembly code to add logo/base64 support, so fix it in the same pass rather than leave it for someone else to trip over.

## 2. Design decisions

- **Dashboard logo**: optional, not automatic. Add a `showLogoOnDashboard` boolean to `BusinessProfile` (nullable-with-default, additive migration, no NOT NULL-without-default violation). Default `false` — an owner who uploaded a logo during setup doesn't necessarily want it taking dashboard header space; they opt in via a new Settings toggle (only visible/enabled once a logo exists).
- **Watermark mode**: also optional, also a new `BusinessProfile` boolean (`enableDocumentWatermark`, default `false`) plus reuse of the same `logoPath`. One global toggle covering every print surface that supports it (Invoice, Receipt, Quotation, Challan, the 3 vertical certificates) rather than per-document-type toggles — matches this app's existing minimal-settings-surface philosophy. Rendered as a large, low-opacity (~8-10%), centered, rotated logo image behind the document content via CSS (`position: absolute`, `z-index: 0`, content at `z-index: 1`) — works identically wherever the logo `<img>`/data-URI itself already resolves (main templates directly, Challan/verticals per their respective fixes above).
- **Logo helper reuse**: extract `print.service.ts`'s existing `logoToFileUrl()` into a shared, reusable form callable from `ChallanScreen.tsx` too (which needs the base64 variant) — add a sibling `logoToBase64DataUri()` helper for the popup-based delivery path, colocated with the existing one so both stay in sync.
- **Backend-only for main-process templates, frontend-only for in-app-print templates**: Invoice/Receipt/Quotation/Challan logo+watermark logic lives in `print.service.ts` (main process, already the pattern). The 3 vertical certificates render inside the renderer process — their logo+watermark logic is added directly in their own components using the existing `useBusinessStore` profile, no new IPC needed.

## 3. File list

**Backend**:
- `prisma/schema.prisma` — add `showLogoOnDashboard Boolean @default(false)`, `enableDocumentWatermark Boolean @default(false)` to `BusinessProfile`.
- `src/main/services/print.service.ts` — add logo to `generateQuotationHtml`; add watermark rendering (shared helper) to Invoice/Receipt/Quotation; export `logoToBase64DataUri()`.
- `src/main/ipc/handlers/app.handler.ts` — file-size validation on `dialog:openFile`'s logo path.
- `src/main/ipc/handlers/auth.handler.ts` — Zod validation on `businessProfile:update`.
- `src/main/validation/` — new/extended schema for the above.

**Frontend**:
- `src/renderer/src/modules/logistics/ui/ChallanScreen.tsx` — base64 logo + watermark in the popup HTML; fix the missing `await`.
- `src/renderer/src/modules/service-business/ui/VaccinationCertificate.tsx` — logo + watermark in `CertificateBody`.
- `src/renderer/src/modules/service-business/ui/VisitNoteScreen.tsx` — logo + watermark in `SummaryBody`.
- `src/renderer/src/modules/service-business/ui/PhysioPatientScreen.tsx` — logo + watermark in `HEPBody`.
- `src/renderer/src/modules/dashboard/ui/DashboardScreen.tsx` — optional logo display, gated on `showLogoOnDashboard`.
- `src/renderer/src/modules/settings/ui/SettingsScreen.tsx` — two new toggles (dashboard logo, watermark); fix logo-file cleanup on replace/remove.
- `src/renderer/src/modules/setup/ui/SetupWizard.tsx` — fix preview path normalization; cleanup on replace during setup (edge case, lower priority).
- `src/renderer/src/shared/types/api.types.ts`, `src/main/ipc/channels.ts` — type additions for the two new fields.

## 4. Test plan

- Unit tests: file-size validation rejects an oversized file; Zod validation rejects a malformed `businessProfile:update` payload; logo cleanup actually deletes the old file on replace/remove (not just clears the DB field).
- Live verification: print each of the 7 supported document types with a logo set and confirm it renders; toggle watermark on/off and confirm it appears/disappears; toggle dashboard logo and confirm the same; confirm Challan's fixed `await` no longer prints a stray `[object Promise]`.

## 5. Non-goals (explicit)

- Credit Note / Debit Note printing — Phase 45.
- Reports/export logo — Phase 48.
- KOT, barcode/price labels — not customer-facing or not a fit, by design.
- Multiple logos / per-document-type logo choice — single logo, single source of truth (`BusinessProfile.logoPath`), matching the existing one-business-per-install model.
