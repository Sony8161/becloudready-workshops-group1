import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { Avatar, Badge } from './ui'
import NotificationBell from './NotificationBell'

const STAFF_NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z' },
  { to: '/trainees', label: 'Trainees', icon: 'M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5C15 14.17 10.33 13 8 13zm8 0c-.29 0-.62.02-.97.05C16.19 13.89 17 15.02 17 16.5V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z' },
  { to: '/cohorts', label: 'Cohorts', icon: 'M12 2 1 7l11 5 9-4.09V17h2V7L12 2zm-7 11.18v4L12 21l7-3.82v-4L12 17l-7-3.82z' },
  { to: '/plans', label: 'Training plans', icon: 'M19 3h-4.18C14.4 1.84 13.3 1 12 1s-2.4.84-2.82 2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm-7 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm-2 14-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z' },
  { to: '/notices', label: 'Notices', icon: 'M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z' },
  { to: '/reports', label: 'Progress reports', icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM8 18v-5h2v5H8zm3 0v-8h2v8h-2zm3 0v-3h2v3h-2zM13 9V3.5L18.5 9H13z' },
]

const TRAINEE_NAV = [
  { to: '/me', label: 'My home', icon: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z', end: true },
  { to: '/me/notices', label: 'Notices', icon: 'M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z' },
  { to: '/me/reports', label: 'My reports', icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM8 18v-5h2v5H8zm3 0v-8h2v8h-2zm3 0v-3h2v3h-2zM13 9V3.5L18.5 9H13z' },
]

function useTheme() {
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('nbt.theme') || 'system' } catch { return 'system' }
  })
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', theme)
    try { localStorage.setItem('nbt.theme', theme) } catch { /* ignore */ }
  }, [theme])
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches)
  return [dark, () => setTheme(dark ? 'light' : 'dark')]
}

export default function Layout() {
  const { user, signOut } = useAuth()
  const [dark, toggleTheme] = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const nav = user.role === 'TRAINEE' ? TRAINEE_NAV : STAFF_NAV

  useEffect(() => setMenuOpen(false), [location.pathname])

  return (
    <div className={`shell ${menuOpen ? 'menu-open' : ''}`}>
      <aside className="sidebar">
        <div className="brand">
          <img src="/favicon.svg" alt="" width="28" height="28" />
          <span>NoticeBoard<b>Tracker</b></span>
        </div>
        <nav aria-label="Main">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className="nav-link">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={n.icon} /></svg>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="me">
            <Avatar name={user.name} size={34} />
            <div className="me-text">
              <div className="me-name">{user.name}</div>
              <Badge value={user.role} />
            </div>
          </div>
          <button className="btn btn-ghost btn-block" onClick={() => navigate('/change-password')}>Change password</button>
          <button className="btn btn-ghost btn-block" onClick={signOut}>Sign out</button>
        </div>
      </aside>
      <div className="scrim" onClick={() => setMenuOpen(false)} />
      <div className="main">
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setMenuOpen((o) => !o)} aria-label="Menu">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z" /></svg>
          </button>
          <div className="topbar-spacer" />
          <button className="icon-btn" onClick={toggleTheme} aria-label={dark ? 'Use light mode' : 'Use dark mode'} title="Theme">
            {dark ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
            )}
          </button>
          <NotificationBell />
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
