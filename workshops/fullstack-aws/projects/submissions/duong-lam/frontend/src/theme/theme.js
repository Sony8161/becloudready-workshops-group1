// The light/dark setting in ONE place, so the toggle button and the Ctrl+K command stay in sync.
// index.html already set <html data-theme> before React started (no flash of the wrong colours).
const KEY = 'sb_theme'

export function getTheme() {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

export function setTheme(next) {
  document.documentElement.dataset.theme = next // index.css swaps every colour token at once
  try {
    localStorage.setItem(KEY, next) // remembered for the next visit
  } catch {
    // private window or blocked storage: it still switches, it just isn't remembered
  }
  window.dispatchEvent(new CustomEvent('theme:change', { detail: next })) // tell every toggle button
}

export function toggleTheme() {
  setTheme(getTheme() === 'dark' ? 'light' : 'dark')
}
