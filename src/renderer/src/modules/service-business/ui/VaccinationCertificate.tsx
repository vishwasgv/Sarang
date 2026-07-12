import React, { useEffect } from 'react'
import { X, Printer } from 'lucide-react'
import { useBusinessStore } from '@app/store/business.store'
import { api } from '@renderer/services/ipc-client'
import { AszurexMark } from '@shared/ui/atoms/Brand'
import { DocumentWatermark, documentLogoUrl } from '@shared/ui/molecules/DocumentWatermark'

interface VaccinationRecord {
  id: string
  vaccineName: string
  vaccineType: string | null
  batchNumber: string | null
  manufacturer: string | null
  administeredAt: string
  administeredBy: string | null
  nextDueDate: string | null
  notes: string | null
}

interface PetInfo {
  petName: string
  species: string
  breed: string | null
  gender: string | null
  dateOfBirth: string | null
  microchipId: string | null
  color: string | null
  customer: { customerName: string; phone: string | null } | null
}

interface Props {
  record: VaccinationRecord
  pet: PetInfo
  onClose: () => void
}

function fmt(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function VaccinationCertificate({ record, pet, onClose }: Props) {
  const profile = useBusinessStore((s) => s.profile)

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  function handlePrint() {
    // Mark as printed (best-effort — don't block print on failure)
    api.vaccinations.update({ id: record.id, certificatePrinted: true }).catch(() => {})
    window.print()
  }

  return (
    <>
      {/* Screen overlay (hidden during print) */}
      <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 print:hidden">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          {/* Modal toolbar */}
          <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between print:hidden">
            <p className="text-sm font-semibold text-dark dark:text-slate-100">Vaccination Certificate — Preview</p>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand/90 transition-colors"
              >
                <Printer size={14} />
                Print
              </button>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-dark dark:hover:text-slate-100 transition-colors">
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Certificate content (inside modal preview) */}
          <div className="p-8">
            <CertificateBody record={record} pet={pet} profile={profile} />
          </div>
        </div>
      </div>

      {/* Print-only layout — visible only when window.print() fires */}
      <div className="hidden print:block fixed inset-0 bg-white dark:bg-slate-900 z-[9999] p-12">
        <CertificateBody record={record} pet={pet} profile={profile} />
      </div>
    </>
  )
}

interface Profile {
  businessName: string
  address?: string | null
  city?: string | null
  state?: string | null
  phone?: string | null
  email?: string | null
  logoPath?: string | null
  enableDocumentWatermark?: boolean | null
}

