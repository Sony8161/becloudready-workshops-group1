import { useEffect, useState } from 'react'
import CustomerForm from '../../components/CustomerForm.jsx'
import Icon from '../../components/Icon.jsx'
import LoginBadge from '../../components/LoginBadge.jsx'
import Pager from '../../components/Pager.jsx'
import Skeleton from '../../components/Skeleton.jsx'
import { getAdminCustomers } from '../../services/adminService.js'
import { errorMessage } from '../../services/api.js'
import { initials, money } from '../../utils/format.js'

const PAGE = 8

// Customers: search (name starts with / email contains), Premium filter, paging, Add customer.
// The SERVER does the searching and paging (/api/admin/customers), so the browser only ever
// downloads 8 rows, however many customers the bank has.
export default function CustomersCard({ query, setQuery, premium, setPremium, refreshKey, onOpen, onCreate, adding, setAdding }) {
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [skip, setSkip] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // a new search or filter starts again at page 1
  useEffect(() => setSkip(0), [query, premium])

  useEffect(() => {
    let cancelled = false
    // DEBOUNCE: wait until they stop typing for 250 ms, so "jane" is one request, not four
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const page = await getAdminCustomers({ query, premium, limit: PAGE, skip })
        if (cancelled) return
        setRows(page.items)
        setTotal(page.total)
        setError('')
      } catch (err) {
        if (!cancelled) setError(errorMessage(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 250)
    return () => {
      cancelled = true // an older, slower answer can't overwrite a newer one
      clearTimeout(timer)
    }
  }, [query, premium, skip, refreshKey])

  async function create(customer) {
    const saved = await onCreate(customer)
    if (saved) setAdding(false)
    return saved
  }

  return (
    <section className="card" aria-labelledby="cust-title">
      <div className="section-row">
        <h2 id="cust-title">Customers <span className="count-pill">{total.toLocaleString()}</span></h2>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setAdding(!adding)} aria-expanded={adding}>
          <Icon name={adding ? 'x' : 'plus'} size={16} />{adding ? 'Close' : 'Add customer'}
        </button>
      </div>

      {/* your CustomerForm from the earlier step, reused as-is: it calls onCreate({ name, email }) */}
      {adding && <CustomerForm onCreate={create} />}

      <div className="filter-row">
        <input type="search" placeholder="Name starts with, or email" aria-label="Search customers by name or email"
          value={query} onChange={(e) => setQuery(e.target.value)} />
        <button type="button" className={`chip-btn ${premium ? 'active' : ''}`} aria-pressed={premium} onClick={() => setPremium(!premium)}>
          Premium (≥ $1,000)
        </button>
      </div>

      {error && <div className="alert alert-error" role="alert">{error}</div>}

      <div className="list" aria-busy={loading}>
        {loading && rows.length === 0 && [1, 2, 3, 4].map((n) => <Skeleton key={n} height={56} radius={12} className="sk-row" />)}
        {rows.map((c) => (
          <button key={c.id} type="button" className="list-row" onClick={() => onOpen(c.id)}>
            <span className="avatar">{initials(c.name)}</span>
            <span className="list-text">
              <strong>{c.name}{c.premium && <span className="badge badge-info tiny">Premium</span>}</strong>
              <small>{c.email} · {c.accountCount} account{c.accountCount === 1 ? '' : 's'}</small>
            </span>
            <LoginBadge login={c.login} />
            <span className="list-amount">{money(c.totalBalance)}</span>
          </button>
        ))}
        {!loading && rows.length === 0 && !error && <div className="empty-box">No customers match.</div>}
      </div>

      <Pager skip={skip} limit={PAGE} total={total} onChange={setSkip} noun="customers" />
    </section>
  )
}
