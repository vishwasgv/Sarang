# BACKUP_AND_DISASTER_RECOVERY.md

## SARANG BUSINESS OS LITE

### Powered by Aszurex

### Trust Beyond Limits

Version: 1.0

Document Type: Backup, Recovery & Disaster Recovery Specification

## PURPOSE

This document defines:

- Backup Strategy
- Recovery Strategy
- Restore Strategy
- Migration Backup Rules
- Update Recovery Rules
- Database Recovery Rules
- Disaster Recovery Procedures

The primary objective is:

Prevent Data Loss.

Protect User Trust.

Protect Business Continuity.

## CORE PHILOSOPHY

For Sarang:

Data is more important than features.

Data is more important than design.

Data is more important than upgrades.

If a conflict exists:

Protect Data First.

## TRUST PRINCIPLE

Users must always feel:

"My business data is safe."

"My data belongs to me."

"I can recover from mistakes."

"I am not locked into the software."

## BACKUP OBJECTIVES

Protect:

Products

Inventory

Invoices

Customers

Suppliers

Expenses

Reports

Settings

Users

Permissions

Tax Configurations

Industry Templates

Audit Logs

Business Information

## RECOVERY OBJECTIVES

Recover from:

Accidental Deletion

Database Corruption

Power Failure

Application Crash

Operating System Failure

Failed Updates

User Mistakes

Hardware Failure

Storage Failure

## BACKUP TYPES

## MANUAL BACKUP

User initiated.

Available from:

Settings

Backup Module

Dashboard Quick Action

User clicks:

Create Backup

System:

Creates Backup

Validates Backup

Stores Metadata

Displays Success Message

## AUTOMATIC BACKUP

Optional.

User Controlled.

Disabled by default.

Recommended options:

Daily

Weekly

Monthly

Automatic backups should never:

Transmit Data

Upload Data

Depend on Cloud Services

## PRE-UPDATE BACKUP

Mandatory.

Before every upgrade:

Create Backup

Verify Backup

Store Version Information

Store Timestamp

Only continue after successful backup.

## PRE-MIGRATION BACKUP

Mandatory.

Before every database migration:

Create Backup

Validate Backup

Store Schema Version

## EMERGENCY BACKUP

User can create:

Instant Backup

at any time.

One-click action.

## BACKUP STORAGE

Default Directory:

Sarang/

backups/

Backup Naming Format:

SARANG\_YYYY\_MM\_DD\_HH\_MM\_SS.zip

Example:

SARANG\_2026\_07\_01\_14\_35\_20.zip

## BACKUP CONTENTS

Backup Package Includes:

Database

Configuration

Settings

Templates

Users

Permissions

Business Profile

Metadata

Version Information

Backup Package Excludes:

Application Binaries

Logs

Temporary Files

Cache

## BACKUP COMPRESSION

Use:

ZIP

Reason:

Universal

Portable

Easy Recovery

No Vendor Lock-In

## BACKUP METADATA

Every backup stores:

Backup Version

Application Version

Schema Version

Creation Date

Creation Time

Business Name

Database Size

Checksum

## BACKUP VALIDATION

Every backup must be validated.

Validation Checks:

Database Exists

Database Readable

Database Not Corrupted

Metadata Present

Checksum Valid

Required Tables Present

If validation fails:

Abort Backup

Display Error

Log Failure

## BACKUP RETENTION POLICY

Suggested Defaults:

Daily Backups:

Keep 7

Weekly Backups:

Keep 4

Monthly Backups:

Keep 12

Users may customize.

## RESTORE PHILOSOPHY

Restore must be:

Simple

Safe

Predictable

Recoverable

## RESTORE FLOW

Step 1

Select Backup

Step 2

Validate Backup

Step 3

Display Metadata

Backup Date

Backup Size

Version

Business Name

Step 4

Confirm Restore

Step 5

Restore Database

Step 6

Restart Application

Step 7

Verify Data Integrity

## PRE-RESTORE SAFETY

Before restoring:

Create Current Backup

Store Current State

Allow Rollback

This ensures:

Restore Operations Are Reversible

## DATABASE INTEGRITY CHECKS

Run:

Application Startup

Backup Creation

Backup Restore

Database Migration

Manual Integrity Check

Checks:

Required Tables

Foreign Keys

Indexes

Schema Version

Corruption Detection

## DATABASE CORRUPTION RECOVERY

If corruption detected:

Display Warning

Offer Recovery Options

Offer Restore Options

Offer Export Options

Never automatically delete data.

## FAILED UPDATE RECOVERY

Scenario:

Update Fails

System Should:

Restore Previous Database

Restore Previous Configuration

Restore Previous Version

Launch Previous Stable Build

Goal:

Zero Data Loss

## FAILED MIGRATION RECOVERY

Scenario:

Migration Failure

System Should:

Abort Migration

Restore Backup

Restore Previous Schema

Display Recovery Message

## POWER FAILURE RECOVERY

Scenario:

Sudden Power Loss

