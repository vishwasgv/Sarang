# Guide: Reminders and Alerts

Sarang tells you two different things, in two different places. Knowing which is which removes most confusion.

| | **Alerts** (the bell) | **WhatsApp Reminders** |
|---|---|---|
| Who it is for | **You** | **Your customers, suppliers or patients** |
| Where | Bell icon in the top bar | **Reminders & Messages → WhatsApp Reminders** |
| Examples | Low stock, backup done, reminders due, database check | "Your appointment is tomorrow at 10:00", "Your payment is overdue", "Your membership ends in 7 days" |
| What you do | Click it: Sarang opens the screen it is about | Click **Send on WhatsApp**, then press Send in WhatsApp |
| Sent automatically? | Shown automatically | **Never.** Sarang prepares the message; you always press Send |

## Alerts (the bell)

The bell shows a number when something needs you. Open it and click an alert:

- **WhatsApp Reminders Due** opens the WhatsApp Reminders screen.
- **Low Stock Alert** opens Inventory.
- **Auto-Backup Complete** and **Database Integrity Issue** open Backup.
- **Compliance Tasks Generated** (CA and CS firms) opens Compliance.

An alert marked **Open →** is clickable. Clicking also marks it read. **Mark all read** clears the number.

## WhatsApp Reminders

Sarang prepares reminders from what happens in your business and lists them in **WhatsApp Reminders**, in three tabs: **Pending**, **Sent** and **All**.

For each pending reminder you see who it is for, the message, and when it was due.

1. Click **Send on WhatsApp**. WhatsApp (the desktop app or WhatsApp Web) opens with the person's number and the message already typed.
2. Press **Send** in WhatsApp. This step is always yours.
3. Back in Sarang, click the tick (**Mark as sent**) so it moves to *Sent*. Use the cross (**Dismiss**) for one you decide not to send.

A reminder with **no phone number** shows "No phone number, so this can't be sent". Add the number to the customer or supplier, or dismiss it. Only reminders that can actually be sent can be marked sent. A reminder whose phone number is too short to be real is marked **Failed** and is not counted as ready to send: fix the number on the customer and the next reminder will work.

**A customer who asked not to be messaged.** Tick **Do not send this customer messages** on the customer's form. Their waiting reminders are removed, they no longer appear as ready to send, and the one-off **Send WhatsApp Message** button refuses them.

### What creates reminders

- **Appointments** (clinics, salons, gyms and other appointment-based businesses): a reminder **24 hours before** and another **2 hours before** the appointment time. They are counted from the appointment's date and time, so an appointment tomorrow at 10:00 is reminded at 10:00 today and 08:00 tomorrow. A booking made less than 24 hours ahead gets only the 2-hour reminder; one made less than 2 hours ahead gets none.
- **Rescheduling or cancelling** an appointment replaces or removes its waiting reminders, so nobody is reminded of an old time. Completed, no-show and in-progress appointments lose their waiting reminders too.
- **No phone on the customer**: no reminder is created, and Sarang tells you when you book.
- **Overdue payments** (7, 14 and 30 days), **membership and contract renewals**, **vaccine and recall dates**, **fee dues**, **legal hearing dates**, **shipments dispatched or delayed**, **goods received** (a thank-you to the supplier, only if the supplier has a phone number), and many business-specific ones.
- **Customer page → Send WhatsApp Message**: a one-off message you write yourself.

### Sending a lot at once

Reminders come due through the day. Sarang checks every hour while it is open and puts a **WhatsApp Reminders Due** alert on the bell. If Sarang is closed, reminders wait; they are not lost, they show as due when you next open it.

### Message Templates

**Reminders & Messages → Message Templates** lets you change the wording of each reminder, see a live preview, and choose the **reminder language**.

- Keep placeholders such as `{{name}}` and `{{date}}` exactly as written; Sarang fills them in. If you type a placeholder that message cannot fill (a spelling slip such as `{{nmae}}`) or brackets that do not pair up, Sarang warns you while you type and will not save it.
- **Wording is kept for the reminder language you have chosen.** Choose Hindi at the top and write your Hindi wording; choose English and write your English wording. Wording saved while English is chosen also applies to any language where you have not written your own. **Reset** removes the wording that is in effect right now and brings back the built-in text.
- **Reminders already waiting are updated** when you save a template, change the reminder language or switch the signature: Sarang re-words them to match, and tells you how many it updated. A reminder you edited by hand, or one that no longer fits its template, is left as it is.
- **Signature.** Built-in messages end with "Powered by Sarang | www.aszurex.com". Untick **End messages with Powered by Sarang** at the top of the screen to remove it from every message.
- Each reminder begins with your business name in bold, added automatically.

## Alerts you set yourself

**Settings → Business Features → Alert rules** sends you a bell notification when a sale, a supplier bill or an expense of at least an amount you choose is saved (for example "Invoice saved, at least 50,000"). You can turn a rule off or delete it. Rules only tell you; they never stop or change a document, and they fire for documents made on the main screens.

## Good habits

- Check **WhatsApp Reminders** once in the morning and once in the afternoon.
- Keep phone numbers in international or local format consistently; Sarang adds your country code to local numbers (it knows the dial codes of about 100 countries). If your country is not recognised, type numbers with the country code and a plus sign.
- Ask Sarang: "How many reminders are pending?" tells you how many are ready, how many are scheduled for later and how many failed.
