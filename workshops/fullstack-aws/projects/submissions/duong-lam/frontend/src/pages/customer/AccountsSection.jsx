import { useState } from 'react'
import ButtonSpinner from '../../components/ButtonSpinner.jsx'
import Icon from '../../components/Icon.jsx'
import Sparkline from '../../components/Sparkline.jsx'
import { updateAccountSettings } from '../../services/accountService.js'
import { errorMessage } from '../../services/api.js'
import { accountLabel, accountName, maskedAccount, maybeMoney } from '../../utils/format.js'
import { balanceHistory } from '../../utils/transactions.js'

// "Your accounts": one card per account with a balance line chart, a copy-number button, a nickname and
// savings goal the owner picks, and a shortcut into the Move money form. "Open account" adds one.
export default function AccountsSection({ accounts, txns, hidden, onCopy, onMove, onOpen, onSaved }) {
  const [choosing, setChoosing] = useState(false)
  const [opening, setOpening] = useState('')
  const [editing, setEditing] = useState(null) // the account id whose name/goal form is open

  async function open(type) {
    setOpening(type)
    await onOpen(type)
    setOpening('')
    setChoosing(false)
  }

  return (
    <section id="accounts" className="section-block" aria-labelledby="acc-title">
      <div className="section-row">
        <h2 id="acc-title">Your accounts</h2>
        {choosing ? (
          <div className="inline-choice" role="group" aria-label="Kind of account to open">
            <span className="muted">Open a</span>
            <button type="button" className="btn btn-soft" onClick={() => open('CHECKING')} disabled={!!opening}>
              {opening === 'CHECKING' && <ButtonSpinner />}Checking
            </button>
            <button type="button" className="btn btn-soft" onClick={() => open('SAVINGS')} disabled={!!opening}>
              {opening === 'SAVINGS' && <ButtonSpinner />}Savings
            </button>
            <button type="button" className="icon-btn" onClick={() => setChoosing(false)} aria-label="Cancel"><Icon name="x" /></button>
          </div>
        ) : (
          <button type="button" className="btn btn-outline" onClick={() => setChoosing(true)}><Icon name="plus" size={16} />Open account</button>
        )}
      </div>

      {accounts.length === 0 ? (
        <div className="empty-box">You don't have an account yet. Open a checking or savings account to get started.</div>
      ) : (
        <div className="account-grid">
          {accounts.map((a) => {
            const points = balanceHistory(a, txns)
            const moves = points.length - 1
            return (
              <article key={a.id} className={`acct-card ${a.accountType === 'SAVINGS' ? 'savings' : 'checking'}`}
                aria-label={`${accountLabel(a)} ${maskedAccount(a.id)}`}>
                <div className="acct-head">
                  <span className="dot" aria-hidden="true" />
                  <strong>{accountLabel(a)}</strong>
                  <span className="mono muted">{a.nickname ? `${accountName(a.accountType)} ` : ''}{maskedAccount(a.id)}</span>
                  <button type="button" className="icon-btn small" onClick={() => setEditing(editing === a.id ? null : a.id)}
                    aria-label={`Edit name and goal for ${maskedAccount(a.id)}`} title="Name and goal">
                    <Icon name="edit" size={15} />
                  </button>
                  <button type="button" className="icon-btn small" onClick={() => onCopy(a)}
                    aria-label={`Copy account number ${maskedAccount(a.id)}`} title="Copy account number">
                    <Icon name="copy" size={16} />
                  </button>
                </div>
                <div>
                  <div className="muted small">Available balance</div>
                  <div className="acct-balance">{maybeMoney(a.balance, hidden)}</div>
                </div>
                {editing === a.id ? (
                  <SettingsForm account={a} onCancel={() => setEditing(null)}
                    onSaved={(updated) => { setEditing(null); onSaved(updated) }} />
                ) : (
                  <>
                    {a.goal ? <GoalBar balance={a.balance} goal={a.goal} hidden={hidden} /> : null}
                    {hidden ? <div className="spark-hidden" aria-hidden="true" /> : (
                      <Sparkline points={points} label={`${accountLabel(a)} balance over the last ${moves} moves`} />
                    )}
                  </>
                )}
                <div className="acct-foot">
                  <span className="muted small">{moves === 0 ? 'No activity yet' : `Last ${moves} move${moves === 1 ? '' : 's'}`}</span>
                  <button type="button" className="btn btn-soft btn-sm" onClick={() => onMove(a)}>Move money</button>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

// Progress toward a savings goal: a bar + "$4,850 of $10,000 · 49%".
function GoalBar({ balance, goal, hidden }) {
  const pct = Math.max(0, Math.min(100, Math.round((balance / goal) * 100)))
  return (
    <div className="goal" aria-label={hidden ? 'Savings goal' : `Savings goal: ${pct}% of the way`}>
      <div className="goal-row">
        <span>Goal</span>
        <span>{pct >= 100 ? 'Reached' : hidden ? '••••' : `${maybeMoney(balance, false)} of ${maybeMoney(goal, false)} · ${pct}%`}</span>
      </div>
      <div className="bar-track small"><div className={`bar-fill ${pct >= 100 ? 'good' : 'brand'}`} style={{ width: `${pct}%` }} /></div>
    </div>
  )
}

// The owner's nickname ("Rent") and an optional savings goal. Empty boxes clear them.
function SettingsForm({ account, onCancel, onSaved }) {
  const [nickname, setNickname] = useState(account.nickname ?? '')
  const [goal, setGoal] = useState(account.goal ? String(account.goal) : '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function save(event) {
    event.preventDefault()
    const goalValue = goal.trim() === '' ? null : Number(goal)
    if (goalValue !== null && !(goalValue > 0 && goalValue <= 1000000)) return setError('Goal must be between $0.01 and $1,000,000.')
    if (nickname.length > 30) return setError('Nickname: 30 characters at most.')
    setBusy(true)
    try {
      onSaved(await updateAccountSettings(account.id, { nickname: nickname.trim() || null, goal: goalValue }))
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <form className="sub-form" onSubmit={save} noValidate aria-label="Name and goal">
      <label className="field"><span>Nickname</span>
        <input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="e.g. Rent, Vacation fund" maxLength={30} autoFocus />
      </label>
      <div className="field">
        <label htmlFor={`goal-${account.id}`}>Savings goal (optional)</label>
        <div className="input-money">
          <span>$</span>
          <input id={`goal-${account.id}`} inputMode="decimal" placeholder="0.00" value={goal} onChange={(e) => setGoal(e.target.value)} />
        </div>
      </div>
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      <div className="two-buttons">
        <button type="button" className="btn btn-outline btn-sm" onClick={onCancel} disabled={busy}>Cancel</button>
        <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>{busy && <ButtonSpinner />}Save</button>
      </div>
    </form>
  )
}
