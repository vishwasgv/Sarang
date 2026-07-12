# ANALYTICS_AND_DASHBOARD_SPEC.md

## SARANG BUSINESS OS LITE

### Powered by Aszurex

### Trust Beyond Limits

Version: 1.0

Document Type: Analytics & Dashboard Specification

## PURPOSE

This document defines:

- Dashboard Architecture
- KPI Definitions
- Analytics Rules
- Widget Specifications
- Chart Specifications
- Industry Dashboards
- Reporting Logic
- Data Calculation Standards

The objective is to provide business owners with clear, actionable insights while ensuring all numbers remain accurate, auditable, and derived from source data.

## CORE PHILOSOPHY

The dashboard exists to answer:

What happened?

What is happening?

What requires attention?

What should I do next?

## ANALYTICS PRINCIPLES

Analytics must be:

Accurate

Transparent

Fast

Actionable

Local

Auditable

## ANALYTICS RESTRICTIONS

Analytics must never:

Use external services

Transmit business data

Depend on cloud processing

Use hidden calculations

Use unverifiable formulas

## DATA SOURCES

Analytics must derive data only from:

Invoices

Invoice Items

Payments

Expenses

Inventory

Customers

Suppliers

Purchase Orders

Audit Logs

## DASHBOARD OBJECTIVES

Within 10 seconds users should know:

Revenue

Expenses

Outstanding Amount

Inventory Status

Business Health

Recent Activity

Important Alerts

## DEFAULT DASHBOARD LAYOUT

Top Section

KPI Cards

Middle Section

Charts

Graphs

Trends

Bottom Section

Tables

Activities

Alerts

Quick Actions

## KPI CARDS

Most important dashboard elements.

## KPI 1

TODAY'S SALES

Definition:

Total invoiced sales today.

Formula:

Sum(Invoice Total)

Where:

Status = Active

Date = Today

## KPI 2

THIS WEEK SALES

Definition:

Revenue generated during current week.

## KPI 3

THIS MONTH SALES

Definition:

Revenue generated during current month.

## KPI 4

TOTAL OUTSTANDING

Definition:

Amount yet to be collected.

Formula:

Sum(Customer Outstanding)

## KPI 5

INVENTORY VALUE

Definition:

Estimated inventory worth.

Formula:

Quantity × Cost Price

## KPI 6

TOTAL EXPENSES

Definition:

Expenses within selected period.

## KPI 7

ESTIMATED PROFIT

Definition:

Revenue - Expenses

Version 1 Simplified.

## KPI 8

LOW STOCK ITEMS

Definition:

Products below reorder level.

## KPI 9

CUSTOMER COUNT

Definition:

Total active customers.

## KPI 10

SUPPLIER COUNT

Definition:

Total active suppliers.

## KPI CARD DESIGN

Display:

Title

Value

Trend

Percentage Change

Icon

Color Indicator

## TREND CALCULATIONS

Compare:

Current Period

vs

Previous Equivalent Period

Examples:

Today vs Yesterday

This Week vs Last Week

This Month vs Last Month

## REVENUE CHART

Chart Type:

Line Chart

Displays:

Revenue Trends

Time Ranges:

7 Days

30 Days

90 Days

12 Months

## EXPENSE CHART

Chart Type:

Area Chart

Displays:

Expense Trends

Expense Categories

## SALES VS EXPENSES

Chart Type:

Dual Line Chart

Displays:

Revenue

Expenses

Profit Estimate

## TOP PRODUCTS CHART

Chart Type:

Horizontal Bar Chart

Displays:

Top Selling Products

Top Revenue Products

Top Quantity Products

## CATEGORY PERFORMANCE CHART

Displays:

Revenue by Category

Sales by Category

Inventory by Category

## INVENTORY HEALTH CHART

Displays:

In Stock

Low Stock

Out Of Stock

Overstocked

## OUTSTANDING ANALYTICS

Displays:

Customer Outstanding

Supplier Outstanding

Aging Analysis

## CUSTOMER ANALYTICS

Metrics:

Total Customers

New Customers

Repeat Customers

Top Customers

Outstanding Customers

## SUPPLIER ANALYTICS

Metrics:

Supplier Spend

Outstanding Amount

Purchase Trends

Top Suppliers

## PURCHASE ANALYTICS

Metrics:

Purchase Volume

Purchase Cost

Purchase Trends

Supplier Analysis

## RECENT ACTIVITY FEED

Display:

Invoices Created

Payments Recorded

Inventory Adjustments

Expenses Added

Backup Created

Users Logged In

## ALERT SYSTEM

Dashboard Alerts:

Low Stock

No Recent Backup

Large Outstanding Amount

Failed Imports

Failed Backups

Pending Actions

## QUICK ACTIONS PANEL

Create Invoice

Add Product

Record Payment

Update Stock

Add Expense

Generate Report

Create Backup

## FILTER SYSTEM

Global Filters:

Today

This Week

This Month

This Quarter

This Year

Custom Range

## INDUSTRY DASHBOARDS

## RESTAURANT DASHBOARD

Additional KPIs:

Orders Today

Average Order Value

Top Menu Items

Peak Hours

Table Utilization

KOT Status

Charts:

Sales By Hour

Top Dishes

Order Trends

## RETAIL DASHBOARD

Additional KPIs:

Items Sold

Returns

Inventory Turnover

Top Categories

Charts:

Sales Trends

Category Trends

Inventory Trends

## HARDWARE DASHBOARD

Additional KPIs:

Outstanding Customers

Inventory Value

Purchase Trends

Credit Sales

Charts:

Outstanding Analysis

Material Sales

Purchase Trends

## DISTRIBUTOR DASHBOARD

Additional KPIs:

Bulk Orders

Outstanding Amount

