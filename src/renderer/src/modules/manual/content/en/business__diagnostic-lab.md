# Diagnostic & Pathology Lab

## What's different about this business type

A Diagnostic & Pathology Lab runs on the same appointment/service-catalog foundation every service business in Sarang shares, plus one bundle of lab-specific screens: **Lab Test Orders**. A test/panel catalog reuses the standard Service Catalog rather than a separate parallel list — a blood test or an X-ray is just a service you sell, priced and taxed the same way any other service is. What's genuinely different is the order lifecycle underneath it: a lab order moves through sample collection, result entry per test, and a locked, finalized report, before it's ever billed or handed to the patient.

## Creating a lab order

Open **Lab Test Orders** in the sidebar. A new order needs a patient name (the linked customer record is optional — walk-in patients are fine) and at least one test or panel selected from your Service Catalog. You can optionally record the patient's age and link the order to an existing appointment. Each order gets a sequential order number (e.g. `LAB-202607-0001`, reset by calendar month).

## Referrals from a clinic

If a doctor elsewhere referred this patient to your lab, record who referred them (`referredByProviderId`) along with any referring notes. This is a real, everyday workflow for a standalone lab that takes referrals from GP clinics, specialist clinics, and hospitals it isn't part of.

## Sample collection

Once a sample is drawn (blood, urine, stool, swab, imaging, or another type), mark the order **Sample Collected**. This records who collected it and when, and moves every pending test item on the order to Collected status. Tests can only be added to or removed from an order before this step — once a sample is collected, the order of tests is locked in.

## Result entry

For each test on the order, enter its result: a set of named parameters (value, unit, reference range, and a flag of Low / Normal / High / Abnormal — or **Critical**, when a value falls into the panic-value range set up for that test). Entering the first result on an order automatically moves it from Sample Collected to In Process, so front-desk staff can see at a glance that work has actually started without waiting for every test to finish.

A **Critical** result puts a red badge on the order (and on the specific item) immediately, and the order can't be considered handled until you use **Record Doctor Notified** to log that you actually called the referring doctor, with a note — this is a genuine record that the escalation happened, not just that the number was flagged.

## Finalizing the report

Once every test on the order has a result entered, **Finalize Report** locks the whole order — its status becomes Reported and every item is marked Reported. A finalized report's results can no longer be edited; if a correction is genuinely needed, that has to happen before finalization. After the report is finalized, mark it **Delivered** once the patient or referring clinic has actually received it. Attach real scan/image files to an order from its detail view.

## Billing

Generate an invoice directly from a lab order once every test has a price greater than zero and the order is linked to a customer record. Each test appears as its own line item on the invoice, using the same tax rate (SAC code, if set) as its entry in the Service Catalog.

## Reports

The **Reports** screen includes a Lab Turnaround report specific to this vertical, showing orders by stage (ordered, sample collected, in process, reported) and the turnaround time from order to report for each one — useful for spotting where samples are piling up.

## Language

Diagnostic & Pathology Lab is one of Sarang's service-business templates, and — unlike Tailor/Boutique, the one named exception — it keeps the standard rule for that group: the interface is locked to **English only**, regardless of which language you've set elsewhere in Sarang.
