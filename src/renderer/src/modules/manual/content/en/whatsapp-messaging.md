# WhatsApp Messaging & Reminders

> New here? *Guide: Reminders and Alerts* explains the difference between the bell alerts (for you) and WhatsApp Reminders (for your customers), with the timing rules for appointment reminders.

Sarang can prepare WhatsApp messages for your customers — appointment reminders, payment-overdue notices, membership/contract renewals, and more, across every business type — and hand them to WhatsApp ready to send. Sarang never sends a message automatically: it always opens your own WhatsApp (Desktop or Web) with the message pre-filled, and you click **Send** yourself. This is the same "you're always in control" approach used by the Share via WhatsApp buttons on Invoices and other documents (see **Billing & Documents**).

There are three related places this shows up, covered below: the **WhatsApp Reminders** queue, the **Message Templates** editor, and sending an ad-hoc message from a **Customer's** own page.

## WhatsApp Reminders — sending what Sarang has already prepared

Open **WhatsApp Reminders** from the sidebar. As you use Sarang day to day — booking appointments, an invoice going overdue, a membership nearing expiry — the app automatically prepares reminder messages and adds them here with status **Pending**. Nothing is sent yet; this list is simply everything that's ready to go out.

For each pending reminder you can:
- Click **Send on WhatsApp** — opens WhatsApp with the message and the customer's phone number pre-filled. You review it and click Send inside WhatsApp.
- Click the checkmark to **Mark Sent** once you've actually sent it, so it moves out of your pending list.
- Click the X to **Dismiss** a reminder you don't want to send (e.g. you already called the customer instead).

Use the **Pending / Sent / All** filter at the top to review history. A reminder only appears here if the customer has a phone number on file — Sarang can't prepare a WhatsApp message without one.

## Message Templates — customizing what your reminders say

Every reminder message above comes from a template — one per situation (appointment reminder, payment overdue, membership expiry, and so on), covering every business vertical Sarang supports. By default these use sensible pre-written wording, but you can customize any of them.

Open **Settings → Message Templates**. Templates are grouped by business area (Gym, Legal, Veterinary, Logistics, and so on) — click a group to expand it. For each template you'll see:

- Its current wording, in an editable text box.
- The **placeholders** it supports underneath, shown as `{{customerName}}`, `{{date}}`, etc. — these get swapped for the customer's real details when a reminder is actually generated. Keep them exactly as shown (same spelling, same double-curly-brackets) if you edit the surrounding text; a placeholder you remove or mistype will show up literally in the sent message instead of the real value.
- A **Customized** badge once you've saved your own wording, and a **Reset to Default** button to go back to Sarang's own wording at any time.
- An **Internal note** badge on the one template (retainer invoice generation reminders) that's a to-do note for your own staff, not something ever sent to a customer.

Click **Preview** on any template to see what it would actually look like, filled in with realistic example details — a quick way to check your wording reads naturally before saving. If you type a placeholder that the message can never fill in, or brackets that do not pair up, a red note appears while you type and Sarang refuses to save it.

When you save (or reset) a template, reminders that are **already waiting** in WhatsApp Reminders are re-worded to match, and Sarang tells you how many it updated. A reminder you edited by hand, or one that no longer fits its template, is left as it is. At the top of the screen you can also untick **End messages with Powered by Sarang** to remove that closing line from every message.

### Reminder Message Language

At the top of the Message Templates screen, an **admin/manager** can set the **Reminder Message Language** — the language any template that hasn't been individually customized will use when a reminder is generated. This is separate from your own personal display language (the one you pick under Settings → Language): your own screen can be in English while your shop's WhatsApp reminders go out in Hindi, or any other supported language, because what matters is what your *customers* understand, not what any one staff member's own screen shows. Wording you save is kept **for the reminder language currently chosen**: with Hindi chosen you write and see the Hindi wording, and switching back to English shows your English wording. Wording saved while English is chosen also applies to any language where you have not written your own. Changing the reminder language re-words the reminders already waiting.

## Sending a one-off WhatsApp message from a Customer's page

Not every message fits a scheduled reminder — sometimes you just want to send a specific customer something right now. Open any customer's page and click **Send WhatsApp Message** (only shown if that customer has a phone number on file).

1. Choose a template from the dropdown — the same catalog as Message Templates above, limited to the ones meant for customers (the internal-only note isn't offered here).
2. The customer's own name is filled in automatically wherever the template expects it. Fill in anything else the template needs (an amount, a date, a case number...) in the boxes provided.
3. A live preview updates as you type, showing exactly what will be sent.
4. Click **WhatsApp** to open it pre-filled, same as everywhere else — review and send from there. If the customer's form says **Do not send this customer messages**, Sarang refuses to build the message.

## A note on how WhatsApp actually opens

Opening WhatsApp this way launches WhatsApp Desktop if it's installed, or WhatsApp Web in your browser otherwise, exactly like the Share via WhatsApp buttons on Invoices and other documents. Sarang has no way to confirm a message was actually delivered once WhatsApp opens — that's why reminders stay in **Pending** until you explicitly click **Mark Sent** yourself.
