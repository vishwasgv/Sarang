# UI_COMPONENT_LIBRARY.md

## SARANG BUSINESS OS LITE

### Powered by Aszurex

### Trust Beyond Limits

Version: 1.0

Document Type: UI Component Library & Design System Specification

## PURPOSE

This document defines:

- Design Tokens
- Component Standards
- Layout Standards
- Typography Standards
- Interaction Standards
- Accessibility Standards
- Animation Standards

The objective is to ensure:

Consistency

Professionalism

Maintainability

Scalability

Excellent User Experience

## DESIGN PHILOSOPHY

Inspired By:

Linear

Stripe Dashboard

Notion

Raycast

Arc Browser

Modern Enterprise Applications

The UI should feel:

Premium

Fast

Professional

Minimal

Readable

Trustworthy

## CORE PRINCIPLES

Every screen should be:

Simple

Predictable

Clean

Functional

Fast

Avoid:

Visual Noise

Clutter

Unnecessary Decorations

Complex Workflows

Heavy Animations

## DESIGN TOKENS

## BORDER RADIUS

Small:

6px

Medium:

10px

Large:

14px

Extra Large:

18px

## SPACING SYSTEM

Base Unit:

4px

Spacing Scale

4

8

12

16

20

24

32

40

48

64

80

96

Never use arbitrary spacing.

## SHADOW SYSTEM

Level 1

Subtle Card Shadow

Level 2

Floating Elements

Level 3

Modal/Dialog

Avoid excessive shadows.

## TYPOGRAPHY

Primary Font:

Inter

Fallback:

System UI

Future:

Noto Sans

## FONT SCALE

Display

36px

H1

30px

H2

24px

H3

20px

H4

18px

Body

14px–16px

Caption

12px

## TYPOGRAPHY RULES

Avoid:

Tiny Text

Excessive Bold

Decorative Fonts

Prioritize:

Readability

Accessibility

Consistency

## COLOR SYSTEM

Primary:

Aszurex Blue

\#00AEEF

Success

Green

Warning

Amber

Danger

Red

Neutral

Gray Scale

## COLOR RULES

Colors communicate state.

Not decoration.

## ACCESSIBILITY

Minimum Contrast:

WCAG AA

Support:

Keyboard Navigation

Focus States

Screen Readers

High Contrast

## ICON SYSTEM

Library:

Lucide Icons

Rules:

Consistent Style

Simple

Recognizable

Avoid:

Mixed Icon Sets

## APPLICATION LAYOUT

Structure

Sidebar

Top Bar

Content Area

Context Actions

## SIDEBAR

Permanent Desktop Sidebar

Contains:

Dashboard

Billing

Inventory

Customers

Suppliers

Reports

Analytics

Settings

Width:

280px

Collapsed:

72px

## TOP BAR

Contains:

Page Title

Global Search

Notifications

User Menu

Quick Actions

Height:

64px

## DASHBOARD CARD

Purpose:

Display KPIs

Contents:

Title

Value

Trend

Icon

Example:

Today's Sales

₹12,500

\+12%

Rules:

Single KPI Per Card

## BUTTON COMPONENTS

## PRIMARY BUTTON

Purpose:

Primary Actions

Examples:

Create Invoice

Save

Submit

Style:

Filled

Primary Color

## SECONDARY BUTTON

Purpose:

Supporting Actions

Style:

Outlined

## TERTIARY BUTTON

Purpose:

Low Priority Actions

Style:

Text Button

## DANGER BUTTON

Purpose:

Destructive Actions

Examples:

Delete

Restore

Reset

Requires Confirmation

## FORM COMPONENTS

## TEXT INPUT

Used For:

Names

Emails

Search

Notes

Rules:

Clear Labels

Helper Text

Validation Messages

## NUMBER INPUT

Used For:

Quantity

Price

Amount

Tax

Must Support:

Localization

Currency Formats

## SELECT DROPDOWN

Used For:

Country

Currency

Tax

Category

Searchable when needed.

## DATE PICKER

Must Support:

Regional Formats

Localization Rules

## TEXTAREA

Used For:

Descriptions

Remarks

Notes

## TABLE COMPONENT

Mission Critical.

Most business workflows use tables.

Features:

Sorting

Filtering

Pagination

Column Resize

Column Visibility

Export

Must Handle:

10

100

1,000\+

Records

## SEARCH COMPONENT

Global Search

Search:

Products

Customers

Suppliers

Invoices

Reports

Keyboard Shortcut:

Ctrl \+ K

Inspired By:

Raycast

Linear

## FILTER COMPONENT

