# SECURITY.md

## SARANG BUSINESS OS LITE

### Powered by Aszurex

### Trust Beyond Limits

Version: 1.0

Document Type: Security Specification

## PURPOSE

This document defines the security requirements, privacy principles, data protection policies, authentication rules, Electron hardening standards, and operational safeguards for Sarang Business OS Lite.

The purpose is to:

- Protect user data.
- Protect business records.
- Protect local systems.
- Reduce legal exposure.
- Reduce operational risk.
- Reduce support burden.
- Build trust.

## SECURITY PHILOSOPHY

Security decisions should prioritize:

1. User Safety
2. Data Ownership
3. Privacy
4. Simplicity
5. Reliability
6. Low Maintenance
7. Low Operational Risk

The goal is not maximum complexity.

The goal is practical security with minimal support requirements.

## CORE SECURITY PRINCIPLES

## OFFLINE FIRST

Security should not depend on cloud services.

Authentication must work offline.

Authorization must work offline.

Reports must work offline.

Business operations must work offline.

## LOCAL FIRST

Business data remains on the user's device.

No cloud database.

No hosted backend.

No external storage.

No third-party database providers.

## PRIVACY FIRST

No user tracking.

No telemetry by default.

No analytics collection.

No customer data collection.

No business data collection.

No hidden monitoring.

No behavioral tracking.

## MINIMUM TRUST MODEL

Aszurex should never require access to:

- Customer records
- Inventory data
- Sales records
- Supplier records
- Financial records
- Business information

The architecture should assume:

Aszurex has zero access to user business data.

## ELECTRON SECURITY REQUIREMENTS

These requirements are mandatory.

## CONTEXT ISOLATION

Must be enabled.

Renderer processes must not directly access Node.js APIs.

All privileged operations must go through controlled IPC channels.

## SANDBOXING

Renderer processes must be sandboxed.

Disable unnecessary privileges.

Limit access to operating system resources.

## NODE INTEGRATION

Node integration must be disabled in renderer processes.

Node APIs should never be exposed directly to frontend code.

## PRELOAD BRIDGE

Use secure preload scripts.

Expose only approved APIs.

Never expose:

File system access

Database access

Shell access

Process access

Direct IPC access

## CONTENT SECURITY POLICY

Strict CSP required.

Disallow:

Inline Scripts

Remote Scripts

Arbitrary Script Execution

Unknown Sources

Only approved local resources allowed.

## NAVIGATION CONTROL

Prevent arbitrary navigation.

Application should only load approved routes.

Block unexpected redirects.

Block remote website navigation.

## EXTERNAL LINKS

Allow only approved domains.

Examples:

Aszurex Website

Documentation Website

LinkedIn

All external links must:

- Open in external browser
- Never inside Electron window

## IPC SECURITY

All IPC calls must:

Validate sender

Validate payload

Validate permissions

Reject unknown actions

Reject malformed requests

## AUTHENTICATION SECURITY

## PASSWORD STORAGE

Never store plain text passwords.

Use:

bcrypt

or

Argon2

Store only hashed passwords.

## PASSWORD REQUIREMENTS

Minimum Length

Configurable

Support:

- Uppercase
- Lowercase
- Numbers
- Symbols

Optional password policy enforcement.

## SESSION MANAGEMENT

Local sessions only.

No cloud sessions.

No remote session storage.

Sessions expire after configurable inactivity period.

## ROLE-BASED ACCESS CONTROL

Roles:

Admin

Manager

Cashier

Staff

Kitchen Staff

Permissions must be enforced at:

UI Layer

Business Layer

Database Layer

## AUTHORIZATION PRINCIPLES

Every action must be validated.

Examples:

Delete Product

Update Inventory

Change Prices

View Reports

Restore Backup

Create Users

Modify Settings

Only authorized roles should perform these actions.

## DATABASE SECURITY

## DATABASE TYPE

SQLite

Local Storage Only

## DATABASE ACCESS

Database access only through approved service layer.

