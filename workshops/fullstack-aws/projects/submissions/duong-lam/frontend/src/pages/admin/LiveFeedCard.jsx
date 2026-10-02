import { useCallback, useEffect, useState } from 'react'
import Icon from '../../components/Icon.jsx'
import Pager from '../../components/Pager.jsx'
import { errorMessage } from '../../services/api.js'
import { getTransactionsPage } from '../../services/auditService.js'
import { money, shortTime, whenText } from '../../utils/format.js'
import { describe, TYPE_CHIPS } from '../../utils/transactions.js'

const PAGE = 8
const AUTO_REFRESH_MS = 30000

// Live transactions: the audit trail, newest first, filtered and paged by the server.
// Refreshes itself every 30 seconds while the tab is visible, and right after any teller action.
//   customerFilter  { id, name } to show one customer's moves only (from their drawer), or null
export default function LiveFeedCard({ refreshKey, customerFilter, onClearCustomer, onOpenCustomer }) {
  const [type, setType] = useState('ALL')
  const [skip, setSkip] = useState(0)
  const [page, setPage] = useState({ items: [], total: 0 })
  const [updated, setUpdated] = useState(null)
  const [error, setError] = useState('')
  const customerId = customerFilter?.id

  useEffect(() => setSkip(0), [type, customerId])

  const load = useCallback(async () => {
    try {
      setPage(await getTransactionsPage({ limit: PAGE, skip, type, customerId }))
      setUpdated(new Date())
      setError('')
    } catch (err) {
      setError(errorMessage(err))
    }
  }, [skip, type, customerId])

  useEffect(() => {
    load()
  }, [load, refreshKey])

  // Polling: simple and good enough here. A real bank would PUSH new rows (WebSockets) instead.
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') load()
    }, AUTO_REFRESH_MS)
    return () => clearInterval(timer)
  }, [load])

  return (
    <section className="card" aria-labelledby="feed-title">
      <div className="section-row">
        <h2 id="feed-title">Live transactions</h2>
        <button type="button" className="live-pill" onClick={load} title="Refresh now">
          <span className="live-dot" aria-hidden="true" />
          {updated ? `Updated ${shortTime(updated.toISOString())}` : 'Loading...'}
          <Icon name="refresh" size={14} />
        </button>
      </div>
      <div className="chips" role="group" aria-label="Filter by type">
        {TYPE_CHIPS.map((c) => (
          <button key={c.value} type="button" className={`chip-btn ${type === c.value ? 'active' : ''}`}
            aria-pressed={type === c.value} onClick={() => setType(c.value)}>{c.label}</button>
        ))}
        {customerFilter && (
          <button type="button" className="chip-btn active" onClick={onClearCustomer} aria-label={`Stop filtering by ${customerFilter.name}`}>
            {customerFilter.name} <Icon name="x" size={14} />
          </button>
        )}
      </div>

      {error && <div className="alert alert-error" role="alert">{error}</div>}

      <div className="list">
        {page.items.map((t) => {
          const d = describe(t)
          return (
            <button key={t.id} type="button" className="list-row" onClick={() => onOpenCustomer(t.customerId)}
              title="Open this customer">
              <span className={`txn-icon ${t.type === 'DEPOSIT' ? 'in' : t.type === 'WITHDRAW' ? 'out' : 'move'}`}><Icon name={d.icon} size={18} /></span>
              <span className="list-text">
                <strong>{d.text}</strong>
                <small>#{t.id} · Customer {t.customerId} · {whenText(t.timestamp)}</small>
              </span>
              <span className="badge badge-off" title="Done by">{t.performedBy ?? '?'}</span>
              <span className="list-amount">{money(t.amount)}</span>
            </button>
          )
        })}
        {page.items.length === 0 && !error && <div className="empty-box">No transactions{type !== 'ALL' || customerFilter ? ' match' : ' yet'}.</div>}
      </div>
      <Pager skip={skip} limit={PAGE} total={page.total} onChange={setSkip} noun="transactions" />
    </section>
  )
}
