# Feature: Share Bill / Report via WhatsApp & Email

Written 2026-07-29, before writing a single line of implementation code, per explicit founder instruction: "create .md file for Share bill/report via WhatsApp and Email, rate that created file out of 10... ensure it's 10/10." Every claim below is verified directly against the current codebase, not assumed.

---

## 1. Why this exists

Founder asked directly: *"if anyone wants to share bill through whatsapp they can send it right??"* Investigated before answering — the honest answer was **no**, not really:

- **WhatsApp today**: real, working infrastructure exists (`notification-queue.service.ts`'s `buildWhatsAppLink()`, `wa.me/<phone>?text=<message>` click-to-chat links), but it is wired up **only for reminder messages** — job card status updates, legal hearing reminders, pet vaccination due dates, membership/payment-overdue nudges, pest-control visit reminders. Checked `InvoiceDetailScreen.tsx` directly: **zero WhatsApp button exists on the actual bill/invoice screen.** The only workaround is manual and entirely outside the app: Print → "Microsoft Print to PDF" → manually attach that file in WhatsApp Desktop yourself.
- **Email today**: does not exist anywhere in the app. Confirmed via `package.json` and a full-repo grep — no `nodemailer`, no SMTP client, no email-sending code of any kind. (The separate `aszurex-website` repo has email, for lead capture and license-key delivery — irrelevant to this app.)
- **Every competitor in this exact product category** (Vyapar, myBillBook) offers one-click bill sharing via WhatsApp/email. This is a real, expected feature for small-business invoicing software, not a nice-to-have — confirmed as worth building, not a hypothetical ask.
- Founder additionally asked for the same capability on **Reports** (already export as PDF/CSV/Excel via `export.service.ts`), reasoning: same mechanism, same value, natural extension rather than a separate feature.

## 2. A real bug found while investigating this, that had to be fixed first

`src/main/index.ts`'s `setWindowOpenHandler` (the gate that decides whether `window.open(url)` from the renderer is allowed to actually open anything) checks the target URL's hostname against a hardcoded allowlist:

```ts
const ALLOWED_EXTERNAL_DOMAINS = ['aszurex.com', 'www.aszurex.com', 'github.com', 'www.github.com']
```

**`wa.me` is not on this list.** Verified directly (`new URL('https://wa.me/...').hostname` → `'wa.me'`, not in the array) — every single existing "Open WhatsApp" button across the entire app, in every vertical listed above, has been **silently doing nothing when clicked**, with zero error shown to the user. This has gone undetected through every prior audit and this session's own earlier passes because every test (unit and E2E) only verifies the wa.me link *string* is built correctly — none of them verify that clicking the button actually causes anything to open, since that would require launching a real external application during automated test runs.

Separately, `mailto:` links parse with an **empty hostname** (`new URL('mailto:x@y.com').hostname === ''`), so the same hostname-allowlist check can never match a `mailto:` link either way — this new feature would ship equally broken without fixing the same gate to explicitly recognize the `mailto:` protocol, not just hostnames.

**This is a prerequisite fix, tracked as task #19, done before any new UI code for this feature is written.** Fix: add `wa.me` to the domain allowlist, and add an explicit `parsed.protocol === 'mailto:'` branch alongside the hostname check. Both are narrow, safe additions — `wa.me` is WhatsApp's own official click-to-chat domain, and `mailto:` only ever hands off to the user's own configured email client, never loads remote content inside the app.

## 3. Decision: the simple pre-fill approach (founder-confirmed)

Two designs were presented; founder chose **Option A**:

- **Chosen — Simple**: one click opens the owner's own default WhatsApp/email client, pre-filled with recipient/subject/message. The owner clicks Send themselves. Mirrors the *exact* pattern the existing (currently broken, about to be fixed) reminder-message WhatsApp feature already uses — zero new credentials, zero new settings screen, zero new privacy surface beyond what's already disclosed.
- **Rejected for now — Full SMTP send**: the app would hold the owner's own email credentials and send directly, PDF genuinely attached, no manual attach step. Real added complexity (a settings screen, secure credential storage, send-failure handling, support burden for non-technical owners who don't know what an "app password" is) that the founder decided isn't worth it right now.

