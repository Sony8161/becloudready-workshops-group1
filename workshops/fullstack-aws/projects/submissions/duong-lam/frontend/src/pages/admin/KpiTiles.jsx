import { money } from '../../utils/format.js'

// The numbers across the top of the staff page. MongoDB counts them (/api/admin/stats),
// so this is one small request no matter how many customers there are.
export default function KpiTiles({ stats, problems, onProblems }) {
  const tiles = [
    { label: 'Customers', value: stats.customers.toLocaleString(), hint: `${stats.accounts} accounts (${stats.savingsAccounts} savings)` },
    { label: 'Money held', value: money(stats.totalBalance), hint: 'across every account' },
    { label: 'Transactions today', value: stats.transactionsToday.toLocaleString(), hint: `${stats.transactions.toLocaleString()} all time` },
    { label: 'Premium accounts', value: stats.premiumAccounts.toLocaleString(), hint: `balance ≥ ${money(stats.premiumThreshold)}` },
  ]
  return (
    <div className="kpis">
      {tiles.map((t) => (
        <div key={t.label} className="kpi">
          <span className="kpi-label">{t.label}</span>
          <strong className="kpi-value">{t.value}</strong>
          <span className="kpi-hint">{t.hint}</span>
        </div>
      ))}
      <button type="button" className={`kpi kpi-button ${problems > 0 ? 'kpi-warn' : ''}`} onClick={onProblems}>
        <span className="kpi-label">Sign-in problems</span>
        <strong className="kpi-value">{problems.toLocaleString()}</strong>
        <span className="kpi-hint">wrong passwords + lockouts</span>
      </button>
    </div>
  )
}
