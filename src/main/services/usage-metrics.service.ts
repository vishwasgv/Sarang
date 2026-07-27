import { getPrisma } from '../database/db'
import { hashLicenseKeyForPing, parseAndVerifyLicenseKey } from './license.service'
import { toLocalISODate } from '../utils/date.util'

// ─────────────────────────────────────────────────────────────────────────
// Aggregate, anonymous daily active-usage tracking. Disclosed once at
// install (SetupWizard), never surfaced again during normal use per the
// founder's explicit choice. Reports only a one-way hash of the license key
// plus a per-day minute count — never the raw key, never any business data,
// never anything that identifies who is behind a given install.
//
// Unlike license.service.ts's pingLicenseStatusIfDue() (deliberately
// droppable — a missed license check is a non-event), this data is meant to
// be delivered reliably once connectivity exists: entries are queued locally
// and only cleared once the server has actually confirmed receipt. Network
// calls are still never load-bearing for the user — nothing here ever
// blocks app startup, normal operation, or quit.
// ─────────────────────────────────────────────────────────────────────────

const USAGE_KEYS = {
  todayDate: 'usage_today_date',
  todayMinutes: 'usage_today_minutes_accumulated',
  lastAliveAt: 'usage_last_alive_at',
  pendingQueue: 'usage_pending_queue',
  lastFlushAttemptAt: 'usage_last_flush_attempt_at'
} as const

const USAGE_ENDPOINT = 'https://aszurex.com/api/sarang-usage'
const TICK_INTERVAL_MS = 5 * 60 * 1000
const FLUSH_THROTTLE_MS = 15 * 60 * 1000
const MAX_QUEUE_ENTRIES = 90 // ~3 months of offline backlog; defensive cap only

interface UsageQueueEntry {
  date: string
  minutesUsed: number
}

// Real bug class this project has hit before (see date.util.ts's own header
// comments, 2026-07-22/23): `.toISOString().slice(0,10)` yields the UTC
// calendar date, not the user's local one. For a shop outside UTC, that
// silently mislabels usage minutes into the wrong day for part of every
// single day (e.g. UTC-8 rolls the "day" over at 4pm local time). Use the
// local-date helper instead — same one already used for the license
// day-threshold math below.
function todayDateString(): string {
  return toLocalISODate(new Date())
}

async function upsertSetting(key: string, value: string): Promise<void> {
  const db = getPrisma()
  await db.setting.upsert({
    where: { settingKey: key },
    update: { settingValue: value },
    create: { settingKey: key, settingValue: value, settingType: 'STRING' }
  })
}

async function readQueue(): Promise<UsageQueueEntry[]> {
  const db = getPrisma()
  const row = await db.setting.findUnique({ where: { settingKey: USAGE_KEYS.pendingQueue } })
  if (!row?.settingValue) return []
  try {
    const parsed = JSON.parse(row.settingValue)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function enqueueUsageEntry(date: string, minutesUsed: number): Promise<void> {
  if (minutesUsed <= 0) return
  let queue = await readQueue()
  queue.push({ date, minutesUsed })
  if (queue.length > MAX_QUEUE_ENTRIES) queue = queue.slice(-MAX_QUEUE_ENTRIES)
  await upsertSetting(USAGE_KEYS.pendingQueue, JSON.stringify(queue))
}

/**
 * Records elapsed time since the last tick into today's running total,
 * rolling yesterday's total into the pending queue if the day changed since
 * the last call. Idempotent and safe to call from three places: once on
 * app startup (also recovers a stale day left over from a crash or an app
 * that was simply never reopened), every ~5 minutes while running, and once
 * more (synchronously awaited, DB-only, no network) right before quit to
 * true-up the final partial interval.
 *
 * Elapsed time is capped at one tick interval + a small grace window so a
 * laptop that was asleep/hibernated for hours between ticks doesn't get
 * counted as active usage for that whole gap.
 */
export async function recordUsageTick(): Promise<void> {
  const db = getPrisma()
  const now = Date.now()
  const today = todayDateString()

  const [dateRow, minutesRow, aliveRow] = await Promise.all([
    db.setting.findUnique({ where: { settingKey: USAGE_KEYS.todayDate } }),
    db.setting.findUnique({ where: { settingKey: USAGE_KEYS.todayMinutes } }),
    db.setting.findUnique({ where: { settingKey: USAGE_KEYS.lastAliveAt } })
  ])

  const lastAlive = aliveRow?.settingValue ? new Date(aliveRow.settingValue).getTime() : now
  const cappedElapsedMs = Math.min(Math.max(now - lastAlive, 0), TICK_INTERVAL_MS + 60_000)
  const elapsedMinutes = Math.round(cappedElapsedMs / 60_000)

  if (dateRow?.settingValue && dateRow.settingValue !== today) {
    const staleMinutes = parseInt(minutesRow?.settingValue || '0', 10)
    if (staleMinutes > 0) await enqueueUsageEntry(dateRow.settingValue, staleMinutes)
    await upsertSetting(USAGE_KEYS.todayDate, today)
    await upsertSetting(USAGE_KEYS.todayMinutes, String(elapsedMinutes))
  } else {
    const current = parseInt(minutesRow?.settingValue || '0', 10)
    await upsertSetting(USAGE_KEYS.todayDate, today)
    await upsertSetting(USAGE_KEYS.todayMinutes, String(current + elapsedMinutes))
  }

  await upsertSetting(USAGE_KEYS.lastAliveAt, new Date(now).toISOString())
}

/**
 * Best-effort delivery of the queued daily totals. Only clears queue entries
 * the server actually confirmed with a 200 — any failure (offline, timeout,
 * server error) leaves the queue untouched for the next attempt. Throttled
 * to at most once per ~15 minutes regardless of caller frequency, so the
 * periodic in-session tick can call this freely without hammering the
 * network while offline.
 */
export async function flushUsageQueue(): Promise<void> {
  try {
    const db = getPrisma()
    const [lastFlushRow, keyRow] = await Promise.all([
      db.setting.findUnique({ where: { settingKey: USAGE_KEYS.lastFlushAttemptAt } }),
      db.setting.findUnique({ where: { settingKey: 'license_key' } })
    ])

    const lastFlush = lastFlushRow?.settingValue ? new Date(lastFlushRow.settingValue).getTime() : 0
    if (Date.now() - lastFlush < FLUSH_THROTTLE_MS) return

    const queue = await readQueue()
    if (queue.length === 0 || !keyRow?.settingValue) return

    await upsertSetting(USAGE_KEYS.lastFlushAttemptAt, new Date().toISOString())

    const parsed = parseAndVerifyLicenseKey(keyRow.settingValue)
    const region = parsed?.region ?? 'IN'

    const res = await fetch(USAGE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyHash: hashLicenseKeyForPing(keyRow.settingValue), region, entries: queue }),
      signal: AbortSignal.timeout(8000)
    })

    if (res.ok) {
      await upsertSetting(USAGE_KEYS.pendingQueue, '[]')
    }
    // Any non-200 leaves the queue intact — nothing is discarded until
    // delivery is actually confirmed.
  } catch {
    // Offline, DNS failure, timeout, etc. — expected and fine; queue stays
    // intact for the next attempt.
  }
}
