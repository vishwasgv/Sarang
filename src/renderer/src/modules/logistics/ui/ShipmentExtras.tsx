import React from 'react'
import { useTranslation } from 'react-i18next'
import { formatDateTime } from '@shared/utils/locale.util'
import { aszurexFooterHtml } from '@shared/utils/print-branding'

export interface LabelShipment {
  shipmentNumber: string
  originAddress: string | null
  destinationAddress: string
  customerName: string | null
  supplierName: string | null
  carrierName: string | null
  trackingNumber: string | null
  weight: number | null
  packages: number
  ewayBillNumber: string | null
}

export interface TrackedShipment {
  status: string
  createdAt: string
  readyAt?: string | null
  inTransitAt?: string | null
  outForDeliveryAt?: string | null
  deliveredAt?: string | null
  expectedDelivery?: string | null
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// One label per package, each on its own page, sized for a 4 x 6 inch label printer or plain A4.
export function printShippingLabels(s: LabelShipment, labels: { from: string; to: string; tracking: string; carrier: string; weight: string; package: string; of: string; eway: string }, businessName: string): void {
  const w = window.open('', '_blank')
  if (!w) return
  const count = Math.max(1, Math.min(s.packages || 1, 200))
  const receiver = s.customerName ?? s.supplierName ?? ''
  const pages = Array.from({ length: count }, (_, i) => `
    <section class="label">
      <div class="small">${esc(labels.from)}: ${esc(businessName)}${s.originAddress ? ` — ${esc(s.originAddress)}` : ''}</div>
      <div class="to">${esc(labels.to)}</div>
      <div class="recv">${esc(receiver)}</div>
      <div class="addr">${esc(s.destinationAddress).replace(/\n/g, '<br/>')}</div>
      <div class="meta">
        <div><b>${esc(s.shipmentNumber)}</b></div>
        ${s.trackingNumber ? `<div>${esc(labels.tracking)}: <b>${esc(s.trackingNumber)}</b></div>` : ''}
        ${s.carrierName ? `<div>${esc(labels.carrier)}: ${esc(s.carrierName)}</div>` : ''}
        ${s.weight ? `<div>${esc(labels.weight)}: ${s.weight} kg</div>` : ''}
        ${s.ewayBillNumber ? `<div>${esc(labels.eway)}: ${esc(s.ewayBillNumber)}</div>` : ''}
      </div>
      <div class="pkg">${esc(labels.package)} ${i + 1} ${esc(labels.of)} ${count}</div>
      <footer>${aszurexFooterHtml(9)}</footer>
    </section>`).join('')
  w.document.write(`<html><head><style>
    @page{size:4in 6in;margin:0.15in}
    body{font-family:Arial,sans-serif;margin:0}
    .label{page-break-after:always;padding:8px;height:5.6in;box-sizing:border-box;border:2px solid #000;display:flex;flex-direction:column;gap:8px}
    .label:last-child{page-break-after:auto}
    .small{font-size:11px;color:#333}
    .to{font-size:12px;font-weight:bold;letter-spacing:2px;margin-top:8px}
    .recv{font-size:24px;font-weight:bold}
    .addr{font-size:20px;line-height:1.3;flex:1}
    .meta{font-size:13px;border-top:1px solid #000;padding-top:6px;line-height:1.5}
    .pkg{font-size:22px;font-weight:bold;text-align:center;border:2px solid #000;padding:4px}
    footer{font-size:8px;color:#888;text-align:center}
  </style></head><body>${pages}</body></html>`)
  w.document.close()
  w.print()
}

// Where the shipment has been, from the times stored at each status change.
export function ShipmentTracking({ shipment }: { shipment: TrackedShipment }) {
  const { t } = useTranslation()
  const steps = [
    { key: 'PENDING', at: shipment.createdAt },
    { key: 'READY', at: shipment.readyAt },
    { key: 'IN_TRANSIT', at: shipment.inTransitAt },
    { key: 'OUT_FOR_DELIVERY', at: shipment.outForDeliveryAt },
    { key: 'DELIVERED', at: shipment.deliveredAt }
  ]
  const ended = shipment.status === 'RETURNED' || shipment.status === 'CANCELLED'
  return (
    <div className="mt-3 border-t border-gray-100 pt-3">
      <ol className="flex flex-wrap gap-x-6 gap-y-2">
        {steps.map((st) => (
          <li key={st.key} className={`text-xs ${st.at ? 'text-gray-800' : 'text-gray-400'}`}>
            <span className={`inline-block w-2.5 h-2.5 rounded-full me-1.5 ${st.at ? 'bg-green-500' : 'bg-gray-300'}`} />
            <span className="font-medium">{t(`logistics.shipments.track.${st.key}`)}</span>
            <div className="ms-4">{st.at ? formatDateTime(st.at) : '—'}</div>
          </li>
        ))}
      </ol>
      {ended && <p className="mt-2 text-xs text-amber-600">{t(`logistics.shipments.track.${shipment.status}`)}</p>}
      {shipment.expectedDelivery && !shipment.deliveredAt && !ended && <p className="mt-2 text-xs text-gray-500">{t('logistics.shipments.track.expected', { date: formatDateTime(shipment.expectedDelivery) })}</p>}
    </div>
  )
}
