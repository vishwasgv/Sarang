# Phase 57 — AI Assistant (Foundation) — Technical Spec

Executed against `AI_ASSISTANT_MASTER_PROMPT.md` (parent directory), whose "Phase 39" placeholder resolves to **Phase 57** per the 2026-07-12 founder decision to run this initiative before Phase 56 (User Manual). This spec folds in that document's Section 1 audit — both the original 2026-07-03 pass and the 2026-07-13 fresh re-audit, which found the codebase had grown substantially (Hotel, Jewellery, Rental, Diagnostic Lab, Blood Bank verticals; Cash Book/Trial Balance/P&L reports; international currency/tax rework) and ran a **real, not estimated** performance benchmark that changed the model pin. Nothing below is re-derived from scratch — every decision here traces to a specific, dated finding in the master prompt.

**This spec requires explicit founder sign-off before any implementation code is written** (master prompt Section 8, gate 3) — this phase touches money, customer, and permission data, and the gate matters more here than in most prior phases.

---

## 1. Model, Runtime, License — Final Decision

| | Decision | Why |
|---|---|---|
| Model | **Qwen2.5-1.5B-Instruct**, GGUF, Q4_K_M quantization, ~941MB | Re-pinned 2026-07-13 after a real benchmark on representative hardware (HP Pavilion i5-1155G7, 4c/8t, 15.8GB RAM) rejected the original pin (Phi-3.5-mini-instruct: 5.1GB peak RAM, 0.05-0.6 tok/s — too slow, too much memory for the founder's explicit 8GB-RAM-systems requirement). Qwen2.5-1.5B measured 1.8GB peak RAM and ~2.2 tok/s once generating — a real multi-x win on both axes. |
| License | Apache 2.0 | Confirmed by reading the actual LICENSE file, 2026-07-03 and spot-re-checked 2026-07-13. **Re-verify directly at implementation time** — licenses can change and this spec ages. Qwen2.5-**3B**-Instruct (a different size in the same model family) is separately and permanently rejected — Alibaba's non-commercial-only "Qwen RESEARCH LICENSE AGREEMENT." Do not confuse the two; 1.5B and 7B are Apache 2.0, 3B and 72B are not. |
| Quantizer | `bartowski` (community, same quantizer used for the original Phi pin) | Established llama.cpp-ecosystem source. |
| Runtime | `node-llama-cpp` v3.19.0 | Prebuilt Windows x64 binaries, no build toolchain required on end-user machines (confirmed the library's own `build: "never"` default in Electron contexts). ESM-only — confirmed `require()` throws `ERR_REQUIRE_ASYNC_MODULE`; every call site must use `await import('node-llama-cpp')`, which is not a new pattern (matches `product.service.ts`'s existing `await import('./industry-template.service')`) and also satisfies the lazy-load-on-first-use requirement for free. |
| GPU | **Explicitly disabled** — `getLlama({ gpu: false })`, never left to auto-detection | This exact test machine auto-detects a working Vulkan backend that then crashes with `ErrorOutOfDeviceMemory` the moment a model actually loads — a real, reproducible failure mode for integrated-GPU hardware (common on budget/mid-range laptops), not a hypothetical. CPU-only is the only path proven to work reliably. |
| Context size | **4096 tokens, explicit** — never the library default | A real bug caught in benchmarking: `createContext()` with no explicit size defaults to near the model's full 131,072-token trained context, causing a 9.4GB RAM spike on Phi and would do the same proportionally on any model. 4096 is comfortably enough for this feature's short question/answer prompts. |
| Threads | `os.cpus().length`, hinted to `createContext()` | `maxThreads` at the `getLlama()` level already self-limits sensibly (defaults to `cpuMathCores` or 4, whichever is higher) — the explicit hint doesn't need to fight that default. |

---

## 2. Real Performance Numbers (measured, not estimated)

Measured 2026-07-13 on the representative hardware above, CPU-only, bounded 4096-token context:

| Metric | Value |
|---|---|
| Runtime init | ~40ms |
| Model load (cold, disk) | ~3.2s |
| Context + session setup | ~1.1s |
| **Total cold-start to first-ready** | ~4.4s |
| Peak RAM during generation | **1.8GB** |
| Tokens/sec (steady generation) | ~2.2 |
| First (cold) two-call pipeline latency (intent + phrasing) | ~27.7s |
| Warm single-call latency (subsequent questions, session already warm) | ~5.8s |

**8GB-headroom accounting (the founder's explicit requirement)**: 1.8GB model peak + a realistic ~2-3GB OS/Electron/app baseline leaves **3-4GB free** on an 8GB machine — a genuinely comfortable margin, and the actual number that matters more than the raw model figure in isolation.

**Known, disclosed limitation — not hidden**: cold-start response time (~28s for the first question) is not sub-second. The UI (Section 8) must design around this explicitly with a real "thinking..." state, not an implied instant-chat expectation. If this proves unacceptable once felt end-to-end in the real UI, the next lever is a still-smaller model or more aggressive quantization (e.g. Q4_0) — this was not exhausted during benchmarking and is a candidate follow-up, not a blocker to shipping v1.

---

## 3. Packaging — Validated End-to-End, Not Just Designed

Proven 2026-07-13 via an isolated Electron 33.3.1 + electron-builder 26.15.3 test app matching Sarang's real versions and config shape (see master prompt Section 1 for full detail). This is not a design claim — the packaged `.exe` was actually run and confirmed to load the model correctly.

**Required `electron-builder.config.ts` changes:**
1. Add to `extraResources` (currently 6 entries): `{ from: 'resources/models/Qwen2.5-1.5B-Instruct-Q4_K_M.gguf', to: 'models/Qwen2.5-1.5B-Instruct-Q4_K_M.gguf' }`.
2. **No change needed to `asarUnpack`** — the existing generic `['**/*.node']` glob already picks up `node-llama-cpp`'s native binary automatically (confirmed: it lands at `resources/app.asar.unpacked/node_modules/@node-llama-cpp/win-x64/bins/win-x64/llama-addon.node` with zero config change).
3. **Add to `files` (or an equivalent exclusion) to prevent shipping unused platform variants**: a plain `npm install node-llama-cpp` on Windows pulls in prebuilt binaries for **5 platform/GPU variants** (win-x64, win-arm64, win-x64-cuda, win-x64-cuda-ext, win-x64-vulkan — 695MB combined). Only `@node-llama-cpp/win-x64` (45MB, CPU-only) is needed. Exclude the other 4 explicitly, e.g.:
   ```js
   files: [
     // ...existing entries...
     '!node_modules/@node-llama-cpp/win-arm64',
     '!node_modules/@node-llama-cpp/win-x64-cuda',
     '!node_modules/@node-llama-cpp/win-x64-cuda-ext',
     '!node_modules/@node-llama-cpp/win-x64-vulkan'
   ]
   ```
   Non-Windows variants (`linux-*`, `mac-*`) don't need manual exclusion — npm's own `optionalDependencies` mechanism already skips them on a Windows install.
4. **No custom native-binary path-pointing code needed** — unlike Prisma's query-engine DLL (`db.ts`'s `PRISMA_QUERY_ENGINE_LIBRARY`/`process.resourcesPath` manual override), `node-llama-cpp` resolves its own native binary internally. Do not copy the `db.ts` pattern here; it would be unnecessary code.

**Installer size**: real additive cost confirmed from an actual packaged build = model (941MB) + native binary (45MB) + JS bundle (42MB) = **1.03GB additive**. Estimated total installer: **~1.15-1.3GB** (base app ~100-150MB + additive cost, before final LZMA compression, which was not yet run in full — the validation build used the `dir` target to skip compression for speed; run a real `--win nsis` build during implementation to get the final compressed number, and update `RELEASE_CHECKLIST.md`'s `< 150MB` target with it, superseding it per the founder's explicit "even if it's 2GB, proceed" instruction from the master prompt's Section 0).

---

## 4. Schema Delta (additive only)

```prisma
model AiQueryLog {
  id               String   @id @default(cuid())
  userId           String?
  question         String              // raw user text, for the owner's own audit review
  matchedTemplate  String?             // e.g. "sales.totalToday", null if out_of_scope/no-match
  matchedCategory  String              // sales | inventory | customers | suppliers | credit | finance | vertical | out_of_scope
  success          Boolean             // false if refusal/fallback fired
  executionTimeMs  Int
  createdAt        DateTime @default(now())

  user User? @relation(fields: [userId], references: [id], onDelete: SetNull)
  @@index([createdAt])
  @@index([userId])
}
```
Additive only — no existing table touched. `userId` nullable and `onDelete: SetNull` (not a hard FK requirement) matching this codebase's established `createdById`-style convention for attribution fields. Verify the existing installed-database upgrade path (Prisma migration, no data loss) as part of implementation, same as every prior phase's rule.

---

## 5. Query Template Catalog — Final, 21-22 templates depending on active vertical

Supersedes the master prompt's original 19-template pin. Status legend: **EXISTS** (wire directly, zero new logic) / **EXISTS-NEEDS-EXTENSION** (existing function needs a small parameter addition) / **MISSING** (new aggregation function required, following `report.service.ts`'s established "`getPrisma()`, aggregate in JS" style).

### Sales (3 question groups, 5 sub-templates)
- `sales.totalToday` / `sales.totalThisWeek` / `sales.totalThisMonth` — **EXISTS**, `analytics.service.ts` `getDashboardKpis()`.
- `sales.averageInvoiceValue` — **EXISTS**, `report.service.ts` `generateSalesReport().summary.averageOrderValue`.
- `sales.compareToPreviousPeriod` — **EXISTS**, fixed granularity only: `getDashboardKpis().todayTrend/weekTrend/monthTrend`. **Decision: ship the fixed-granularity version** (today-vs-yesterday / week-vs-week / month-vs-month), reusing the exact number the Dashboard already shows — zero new logic, zero drift risk. Do not build an arbitrary-range comparator for v1.

### Inventory (4 templates)
- `inventory.lowStock` — **EXISTS**. Two implementations exist (`report.service.ts`'s `generateInventoryReport({lowStockOnly:true})` and `inventory.service.ts`'s `listInventory({lowStockOnly:true})`). **Decision: use the report-service version**, for consistency with every other Inventory-category template routing through `report.service.ts`.
- `inventory.deadStock` — **MISSING, build new.** Not sold in N days, N defaults to 90 (configurable param). No existing function of this shape anywhere in the service layer.
- `inventory.topRevenueProducts` — **EXISTS-NEEDS-EXTENSION.** `analytics.service.ts` `getTopProducts(limit)` is all-time only; add `dateFrom`/`dateTo` params.
- `inventory.bottomRevenueProducts` — **MISSING, build new.** Decision needed at implementation: how to treat zero-sales products (include as "bottom" or surface separately) vs. genuinely-low-but-nonzero sellers — flag this specific judgment call for founder confirmation if it's not obvious once real data is seen.

### Customers (3 templates)
- `customers.topThisPeriod` — **MISSING, build new, as most owners would mean it.** The only existing ranking (`getTopOutstanding`) ranks by outstanding balance owed — a different question. Build genuine period-scoped revenue/purchase-count ranking; do not silently reuse the outstanding-balance function under a name that implies something else.
- `customers.outstandingBalances` — **EXISTS**, `generateOutstandingReport()` / `getTopOutstanding()`.
- `customers.noRecentPurchases` — **MISSING, build new.** Same shape as `inventory.deadStock`, applied to customers instead of products.

### Suppliers (2 templates, collapsed from 3)
- `suppliers.topByPurchaseVolume` — **MISSING, build new.** Zero supplier-purchase-volume aggregation exists anywhere today.
- `suppliers.pendingPayments` — **EXISTS**, `generateOutstandingReport().suppliers` / `getSupplierLedger(supplierId)`.
- `suppliers.mostPurchasedFrom` — **collapsed into `topByPurchaseVolume`**, different phrasing of the same underlying function, not a second implementation. (The original master prompt flagged "confirm in audit whether these collapse" — resolved: since neither existed, one function serving both is the lower-effort, equally-correct path.)

### Credit (3 templates)
- `credit.whoOwesMe` — **EXISTS**, `generateOutstandingReport()` / `getTopOutstanding()`.
- `credit.totalReceivable` — **EXISTS**, `analytics.service.ts` `getOutstandingAmount()`.
- `credit.overdueInvoices` — **EXISTS**, as aggregate aging only (`generateOutstandingReport()`'s current/1-30/31-60/61-90/90+ buckets). **Decision: ship the aggregate aging view for v1** — no flat per-invoice list exists, and building one is new logic; the aggregate view answers "who's overdue" adequately and matches the reuse-over-reimplementation principle.

### Finance (1 template, new — decided 2026-07-13)
- `finance.profitAndLoss` — **EXISTS**, `generateProfitAndLossReport()`, universal, no vertical gate. **Included in v1 scope** — confirmed-existing, zero new logic, and one of the most natural "ask your business" questions an owner would have ("what was my profit last month"). Deferring a near-zero-cost, high-value capability to a hypothetical future phase would be caution for its own sake, not real risk reduction.

### Active Vertical (0-2 templates, wired only for the one business type actually installed — new, decided 2026-07-13)
Since only one business type is ever active per install, this is a small, bounded per-install addition, not a 43-way expansion:
- Hotel/Lodge → `hotel.occupancy` [`hotel.service.ts` `getOccupancyReport`] + `hotel.guestRegister` [`getGuestRegister`]
- Jewellery → `jewellery.stockAndSales` [`report.service.ts` `generateJewelleryReport`]
- Rental → `rental.status` [`generateRentalStatusReport`] + `rental.revenue` [`generateRentalRevenueReport`]
- Diagnostic Lab → `lab.throughput` [`generateLabThroughputReport`]
- Blood Bank → `bloodBank.stock` [`generateBloodStockReport`]
- Every other business type (the remaining ~38 of 43) → **no vertical template in v1** — no vertical-specific report exists yet for them, consistent with the original 5-category-only scope for those installs. Not a gap in this phase; a candidate for whichever future phase gives those verticals their own reports.

### Meta (1 template)
- `out_of_scope` / `advice_request` — the refusal path (Section 8 below), selected deterministically, never model-generated.

**Net implementation load**: 6 new small aggregation functions (`inventory.deadStock`, `inventory.bottomRevenueProducts`, `customers.topThisPeriod`, `customers.noRecentPurchases`, `suppliers.topByPurchaseVolume`/`mostPurchasedFrom` collapsed), 2 small extensions (`inventory.topRevenueProducts`'s date range — `sales.compareToPreviousPeriod` and `credit.overdueInvoices` both resolved to "ship as-is" above, not extensions after all), everything else wires directly into a confirmed-existing function. Budget real implementation time for the 6 new functions — they are not wiring exercises.

---

## 6. Two-Call Pipeline Architecture

The model **never** writes or executes SQL and never touches the database directly.

**`AIProvider` interface** (every call site in the query pipeline goes through this, never through `node-llama-cpp`'s API directly — proven swappable via a fake test-double implementation in unit tests, not just claimed):
```ts
interface AIProvider {
  initialize(): Promise<void>
  classifyIntent(question: string): Promise<{ template: string | null; category: string; params: Record<string, unknown> }>
  generateResponse(prompt: string): Promise<string>
  shutdown(): Promise<void>
}
```

1. **Intent + parameter extraction call** — maps the question to one of the templates in Section 5 (or `out_of_scope`) and extracts structured parameters (date range, top-N, entity name). Outputs structured data, never SQL text.
2. **Template execution** — the matched template calls its backing function (Section 5) against a connection opened **strictly read-only** (a second Prisma client / raw SQLite connection using `mode=ro` or `PRAGMA query_only=ON`, distinct from the app's normal read-write client — defense in depth even though the template layer itself shouldn't emit writes).
3. **Business rule validation** — a thin sanity-check pass on the result before phrasing: values that should never be negative aren't, date ranges are valid and non-future, an empty-but-non-null top-N result doesn't get misleadingly phrased as "zero." Catches a wrong-function-wired-to-template bug or a parameter-extraction mistake before it reaches the user as a confidently-phrased wrong answer.
4. **NL phrasing call** — phrases the already-computed, already-formatted (`formatCurrency()`/`formatDate()`) result into a natural sentence. Receives the exact numbers as literal pre-formatted strings to *restate*, never raw values to recompute. Response shape is a small set of per-category templates (a trend-comparable value always gets the trend sentence; a ranked-list result always gets the top-N sentence), not a single generic "phrase this JSON" instruction — keeps output consistent and testable.

If any template returns an empty/null result, the fixed fallback string ("I could not find enough information in your local database to answer that question.") fires **before** the phrasing call is even invoked — the model never gets the chance to fill an empty result with a plausible-sounding guess.

Legal/tax/medical/investment/compliance/government-filing questions are caught by the `out_of_scope`/`advice_request` intent category and answered with a fixed, code-owned refusal string — the model is never asked to "decide not to answer" in free text (that's promptable/injectable via the question itself, not a real guarantee).

---

## 7. IPC Surface

New channels (typed in `channels.ts`, zod-validated payloads, matching house convention):
- `ai:query` — `{ question: string }` → `{ answer: string, template: string | null }`. Primary entry point.
- `ai:getStatus` — `{}` → `{ modelLoaded: boolean }`. For UI "warming up" state.
- `ai:getHistory` — paginated, audit-log-permission-gated.
- `ai:clearHistory` — Settings action.

**Deviation from house convention, deliberate and required**: every `ai.*` handler must call `isModuleEnabled('ai_assistant')` server-side **in addition to** `requirePermission('ai.query')` (plus category-matching permission where relevant — e.g. a supplier-category question also respects whatever permission `suppliers.view` normally requires). Confirmed via a fresh grep of all 109 files in `src/main/ipc/handlers/` (2026-07-13): **zero existing handlers** re-check `TemplateModule` flags server-side — it's exclusively a service-layer/UI-layer concern today (`products.handler.ts` lines 69-72 has an explicit comment stating this is deliberate for barcode/loose-billing). That tradeoff is acceptable for those features; it is not acceptable for an assistant that can surface revenue, customer, and credit data — a disabled module must mean the capability is actually unreachable via direct IPC call, not just hidden from the UI. This is genuinely new code, not a tweak of an existing occasional pattern — consider a short comment explaining the deviation so a future contributor doesn't "fix" it back to match every other handler.

**Permission/row-level parity is mandatory**: every query template applies the exact same permission checks and row-level filters the equivalent existing screen applies (e.g. a `service_practitioner` role only ever sees their own clients' data via the assistant too). The assistant must never become a side-channel that answers a question a role couldn't see on the corresponding normal screen.

---

## 8. Settings & UI

- **`AiAssistantSection`** in `SettingsScreen.tsx`, mirroring `BarcodeSection`'s current shape (lines 1519-1652 as of this audit — expect drift by implementation time): `useIndustryStore()` for `enabledModules`/`updateEnabledModules`, a `MODULES` array, a `toggle(key,on)` function, switch-style rows. Shows which model is bundled only as "Sarang AI Assistant" in the primary UI (internal model identity may appear in a technical/about panel for support purposes only). No "download" or "update" action — the shipped model is permanent until the next Sarang version. A "clear AI conversation history" action.
- **Sidebar entry**: "Ask Sarang", gated `requiredModule: 'ai_assistant'`, matching Phase 38's "Print Labels" pattern exactly. Absent entirely (zero DOM footprint, not `display: none`) when the module is off.
- **Chat panel**: welcome tagline "Ask Your Business." No third-party model/library name ever appears anywhere in user-facing UI ("Qwen," "llama.cpp," etc. — same rule that already keeps React/Electron/Prisma/SQLite off every screen).
- **Must design explicitly for the ~28s cold-start / ~6s warm latency** (Section 2) — a real "thinking..." indicator, not an implied instant-chat UX.
- `ai_assistant` `TemplateModule` flag, defaulted OFF for every business type — zero footprint when skipped, no forced setup step, no nagging prompt (Phase 38's opt-in convention, unchanged).
- **English-only for v1** — AI responses are English regardless of the business's configured UI language; local model non-English quality is weaker and untested. Revisit only with demonstrated demand.

---

## 9. Testing Requirements

**Unit (mandatory, automated)**: every query template against a seeded test DB with exact expected results (not just "doesn't throw"); safety-refusal routing for every restricted category; hallucination fallback per template category; permission/row-level parity as a direct comparison test (call both the assistant path and the equivalent screen's path, assert identical filtered output); read-only DB enforcement (attempt a write, confirm rejection at the connection level); SQL-injection-shaped parameter test; NL-phrasing non-alteration test (feed a known amount, assert it appears unchanged); zero-network-call test (network-blocked run, identical behavior); full existing suite re-run, zero regressions against the live 1118-test baseline.

**Golden-question eval harness**: ~85-90 labeled example questions (at least 3 per template across the 21-22 in Section 5, varied phrasing) + ~15 adversarial/out-of-scope questions (legal/tax/medical/investment/off-topic + the SQL/prompt-injection-shaped attempts phrased as natural questions). **Threshold: ≥90% correct template+parameter match on in-scope, 100% correct refusal on adversarial.** If Qwen2.5-1.5B-Instruct can't clear this, address before calling the phase done (more few-shot examples, a fallback rule-based classifier for common phrasings, or reconsidering the model) — do not ship under-threshold.

**Performance**: RAM at all four states (idle-off matching pre-phase baseline exactly; idle-on-unloaded also matching baseline via lazy-load; loaded-idle; peak-generation), plus startup-time delta confirming near-zero launch cost when unused. Real numbers already gathered in Section 2 for the standalone runtime — re-measure once integrated into the real app, since Electron's own overhead adds to the baseline.

**Independent verification**: `/code-review` at high effort minimum after implementation; ask the founder whether `/code-review ultra` is warranted given the security-sensitive surface (permission-parity bypass risk, read-only boundary, no-network guarantee) — it's billed, don't assume yes. Direct the review specifically at: the intent-classifier-to-template mapping (can any input reach a template it shouldn't, or reach raw SQL), the permission/row-level parity tests, the read-only DB boundary.

**UAT** (this phase's explicit exception to the default no-manual-testing rule): `PHASE_57_UAT_SCRIPT.md` covering representative questions per category, a deliberate out-of-scope/advice question (confirm refusal), a genuinely-no-data question (confirm fallback, not a guess), a role-restricted user's question (confirm parity), and the module-off baseline (confirm zero footprint).

---

## 10. Open Decisions for Founder Sign-Off

Everything above reflects decisions already made through this audit process. Two items are flagged as genuinely open, not resolved by default:

1. **`inventory.bottomRevenueProducts`'s treatment of zero-sales products** (Section 5) — a product judgment call best made once real sample data is visible, not abstractly now.
2. **Whether the ~28s cold-start pipeline latency (Section 2) is acceptable once felt in the real built UI** — the benchmark numbers are real, but "does this feel too slow" is a product call that can only really be made by using it, not by reading a number. If it feels too slow once built, the documented next lever is a smaller model or more aggressive quantization, not further pipeline tuning (that avenue is not believed to have more to give based on this benchmark's findings).

Everything else in this spec — model pin, packaging plan, template catalog, pipeline architecture, IPC surface, testing plan — is ready to implement pending sign-off on the spec as a whole.
