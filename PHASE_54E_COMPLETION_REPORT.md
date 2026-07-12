# Phase 54E — Universal Customer Reuse-by-Phone & Remaining Chart Gap: Completion Report

## Scope

Two follow-up asks from the user after Phase 54D: (1) confirm customer data is collected only once and reused everywhere by phone number, not just at the main billing screen; (2) confirm no chart-worthy screen was missed after the Phase 54C chart rollout and subsequent chart-removal pass.

Two parallel research agents audited the whole app against both asks before any code changed.

## Findings

**Customer reuse — one real bug, one systemic UX gap:**
- **Real bug**: `student-profile.service.ts`'s `createStudent()` called `tx.customer.create()` unconditionally with zero duplicate check — every coaching-institute enrollment created a brand-new `Customer` row even if that phone number already existed from a purchase or another business flow.
- **Systemic gap**: ten other service-vertical screens (Appointments, Blood Issue, Memberships, Driving School, Retainers, Car Job Cards, Pest Control, Tailoring, Events, Shoots) each picked a customer from a capped `api.customers.list()` dropdown with no phone search and no inline "add new customer" — unlike `BillingScreen.tsx`'s already-good debounced phone search + quick-add pattern.

**Chart gap — one confirmed miss:**
- `LogisticsAnalyticsScreen.tsx`'s "Monthly Trend" and "Top Carriers" sections were still plain HTML tables/lists, even though identical data shapes are already charted elsewhere in the app (Dashboard, the Reports module's own Logistics report). Everything else surveyed (Outstanding Analytics' credit bars, Production Analytics' stacked status bar, Blood Stock's KPI tiles, various operational CRUD screens) was independently confirmed to already have an appropriate encoding or to correctly be chart-free (point-in-time counts, individual-record lists).

## Fixes

**1. `createStudent` now finds-and-reuses an existing customer instead of duplicating** (`student-profile.service.ts`): if the caller passes a `customerId` (the new CustomerPicker UI resolves one), it's used directly; otherwise falls back to a phone lookup (`tx.customer.findFirst({ phone, isActive: true })`); only creates a new `Customer` row if neither matches. Mirrors — but deliberately does not reuse verbatim — `customer.service.ts`'s existing phone-uniqueness convention: that function *rejects* a duplicate phone with an error (`CUS-002`), which is right for a dedicated Customers-management screen but wrong for an enrollment workflow, where silently reusing the match is what the user actually asked for ("collect customer's data only once... use it every time by phone number").

**2. New shared `CustomerPicker` component** (`shared/ui/molecules/CustomerPicker.tsx`) — replicates `BillingScreen.tsx`'s debounced phone/name search (`api.customers.search`) plus inline minimal-fields quick-add (name required, phone optional), so every screen gets the same reuse behavior instead of re-implementing it. Wired into all 10 screens named above, plus `StudentsScreen.tsx`. For screens with an edit mode where the client can't be changed, the picker is swapped for a plain read-only display of the already-linked customer (matching each screen's prior `disabled={!!editX}` behavior) rather than re-rendering a picker that can't do anything.

**3. `LogisticsAnalyticsScreen.tsx` charts added** — two small bar charts (shipment count, freight amount — kept as two separate charts rather than one dual-axis chart, since the two measures are on incompatible scales) above the existing Monthly Trend table, and a horizontal ranked bar chart above the existing Top Carriers list. Existing tables/lists kept alongside the charts since exact per-month/per-carrier figures still have standalone value — consistent with how other reports in the app pair a chart with a detail table rather than replacing one with the other.

## Verification

- **0 TypeScript errors** both configs.
- **827/827 tests pass** (was 823 at Phase 54D's close — 4 new tests covering `createStudent`'s customerId-reuse, phone-match-reuse, create-when-no-match, and create-when-no-phone-given cases).
- **Live end-to-end verification via Playwright against the real Electron app**: created a real "Pre-Existing UAT Person" customer directly via the Customers API, then — from the Students screen's Add Student modal — searched that exact phone number in the new CustomerPicker, confirmed it appeared in the dropdown, selected it, and saved. Verified via direct API calls (not mocks) that exactly one `Customer` row exists with that phone (no duplicate created) and that the new `StudentProfile` is linked to the same pre-existing `customerId`. Separately navigated to Logistics Analytics and confirmed both new charts render (2 `recharts` `<svg>` elements, no crash) with working tooltips. All test data cleaned up afterward; business type restored to `MANUFACTURING`; admin password re-randomized.

## Final state

0 TS errors both configs, 827/827 tests (was 823 at Phase 54D's close). The core duplicate-customer bug is fixed, the same reuse-by-phone UX is now available everywhere a customer/client is attached to a booking, and the one remaining chart gap found by audit is closed.
