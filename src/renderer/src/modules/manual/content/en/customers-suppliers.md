# Customers & Suppliers

> **GP Clinic, Specialist Clinic, Dental Clinic, Vet Clinic, and Physio Clinic** call this same screen **Patients** (or **Owners** for Vet Clinic, since that record is the pet's owner, not the pet) — same underlying record, just relabelled for how a clinic actually talks about it. Those 5 business types also add a Medical Information card and a full Visit History with prescriptions — see that business type's own manual chapter for the clinic-specific detail.

## Adding customers and suppliers

Open **Customers** or **Suppliers** from the sidebar to see the full list. Click **Add Customer** / **Add Supplier** to create one. A customer record holds name, phone, email, address (city/state/country), tax number, credit limit, and notes; a supplier record holds the equivalent business-side details (name, phone, email, address, tax number, notes).

Sarang keeps one record per real customer and supplier:

- A **customer** cannot share a phone number with another active customer. GSTIN and email are checked too, and **Find duplicates** (on both the Customers and Suppliers screens) lists records that look like the same party so you can **merge** them; a merge moves every invoice, bill and payment to the record you keep and cannot be undone. Importing customers or suppliers from a file applies the same checks.
- A **supplier** cannot be saved if the **phone**, **GSTIN**, **email**, or **name in the same city** already belongs to another supplier (active or archived). If the match is archived, restore that supplier instead. Two real suppliers with the same name need different cities.
- Supplier **GSTIN** (15 characters, for example 29ABCDE1234F1Z5), **PAN** (10 characters) and **IFSC** (11 characters) are checked for format and saved in capital letters.

More on the customer form: **payment terms** in days (new invoices get their due date automatically), **Tax exempt** with an exemption certificate number and an expiry date (tax is charged again after it), and **Do not send this customer messages** (stops reminders to them). More on the supplier form: contact person, category, rating, payment terms, a credit limit that is shown as a reminder and does not block bills, and an opening balance that can be negative (an advance you paid). Both have an **Other addresses** card for ship-to, warehouse or branch addresses, and a **Statement** button that opens their account to print or send.

Either can be **archived** instead of deleted, which hides it from day-to-day lists (billing, purchase order creation, and so on) without losing its transaction history.

## Ledger and outstanding balance

Clicking into a customer or supplier opens their detail screen, which shows contact info alongside their running account:

- A **customer's** detail screen shows their credit limit and their **outstanding balance** — how much they currently owe you — plus a transaction ledger of every debit (a credit-sale invoice) and credit (a payment or credit note) affecting that balance, each with a running total.
- A **supplier's** detail screen shows the **balance payable** — how much you currently owe them — with the same kind of ledger (a purchase increases what you owe; a payment or debit note reduces it). If you owe a supplier money, a **Record Payment** button lets you log a payment against them directly (Cash, Bank Transfer, Cheque, UPI, Card, or Other), with an optional reference number and notes.

If interest on overdue balances is switched on (**Settings → Business Features**), a customer's page also shows the interest each overdue invoice has earned, and a button to charge it. Both ledgers show the last 100 entries. The balance shown is always computed from the full transaction history, not a cached running number, so it can't drift out of sync with what actually happened.

## The phone-search quick-add pattern

Wherever Sarang needs you to attach a customer to something — a new invoice, a quotation, an appointment, a hotel check-in, and so on — it uses the same **CustomerPicker** search box: start typing a name or phone number, and any existing match appears in a dropdown within moments. If the customer doesn't exist yet, **+ Add new customer** expands an inline form for just a name and phone, and selects the newly created customer immediately without leaving the screen you were on.

This is deliberate: searching by phone number before creating a new record is what prevents the same person from ending up as multiple duplicate Customer entries across different parts of the app. Always search first — if a customer was created from any other screen in Sarang, their phone number will find them again here.

## Supplier purchase history

A supplier's involvement in your purchasing shows up in a few connected places rather than one single screen: **Purchase Orders** filtered or searched by supplier name, the supplier's own ledger (which reflects every purchase order received and every payment made against them), and any **Debit Notes** raised against a purchase order with that supplier. Together these give you a full picture of what you've bought from a supplier and what you currently owe them.
