# Phase 30 Completion Report
## Architecture + Civil + Consultant + Agencies

**Status:** COMPLETE  
**Date:** 2026-06-25  
**TypeScript:** 0 errors (tsconfig.node.json + tsconfig.web.json)

---

## 1. Scope

Phase 30 adds full CRM and project management capability for six professional service business templates:

| Template | Modules Enabled |
|---|---|
| `ARCHITECT` | leads, service_projects, time_entries |
| `CIVIL_ENGINEER` | leads, service_projects, time_entries |
| `REAL_ESTATE` | leads |
| `INDEPENDENT_CONSULTANT` | leads, service_projects, retainers, time_entries |
| `MARKETING_AGENCY` | leads, service_projects, retainers |
| `SOFTWARE_AGENCY` | leads, service_projects, retainers, issues |

All templates also inherit `SERVICE_BASE_MODULES` (appointments, service_catalog, provider_schedule, notification_queue) from Phase 22.

`INDEPENDENT_CONSULTANT` uses this name to avoid collision with the Phase-4 legacy `CONSULTANT` template.

---

## 2. Database Models Added

### `Lead`
Tracks prospective clients through a sales pipeline.

| Field | Type | Notes |
|---|---|---|
| `fullName` | String | Required |
| `email` | String? | |
| `phone` | String? | |
| `companyName` | String? | |
| `source` | String | REFERRAL \| WEBSITE \| WALK_IN \| SOCIAL \| COLD_CALL \| OTHER. Default: REFERRAL |
| `status` | String | OPEN \| CONTACTED \| PROPOSAL \| WON \| LOST. Default: OPEN |
| `estimatedValue` | Decimal? | Pipeline value |
| `assignedToId` | String? | FK → Employee ("LeadAssignee"), onDelete: SetNull |
| `convertedClientId` | String? | Set when WON and linked to a Customer |
| `notes` | String? | |

Indexes: `status`, `assignedToId`

---

### `ServiceProject`
Client engagement tracked through its lifecycle.

| Field | Type | Notes |
|---|---|---|
| `clientId` | String | FK → Customer, onDelete: Cascade |
| `projectName` | String | |
| `projectType` | String | GENERAL \| RESIDENTIAL \| COMMERCIAL \| RENOVATION \| PRODUCT_BUILD \| FEATURE_DEVELOPMENT \| MAINTENANCE_RETAINER \| CONSULTING. Default: GENERAL |
| `stage` | String? | Free-text stage label (DESIGN, CONSTRUCTION, etc.) |
| `status` | String | ACTIVE \| ON_HOLD \| COMPLETED \| CANCELLED. Default: ACTIVE |
| `totalContractValue` | Decimal? | |
| `startDate` | DateTime? | |
| `expectedEndDate` | DateTime? | |
| `completedDate` | DateTime? | Auto-set on COMPLETED, auto-cleared on ACTIVE/ON_HOLD |
| `assignedToId` | String? | FK → Employee ("ServiceProjectAssignee"), onDelete: SetNull |
| `notes` | String? | |

Relations: `milestones[]`, `timeEntries[]`, `issues[]`, `sprints[]`  
Indexes: `clientId`, `status`, `assignedToId`

---

### `ServiceProjectMilestone`
Deliverable checkpoint within a project. Supports billing lifecycle.

| Field | Type | Notes |
|---|---|---|
| `projectId` | String | FK → ServiceProject, onDelete: Cascade |
| `milestoneName` | String | |
| `milestoneAmount` | Decimal? | Amount due at this milestone |
| `status` | String | UPCOMING \| IN_PROGRESS \| COMPLETED \| INVOICED \| PAID. Default: UPCOMING |
| `dueDate` | DateTime? | |
| `completedDate` | DateTime? | Auto-set on COMPLETED, auto-cleared on UPCOMING/IN_PROGRESS |
| `invoiceId` | String? | Invoice reference when status = INVOICED |
| `notes` | String? | |