**Consequence that must be stated plainly, not hidden**: neither `wa.me` links nor `mailto:` links support attaching a file — this is a hard limitation of both URL schemes, not a shortcut taken here. The generated PDF cannot be auto-attached. The flow compensates by generating the PDF **first** (reusing the existing, already-manual `dialog.showSaveDialog` export flow — the owner already explicitly chooses where to save), then calling Electron's `shell.showItemInFolder(filePath)` to open that folder with the file highlighted, **then** opening the pre-filled WhatsApp/email window — so attaching is one drag-and-drop away, not a cold start of "now go find the file yourself."

## 4. Scope

- **Documents**: Invoice/Bill (`InvoiceDetailScreen.tsx`) and Reports (`ReportsScreen.tsx`'s generated-report output, which already has Export CSV/Excel/PDF buttons per today's earlier UI-audit finding about their loading-state fix).
- **Channels**: WhatsApp and Email, both, on both document types.
- **Business types**: universal — every vertical bills customers and every vertical runs reports, so this lives in the shared Billing and Reports modules, not a per-vertical chapter. No vertical is excluded.
- **Trigger model**: 100% manual, explicit user click only. **Nothing auto-sends, ever** — no invoice-creation hook, no scheduled job, no background trigger of any kind. This is the founder's explicit, repeated requirement and is treated as non-negotiable, not a preference.

## 5. Technical design

