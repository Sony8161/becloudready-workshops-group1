import { maskedAccount } from './format.js'

// Turns one transaction into what a PERSON wants to read, from the point of view of
// whoever owns `ownIds` (a customer's account ids):
//   direction  +1 money came in, -1 money went out, 0 moved between their own accounts
//   text       "Sent to Jane S. •••• 0003", "Deposit to •••• 0001", ...
//   icon       which arrow to draw
// names = { 3: "Jane S." } from the payee lookup, when we know who's behind an account number.
export function describe(txn, ownIds = new Set(), names = {}) {
  const from = txn.fromAccountId
  const to = txn.toAccountId
  const who = (id) => (names[id] ? `${names[id]} ${maskedAccount(id)}` : maskedAccount(id))
  if (txn.type === 'DEPOSIT') return { direction: 1, icon: 'down', text: `Deposit to ${maskedAccount(to)}` }
  if (txn.type === 'WITHDRAW') return { direction: -1, icon: 'up', text: `Withdrawal from ${maskedAccount(from)}` }
  if (ownIds.has(from) && ownIds.has(to)) {
    return { direction: 0, icon: 'swap', text: `Between your accounts ${maskedAccount(from)} → ${maskedAccount(to)}` }
  }
  if (ownIds.has(from)) return { direction: -1, icon: 'swap', text: `Sent to ${who(to)}` }
  if (ownIds.has(to)) return { direction: 1, icon: 'swap', text: `Received from ${who(from)}` }
  return { direction: 0, icon: 'swap', text: `Transfer ${maskedAccount(from)} → ${maskedAccount(to)}` } // staff view
}

// Only you or the bank can move money OUT of (or deposit INTO) your accounts, so if someone else's
// name is on one of those, it was a teller. (Money SENT to you shows the sender's name instead.)
export function byStaff(t, ownIds, username) {
  if (!t.performedBy || t.performedBy === username) return false
  return t.type !== 'TRANSFER' || ownIds.has(t.fromAccountId)
}

export const TYPE_LABEL = { DEPOSIT: 'Deposit', WITHDRAW: 'Withdrawal', TRANSFER: 'Transfer' }

// The filter chips used above every activity list.
export const TYPE_CHIPS = [
  { value: 'ALL', label: 'All' },
  { value: 'DEPOSIT', label: 'Deposits' },
  { value: 'WITHDRAW', label: 'Withdrawals' },
  { value: 'TRANSFER', label: 'Transfers' },
]

// How much this transaction changed ONE account's balance (+ in, - out, 0 not involved).
export function effectOn(txn, accountId) {
  if (txn.toAccountId === accountId && txn.fromAccountId !== accountId) return txn.amount
  if (txn.fromAccountId === accountId && txn.toAccountId !== accountId) return -txn.amount
  return 0
}

// Rebuild an account's balance history from its transactions, for the little line chart.
// We only store the CURRENT balance, so walk backwards: before each move the balance was
// (balance after) - (what that move added). Returns oldest -> newest, ending at today's balance.
export function balanceHistory(account, txns, maxPoints = 12) {
  const mine = txns.filter((t) => effectOn(t, account.id) !== 0) // txns arrive newest first
  const points = [account.balance]
  let balance = account.balance
  for (const t of mine.slice(0, maxPoints - 1)) {
    balance -= effectOn(t, account.id)
    points.push(balance)
  }
  return points.reverse()
}

// Group a newest-first list by day: [{ label: 'Today', items: [...] }, ...]
export function groupByDay(txns, labelOf) {
  const groups = []
  for (const t of txns) {
    const label = labelOf(t.timestamp)
    const last = groups[groups.length - 1]
    if (last && last.label === label) last.items.push(t)
    else groups.push({ label, items: [t] })
  }
  return groups
}

// Labels + colours for the sign-in log
export const EVENT_INFO = {
  LOGIN_SUCCESS: { label: 'Signed in', tone: 'good' },
  LOGIN_FAILED: { label: 'Wrong password', tone: 'warn' },
  LOCKED_OUT: { label: 'Locked out', tone: 'bad' },
  LOGIN_BLOCKED: { label: 'Tried while locked', tone: 'bad' },
  REGISTERED: { label: 'Signed up', tone: 'info' },
  LOGIN_CREATED: { label: 'Login turned on', tone: 'info' },
  USERNAME_REMINDER: { label: 'Username reminder', tone: 'info' },
  PASSWORD_RESET_REQUESTED: { label: 'Reset link sent', tone: 'info' },
  PASSWORD_RESET: { label: 'Password reset', tone: 'good' },
  PASSWORD_CHANGED: { label: 'Password changed', tone: 'good' },
  SIGNED_OUT_EVERYWHERE: { label: 'Signed out everywhere', tone: 'info' },
  UNLOCKED: { label: 'Unlocked by staff', tone: 'good' },
  TEMP_PASSWORD_SET: { label: 'Temporary password', tone: 'warn' },
}

export const PROBLEM_EVENTS = new Set(['LOGIN_FAILED', 'LOCKED_OUT', 'LOGIN_BLOCKED'])

// Wrong passwords etc. since the sign-in BEFORE this one = things you haven't seen yet.
export function problemsSinceLastVisit(events) {
  const successes = events.map((e, i) => (e.type === 'LOGIN_SUCCESS' ? i : -1)).filter((i) => i >= 0)
  const end = successes.length > 1 ? successes[1] : events.length // events are newest first
  return events.slice(0, end).filter((e) => PROBLEM_EVENTS.has(e.type))
}


