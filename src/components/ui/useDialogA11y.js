import { useEffect, useRef } from 'react'

const focusableSelector = [
  'a[href]',
  'button:not(:disabled)',
  'input:not(:disabled)',
  'select:not(:disabled)',
  'textarea:not(:disabled)',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export function useDialogA11y(open, onClose, canClose = true) {
  const dialogRef = useRef(null)
  const onCloseRef = useRef(onClose)
  const canCloseRef = useRef(canClose)

  onCloseRef.current = onClose
  canCloseRef.current = canClose

  useEffect(() => {
    if (!open) return undefined

    const previouslyFocused = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const focusDialog = window.requestAnimationFrame(() => {
      const preferred = dialogRef.current?.querySelector('[autofocus]')
      const first = dialogRef.current?.querySelector(focusableSelector)
      ;(preferred || first || dialogRef.current)?.focus()
    })

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && canCloseRef.current) {
        event.preventDefault()
        onCloseRef.current?.()
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return

      const focusable = Array.from(dialogRef.current.querySelectorAll(focusableSelector))
        .filter((element) => !element.hidden && element.getAttribute('aria-hidden') !== 'true')
      if (focusable.length === 0) {
        event.preventDefault()
        dialogRef.current.focus()
        return
      }

      const first = focusable[0]
      const last = focusable.at(-1)
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      window.cancelAnimationFrame(focusDialog)
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) {
        window.requestAnimationFrame(() => previouslyFocused.focus())
      }
    }
  }, [open])

  return dialogRef
}
