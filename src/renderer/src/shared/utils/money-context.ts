import { useMemo } from 'react'
import { useBusinessStore } from '@app/store/business.store'
import { buildMoneyContext, type MoneyContext } from './money-context.util'

export type { MoneyContext }
export { buildMoneyContext }

export function readMoneyContext(): MoneyContext {
  const { profile, settings } = useBusinessStore.getState()
  return buildMoneyContext(profile, settings)
}

export function useMoneyContext(): MoneyContext {
  const profile = useBusinessStore(s => s.profile)
  const settings = useBusinessStore(s => s.settings)
  return useMemo(() => buildMoneyContext(profile, settings), [profile, settings])
}