function CertificateBody({ record, pet, profile }: { record: VaccinationRecord; pet: PetInfo; profile: Profile | null }) {
  return (
    <div className="relative font-sans text-dark dark:text-slate-100" style={{ fontFamily: 'Georgia, serif' }}>
      <DocumentWatermark logoPath={profile?.logoPath} enabled={profile?.enableDocumentWatermark} />
      {/* Header */}
      <div className="text-center border-b-2 border-dark pb-4 mb-6">
        <p className="text-[10px] font-bold tracking-[0.3em] text-slate-500 dark:text-slate-400 uppercase mb-1">Vaccination Certificate</p>
        {profile?.logoPath && (
          <img src={documentLogoUrl(profile.logoPath)} alt="" className="mx-auto mb-2" style={{ maxHeight: 48, maxWidth: 120, objectFit: 'contain' }} />
        )}
        <h1 className="text-2xl font-bold text-dark dark:text-slate-100">{profile?.businessName ?? 'Veterinary Clinic'}</h1>
        {(profile?.address || profile?.city) && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {[profile?.address, profile?.city, profile?.state].filter(Boolean).join(', ')}
          </p>
        )}
        {(profile?.phone || profile?.email) && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {profile?.phone ? `Tel: ${profile.phone}` : ''}
            {profile?.phone && profile?.email ? '  ·  ' : ''}
            {profile?.email ?? ''}
          </p>
        )}
      </div>

      {/* Certificate title */}
      <div className="text-center mb-8">
        <p className="text-base font-bold uppercase tracking-widest text-slate-700 dark:text-slate-300">Certificate of Vaccination</p>
        <p className="text-xs text-slate-400 mt-1">This certifies that the following animal has been vaccinated</p>
      </div>

      {/* Two-column layout: Patient | Vaccine */}
      <div className="grid grid-cols-2 gap-8 mb-8">
        {/* Patient details */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3 border-b border-slate-200 dark:border-slate-700 pb-1">Patient Details</p>
          <table className="w-full text-sm">
            <tbody>
              {[
                ['Name', pet.petName],
                ['Species', pet.species],
                ['Breed', pet.breed ?? '—'],
                ['Gender', pet.gender ?? '—'],
                ['Date of Birth', pet.dateOfBirth ? fmt(pet.dateOfBirth) : '—'],
                ['Color / Markings', pet.color ?? '—'],
                ['Microchip ID', pet.microchipId ?? '—'],
              ].map(([label, value]) => (
                <tr key={label}>
                  <td className="py-1 pr-3 text-slate-500 dark:text-slate-400 whitespace-nowrap font-medium text-xs w-28">{label}</td>
                  <td className="py-1 font-semibold text-dark dark:text-slate-100 text-xs">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Owner details */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3 border-b border-slate-200 dark:border-slate-700 pb-1">Owner Details</p>
          <table className="w-full text-sm">
            <tbody>
              {[
                ['Owner Name', pet.customer?.customerName ?? '—'],
                ['Phone', pet.customer?.phone ?? '—'],
              ].map(([label, value]) => (
                <tr key={label}>
                  <td className="py-1 pr-3 text-slate-500 dark:text-slate-400 whitespace-nowrap font-medium text-xs w-28">{label}</td>
                  <td className="py-1 font-semibold text-dark dark:text-slate-100 text-xs">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3 border-b border-slate-200 dark:border-slate-700 pb-1 mt-5">Vaccine Details</p>
          <table className="w-full text-sm">
            <tbody>
              {[
                ['Vaccine', record.vaccineName],
                ['Type', record.vaccineType ?? '—'],
                ['Manufacturer', record.manufacturer ?? '—'],
                ['Batch Number', record.batchNumber ?? '—'],
                ['Date Administered', fmt(record.administeredAt)],
                ['Next Due Date', record.nextDueDate ? fmt(record.nextDueDate) : '—'],
                ['Administered By', record.administeredBy ?? '—'],
              ].map(([label, value]) => (
                <tr key={label}>
                  <td className="py-1 pr-3 text-slate-500 dark:text-slate-400 whitespace-nowrap font-medium text-xs w-28">{label}</td>
                  <td className="py-1 font-semibold text-dark dark:text-slate-100 text-xs">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Notes */}
      {record.notes && (
        <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 mb-8 bg-slate-50 dark:bg-slate-800">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Notes</p>
          <p className="text-xs text-slate-700 dark:text-slate-300">{record.notes}</p>
        </div>
      )}

      {/* Signature section */}
      <div className="grid grid-cols-2 gap-16 mt-12 pt-8 border-t border-slate-200 dark:border-slate-700">
        <div className="text-center">
          <div className="border-b border-dark h-8 mb-2" />
          <p className="text-xs text-slate-500 dark:text-slate-400">Veterinarian Signature</p>
          {record.administeredBy && <p className="text-xs font-semibold text-dark dark:text-slate-100 mt-0.5">{record.administeredBy}</p>}
        </div>
        <div className="text-center">
          <div className="border-b border-dark h-8 mb-2" />
          <p className="text-xs text-slate-500 dark:text-slate-400">Clinic Stamp</p>
        </div>
      </div>

      {/* Clinical disclaimer */}
      <div className="mt-8 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
        <p className="text-[8px] text-slate-500 dark:text-slate-400 leading-relaxed">
          <strong>Disclaimer:</strong> This document was generated by Sarang Business OS Lite, a convenience tool.
          It is NOT a validated medical record, prescription, or clinical report. All content was entered by the
          practitioner. Verify all information before clinical use.
        </p>
      </div>

      {/* Footer */}
      <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
        <p className="text-[9px] text-slate-400">
          Certificate issued on {fmt(new Date().toISOString())} · {profile?.businessName ?? 'Veterinary Clinic'}
        </p>
        <p className="text-[9px] text-slate-300 mt-0.5 inline-flex items-center gap-1">
          Generated by Sarang Business OS Lite | Aszurex <AszurexMark width={10} /> | www.aszurex.com
        </p>
      </div>
    </div>
  )
}
