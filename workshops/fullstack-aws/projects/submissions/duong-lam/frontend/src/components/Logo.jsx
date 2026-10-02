import { Link } from 'react-router-dom'

// The bank's mark: a little building with columns, drawn with SVG. `light` = for dark backgrounds.
export default function Logo({ to = '/', light = false }) {
  return (
    <Link to={to} className={`logo ${light ? 'logo-light' : ''}`}>
      <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="currentColor" opacity="0.14" />
        <path d="M6 13 16 7l10 6H6z" fill="currentColor" />
        <path d="M9 15h2.5v8H9zM14.75 15h2.5v8h-2.5zM20.5 15H23v8h-2.5zM7 24.5h18V26H7z" fill="currentColor" />
      </svg>
      <span>Simple Bank</span>
    </Link>
  )
}
