import { useEffect, useRef } from 'react'

// Ctrl+Enter (or Cmd+Enter) submits the open form, so entry can stay on the keyboard.
export function useSubmitShortcut(active: boolean, submit: () => void): void {
  const latest = useRef(submit)
  latest.current = submit
  useEffect(() => {
    if (!active) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !e.repeat) {
        e.preventDefault()
        latest.current()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [active])
}
