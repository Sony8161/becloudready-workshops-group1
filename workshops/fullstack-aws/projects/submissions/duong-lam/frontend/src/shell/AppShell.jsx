import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'
import Icon from '../components/Icon.jsx'
import Logo from '../components/Logo.jsx'
import TopLoader from '../components/TopLoader.jsx'
import ThemeToggle from '../theme/ThemeToggle.jsx'
import { getTheme, toggleTheme } from '../theme/theme.js'
import { initials } from '../utils/format.js'
import CommandPalette from './CommandPalette.jsx'
import { ShellContext } from './ShellContext.jsx'
import SessionWarning from './SessionWarning.jsx'

// The frame around the signed-in ONE-PAGE screens (/app for customers, /admin for staff):
// a top bar with the logo, the Ctrl+K search, alerts, light/dark, and who is signed in.
// The page itself goes in <Outlet />.
export default function AppShell() {
  const { user, logout } = useAuth()
  const isAdmin = user.role === 'ADMIN'
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [info, setInfo] = useState({}) // set by the page: { displayName, alert }
  const commandsRef = useRef(null) // set by the page: what Ctrl+K can find there

  // Ctrl+K (Cmd+K on a Mac) opens the palette from anywhere. "/" too, unless you're typing in a box.
  useEffect(() => {
    function onKey(event) {
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)
      if ((event.key === 'k' || event.key === 'K') && (event.ctrlKey || event.metaKey)) {
        event.preventDefault()
        setPaletteOpen((open) => !open)
      } else if (event.key === '/' && !typing) {
        event.preventDefault()
        setPaletteOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // useCallback/useMemo keep these the SAME objects between renders, so the palette doesn't redo work.
  const getItems = useCallback((query) => commandsRef.current?.(query) ?? [], [])
  const builtIns = useMemo(() => [
    { id: 'theme', label: getTheme() === 'dark' ? 'Switch to light mode' : 'Switch to dark mode', icon: getTheme() === 'dark' ? 'sun' : 'moon', keywords: 'theme dark light mode', run: toggleTheme },
    { id: 'signout', label: 'Sign out', icon: 'logout', keywords: 'log out logout exit', run: () => logout('manual') },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [logout, paletteOpen])

  const shell = useMemo(() => ({ commandsRef, setInfo, openPalette: () => setPaletteOpen(true) }), [])
  const name = info.displayName || user.username
  const alert = info.alert

  return (
    <ShellContext.Provider value={shell}>
      <div className="shell">
        <TopLoader />
        <a className="skip-link" href="#main">Skip to content</a>
        <header className="topbar">
          <Logo to={isAdmin ? '/admin' : '/app'} />
          {isAdmin && <span className="staff-tag">Staff</span>}
          <button type="button" className="search-btn" onClick={() => setPaletteOpen(true)}
            aria-label="Search or jump to (Ctrl K)" aria-keyshortcuts="Control+K">
            <Icon name="search" />
            <span className="search-text">{isAdmin ? 'Find a customer or action' : 'Search or type “deposit 50”'}</span>
            <kbd>Ctrl K</kbd>
          </button>
          <div className="topbar-right">
            {alert && (
              <button type="button" className="icon-btn square bell" onClick={alert.onClick} aria-label={alert.label} title={alert.label}>
                <Icon name="bell" size={20} />
                {alert.count > 0 && <span className="bell-count">{alert.count > 99 ? '99+' : alert.count}</span>}
              </button>
            )}
            <ThemeToggle compact />
            <div className="who">
              <span className="avatar" aria-hidden="true">{initials(name)}</span>
              <span className="who-text">
                <strong>{name}</strong>
                <small>{isAdmin ? 'Administrator' : 'Customer'}</small>
              </span>
            </div>
            <button type="button" className="icon-btn square" onClick={() => logout('manual')} aria-label="Sign out" title="Sign out">
              <Icon name="logout" size={20} />
            </button>
          </div>
        </header>

        <main id="main" className="shell-main">
          {/* lazy pages show this spinner while their code downloads */}
          <Suspense fallback={<div className="spinner-wrap"><span className="spinner" /> Loading...</div>}>
            <Outlet />
          </Suspense>
        </main>

        <SessionWarning />

        {paletteOpen && (
          <CommandPalette getItems={getItems} builtIns={builtIns} onClose={() => setPaletteOpen(false)}
            placeholder={isAdmin ? 'Try: jane, premium, lockouts, export' : 'Try: deposit 50, statement, dark mode'} />
        )}
      </div>
    </ShellContext.Provider>
  )
}
