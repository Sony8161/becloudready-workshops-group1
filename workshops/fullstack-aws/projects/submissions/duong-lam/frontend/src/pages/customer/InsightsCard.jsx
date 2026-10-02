import { accountName, maybeMoney } from '../../utils/format.js'

// Simple charts made from plain divs: how wide a bar is = its share of the biggest number.
export default function InsightsCard({ moneyIn, moneyOut, counts, accounts, total, hidden }) {
  const biggest = Math.max(moneyIn, moneyOut, 1)
  const parts = [
    counts.DEPOSIT && `${counts.DEPOSIT} deposit${counts.DEPOSIT === 1 ? '' : 's'}`,
    counts.TRANSFER && `${counts.TRANSFER} transfer${counts.TRANSFER === 1 ? '' : 's'}`,
    counts.WITHDRAW && `${counts.WITHDRAW} withdrawal${counts.WITHDRAW === 1 ? '' : 's'}`,
  ].filter(Boolean)
  const net = moneyIn - moneyOut

  return (
    <section className="card" aria-labelledby="ins-title">
      <div className="section-row">
        <h2 id="ins-title">Insights</h2>
        <span className="muted small">This month</span>
      </div>
      <div className="bar-stat">
        <div className="bar-label"><span>Money in</span><strong>{maybeMoney(moneyIn, hidden)}</strong></div>
        <div className="bar-track"><div className="bar-fill good" style={{ width: `${(moneyIn / biggest) * 100}%` }} /></div>
      </div>
      <div className="bar-stat">
        <div className="bar-label"><span>Money out</span><strong>{maybeMoney(moneyOut, hidden)}</strong></div>
        <div className="bar-track"><div className="bar-fill brand" style={{ width: `${(moneyOut / biggest) * 100}%` }} /></div>
      </div>
      <p className="muted small no-margin">
        {parts.length ? parts.join(' · ') : 'No money moves yet this month.'}
        {parts.length > 0 && !hidden && <> · you're <strong className={net >= 0 ? 'good-text' : ''}>{net >= 0 ? 'up' : 'down'} {maybeMoney(Math.abs(net), false)}</strong></>}
      </p>

      {accounts.length > 1 && total > 0 && (
        <div className="split-stat">
          <div className="muted small">Where your money is</div>
          <div className="split-bar" role="img" aria-label={accounts.map((a) => `${accountName(a.accountType)} ${Math.round((a.balance / total) * 100)}%`).join(', ')}>
            {accounts.map((a) => (
              <span key={a.id} className={a.accountType === 'SAVINGS' ? 'savings' : 'checking'} style={{ flexGrow: Math.max(a.balance, 0) }} />
            ))}
          </div>
          <div className="split-legend">
            {accounts.map((a) => (
              <span key={a.id}><i className={a.accountType === 'SAVINGS' ? 'savings' : 'checking'} />{accountName(a.accountType)} {Math.round((a.balance / total) * 100)}%</span>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
