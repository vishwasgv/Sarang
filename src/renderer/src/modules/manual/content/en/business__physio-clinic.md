# Physiotherapy Clinic

This business type's screens are in English only, regardless of your language setting elsewhere in Sarang.

## The shared service foundation

Every service-based business type in Sarang — including Physiotherapy Clinic — starts from the same four building blocks: **Appointments** (booking and scheduling visits), a **Service Catalog** (the list of therapy sessions and their prices), **Provider Schedules** (which physiotherapist is available when), and an automatic **Notification Queue** that handles reminders without you having to send them by hand. The rest of this chapter covers what's specific to physiotherapy: consultation notes with pain scoring, treatment phases, home exercise programs, and session packs.

## Consultation Notes

Opening an appointment's **Consultation Note** gives you the same structured SOAP note used across Sarang's clinical business types (see the *GP Clinic* chapter for the base fields), plus two physio-specific additions:

- **Pain Score** — a 0 (none) to 10 (worst) scale, entered either as a number or by tapping a quick-pick button.
- **Treatment Given This Session** — free text describing what was actually done in the session (e.g. ultrasound therapy, TENS, manual therapy, taping).

## Treatment Phases

Each physio patient's profile has a **Treatment** tab tracking their rehabilitation journey through named phases: Initial Assessment, Acute Phase, Sub-Acute, Active Rehabilitation, Maintenance, and Discharge. Each phase records a title, start date, goals, and — once you close it — an outcome note. Only one phase is open ("active") at a time; closing one lets you start the next, building a clear timeline of how the patient progressed.

## Home Exercise Program (HEP)

The **Exercise Program** tab lets you build a printable Home Exercise Program for the patient: a numbered list of exercises, each with a name, description of how to perform it, and sets/reps/hold-time/frequency. **Print HEP** produces a formatted handout with the clinic's letterhead and a signature line, and records when it was last printed.

## Session Packs

The **Session Packs** tab tracks pre-paid bundles of sessions (e.g. "10-session Physio Pack"): pack name, total sessions, price, GST rate, purchase and expiry dates. An active pack shows a progress bar of sessions remaining, and each completed appointment against that pack deducts one session automatically. Once a pack has a price, you can **Generate Invoice** for it directly from this screen — it only offers this once, and marks the pack "Invoiced" afterward so it's never billed twice.
