import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export function AppDropdown({ ariaLabel, disabled, options, placeholder, value, onChange }) {
  const [open, setOpen] = useState(false)
  const [menuStyle, setMenuStyle] = useState(null)
  const dropdownRef = useRef(null)
  const triggerRef = useRef(null)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined

    const closeOnOutsideClick = (event) => {
      if (!dropdownRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) setOpen(false)
    }
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  useEffect(() => {
    if (disabled) setOpen(false)
  }, [disabled])

  useLayoutEffect(() => {
    if (!open) return undefined

    const positionMenu = () => {
      const trigger = triggerRef.current?.getBoundingClientRect()
      const menu = menuRef.current
      if (!trigger || !menu) return
      const gap = 4
      const edge = 8
      const spaceBelow = window.innerHeight - trigger.bottom - edge - gap
      const spaceAbove = trigger.top - edge - gap
      const fullHeight = Math.ceil(menu.scrollHeight + menu.offsetHeight - menu.clientHeight)
      const openAbove = spaceBelow < fullHeight && spaceAbove > spaceBelow
      const available = Math.max(0, openAbove ? spaceAbove : spaceBelow)
      const height = Math.min(fullHeight, 270, available)
      setMenuStyle({
        position: 'fixed',
        top: openAbove ? trigger.top - height - gap : trigger.bottom + gap,
        left: trigger.left,
        right: 'auto',
        width: trigger.width,
        maxHeight: height,
        overflowY: height < fullHeight ? 'auto' : 'hidden',
        visibility: 'visible',
      })
    }

    positionMenu()
    window.addEventListener('resize', positionMenu)
    window.addEventListener('scroll', positionMenu, true)
    return () => {
      window.removeEventListener('resize', positionMenu)
      window.removeEventListener('scroll', positionMenu, true)
    }
  }, [open, options.length])

  useEffect(() => {
    if (!open) return undefined
    const frameId = window.requestAnimationFrame(() => {
      const selected = menuRef.current?.querySelector('[aria-selected="true"]')
      const first = menuRef.current?.querySelector('[role="option"]')
      ;(selected || first)?.focus()
    })
    return () => window.cancelAnimationFrame(frameId)
  }, [open])

  const handleMenuKeyDown = (event) => {
    const choices = [...(menuRef.current?.querySelectorAll('[role="option"]') || [])]
    const currentIndex = choices.indexOf(document.activeElement)
    let nextIndex = currentIndex
    if (event.key === 'ArrowDown') nextIndex = Math.min(choices.length - 1, currentIndex + 1)
    else if (event.key === 'ArrowUp') nextIndex = Math.max(0, currentIndex - 1)
    else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = choices.length - 1
    else if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
      triggerRef.current?.focus()
      return
    } else return
    event.preventDefault()
    choices[nextIndex]?.focus()
  }

  return (
    <div className={`settings-select${open ? ' settings-select--open' : ''}`} ref={dropdownRef}>
      <button
        ref={triggerRef}
        className="settings-select__trigger"
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            setOpen(true)
          }
        }}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{options.find((option) => String(option.value) === String(value))?.label || placeholder}</span>
        <span className="settings-select__chevron" aria-hidden="true" />
      </button>
      {open && createPortal(
        <div ref={menuRef} className="settings-select__menu" style={menuStyle || { position: 'fixed', visibility: 'hidden' }} role="listbox" aria-label={ariaLabel} onKeyDown={handleMenuKeyDown}>
          {options.map((option) => (
            <button
              className={`settings-select__option${String(option.value) === String(value) ? ' settings-select__option--selected' : ''}`}
              type="button"
              role="option"
              aria-selected={String(option.value) === String(value)}
              key={option.value}
              onClick={() => {
                onChange(option.value)
                setOpen(false)
              }}
            >
              {option.label}
            </button>
          ))}
        </div>, document.body,
      )}
    </div>
  )
}
