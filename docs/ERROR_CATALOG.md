# ERROR_CATALOG.md

## SARANG BUSINESS OS LITE

### Powered by Aszurex

### Trust Beyond Limits

Version: 1.0

Document Type: Error Catalog & User Messaging Standards

## PURPOSE

This document defines:

- Error Categories
- Error Codes
- User Messages
- Recovery Guidance
- Logging Standards
- Support Reduction Standards

The objective is:

Reduce User Confusion

Reduce Support Requests

Improve Trust

Improve Recoverability

Improve User Experience

## CORE PRINCIPLE

Users should never see:

Database Errors

Stack Traces

Technical Exceptions

Developer Messages

Raw Error Codes

Users should see:

Clear Messages

Friendly Language

Recovery Steps

Actionable Guidance

## ERROR FORMAT

Internal Format

ERROR\_CODE

Category

Severity

Message

Suggested Action

Log Reference

## ERROR SEVERITY LEVELS

INFO

Minor notification.

WARNING

Action can continue.

User attention recommended.

ERROR

Action failed.

User intervention required.

CRITICAL

Potential data integrity risk.

Immediate attention required.

## ERROR CATEGORIES

AUTH

USER

ROLE

PERMISSION

PRODUCT

INVENTORY

CUSTOMER

SUPPLIER

INVOICE

PAYMENT

TAX

IMPORT

EXPORT

PRINT

BACKUP

RESTORE

DATABASE

SETTINGS

SYSTEM

SECURITY

## AUTHENTICATION ERRORS

## AUTH-001

Invalid Credentials

Severity:

WARNING

User Message:

Incorrect username or password.

Please try again.

Action:

Retry Login

## AUTH-002

Account Disabled

Severity:

ERROR

User Message:

This account has been disabled.

Please contact your administrator.

## AUTH-003

Session Expired

Severity:

INFO

User Message:

Your session has expired.

Please sign in again.

## PERMISSION ERRORS

## PERM-001

Access Denied

Severity:

WARNING

User Message:

You do not have permission to perform this action.

## PERM-002

Admin Permission Required

Severity:

WARNING

User Message:

Administrator access is required for this operation.

## PERM-003

Backup Restore Restricted

Severity:

WARNING

User Message:

Only administrators can restore backups.

## USER MANAGEMENT ERRORS

## USER-001

Username Already Exists

Severity:

ERROR

User Message:

This username is already in use.

Choose a different username.

## USER-002

Cannot Delete Last Admin

Severity:

ERROR

User Message:

At least one administrator must remain active.

## PRODUCT ERRORS

## PROD-001

Duplicate SKU

Severity:

ERROR

User Message:

This SKU already exists.

Please use a unique SKU.

## PROD-002

Duplicate Barcode

Severity:

ERROR

User Message:

This barcode already exists.

## PROD-003

Invalid Selling Price

Severity:

ERROR

User Message:

Selling price cannot be negative.

## PROD-004

Archived Product

Severity:

WARNING

User Message:

This product has been archived and cannot be sold.

## INVENTORY ERRORS

Critical Category.

## INV-001

Insufficient Stock

Severity:

ERROR

User Message:

Not enough stock available to complete this sale.

Suggested Action:

Reduce quantity or replenish stock.

## INV-002

Negative Inventory Blocked

Severity:

ERROR

User Message:

Stock cannot become negative.

## INV-003

Invalid Stock Adjustment

Severity:

ERROR

User Message:

A reason is required for stock adjustments.

## INV-004

Inventory Record Missing

Severity:

CRITICAL

User Message:

Inventory data appears incomplete.

Please restore a backup or contact your administrator.

## CUSTOMER ERRORS

## CUST-001

Customer Name Required

Severity:

ERROR

User Message:

Customer name is required.

## CUST-002

Customer Has Transactions

Severity:

ERROR

User Message:

This customer cannot be deleted because transactions exist.

Archive the customer instead.

## CUST-003

Credit Limit Exceeded

Severity:

WARNING

User Message:

Customer credit limit has been exceeded.

