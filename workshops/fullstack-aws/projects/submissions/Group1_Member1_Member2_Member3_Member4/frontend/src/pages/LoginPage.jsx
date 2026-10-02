import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { homeFor, useAuth } from '../auth/AuthContext'
import { ErrorBox, Field } from '../components/ui'
import Spinner from '../components/Spinner'

const DEMO = [
  { label: 'HR', email: 'hr@noticeboard.dev', password: 'hrAdmin123' },
  { label: 'Manager', email: 'manager@noticeboard.dev', password: 'Demo1234' },
  { label: 'Trainee', email: 'ana@noticeboard.dev', password: 'Demo1234' },
]

export default function LoginPage() {
  const { user, signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to={homeFor(user)} replace />

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const u = await signIn(email.trim(), password)
      const from = location.state?.from
      const target = homeFor(u)
      const fits = from && !u.must_change_password &&
        (u.role === 'TRAINEE' ? from.startsWith('/me') : !from.startsWith('/me'))
      navigate(fits ? from : target, { replace: true })
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-art" aria-hidden="true">
        <div className="auth-art-inner">
          <img src="/favicon.svg" alt="" width="48" height="48" />
          <h2>One place for every trainee update.</h2>
          <ul>
            <li>HR onboards trainees once. No duplicate rows.</li>
            <li>Managers assign plans to cohorts or solo tracks.</li>
            <li>Trainees get notified and report progress here.</li>
            <li>The dashboard shows who is blocked or quiet.</li>
          </ul>
        </div>
      </div>
      <form className="auth-card" onSubmit={submit} noValidate>
        <h1>Sign in</h1>
        <p className="muted">NoticeBoardTracker</p>
        <ErrorBox error={error} />
        <Field label="Email">
          <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label="Password">
          <div className="input-group">
            <input type={show ? 'text' : 'password'} aria-label="Password" autoComplete="current-password" value={password}
              onChange={(e) => setPassword(e.target.value)} required />
            <button type="button" className="btn btn-ghost btn-sm" aria-pressed={show} onClick={() => setShow((s) => !s)}>
              {show ? 'Hide' : 'Show'}
            </button>
          </div>
        </Field>
        <button className="btn btn-primary btn-block" disabled={busy || !email || !password}>
          {busy ? <Spinner inline label="Signing in" /> : 'Sign in'}
        </button>
        <p className="muted small">Forgot your password? Ask HR to reset it.</p>
        {import.meta.env.DEV && (
          <div className="demo-box">
            <div className="small muted">Demo logins (local only)</div>
            <div className="demo-row">
              {DEMO.map((d) => (
                <button type="button" key={d.label} className="btn btn-sm"
                  onClick={() => { setEmail(d.email); setPassword(d.password) }}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </form>
    </div>
  )
}
