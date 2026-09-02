# Tours & Travels

## What's different about this business type

Tours & Travels covers cab/tempo-traveller/bus charter hire, seat-in-coach tour packages, and everything that goes with running a small vehicle fleet: driver duty settlement (Bata, night-halt, night-driving allowance, and excess-km/hour billing), vehicle service/maintenance tracking, and referral agent commission. Real-market research confirms outstation cab fares are quoted per-km by vehicle class with a minimum daily km — a **package rate**, not a live meter — so every booking here snapshots a package rate up front, with excess charges settled only once a trip's duty log closes.

## Vehicle Fleet

Open **Vehicle Fleet** in the sidebar to register each vehicle (registration number, type, seating capacity) and track its odometer. The same screen shows the **Fleet & Seat Availability Calendar** — every vehicle's booked/free status and every upcoming tour departure's seats-remaining, for the next 30 days — and lets you log **Service / Repair / Maintenance** visits with cost and odometer reading, building the history the Vehicle Service-Due report reads from.

## Tour Packages & Seat Booking

Open **Tour Packages** to define a reusable package (name, itinerary, duration, default seats, fare per seat), then schedule real **departures** against it on specific dates. A customer books individual **seats** on a departure — the seat count is claimed atomically so two staff can never oversell the same departure — and the package rate is computed automatically as seats × fare per seat.

## Trip Bookings & Driver Duty

Open **Trip Bookings** to create an exclusive **charter booking**: pick the customer and vehicle, set the trip dates, pickup/drop/route, a package rate, and the **included km/day** and **included hours/day** the package covers. Capture an advance if one was collected, and optionally a referring agent's name and commission.

Once the trip is underway, **Start Duty** against the booking: assign a driver, record the starting odometer and time, and the driver's Bata (daily allowance), night-halt charge, and night-driving allowance if applicable. When the trip ends, **Close Duty** with the ending odometer and time — Sarang computes the km driven and hours on duty, and if either exceeds the package's included allowance, the excess is charged at a per-km rate that varies by vehicle class (sedan/SUV/tempo traveller/mini-bus/bus) plus a flat excess-hour rate. This excess charge is customer-facing revenue; the driver's Bata/night-halt/night-driving stay a separate cost, never billed as a markup.

Once a booking is ready to bill, **Generate Invoice** — it bills the package rate plus any settled excess-km/hour charges from closed duty logs, and records the advance already collected as a real payment against the new invoice.

## Reports

Alongside the standard Sales, Inventory, and Financial reports, Tours & Travels gets:

- **Vehicle Service Due** — total km run per vehicle since its last service, with vehicles due or overdue flagged against either their own recorded next-service-due km or a generic default interval.
- **Commission by Agent** — referral commission earned per agent, rolled up across every trip booking in the selected range.
- **Trip Profitability** (wow feature) — per completed trip: revenue (package rate plus excess charges) minus driver cost, an estimated fuel cost from km driven, a prorated share of the vehicle's maintenance cost, and commission — the one number that shows real per-trip margin, not just revenue.

## Language

Tours & Travels is not one of Sarang's service-business templates — it's a product/fleet-category business type, so it is **not** language-locked. The core interface, including Vehicle Fleet, Tour Packages, and Trip Bookings, is available in all 13 supported languages.
