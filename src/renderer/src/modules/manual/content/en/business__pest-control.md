# Pest Control

## What's included

Pest Control is built on Sarang's shared service-business foundation — appointments, a service catalog, provider schedules, and the notification queue — plus a single dedicated module: **Pest Control**, covering both recurring service contracts and individual job sheets.

## Service Contracts

A contract records the client, property address and type (Residential, Commercial, Industrial), the pest types covered (Cockroaches, Rodents, Termites, Ants, Mosquitoes, Bedbugs, Other — pick as many as apply), the service frequency (Monthly, Quarterly, Half-Yearly, Yearly, One-Time), a contract value, start/end dates, and status (Active, Pending, Expired, Cancelled).

An active contract with a value can be invoiced for its recurring fee with **Generate Invoice** — this isn't a one-time action: Sarang tracks which period the contract was last invoiced for, so you can bill the same contract again each period it recurs, at whatever cadence matches its own frequency. Contract invoices use SAC 998534 at 18% GST.

## Job Sheets

A job sheet is a single visit — optionally linked to a contract, or created as a one-time/ad-hoc visit — recording the visit date/time, assigned technicians, pesticide used, areas serviced (a quick-pick list: Kitchen, Bathrooms, Bedroom, Store Room, Terrace, Garden, Basement, Office, Warehouse, Restaurant Kitchen, Common Areas), treatment type (Spray, Gel, Fumigation, Trap, Bait, Combined), job amount, and whether the client's signature was obtained. A job sheet moves through **Scheduled → In Progress → Completed** (with Cancelled as a separate outcome); once Completed, **Generate Invoice** bills that visit (same SAC 998534, 18% GST).

For a real, itemized record of what chemicals were actually used on a visit, add rows to **Pesticides Used** — name, quantity, unit, target pest, and an optional dosage note. Link a row to a real inventory product to have it deduct stock automatically when used, or leave it unlinked for a shop that doesn't track chemical stock in Sarang.

The KPI bar shows active contracts, pending job sheets, and job sheets scheduled this week.

## Language

Pest Control is one of Sarang's 24 dedicated service-business templates, and like nearly all of them its interface is **English only**, regardless of which language you've set elsewhere in Sarang.
