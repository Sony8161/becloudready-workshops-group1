import { useState } from 'react'
import { Link } from 'react-router-dom'
import AuthCard from '../components/AuthCard.jsx'
import ButtonSpinner from '../components/ButtonSpinner.jsx'
import DevMailHint from '../components/DevMailHint.jsx'
import Icon from '../components/Icon.jsx'
import { errorMessage } from '../services/api.js'
import { forgotPassword } from '../services/authService.js'

// "Forgot password": we email a one-time reset link that works for 15 minutes.
// The server stores only a HASH of the link's code, so a database leak can't be used to reset passwords.
export default function ForgotPasswordPage() {
  const [value, setValue] = useState('')
  const [sent, setSent] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    if (value.trim().length < 3) return setError('Enter your username or email.')
    setError('')
    setBusy(true)
    try {
      setSent(await forgotPassword(value.trim())) // POST /api/auth/forgot-password
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthCard sideTitle="Reset your password" sideText="We'll email a link to the address on your account. It works once, for 15 minutes."
      sideExtra={<ul className="check-list">
        <li><Icon name="check" size={16} /> Asking again cancels the older link</li>
        <li><Icon name="check" size={16} /> Resetting signs out every device</li>
        <li><Icon name="check" size={16} /> It also ends a lockout</li>
      </ul>}>
      {sent ? (
        <div className="done-panel">
          <span className="done-icon"><Icon name="mail" size={26} /></span>
          <h2>Check your email</h2>
          <p className="muted">{sent}</p>
          <DevMailHint />
          <Link className="btn btn-primary btn-block" to="/login">Back to sign in</Link>
          <p className="auth-links"><button type="button" className="link-btn" onClick={() => setSent('')}>Send another link</button></p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <h2>Forgot password</h2>
          {error && <div className="alert alert-error" role="alert">{error}</div>}
          <label className="field">
            <span>Username or email</span>
            <input value={value} onChange={(e) => setValue(e.target.value)} autoComplete="username" autoFocus />
          </label>
          <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
            {busy && <ButtonSpinner />}{busy ? 'Sending...' : 'Email me a reset link'}
          </button>
          <p className="auth-links"><Link to="/login">Back to sign in</Link> · <Link to="/forgot-username">Forgot username</Link></p>
        </form>
      )}
    </AuthCard>
  )
}