// ---------- People you've paid ----------
// Everyone you've sent money to (not your own accounts), most recent first:
// [{ accountId: 3, lastAmount: 150, lastAt: "...", times: 2 }]
export function pastRecipients(txns, ownIds) {
  const seen = new Map()
  for (const t of txns) { // newest first
    if (t.type !== 'TRANSFER' || !ownIds.has(t.fromAccountId) || ownIds.has(t.toAccountId)) continue
    const r = seen.get(t.toAccountId)
    if (r) r.times += 1
    else seen.set(t.toAccountId, { accountId: t.toAccountId, lastAmount: t.amount, lastAt: t.timestamp, times: 1 })
  }
  return [...seen.values()]
}

// Every account number on the other side of a transfer, for the name lookup.
export function counterpartIds(txns, ownIds) {
  const ids = new Set()
  for (const t of txns) {
    if (t.type !== 'TRANSFER') continue
    if (!ownIds.has(t.toAccountId)) ids.add(t.toAccountId)
    if (!ownIds.has(t.fromAccountId)) ids.add(t.fromAccountId)
  }
  return [...ids]
}

// ---------- Alerts (the customer's bell) ----------
export const LARGE_AMOUNT = 1000
const SECURITY_ALERTS = {
  LOGIN_FAILED: { title: 'Wrong password entered', tone: 'warn' },
  LOCKED_OUT: { title: 'Your login was locked', tone: 'bad' },
  LOGIN_BLOCKED: { title: 'Sign-in tried while locked', tone: 'bad' },
  PASSWORD_CHANGED: { title: 'Your password was changed', tone: 'info' },
  PASSWORD_RESET: { title: 'Your password was reset', tone: 'info' },
  SIGNED_OUT_EVERYWHERE: { title: 'All other devices were signed out', tone: 'info' },
  TEMP_PASSWORD_SET: { title: 'The bank gave you a temporary password', tone: 'warn' },
  UNLOCKED: { title: 'The bank unlocked your login', tone: 'info' },
}

// Built from data the page already has (transactions + my sign-in events): no extra requests.
export function buildAlerts(txns, events, ownIds, username, names = {}) {
  const alerts = []
  for (const t of txns) {
    const d = describe(t, ownIds, names)
    if (t.type === 'TRANSFER' && d.direction > 0) {
      alerts.push({ id: `t${t.id}`, kind: 'money', tone: 'good', icon: 'down', title: `You received ${fmt(t.amount)}`, detail: d.text, at: t.timestamp, txn: t })
    } else if (d.direction < 0 && t.amount >= LARGE_AMOUNT) {
      alerts.push({ id: `t${t.id}`, kind: 'money', tone: 'warn', icon: 'up', title: `Large payment: ${fmt(t.amount)}`, detail: d.text, at: t.timestamp, txn: t })
    }
    if (byStaff(t, ownIds, username) && t.type !== 'TRANSFER') {
      alerts.push({ id: `s${t.id}`, kind: 'money', tone: 'info', icon: 'user', title: `Bank staff made a ${TYPE_LABEL[t.type].toLowerCase()} of ${fmt(t.amount)}`, detail: d.text, at: t.timestamp, txn: t })
    }
  }
  // sign-ins from an address not seen before (events arrive newest first)
  const successes = events.filter((e) => e.type === 'LOGIN_SUCCESS')
  successes.forEach((e, i) => {
    const older = successes.slice(i + 1)
    if (older.length && e.ip && !older.some((o) => o.ip === e.ip)) {
      alerts.push({ id: `e${e.id}`, kind: 'security', tone: 'warn', icon: 'shield', title: 'Sign-in from a new place', detail: `IP address ${e.ip}`, at: e.timestamp })
    }
  })
  for (const e of events) {
    const info = SECURITY_ALERTS[e.type]
    if (info) alerts.push({ id: `e${e.id}`, kind: 'security', tone: info.tone, icon: 'shield', title: info.title, detail: e.ip ? `From ${e.ip}` : 'By the bank', at: e.timestamp })
  }
  return alerts.sort((a, b) => new Date(b.at) - new Date(a.at))
}

function fmt(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

// ---------- Statements ----------
// An account's balance at a moment in the past: today's balance minus every move after that moment.
export function balanceAt(account, txns, when) {
  const after = txns.filter((t) => new Date(t.timestamp) >= when)
  return after.reduce((bal, t) => bal - effectOn(t, account.id), account.balance)
}

// Opening/closing balance, money in/out and the rows for one month ("2026-09") of the chosen accounts.
export function monthlyStatement(accounts, txns, key) {
  const [year, month] = key.split('-').map(Number)
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 1)
  const ids = new Set(accounts.map((a) => a.id))
  const rows = txns
    .filter((t) => new Date(t.timestamp) >= start && new Date(t.timestamp) < end)
    .filter((t) => ids.has(t.fromAccountId) || ids.has(t.toAccountId))
    .reverse() // oldest first, like a paper statement
  const opening = accounts.reduce((sum, a) => sum + balanceAt(a, txns, start), 0)
  let running = opening
  let moneyIn = 0
  let moneyOut = 0
  const lines = rows.map((t) => {
    const change = accounts.reduce((sum, a) => sum + effectOn(t, a.id), 0)
    if (change > 0) moneyIn += change
    if (change < 0) moneyOut -= change
    running += change
    return { txn: t, change, balance: running }
  })
  return { start, end, opening, closing: running, moneyIn, moneyOut, lines }
}
