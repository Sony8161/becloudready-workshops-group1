import { useCallback, useEffect, useState } from 'react'
import ButtonSpinner from '../../components/ButtonSpinner.jsx'
import Icon from '../../components/Icon.jsx'
import { AdminSkeleton } from '../../components/Skeleton.jsx'
import { getAdminCustomers, getAdminStats } from '../../services/adminService.js'
import { errorMessage } from '../../services/api.js'
import { getSecurityEvents, getTransactionsPage } from '../../services/auditService.js'
import { createCustomer } from '../../services/customerService.js'
import { useCommands, useShellInfo } from '../../shell/ShellContext.jsx'
import { useToast } from '../../shell/ToastContext.jsx'
import { downloadCsv, toCsv } from '../../utils/csv.js'
import { money } from '../../utils/format.js'
import CustomerDrawer from './CustomerDrawer.jsx'
import CustomersCard from './CustomersCard.jsx'
import KpiTiles from './KpiTiles.jsx'
import LiveFeedCard from './LiveFeedCard.jsx'
import SignInLogCard from './SignInLogCard.jsx'

function scrollToId(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// The staff "command center": every admin tool on ONE page.
// refreshKey is a counter: bump it and every card reloads (after a teller deposit, a new customer...).
export default function AdminHome() {
  const toast = useToast()
  const [stats, setStats] = useState(null)
  const [problems, setProblems] = useState(0)
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [drawerId, setDrawerId] = useState(null) // which customer's drawer is open
  const [query, setQuery] = useState('')
  const [premium, setPremium] = useState(false)
  const [problemsOnly, setProblemsOnly] = useState(false)
  const [feedCustomer, setFeedCustomer] = useState(null)
  const [exporting, setExporting] = useState(false)
  const [adding, setAdding] = useState(false) // the Add customer form is open

  const refresh = useCallback(() => setRefreshKey((n) => n + 1), [])

  useEffect(() => {
    let cancelled = false
    Promise.all([getAdminStats(), getSecurityEvents({ limit: 1, problems: true })])
      .then(([s, p]) => {
        if (cancelled) return
        setStats(s)
        setProblems(p.total)
      })
      .catch((err) => !cancelled && setError(errorMessage(err)))
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  async function addCustomer(customer) {
    try {
      const saved = await createCustomer(customer) // POST /api/customers
      toast(`${saved.name} added. Open an account or turn on online banking next.`)
      refresh()
      setDrawerId(saved.id)
      return saved
    } catch (err) {
      toast(errorMessage(err), 'bad')
      return null
    }
  }

  // Up to 500 rows of the audit log as a CSV file (Excel opens it).
  async function exportAudit() {
    setExporting(true)
    try {
      const { items, total } = await getTransactionsPage({ limit: 500 })
      const rows = items.map((t) => ({ ...t, timestamp: new Date(t.timestamp).toISOString(), amount: t.amount.toFixed(2) }))
      const columns = [
        { key: 'id', label: 'ID' }, { key: 'timestamp', label: 'Time (UTC)' }, { key: 'type', label: 'Type' },
        { key: 'amount', label: 'Amount' }, { key: 'customerId', label: 'Customer' }, { key: 'fromAccountId', label: 'From account' },
        { key: 'toAccountId', label: 'To account' }, { key: 'performedBy', label: 'Done by' },
      ]
      downloadCsv(`audit-log-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows, columns))
      toast(`Exported ${rows.length} of ${total} transactions.`)
    } catch (err) {
      toast(errorMessage(err), 'bad')
    } finally {
      setExporting(false)
    }
  }

  function showProblems() {
    setProblemsOnly(true)
    scrollToId('signin-log')
  }

  // Ctrl+K on the staff page: type a name or email to open that customer, or pick an action.
  useCommands(async (text) => {
    const items = [
      { id: 'add', label: 'Add a customer', icon: 'plus', keywords: 'new create', run: () => { setAdding(true); scrollToId('cust-title') } },
      { id: 'premium', label: 'Show premium customers', icon: 'users', keywords: 'rich vip filter', run: () => { setPremium(true); scrollToId('cust-title') } },
      { id: 'problems', label: 'Show sign-in problems', icon: 'alert', keywords: 'lockouts locked wrong password security', run: showProblems },
      { id: 'export', label: 'Export audit log (CSV)', icon: 'download', keywords: 'csv excel download', run: exportAudit },
      { id: 'refresh', label: 'Refresh everything', icon: 'refresh', keywords: 'reload update', run: refresh },
    ]
    if (text.trim().length >= 2) {
      const { items: found } = await getAdminCustomers({ query: text, limit: 5 })
      return [
        ...found.map((c) => ({ id: `c-${c.id}`, alwaysShow: true, icon: 'user', label: `${c.name}`,
          hint: `${c.email} · ${money(c.totalBalance)}`, run: () => setDrawerId(c.id) })),
        ...items,
      ]
    }
    return items
  })

  useShellInfo({
    displayName: 'Admin',
    alert: { count: problems, label: problems ? `Alerts: ${problems} sign-in problems` : 'Sign-in log', onClick: showProblems },
  })

  if (error) return <div className="page"><div className="alert alert-error" role="alert">{error}</div></div>
  if (!stats) return <AdminSkeleton />

  return (
    <div className="page">
      <div className="page-hello">
        <div>
          <div className="muted">Staff portal · {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
          <h1>Command center</h1>
        </div>
        <button type="button" className="btn btn-outline" onClick={exportAudit} disabled={exporting}>
          {exporting ? <ButtonSpinner /> : <Icon name="download" size={16} />}Export audit log (CSV)
        </button>
      </div>

      <KpiTiles stats={stats} problems={problems} onProblems={showProblems} />

      <div className="grid-2">
        <CustomersCard query={query} setQuery={setQuery} premium={premium} setPremium={setPremium}
          refreshKey={refreshKey} onOpen={setDrawerId} onCreate={addCustomer} adding={adding} setAdding={setAdding} />
        <LiveFeedCard refreshKey={refreshKey} customerFilter={feedCustomer} onClearCustomer={() => setFeedCustomer(null)}
          onOpenCustomer={setDrawerId} />
      </div>

      <SignInLogCard problemsOnly={problemsOnly} setProblemsOnly={setProblemsOnly} refreshKey={refreshKey} />

      {drawerId && (
        <CustomerDrawer key={drawerId} customerId={drawerId} onClose={() => setDrawerId(null)} onChanged={refresh}
          onShowFeed={(c) => { setFeedCustomer({ id: c.id, name: c.name }); setDrawerId(null) }} />
      )}
    </div>
  )
}
