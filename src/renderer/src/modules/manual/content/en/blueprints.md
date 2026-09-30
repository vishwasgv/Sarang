# Blueprints: Document Stage Tracking

## What it is

**Blueprints** let you define a named pipeline of stages a document visibly moves through — for example **Draft → Approved → Sent to Supplier → Received** for a Purchase Order, or your own wording for a Sales Order. It's a simple, visual way to track *where a document actually is* in your own process, beyond just its system status (Draft, Confirmed, Invoiced, and so on).

Blueprints currently apply to two document types: **Purchase Orders** and **Sales Orders**. Each document type has its own independent set of stages — the pipeline you set up for Purchase Orders has no effect on Sales Orders, and vice versa.

Like Approval Workflows, Blueprints are **off by default** and entirely **opt-in**. If you never configure any stages for a document type, nothing changes anywhere — no widget appears, and the document works exactly as it always has.

## Setting up stages (Settings)

An owner or admin configures stages from **Settings**, under the Blueprints section. Choose the document type (Sales Order or Purchase Order), then add stages one at a time by typing a name and confirming — each new stage is added to the end of the pipeline.

A few real limits to know:

- **Up to 20 stages** per document type. If you're at the limit, retire a stage you no longer need before adding a new one.
- **No duplicate names** within the same document type (this is checked without regard to capitalisation — "Sent" and "sent" count as the same name).
- A stage name can be up to **80 characters**.
- Use the up/down controls next to each stage to **reorder** the pipeline at any time — this only changes the order stages are shown in, it doesn't affect any document already sitting at one of them.
- Removing a stage from the list **retires** it rather than permanently deleting it. This matters because a real document may already be sitting at that stage; retiring keeps that history intact while taking the stage out of use for anything new. A retired stage no longer appears in the pipeline or as an option to advance to.

Configuring stages (adding, reordering, retiring) requires the same permission as changing other business settings. Anyone who can only view Settings can see the configured stages but can't change them.

## Seeing and advancing a document's stage

Once a document type has at least one stage configured, every document of that type shows a stage tracker directly on its own detail screen — on **Purchase Order** detail screens and **Sales Order** detail screens, alongside that document's Approval panel (if one is configured). The tracker shows the full pipeline as a row of stages; the document's current stage is highlighted, and stages before it are marked as done.

A document that hasn't been moved yet automatically sits at the **first stage** — you don't need to go back and set a starting stage on your existing documents when you turn Blueprints on for a document type; they're simply treated as being at stage one until someone moves them.

To advance a document, click the stage you want to move it to directly — you are **not** required to move through stages in order one at a time; any configured stage can be selected directly. Clicking the stage a document is already at does nothing.

## This is not an approval gate

Blueprints are a status pipeline you define freely for your own tracking — they are **not** a sign-off or permission control. Moving a document from one stage to the next requires nothing more than the same permission that already lets someone create or edit that document type; there is no separate "who can advance a stage" setting, and no stage can block or require approval before a document moves on. If you need a document to require sign-off above a certain amount before it's confirmed, that's what **Approval Workflows** are for — Blueprints and Approval Workflows can be used together on the same document, but they do two different jobs: Approval Workflows control *whether* a document can be confirmed; Blueprints just show *where it is* afterwards, in a pipeline you designed.

## If a document type has no stages configured

If you haven't set up any stages for Purchase Orders or Sales Orders, the stage tracker simply doesn't appear on those documents' screens — there's nothing to turn off or hide separately. Configuring your first stage for a document type is what makes the tracker appear on every document of that type going forward.
