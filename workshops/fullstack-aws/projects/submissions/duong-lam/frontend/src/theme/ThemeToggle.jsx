import { useEffect, useState } from 'react'
import Icon from '../components/Icon.jsx'
import { getTheme, toggleTheme } from './theme.js'

// Light / dark switch. It only flips ONE attribute on <html> (see theme.js): index.css has a
// second set of colour tokens under [data-theme='dark'], so every card and button changes at once.
export default function ThemeToggle({ compact = false }) {
  const [theme, setThemeState] = useState(getTheme)
  const dark = theme === 'dark'

  // stay in sync when the theme changes somewhere else (the Ctrl+K palette, another toggle)
  useEffect(() => {
    const onChange = (event) => setThemeState(event.detail)
    window.addEventListener('theme:change', onChange)
    return () => window.removeEventListener('theme:change', onChange)
  }, [])

  return (
    <button type="button" className={`theme-toggle ${compact ? 'compact' : ''}`} onClick={toggleTheme}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} title={dark ? 'Light mode' : 'Dark mode'}>
      <Icon name={dark ? 'sun' : 'moon'} size={20} />
      {!compact && <span>{dark ? 'Light' : 'Dark'}</span>}
    </button>
  )
}
