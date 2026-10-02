import { useCallback, useEffect, useState } from 'react'
import ButtonSpinner from '../../components/ButtonSpinner.jsx'
import Drawer from '../../components/Drawer.jsx'
import Icon from '../../components/Icon.jsx'
import LoginBadge from '../../components/LoginBadge.jsx'
import MoveMoneyForm from '../../components/MoveMoneyForm.jsx'
import Skeleton from '../../components/Skeleton.jsx'
import { createAccount } from '../../services/accountService.js'
import { addCustomerNote, getAdminCustomers, getCustomerNotes } from '../../services/adminService.js'
import { errorMessage } from '../../services/api.js'
import { createLogin, setTemporaryPassword, unlockLogin } from '../../services/authService.js'
import {
  deleteCustomer, getCustomerAccounts, getCustomerById, getCustomerTransactions, updateCustomer,
} from '../../services/customerService.js'
import { useToast } from '../../shell/ToastContext.jsx'
import { accountLabel, accountName, maskedAccount, money, whenText } from '../../utils/format.js'
import { temporaryPassword } from '../../utils/password.js'
import { describe } from '../../utils/transactions.js'

// Everything staff can do for ONE customer, without leaving the page:
// online banking (turn on, unlock, temporary password), accounts, teller money moves,
// recent activity, edit details, delete.
//   onChanged()  something changed: the page refreshes its lists and numbers
//   onShowFeed(customer)  filter the live feed to this customer
export default function CustomerDrawer({ customerId, onClose, onChanged, onShowFeed }) {
  const toast = useToast()
  const [customer, setCustomer] = useState(null)
  const [accounts, setAccounts] = useState([])
  const [txns, setTxns] = useState([])
  const [login, setLogin] = useState(null)
  const [error, setError] = useState('')

  // 4 requests in parallel. The login status comes from the admin customer list (searched by email).
  const load = useCallback(async () => {
    try {
      const [c, a, t] = await Promise.all([
        getCustomerById(customerId), getCustomerAccounts(customerId), getCustomerTransactions(customerId),
      ])
      const match = await getAdminCustomers({ query: c.email, limit: 5 })
      setCustomer(c)
      setAccounts(a)
      setTxns(t)
      setLogin(match.items.find((row) => row.id === customerId)?.login ?? null)
      setError('')
    } catch (err) {
      setError(errorMessage(err))
    }
  }, [customerId])

  useEffect(() => {
    load()
  }, [load])

  async function afterChange(message) {
    if (message) toast(message)
    await load()
    onChanged()
  }

  const total = accounts.reduce((sum, a) => sum + a.balance, 0)

  return (
    <Drawer wide title={customer?.name ?? 'Customer'} onClose={onClose}
      subtitle={customer ? `${customer.email} · Customer #${customer.id} · ${money(total)} in ${accounts.length} account${accounts.length === 1 ? '' : 's'}` : 'Loading...'}>
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      {!customer && !error && (
        <>
          <Skeleton height={90} radius={14} />
          <Skeleton height={140} radius={14} className="sk-gap-lg" />
          <Skeleton height={220} radius={14} className="sk-gap-lg" />
        </>
      )}
      {customer && (
        <>
          <OnlineBanking customer={customer} login={login} setLogin={setLogin} onChanged={onChanged} />

          <div className="drawer-section">
            <div className="section-row">
              <h3>Accounts</h3>
              <OpenAccountButtons customerId={customer.id} onOpened={(a) => afterChange(`${accountName(a.accountType)} account ${maskedAccount(a.id)} opened.`)} />
            </div>
            {accounts.length === 0 && <div className="empty-box">No accounts yet.</div>}
            {accounts.map((a) => (
              <div key={a.id} className="kv-row">
                <span>{accountLabel(a)} <span className="mono muted">{a.nickname ? `${accountName(a.accountType)} ` : ''}{maskedAccount(a.id)}</span></span>
                <strong>{money(a.balance)}</strong>
              </div>
            ))}
          </div>

          {accounts.length > 0 && (
            <div className="drawer-section">
              <h3>Teller: move money</h3>
              <MoveMoneyForm teller accounts={accounts} onDone={(sentence) => afterChange(`${sentence} for ${customer.name}.`)} />
            </div>
          )}

          <div className="drawer-section">
            <div className="section-row">
              <h3>Recent activity</h3>
              {txns.length > 0 && (
                <button type="button" className="link-btn" onClick={() => onShowFeed(customer)}>Show all in live feed</button>
              )}
            </div>
            {txns.length === 0 && <div className="empty-box">No transactions yet.</div>}
            {txns.slice(0, 5).map((t) => {
              const d = describe(t, new Set(accounts.map((a) => a.id)))
              return (
                <div key={t.id} className="kv-row">
                  <span className="kv-text"><span>{d.text}</span><small className="muted">{whenText(t.timestamp)} · by {t.performedBy ?? '?'}</small></span>
                  <strong className={d.direction > 0 ? 'good-text' : ''}>{d.direction > 0 ? '+' : d.direction < 0 ? '−' : ''}{money(t.amount)}</strong>
                </div>
              )
            })}
          </div>

          <StaffNotes customerId={customer.id} />

          <EditDetails customer={customer} onSaved={(c) => { setCustomer(c); afterChange('Details saved.') }} />
          <DeleteCustomer customer={customer} accounts={accounts} total={total} onDeleted={() => {
            toast(`${customer.name} was deleted.`)
            onChanged()
            onClose()
          }} />
        </>
      )}
    </Drawer>
  )
}