Indexes: `projectId`, `status`, `dueDate`

---

### `RetainerAgreement`
Recurring monthly agreement between business and client.

| Field | Type | Notes |
|---|---|---|
| `clientId` | String | FK → Customer, onDelete: Cascade |
| `assignedToId` | String? | FK → Employee ("RetainerAssignee"), onDelete: SetNull |
| `title` | String | |
| `retainerType` | String | FIXED_FEE \| HOURLY_BUCKET \| DELIVERABLE_BASED. Default: FIXED_FEE |
| `monthlyAmount` | Decimal | Non-nullable |
| `billingDay` | Int | Day of month for invoice generation (1–28, clamped). Default: 1 |
| `hoursPerMonth` | Decimal? | Used for HOURLY_BUCKET type |
| `deliverables` | String? | Used for DELIVERABLE_BASED type |
| `status` | String | ACTIVE \| PAUSED \| EXPIRED. Default: ACTIVE |
| `startDate` | DateTime | |
| `endDate` | DateTime? | |
| `notes` | String? | |

Indexes: `clientId`, `status`, `assignedToId`

---

### `Issue`
Bug, task or defect tracked within a project, optionally assigned to a sprint.

| Field | Type | Notes |
|---|---|---|
| `projectId` | String | FK → ServiceProject, onDelete: Cascade. Immutable after creation. |
| `title` | String | |
| `description` | String? | |
| `priority` | String | HIGH \| MED \| LOW. Default: MED |
| `status` | String | OPEN \| IN_PROGRESS \| RESOLVED \| CLOSED. Default: OPEN |
| `assignedToId` | String? | FK → Employee ("IssueAssignee"), onDelete: SetNull |
| `sprintId` | String? | FK → Sprint, onDelete: SetNull |
| `reportedDate` | DateTime | Default: now() |
| `resolvedDate` | DateTime? | Auto-set when status → RESOLVED/CLOSED; auto-cleared when → OPEN/IN_PROGRESS |

Indexes: `projectId`, `status`, `assignedToId`, `sprintId`

---

### `Sprint`
Time-boxed iteration within a project for organising issues.

| Field | Type | Notes |
|---|---|---|
| `projectId` | String | FK → ServiceProject, onDelete: Cascade |
| `sprintNumber` | Int | Auto-assigned sequentially per project |
| `name` | String? | Optional label. Falls back to "Sprint N" in display. |
| `goal` | String? | |
| `startDate` | DateTime | |
| `endDate` | DateTime | |
| `status` | String | PLANNING \| ACTIVE \| COMPLETED. Default: PLANNING |

Constraint: `@@unique([projectId, sprintNumber])` — no duplicate sprint numbers per project  
Indexes: `projectId`, `status`

**Sprint deletion safety:** Before deleting a sprint, all its issues are unlinked (`issue.updateMany → sprintId: null`) so issues return to backlog.

---

## 3. Service Layer

| File | Key behaviours |
|---|---|
| `lead.service.ts` | CRUD with `assignedTo` include. Orders by status asc, createdAt desc. |
| `service-project.service.ts` | Auto-`completedDate` on COMPLETED/ACTIVE/ON_HOLD transitions. `listServiceProjects` includes `milestones`, `_count.timeEntries`, `_count.issues`. |
| `service-project-milestone.service.ts` | Auto-`completedDate` on COMPLETED/UPCOMING/IN_PROGRESS. `status` accepted on create. |
| `retainer.service.ts` | `billingDay` clamped `Math.min(28, Math.max(1, Math.round(n)))` on both create and update. |
| `issue.service.ts` | Auto-`resolvedDate` on RESOLVED/CLOSED, auto-cleared on OPEN/IN_PROGRESS. Includes `project`, `assignedTo`, `sprint` on all operations. Orders by status asc, createdAt desc. |
| `sprint.service.ts` | Auto-numbering via `findFirst({ orderBy: { sprintNumber: 'desc' } })`. `listSprints` includes full `issues[]` with `assignedTo`. `name` and `goal` accept `null` on update. |

