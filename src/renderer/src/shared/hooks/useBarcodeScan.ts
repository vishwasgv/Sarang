import { useEffect, useRef } from 'react'

// Keyboard wedge barcode scanner hook — USB/Bluetooth scanners emulate a keyboard,
// sending the barcode as rapid keystrokes followed by Enter.
const SCAN_TIMEOUT_MS = 50
const MIN_BARCODE_LENGTH = 4

export function useBarcodeScan(
  onScan: (barcode: string) => void,
  enabled = true
): void {
  const bufferRef = useRef('')
  const lastKeyTimeRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!enabled) return

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        const now = Date.now()
        const elapsed = now - lastKeyTimeRef.current
        if (bufferRef.current.length >= MIN_BARCODE_LENGTH && elapsed < SCAN_TIMEOUT_MS * 6) {
          onScan(bufferRef.current)
        }
        bufferRef.current = ''
        return
      }

      if (e.key.length === 1) {
        const now = Date.now()
        const timeSinceLastKey = now - lastKeyTimeRef.current
        lastKeyTimeRef.current = now

        if (timeSinceLastKey > SCAN_TIMEOUT_MS * 5) {
          bufferRef.current = ''
        }

        bufferRef.current += e.key

        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => {
          bufferRef.current = ''
        }, 500)
      }
    }

    window.addEventListener('keydown', handleKeydown)
    return () => {
      window.removeEventListener('keydown', handleKeydown)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [onScan, enabled])
}
