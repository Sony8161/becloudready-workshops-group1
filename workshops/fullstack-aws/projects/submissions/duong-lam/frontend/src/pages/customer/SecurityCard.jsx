import { useEffect, useState } from 'react'
import { useAuth } from '../../auth/AuthContext.jsx'
import { getToken, tokenExpiry } from '../../auth/session.js'
import ButtonSpinner from '../../components/ButtonSpinner.jsx'
import Icon from '../../components/Icon.jsx'
import PasswordInput from '../../components/PasswordInput.jsx'
import PasswordStrength from '../../components/PasswordStrength.jsx'
import { changePassword, signOutEverywhere } from '../../services/authService.js'
import { errorMessage } from '../../services/api.js'
import { useToast } from '../../shell/ToastContext.jsx'
import { shortTime, whenText } from '../../utils/format.js'
import { passwordError } from '../../utils/password.js'
import { EVENT_INFO, problemsSinceLastVisit } from '../../utils/transactions.js'

// "Signs you out at 4:01 PM (in 52 minutes)", refreshed every 30 seconds.
function useSessionEnd() {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(timer)
  }, [])
  const ends = tokenExpiry(getToken())
  return { ends, minutes: Math.max(0, Math.round((ends - now) / 60000)) }
}

// Security: this sign-in and the one before, failed attempts, the session timer,
// change password, and "sign out on every device".
//   panel / setPanel   which form is open: 'password', 'signout' or null (the Ctrl+K palette can open them)
export default function SecurityCard({ events, panel, setPanel, onChanged }) {
  const { replaceSession } = useAuth()
  const toast = useToast()
  const { ends, minutes } = useSessionEnd()
  const signIns = events.filter((e) => e.type === 'LOGIN_SUCCESS')
  const problems = problemsSinceLastVisit(events)

  return (
    <section id="security" className="card" aria-labelledby="sec-title">
      <h2 id="sec-title">Security</h2>

      <div className="info-line">
        <span className="info-icon good"><Icon name="shield" /></span>
        <div>
          <strong>This sign-in</strong>
          <span>{signIns[0] ? `${whenText(signIns[0].timestamp)} from ${signIns[0].ip ?? 'unknown'}` : 'Just now'}</span>
          <span>{signIns[1] ? `Before that: ${whenText(signIns[1].timestamp)} from ${signIns[1].ip ?? 'unknown'}` : 'This is your first sign-in.'}</span>
        </div>
      </div>

      <div className="info-line">
        <span className="info-icon brand"><Icon name="clock" /></span>
        <div>
          <strong>Session</strong>
          <span>Signs you out automatically at {shortTime(new Date(ends).toISOString())} ({minutes} minute{minutes === 1 ? '' : 's'} left)</span>
        </div>
      </div>

      {problems.length > 0 && (
        <div className="info-line warn-box" role="alert">
          <span className="info-icon warn"><Icon name="alert" /></span>
          <div>
            <strong>{problems.length} failed sign-in{problems.length === 1 ? '' : 's'} since your last visit</strong>
            <span>Latest: {whenText(problems[0].timestamp)}. After 5 wrong passwords in a row the login locks for 15 minutes. Not you? Change your password.</span>
          </div>
        </div>
      )}

      {panel === 'password' ? (
        <ChangePasswordForm onCancel={() => setPanel(null)} onSaved={(session) => {
          replaceSession(session) // the old token stopped working; keep this browser signed in with the new one
          setPanel(null)
          toast('Password changed. Any other device was signed out.')
          onChanged()
        }} />
      ) : panel === 'signout' ? (
        <SignOutEverywhere onCancel={() => setPanel(null)} onDone={(session) => {
          replaceSession(session)
          setPanel(null)
          toast("Signed out on every other device. You're still signed in here.")
          onChanged()
        }} />
      ) : (
        <div className="two-buttons">
          <button type="button" className="btn btn-outline" onClick={() => setPanel('password')}><Icon name="key" size={16} />Change password</button>
          <button type="button" className="btn btn-outline" onClick={() => setPanel('signout')}><Icon name="logout" size={16} />Sign out everywhere</button>
        </div>
      )}

      {events.length > 0 && (
        <details className="recent-events">
          <summary>Recent security activity</summary>
          <ul>
            {events.slice(0, 6).map((e) => (
              <li key={e.id}>
                <span className={`badge badge-${EVENT_INFO[e.type]?.tone ?? 'info'}`}>{EVENT_INFO[e.type]?.label ?? e.type}</span>
                <span className="muted small">{whenText(e.timestamp)}{e.ip ? ` · ${e.ip}` : ''}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}

function ChangePasswordForm({ onCancel, onSaved }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    if (!current) return setError('Enter your current password.')
    const problem = passwordError(next)
    if (problem) return setError(`New password: ${problem}`)
    if (next !== confirm) return setError('The new passwords do not match.')
    if (next === current) return setError("Pick a password you haven't just used.")
    setError('')
    setBusy(true)
    try {
      onSaved(await changePassword(current, next)) // PUT /api/auth/me/password -> a fresh session
    } catch (err) {
      setError(errorMessage(err)) // e.g. "Your current password is not right"
      setBusy(false)
    }
  }

  return (
    <form className="sub-form" onSubmit={handleSubmit} noValidate aria-label="Change password">
      <PasswordInput label="Current password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" autoFocus />
      <PasswordInput label="New password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password">
        <PasswordStrength password={next} />
      </PasswordInput>
      <PasswordInput label="Confirm new password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
      <p className="muted small no-margin">Changing it signs out every other device.</p>
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      <div className="two-buttons">
        <button type="button" className="btn btn-outline" onClick={onCancel} disabled={busy}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy && <ButtonSpinner />}{busy ? 'Saving...' : 'Save password'}</button>
      </div>
    </form>
  )
}

function SignOutEverywhere({ onCancel, onDone }) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function go() {
    setBusy(true)
    try {
      onDone(await signOutEverywhere()) // POST /api/auth/me/sign-out-everywhere
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <div className="sub-form">
      <p className="no-margin"><strong>Sign out on every device?</strong> Phones, other browsers, a computer you forgot to sign out of: all of them have to sign in again. You stay signed in here.</p>
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      <div className="two-buttons">
        <button type="button" className="btn btn-outline" onClick={onCancel} disabled={busy}>Cancel</button>
        <button type="button" className="btn btn-primary" onClick={go} disabled={busy}>{busy && <ButtonSpinner />}Sign them out</button>
      </div>
    </div>
  )
}
