import Icon from '../../components/Icon.jsx'
import { maybeMoney } from '../../utils/format.js'

// The plum card at the top: total balance, money in/out this month, and three quick buttons.
// The eye button hides every balance on the page (for when someone is looking over your shoulder).
export default function BalanceCard({ total, accountCount, moneyIn, moneyOut, hidden, onToggleHidden, onQuick }) {
  return (
    <section className="balance-card" aria-label="Total balance">
      <div className="balance-top">
        <div>
          <div className="balance-label">Total balance</div>
          <div className="balance-total" data-testid="total-balance">{maybeMoney(total, hidden)}</div>
          <div className="balance-sub">across {accountCount} account{accountCount === 1 ? '' : 's'} · updated just now</div>
        </div>
        <button type="button" className="eye-btn" onClick={onToggleHidden}
          aria-label={hidden ? 'Show balances' : 'Hide balances'} aria-pressed={hidden} title={hidden ? 'Show balances' : 'Hide balances'}>
          <Icon name={hidden ? 'eyeOff' : 'eye'} size={20} />
        </button>
      </div>
      <div className="balance-split">
        <div>
          <span>Money in this month</span>
          <strong className="in">{maybeMoney(moneyIn, hidden)}</strong>
        </div>
        <div>
          <span>Money out this month</span>
          <strong>{maybeMoney(moneyOut, hidden)}</strong>
        </div>
      </div>
      <div className="balance-actions">
        <button type="button" onClick={() => onQuick('deposit')}><Icon name="down" size={16} strokeWidth={2.4} />Deposit</button>
        <button type="button" onClick={() => onQuick('withdraw')}><Icon name="up" size={16} strokeWidth={2.4} />Withdraw</button>
        <button type="button" onClick={() => onQuick('transfer')}><Icon name="swap" size={16} strokeWidth={2.4} />Transfer</button>
      </div>
    </section>
  )
}
