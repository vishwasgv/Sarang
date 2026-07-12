# INSTALLATION_AND_UPDATE_STRATEGY.md

## SARANG BUSINESS OS LITE

### Powered by Aszurex

### Trust Beyond Limits

Version: 1.0

Document Type: Installation, Deployment & Update Strategy

## PURPOSE

This document defines:

- Installation Strategy
- Distribution Strategy
- Upgrade Strategy
- Backup Migration Strategy
- Rollback Strategy
- Recovery Strategy
- Future Platform Expansion

The objective is to ensure Sarang remains:

Easy To Install

Easy To Upgrade

Easy To Recover

Easy To Maintain

with minimal support requirements.

## CORE PHILOSOPHY

A business owner should be able to:

Download

Install

Configure

Use

Backup

Restore

Update

without technical expertise.

No command line.

No database setup.

No server setup.

No cloud account.

No Aszurex account.

## VERSION 1 PLATFORM

Primary Platform:

Windows Desktop

Technology:

Electron

Packaging:

electron-builder

Installer Type:

Windows Installer (.exe)

## FUTURE PLATFORMS

Phase 2:

Android Application

React Native

Future Possibilities:

Linux

macOS

Portable Version

## INSTALLATION OBJECTIVES

Target Installation Time:

Less than 5 Minutes

Target Setup Time:

Less than 10 Minutes

Total Time To First Invoice:

Less than 15 Minutes

## DISTRIBUTION STRATEGY

Primary Source:

Sarang Official Website

Powered by Aszurex

Secondary Sources:

GitHub Releases (Optional)

Direct Download Links

Partner Websites (Future)

Offline USB Distribution (Optional)

## INSTALLER EXPERIENCE

The installer should feel:

Professional

Simple

Trustworthy

Fast

Modern

## INSTALLER FLOW

Step 1

Welcome Screen

Display:

SARANG

Business OS Lite

Powered by Aszurex

Trust Beyond Limits

Step 2

License Agreement

Terms of Use

Privacy Summary

Disclaimer Summary

Step 3

Installation Location

Default:

Program Files

Custom Option Available

Step 4

Install

Automatic Installation

No user configuration required.

Step 5

Launch Sarang

Open Setup Wizard

## DATABASE INSTALLATION

The installer must automatically:

Create SQLite Database

Create Required Folders

Initialize Settings

Initialize Configuration

Create Backup Directory

Create Logs Directory

No manual database setup.

## FIRST RUN EXPERIENCE

After installation:

Launch Setup Wizard

## SETUP WIZARD FLOW

Business Name

Business Type

Country

Currency

Tax Model

Phone

Email (Optional)

Tax Number (Optional)

UPI ID (Optional)

Logo Upload

Create Admin User

Finish Setup

Launch Dashboard

## INSTALLATION DIRECTORY STRUCTURE

Sarang/

├── app/

├── database/

│   └── sarang.db

│

├── backups/

│

├── exports/

│

├── logs/

│

├── assets/

│

└── configuration/

## DATABASE LOCATION STRATEGY

Database must remain local.

Default:

Application Data Folder

User Accessible

User Owns Database

## BACKUP DIRECTORY

Automatically Create:

backups/

Store:

Manual Backups

Restore Points

Migration Backups

## EXPORT DIRECTORY

Automatically Create:

exports/

Store:

PDF

Excel

CSV

Reports

Invoices

Receipts

## LOG DIRECTORY

Automatically Create:

logs/

Store:

Local Application Logs

No automatic transmission.

No remote upload.

## VERSIONING STRATEGY

Use Semantic Versioning.

Format:

Major.Minor.Patch

Examples:

1.0.0

1.1.0

1.2.5

2.0.0

## VERSION DEFINITIONS

Major Version

Breaking Changes

Large Features

Architecture Changes

Minor Version

New Features

Enhancements

Non-Breaking Improvements

Patch Version

Bug Fixes

Security Fixes

Minor Corrections

## UPDATE STRATEGY

Version 1:

Manual Updates Only

Reason

Avoid:

