import { useEffect, useRef, useState } from 'react'
import { deposit, transfer, withdraw } from '../services/accountService.js'
import { errorMessage } from '../services/api.js'
import { accountLabel, maskedAccount, maybeMoney, money } from '../utils/format.js'
import { amountError } from '../utils/money.js'
import { lookupPayee } from '../utils/payees.js'
import ButtonSpinner from './ButtonSpinner.jsx'
import Icon from './Icon.jsx'

const MODES = [
  { value: 'deposit', label: 'Deposit', verb: 'Deposit' },
  { value: 'withdraw', label: 'Withdraw', verb: 'Withdrawal' },
  { value: 'transfer', label: 'Transfer', verb: 'Transfer' },
]
export const CONFIRM_OVER = 1000 // big amounts need "CONFIRM" typed in, so a slip of the finger can't send $5,000
const QUICK_AMOUNTS = [20, 50, 100]

// Deposit / withdraw / transfer, in two steps: fill in -> REVIEW -> confirm.
// The same form is used by customers (on their home page) and by staff (the teller box in a
// customer's drawer), so everything it needs comes in as props:
//   accounts   the accounts money can come from / go to
//   request    { mode, amount, accountId, key }: the quick buttons and Ctrl+K "deposit 50" fill the form
//              by sending a new request (a new key = "start again with these values")
//   hidden     the eye button: show •••••• instead of balances
//   teller     staff mode: the button says who is doing it
//   recipients [{ accountId, name }] people this customer has paid before (shown as one-tap chips)
//   knownIds   account ids they've paid before: no "do you know this person?" warning for these
//   onDone(text)  after a success, with a sentence for the toast
export default function MoveMoneyForm({ accounts, request, hidden = false, teller = false, recipients = [], knownIds = new Set(),
  onDone, onStepChange }) {
  const [mode, setMode] = useState('deposit')
  const [accountId, setAccountId] = useState(accounts[0]?.id)
  const [toChoice, setToChoice] = useState('') // an own account id, 'p<id>' for a past recipient, or 'other'
  const [toNumber, setToNumber] = useState('')
  const [payee, setPayee] = useState({ status: 'idle', name: '' }) // the name check for a typed account number
  const [knowThem, setKnowThem] = useState(false) // the "I know this person" box
  const [amount, setAmount] = useState('')
  const [step, setStep] = useState('form') // 'form' -> 'review'
  const [confirmText, setConfirmText] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const amountRef = useRef(null)

  // A quick button or the palette asked for a fresh form: copy its values in and focus the amount.
  useEffect(() => {
    if (!request) return
    setMode(request.mode ?? 'deposit')
    if (request.accountId) setAccountId(request.accountId)
    if (request.toAccountId) { // "Send again" from a receipt
      const to = request.toAccountId
      if (accounts.some((a) => a.id === to)) setToChoice(String(to))
      else if (recipients.some((r) => r.accountId === to)) setToChoice(`p${to}`)
      else {
        setToChoice('other')
        setToNumber(String(to))
      }
    }
    setAmount(request.amount ? String(request.amount) : '')
    setKnowThem(false)
    setStep('form')
    setError('')
    setConfirmText('')
    setTimeout(() => amountRef.current?.focus(), 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request])

  // keep a valid selection when accounts are added or removed
  useEffect(() => {
    if (!accounts.some((a) => a.id === accountId)) setAccountId(accounts[0]?.id)
  }, [accounts, accountId])

  useEffect(() => onStepChange?.(step), [step, onStepChange])

  const source = accounts.find((a) => a.id === accountId)
  const others = accounts.filter((a) => a.id !== accountId)
  const valid = (c) => c === 'other' || (c.startsWith('p') && recipients.some((r) => `p${r.accountId}` === c))
    || others.some((a) => String(a.id) === c)
  const choice = toChoice && valid(toChoice) ? toChoice : others[0] ? String(others[0].id) : recipients[0] ? `p${recipients[0].accountId}` : 'other'
  const toId = choice === 'other' ? Number(toNumber) : Number(choice.replace('p', ''))
  const ownTarget = accounts.find((a) => a.id === toId)
  const pastRecipient = recipients.find((r) => r.accountId === toId)
  const toName = ownTarget ? null : pastRecipient?.name || (choice === 'other' && payee.status === 'found' ? payee.name : '')
  // Zelle-style check: money leaving to someone this customer has never paid before (staff skip it)
  const newPerson = !teller && mode === 'transfer' && !ownTarget && toId > 0 && !knownIds.has(toId)
  const modeInfo = MODES.find((m) => m.value === mode)
  const value = Number(amount)

  // NAME CHECK: while they type an account number, look up who owns it (after a 400 ms pause).
  useEffect(() => {
    setKnowThem(false)
    if (choice !== 'other' || !toNumber) {
      setPayee({ status: 'idle', name: '' })
      return
    }
    const id = Number(toNumber)
    if (accounts.some((a) => a.id === id)) {
      setPayee({ status: 'own', name: '' })
      return
    }
    setPayee({ status: 'loading', name: '' })
    let alive = true
    const timer = setTimeout(() => {
      lookupPayee(id)
        .then((name) => alive && setPayee(name ? { status: 'found', name } : { status: 'missing', name: '' }))
        .catch((err) => alive && setPayee({ status: 'error', name: errorMessage(err) }))
    }, 400)
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [choice, toNumber, accounts])

  useEffect(() => setKnowThem(false), [toId])

  function quickAmount(n) {
    setAmount(n === 'all' ? source.balance.toFixed(2) : String(n))
    setError('')
  }

  function pickMode(next) {
    setMode(next)
    setStep('form')
    setError('')
  }

  // Step 1 -> 2: check everything in the browser first (instant feedback). The backend checks it all again.
  async function review(event) {
    event.preventDefault()
    if (!source) return setError('Open an account first.')
    const problem = amountError(amount.trim(), { max: mode === 'deposit' ? undefined : source.balance })
    if (problem) return setError(problem)
    if (mode === 'transfer') {
      if (!toId || !Number.isInteger(toId)) return setError('Enter the account number the money goes to.')
      if (toId === source.id) return setError('Pick two different accounts.')
      if (choice === 'other' && !ownTarget) {
        // they pressed Review before the name check finished: finish it now (the answer is cached)
        let name = payee.status === 'found' ? payee.name : null
        if (payee.status !== 'found') {
          try {
            name = await lookupPayee(toId)
          } catch (err) {
            return setError(errorMessage(err))
          }
          setPayee(name ? { status: 'found', name } : { status: 'missing', name: '' })
        }
        if (!name) return setError('There is no account with that number.')
      }
      if (newPerson && !knowThem) return setError('Tick the box to confirm you know this person.')
    }
    setError('')
    setConfirmText('')
    setStep('review')
  }

  // Step 2: send it.
  async function confirm() {
    setBusy(true)
    setError('')
    try {
      if (mode === 'deposit') await deposit(source.id, value)
      if (mode === 'withdraw') await withdraw(source.id, value)
      if (mode === 'transfer') await transfer(source.id, toId, value)
      const sentence = {
        deposit: `Deposited ${money(value)} to ${maskedAccount(source.id)}`,
        withdraw: `Withdrew ${money(value)} from ${maskedAccount(source.id)}`,
        transfer: `Sent ${money(value)} from ${maskedAccount(source.id)} to ${toName ? `${toName} ` : ''}${maskedAccount(toId)}`,
      }[mode]
      setAmount('')
      setToNumber('')
      setKnowThem(false)
      setStep('form')
      onDone?.(sentence)
    } catch (err) {
      setError(errorMessage(err)) // e.g. "Insufficient funds", "Account not found"
      setStep('form')
    } finally {
      setBusy(false)
    }
  }

  if (accounts.length === 0) {
    return <div className="empty-box">No accounts yet. Open one to start moving money.</div>
  }

  if (step === 'review') {
    const needsConfirm = value > CONFIRM_OVER
    const after = mode === 'deposit' ? source.balance + value : source.balance - value
    const toLabel = ownTarget ? `${accountLabel(ownTarget)} ${maskedAccount(toId)}` : `${toName ? `${toName} ` : ''}${maskedAccount(toId)}`
    const rows = [
      [mode === 'deposit' ? 'Into' : 'From', `${accountLabel(source)} ${maskedAccount(source.id)}`],
      ...(mode === 'transfer' ? [['To', toLabel + (newPerson ? ' (new recipient)' : '')]] : []),
      [`Balance after`, maybeMoney(after, hidden)],
      ['When', 'Right away'],
      ...(teller ? [['Done by', 'Staff (you), recorded in the audit log']] : []),
    ]
    return (
      <div className="mm-review">
        <div className="mm-review-amount">
          <span>{modeInfo.verb}</span>
          <strong>{money(value)}</strong>
        </div>
        <dl className="rows">
          {rows.map(([label, text]) => (
            <div key={label}><dt>{label}</dt><dd>{text}</dd></div>
          ))}
        </dl>
        {newPerson && (
          <p className="scam-line"><Icon name="alert" size={16} /> First payment to {toName || 'this person'}: transfers can't be undone.</p>
        )}
        {needsConfirm && (
          <label className="confirm-box">
            <span>This is over {money(CONFIRM_OVER)}. Type CONFIRM to send it.</span>
            <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="CONFIRM"
              aria-label="Type CONFIRM" autoComplete="off" autoFocus />
          </label>
        )}
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        <div className="two-buttons">
          <button type="button" className="btn btn-outline" onClick={() => setStep('form')} disabled={busy}>Back</button>
          <button type="button" className="btn btn-primary" onClick={confirm}
            disabled={busy || (needsConfirm && confirmText.trim().toUpperCase() !== 'CONFIRM')}>
            {busy && <ButtonSpinner />}
            {busy ? 'Sending...' : `Confirm ${modeInfo.label.toLowerCase()}`}
          </button>
        </div>
      </div>
    )
  }

  return (
    <form className="mm-form" onSubmit={review} noValidate>
      <div className="segmented three" role="tablist" aria-label="Kind of money move">
        {MODES.map((m) => (
          <button key={m.value} type="button" role="tab" aria-selected={mode === m.value}
            className={mode === m.value ? 'active' : ''} onClick={() => pickMode(m.value)}>{m.label}</button>
        ))}
      </div>

      <fieldset className="chip-group">
        <legend>{mode === 'deposit' ? 'Into' : 'From'}</legend>
        <div className="acct-chips">
          {accounts.map((a) => (
            <button key={a.id} type="button" className={`acct-chip ${a.id === accountId ? 'selected' : ''}`}
              aria-pressed={a.id === accountId} onClick={() => setAccountId(a.id)}>
              <strong>{accountLabel(a)} {maskedAccount(a.id)}</strong>
              <span>{maybeMoney(a.balance, hidden)}</span>
            </button>
          ))}
        </div>
      </fieldset>

      {mode === 'transfer' && (
        <fieldset className="chip-group">
          <legend>To</legend>
          <div className="acct-chips">
            {others.map((a) => (
              <button key={a.id} type="button" className={`acct-chip ${choice === String(a.id) ? 'selected' : ''}`}
                aria-pressed={choice === String(a.id)} onClick={() => setToChoice(String(a.id))}>
                <strong>{accountLabel(a)} {maskedAccount(a.id)}</strong>
                <span>{teller ? 'Same customer' : 'Your account'}</span>
              </button>
            ))}
            {!teller && recipients.map((r) => (
              <button key={r.accountId} type="button" className={`acct-chip ${choice === `p${r.accountId}` ? 'selected' : ''}`}
                aria-pressed={choice === `p${r.accountId}`} onClick={() => setToChoice(`p${r.accountId}`)}>
                <strong>{r.name || 'Paid before'} {maskedAccount(r.accountId)}</strong>
                <span>Paid before</span>
              </button>
            ))}
            <button type="button" className={`acct-chip ${choice === 'other' ? 'selected' : ''}`}
              aria-pressed={choice === 'other'} onClick={() => setToChoice('other')}>
              <strong>{teller ? 'Another account' : 'Someone else'}</strong>
              <span>By account number</span>
            </button>
          </div>
          {choice === 'other' && (
            <label className="field">
              <span>Recipient account number</span>
              <input inputMode="numeric" placeholder="e.g. 0003" value={toNumber}
                onChange={(e) => setToNumber(e.target.value.replace(/\D/g, ''))} />
              <PayeeCheck payee={payee} />
            </label>
          )}
          {newPerson && !['loading', 'missing'].includes(payee.status) && (
            <div className="scam-box" role="note">
              <strong><Icon name="alert" size={18} /> Do you know {toName || 'this person'}?</strong>
              <p>You haven't sent money to {toName || 'this account'} before. Only send money to people you know and trust:
                transfers happen right away and <b>can't be undone</b>. Scammers often pretend to be the bank, a company,
                or a friend in trouble.</p>
              <label className="check">
                <input type="checkbox" checked={knowThem} onChange={(e) => setKnowThem(e.target.checked)} />
                <span>I know {toName || 'this person'} and want to send them money</span>
              </label>
            </div>
          )}
        </fieldset>
      )}

      <div className="field">
        <label htmlFor={teller ? 'teller-amount' : 'mm-amount'}>Amount</label>
        <div className="input-money">
          <span>$</span>
          <input id={teller ? 'teller-amount' : 'mm-amount'} ref={amountRef} inputMode="decimal" placeholder="0.00"
            value={amount} onChange={(e) => setAmount(e.target.value)} autoComplete="off" />
        </div>
        <div className="quick-amounts" role="group" aria-label="Quick amounts">
          {QUICK_AMOUNTS.map((n) => (
            <button key={n} type="button" className="chip-btn" onClick={() => quickAmount(n)}>${n}</button>
          ))}
          {mode !== 'deposit' && source && (
            <button type="button" className="chip-btn" onClick={() => quickAmount('all')} disabled={source.balance <= 0}>All</button>
          )}
        </div>
        {source && (
          <small className="muted">
            {mode === 'deposit' ? 'Balance now' : 'Available'}: {maybeMoney(source.balance, hidden)}
            {value > 0 && !amountError(amount.trim(), { max: mode === 'deposit' ? undefined : source.balance }) && (
              <> · <span className="after-text">After: {maybeMoney(mode === 'deposit' ? source.balance + value : source.balance - value, hidden)}</span></>
            )}
          </small>
        )}
        {value > CONFIRM_OVER && <small className="warn-text">Over {money(CONFIRM_OVER)}: you'll be asked to type CONFIRM.</small>}
      </div>

      {error && <div className="alert alert-error" role="alert">{error}</div>}

      <button type="submit" className="btn btn-primary btn-block">Review {modeInfo.label.toLowerCase()}</button>
    </form>
  )
}

// Under the account number box: who it belongs to, or why we can't tell.
function PayeeCheck({ payee }) {
  if (payee.status === 'idle') return null
  if (payee.status === 'loading') return <small className="payee-check muted"><span className="btn-spinner" /> Checking the name...</small>
  if (payee.status === 'found') return <small className="payee-check good-text"><Icon name="check" size={14} strokeWidth={3} /> Account holder: <strong>{payee.name}</strong></small>
  if (payee.status === 'own') return <small className="payee-check muted">That's one of your own accounts.</small>
  if (payee.status === 'missing') return <small className="payee-check bad-text">No account has that number.</small>
  return <small className="payee-check bad-text">{payee.name}</small>
}
