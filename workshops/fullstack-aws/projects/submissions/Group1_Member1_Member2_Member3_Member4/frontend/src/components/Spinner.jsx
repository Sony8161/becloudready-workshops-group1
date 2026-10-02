export default function Spinner({ label = 'Loading', inline }) {
  return (
    <span className={inline ? 'spinner-inline' : 'spinner-wrap'} role="status">
      <span className="spinner" aria-hidden="true" />
      {!inline && <span className="muted">{label}…</span>}
      {inline && <span className="sr-only">{label}</span>}
    </span>
  )
}
