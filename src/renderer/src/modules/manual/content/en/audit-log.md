# Audit Log

The **Audit Log** (sidebar) is a permanent record of significant actions taken in Sarang — who did what, and when. It exists so you can always answer "who changed this?" or "who logged in and when?", and to help spot anything unusual.

## What gets logged

Sarang records an audit entry for actions across the entire app, including (among many others): user logins, logouts, and failed login attempts; password changes; invoice creation and cancellation; payments recorded and reversed; stock added or adjusted; backups created, restored, or deleted; and changes to business settings. Each entry shows the date and time, the action (e.g. "INVOICE CREATED", "PAYMENT REVERSED"), the entity it affected (e.g. which Invoice or Product), and which user performed it — or "System" if it wasn't tied to a specific logged-in user.

## Viewing and filtering the log

The Audit Log screen lists entries newest-first, 50 per page, with **Previous/Next** page controls. Use the entity-type dropdown at the top to filter down to a specific kind of record (User, Invoice, Payment, Inventory, Product, Customer, Backup, and many more business-specific entity types). Click **View** on any row that has details recorded to expand it and see the old and new values involved in that action (shown as readable data, not raw code).

Very old entries are automatically cleared out after a configurable retention period (2 years by default) so the log doesn't grow forever — this only removes genuinely old history, not anything recent.

## Verifying your audit history hasn't been tampered with

Click **Verify Integrity** at the top of the Audit Log screen. Sarang can verify your entire audit history hasn't been tampered with — every entry is secretly linked to the one before it when it's created, so if someone were ever able to go in and quietly edit or delete a past entry (for example, to hide that a cancelled invoice actually happened, or to erase a suspicious stock adjustment), that link would break and Sarang would detect it.

Running the check tells you either:
- **The chain is intact** — showing how many entries were verified, confirming nothing in your recorded history has been altered.
- **The chain is broken** — pointing to roughly where the break was found, so you know something in your audit trail doesn't match what it should.

This check is run on demand (it isn't automatic on every app launch, since checking a large history is real work) — run it any time you want reassurance that your records are trustworthy, for example before relying on the audit log to resolve a dispute.
