import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import AuthCard from '../components/AuthCard.jsx'
import ButtonSpinner from '../components/ButtonSpinner.jsx'
import PasswordInput from '../components/PasswordInput.jsx'
import PasswordStrength from '../components/PasswordStrength.jsx'
import { errorMessage } from '../services/api.js'
import { resetPassword } from '../services/authService.js'
import { passwordError } from '../utils/password.js'

// The page the emailed link opens: /reset-password?token=...
// The token goes back to the server with the new password; the server checks it's real,
// unused and under 15 minutes old.
export default function ResetPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    const problem = passwordError(password)
    if (problem) return setError(problem)
    if (password !== confirm) return setError('The passwords do not match.')
    setError('')
    setBusy(true)
    try {
      const message = await resetPassword(token, password) // POST /api/auth/reset-password
      navigate('/login', { replace: true, state: { message } }) // the login page shows the green message
    } catch (err) {
      setError(errorMessage(err)) // "This reset link is invalid or has expired. Ask for a new one."
      setBusy(false)
    }
  }

  if (token.length < 20) {
    return (
      <AuthCard sideTitle="Reset your password" sideText="This page needs the link from your email.">
        <h2>This link is incomplete</h2>
        <p className="muted">Open the whole link from the email, or ask for a new one.</p>
        <Link className="btn btn-primary btn-block" to="/forgot-password">Ask for a new link</Link>
      </AuthCard>
    )
  }

  return (
    <AuthCard sideTitle="Choose a new password" sideText="Pick something you don't use anywhere else. Saving it signs you out on every device.">
      <form onSubmit={handleSubmit} noValidate>
        <h2>New password</h2>
        {error && (
          <div className="alert alert-error" role="alert">
            <span>{error}</span>
            {error.includes('expired') && <Link to="/forgot-password">New link</Link>}
          </div>
        )}
        <PasswordInput label="New password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" autoFocus>
          <PasswordStrength password={password} />
        </PasswordInput>
        <PasswordInput label="Confirm new password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
        <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
          {busy && <ButtonSpinner />}{busy ? 'Saving...' : 'Save new password'}
        </button>
        <p className="auth-links"><Link to="/login">Back to sign in</Link></p>
      </form>
    </AuthCard>
  )
}
