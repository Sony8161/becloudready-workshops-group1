import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { homeFor, useAuth } from '../auth/AuthContext.jsx'
import { errorMessage } from '../services/api.js'
import ButtonSpinner from '../components/ButtonSpinner.jsx'
import PasswordInput from '../components/PasswordInput.jsx'
import PasswordStrength from '../components/PasswordStrength.jsx'
import { passwordError } from '../utils/password.js'

const EMPTY = { name: '', email: '', username: '', password: '', confirm: '' }

// Online sign-up: creates a new customer AND their login, then signs them straight in.
export default function RegisterPage() {
  const { user, register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (user) return <Navigate to={homeFor(user)} replace />

  // One change handler for every input: the input's `name` says which field to update.
  function handleChange(event) {
    setForm({ ...form, [event.target.name]: event.target.value })
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (Object.values(form).some((value) => value.trim() === '')) {
      setError('Please fill in every field.')
      return
    }
    // same rules as the backend (RegisterIn in models.py)
    if (passwordError(form.password)) {
      setError(`Password: ${passwordError(form.password)}`)
      return
    }
    if (!/^[A-Za-z0-9_.-]{3,30}$/.test(form.username)) {
      setError('Username: 3 to 30 letters, numbers, dots, dashes or underscores.')
      return
    }
    if (form.password !== form.confirm) {
      setError('Passwords do not match.')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      const { confirm, ...data } = form // confirm is only for the browser; don't send it
      await register(data)
      navigate('/app', { replace: true })
    } catch (err) {
      setError(errorMessage(err))
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-side">
          <h2>Open an account</h2>
          <p>It takes about a minute. Once you're in, open a checking or savings account from your overview.</p>
        </div>
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <h2>Your details</h2>
          {error && <div className="alert alert-error" role="alert">{error}</div>}
          <label className="field"><span>Full name</span>
            <input name="name" value={form.name} onChange={handleChange} autoComplete="name" />
          </label>
          <label className="field"><span>Email</span>
            <input name="email" type="email" value={form.email} onChange={handleChange} autoComplete="email" />
          </label>
          <label className="field"><span>Username</span>
            <input name="username" value={form.username} onChange={handleChange} autoComplete="username" />
          </label>
          <PasswordInput name="password" value={form.password} onChange={handleChange} autoComplete="new-password">
            <PasswordStrength password={form.password} />
          </PasswordInput>
          <PasswordInput label="Confirm password" name="confirm" value={form.confirm} onChange={handleChange} autoComplete="new-password" />
          <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
            {submitting && <ButtonSpinner />}
            {submitting ? 'Creating your account...' : 'Create account'}
          </button>
          <p className="auth-switch">Already a customer? <Link to="/login">Sign in</Link></p>
        </form>
      </div>
    </div>
  )
}