System Should:

Validate Database

Check Transaction Integrity

Recover Last Stable State

Display Recovery Status

## CRASH RECOVERY

Scenario:

Application Crash

On Next Startup:

Run Integrity Check

Verify Database

Offer Backup Restore

Display Recovery Report

## HARDWARE FAILURE STRATEGY

Important:

Sarang cannot prevent hardware failures.

Provide Guidance:

Regular Backups

External Drive Backups

Cloud Storage Backups (User Managed)

USB Backup Copies

## USER BACKUP RECOMMENDATIONS

Display Reminder:

Keep at least:

1 Local Backup

1 External Backup

1 Offsite Backup

Example:

Computer

USB Drive

Google Drive (User Controlled)

## EXPORT AS EMERGENCY RECOVERY

Users should always be able to export:

Products

Inventory

Customers

Suppliers

Invoices

Expenses

Reports

Formats:

CSV

Excel

PDF

Purpose:

Prevent Vendor Lock-In

Improve Data Portability

Increase Trust

## VERSION COMPATIBILITY

Backups should remain compatible across:

Minor Releases

Patch Releases

Example:

1.0.0

1.1.0

1.2.0

Major Version Changes:

Require Migration Strategy

## RECOVERY DASHBOARD

Create dedicated page:

Backup Health

Last Backup

Backup Count

Restore Options

Database Health

Integrity Status

Storage Usage

## HEALTH INDICATORS

Green:

Protected

Yellow:

Backup Recommended

Red:

No Backup Found

## USER WARNINGS

Display:

Your business data is your responsibility.

Regular backups are strongly recommended.

Sarang provides backup tools but cannot recover deleted backup files.

## LEGAL RISK REDUCTION

Important Statement:

Sarang provides backup and recovery tools.

Users remain responsible for maintaining backups and protecting backup files.

Aszurex cannot recover backups that no longer exist.

## TESTING REQUIREMENTS

Every release must test:

Manual Backup

Automatic Backup

Backup Validation

Restore

Rollback

Migration Recovery

Crash Recovery

Corruption Recovery

Version Compatibility

## SUCCESS METRICS

A user should be able to:

Create Backup

Restore Backup

Recover From Failure

without technical knowledge.

## FINAL PRINCIPLE

The ultimate measure of trust is:

A business owner confidently storing years of business data inside Sarang.

That trust must never be broken.

Protect Data.

Protect Ownership.

Protect Trust.

## BACKUP FILE FORMAT SPECIFICATION

Every backup file created by Sarang must follow this structure:

**File extension:** `.sarang-backup` (a ZIP archive)

**Contents of the ZIP:**
```
sarang-backup-[timestamp]/
├── manifest.json        ← Backup metadata and validation info
├── sarang.db            ← Complete SQLite database file
└── attachments/         ← Optional: embedded file attachments
```

**manifest.json structure:**
```json
{
  "backup_version": "1",
  "sarang_version": "1.0.0",
  "created_at": "2026-06-18T10:30:00.000Z",
  "database_name": "sarang.db",
  "database_size_bytes": 2097152,
  "sha256_checksum": "a3f5c82d1b4e9f7...",
  "business_name": "Sharma Electronics",
  "record_counts": {
    "invoices": 1240,
    "products": 85,
    "customers": 340
  }
}
```

## CHECKSUM ALGORITHM SPECIFICATION

**Algorithm:** SHA-256

**What is checksummed:** The raw SQLite database file bytes (`sarang.db`)

**When computed:** Immediately after the database file is written into the backup ZIP, before the ZIP is finalized.

**Validation process:**
1. Extract `sarang.db` from the backup ZIP
2. Compute SHA-256 of extracted file bytes
3. Compare with `manifest.json` → `sha256_checksum`
4. If match: backup is valid
5. If mismatch: backup is corrupt — do NOT restore

**Implementation:**
```typescript
import { createHash } from 'crypto';
import { readFileSync } from 'fs';

function computeChecksum(filePath: string): string {
  const fileBuffer = readFileSync(filePath);
  return createHash('sha256').update(fileBuffer).digest('hex');
}

function validateBackup(backupPath: string, expectedChecksum: string): boolean {
  const actualChecksum = computeChecksum(backupPath);
  return actualChecksum === expectedChecksum;
}
```

## BACKUP NAMING CONVENTION

```
sarang-backup-YYYY-MM-DD-HHmmss.sarang-backup

Examples:
sarang-backup-2026-06-18-103045.sarang-backup
sarang-backup-2026-01-01-000000.sarang-backup
```

Use UTC timestamps in the filename to avoid timezone ambiguity.

## PRE-RESTORE SAFETY BACKUP

Before restoring ANY backup, Sarang must:
1. Automatically create a "pre-restore safety backup" of the current database
2. Store it in a temporary location
3. Only then proceed with the restore
4. If restore fails: automatically restore from the safety backup

This ensures NO restore operation can cause data loss.

Powered by Aszurex.

Trust Beyond Limits.
