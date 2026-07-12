# RELEASE_CHECKLIST.md

## SARANG BUSINESS OS LITE

### Powered by Aszurex

### Trust Beyond Limits

Version: 1.0

Document Type: Release Readiness Checklist

## PURPOSE

This document defines:

- Release Validation Process
- Pre-Release Checklist
- Security Checklist
- QA Checklist
- Deployment Checklist
- Documentation Checklist
- Approval Process

The objective is:

Protect Data

Protect Trust

Protect Stability

Protect Reputation

## CORE RELEASE PHILOSOPHY

Never release because:

The feature is finished.

Release only when:

The feature is verified.

The product is stable.

User data is protected.

## RELEASE TYPES

Patch Release

Minor Release

Major Release

## PATCH RELEASE

Examples:

Bug Fixes

Small Improvements

Minor Corrections

Example:

1.0.1

1.0.2

1.0.3

## MINOR RELEASE

Examples:

New Features

New Reports

New Templates

New Imports

Example:

1.1.0

1.2.0

## MAJOR RELEASE

Examples:

Architecture Changes

Database Changes

Major Modules

Platform Expansion

Example:

2.0.0

3.0.0

## RELEASE READINESS RULE

A release is NOT ready if:

Any critical issue exists.

Any data loss risk exists.

Any backup issue exists.

Any migration issue exists.

Any security issue exists.

## DEVELOPMENT CHECKLIST

### Code Quality

[ ] No debug code

[ ] No console logs

[ ] No test credentials

[ ] No hardcoded secrets

[ ] No temporary workarounds

[ ] No unused dependencies

[ ] No duplicate logic

[ ] Service Layer Rules Followed

[ ] Business Rules Followed

### Architecture Compliance

[ ] ARCHITECTURE.md followed

[ ] API\_AND\_SERVICE\_LAYER\_SPEC.md followed

[ ] SECURITY.md followed

[ ] BUSINESS\_RULES\_ENGINE.md followed

## DATABASE CHECKLIST

### Schema Validation

[ ] Schema reviewed

[ ] Migrations tested

[ ] Indexes verified

[ ] Foreign keys validated

[ ] Constraints validated

### Migration Validation

[ ] Upgrade path tested

[ ] Downgrade strategy reviewed

[ ] Existing data preserved

[ ] No data loss detected

### Backup Validation

[ ] Backup created successfully

[ ] Backup restored successfully

[ ] Integrity verified

[ ] Recovery tested

## BILLING CHECKLIST

Mission Critical.

[ ] Invoice creation tested

[ ] Invoice numbering verified

[ ] Discounts verified

[ ] Tax calculations verified

[ ] Inventory deduction verified

[ ] Printing verified

[ ] Reprinting verified

[ ] Invoice cancellation verified

[ ] Audit logging verified

## INVENTORY CHECKLIST

Mission Critical.

[ ] Stock addition verified

[ ] Stock reduction verified

[ ] Adjustments verified

[ ] Inventory movements verified

[ ] Negative inventory rules verified

[ ] Inventory valuation verified

## CUSTOMER CHECKLIST

[ ] Customer creation verified

[ ] Ledger verified

[ ] Outstanding calculations verified

[ ] Credit limits verified

## SUPPLIER CHECKLIST

[ ] Supplier creation verified

[ ] Supplier ledger verified

[ ] Outstanding calculations verified

## PAYMENT CHECKLIST

[ ] Payment recording verified

[ ] Outstanding updates verified

[ ] Ledger updates verified

[ ] Payment reversal verified

## REPORT CHECKLIST

[ ] Sales Report verified

[ ] Inventory Report verified

[ ] Expense Report verified

[ ] Tax Report verified

[ ] Outstanding Report verified

[ ] Audit Report verified

## ANALYTICS CHECKLIST

[ ] Dashboard loads correctly

[ ] KPIs verified

[ ] Charts verified

[ ] Analytics match source data

[ ] Trends verified

## IMPORT CHECKLIST

[ ] Product Import verified

[ ] Customer Import verified

[ ] Supplier Import verified

[ ] Inventory Import verified

[ ] Opening Balance Import verified

[ ] Error reporting verified

[ ] Rollback tested

## EXPORT CHECKLIST

[ ] PDF Export verified

[ ] Excel Export verified

[ ] CSV Export verified

[ ] Unicode verified

[ ] Formatting verified

## PRINTING CHECKLIST

[ ] 58mm Receipt

[ ] 80mm Receipt

[ ] A4 Invoice

[ ] Report Printing

[ ] QR Printing

## LOCALIZATION CHECKLIST

[ ] Currency formatting verified

[ ] Date formatting verified

[ ] Time formatting verified

[ ] Number formatting verified

[ ] Unicode support verified

## SECURITY CHECKLIST

Critical.

[ ] Context Isolation enabled

[ ] Sandboxing enabled

[ ] IPC validation verified

[ ] Input validation verified

[ ] Permission checks verified

[ ] Password hashing verified

[ ] Audit logging verified

[ ] No security warnings

## PERMISSIONS CHECKLIST

Follow:

PERMISSIONS\_MATRIX.md

[ ] Admin permissions verified

