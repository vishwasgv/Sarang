import { getPrisma } from '../database/db'
import { parseAndVerifyLicenseKey } from '../services/license.service'
import { TRIAL_SEATS } from '../services/license-seats.util'

// PCs allowed at once (the shop PC counts as one). No key yet, or a key from before seats existed: one PC,
// except that a free trial allows two so the feature can be tried.
export async function getSeatLimit(): Promise<number> {
  const row = await getPrisma().setting.findUnique({ where: { settingKey: 'license_key' } })
  const parsed = row?.settingValue ? parseAndVerifyLicenseKey(row.settingValue) : null
  if (!parsed) return 1
  if (parsed.seats) return parsed.tier === 'TRIAL' ? Math.max(parsed.seats, TRIAL_SEATS) : parsed.seats
  return parsed.tier === 'TRIAL' ? TRIAL_SEATS : 1
}