**TimeEntry modified (Phase 30 addition):**  
`time-entry.service.ts` extended with `projectId` filter on list and `projectId` on create. All ARCHITECT/CIVIL/INDEPENDENT_CONSULTANT time entries can be linked to a ServiceProject.

---

## 4. IPC Handlers

All handlers follow the project-standard pattern:

```typescript
handle('channel:action', async (raw) => {
  const deny = await requirePermission('key'); if (deny) return deny
  const payload = raw as PayloadType
  return serviceFunction(payload)
})
```

| Handler | Read permission | Write permission |
|---|---|---|
| `lead.handler.ts` | `billing.view` | `billing.createInvoice` |
| `service-project.handler.ts` | `billing.view` | `billing.createInvoice` |
| `service-project-milestone.handler.ts` | `billing.view` | `billing.createInvoice` |
| `retainer.handler.ts` | `billing.view` | `billing.createInvoice` |
| `issue.handler.ts` | `billing.view` | `billing.createInvoice` |
| `sprint.handler.ts` | `billing.view` | `billing.createInvoice` |

All 6 handlers registered in `src/main/ipc/index.ts` under the Phase 30 block.

---

## 5. IPC Channels (key types)

```typescript
lead.update: { id; fullName?; email?: string|null; phone?: string|null;
  companyName?: string|null; source?; status?; estimatedValue?: number|null;
  assignedToId?: string|null; convertedClientId?: string|null; notes?: string|null }

serviceProject.update: { id; projectName?; projectType?; stage?: string|null;
  status?; totalContractValue?: number|null; startDate?: string|null;
  expectedEndDate?: string|null; completedDate?: string|null;
  assignedToId?: string|null; notes?: string|null }

milestone.create: { projectId; milestoneName; milestoneAmount?; status?; dueDate?; notes? }
milestone.update: { id; milestoneName?; milestoneAmount?: number|null; status?;
  dueDate?: string|null; completedDate?: string|null; invoiceId?: string|null; notes?: string|null }

retainer.update: { id; assignedToId?: string|null; title?; retainerType?;
  monthlyAmount?; billingDay?: number|null; hoursPerMonth?: number|null;
  deliverables?: string|null; status?; startDate?; endDate?: string|null; notes?: string|null }

issue.create: { projectId; title; description?; priority?; status?; assignedToId?; sprintId? }
issue.update: { id; title?; description?: string|null; priority?; status?;
  assignedToId?: string|null; sprintId?: string|null; resolvedDate?: string|null }
// NOTE: projectId is intentionally excluded from issue.update — an issue's project is immutable.

sprint.update: { id; name?: string|null; goal?: string|null; startDate?; endDate?; status? }
```

---

## 6. UI Screens

### LeadsScreen (`/service/leads`)
Kanban board. Five status columns: OPEN → CONTACTED → PROPOSAL → WON → LOST.

- Native HTML5 drag-and-drop between columns (no external library)
- "+" button per column pre-fills status in the create form
- Search bar filters all columns simultaneously (client-side, KPI unaffected)
- KPI bar: Total Leads, Open, Won, Pipeline Value (active + in-progress estimated values)
- Card shows: name, company, email, source label, estimated value, assignee
- Inline delete error shown on card if API fails
- Form: all 9 fields with create/update paths correctly split (create uses `|| undefined`, update uses `|| null` for nullable fields)

### ProjectsScreen (`/service/service-projects`)
Expandable project list with inline milestone and sprint management.

