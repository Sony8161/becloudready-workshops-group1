import { useState } from 'react'
import Icon from '../../components/Icon.jsx'
import { dayLabel, maybeMoney, shortTime } from '../../utils/format.js'
import { byStaff, describe, groupByDay, TYPE_CHIPS, TYPE_LABEL } from '../../utils/transactions.js'

const PAGE = 8 // rows shown at first; "Show more" adds 8 more

const RANGES = [
  { value: 'all', label: 'Any time' },
  { value: 'this', label: 'This month' },
  { value: 'last', label: 'Last month' },
  { value: '90', label: 'Last 90 days' },
  { value: 'custom', label: 'Pick dates' },
]

// [from, to) as Date objects for the chosen range (null = no limit on that side)
function rangeDates(range, fromText, toText) {
  const now = new Date()
  if (range === 'this') return [new Date(now.getFullYear(), now.getMonth(), 1), null]
  if (range === 'last') return [new Date(now.getFullYear(), now.getMonth() - 1, 1), new Date(now.getFullYear(), now.getMonth(), 1)]
  if (range === '90') return [new Date(now.getTime() - 90 * 86400000), null]
  if (range === 'custom') {
    const from = fromText ? new Date(`${fromText}T00:00:00`) : null
    const to = toText ? new Date(`${toText}T00:00:00`) : null
    if (to) to.setDate(to.getDate() + 1) // "to Sep 30" includes the whole of Sep 30
    return [from, to]
  }
  return [null, null]
}

// Activity: search, type chips and a date range, grouped by day. Clicking a row opens its receipt.
export default function ActivityCard({ txns, ownIds, username, names, hidden, search, onSearch, onOpen, onStatements }) {
  const [type, setType] = useState('ALL')
  const [range, setRange] = useState('all')
  const [fromText, setFromText] = useState('')
  const [toText, setToText] = useState('')
  const [shown, setShown] = useState(PAGE)

  const query = search.trim().toLowerCase()
  const [from, to] = rangeDates(range, fromText, toText)
  const filtered = txns.filter((t) => {
    if (type !== 'ALL' && t.type !== type) return false
    const when = new Date(t.timestamp)
    if (from && when < from) return false
    if (to && when >= to) return false
    if (!query) return true
    const text = `${describe(t, ownIds, names).text} ${TYPE_LABEL[t.type]} ${t.amount} ${t.id}`.toLowerCase()
    return text.includes(query)
  })
  const groups = groupByDay(filtered.slice(0, shown), dayLabel)
  const filtering = type !== 'ALL' || range !== 'all' || query

  return (
    <section id="activity" className="card" aria-labelledby="act-title">
      <div className="section-row">
        <h2 id="act-title">Activity</h2>
        <button type="button" className="btn btn-outline btn-sm" onClick={onStatements} disabled={txns.length === 0}>
          <Icon name="list" size={16} />Statements
        </button>
      </div>
      <div className="filter-row">
        <input type="search" placeholder="Search activity" aria-label="Search activity" value={search}
          onChange={(e) => { onSearch(e.target.value); setShown(PAGE) }} />
        <select aria-label="Date range" value={range} onChange={(e) => { setRange(e.target.value); setShown(PAGE) }}>
          {RANGES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </div>
      {range === 'custom' && (
        <div className="filter-row dates">
          <label className="inline-label">From <input type="date" value={fromText} onChange={(e) => setFromText(e.target.value)} aria-label="From date" /></label>
          <label className="inline-label">To <input type="date" value={toText} onChange={(e) => setToText(e.target.value)} aria-label="To date" /></label>
        </div>
      )}
      <div className="chips" role="group" aria-label="Filter by type">
        {TYPE_CHIPS.map((c) => (
          <button key={c.value} type="button" className={`chip-btn ${type === c.value ? 'active' : ''}`}
            aria-pressed={type === c.value} onClick={() => { setType(c.value); setShown(PAGE) }}>{c.label}</button>
        ))}
      </div>
      {filtering && filtered.length > 0 && (
        <p className="muted small no-margin">{filtered.length} transaction{filtered.length === 1 ? '' : 's'} match</p>
      )}

      {groups.map((g) => (
        <div key={g.label} className="day-group">
          <div className="day-label">{g.label}</div>
          {g.items.map((t) => {
            const d = describe(t, ownIds, names)
            const sign = d.direction > 0 ? '+' : d.direction < 0 ? '−' : ''
            return (
              <button key={t.id} type="button" className="txn-row" onClick={() => onOpen(t)}>
                <span className={`txn-icon ${d.direction > 0 ? 'in' : d.direction < 0 ? 'out' : 'move'}`}><Icon name={d.icon} size={18} strokeWidth={2.2} /></span>
                <span className="txn-text">
                  <strong>{d.text}</strong>
                  <small>{TYPE_LABEL[t.type]} · {shortTime(t.timestamp)}{byStaff(t, ownIds, username) ? ' · by bank staff' : ''}</small>
                </span>
                <span className={`txn-amount ${d.direction > 0 ? 'in' : ''}`}>{sign}{maybeMoney(t.amount, hidden)}</span>
              </button>
            )
          })}
        </div>
      ))}

      {filtered.length === 0 && (
        <div className="empty-box">{txns.length === 0 ? 'No transactions yet. Your deposits, withdrawals and transfers will show up here.' : 'No transactions match.'}</div>
      )}
      {filtered.length > shown && (
        <button type="button" className="btn btn-outline btn-block" onClick={() => setShown(shown + PAGE)}>
          Show more ({filtered.length - shown} left)
        </button>
      )}
    </section>
  )
}
