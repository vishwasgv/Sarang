import type { CSSProperties } from 'react'
import iconMarkSrc from '@renderer/assets/branding/icon-mark.png'
import wordmarkSrc from '@renderer/assets/branding/wordmark-lockup.png'
import partnershipMarkSrc from '@renderer/assets/branding/partnership-mark.png'

interface BrandImageProps {
  src: string
  alt: string
  size: number
  dimension: 'square' | 'width'
  className?: string
  decorative?: boolean
  inline?: boolean
}

function BrandImage({ src, alt, size, dimension, className = '', decorative = false, inline = false }: BrandImageProps) {
  const style: CSSProperties =
    dimension === 'square'
      ? { width: size, height: size, objectFit: 'contain' }
      : { width: size, height: 'auto', objectFit: 'contain' }
  if (inline) {
    style.display = 'inline-block'
    style.verticalAlign = 'middle'
  }
  return (
    <img
      src={src}
      alt={decorative ? '' : alt}
      aria-hidden={decorative || undefined}
      width={size}
      height={dimension === 'square' ? size : undefined}
      className={className}
      style={style}
    />
  )
}

interface BrandIconProps {
  size?: number
  className?: string
}

/** The Sarang "S" icon mark — for compact slots (sidebar, small headers, favicons). */
export function BrandIcon({ size = 36, className = '' }: BrandIconProps) {
  return <BrandImage src={iconMarkSrc} alt="Sarang" size={size} dimension="square" className={className} />
}

interface BrandWordmarkProps {
  width?: number
  className?: string
}

/** The full "sarang BUSINESS OS LITE" lockup — for hero moments with room to breathe.
 * DARK BACKGROUNDS ONLY: the wordmark text is rendered light/white in the source
 * asset (matching the splash screen's dark navy background) and washes out to
 * near-illegible on light backgrounds. On a light background, use BrandIcon +
 * regular CSS text instead (see Sidebar/LoginScreen/SetupWizard for the pattern) —
 * do not reach for this component there even though it reads as "the fuller logo." */
export function BrandWordmark({ width = 220, className = '' }: BrandWordmarkProps) {
  return (
    <BrandImage
      src={wordmarkSrc}
      alt="Sarang Business OS Lite — Your Business. Your Way."
      size={width}
      dimension="width"
      className={className}
    />
  )
}

interface AszurexMarkProps {
  width?: number
  className?: string
}

/** The Aszurex partnership mark — always placed to the right of existing
 * "Powered by Aszurex" / "by Aszurex" text, never replacing that text. */
export function AszurexMark({ width = 20, className = '' }: AszurexMarkProps) {
  return (
    <BrandImage
      src={partnershipMarkSrc}
      alt=""
      size={width}
      dimension="width"
      className={className}
      decorative
      inline
    />
  )
}