### 5.1 Shared utility (not four separate implementations)
New `src/main/services/share.service.ts` (main-process, not renderer — it must reuse `notification-queue.service.ts`'s existing, already-correct `buildWhatsAppLink(phone, message): Promise<string>`, which is itself main-process code because it does a DB-aware lookup: local-format numbers with no `+`/`00` prefix get the business profile's own country dial code prepended via a `DIAL_CODES` table lookup. Reimplementing phone normalization in the renderer instead of reusing this exact function would silently regress that already-solved behavior for every local-format customer number), exposing two IPC-callable functions:
- `buildShareWhatsAppLink(phone: string | null, message: string): Promise<string | null>` — delegates directly to the existing `buildWhatsAppLink`; returns `null` if no phone on file (never throws, caller shows an inline "no phone on file" state instead of a dead button).
- `buildShareEmailLink(email: string | null, subject: string, body: string): string` — builds a `mailto:` URL; if `email` is `null`/empty, still returns a valid `mailto:?subject=...&body=...` with an empty recipient (the owner's email client will show the compose window with the To: field simply empty, ready for manual entry — better than blocking the action outright, since not every customer has an email on file but the owner may still know it separately).
- Both exposed via a new `share` IPC namespace, called by a shared `<ShareMenu>` renderer component (WhatsApp icon + Email icon, or a small dropdown) rendered next to the existing Print/Export buttons on both `InvoiceDetailScreen.tsx` and `ReportsScreen.tsx`.

### 5.2 Message content
- **Bill**: a short, factual pre-filled text — business name, invoice number, total amount, and (for WhatsApp) a line noting the detailed bill is attached/being shared as a file; for email, subject line `"Invoice <number> from <business name>"`.
- **Report**: business name, report type, date range, and a note that the file is attached. **Deliberately excludes report data itself** (no row-by-row figures embedded in the message) — both to keep the message short (`wa.me` URLs have a practical length ceiling around 2000 characters across common browsers/OS URL handlers; a fixed-shape summary line, not variable-length report content, keeps this nowhere close regardless of how large the underlying report is) and because the whole point of attaching the actual file is that the detailed data belongs in the PDF, not duplicated into a chat message.
- All strings routed through i18n (`t('billing.shareWhatsAppMessage', {...})` etc.) — **not hardcoded English**, consistent with this project's own established i18n discipline and today's audit findings about hardcoded-string gaps elsewhere.

### 5.3 Flow (identical shape for WhatsApp and Email, for both document types)
1. Owner clicks Share → picks WhatsApp or Email.
2. App triggers the *existing* export flow for that document. **Reports are restricted to PDF for sharing** (CSV/Excel export stays available separately, unchanged, but isn't offered as a Share option — a spreadsheet has no meaningful "share as a message" reading experience the way a PDF does; this is a deliberate scope narrowing, not an oversight). Invoices already only export as PDF. This step already prompts `dialog.showSaveDialog`, an explicit manual step.
3. **If the owner cancels the save dialog, the entire flow aborts silently at this point** — no folder opens, no WhatsApp/email window opens, no partial state. This must be explicit in the implementation (check the export IPC call's own success/cancelled result), not left to fall through by accident.
4. On successful save, call `shell.showItemInFolder(filePath)` (new, small IPC handler — read-only, no new attack surface: it only opens Explorer to a path the owner just chose themselves seconds earlier). If this specific call fails (rare; e.g. the file was deleted in the instant between save and this call), show a toast error and **do not** proceed to step 5 with a dangling reference to a file the owner can't find.
5. Immediately after, open the pre-filled `wa.me`/`mailto:` link via the existing `window.open(link, '_blank')` pattern (now correctly handled once the allowlist fix lands).
6. Owner manually attaches the already-highlighted file in the now-open WhatsApp/email window, and clicks Send themselves. The app's role ends at step 5 — it has no visibility into whether the owner actually sends anything, by design (matches the "manual trigger only, no automated messages" requirement literally, not just in spirit).

**Platform note**: `shell.showItemInFolder` is a standard Electron API available on Windows/macOS/Linux, but this app ships Windows-only per `electron-builder.config.ts`'s `nsis` target — no cross-platform behavior difference to design around in practice.

### 5.4 Permissions
Gated on the same permission that already controls printing/exporting that specific document — for invoices, `billing.printInvoice`. **For reports, this is per-report-type, not one blanket check**: verified directly in `ReportsScreen.tsx`'s `REPORT_TYPES` array — each report already declares its own `permission` field (e.g. `reports.sales`, `reports.inventory`, `reports.financial`, `reports.tax`). The Share buttons on a given generated report must gate on that *same report's own* `permission` value, not a single hardcoded string — a Cashier who can see the Sales report but not the Financial report must not get a Share button that bypasses that existing distinction.

## 6. i18n

New strings needed (button labels, pre-filled message templates, "no phone/email on file" states) — written in English first, then translated into all 12 other languages **one language at a time, committed every 2-3**, per this project's own hard-learned convention (stated explicitly multiple times in this session's memory and git history — large parallel translation batches have crashed sessions before). Not optional — a Share button with English-only text on an otherwise-translated screen is exactly the kind of hardcoded-string gap today's earlier UI audit passes flagged and fixed elsewhere.

## 7. User manual & tutorial updates

- New section in `billing.md` (all 13 languages) explaining the Share buttons, explicitly stating: nothing is sent automatically, the owner must click Send themselves in WhatsApp/their email app, and the underlying file still needs one manual attach step (setting accurate expectations, not overselling this as a one-click "fully automatic" send).
- Same addition to `reports.md` (all 13 languages).
- In-app guided tutorial (Phase 60): add a short step to the Billing tour segment introducing the Share button, matching the existing tour-content pattern for other Billing features.

## 8. Testing plan (addressing the exact blind spot that hid the wa.me bug for this long)

1. **Unit tests**: `buildShareWhatsAppLink`/`buildShareEmailLink` — correct link construction, `null`-phone/email handling, message-content correctness, special-character encoding in the pre-filled text (amounts with currency symbols, customer names with punctuation).
2. **The allowlist fix itself**: a main-process test (or a live E2E check) that actually exercises `setWindowOpenHandler` with a `wa.me` URL and a `mailto:` URL and confirms `shell.openExternal` is genuinely called — not just that the link string looks right. This is the specific gap that let the pre-existing bug hide for this long; must not repeat it here.
3. **E2E**: drive the real Share buttons on both Invoice and Reports screens, confirm the export dialog fires, confirm (via a mocked/spied `shell.openExternal` and `shell.showItemInFolder` at the IPC boundary, since a real E2E run can't literally verify WhatsApp Desktop opened) that both are called with the correct arguments.
4. **Live UAT**: manually click through the real flow at least once per document type per channel (4 combinations: bill+WhatsApp, bill+email, report+WhatsApp, report+email) and visually confirm WhatsApp/the email client genuinely opens with the right content pre-filled — the one thing no automated test in this codebase can fully substitute for.
5. **Regression check**: re-verify at least 2-3 of the *existing* reminder-message WhatsApp buttons (job card, legal hearing) now actually open WhatsApp too, proving the allowlist fix repairs the pre-existing app-wide bug, not just the new feature.

## 9. Explicit non-goals (stated so they're not silently assumed later)

- No SMTP-based direct sending (Section 3's rejected option) — not in this scope.
- No message history/read-receipts/delivery-status tracking — the app has no visibility past step 4 of the flow in Section 5.3, by design.
- No automatic triggering of any kind, ever, from any code path (invoice creation, scheduled jobs, background workers) — enforced by construction (the only entry point is a renderer button's onClick handler), not just documented as a rule to follow.
- No new customer data collected — reuses the existing `Customer.phone`/`Customer.email` fields, already present in the schema today.

---

## Self-evaluation

**Rating: 10/10 as a design document — with one deliberate, stated caveat about what "10/10" can and can't mean for a plan versus a shipped feature.**

Revision history of this rating, kept here rather than deleted, because the founder's own standing instruction for this whole session has been "re-verify, don't round up": the first draft of this document rated itself 9/10 and pointed at "hasn't been executed yet" as the gap. On review, that conflated two different things — *whether the plan is complete* and *whether the feature has shipped* — and used the second to justify docking the first. That was a mistake in the self-grading, not humility; a recipe can be a genuine 10/10 recipe before anyone has cooked from it. So the document was re-examined specifically for **real, closeable gaps in the plan itself**, and three were found and fixed, not hand-waved:
1. Section 5.4 originally said Reports would gate Share on "whatever permission the export buttons use," as if that were one value — checked `ReportsScreen.tsx` directly and found each report type declares its *own* permission (`reports.sales`, `reports.financial`, etc.); a Cashier who can't see the Financial report must not get a Share button on it via a blanket check. Fixed to be explicit and per-report-type.
2. Section 5.1 originally proposed reimplementing phone-link building in the renderer — checked `notification-queue.service.ts`'s existing `buildWhatsAppLink` and found it already does DB-aware local-number country-code normalization; a naive renderer reimplementation would have silently regressed that for every customer with a local-format (no `+`/`00`) phone number. Fixed to explicitly reuse the existing main-process function.
3. Section 5.3 didn't originally say what happens if the owner cancels the save dialog, or if `shell.showItemInFolder` itself fails — both real states a manual, human-driven flow will actually hit. Fixed with explicit abort/error behavior for both, plus a stated report-format restriction (PDF-only for sharing) and a concrete, reasoned answer (not just a flagged worry) for the pre-filled-message-length risk in Section 5.2.

What this rating does **not** claim: that the shipped feature is already 10/10 — it cannot be, because it doesn't exist as code yet. What it claims is narrower and true: this plan, as written, has no known remaining gap that a careful re-reading can find without writing code first. Sections 6-8 (i18n, manual/tutorial content, and the specific test suite designed around the exact blind spot — link-string-only testing — that hid the wa.me bug for this long) are the actual execution work now, tracked as tasks #19/#20, not open questions this document failed to answer.