Standard Layout:

Filter Button

Applied Filter Chips

Reset Filters

## MODAL COMPONENT

Use For:

Confirmation

Editing

Critical Actions

Avoid:

Nested Modals

## CONFIRMATION DIALOG

Required For:

Delete

Restore

Inventory Adjustment

Reset Settings

## TOAST NOTIFICATIONS

Types:

Success

Info

Warning

Error

Duration:

3–5 Seconds

## EMPTY STATES

Never show blank screens.

Provide:

Explanation

Illustration

Next Action

Example:

"No invoices found."

Create your first invoice.

## LOADING STATES

Use:

Skeleton Loaders

Avoid:

Spinners Everywhere

## KPI CARDS

Follow:

ANALYTICS\_AND\_DASHBOARD\_SPEC.md

Standard Components:

Revenue

Expenses

Inventory

Outstanding

Profit

## CHART COMPONENTS

Library:

Recharts

Allowed:

Line Chart

Bar Chart

Area Chart

Pie Chart

Donut Chart

Avoid:

3D Charts

Complex Visualizations

## INVOICE SCREEN

Layout

Customer

Products

Summary

Payments

Should be optimized for:

Fast Billing

Minimal Clicks

## INVENTORY SCREEN

Layout

Search

Filters

Table

Quick Actions

## CUSTOMER SCREEN

Layout

Customer List

Profile

Ledger

Invoices

## SETTINGS SCREEN

Grouped Sections

Business

Users

Taxes

Currency

Backup

Reports

Printing

## PRINT PREVIEW

Required For:

Invoices

Receipts

Reports

## ANIMATION SYSTEM

Library:

Framer Motion

Animation Goals:

Guide Attention

Improve Feedback

Enhance Quality

Not:

Entertainment

## ALLOWED ANIMATIONS

Page Transition

Fade

Slide

Scale

Expand

Collapse

Duration:

150ms–300ms

## DISALLOWED ANIMATIONS

Parallax

Bounce

Flash

Continuous Motion

Distracting Effects

## MOBILE READINESS

Future Ready

Components Must:

Scale

Collapse

Stack

Adapt

## RESPONSIVENESS

Desktop First

Future:

Tablet

Android

## BRANDING LOCATIONS

Allowed:

Splash Screen

About Page

Footer

Help Center

Installer

Documentation

Avoid:

Intrusive Advertising

Popups

Workflow Interruptions

## TRUST & TRANSPARENCY

Display in About Section:

By default, Sarang does not collect, transmit, or store your business data on Aszurex systems.

Your business data remains on your device.

## COMPONENT NAMING STANDARD

Button

Input

Select

Modal

Table

Card

Chart

Sidebar

Header

Avoid ambiguous names.

## AI DEVELOPMENT RULE

When generating UI:

Reuse existing components.

Do not create duplicate components.

Follow design system.

Maintain consistency.

## SUCCESS CRITERIA

A business owner should feel comfortable using Sarang within minutes.

The interface should feel familiar, professional, and trustworthy.

## TAILWIND CLASS REFERENCE

### Button Classes

**Primary Button:**
```
bg-[#00AEEF] hover:bg-[#0097D1] active:bg-[#0080B3]
text-white font-medium text-sm
px-4 py-2 rounded-[6px]
transition-colors duration-150
focus:outline-none focus:ring-2 focus:ring-[#00AEEF] focus:ring-offset-2
disabled:opacity-50 disabled:cursor-not-allowed
```

**Secondary Button:**
```
border border-gray-200 hover:border-gray-300 hover:bg-gray-50
text-gray-700 font-medium text-sm
px-4 py-2 rounded-[6px]
transition-colors duration-150
focus:outline-none focus:ring-2 focus:ring-[#00AEEF] focus:ring-offset-2
disabled:opacity-50 disabled:cursor-not-allowed
```

**Danger Button:**
```
bg-red-600 hover:bg-red-700 active:bg-red-800
text-white font-medium text-sm
px-4 py-2 rounded-[6px]
transition-colors duration-150
focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2
```

### Input Classes

**Default State:**
```
w-full px-3 py-2 text-sm
border border-gray-200 rounded-[6px]
bg-white text-gray-900
placeholder:text-gray-400
transition-colors duration-150
focus:outline-none focus:ring-2 focus:ring-[#00AEEF] focus:ring-offset-0 focus:border-[#00AEEF]
```

**Error State:**
```
border-red-400 focus:ring-red-400 focus:border-red-400
```

**Disabled State:**
```
bg-gray-50 text-gray-400 cursor-not-allowed
```

