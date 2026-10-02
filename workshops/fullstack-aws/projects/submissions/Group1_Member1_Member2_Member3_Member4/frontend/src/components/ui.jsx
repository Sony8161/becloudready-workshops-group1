// Small shared UI pieces.
import { cloneElement, isValidElement, useEffect, useId, useRef } from 'react'
import { STATUS, initials } from '../lib/format'

export function Badge({ value, label }) {
  const s = STATUS[value] || { label: value, tone: 'muted' }
  return <span className={`badge badge-${s.tone}`}>{label || s.label}</span>
}

export function Progress({ value, size = 'md', tone }) {
  const v = Math.max(0, Math.min(100, value || 0))
  const t = tone || (v >= 100 ? 'good' : 'brand')
  return (
    <div className={`progress progress-${size}`} role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}>
      <div className={`progress-fill fill-${t}`} style={{ width: `${v}%` }} />
    </div>
  )
}

export function Avatar({ name, size = 32 }) {
  // Stable colour from the name.
  let h = 0
  for (const ch of name || '') h = (h * 31 + ch.charCodeAt(0)) % 360
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.4, '--hue': h }} aria-hidden="true">
      {initials(name)}
    </span>
  )
}

export function EmptyState({ title, children, action }) {
  return (
    <div className="empty">
      <div className="empty-title">{title}</div>
      {children && <div className="empty-body">{children}</div>}
      {action}
    </div>
  )
}

export function ErrorBox({ error, onRetry }) {
  if (!error) return null
  return (
    <div className="alert alert-bad" role="alert">
      <span>{error.message || String(error)}</span>
      {onRetry && <button className="btn btn-sm" onClick={onRetry}>Try again</button>}
    </div>
  )
}

export function Modal({ title, onClose, children, footer, wide }) {
  const ref = useRef(null)
  useEffect(() => {
    const prev = document.activeElement
    const first = ref.current?.querySelector('input, select, textarea, button:not(.modal-x)')
    first?.focus()
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    document.body.classList.add('no-scroll')
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.classList.remove('no-scroll')
      prev?.focus?.()
    }
  }, [onClose])
  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="modal-x" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

export function Stat({ label, value, hint, tone, onClick }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag className={`stat ${tone ? `stat-${tone}` : ''} ${onClick ? 'stat-click' : ''}`} onClick={onClick}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </Tag>
  )
}

const FORM_TAGS = ['input', 'select', 'textarea']

// Label + control + hint/error. A plain input/select/textarea gets a real <label for>, and the
// hint is linked with aria-describedby, so the control's accessible name is just the label.
export function Field({ label, hint, error, children }) {
  const id = useId()
  const note = error || hint
  const noteEl = note && <span id={`${id}-note`} className={error ? 'field-error' : 'field-hint'}>{note}</span>
  if (isValidElement(children) && FORM_TAGS.includes(children.type)) {
    const control = cloneElement(children, {
      id: children.props.id || id,
      'aria-describedby': note ? `${id}-note` : undefined,
      'aria-invalid': error ? true : undefined,
    })
    return (
      <div className="field">
        <label className="field-label" htmlFor={children.props.id || id}>{label}</label>
        {control}
        {noteEl}
      </div>
    )
  }
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      {children}
      {noteEl}
    </div>
  )
}

export function PageHead({ title, subtitle, actions }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  )
}
