# Dental Clinic

This business type's screens are in English only, regardless of your language setting elsewhere in Sarang.

## The shared service foundation

Every service-based business type in Sarang — including Dental Clinic — starts from the same four building blocks: **Appointments** (booking and scheduling visits), a **Service Catalog** (the list of dental procedures and their prices), **Provider Schedules** (which dentist is available when), and an automatic **Notification Queue** that handles reminders without you having to send them by hand. The rest of this chapter covers Sarang's two dental-specific tools: the tooth chart and the recall schedule.

## Tooth Chart

Each dental patient has a **Tooth Chart** tab showing a full FDI-notation dental chart — both the permanent (adult) arch and the deciduous (primary/baby teeth) arch, upper and lower. Click any tooth to record or update its condition:

- Conditions: Sound, Caries, Filled, Missing, Crown, Bridge (abutment), Implant, Root Canal, Extraction Site, Fracture — each shown with its own color on the chart.
- For any condition other than Sound or Missing, mark which **surfaces** are affected (Buccal, Lingual, Mesial, Distal, Occlusal).
- Add free-text clinical notes per tooth.

A legend above the chart shows what each color means, and you can **Print Chart** at any time for a tabular printout of every tooth with a recorded (non-Sound) condition — useful for referrals or patient records.

Click **History** on any tooth to see its full chronological timeline — not just its condition changes, but also every treatment-plan procedure that ever named this tooth, merged into one timeline and sorted newest first. A condition entry shows the condition and any notes; a treatment entry shows the procedure and which plan it came from, tagged **Treatment Planned** or **Treatment Done** depending on that procedure's own status. Re-saving a tooth (say, from Caries to Filled after treatment) never erases the earlier entry; both stay in the timeline so you have a genuine record of that tooth's whole story — what was found, what was proposed for it, and what was actually done.

## Treatment Plans

The same patient screen's **Treatment Plans** tab lets you build itemized treatment plans: a title, a status (Proposed / Accepted / In Progress / Completed / Declined), and a list of procedures, each optionally tied to a specific tooth number, with its own estimated cost and a Pending/Done flag. The plan's total estimated cost is calculated automatically from its line items. Once a plan exists, attach supporting files to it — an X-ray, a scanned consent form — directly from its edit view.

Once a plan has moved past Proposed (Accepted, In Progress, or Completed) and hasn't been billed yet, a **Generate Invoice** action appears on it — one click turns the plan's priced procedures into a real invoice for that patient, one line per procedure (tooth-tagged where set), and the plan then shows a **Billed** badge. A plan can only be billed once; a plan still sitting at Proposed can't be billed at all, since that would silently treat a quote as if the patient had already agreed to it.

## Recall Schedule

The **Recall** tab (and the standalone **Recall Schedule** screen, listing every patient's recall across the whole clinic) is Sarang's dental-recall reminder system — the everyday "come back for your 6-month cleaning" workflow. For each patient you set:

- **Recall Type** — 6-Month Hygiene, 12-Month Hygiene, Crown Review, or Custom.
- **Last Visit Date** and **Next Recall Date**.
- Optional notes.

The Recall Schedule screen bands every patient into **Overdue**, **Due Soon** (within 7 days), **This Month** (within 30 days), or **Upcoming**, with counts and color-coded badges for each band, so you always know who to call next. A "Reminded" badge shows once a reminder has been sent for that patient's recall.

Every time you update a patient's recall who already had one on file, Sarang quietly records whether that closed-out recall period was met on time — the new Last Visit Date compared against the recall date that was due before you updated it. You never see this directly; it feeds the Recall Compliance report below.

## Reports

Open **Reports → Treatment Acceptance Rate** to see how many of the treatment plans you proposed in a date range actually turned into billed revenue — a three-stage funnel (Proposed → Accepted → Billed) as a bar chart, plus the acceptance rate (accepted ÷ proposed) and the billed rate (billed ÷ proposed) as percentages. This is the same real plan data from the Treatment Plans tab, aggregated instead of read one patient at a time — a quick read on whether your case presentations are converting, and whether accepted plans are actually being followed through to payment.

Open **Reports → Recall Compliance** to see, of the recall periods closed in a date range, what percentage of patients actually came back on or before their due date — a single gauge for the overall percentage, plus a breakdown by Recall Type (6-Month Hygiene, 12-Month Hygiene, Crown Review, Custom). Only recall periods that were genuinely closed out (a patient with an existing recall getting a new one set) count toward this — a patient's very first recall has no prior due date to have been on time or late against, so it isn't counted either way.