// ---------- Online banking: on/off, unlock, temporary password ----------
function OnlineBanking({ customer, login, setLogin, onChanged }) {
  const toast = useToast()
  const [username, setUsername] = useState(() => customer.email.split('@')[0].replace(/[^A-Za-z0-9_.-]/g, '').slice(0, 30))
  const [turningOn, setTurningOn] = useState(false)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [secret, setSecret] = useState(null) // { username, password }: shown ONCE, then gone

  async function run(kind, action) {
    setBusy(kind)
    setError('')
    try {
      await action()
      onChanged()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy('')
    }
  }

  const turnOn = (event) => {
    event.preventDefault()
    run('on', async () => {
      const password = temporaryPassword() // random; the customer changes it after signing in
      const user = await createLogin(customer.id, username.trim(), password)
      setLogin({ ...user, locked: false, failedLogins: 0 })
      setSecret({ username: user.username, password })
      setTurningOn(false)
      toast(`Online banking is on for ${customer.name}.`)
    })
  }
  const unlock = () => run('unlock', async () => {
    setLogin(await unlockLogin(login.id))
    toast(`${login.username} is unlocked.`)
  })
  const reset = () => run('reset', async () => {
    const result = await setTemporaryPassword(login.id) // also unlocks + signs out their devices
    setSecret({ username: result.username, password: result.temporaryPassword })
    setLogin({ ...login, locked: false, failedLogins: 0 })
    toast(`New temporary password for ${result.username}.`)
  })

  return (
    <div className="drawer-section">
      <div className="section-row">
        <h3>Online banking</h3>
        <LoginBadge login={login} />
      </div>
      {login ? (
        <>
          <p className="muted small no-margin">
            Username <strong className="mono">{login.username}</strong>
            {login.locked ? ' · locked after too many wrong passwords' : login.failedLogins > 0 ? ` · ${login.failedLogins} wrong password${login.failedLogins === 1 ? '' : 's'} in a row` : ' · active'}
          </p>
          <div className="two-buttons">
            {login.locked && (
              <button type="button" className="btn btn-primary" onClick={unlock} disabled={!!busy}>
                {busy === 'unlock' ? <ButtonSpinner /> : <Icon name="lock" size={16} />}Unlock
              </button>
            )}
            <button type="button" className="btn btn-outline" onClick={reset} disabled={!!busy}>
              {busy === 'reset' ? <ButtonSpinner /> : <Icon name="key" size={16} />}Reset password
            </button>
          </div>
        </>
      ) : turningOn ? (
        <form className="inline-form" onSubmit={turnOn}>
          <label className="field grow">
            <span>Username for {customer.name}</span>
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus autoComplete="off" />
          </label>
          <button type="submit" className="btn btn-primary" disabled={!!busy}>{busy === 'on' && <ButtonSpinner />}Turn on</button>
          <button type="button" className="btn btn-outline" onClick={() => setTurningOn(false)}>Cancel</button>
        </form>
      ) : (
        <div className="section-row">
          <p className="muted small no-margin">Off. This customer can't sign in yet.</p>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setTurningOn(true)}>Turn on</button>
        </div>
      )}
      {secret && <SecretBox secret={secret} onDone={() => setSecret(null)} />}
      {error && <div className="alert alert-error" role="alert">{error}</div>}
    </div>
  )
}

// The temporary password, shown once. Staff read it to the customer (or copy it), then close it.
function SecretBox({ secret, onDone }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(secret.password)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }
  return (
    <div className="secret-box" role="status">
      <span>Temporary password for <strong>{secret.username}</strong></span>
      <div className="secret-row">
        <code className="secret" data-testid="temp-password">{secret.password}</code>
        <button type="button" className="btn btn-outline btn-sm" onClick={copy}><Icon name={copied ? 'check' : 'copy'} size={14} />{copied ? 'Copied' : 'Copy'}</button>
      </div>
      <small>Shown once. Give it to the customer; they should change it after signing in. Their other devices were signed out.</small>
      <button type="button" className="link-btn" onClick={onDone}>Done, hide it</button>
    </div>
  )
}

