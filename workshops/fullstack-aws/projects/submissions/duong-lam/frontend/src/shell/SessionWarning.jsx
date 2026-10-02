import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthContext.jsx'
import { getToken, tokenExpiry } from '../auth/session.js'
import ButtonSpinner from '../components/ButtonSpinner.jsx'
import Icon from '../components/Icon.jsx'
import { refreshSession } from '../services/authService.js'
import { useToast } from './ToastContext.jsx'

const WARN_MS = 2 * 60 * 1000 // show the warning 2 minutes before the token runs out

// "You'll be signed out in 1:59 — Stay signed in?" Instead of a sudden sign-out mid-task.
// Stay signed in = POST /api/auth/refresh for a new token (only works while the old one is still valid).
export default function SessionWarning() {
  const { user, logout, replaceSession } = useAuth()
  const toast = useToast()
  const [now, setNow] = useState(Date.now())
  const [busy, setBusy] = useState(false)
  const stayRef = useRef(null)

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const left = tokenExpiry(getToken()) - now
  const show = !!user && left > 0 && left <= WARN_MS

  useEffect(() => {
    if (show) stayRef.current?.focus()
  }, [show])

  if (!show) return null
  const seconds = Math.ceil(left / 1000)
  const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

  async function stay() {
    setBusy(true)
    try {
      replaceSession(await refreshSession())
      toast("You're still signed in.")
    } catch {
      logout('expired')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="overlay center-overlay">
      <div className="session-box" role="alertdialog" aria-modal="true" aria-labelledby="session-title" aria-describedby="session-text">
        <span className="session-icon"><Icon name="clock" size={26} /></span>
        <h2 id="session-title">Still there?</h2>
        <p id="session-text">For your security you'll be signed out in <strong className="mono">{clock}</strong>.</p>
        <div className="two-buttons">
          <button type="button" className="btn btn-outline" onClick={() => logout('manual')}>Sign out</button>
          <button ref={stayRef} type="button" className="btn btn-primary" onClick={stay} disabled={busy}>
            {busy && <ButtonSpinner />}Stay signed in
          </button>
        </div>
      </div>
    </div>
  )
}
