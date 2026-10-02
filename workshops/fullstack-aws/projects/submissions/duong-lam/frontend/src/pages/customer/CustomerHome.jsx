import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../auth/AuthContext.jsx'
import MoveMoneyForm from '../../components/MoveMoneyForm.jsx'
import { HomeSkeleton } from '../../components/Skeleton.jsx'
import { createAccount } from '../../services/accountService.js'
import { errorMessage } from '../../services/api.js'
import { getMyEvents } from '../../services/authService.js'
import { getCustomerAccounts, getCustomerById, getCustomerTransactions } from '../../services/customerService.js'
import { useCommands, useShellInfo } from '../../shell/ShellContext.jsx'
import { useToast } from '../../shell/ToastContext.jsx'
import { accountLabel, accountName, accountNumber, greeting, isThisMonth, maskedAccount, money } from '../../utils/format.js'
import { usePayeeNames } from '../../utils/payees.js'
import { buildAlerts, counterpartIds, describe, pastRecipients } from '../../utils/transactions.js'
import AccountsSection from './AccountsSection.jsx'
import ActivityCard from './ActivityCard.jsx'
import AlertsDrawer from './AlertsDrawer.jsx'
import BalanceCard from './BalanceCard.jsx'
import InsightsCard from './InsightsCard.jsx'
import ReceiptDrawer from './ReceiptDrawer.jsx'
import SecurityCard from './SecurityCard.jsx'
import StatementDrawer from './StatementDrawer.jsx'

const HIDE_KEY = 'sb_hide_balances'

function readHidden() {
  try {
    return localStorage.getItem(HIDE_KEY) === '1'
  } catch {
    return false
  }
}

// When this device last opened the alerts (so the bell counts only NEW ones). First visit: the last 7 days count.
function readSeen(username) {
  try {
    return Number(localStorage.getItem(`sb_alerts_seen_${username}`)) || Date.now() - 7 * 86400000
  } catch {
    return Date.now() - 7 * 86400000
  }
}

