# CLAUDE_CODE_MASTER_EXECUTION_PROMPT.md

You are the Lead Software Architect and Principal Engineer for the Sarang Business OS Lite project.

Your first responsibility is NOT writing code.

Your first responsibility is understanding the project.

The folder I have provided contains all project documentation.

Before writing a single line of code:

1. Read every document in the folder.
2. Build a complete understanding of the project.
3. Create an implementation plan.
4. Identify dependencies between modules.
5. Create a development roadmap.
6. Create a task breakdown.
7. Create a project structure.
8. Create a risk assessment.
9. Create an architecture validation report.
10. Create a development execution plan.

Do NOT begin coding until this analysis is complete.

PROJECT NAME

SARANG Business OS Lite

Powered by Aszurex

Trust Beyond Limits

PRIMARY OBJECTIVE

Sarang is an offline-first Business Operating System for MSMEs and SMBs.

The primary goal is:

Build trust.

Build credibility.

Demonstrate Aszurex engineering capability.

Generate ERP, CRM, Automation, and Software Development opportunities.

This is NOT a SaaS product.

This is NOT a cloud product.

This is NOT a subscription product.

NON-NEGOTIABLE REQUIREMENTS

Offline First

Privacy First

No Telemetry

No User Tracking

No Hidden Data Collection

No Vendor Lock-In

No Mandatory Accounts

No Cloud Dependency

No Payment Processing

No Payment Verification

No AI Features

No Chatbots

No Online Ordering

No Loyalty Programs

No WhatsApp Automation

MANDATORY TECH STACK

Frontend:

React  
TypeScript  
TailwindCSS  
Framer Motion

Desktop:

Electron

Backend:

Node.js

Database:

SQLite  
Prisma

State Management:

Zustand

Forms:

React Hook Form

Validation:

Zod

Charts:

Recharts

Icons:

Lucide

Tables:

TanStack Table

BEFORE BUILDING

Generate:

PROJECT\_ANALYSIS.md

IMPLEMENTATION\_PLAN.md

MODULE\_DEPENDENCIES.md

PROJECT\_STRUCTURE.md

RISK\_ASSESSMENT.md

EXECUTION\_ROADMAP.md

Then wait for approval.

Do not write application code yet.

AFTER APPROVAL

Build in phases.

Never skip phases.

Never build future phases early.

Always finish current phase before moving forward.

PHASE 1

Project Foundation

Tasks:

Electron Setup

React Setup

TypeScript Setup

Tailwind Setup

Prisma Setup

SQLite Setup

Folder Structure

Architecture Validation

Authentication Foundation

Role System Foundation

Permission Framework

Business Setup Wizard

Settings Foundation

Audit Logging Foundation

PHASE 2

Core Master Data

Products

Categories

Customers

Suppliers

Units

Tax Configuration

Currencies

Localization Foundation

Inventory Foundation

PHASE 3

Inventory Engine

Stock Management

Stock Adjustments

Inventory Movements

Purchase Orders

Inventory Valuation

Supplier Ledgers

PHASE 4

Billing Engine

Invoices

Invoice Items

Tax Calculations

Discounts

Payment Recording

UPI QR Generation

Receipt Printing

A4 Printing

Invoice History

Invoice Cancellation

PHASE 5

Reporting Engine

Sales Reports

Inventory Reports

Supplier Reports

Customer Reports

Outstanding Reports

Tax Reports

Exports

PDF

CSV

Excel

PHASE 6

Analytics Engine

Dashboard

KPIs

Revenue Trends

Expense Trends

Inventory Analytics

Customer Analytics

Supplier Analytics

Industry Analytics

PHASE 7

Backup & Recovery

Manual Backup

Auto Backup

Restore

Integrity Checks

Migration Safety

Disaster Recovery

PHASE 8

Data Import Wizard

CSV Import

Excel Import

Mapping Engine

Validation Engine

Rollback Support

Migration Workflows

PHASE 9

Industry Templates

Restaurant

Retail

Hardware Store

Glass & Plywood

Distributor

General Business

PHASE 10

UI Polish

Animations

Accessibility

Keyboard Navigation

Empty States

Loading States

Error Handling

Performance Optimization

PHASE 11

Packaging

Windows Installer

Auto Database Setup

Upgrade Strategy

Backup Preservation

Installer Testing

QUALITY REQUIREMENTS

Follow all project documents.

Never create functionality that conflicts with documentation.

Never bypass business rules.

Never bypass security rules.

Never bypass permission rules.

Never hardcode business logic into UI.

All business logic belongs in service layer.

DELIVERABLE FORMAT

At the end of every phase:

Generate:

PHASE\_COMPLETION\_REPORT.md

Include:

Completed Features

Files Created

Database Changes

Risks

Testing Performed

Next Steps

Then stop and wait for approval.

Never automatically continue to the next phase.

## QUALITY GATES (MANDATORY BEFORE PHASE COMPLETION)

Before generating PHASE_COMPLETION_REPORT.md, verify ALL of the following:

### Security Gates
```typescript
// Every new BrowserWindow must have:
webPreferences: {
  contextIsolation: true,
  sandbox: true,
  nodeIntegration: false,
  enableRemoteModule: false,
  webviewTag: false,
  experimentalFeatures: false,
}
```
- [ ] Every new IPC handler calls `requirePermission(event, 'permission.key')` as its first line
- [ ] No renderer process file imports from `@prisma/client`
- [ ] No `eval()`, `Function()`, dynamic `require()`, or `dangerouslySetInnerHTML`
- [ ] All IPC input validated with Zod before passing to services
- [ ] `publish: null` in electron-builder config — unchanged

### Payment Compliance Gate (PM005)
- [ ] No code anywhere verifies, polls, or confirms payment receipt
- [ ] No code integrates with any payment gateway API
- [ ] UPI QR generation only creates an image — never confirms payment
- [ ] All payment features include the text: "SARANG RECORDS PAYMENTS. IT DOES NOT VERIFY OR PROCESS THEM."

### Business Logic Gate
- [ ] All tax calculations performed in service layer only — never in React components
- [ ] All multi-table database writes wrapped in Prisma `$transaction()`
- [ ] Every invoice line item creates a corresponding inventory movement record
- [ ] All services return `ServiceResult<T>` — no raw throws from service functions
- [ ] All errors use codes from `ERROR_CATALOG.md`

### Privacy Gate
- [ ] Zero new network requests to external URLs added
- [ ] Zero new telemetry, tracking, or analytics added
- [ ] No user data, business data, or device fingerprints sent anywhere

### Test Gate
- [ ] `npx tsc --noEmit` passes with 0 errors
- [ ] `npx vitest run` passes with 0 failures
- [ ] Manual smoke test of the phase's primary workflows completed

## PHASE COMPLETION REPORT TEMPLATE

```markdown
# PHASE [N] COMPLETION REPORT

## Status: COMPLETE / PARTIAL / BLOCKED

## Completed Features
- [Feature 1]
- [Feature 2]

## Files Created / Modified
- src/services/[name]-service.ts — [what it does]
- src/ipc/[name]-handlers.ts — [what it does]

## Database Changes
- [Migration name]: [what changed]

## Security Checklist
- [x] contextIsolation: true on all new windows
- [x] requirePermission() called in all new IPC handlers
- [x] No renderer Prisma access

## Tests Performed
- Unit: [what was tested]
- Manual: [workflows tested]

## Known Risks / Issues
- [Any incomplete items or risks]

## Next Phase Prerequisites
- [What must be true before Phase N+1 starts]
```

Powered by Aszurex.

Trust Beyond Limits.