Frontend must never directly access database.

## DATA VALIDATION

Validate:

Inputs

Numbers

Dates

Currencies

Tax Rates

Identifiers

Before database insertion.

## SQL INJECTION PROTECTION

Use:

Prisma ORM

Parameterized Queries

Input Validation

Never construct raw SQL from user input.

## SENSITIVE DATA STORAGE

Sensitive values:

Passwords

License Keys (if ever introduced)

API Keys (future)

must be encrypted or securely stored.

Business data remains user-owned.

## BACKUP SECURITY

Backups are user-controlled.

Features:

Backup Export

Backup Restore

Backup Verification

Integrity Validation

## BACKUP PROTECTION

Warn users:

Backup files contain business data.

Users remain responsible for securing backup files.

## CRASH MANAGEMENT

## LOCAL CRASH LOGGING

Store logs locally.

No automatic transmission.

No remote crash reporting.

No hidden diagnostics.

## ERROR RECOVERY

Recover from:

Unexpected Shutdowns

Power Failures

Application Crashes

Corrupted Sessions

Database Integrity Failures

## DATA PRIVACY POLICY

The application must not collect:

Customer Data

Inventory Data

Business Data

Sales Data

Financial Data

User Behavior Data

Analytics Data

Tracking Data

Location Data

Usage Metrics

## OPTIONAL FUTURE TELEMETRY

If telemetry is ever introduced:

Must be:

Disabled by Default

Explicitly Opt-In

Clearly Explained

User Controlled

Revocable

No hidden collection.

## PAYMENT SECURITY

## PAYMENT RECORDING

Allowed:

Cash

UPI

Card

Wallet

Credit

Split Payments

## PAYMENT PROCESSING

NOT ALLOWED

The application must not:

Process Payments

Hold Funds

Verify Payments

Act as a Payment Gateway

Store Payment Credentials

Store Card Numbers

Store UPI Credentials

Act as Financial Infrastructure

## UPI QR

Allowed:

Generate payment request QR.

Not allowed:

Verify transactions automatically.

Claim successful payment automatically.

Handle settlement.

## FILE SYSTEM SECURITY

Limit file access.

Only allow:

Database

Backups

Exports

Imports

Reports

User-selected attachments

No unrestricted filesystem browsing.

## IMPORT / EXPORT SECURITY

Validate:

CSV

Excel

JSON

Database Imports

Prevent malformed file imports.

Prevent crashes caused by invalid files.

## UPDATE SECURITY

Version 1:

Manual Updates Only

No forced updates.

No remote code execution.

No automatic downloads.

Future update checks:

Must be optional.

Disabled by default.

User initiated.

## THIRD-PARTY DEPENDENCIES

Requirements:

Actively maintained

Open source preferred

Minimal dependencies

Regular security review

Avoid unnecessary packages.

## LEGAL RISK REDUCTION

The architecture should ensure:

Aszurex never stores customer data.

Aszurex never processes payments.

Aszurex never hosts business records.

Aszurex never becomes a data processor.

Aszurex never becomes a payment intermediary.

This significantly reduces legal, compliance and operational exposure.

## USER RESPONSIBILITIES

Users remain responsible for:

Business Compliance

Tax Compliance

Data Backups

Backup Security

User Account Management

Device Security

Operating System Security

## SECURITY TESTING REQUIREMENTS

Must Test:

Authentication

Authorization

IPC Security

Database Access

Backup Restore

Import Validation

Role Permissions

Session Handling

File Handling

Update Flow

## SECURITY SUCCESS CRITERIA

The application should:

Protect user data.

Protect business records.

Protect local systems.

Avoid unnecessary data collection.

Minimize attack surface.

Minimize support burden.

Minimize legal exposure.

Build trust.

## FINAL SECURITY STATEMENT

Sarang Security Philosophy:

Store Locally.

Process Locally.

Protect Locally.

Own Locally.

Trust Through Transparency.

Powered by Aszurex.

Trust Beyond Limits.