## SUPPLIER ERRORS

## SUP-001

Supplier Has Transactions

Severity:

ERROR

User Message:

This supplier cannot be deleted because transactions exist.

## INVOICE ERRORS

Mission Critical.

## INVOC-001

Invoice Requires Items

Severity:

ERROR

User Message:

Add at least one item before creating an invoice.

## INVOC-002

Invoice Total Invalid

Severity:

ERROR

User Message:

Invoice total could not be calculated.

Please review invoice items.

## INVOC-003

Invoice Already Finalized

Severity:

WARNING

User Message:

Finalized invoices cannot be edited.

Cancel and reissue the invoice if changes are required.

## INVOC-004

Invoice Number Duplicate

Severity:

CRITICAL

User Message:

Invoice numbering conflict detected.

Please contact your administrator.

## PAYMENT ERRORS

## PAY-001

Invalid Payment Amount

Severity:

ERROR

User Message:

Payment amount must be greater than zero.

## PAY-002

Payment Exceeds Outstanding

Severity:

ERROR

User Message:

Payment exceeds the customer's outstanding balance.

## PAY-003

Payment Reversal Restricted

Severity:

WARNING

User Message:

You do not have permission to reverse payments.

## TAX ERRORS

## TAX-001

Invalid Tax Configuration

Severity:

ERROR

User Message:

Tax settings appear invalid.

Please review tax configuration.

## TAX-002

Tax Calculation Failure

Severity:

ERROR

User Message:

Tax could not be calculated.

Please review invoice details.

## IMPORT ERRORS

## IMP-001

Unsupported File Type

Severity:

ERROR

User Message:

Unsupported file format.

Please use CSV or Excel files.

## IMP-002

Required Columns Missing

Severity:

ERROR

User Message:

The import file is missing required columns.

## IMP-003

Duplicate Records Found

Severity:

WARNING

User Message:

Duplicate records were detected.

Review before importing.

## IMP-004

Import Validation Failed

Severity:

ERROR

User Message:

Import validation failed.

Correct highlighted records and try again.

## EXPORT ERRORS

## EXP-001

Export Failed

Severity:

ERROR

User Message:

Export could not be completed.

Please try again.

## PRINTING ERRORS

## PRINT-001

Printer Not Found

Severity:

ERROR

User Message:

No printer was detected.

Please check your printer connection.

## PRINT-002

Print Failed

Severity:

ERROR

User Message:

The document could not be printed.

Please try again.

## BACKUP ERRORS

Critical Category.

## BK-001

Backup Creation Failed

Severity:

CRITICAL

User Message:

Backup could not be created.

Please ensure sufficient disk space is available.

## BK-002

Backup Validation Failed

Severity:

CRITICAL

User Message:

Backup validation failed.

The backup may be unusable.

## BK-003

Backup Not Found

Severity:

ERROR

User Message:

Selected backup file could not be found.

## RESTORE ERRORS

## RS-001

Restore Failed

Severity:

CRITICAL

User Message:

Restore operation failed.

No changes have been applied.

## RS-002

Backup Version Incompatible

Severity:

ERROR

User Message:

This backup was created with an incompatible version.

## DATABASE ERRORS

## DB-001

Database Locked

Severity:

ERROR

User Message:

The database is currently busy.

Please try again in a few moments.

## DB-002

Database Corruption Detected

Severity:

CRITICAL

User Message:

Database integrity issues were detected.

Restore a backup immediately.

## DB-003

Database Missing

Severity:

CRITICAL

User Message:

Business data could not be located.

Restore from backup.

## SYSTEM ERRORS

## SYS-001

Unexpected Application Error

Severity:

ERROR

User Message:

Something unexpected happened.

Please try again.

## SYS-002

Storage Full

Severity:

CRITICAL

User Message:

Storage space is insufficient.

Free up disk space and try again.

## SECURITY ERRORS

## SEC-001

Unauthorized Action Blocked

Severity:

WARNING

User Message:

This action has been blocked for security reasons.

## SEC-002

Suspicious Request Detected

Severity:

WARNING

