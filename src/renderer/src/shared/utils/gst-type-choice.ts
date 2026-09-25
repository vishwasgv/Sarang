import { useState } from 'react'
import { useBusinessStore } from '@renderer/app/store/business.store'
import { defaultGstTypeForPlaceOfSupply, resolvePartyState, type GstType } from '../../../../shared/utils/gst-presentation'

// The tax presentation of a new document. Follows the place of supply automatically (business state against
// the party's state) until the owner picks one; the pick then stays. Only meaningful under the GST tax model.
export function useGstTypeChoice(partyState: string | null | undefined) {
  const businessState = useBusinessStore(s => resolvePartyState(s.profile?.state, s.profile?.taxNumber))
  const taxModel = useBusinessStore(s => s.profile?.taxModel ?? 'NONE')
  const [override, setOverride] = useState<GstType | null>(null)
  const autoType = defaultGstTypeForPlaceOfSupply(businessState, partyState)
  return {
    isGst: taxModel === 'GST',
    gstType: override ?? autoType,
    setGstType: (t: GstType) => setOverride(t),
    isAuto: override === null,
    autoType,
    reset: () => setOverride(null)
  }
}
