import { useEffect, useId, useRef } from 'react'
import Icon from './Icon.jsx'

// A panel that slides in from the right, over the page. Used for receipts and customer details:
// you see the detail WITHOUT leaving the one-page view, and closing it puts you back where you were.
// Closes with Escape, the X, or a click on the dark backdrop.
export default function Drawer({ title, subtitle, onClose, children, wide = false }) {
  const titleId = useId()
  const panelRef = useRef(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose // always the latest onClose, without re-running the effect below

  // Runs ONCE when the drawer opens (and its cleanup once when it closes).
  useEffect(() => {
    const previous = document.activeElement
    panelRef.current?.focus() // keyboard and screen-reader users start inside the drawer
    function onKey(event) {
      if (event.key === 'Escape') closeRef.current()
    }
    window.addEventListener('keydown', onKey)
    document.body.classList.add('no-scroll') // the page behind stays still
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.classList.remove('no-scroll')
      previous?.focus?.() // back to the row they clicked
    }
  }, [])

  return (
    <div className="overlay drawer-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside ref={panelRef} tabIndex={-1} className={`drawer ${wide ? 'drawer-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="drawer-head">
          <div>
            <h2 id={titleId}>{title}</h2>
            {subtitle && <p className="muted">{subtitle}</p>}
          </div>
          <button type="button" className="icon-btn square" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        </div>
        <div className="drawer-body">{children}</div>
      </aside>
    </div>
  )
}
