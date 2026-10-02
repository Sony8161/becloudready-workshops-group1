import { useEffect, useState } from 'react'
import { errorMessage } from '../../services/api.js'
import { getSecurityEvents } from '../../services/auditService.js'
import { whenText } from '../../utils/format.js'
import { EVENT_INFO } from '../../utils/transactions.js'

const PAGE = 10

// The sign-in log: every login, wrong password, lockout, sign-up, reset and staff action.
// "Problems only" asks the SERVER for just the wrong passwords and lockouts.
export default function SignInLogCard({ problemsOnly, setProblemsOnly, refreshKey }) {
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [error, setError] = useState('')
  const [loadingMore, setLoadingMore] = useState(false)

  useEffect(() => {
    let cancelled = false
    getSecurityEvents({ limit: PAGE, skip: 0, problems: problemsOnly })
      .then((page) => {
        if (cancelled) return
        setRows(page.items)
        setTotal(page.total)
        setError('')
      })
      .catch((err) => !cancelled && setError(errorMessage(err)))
    return () => {
      cancelled = true
    }
  }, [problemsOnly, refreshKey])

  // "Load more" adds the next page under the rows already shown.
  async function loadMore() {
    setLoadingMore(true)
    try {
      const page = await getSecurityEvents({ limit: PAGE, skip: rows.length, problems: problemsOnly })
      setRows([...rows, ...page.items])
      setTotal(page.total)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <section id="signin-log" className="card" aria-labelledby="log-title">
      <div className="section-row">
        <div>
          <h2 id="log-title">Sign-in log</h2>
          <p className="muted small no-margin">Logins, wrong passwords, lockouts, resets and staff actions, newest first</p>
        </div>
        <button type="button" className={`chip-btn ${problemsOnly ? 'active' : ''}`} aria-pressed={problemsOnly}
          onClick={() => setProblemsOnly(!problemsOnly)}>Problems only</button>
      </div>
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><th>When</th><th>Event</th><th>Username</th><th>IP address</th><th>Detail</th></tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id}>
                <td className="nowrap">{whenText(e.timestamp)}</td>
                <td><span className={`badge badge-${EVENT_INFO[e.type]?.tone ?? 'info'}`}>{EVENT_INFO[e.type]?.label ?? e.type}</span></td>
                <td className="mono">{e.username}</td>
                <td className="mono muted">{e.ip ?? '-'}</td>
                <td className="muted">{e.detail ?? ''}</td>
              </tr>
            ))}
            {rows.length === 0 && !error && (
              <tr><td colSpan={5} className="muted center">{problemsOnly ? 'No problems. Nice.' : 'Nothing logged yet.'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="pager">
        <span className="muted small">Showing {rows.length} of {total.toLocaleString()}</span>
        {rows.length < total && (
          <button type="button" className="btn btn-outline btn-sm" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? 'Loading...' : 'Load more'}
          </button>
        )}
      </div>
    </section>
  )
}