function scrollToId(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// The customer's ONE page: balance, move money, accounts, activity, insights and security.
// This PARENT loads the data once and hands each card only what it needs (props down),
// and the cards report back with callbacks (events up), e.g. onDone after a deposit.
export default function CustomerHome() {
  const { user } = useAuth()
  const toast = useToast()
  const customerId = user.customerId
  const [customer, setCustomer] = useState(null)
  const [accounts, setAccounts] = useState([])
  const [txns, setTxns] = useState([])
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [hidden, setHidden] = useState(readHidden)
  const [moveRequest, setMoveRequest] = useState(null) // fills the Move money form (quick buttons, Ctrl+K)
  const [moveStep, setMoveStep] = useState('form')
  const [receipt, setReceipt] = useState(null) // the transaction shown in the drawer
  const [search, setSearch] = useState('')
  const [securityPanel, setSecurityPanel] = useState(null) // 'password' | 'signout' | null
  const [statementsOpen, setStatementsOpen] = useState(false)
  const [alertsOpen, setAlertsOpen] = useState(false)
  const [seenAt, setSeenAt] = useState(() => readSeen(user.username))
  const [seenWhenOpened, setSeenWhenOpened] = useState(seenAt) // keeps the "New" tags while the drawer is open

  // Money changed: reload balances + activity (2 requests, in parallel).
  const reloadMoney = useCallback(async () => {
    const [a, t] = await Promise.all([getCustomerAccounts(customerId), getCustomerTransactions(customerId)])
    setAccounts(a)
    setTxns(t)
  }, [customerId])

  const reloadEvents = useCallback(async () => {
    try {
      setEvents(await getMyEvents(20))
    } catch {
      setEvents([]) // the security list is a nice-to-have; the page still works without it
    }
  }, [])

  // First load: everything at once with Promise.all, so the page waits for the SLOWEST request, not the total.
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [c, a, t] = await Promise.all([
          getCustomerById(customerId),
          getCustomerAccounts(customerId),
          getCustomerTransactions(customerId),
          reloadEvents(),
        ])
        if (cancelled) return
        setCustomer(c)
        setAccounts(a)
        setTxns(t)
      } catch (err) {
        if (!cancelled) setError(errorMessage(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true // left the page before the data arrived: don't update a page that's gone
    }
  }, [customerId, reloadEvents])

  // Numbers worked out from the data (recalculated only when the data changes).
  const ownIds = useMemo(() => new Set(accounts.map((a) => a.id)), [accounts])
  const total = accounts.reduce((sum, a) => sum + a.balance, 0)
  const month = useMemo(() => {
    const result = { moneyIn: 0, moneyOut: 0, counts: {} }
    for (const t of txns.filter((x) => isThisMonth(x.timestamp))) {
      const d = describe(t, ownIds)
      if (d.direction > 0) result.moneyIn += t.amount
      if (d.direction < 0) result.moneyOut += t.amount
      result.counts[t.type] = (result.counts[t.type] ?? 0) + 1
    }
    return result
  }, [txns, ownIds])

  // People on the other side of transfers: their names ("Jane S."), who you've paid before, your alerts.
  const names = usePayeeNames(useMemo(() => counterpartIds(txns, ownIds), [txns, ownIds]))
  const paid = useMemo(() => pastRecipients(txns, ownIds), [txns, ownIds])
  const knownIds = useMemo(() => new Set(paid.map((r) => r.accountId)), [paid])
  const recipients = paid.slice(0, 4).map((r) => ({ ...r, name: names[r.accountId] }))
  const alerts = useMemo(() => buildAlerts(txns, events, ownIds, user.username, names), [txns, events, ownIds, user.username, names])
  const unread = alerts.filter((a) => new Date(a.at).getTime() > seenAt).length

  function openAlerts() {
    setSeenWhenOpened(seenAt)
    setAlertsOpen(true)
    const now = Date.now()
    setSeenAt(now)
    try {
      localStorage.setItem(`sb_alerts_seen_${user.username}`, String(now))
    } catch {
      // ignore
    }
  }

  function toggleHidden() {
    const next = !hidden
    setHidden(next)
    try {
      localStorage.setItem(HIDE_KEY, next ? '1' : '0') // remembered on this device only
    } catch {
      // ignore
    }
  }

  function startMove(mode, amount, accountId, toAccountId) {
    setMoveRequest({ mode, amount, accountId, toAccountId, key: Date.now() }) // a new object = the form starts again
    scrollToId('move-money')
  }

  async function openAccount(type) {
    try {
      const account = await createAccount(customerId, type)
      await reloadMoney()
      toast(`${accountName(type)} account ${maskedAccount(account.id)} is open.`)
    } catch (err) {
      toast(errorMessage(err), 'bad')
    }
  }

  async function copyNumber(account) {
    try {
      await navigator.clipboard.writeText(accountNumber(account.id))
      toast(`Account number ${accountNumber(account.id)} copied.`)
    } catch {
      toast(`Your account number is ${accountNumber(account.id)}.`) // clipboard blocked: just show it
    }
  }

  // What Ctrl+K offers on this page. "deposit 50" becomes a ready-to-review deposit of $50.
  useCommands((query) => {
    const text = query.trim().toLowerCase()
    const quick = text.match(/^(deposit|withdraw|transfer|send)\s*\$?(\d+(?:\.\d{1,2})?)?$/)
    const items = []
    if (quick) {
      const mode = quick[1] === 'send' ? 'transfer' : quick[1]
      const label = { deposit: 'Deposit', withdraw: 'Withdraw', transfer: 'Transfer' }[mode]
      items.push({ id: 'quick', alwaysShow: true, icon: mode === 'deposit' ? 'down' : mode === 'withdraw' ? 'up' : 'swap',
        label: quick[2] ? `${label} ${money(Number(quick[2]))}` : `${label} money`, hint: 'Fills in Move money', run: () => startMove(mode, quick[2]) })
    }
    items.push(
      { id: 'deposit', label: 'Deposit money', icon: 'down', keywords: 'add put in', run: () => startMove('deposit') },
      { id: 'withdraw', label: 'Withdraw money', icon: 'up', keywords: 'take out cash', run: () => startMove('withdraw') },
      { id: 'transfer', label: 'Transfer money', icon: 'swap', keywords: 'send pay move', run: () => startMove('transfer') },
      { id: 'open-checking', label: 'Open a checking account', icon: 'plus', keywords: 'new account', run: () => openAccount('CHECKING') },
      { id: 'open-savings', label: 'Open a savings account', icon: 'plus', keywords: 'new account', run: () => openAccount('SAVINGS') },
      { id: 'statement', label: 'Monthly statements', icon: 'list', keywords: 'statement export csv pdf print excel', run: () => setStatementsOpen(true) },
      { id: 'alerts', label: 'Show alerts', icon: 'bell', keywords: 'notifications bell', run: openAlerts },
      { id: 'hide', label: hidden ? 'Show balances' : 'Hide balances', icon: hidden ? 'eye' : 'eyeOff', keywords: 'privacy balance', run: toggleHidden },
      { id: 'activity', label: 'Go to activity', icon: 'list', keywords: 'history transactions', run: () => scrollToId('activity') },
      { id: 'password', label: 'Change password', icon: 'key', keywords: 'security', run: () => { setSecurityPanel('password'); scrollToId('security') } },
      { id: 'everywhere', label: 'Sign out on every device', icon: 'shield', keywords: 'security devices sessions', run: () => { setSecurityPanel('signout'); scrollToId('security') } },
      ...accounts.map((a) => ({ id: `acct-${a.id}`, label: `${accountLabel(a)} ${maskedAccount(a.id)}`, hint: hidden ? '' : money(a.balance),
        icon: 'grid', keywords: `account ${accountNumber(a.id)} ${accountName(a.accountType)}`, run: () => scrollToId('accounts') })),
      ...recipients.filter((r) => r.name).map((r) => ({ id: `pay-${r.accountId}`, label: `Send money to ${r.name}`, hint: maskedAccount(r.accountId),
        icon: 'swap', keywords: 'pay send transfer', run: () => startMove('transfer', '', undefined, r.accountId) })),
    )
    if (text && !quick) {
      items.push({ id: 'search', alwaysShow: true, fallback: true, icon: 'search', label: `Search activity for “${query.trim()}”`,
        run: () => { setSearch(query.trim()); scrollToId('activity') } })
    }
    return items
  })

  useShellInfo({
    displayName: customer?.name,
    alert: { count: unread, label: unread ? `Alerts: ${unread} new` : 'Alerts', onClick: openAlerts },
  })

  if (loading) return <HomeSkeleton />
  if (error) return <div className="page"><div className="alert alert-error" role="alert">{error}</div></div>

  return (
    <div className="page">
      <div className="page-hello">
        <div>
          <div className="muted">{greeting()},</div>
          <h1>{customer?.name ?? user.username}</h1>
        </div>
        <p className="muted small no-margin hello-hint">Everything on one page. Press <kbd>Ctrl</kbd> <kbd>K</kbd> to jump anywhere.</p>
      </div>

      <div className="grid-2 top">
        <BalanceCard total={total} accountCount={accounts.length} moneyIn={month.moneyIn} moneyOut={month.moneyOut}
          hidden={hidden} onToggleHidden={toggleHidden} onQuick={(mode) => startMove(mode)} />

        <section id="move-money" className="card" aria-labelledby="mm-title">
          <div className="section-row">
            <h2 id="mm-title">Move money</h2>
            <span className="step-pill">{moveStep === 'review' ? 'Step 2 of 2 · Review' : 'Step 1 of 2'}</span>
          </div>
          <MoveMoneyForm accounts={accounts} request={moveRequest} hidden={hidden} onStepChange={setMoveStep}
            recipients={recipients} knownIds={knownIds}
            onDone={async (sentence) => {
              toast(sentence)
              await reloadMoney()
            }} />
        </section>
      </div>

      <AccountsSection accounts={accounts} txns={txns} hidden={hidden} onCopy={copyNumber} onOpen={openAccount}
        onMove={(a) => startMove('transfer', '', a.id)}
        onSaved={async (a) => { toast(`Saved ${accountLabel(a)} ${maskedAccount(a.id)}.`); await reloadMoney() }} />

      <div className="grid-2 wide-left">
        <ActivityCard txns={txns} ownIds={ownIds} username={user.username} names={names} hidden={hidden} search={search}
          onSearch={setSearch} onOpen={setReceipt} onStatements={() => setStatementsOpen(true)} />
        <div className="stack">
          <InsightsCard moneyIn={month.moneyIn} moneyOut={month.moneyOut} counts={month.counts}
            accounts={accounts} total={total} hidden={hidden} />
          <SecurityCard events={events} panel={securityPanel} setPanel={setSecurityPanel} onChanged={reloadEvents} />
        </div>
      </div>

      {receipt && (
        <ReceiptDrawer txn={receipt} ownIds={ownIds} username={user.username} names={names} onClose={() => setReceipt(null)}
          onRepeat={(t) => { setReceipt(null); startMove('transfer', t.amount, t.fromAccountId, t.toAccountId) }} />
      )}
      {statementsOpen && (
        <StatementDrawer customer={customer} accounts={accounts} txns={txns} ownIds={ownIds} names={names}
          onClose={() => setStatementsOpen(false)} />
      )}
      {alertsOpen && (
        <AlertsDrawer alerts={alerts} seenAt={seenWhenOpened} onClose={() => setAlertsOpen(false)}
          onOpenTxn={(t) => { setAlertsOpen(false); setReceipt(t) }}
          onSecurity={() => { setAlertsOpen(false); scrollToId('security') }} />
      )}
    </div>
  )
}