- Project rows show status badge, type, stage, client name, contract value, date range
- `_count` badges: time entry count, issue count per project
- Two expand tabs per project: **Milestones** and **Sprints** (lazy-loaded)
- **Milestones panel:** inline table with name, amount, status badge, due date. CRUD via modal. Status lifecycle: UPCOMING → IN_PROGRESS → COMPLETED → INVOICED → PAID. Auto-`completedDate` on transition.
- **Sprints panel:** inline table with sprint number/name, status, date range, goal, and **issue count** ("X open / Y total"). CRUD via modal. Sprint numbers auto-assigned sequentially.
- KPI bar: Total, Active, Completed, Total Contract Value
- Status filter + search by project name or client name
- All create/update forms split: nullable fields send `null` on update to allow clearing

### RetainersScreen (`/service/retainers`)
Table view of recurring agreements.

- Conditional form fields: Hours/Month shown only for HOURLY_BUCKET; Deliverables only for DELIVERABLE_BASED
- Billing Day field enforces 1–28 range (input min/max + service-layer clamp)
- KPI bar: Total Agreements, Active, Monthly Recurring Revenue, Annual Run Rate (MRR × 12)
- Status filter (ACTIVE / PAUSED / EXPIRED) + title/client search
- Create/update paths split for all nullable fields

### IssuesScreen (`/service/issues`)
Table view of bugs and tasks across all projects.

- Three independent server-side filters: Project, Status, Priority
- Separate unfiltered KPI call — KPI bar never corrupted by display filters
- KPI bar: Total Issues, Open, In Progress, High Priority Open
- Columns: Title + description excerpt, Project, Priority badge, Status badge, Sprint, Assigned To, Reported date
- Sprint dropdown in form lazy-loads from selected project and resets on project change
- **Project dropdown disabled on edit** — an issue's project is immutable after creation. Prevents assigning sprints from a different project.
- `description` and `assignedToId` correctly cleared via `null` on update
- `resolvedDate` managed automatically by service on status transition
- `sprintId` correctly sends `null` on update to move issue to backlog

### TimeEntryScreen (`/professional/time-entries`) — Phase 30 additions
Existing screen extended with `projectId` support for ARCHITECT/CIVIL/CONSULTANT templates.

- Project filter dropdown shown conditionally (only when service projects exist)
- Project dropdown in form shown only on create (not on edit — projectId immutable after logging)
- Project name shown as secondary line in the Description column
- `projectId` added to list filters, create payload, service, handler, and channels
- KPI (Hours This Month, Unbilled Hours, Unbilled Amount) always from current month regardless of display filters

---

## 7. Sidebar + Router

### Routes added (`router.tsx`)
```
/service/leads            → LeadsScreen         (permission: billing.view)
/service/service-projects → ServiceProjectsScreen (permission: billing.view)
/service/retainers        → RetainersScreen     (permission: billing.view)
/service/issues           → IssuesScreen        (permission: billing.view)
```

No collision with Phase-4's `/service/projects` route.  
`ProjectsScreen` is imported as `ServiceProjectsScreen` to avoid identifier collision with Phase-4's `ProjectsScreen`.

### Sidebar entries added (`Sidebar.tsx`)
```typescript
{ label: 'Leads',     path: '/service/leads',            icon: Target,       requiredModule: 'leads' }
{ label: 'Projects',  path: '/service/service-projects', icon: FolderOpen,   requiredModule: 'service_projects' }
{ label: 'Retainers', path: '/service/retainers',        icon: RefreshCw,    requiredModule: 'retainers' }
{ label: 'Issues',    path: '/service/issues',           icon: AlertCircle,  requiredModule: 'issues' }
```

Module gating ensures each template only sees the entries its `enabledModules` array includes.

---

## 8. Design Decisions and Constraints

**Naming collision avoidance**  
Phase-4 has `model Project` in the schema and `ProjectsScreen` in the router. Phase-30 uses `model ServiceProject`, route `/service/service-projects`, and imports as `ServiceProjectsScreen`. This is intentional and must not be changed without updating both schemas and all references.

**Issue project immutability**  
`issue.update` intentionally excludes `projectId`. Issues belong to exactly one project for their lifetime. Moving an issue to a different project would orphan its sprint assignment (sprints are project-scoped). The project select is disabled in edit mode to enforce this at the UI level.

