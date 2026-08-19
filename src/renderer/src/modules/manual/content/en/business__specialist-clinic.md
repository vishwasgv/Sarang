# Specialist Clinic

This business type's screens are in English only, regardless of your language setting elsewhere in Sarang.

## The shared service foundation

Every service-based business type in Sarang — including Specialist Clinic — starts from the same four building blocks: **Appointments** (booking and scheduling visits), a **Service Catalog** (the list of consultations and procedures your practice offers), **Provider Schedules** (which specialist is available when), and an automatic **Notification Queue** that handles reminders without you having to send them by hand. The rest of this chapter covers what's specific to a specialist practice.

Sarang deliberately does not have a separate business type per medical specialty (ENT, eye, dermatology, cardiology, and so on). Instead, "Specialist Clinic" is built to cover **any specialty** through the same generic Service Catalog — you define your own consultation and procedure types with your own pricing, and the clinical note below adapts to carry specialist-specific fields regardless of what your specialty is.

## Consultation Notes with Referral Details

Opening an appointment's **Consultation Note** gives you the same structured SOAP note used across Sarang's clinical business types (Patient Information, Subjective, Vitals with auto-flagging, Objective, Assessment, Plan, Follow-up) — see the *GP Clinic* chapter for the full field-by-field walkthrough — plus a **Referral Details** section unique to Specialist Clinic:

- **Referred By** and **Referral Date** — records who sent this patient to you (an outside doctor or another clinic) and when.
- **Referral Reason** — free text.
- **Referring Doctor's Phone** and **Referring Doctor's Email** — optional contact details for the referring doctor themselves. These are what let you actually close the loop: once the note is finalized, a **Share** button appears next to Print Summary that sends the referring doctor a visit summary via WhatsApp or Email (as a PDF), so they know the outcome for the patient they sent you. The button only appears once there's a referring doctor recorded on the note and the note is finalized — a draft note isn't a real outcome to send yet. If you leave the phone or email blank, the corresponding share option simply stays disabled rather than failing.

This is separate from **Refer to Another Provider**, a real in-app action lower on the same screen: once the note is saved, you can book an actual outbound appointment with another provider at your own clinic (pick the provider, date, time, and an optional reason) — this is a genuine booked appointment, not just a note. Each referral you send shows its own status (Scheduled / Completed / Cancelled / No-show) right there on the visit note, with a **Print Referral Letter** button producing a formal letter addressed to the referred-to provider.

A separate **"This is a second-opinion consultation"** checkbox in the same section flags a visit where the patient was already diagnosed or treated elsewhere and came to you specifically for another view — distinct from a referral, since a second-opinion visit doesn't require anyone to have sent them and a referred patient isn't necessarily seeking a second opinion. A checked note shows a **Second Opinion** badge next to the note's title, and feeds the Second-Opinion Conversion report below.

A **Case Complexity** dropdown right after the Assessment section lets you tag a visit **Routine** or **Complex** — leave it unset if you'd rather not classify a particular visit; unset notes are simply excluded from the Case-Complexity Mix report below rather than being counted as Routine by default.

The note also carries the same itemized **Prescription** table and **Vitals Trend** chart described in the *GP Clinic* chapter — both work identically here.

## Token Queue

Specialist Clinic also includes the **Token Queue** screen for same-day walk-ins, exactly as described in the *GP Clinic* chapter — issue walk-in tokens, call the next patient, and track Waiting / Called / Seen / Skipped counts. Walk-in queues are just as common at specialist outpatient practices (ENT camps, eye camps, dermatology clinics) as at general practices.

One addition here that's Specialist Clinic-only: the **Add Walk-in** form has a **"Mark as urgent (referring doctor flagged this as urgent)"** checkbox. A token marked urgent shows a red **Urgent** badge in the queue and is called ahead of patients who checked in earlier — **Call Next** always picks the highest-priority waiting token, urgent patients first, then by check-in order. Use this for a walk-in whose referring doctor flagged the case as needing to be seen sooner, not as a general priority tool — most walk-ins should go through in ordinary check-in order.

## Printing

**Print Summary** produces a formatted visit summary including the referral section when filled in, with the same clinical disclaimer used across Sarang's medical documents: it's a convenience document generated by Sarang, not a validated medical record — always verify before clinical use.

## Reports

Open **Reports → Referral Leaderboard** to see which referring doctors are sending you the most patients over a date range — a ranked list with counts, plus a bar chart of the top ten. This is the same real "Referred By" field captured on the Consultation Note, finally aggregated instead of sitting unused per-note.

Open **Reports → Second-Opinion Conversion** to see, of the visits you flagged as a second opinion in a date range, how many of those patients came back for a later completed appointment and became an ongoing patient — a total count, a converted count, and a conversion rate, plus a row per patient with their visit date and (if they returned) their next visit date. Only patients linked to a real customer record can be tracked this way; a walk-in with no customer record on file isn't counted either way.

Open **Reports → Case-Complexity Mix** to see the split between Routine and Complex cases over a date range — a stacked bar chart month by month, plus the total cases tagged, the Routine and Complex counts, and the overall Complex percentage. Only visits where you set the Case Complexity dropdown are counted; an untagged visit isn't assumed Routine, it's simply left out of the mix.

If you use **Refer to Another Provider** to send a patient on within your own clinic, once that provider finalizes their own note on the referral appointment, its outcome appears back on your original note automatically — no separate lookup needed to find out what happened to a patient you referred out.
