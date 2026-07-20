# Hotel / Lodge

## What's different about this business type

Hotel/Lodge is deliberately its own vertical rather than an extension of either the generic Rental Business model or the standard single-visit appointment model every other service business in Sarang uses. A hotel stay needs three things neither of those covers: legally required guest-ID capture at check-in, per-night billing across a multi-night stay, and in-stay extra charges added to a running folio before final checkout. So Hotel/Lodge gets one dedicated module, **Hotel Bookings**, covering the whole booking lifecycle standalone.

## Room roster

Open **Rooms** in the sidebar to maintain your room list — room number, room type, floor, maximum occupancy, and a base rate per night. A room's status (Available, Occupied, Cleaning, Maintenance, or Out of Order) mostly changes on its own as bookings move through check-in and check-out; you can't manually change the status of a room that currently has a guest in it.

## Booking a stay

Open **Hotel Bookings** to create a new booking — pick a room, check-in and check-out dates, guest name and contact details, number of guests (capped at the room's maximum occupancy), an optional advance payment, and where the booking came from (**booking source/channel** — Walk-In, Phone, MakeMyTrip, Booking.com, or any other channel you type). Sarang checks the room is genuinely free for that exact date range before confirming — the same live-availability check used elsewhere in Sarang, so two staff members can never double-book the same room for overlapping dates. Nights are billed on calendar dates, not elapsed hours — a stay from evening check-in to morning check-out the next day is always one night, as in normal hotel practice.

If the guest has stayed before, picking them from the customer search shows their **previous stay count** right in the New Booking form, so front desk staff can recognize and welcome back a returning guest.

For a shorter same-day stay, choose **Day Use** instead of a normal overnight booking — it bills at the room's configured day-use rate (or half the nightly rate if none is set) and still holds the room for the full day.

### Seasonal rates

Set up date-range pricing under **Manage Seasonal Rates** on the Rooms screen — a blanket rate for all rooms during a period (e.g. a festival season surcharge), or a rate specific to one room type. A stay that spans a season boundary is priced correctly night by night, not at one flat rate for the whole stay.

### Group bookings

Booking multiple rooms for the same guest for a group or family? Check off the related bookings on the Hotel Bookings list and use **Generate Combined Bill** to produce one invoice covering all of them, instead of a separate bill per room.

## Guest ID compliance at check-in

Checking a booking in requires recording at least one guest's ID — name, ID type (Aadhaar, Passport, Driving License, Voter ID, or PAN in India; Passport, National ID, Driving License, or Other Government ID elsewhere), ID number, and nationality. This isn't extra friction for its own sake — many jurisdictions legally require a lodging establishment to keep a producible register of every guest's identity for police or immigration verification, and this is exactly that record.

## In-stay extra charges

While a guest is checked in, add extra charges to their stay from the booking's detail screen — room service, laundry, minibar, anything billed on top of the room rate. These build up a running folio that's added to the final bill; charges can only be added or removed while the guest is still checked in.

## Checkout and billing

Checking out ends the stay and frees the room for cleaning. Generating the invoice bills the room charge (nightly rate × nights) plus every extra charge as its own line item, so the printed invoice itemizes the stay the way a real hotel folio would. Any advance payment collected at booking time is automatically recorded as a payment against the new invoice. Like every other invoice in Sarang, it can be printed at A4 or thermal receipt width.

## Housekeeping

Every checkout automatically queues a **housekeeping task** for that room. Open **Housekeeping** to see every pending task, assign it to a staff member, and mark it done — once every open task for a room is complete, the room flips back to Available on its own, rather than relying on someone remembering to change its status manually.

## Cancelling or no-show

A Confirmed booking that hasn't checked in yet can be cancelled (with an optional reason) or marked as a no-show. Once a guest has checked in, the only way forward is checkout — a checked-in booking can no longer be cancelled, since the guest is physically in the room.

## Reports

**Reports** includes an Occupancy report (rooms occupied/available/cleaning/maintenance right now, with an occupancy percentage) and a Guest Register report — the compliance record this vertical exists to support, listing every guest's ID details for stays overlapping a date range you choose, ready to produce on demand.

## Language

Hotel/Lodge is one of Sarang's service-business templates, and — unlike Tailor/Boutique, the one named exception — it keeps the standard rule for that group: the interface is locked to **English only**, regardless of which language you've set elsewhere in Sarang.