Top Customers

Purchase Volume

Charts:

Customer Analysis

Inventory Analysis

Revenue Trends

## ANALYTICS DEFINITIONS

All KPI calculations must be documented.

No hidden formulas.

No hidden assumptions.

## KPI DOCUMENTATION REQUIREMENT

Every KPI must define:

Purpose

Formula

Data Source

Update Frequency

Industry Relevance

## REAL-TIME UPDATE STRATEGY

Version 1:

Near Real-Time

Update after:

Invoice Creation

Payment Recording

Inventory Changes

Expense Creation

## DASHBOARD PERFORMANCE TARGETS

Dashboard Load:

< 2 Seconds

Chart Rendering:

< 1 Second

KPI Refresh:

< 500ms

## EMPTY STATE DESIGN

When no data exists:

Display:

Helpful Message

Setup Guidance

Suggested Actions

Never display:

Blank Dashboard

## EXPORTABLE ANALYTICS

Users can export:

Sales Analytics

Inventory Analytics

Expense Analytics

Customer Analytics

Supplier Analytics

Formats:

PDF

Excel

CSV

## MOBILE FUTURE READINESS

Widgets should be:

Responsive

Modular

Collapsible

Reusable

## SECURITY REQUIREMENTS

Analytics must respect:

Role Permissions

User Permissions

Data Visibility Rules

Examples:

Cashier

May not view profit.

Staff

May not view expenses.

## AUDITABILITY REQUIREMENTS

Every KPI should be traceable back to source data.

A user should always be able to verify:

Why a number exists.

How a number was calculated.

## FUTURE ANALYTICS MODULES

Phase 2\+

Inventory Intelligence

Demand Forecasting

Purchase Planning

Profit Analysis

Customer Insights

Business Health Score

Important:

All calculations remain local.

No cloud AI.

No external analytics services.

## TRUST & TRANSPARENCY STATEMENT

Analytics are generated locally using business records stored on your device.

By default, Sarang does not collect, transmit, or store your business data on Aszurex systems.

Your business data remains on your device.

## SUCCESS CRITERIA

A business owner should be able to open Sarang and immediately understand:

Revenue

Expenses

Inventory

Outstanding Amounts

Business Performance

without generating a single report.

## FINAL DASHBOARD OBJECTIVE

The dashboard should feel like a business command center.

Not a billing screen.

Not an accounting screen.

A true Business Operating System.

Every user should think:

"This software understands my business."

## RECHARTS COMPONENT SPECIFICATIONS

All charts use Recharts. Each chart type maps to a specific Recharts component:

### Revenue Trend Chart
```tsx
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

<ResponsiveContainer width="100%" height={220}>
  <AreaChart data={revenueData}>
    <defs>
      <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stopColor="#00AEEF" stopOpacity={0.15}/>
        <stop offset="95%" stopColor="#00AEEF" stopOpacity={0}/>
      </linearGradient>
    </defs>
    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94A3B8' }} />
    <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} />
    <Tooltip formatter={(v) => `${currencySymbol}${v.toLocaleString()}`} />
    <Area type="monotone" dataKey="revenue" stroke="#00AEEF" strokeWidth={2} fill="url(#revenueGradient)" />
  </AreaChart>
</ResponsiveContainer>
```

### Sales by Category (Bar Chart)
```tsx
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

<ResponsiveContainer width="100%" height={220}>
  <BarChart data={categoryData}>
    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
    <XAxis dataKey="category" tick={{ fontSize: 11 }} />
    <YAxis tick={{ fontSize: 11 }} />
    <Tooltip />
    <Bar dataKey="sales" fill="#00AEEF" radius={[4, 4, 0, 0]} />
  </BarChart>
</ResponsiveContainer>
```

### Payment Methods (Pie/Donut Chart)
```tsx
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const PAYMENT_COLORS = ['#00AEEF', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444'];

<ResponsiveContainer width="100%" height={220}>
  <PieChart>
    <Pie data={paymentData} cx="50%" cy="50%" innerRadius={60} outerRadius={90}
      dataKey="amount" nameKey="method" label={false}>
      {paymentData.map((_, i) => <Cell key={i} fill={PAYMENT_COLORS[i % PAYMENT_COLORS.length]} />)}
    </Pie>
    <Tooltip formatter={(v) => `${currencySymbol}${v.toLocaleString()}`} />
    <Legend />
  </PieChart>
</ResponsiveContainer>
```

### Expense vs Revenue Comparison (ComposedChart)
```tsx
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

<ResponsiveContainer width="100%" height={220}>
  <ComposedChart data={monthlyData}>
    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
    <YAxis tick={{ fontSize: 11 }} />
    <Tooltip />
    <Legend />
    <Bar dataKey="revenue" fill="#00AEEF" radius={[4, 4, 0, 0]} />
    <Bar dataKey="expenses" fill="#EF4444" radius={[4, 4, 0, 0]} />
    <Line type="monotone" dataKey="profit" stroke="#10B981" strokeWidth={2} dot={false} />
  </ComposedChart>
</ResponsiveContainer>
```

## RECHARTS RULES

Tooltip must always format currency with locale-aware formatting.

`ResponsiveContainer` width must always be 100% — never hardcode pixel widths.

All charts must use the `stroke="#F1F5F9"` grid color for consistency.

Charts must not render when data array is empty — show empty state instead.

`animate={false}` on first render if performance issues detected.

## DASHBOARD UPDATE STRATEGY

Dashboard KPIs are event-driven — updated after each of:
- Invoice created or cancelled
- Payment recorded or reversed
- Inventory stock adjusted
- Expense created or deleted

No polling. No timers. Pure event-driven state updates via Zustand store.

Powered by Aszurex.

Trust Beyond Limits.
