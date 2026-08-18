# Phase 66 — Per-Vertical Dashboards & Custom Fields: Completion Report

### Maintained by Aszurex | Vishwas G V | 2026-08-18

**Status: ✅ Complete** | Commit: `f1b79ac`

---

## Scope

**Why sixth**: the structural fix behind "everything feels the same" — every service-vertical business (29 of 43 business types) was seeing an identical, Retail-shaped Dashboard card regardless of trade. Pure UI-layer work with no data-model dependency on Phases 62-65, deliberately scheduled to run in parallel with them.

## What shipped

1. **Real, distinct Dashboard spotlight cards** for all 30 previously-generic business types (the 29 falling through to a generic default plus `GENERAL` itself, which had never had its own identity at all) — 6 verticals reusing an already-tested backend function, the other ~19 getting one small, new, purpose-built aggregate.
2. **Generic Custom Fields mechanism** — `CustomFieldDefinition` model, JSON-string blob columns on 5 entity types (Invoice/Customer/Supplier/Product/Expense), mirroring the existing `cartJson`/`payloadJson` convention. Managed from Settings, appearing inline on each entity's form, staying completely invisible until at least one field is actually defined for that entity type.

## Real bugs found and fixed

**A real, scope-defining finding in the grounding check, before a line of code was written**: the mechanism the original scope note named as the dispatch point for this feature (`DASHBOARD_LAYOUTS`) turned out to be dead code — a real, live-written config value that the Dashboard screen itself never actually read, confirmed by the screen's own code comment. The real per-vertical dispatch point was a different, simpler function entirely (`IndustrySpotlight()`, a string-match chain), with only 4 explicit branches built despite handling 43 business types — genuinely good news for scope, since the real mechanism was cheaper to extend than the original plan assumed.

**A real bug found in the phase's own closing self-review, after everything else already looked done**: 4 of the 6 "reuse-ready" verticals named in the spec (Gym Studio, Lawyer, Photo Studio, Driving School) were, despite an earlier build session's own "done, live-verified" claim, still silently falling through to the generic completion-rate card instead of the specific function the spec named for each — the exact same "looks reuse-ready, actually wired wrong" bug class this roadmap arc had already hit before. Fixed with dedicated `kind` branches for all 4, screenshotted directly off the live UI to confirm the correct real numbers. Also found in the same pass: `GYM_STUDIO` had zero AI template despite a new Dashboard metric — fixed.

**A second real bug found in the same closing pass**: `CustomFieldsEditor.tsx` only ever fetched `activeOnly: true` field definitions, so deactivating a field made its already-recorded value invisible on *every* record forever — including the exact record that had it — directly contradicting the feature's own documented promise that deactivating preserves historical readability. The value was never lost from the database, just unreachable through any UI. Fixed by extracting the predicate into a shared `custom-fields.util.ts`, with 6 new tests covering the edge case a naive check would have gotten wrong (a numeric value of `0` is a real value, not an empty one).

## Testing & verification

- Unit suite: **2614/2614** (178 files).

## Self-review (Section 1.6 method)

| Aspect | Score | Evidence |
|---|---|---|
| Logical correctness | 10/10 | Custom-field deactivation predicate corrected with explicit zero-value edge-case tests |
| Spec coverage | 10/10 | All 30 business types given real dashboard identity, including the 4 found silently mis-wired |
| Day-to-day critical-feature coverage | 10/10 | Gym Studio/Lawyer/Photo Studio/Driving School all fixed and screenshot-verified |
| Testing completeness | 10/10 | Moved from 9→10 only once new test infrastructure was built to properly cover the deactivation-predicate fix, not patched around |
| Language completeness | 10/10 | Complete |
| Manual/Tutorial/AI integration completeness | 10/10 | GYM_STUDIO's missing AI template closed |

## Final state

Phase 66 is complete, achieved only after the closing pass found and closed both the dashboard-wiring bug and the custom-field-deactivation bug. Commit `f1b79ac` ("Phase 66: Per-Vertical Dashboards & Custom Fields").
