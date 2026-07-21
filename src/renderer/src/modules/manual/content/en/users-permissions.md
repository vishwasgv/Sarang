# Users & Permissions

If more than one person uses Sarang — an owner plus cashiers, kitchen staff, or managers — add each of them as their own **User** with a **Role** that controls exactly what they can see and do. This is managed from **Settings → Users & Roles**.

## Adding a user

Click **Add User** and fill in:

- **Full Name** (required)
- **Username** (required — used to log in)
- **Password** (required, minimum length set by your Password Policy, at least 6 characters)
- **Role** (required — see below)
- **Email** and **Phone** (optional)

Save, and the new account can log in immediately with the username and password you set.

## Roles

Every user is assigned one role, and every role comes with a fixed set of permissions built into Sarang — there is no screen for creating custom roles or hand-picking individual permissions. The built-in roles are:

- **Admin** — full system access, including every setting, every report, and user management itself.
- **Manager** — broad operational control (billing, inventory, purchasing, reports, most settings) without full admin-level access.
- **Cashier** — billing-focused: creating invoices, recording payments, and the day-to-day counter operations relevant to your business type.
- **Staff** — general operational support with narrower access than Cashier/Manager.
- **Kitchen Staff** — scoped to restaurant kitchen operations (KOT view/update), for businesses using the Restaurant template.

Each screen and action in Sarang checks the current user's role permissions before allowing it — for example, the Users & Roles section itself is only visible to a user whose role includes the `users.view` permission, and creating, editing, or deactivating other users each require their own separate permission. If your role doesn't have access to something, the option is either hidden or shown disabled.

## Editing a user or changing their role

Click the edit (pencil) icon next to a user to change their full name, role, email, or phone. Username and password aren't changed from this form — see password reset below.

## Deactivating a user

Click the delete icon next to an active user to deactivate them (requires the disable permission). A deactivated account can no longer log in, but its historical records (invoices created, actions logged, etc.) are preserved. You cannot deactivate your own account from this screen.

## Resetting another user's password

Click the shield icon next to a user (not available for your own account) to set a new password for them directly — useful if they've forgotten theirs. This immediately invalidates any of their existing logged-in sessions.

## Forgot your password? (offline recovery code)

Sarang works fully offline, so there is no email or SMS "reset link" — instead, a **Recovery Code** is generated once, during first-time setup, and shown to you exactly once on the final "You're all set!" screen. **Write it down or print it and keep it somewhere safe** — it will never be shown again after that screen.

If you forget your password, click **Forgot password?** on the Login screen, enter your username and your saved Recovery Code, then choose a new password. This works even if no other administrator is logged in or available — it's the only offline-safe way to recover access, so protecting the code is important: anyone who has it (and knows a username) can reset that account's password.

If you ever lose the code, an Admin can generate a brand-new one from **Settings → Security → Password Recovery Code** (requires re-entering your current password first, and immediately invalidates the old code). If the sole Admin is both locked out AND has lost the recovery code, there is genuinely no way back into that account — restoring a recent backup to a fresh install is the only remaining option, which is exactly why saving the code when it's first shown matters.

## Changing your own password

Go to **Settings → Security**, enter your current password, then your new password twice. Your new password must meet the configured minimum length (10 characters by default). After a successful change you'll need to log in again.

## Password policy

Also under **Settings → Security**, an admin can set the **minimum password length** required for every account going forward (between 4 and 64 characters). This only applies the next time a password is created or changed — existing passwords are not retroactively affected.

## Session timeout

For security, Sarang automatically logs out an idle session after a period of inactivity (30 minutes by default) — any mouse click, key press, scroll, or touch resets the timer. This protects against someone walking away from an unlocked till or office computer. Logging back in simply requires your username and password again; no work in progress is lost beyond what wasn't yet saved.

## Login protection

After 5 failed login attempts for the same username within 15 minutes, Sarang temporarily blocks further attempts and tells you how many minutes to wait — this applies to both logging in and changing your own password, to slow down anyone trying to guess a password.
