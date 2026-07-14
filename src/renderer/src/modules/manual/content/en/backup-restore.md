# Backup & Restore

Sarang stores all your business data in a single local database file on this computer. The **Backup** screen (sidebar, or **Settings → Backup & Recovery**) is where you protect that data against disk failure, accidental deletion, or a lost/stolen machine.

## Creating a manual backup

Click **Create Backup**. Sarang runs a database integrity check first, flushes any pending writes, then produces a clean, defragmented copy of your database, checksums it, and packages it (together with a small metadata file) into a single `.sarang-backup` file. If the integrity check fails, the backup is refused rather than saving a possibly-corrupt copy — you'll see an error explaining why.

Each backup appears in the **Backup History** list with its file name, date, size, and a valid/invalid status badge.

## Where backups are stored

By default, backups are saved to this app's own data folder on the same disk as your live database (shown at the bottom of the Backup screen, and typically under `AppData\Sarang Business OS Lite\backups\` on Windows). Because that's the same disk your live data lives on, a disk failure would take the backups down with it too.

The first time you log in, Sarang shows a one-time **"Keep your backups safe"** prompt encouraging you to choose a different backup location — an external USB drive, a second disk, or a network folder — right away. You can skip it, and change this at any time later from the Backup screen's **Choose a Backup Folder** button (an owner/admin-only setting). If the configured folder becomes unreachable (e.g. a USB drive isn't plugged in), Sarang automatically falls back to the default local folder for that backup rather than failing silently, and flags this on screen. Backups are always saved to a local disk or network folder you choose — never to any cloud service.

## Automatic backups

An admin can turn on **auto-backup** from the Backup screen: enable it, then set how many days between automatic backups, how many backups to retain (older ones beyond this count are deleted automatically), and how many days of no backup should trigger a reminder. When enabled, Sarang checks on app startup whether enough days have passed since the last backup and creates one automatically if so, with a notification confirming it happened.

Sarang also creates an automatic **safety backup** of your current database immediately before any restore is performed (see below), so a restore can itself be undone if needed.

## Checking backup and database integrity

The Backup screen shows two live indicators:
- **Backup health** — whether you're protected (backed up today), overdue (backed up within the last week but not today), or unprotected (no backup, or over a week old).
- **Database integrity** — a check that your live database file isn't corrupted.

You can also click the shield icon next to any individual backup to **Verify** it on demand — Sarang re-checks the file's checksum and confirms it can still be opened and read correctly, and updates its valid/invalid status accordingly. Every backup is checksummed (SHA-256) at creation time specifically so a later tampering or corruption of the file can be detected.

## Restoring from a backup

Click the restore icon on any backup in the list. Sarang first validates the file and shows you a preview — business name, backup date, app version, and database size — so you can confirm you're restoring the right one. Confirming triggers:

1. A safety backup of your *current* database (so today's data isn't lost if you change your mind).
2. Replacement of the live database with the backup's contents.
3. An automatic restart of the app to reconnect to the restored data.

Restoring is only available to users with the appropriate permission (typically an admin). If a restore fails partway through, Sarang attempts to reconnect to your original database and reports the error — the safety backup created in step 1 is there specifically so you can recover from that situation too.

## Deleting old backups

Backups can be deleted individually from the list (admin/permission-gated). Deleting removes both the file and its record; it does not affect your live data.
