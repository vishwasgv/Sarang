interface DocumentWatermarkProps {
  logoPath?: string | null
  enabled?: boolean | null
}

function fileUrl(p: string): string {
  return `file:///${p.replace(/\\/g, '/')}`
}

/**
 * Semi-transparent, centered, rotated logo behind in-app print content — opt-in via
 * BusinessProfile.enableDocumentWatermark. Mirrors print.service.ts's watermarkHtml()
 * (main-process HTML-string equivalent, for templates rendered outside this renderer).
 *
 * Caller's immediate ancestor must establish its own CSS stacking context (an explicit
 * z-index, not just position:relative/fixed with z-index:auto) or this z-index:-1 div
 * escapes past it and paints behind that ancestor's own background — i.e. invisible.
 */
export function DocumentWatermark({ logoPath, enabled }: DocumentWatermarkProps) {
  if (!enabled || !logoPath) return null
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: -1 }}>
      <img src={fileUrl(logoPath)} alt="" style={{ width: '60%', maxWidth: 400, objectFit: 'contain', opacity: 0.08, transform: 'rotate(-30deg)' }} />
    </div>
  )
}

export function documentLogoUrl(p: string): string {
  return fileUrl(p)
}