function OpenAccountButtons({ customerId, onOpened }) {
  const toast = useToast()
  const [busy, setBusy] = useState('')
  async function open(type) {
    setBusy(type)
    try {
      onOpened(await createAccount(customerId, type))
    } catch (err) {
      toast(errorMessage(err), 'bad')
    } finally {
      setBusy('')
    }
  }
  return (
    <div className="inline-choice">
      <span className="muted small">Open</span>
      <button type="button" className="btn btn-soft btn-sm" onClick={() => open('CHECKING')} disabled={!!busy}>{busy === 'CHECKING' && <ButtonSpinner />}Checking</button>
      <button type="button" className="btn btn-soft btn-sm" onClick={() => open('SAVINGS')} disabled={!!busy}>{busy === 'SAVINGS' && <ButtonSpinner />}Savings</button>
    </div>
  )
}

function EditDetails({ customer, onSaved }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(customer.name)
  const [email, setEmail] = useState(customer.email)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function save(event) {
    event.preventDefault()
    if (!name.trim() || !email.trim()) return setError('Name and email are required.')
    setBusy(true)
    try {
      onSaved(await updateCustomer(customer.id, { name: name.trim(), email: email.trim() }))
      setOpen(false)
      setError('')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <div className="drawer-section section-row">
        <h3>Details</h3>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setOpen(true)}><Icon name="edit" size={14} />Edit</button>
      </div>
    )
  }
  return (
    <form className="drawer-section" onSubmit={save} noValidate>
      <h3>Edit details</h3>
      <label className="field"><span>Name</span><input value={name} onChange={(e) => setName(e.target.value)} /></label>
      <label className="field"><span>Email</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      <div className="two-buttons">
        <button type="button" className="btn btn-outline" onClick={() => setOpen(false)}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy && <ButtonSpinner />}Save</button>
      </div>
    </form>
  )
}

// Deleting is permanent, so it asks first and says exactly what goes.
function DeleteCustomer({ customer, accounts, total, onDeleted }) {
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function remove() {
    setBusy(true)
    try {
      await deleteCustomer(customer.id)
      onDeleted()
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <div className="drawer-section danger-zone">
      {!asking ? (
        <button type="button" className="btn btn-danger" onClick={() => setAsking(true)}><Icon name="trash" size={16} />Delete customer</button>
      ) : (
        <>
          <p className="no-margin"><strong>Delete {customer.name}?</strong> This also deletes {accounts.length} account{accounts.length === 1 ? '' : 's'} ({money(total)}) and their login. It can't be undone.</p>
          {error && <div className="alert alert-error" role="alert">{error}</div>}
          <div className="two-buttons">
            <button type="button" className="btn btn-outline" onClick={() => setAsking(false)} disabled={busy}>Keep</button>
            <button type="button" className="btn btn-danger solid" onClick={remove} disabled={busy}>{busy && <ButtonSpinner />}Delete for good</button>
          </div>
        </>
      )}
    </div>
  )
}

// Notes staff leave for each other ("Called 10/1 about the lockout"). Newest first, never edited.
function StaffNotes({ customerId }) {
  const [notes, setNotes] = useState([])
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    getCustomerNotes(customerId).then((list) => alive && setNotes(list)).catch((err) => alive && setError(errorMessage(err)))
    return () => {
      alive = false
    }
  }, [customerId])

  async function add(event) {
    event.preventDefault()
    if (!text.trim()) return setError('Write something first.')
    setBusy(true)
    try {
      const note = await addCustomerNote(customerId, text.trim())
      setNotes([note, ...notes])
      setText('')
      setError('')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="drawer-section" onSubmit={add} noValidate>
      <div className="section-row">
        <h3>Staff notes</h3>
        <span className="muted small">{notes.length} note{notes.length === 1 ? '' : 's'}</span>
      </div>
      <label className="field">
        <span className="sr-only">New note</span>
        <textarea rows={2} maxLength={500} value={text} onChange={(e) => setText(e.target.value)}
          placeholder="e.g. Called about the lockout, verified ID" aria-label="New note" />
        <small className="muted">{500 - text.length} characters left</small>
      </label>
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      <button type="submit" className="btn btn-outline btn-sm" disabled={busy}>{busy && <ButtonSpinner />}Add note</button>
      {notes.length > 0 && (
        <ul className="notes">
          {notes.map((n) => (
            <li key={n.id}>
              <p className="no-margin">{n.text}</p>
              <small className="muted">{n.author} · {whenText(n.timestamp)}</small>
            </li>
          ))}
        </ul>
      )}
    </form>
  )
}
