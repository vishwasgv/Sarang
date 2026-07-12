import React, { useEffect } from 'react'
import { Printer } from 'lucide-react'
import { AszurexMark } from '@shared/ui/atoms/Brand'
import { DocumentWatermark, documentLogoUrl } from '@shared/ui/molecules/DocumentWatermark'
import { formatCurrency } from '@shared/utils/currency.util'

interface ResultParameter { parameter: string; value: string; unit?: string; referenceRange?: string; flag?: 'LOW' | 'NORMAL' | 'HIGH' | 'ABNORMAL' }

interface LabTestOrderItem {
  id: string
  testName: string
  category: string | null
  sampleType: string
  price: number
  status: string
  resultParameters: string
  resultSummary: string | null
}

interface LabTestOrder {
  orderNumber: string
  patientName: string
  patientAge: string | null
  referringNotes: string | null
  totalAmount: number
  createdAt: string
  items: LabTestOrderItem[]
}

interface BusinessProfile {
  businessName: string
  address?: string | null
  city?: string | null
  state?: string | null
  phone?: string | null
  email?: string | null
  logoPath?: string | null
  enableDocumentWatermark?: boolean | null
}

const FLAG_COLOR: Record<string, string> = {
  LOW: 'text-warning', HIGH: 'text-danger', ABNORMAL: 'text-danger', NORMAL: 'text-slate-700 dark:text-slate-300',
}

export function LabReportPrint({ order, profile, onClose }: { order: LabTestOrder; profile: BusinessProfile | null; onClose: () => void }) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  function handlePrint() {
    window.print()
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 print:hidden">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between print:hidden">
            <p className="text-sm font-semibold text-dark dark:text-slate-100">Lab Report — Preview</p>
            <div className="flex items-center gap-2">
              <button onClick={handlePrint} className="flex items-center gap-1.5 px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand/90 transition-colors">
                <Printer size={14} /> Print
              </button>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-dark dark:hover:text-slate-100 transition-colors">
                ✕
              </button>
            </div>
          </div>
          <div className="p-8">
            <ReportBody order={order} profile={profile} />
          </div>
        </div>
      </div>

      <div className="hidden print:block fixed inset-0 bg-white dark:bg-slate-900 z-[9999] p-12">
        <ReportBody order={order} profile={profile} />
      </div>
    </>
  )
}

function ReportBody({ order, profile }: { order: LabTestOrder; profile: BusinessProfile | null }) {
  return (
    <div style={{ fontFamily: 'Georgia, serif' }} className="relative text-dark dark:text-slate-100 text-sm">
      <DocumentWatermark logoPath={profile?.logoPath} enabled={profile?.enableDocumentWatermark} />
      {/* Lab header */}
      <div className="text-center border-b-2 border-dark pb-4 mb-6">
        <p className="text-[10px] font-bold tracking-[0.3em] text-slate-500 dark:text-slate-400 uppercase mb-1">Laboratory Report</p>
        {profile?.logoPath && (
          <img src={documentLogoUrl(profile.logoPath)} alt="" className="mx-auto mb-2" style={{ maxHeight: 48, maxWidth: 120, objectFit: 'contain' }} />
        )}
        <h1 className="text-2xl font-bold">{profile?.businessName ?? 'Diagnostic Laboratory'}</h1>
        {(profile?.address || profile?.city) && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{[profile?.address, profile?.city, profile?.state].filter(Boolean).join(', ')}</p>
        )}
        {(profile?.phone || profile?.email) && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {profile?.phone ? `Tel: ${profile.phone}` : ''}
            {profile?.phone && profile?.email ? '  ·  ' : ''}
            {profile?.email ?? ''}
          </p>
        )}
      </div>

      {/* Order meta */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 border-b border-slate-100 dark:border-slate-800 pb-1">Patient</p>
          <p className="font-semibold">{order.patientName}</p>
          {order.patientAge && <p className="text-xs text-slate-500 dark:text-slate-400">{order.patientAge}</p>}
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 border-b border-slate-100 dark:border-slate-800 pb-1">Order</p>
          <p className="text-xs text-slate-600 dark:text-slate-300">{order.orderNumber} · {new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          {order.referringNotes && <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">Ref: {order.referringNotes}</p>}
        </div>
      </div>

      {/* Test results */}
      {order.items.map((item) => {
        let params: ResultParameter[] = []
        try { params = JSON.parse(item.resultParameters) } catch { params = [] }
        return (
          <div key={item.id} className="mt-5">
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 pb-1 mb-2">{item.testName}</p>
            {params.length > 0 && (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-400">
                    <th className="pb-1 font-semibold">Parameter</th>
                    <th className="pb-1 font-semibold">Result</th>
                    <th className="pb-1 font-semibold">Unit</th>
                    <th className="pb-1 font-semibold">Reference Range</th>
                  </tr>
                </thead>
                <tbody>
                  {params.map((p, i) => (
                    <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="py-1">{p.parameter}</td>
                      <td className={`py-1 font-semibold ${FLAG_COLOR[p.flag ?? 'NORMAL']}`}>{p.value}{p.flag && p.flag !== 'NORMAL' ? ` (${p.flag})` : ''}</td>
                      <td className="py-1">{p.unit ?? '—'}</td>
                      <td className="py-1">{p.referenceRange ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {item.resultSummary && <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed mt-2">{item.resultSummary}</p>}
          </div>
        )
      })}

      {/* Signature */}
      <div className="grid grid-cols-2 gap-16 mt-12 pt-8 border-t border-slate-200 dark:border-slate-700">
        <div className="text-center">
          <div className="border-b border-dark h-8 mb-2" />
          <p className="text-xs text-slate-500 dark:text-slate-400">Practitioner Signature</p>
        </div>
        <div className="text-center">
          <div className="border-b border-dark h-8 mb-2" />
          <p className="text-xs text-slate-500 dark:text-slate-400">Lab Stamp</p>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="mt-8 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
        <p className="text-[8px] text-slate-500 dark:text-slate-400 leading-relaxed">
          <strong>Disclaimer:</strong> This document was generated by Sarang Business OS Lite, a convenience tool.
          It is NOT a validated medical record. All content was entered by laboratory staff. Verify all information
          before clinical use. Total billed: {formatCurrency(order.totalAmount)}.
        </p>
      </div>

      {/* Footer */}
      <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
        <p className="text-[9px] text-slate-400">Issued on {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })} · {profile?.businessName ?? 'Diagnostic Laboratory'}</p>
        <p className="text-[9px] text-slate-300 mt-0.5 inline-flex items-center gap-1">
          Generated by Sarang Business OS Lite | Aszurex <AszurexMark width={10} /> | www.aszurex.com
        </p>
      </div>
    </div>
  )
}
