# Guide: Using Sarang on More Than One PC

Some shops need two or three people to work at the same time: one at the counter, one doing purchases, one checking accounts. Sarang can do this on your own shop network. Nothing goes over the internet.

## How it works

- One PC keeps all the data. It is called the **server**. Keep it switched on with Sarang open during shop hours.
- The other PCs are **clients**. They hold no business data. They show and change the data kept on the server.
- Everything sent between the PCs is encrypted with a **shared secret** you choose. It is off until you turn it on.

## What you need

- All PCs on the same shop network (the same Wi-Fi or cable network).
- A licence with enough **seats**. The shop PC counts as one seat, and each other PC signed in at the same time uses one more. A free trial allows two PCs so you can try it. To add seats, write to the address on the Licence screen.

## Set up the server (the PC that keeps the data)

1. Sign in as the owner. Go to **Settings → Business features → Multi-user**.
2. Choose **This PC keeps the data (server)**.
3. Note the **address** shown (for example 192.168.1.10:47821) and the **shared secret**. You can change the secret at any time with **Make a new secret**.
4. Press **Save and restart Sarang**.
5. If another PC cannot connect, allow Sarang through the Windows firewall on this PC for private networks.

## Set up each client PC

1. Install Sarang on the PC and open it.
2. On the sign-in page press **PC connection settings (several PCs)**.
3. Choose **This PC connects to another PC (client)**. Type the server address and the shared secret, press **Test connection**, then **Save and restart Sarang**.
4. Sign in with your own username and password. Create a username for each person in **Settings → Users** so each sale and change shows who made it.

## Working together

- Each person has their own sign-in and their own permissions.
- If two people save at the same moment, one waits a moment for the other. Numbers such as invoice numbers never repeat. If two people sell the last unit, only one sale goes through.
- When someone opens a customer, supplier or product to edit, others who open the same record see **"… has this open on another PC"** and cannot save until it is closed.
- When another PC changes data, a small note appears: **"… changed some data on another PC. Refresh."** Press Refresh to see the latest.
- **Settings → Business features → Multi-user** on the server lists who is connected and lets you disconnect a PC.

## What only works on the server PC

Backups and restore, importing files, the tutorial, activating the licence, opening documents from disk and kitchen ticket printing happen on the server PC. A client PC prints invoices and saves reports (Excel, PDF, CSV) on its own printer and disk.

## Good habits

- Keep the server on a stable power supply and take a backup every day on the server. Clients cannot work when the server is off.
- Do not copy the data file to other PCs and do not open the same data file from two PCs over the network. Use this feature instead. Opening one file from two PCs can damage it.
- Keep the shared secret private. If someone leaves the shop, press **Make a new secret** and type the new one on the other PCs.