### Card Classes

**Standard Card:**
```
bg-white border border-gray-100 rounded-[10px]
shadow-sm hover:shadow-md
p-4 transition-shadow duration-150
```

**KPI Card:**
```
bg-white border border-gray-100 rounded-[10px]
shadow-sm p-6
flex flex-col gap-2
```

**KPI Card Value:**
```
text-2xl font-semibold text-[#0F172A] tabular-nums
```

**KPI Card Trend (positive):**
```
text-xs font-medium text-green-600 flex items-center gap-1
```

**KPI Card Trend (negative):**
```
text-xs font-medium text-red-500 flex items-center gap-1
```

### Table Classes

**Table Container:**
```
w-full overflow-x-auto rounded-[10px] border border-gray-100
```

**Table Header:**
```
bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide
px-4 py-3 text-left
```

**Table Row:**
```
border-t border-gray-100 hover:bg-gray-50 transition-colors duration-100
```

**Table Cell:**
```
px-4 py-3 text-sm text-gray-900
```

### Badge / Status Classes

**Success (Paid):**
```
inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
bg-green-50 text-green-700 border border-green-200
```

**Warning (Pending):**
```
bg-amber-50 text-amber-700 border border-amber-200
```

**Danger (Overdue):**
```
bg-red-50 text-red-700 border border-red-200
```

**Neutral (Draft):**
```
bg-gray-100 text-gray-600 border border-gray-200
```

**Info (Active):**
```
bg-[#EBF8FF] text-[#0077A8] border border-[#B3E5FC]
```

### Sidebar Classes

**Sidebar Container:**
```
w-[280px] min-h-screen bg-[#0F172A] flex flex-col
transition-all duration-200 ease-in-out
```

**Collapsed Sidebar:**
```
w-[72px]
```

**Nav Item (default):**
```
flex items-center gap-3 px-4 py-2.5 rounded-[8px] mx-2
text-sm font-medium text-slate-400
hover:bg-white/5 hover:text-white
transition-colors duration-150
```

**Nav Item (active):**
```
bg-[#00AEEF]/15 text-[#00AEEF]
```

### Modal Classes

**Overlay:**
```
fixed inset-0 bg-black/40 backdrop-blur-sm z-50
flex items-center justify-center p-4
```

**Modal Panel:**
```
bg-white rounded-[14px] shadow-xl
w-full max-w-md
p-6 relative
animate-in fade-in zoom-in-95 duration-200
```

### Toast Notification Classes

**Success:**
```
bg-white border border-green-200 rounded-[10px] shadow-md
flex items-start gap-3 p-4 min-w-[320px]
```

**Error:**
```
border-red-200
```

**Warning:**
```
border-amber-200
```

## COMPONENT INTERACTION STATES

Every interactive component must define all 6 states:

| State | Trigger | Visual Change |
|-------|---------|---------------|
| Default | Rest | Base styling |
| Hover | Mouse over | Slight bg/border darken, cursor:pointer |
| Focus | Keyboard/click | Blue ring (`ring-2 ring-[#00AEEF]`) |
| Active | Mouse down | Pressed bg (slightly darker than hover) |
| Disabled | `disabled` prop | `opacity-50`, `cursor-not-allowed`, no hover |
| Error | Validation fail | Red border, red helper text |
| Loading | Async operation | Spinner or skeleton, disabled interaction |

## SPACING QUICK REFERENCE

```
4px  = p-1  m-1  gap-1
8px  = p-2  m-2  gap-2
12px = p-3  m-3  gap-3
16px = p-4  m-4  gap-4
20px = p-5  m-5  gap-5
24px = p-6  m-6  gap-6
32px = p-8  m-8  gap-8
40px = p-10 m-10 gap-10
48px = p-12 m-12 gap-12
64px = p-16 m-16 gap-16
```

Never use arbitrary values like `p-[13px]` unless absolutely required for pixel-perfect layout.

## ANIMATION DURATION GUIDE

```
Fast micro-interactions (button press, hover): duration-100 to duration-150
Standard transitions (sidebar, drawer open):   duration-200
Page transitions:                               duration-300
Long animations (modals, onboarding):          duration-500

Never exceed 500ms for any UI transition.
Use ease-in-out for most animations.
Use ease-out for things that appear (modal open, toast).
Use ease-in for things that disappear (modal close).
```

## FINAL PRINCIPLE

Good software works.

Great software feels reliable before the user clicks anything.

Every component should reinforce:

Trust

Clarity

Ownership

Professionalism

Powered by Aszurex.

Trust Beyond Limits.
