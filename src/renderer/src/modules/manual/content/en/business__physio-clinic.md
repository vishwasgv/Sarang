# Physiotherapy Clinic

This business type's screens are in English only, regardless of your language setting elsewhere in Sarang.

## The shared service foundation

Every service-based business type in Sarang — including Physiotherapy Clinic — starts from the same four building blocks: **Appointments** (booking and scheduling visits), a **Service Catalog** (the list of therapy sessions and their prices), **Provider Schedules** (which physiotherapist is available when), and an automatic **Notification Queue** that handles reminders without you having to send them by hand. The rest of this chapter covers what's specific to physiotherapy: consultation notes with pain scoring, treatment phases, home exercise programs, and session packs.

## Consultation Notes

Opening an appointment's **Consultation Note** gives you the same structured SOAP note used across Sarang's clinical business types (see the *GP Clinic* chapter for the base fields), plus two physio-specific additions:

- **Pain Score** — a 0 (none) to 10 (worst) scale, entered either as a number or by tapping a quick-pick button.
- **Functional Score** — a 0-100 scale (higher = better function), tracking how well the patient can actually move and perform tasks, alongside pain.
- **Treatment Given This Session** — free text describing what was actually done in the session (e.g. ultrasound therapy, TENS, manual therapy, taping).

Once a patient has two or more sessions recorded, a **Vitals Trend** chart appears on their note — switch between the Pain Score and Functional Score chips to see either one plotted over time, so you and the patient can see real progress (or its absence) at a glance instead of flipping through past notes.

## Treatment Phases

Each physio patient's profile has a **Treatment** tab tracking their rehabilitation journey through named phases: Initial Assessment, Acute Phase, Sub-Acute, Active Rehabilitation, Maintenance, and Discharge. Each phase records a title, start date, goals, and — once you close it — an outcome note. Only one phase is open ("active") at a time; closing one lets you start the next, building a clear timeline of how the patient progressed.

## Home Exercise Program (HEP)

The **Exercise Program** tab lets you build a printable Home Exercise Program for the patient: a numbered list of exercises, each with a name, description of how to perform it, and sets/reps/hold-time/frequency. **Print HEP** produces a formatted handout with the clinic's letterhead and a signature line, and records when it was last printed.

## Session Packs

The **Session Packs** tab tracks pre-paid bundles of sessions (e.g. "10-session Physio Pack"): pack name, total sessions, price, GST rate, purchase and expiry dates. An active pack shows a progress bar of sessions remaining, and each completed appointment against that pack deducts one session automatically. Once a pack has a price, you can **Generate Invoice** for it directly from this screen — it only offers this once, and marks the pack "Invoiced" afterward so it's never billed twice.

The filter row at the top of the Session Packs list (**All / Active / Running Low / Expired**, each with a live count) is your alert view: a pack drops into **Running Low** once 2 or fewer sessions remain, and into **Expired** once its expiry date has passed — both are flagged with color on the pack's own card too, so you never have to open a pack to notice it needs attention.

To see how your session packs are being used across every patient, open **Reports → Pack Utilization** and pick a date range. It shows total packs sold, sessions used versus sessions purchased, and an overall utilization percentage, plus a bar chart and a full table breaking it down pack by pack — so you can spot packs sitting mostly unused (a sign to follow up with that patient) at a glance.

## Referrals

If a patient comes to you referred by an outside doctor, the Consultation Note's **Referral Details** section records who referred them, the date, and why — free-text fields, since the referring doctor is usually outside Sarang entirely. If instead you're routing a patient to another provider within your own clinic, use **Refer to Another Provider** on their note to book a real linked appointment, the same in-app referral mechanism used across Sarang's clinical business types.

Once that provider finalizes their own note on the referral appointment, its outcome appears back on your original note automatically. If that note is tracking Pain Score and Functional Score across sessions, the outcome shown isn't just their closing remark — it's a quantified before-and-after across the whole course of treatment since the referral (for example, "Pain 7→3, Function 40→75 across 3 sessions"), so you can see at a glance whether the referral actually helped, not just that it happened.

## Doctor Pad — a full clinical tablet, not just a notepad

Many physiotherapists would rather write a note by hand — a body diagram, a quick sketch of an exercise — than type it. **Doctor Pad** turns any tablet on your clinic's own Wi-Fi into a writing pad, patient-record lookup, and read-only billing view — no extra hardware to buy, and nothing leaves your clinic's own network.

**Connect a tablet, once.** Open **Provider Schedule**, pick the physiotherapist, and you'll see a **Doctor Pad** panel with three ways to connect a tablet — use whichever is easiest:

- **Scan the QR code** shown on screen.
- **Bookmark the link** shown underneath it — save it to the tablet's home screen and it opens straight to that physiotherapist's queue every time, no scanning needed again.
- **Type the 4-digit PIN** shown, on the page that opens when the tablet visits the address shown — handy when the tablet has no camera or you're in a hurry.

Whichever way you connect, the tablet remembers the physiotherapist from then on, so this is normally a one-time setup per tablet.

**Writing a note.** The tablet shows today's appointments for that physiotherapist. Tap a patient to open a full-screen writing surface — pen, eraser, line/rectangle/circle (handy for a quick body diagram), three stroke sizes, Undo/Redo, three preset colours plus a custom colour picker, up to 5 pages, all icon-only tools so the canvas gets nearly the whole screen. Tap **Save** and the note attaches instantly to that patient's appointment — every note, whether one page or five, saves as a genuine A4 PDF.

**Printing and sharing a note.** Open any attachment (in **Documents**, on the appointment, or from the tablet's own **Patients** tab below) and use **Print** to print it directly, or the **WhatsApp/Email** icons to share it straight to the patient's phone or email on file.

**Patients tab — search, chart, and a fresh session, all from the tablet.** Alongside the Queue tab, a **Patients** tab lets the physiotherapist search any patient by name or phone — not just today's list — and open their full chart:

- **Medical Information** — blood group, allergies, chronic conditions, current medications, emergency contact — editable right there.
- **Visit History** — every past session across every date, with a summary of the typed Consultation Note where one exists, and every hand-drawn note on file, openable directly.
- **Billing (read-only)** — the patient's outstanding balance and recent transactions, so the physiotherapist can see it without asking the front desk. Nothing on the tablet can create an invoice, record a payment, or change a credit limit — billing stays view-only here by design.
- **Start a Fresh Visit** — type a short reason (e.g. "Follow-up session") and tap **Start Visit & Write Prescription** to create a new visit for that patient right now and go straight into the writing canvas.

**The same chart is also on the desktop app** — open any patient from **Customers**, and the **Visit History** section there shows the identical record, with a **Book New Visit** button that opens the booking form with that patient already selected.

**Walk-ins get the same full record.** A walk-in issued a token in **Token Queue** doesn't automatically have a patient record yet — a plain token has no appointment behind it, so there's nothing for a note to attach to. Look for the small **person-plus icon** on that token's row and tap it: it opens the booking form pre-filled with the walk-in's name (matching them to an existing patient by phone if they've visited before), and once booked, the token is linked to that visit.

**If a PIN leaks, or you're retiring an old tablet**, open **Provider Schedule**, select the physiotherapist, and click **Change PIN** — the old PIN stops working immediately. A tablet that already connected via QR code or bookmarked link keeps working, since it never needs the PIN again.