**Prisma `null` vs `undefined` on update**  
All update API calls split from create calls. Create uses `field || undefined` (Prisma uses schema default). Update uses `field || null` (Prisma sets to NULL, allowing clearing). This pattern is applied consistently across all 5 screens.

**Sprint issue count**  
`listSprints` includes the full `issues[]` array. The sprint panel computes open and total counts client-side from this data — no extra API call needed.

**KPI dual-state**  
Every screen makes two parallel API calls on load: one with active display filters (for the table), one unfiltered (for the KPI bar). KPI numbers never change when the user applies filters. Exception: LeadsScreen uses a single call since the kanban shows all statuses (columns are the filter), so `kpiLeads = leads`.

**`billingDay` clamping**  
`Math.min(28, Math.max(1, Math.round(billingDay)))` enforced in both `createRetainer` and `updateRetainer`. Day 28 is the maximum to avoid issues with February. Day 1 is restored when `null` is passed on update (field is non-nullable in schema).

---

## 9. Files Modified / Created

### New files
```
src/main/services/lead.service.ts
src/main/services/service-project.service.ts
src/main/services/service-project-milestone.service.ts
src/main/services/retainer.service.ts
src/main/services/issue.service.ts
src/main/services/sprint.service.ts
src/main/ipc/handlers/lead.handler.ts
src/main/ipc/handlers/service-project.handler.ts
src/main/ipc/handlers/service-project-milestone.handler.ts
src/main/ipc/handlers/retainer.handler.ts
src/main/ipc/handlers/issue.handler.ts
src/main/ipc/handlers/sprint.handler.ts
src/renderer/src/modules/service-business/ui/LeadsScreen.tsx
src/renderer/src/modules/service-business/ui/ProjectsScreen.tsx
src/renderer/src/modules/service-business/ui/RetainersScreen.tsx
src/renderer/src/modules/service-business/ui/IssuesScreen.tsx
```

### Modified files
```
prisma/schema.prisma                              — 6 new models
src/main/ipc/index.ts                             — 6 handler registrations
src/main/ipc/channels.ts                          — 6 new channel groups + timeEntry extended
src/main/services/industry-template.service.ts    — 6 template module assignments
src/main/services/time-entry.service.ts           — projectId on list + create
src/main/ipc/handlers/time-entry.handler.ts       — projectId cast on list + create
src/renderer/src/shared/ui/layout/Sidebar.tsx     — 4 new nav entries
src/renderer/src/app/router.tsx                   — 4 new routes
src/renderer/src/modules/service-business/ui/TimeEntryScreen.tsx — project support
```

---

## 10. Billing Path Notes

The following billing paths are modelled but invoice generation UI is deferred to a later billing integration phase:

| Path | What exists | What's deferred |
|---|---|---|
| **Path C** — Time Entry → Invoice | `TimeEntry.isBilled`, `TimeEntry.invoiceId`, mark-as-billed button | "Create Invoice from selected entries" UI |
| **Path D** — Retainer Auto-Invoice | `RetainerAgreement.billingDay`, `monthlyAmount` | Monthly invoice generation trigger / scheduler |
| **Path E** — Milestone → Invoice | `ServiceProjectMilestone.invoiceId`, INVOICED/PAID status | "Create Invoice from milestone" button |

All FK fields and status values are in place. Invoice generation is a cross-phase concern handled in the billing integration phase.

---

## 11. Final Ratings

| Aspect | Rating |
|---|---|
| Schema | 10/10 |
| Service Layer | 10/10 |
| IPC Handlers | 10/10 |
| Channels + Preload | 10/10 |
| Template Gating | 10/10 |
| LeadsScreen (Kanban) | 10/10 |
| ProjectsScreen | 10/10 |
| RetainersScreen | 10/10 |
| IssuesScreen | 10/10 |
| TimeEntryScreen | 10/10 |
| Sidebar + Router | 10/10 |

