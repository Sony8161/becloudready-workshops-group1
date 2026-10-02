import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { homeFor, useAuth } from '../auth/AuthContext'
import { ErrorBox, Field } from '../components/ui'
import { useToast } from '../components/Toast'
import Spinner from '../components/Spinner'

export function passwordProblem(pw) {
  if (pw.length < 8) return 'At least 8 characters'
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return 'Use a letter and a number'
  return null
}

export default function ChangePasswordPage() {
  const { user, changePassword, signOut } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  if (!user) return <Navigate to="/login" replace />
  const forced = user.must_change_password
  const problem = next ? passwordProblem(next) : null
  const mismatch = confirm && next !== confirm

  const submit = async (e) => {
    e.preventDefault()
    if (problem || mismatch) return
    setBusy(true)
    setError(null)
    try {
      const u = await changePassword(current, next)
      toast('Password updated. Other sessions were signed out.')
      navigate(homeFor(u), { replace: true })
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="center-page">
      <form className="auth-card" onSubmit={submit}>
        <h1>{forced ? 'Set your password' : 'Change password'}</h1>
        <p className="muted">
          {forced ? `Welcome, ${user.name.split(' ')[0]}. Replace the temporary password HR gave you.` : 'This signs you out on other devices.'}
        </p>
        <ErrorBox error={error} />
        <Field label={forced ? 'Temporary password' : 'Current password'}>
          <input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
        </Field>
        <Field label="New password" error={problem} hint="8+ characters with a letter and a number">
          <input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required />
        </Field>
        <Field label="Confirm new password" error={mismatch ? "Passwords don't match" : null}>
          <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        </Field>
        <button className="btn btn-primary btn-block" disabled={busy || !current || !next || !!problem || next !== confirm}>
          {busy ? <Spinner inline label="Saving" /> : 'Save password'}
        </button>
        {forced
          ? <button type="button" className="btn btn-ghost btn-block" onClick={signOut}>Sign out</button>
          : <button type="button" className="btn btn-ghost btn-block" onClick={() => navigate(-1)}>Cancel</button>}
      </form>
    </div>
  )
}
