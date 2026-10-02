import { useState } from 'react'
import { Link } from 'react-router-dom'
import AuthCard from '../components/AuthCard.jsx'
import ButtonSpinner from '../components/ButtonSpinner.jsx'
import DevMailHint from '../components/DevMailHint.jsx'
import Icon from '../components/Icon.jsx'
import { errorMessage } from '../services/api.js'
import { forgotUsername } from '../services/authService.js'

// "Forgot username": type your email, and the username is emailed to you.
// The page says the SAME thing whether or not that email is on file: otherwise anyone could
// type emails here to find out who banks with us ("account enumeration").
export default function ForgotUsernamePage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setError('Enter the email address you signed up with.')
    setError('')
    setBusy(true)
    try {
      setSent(await forgotUsername(email.trim())) // POST /api/auth/forgot-username
    } catch (err) {
      setError(errorMessage(err)) // e.g. 429 "Too many requests..."
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthCard sideTitle="Forgot your username?" sideText="Tell us the email address on your account and we'll email your username to it.">
      {sent ? (
        <div className="done-panel">
          <span className="done-icon"><Icon name="mail" size={26} /></span>
          <h2>Check your email</h2>
          <p className="muted">{sent}</p>
          <DevMailHint />
          <Link className="btn btn-primary btn-block" to="/login">Back to sign in</Link>
          <p className="auth-links"><button type="button" className="link-btn" onClick={() => setSent('')}>Try a different email</button></p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <h2>Find my username</h2>
          {error && <div className="alert alert-error" role="alert">{error}</div>}
          <label className="field">
            <span>Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" autoFocus />
          </label>
          <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
            {busy && <ButtonSpinner />}{busy ? 'Sending...' : 'Email my username'}
          </button>
          <p className="auth-links">Remembered it? <Link to="/login">Sign in</Link> · <Link to="/forgot-password">Forgot password</Link></p>
        </form>
      )}
    </AuthCard>
  )
}