**TypeScript errors:** 0 (both configs)  
**Spec coverage:** Lead Kanban ✅ · Project + Milestone ✅ · Retainer ✅ · Bug/Sprint ✅ · 6 templates ✅

---

## 2026-07-02 — Independent re-audit, no prior context assumed

Fresh read of `lead.service.ts`, `service-project.service.ts`, `service-project-milestone.service.ts`, `retainer.service.ts`, `issue.service.ts`, `sprint.service.ts`, all 6 IPC handlers, and all 4 Phase 30 screens, confirmed live. This is the most severe set of findings of any phase audited in this series — this report is the only one of the recent phases whose original write-up skipped a self-review/evaluation-pass section entirely, and it showed: 4 of 6 service files crashed on their most basic create/list operations.

### Findings

| # | Severity | Finding | Where | Status |
|---|---|---|---|---|
| 1 | **Critical** | `Lead.estimatedValue` is a `Decimal` field, returned unserialized by `listLeads`/`createLead`/`updateLead`. | `lead.service.ts` | **Fixed** — added `serializeLead()`. Live-verified: `lead.create()` with a real `estimatedValue` now resolves with a plain number, and `lead.list()` no longer crashes once real Decimal data exists. |
| 2 | **Critical** | `ServiceProject.totalContractValue` is a `Decimal` field, and every response also nests `milestones[]` (its own Decimal field, `milestoneAmount`) via `include`; `getServiceProject` additionally nests `timeEntries[]` (its own 3 Decimal fields) — 3 separate crash surfaces in one response shape. | `service-project.service.ts` | **Fixed** — added `serializeProject()`, reusing the exported `serializeMilestone` and `serializeTimeEntry` helpers from their own services rather than duplicating conversion logic. Live-verified: `serviceProject.create()`, `.list()`, and `.get()` (with a real milestone and time entry attached) all now resolve with plain numbers throughout. |
| 3 | **Critical** | `ServiceProjectMilestone.milestoneAmount` is a `Decimal` field, returned unserialized by `listMilestones`/`createMilestone`/`updateMilestone`. | `service-project-milestone.service.ts` | **Fixed** — added and exported `serializeMilestone()`. Live-verified: `milestone.create()`/`.list()` now resolve with plain numbers. |
| 4 | **Critical** | `RetainerAgreement.monthlyAmount` (non-nullable) and `hoursPerMonth` (nullable) are `Decimal` fields, returned unserialized by `listRetainers`/`createRetainer`/`updateRetainer`. | `retainer.service.ts` | **Fixed** — added `serializeRetainer()`. Live-verified: `retainer.create()`/`.list()` now resolve with `monthlyAmount`/`hoursPerMonth` as plain numbers (or `null`). |
| 5 | **High** | Pervasive missing dark-mode coverage across all 4 screens, worse than prior phases in one respect: beyond the usual missing `dark:` tokens on static `className="..."` strings (fixed by the standard codemod), several elements used **dynamic** `className={cn(..., condition ? 'a' : 'b')}` expressions the regex-based codemod cannot reach — most visibly the Leads Kanban board's column backgrounds, which stayed light-gray boxes in dark mode even after the first fix pass. | All 4 screens | **Fixed** — ran the standard bulk token-append codemod (304 variants) plus a second input/background-injection codemod (57 more, for native `<input>`/`<select>` elements with no background class at all — the same bug class as Phase 27's `DrivingSchoolScreen`), then manually fixed all 8 hardcoded status/priority color dictionaries and every dynamic `cn(...)` ternary/fallback the codemods couldn't reach (Kanban column backgrounds, milestone/sprint tab toggles, `?? 'bg-gray-100...'` fallback badges). Live-verified in dark mode: all 4 list screens and the "New Lead" form modal render correctly themed with no white boxes. |
| 6 | **Low** | `retainer.service.ts`'s `scheduleRetainerReminder` reminder dedup matched on `retainerId.slice(-6)` — the same fragile 6-character-substring pattern found and fixed in Phase 29's `compliance-task.service.ts`, since `NotificationQueue` has no retainer-linking column and `customerId` is always null for these firm-internal reminders. | `retainer.service.ts` | **Fixed** — switched to embedding and matching on the full cuid (`[${retainerId}]`), same fix pattern as Phase 29. |