Update Servers

Cloud Infrastructure

Maintenance Costs

Automatic Update Issues

Additional Support Burden

## UPDATE PROCESS

User Downloads New Installer

User Runs Installer

Installer Detects Existing Installation

Installer Preserves Database

Installer Preserves Settings

Installer Preserves Backups

Installer Updates Application

## PRE-UPDATE CHECKS

Before update:

Database Exists

Backup Created

Version Compatible

Storage Available

## AUTOMATIC BACKUP BEFORE UPDATE

Mandatory

Before every upgrade:

Create Database Backup

Store Version Number

Store Timestamp

Verify Backup Integrity

## UPDATE COMPATIBILITY

All updates must preserve:

Business Data

Customers

Products

Inventory

Invoices

Reports

Settings

Users

Audit Logs

## MIGRATION STRATEGY

Database migrations must use:

Prisma Migrations

Migration Requirements

Version Tracking

Rollback Capability

Validation

Error Recovery

## MIGRATION FLOW

1. Detect Version
2. Create Backup
3. Apply Migration
4. Validate Database
5. Launch Application

If migration fails:

Restore Backup

Display Error

Abort Upgrade

## ROLLBACK STRATEGY

If update fails:

Restore Previous Database

Restore Previous Configuration

Restore Previous Version

Prevent Data Loss

## CRASH RECOVERY

Application must recover from:

Power Failures

Unexpected Shutdowns

Operating System Crashes

Update Failures

Database Corruption

## DATABASE INTEGRITY CHECKS

Run:

Startup Validation

Backup Validation

Migration Validation

Restore Validation

## RESTORE STRATEGY

Restore Sources:

Backup Files

Database Files

Migration Backups

Restore Process:

Select Backup

Validate Backup

Preview Metadata

Restore

Restart Application

## IMPORT STRATEGY

Supported Imports:

CSV

Excel

JSON

Database Backup Files

Validation Required

Before import:

File Type

Schema

Required Fields

Version Compatibility

## EXPORT STRATEGY

Supported Exports:

PDF

CSV

Excel

JSON (Future)

Exports should be:

Readable

Portable

Professional

Branded

## OFFLINE INSTALLATION STRATEGY

Sarang must be installable without internet.

Installer should contain:

Application

Database Engine

Assets

Templates

Dependencies

Documentation

Everything required to operate.

## PORTABLE EDITION (FUTURE)

Possible Future Version:

No Installation

USB Based

Portable Database

Portable Backups

## ANDROID DEPLOYMENT STRATEGY

Future Phase

Distribution:

Google Play

Direct APK Download

Android Requirements

Offline First

Local Storage

Local Backups

No Cloud Dependency

## UPDATE NOTIFICATION STRATEGY

Version 1:

No Automatic Update Checks

Future Optional

User Controlled

Disabled By Default

Check For Updates Button

Manual Action Only

## SUPPORT REDUCTION STRATEGY

Installation should require:

No Technical Knowledge

No Database Knowledge

No Networking Knowledge

No Configuration Knowledge

## FAILURE RECOVERY STRATEGY

Application must always prioritize:

Data Preservation

Rollback Capability

Backup Recovery

User Ownership

## TESTING REQUIREMENTS

Test:

Fresh Installation

Upgrade Installation

Rollback

Backup Restore

Database Migration

Corrupted Database Recovery

Power Failure Recovery

Version Compatibility

## SUCCESS METRICS

A new user should:

Download Sarang

Install Sarang

Configure Sarang

Create First Invoice

within 15 minutes.

Without contacting Aszurex.

## FINAL INSTALLATION OBJECTIVE

Installation should feel effortless.

Updates should feel safe.

Backups should feel reliable.

Recovery should feel trustworthy.

The user should always feel:

"I own my data."

"I control my software."

"I don't depend on anyone."

## SETUP WIZARD SCREEN FLOW

The Setup Wizard launches automatically on first run. It must complete in under 5 minutes for a motivated user.