[ ] Manager permissions verified

[ ] Cashier permissions verified

[ ] Staff permissions verified

[ ] Kitchen permissions verified

Default Rule:

Access Denied

unless explicitly allowed.

## BACKUP & RECOVERY CHECKLIST

Critical.

[ ] Manual backup tested

[ ] Automatic backup tested

[ ] Restore tested

[ ] Rollback tested

[ ] Recovery tested

[ ] Corruption recovery tested

## DISASTER RECOVERY CHECKLIST

[ ] Crash recovery verified

[ ] Power failure recovery verified

[ ] Migration recovery verified

[ ] Update recovery verified

## ERROR HANDLING CHECKLIST

Follow:

ERROR\_CATALOG.md

[ ] Friendly messages displayed

[ ] No raw exceptions shown

[ ] Error references generated

[ ] Logging verified

## UI CHECKLIST

Follow:

UI\_COMPONENT\_LIBRARY.md

[ ] Design consistency verified

[ ] Responsive layouts verified

[ ] Empty states verified

[ ] Loading states verified

[ ] Accessibility verified

[ ] Keyboard navigation verified

## BRANDING CHECKLIST

Follow:

BRANDING\_AND\_MARKETING.md

[ ] Sarang branding present

[ ] Aszurex branding present

[ ] Branding not intrusive

[ ] Trust statements present

## LEGAL CHECKLIST

Follow:

LEGAL\_AND\_CLAIMS\_POLICY.md

[ ] No misleading claims

[ ] No compliance guarantees

[ ] No unsupported promises

[ ] Privacy statements verified

## PERFORMANCE CHECKLIST

Targets:

Startup

[ ] < 3 Seconds

Dashboard

[ ] < 2 Seconds

Reports

[ ] < 3 Seconds

Search

[ ] Fast and responsive

## INSTALLATION CHECKLIST

Follow:

INSTALLATION\_AND\_UPDATE\_STRATEGY.md

[ ] Fresh install tested

[ ] Upgrade tested

[ ] Existing data preserved

[ ] Uninstall tested

[ ] Reinstall tested

## DOCUMENTATION CHECKLIST

[ ] User Guide updated

[ ] Release Notes prepared

[ ] Migration Notes prepared

[ ] Known Issues documented

## RELEASE NOTES CHECKLIST

Release Notes Must Include:

New Features

Improvements

Bug Fixes

Migration Notes

Known Limitations

## FINAL APPROVAL CHECKLIST

Technical Approval

[ ]

QA Approval

[ ]

Security Approval

[ ]

Release Approval

[ ]

## RELEASE BLOCKERS

Release must NOT proceed if:

Any data loss risk exists

Any backup issue exists

Any migration issue exists

Any security issue exists

Any critical test fails

## POST-RELEASE VALIDATION

After release:

[ ] Fresh install tested

[ ] Upgrade tested

[ ] Backup verified

[ ] Reports verified

[ ] Analytics verified

## SUCCESS DEFINITION

A successful release is not:

A release with new features.

A successful release is:

A release that users can trust.

## FINAL PRINCIPLE

Features create excitement.

Stable releases create reputation.

Every release should strengthen trust in:

Sarang

Aszurex

Trust Beyond Limits.

## RELEASE COMMANDS REFERENCE

Use these exact commands for each release checklist step:

### Code Quality Commands
```bash
# TypeScript type check — must pass with 0 errors
npx tsc --noEmit

# ESLint — must pass with 0 errors
npx eslint src/ --ext .ts,.tsx

# Unit and integration tests
npx vitest run --reporter=verbose

# Test coverage report (check against minimum thresholds)
npx vitest run --coverage
```

### Build Commands
```bash
# Development build check (fast — no packaging)
npx electron-builder --dir --win

# Full installer build
npx electron-builder --win

# Verify publish is null (must show 'publish: null')
cat electron-builder.config.js | grep publish
```

### Security Verification Commands
```bash
# Check for hardcoded secrets or API keys
grep -r "apiKey\|secret\|apiSecret\|ACCESS_KEY" src/ --include="*.ts" --include="*.tsx"

# Verify no remote module or webview enabled
grep -r "enableRemoteModule\|webviewTag" src/ --include="*.ts"

# Verify contextIsolation is true in all windows
grep -r "contextIsolation" src/main/ --include="*.ts"

# Verify nodeIntegration is false in all windows
grep -r "nodeIntegration" src/main/ --include="*.ts"
```

### Database Commands
```bash
# Validate Prisma schema
npx prisma validate

# Generate Prisma client (run if schema changed)
npx prisma generate

# Check migration status
npx prisma migrate status
```

### Pre-Release Smoke Test (Manual — Run on Clean Machine)
1. Fresh install → complete onboarding wizard → verify no errors
2. Create product → create invoice → verify inventory decreased
3. Record payment → verify dashboard KPI updated
4. Create backup → restore backup → verify data matches pre-restore
5. Login as Cashier role → verify admin screens are inaccessible
6. Export invoice as PDF → verify "Powered by Aszurex" footer present
7. Print 80mm receipt → verify QR code present (if UPI configured)

Powered by Aszurex.