User Message:

The request could not be completed due to a security validation failure.

## LOGGING RULES

Every ERROR and CRITICAL event must:

Create Audit Entry

Create Local Log Entry

Generate Unique Error Reference

No logs should be transmitted externally by default.

## USER EXPERIENCE RULES

Never display:

Stack Trace

SQL Error

Prisma Error

Electron Error

Node Error

Developer Debug Output

Always display:

Human Friendly Messages

Suggested Actions

Recovery Guidance

## ERROR REFERENCE FORMAT

Example:

ERR-2026-000145

Users may provide this code when seeking help.

## SUCCESS CRITERIA

Users should understand:

What happened.

Why it happened.

What to do next.

without technical knowledge.

## FINAL PRINCIPLE

Good software prevents errors.

Great software explains them.

Sarang should never make users feel confused.

Every error should increase clarity.

Every message should build trust.

## USER ACTION RECOVERY GUIDE

Step-by-step recovery — no technical knowledge required.

### AUTH RECOVERY

**AUTH-001:** Check username (not email), disable Caps Lock, try recent passwords. Ask Admin to reset.

**AUTH-002:** Contact Admin → Settings → Users → Enable Account.

**AUTH-003:** Click Sign In again. Data is safe — session expiry does not affect database.

### PERMISSION RECOVERY

**PERM-001 / PERM-002:** Note the blocked action, contact Admin. Admin: Settings → Roles → Adjust role permissions.

### PRODUCT RECOVERY

**PROD-001:** Find existing item with this SKU in Products. Use a unique SKU or leave blank.

**PROD-004:** Products → Show Archived → Restore. Or create a new product entry.

### INVENTORY RECOVERY

**INV-001:** Reduce invoice quantity, or go to Inventory → Add Stock. Admin can enable Allow Negative Inventory in Settings.

**INV-004 (CRITICAL):** Stop operations. Create backup immediately. Restore most recent backup. Contact Aszurex if no backup exists.

### INVOICE RECOVERY

**INVOC-001:** Add at least one product line item before saving.

**INVOC-003:** Open invoice → Cancel Invoice. Create new invoice with correct info. Cancelled invoice is preserved in audit trail.

**INVOC-004 (CRITICAL):** Stop creating invoices. Contact Admin. Admin: check Settings → Invoice Numbering for sequence conflicts.

### PAYMENT RECOVERY

**PAY-001:** Enter amount greater than zero.

**PAY-002:** Enter exact outstanding balance. For advance payments: Admin must enable Allow Advance Payments in customer settings.

### BACKUP RECOVERY

**BK-001 (CRITICAL):** Free disk space (need 500MB+). Change backup folder. Close other apps. Retry.

**BK-002 (CRITICAL):** Delete corrupted backup. Create a new backup immediately.

### RESTORE RECOVERY

**RS-001 (CRITICAL):** Current data is safe — nothing was changed. Verify backup file is not corrupted. Try an older backup. Contact Aszurex if all backups fail.

**RS-002:** Upgrade Sarang to match or exceed the version that created the backup. Contact Aszurex for migration help.

### DATABASE RECOVERY

**DB-001:** Wait 10 seconds, retry. Close duplicate Sarang windows. Restart app if persists.

**DB-002 (CRITICAL):** Stop all operations. Restore most recent backup immediately. Contact Aszurex if no backup available.

**DB-003 (CRITICAL):** Do NOT reinstall without Aszurex guidance. Restore from backup on external drive if available.

### SYSTEM RECOVERY

**SYS-002:** Free at least 1GB disk space. Move backup files to external drive. Run Windows Disk Cleanup. Restart Sarang.

## ERROR SEVERITY ESCALATION

| Severity | User Resolves | Admin Needed | Aszurex Contact |
|----------|--------------|--------------|-----------------|
| INFO | Yes | No | No |
| WARNING | Usually | Sometimes | No |
| ERROR | Often | Sometimes | Rarely |
| CRITICAL | Rarely | Sometimes | Recommended |

Powered by Aszurex.

Trust Beyond Limits.