### Screen 1 — Welcome
```
┌─────────────────────────────────────────────┐
│                                             │
│         SARANG Business OS Lite            │
│         Powered by Aszurex                 │
│                                             │
│   Welcome! Let's set up your business.     │
│                                             │
│   This takes about 2 minutes.              │
│                                             │
│              [ Get Started → ]             │
│                                             │
└─────────────────────────────────────────────┘
```
No accounts. No internet. No subscriptions required.

### Screen 2 — Business Details
```
┌─────────────────────────────────────────────┐
│  Step 1 of 4: Your Business               │
│                                             │
│  Business Name *                           │
│  [___________________________________]     │
│                                             │
│  Business Address (Optional)               │
│  [___________________________________]     │
│                                             │
│  Phone Number (Optional)                   │
│  [___________________________________]     │
│                                             │
│  GST / Tax Number (Optional)               │
│  [___________________________________]     │
│                                             │
│  [ ← Back ]              [ Next → ]       │
└─────────────────────────────────────────────┘
```

### Screen 3 — Region & Currency
```
┌─────────────────────────────────────────────┐
│  Step 2 of 4: Region & Currency           │
│                                             │
│  Country                                   │
│  [ India (Default)             ▼ ]        │
│                                             │
│  Currency                                  │
│  [ ₹ Indian Rupee (INR)       ▼ ]        │
│                                             │
│  Date Format                               │
│  [ DD/MM/YYYY                  ▼ ]        │
│                                             │
│  Tax System                                │
│  [ GST (India)                 ▼ ]        │
│                                             │
│  [ ← Back ]              [ Next → ]       │
└─────────────────────────────────────────────┘
```

### Screen 4 — Business Type
```
┌─────────────────────────────────────────────┐
│  Step 3 of 4: What type of business?     │
│                                             │
│  ┌──────────────┐  ┌──────────────┐       │
│  │ 🍽 Restaurant│  │ 🛒 Retail   │       │
│  │              │  │ Store        │       │
│  └──────────────┘  └──────────────┘       │
│                                             │
│  ┌──────────────┐  ┌──────────────┐       │
│  │ 🔧 Hardware / │  │ 📦 Distributor│      │
│  │ Materials    │  │              │       │
│  └──────────────┘  └──────────────┘       │
│                                             │
│  ┌──────────────────────────────────┐      │
│  │ ⚙ Custom / Other Business       │      │
│  └──────────────────────────────────┘      │
│                                             │
│  [ ← Back ]              [ Next → ]       │
└─────────────────────────────────────────────┘
```
Selected template is highlighted with blue border and checkmark.

### Screen 5 — Create Admin Account
```
┌─────────────────────────────────────────────┐
│  Step 4 of 4: Create Admin Account       │
│                                             │
│  Admin Name *                              │
│  [___________________________________]     │
│                                             │
│  Password *                                │
│  [___________________________________]     │
│                                             │
│  Confirm Password *                        │
│  [___________________________________]     │
│                                             │
│  ℹ This account stays on your device.    │
│    No email or internet required.          │
│                                             │
│  [ ← Back ]        [ Complete Setup ✓ ]  │
└─────────────────────────────────────────────┘
```

### Screen 6 — Setup Complete
```
┌─────────────────────────────────────────────┐
│                                             │
│              ✓ Setup Complete              │
│                                             │
│   [Business Name] is ready.               │
│                                             │
│   Your data stays on this device.         │
│   No subscriptions. No cloud.             │
│                                             │
│   Tip: Create your first backup           │
│   after adding your business data.        │
│                                             │
│          [ Go to Dashboard → ]            │
│                                             │
│         Powered by Aszurex               │
│         Trust Beyond Limits              │
└─────────────────────────────────────────────┘
```

### Setup Wizard Rules
- All steps must be completable without internet
- Business Name is the only mandatory field
- Sensible defaults must be pre-selected (India, INR, GST, DD/MM/YYYY)
- Back navigation must preserve all entered data
- Pressing Escape during setup must ask for confirmation before closing
- Setup wizard state must survive app restart (resume from last completed step)

Powered by Aszurex.

Trust Beyond Limits.