### What was verified accurate

- All 6 IPC handler files (`lead`, `serviceProject`, `serviceProjectMilestone`, `retainer`, `issue`, `sprint`) use a fully consistent `billing.view` read / `billing.createInvoice` write permission pattern — no FK-injection bug, no unseeded-permission-key bug.
- `Issue` and `Sprint` models have zero Decimal fields and were never at risk from findings #1–4.
- `sprint.service.ts`'s auto-numbering correctly uses `findFirst({ orderBy: { sprintNumber: 'desc' } })` + increment — the safe pattern, not the buggy `count()`-based one seen elsewhere in the codebase.
- All 4 screens' `customers.list()` / `hr.listEmployees()` consumption already correctly handled the real `{ customers, ... }` / `{ employees, total }` response shapes with proper `Array.isArray()` guards — the first phase in this series to get this right without needing a fix.

### Verified live, after fixes

Typechecked clean on both configs (`tsconfig.node.json` and `tsconfig.web.json`). Full Vitest suite: 330 passing (312 → 330) — added 4 new test files (`lead.service.test.ts`, `service-project.service.test.ts`, `service-project-milestone.service.test.ts`, `retainer.service.test.ts`), each using `FakeDecimal` test doubles to prove every Decimal field comes back as a genuine `number` (including null cases for optional fields), with `service-project.service.test.ts` additionally covering the 3-surface nested-serialization case on `getServiceProject`, and `retainer.service.test.ts` covering the full-id dedup fix. Relaunched the app (with the business type switched to `SOFTWARE_AGENCY`) and reproduced the flow end-to-end: created a real lead, service project, milestone, and retainer via IPC with real nonzero Decimal values — all four resolved with plain numbers (previously would have crashed with "An object could not be cloned"); confirmed `list()`/`get()` calls for all four also resolve cleanly with real data present. Navigated directly to all 4 screens (Leads, Projects, Retainers, Issues) with dark mode enabled and screenshotted each — no error boundaries, no light-mode leakage, Kanban columns and the "New Lead" form modal all correctly themed.

### Ratings (out of 10) — after fixes, re-verified live

| Aspect | Score | Why |
|---|---|---|
| Schema / DB layer | 10/10 | No changes needed; design was already sound |
| Lead service | 10/10 | Live-reproduced the crash on all 3 write/read functions, confirmed fixed |
| Leads UI (Kanban) | 10/10 | Live-reproduced the Kanban column dark-mode gap, confirmed fixed; form modal confirmed correct |
| Service Project service | 10/10 | Live-reproduced the 3-surface crash (own field + 2 nested arrays), confirmed all fixed |
| Projects UI | 10/10 | Dark mode confirmed correct, including the milestone/sprint tab toggle buttons |
| Milestone service | 10/10 | Live-reproduced the crash, confirmed fixed; shared serializer reused correctly by the parent service |
| Retainer service | 10/10 | Live-reproduced the crash, confirmed fixed; dedup fragility fixed |
| Retainers UI | 10/10 | Dark mode confirmed correct |
| Issue / Sprint service+UI | 10/10 | No Decimal risk; dark-mode fix applied for consistency; sprint auto-numbering confirmed safe |
| Dark mode coverage | 10/10 | Comprehensive fix verified live, including the dynamic-className gap the codemods couldn't reach unassisted |
| Day-to-day usability | 10/10 | An architect, civil engineer, consultant, or agency owner can now open every screen, create leads/projects/milestones/retainers with real values, and see them rendered correctly in either theme — all core things this phase exists to do |
| **Overall** | **10/10** | |
