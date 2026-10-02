// Small display helpers used by many components.

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
export function money(amount) {
  return usd.format(amount ?? 0) // 1500 -> "$1,500.00"
}

// Account ids are small numbers; show them like a bank does: 3 -> "0003"
export function accountNumber(id) {
  return String(id).padStart(4, '0')
}
export function maskedAccount(id) {
  return `•••• ${accountNumber(id)}`
}

export function accountName(type) {
  return type === 'SAVINGS' ? 'Savings' : 'Checking'
}

export function shortDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
export function shortTime(iso) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

// "Good morning" / "Good afternoon" / "Good evening"
export function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export function initials(text) {
  return (text ?? '?')
    .split(/\s+/)
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

// "Today", "Yesterday", or "Mon, Sep 28" for grouping activity by day
export function dayLabel(iso) {
  const day = new Date(iso)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (day.toDateString() === today.toDateString()) return 'Today'
  if (day.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

// "Today, 3:01 PM" / "Sep 28, 11:04 AM"
export function whenText(iso) {
  const label = dayLabel(iso)
  const date = label === 'Today' || label === 'Yesterday'
    ? label
    : new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${date}, ${shortTime(iso)}`
}

export function isThisMonth(iso) {
  const day = new Date(iso)
  const now = new Date()
  return day.getMonth() === now.getMonth() && day.getFullYear() === now.getFullYear()
}

// money() that respects the "hide balances" eye button
export function maybeMoney(amount, hidden) {
  return hidden ? '••••••' : money(amount)
}

// What to call an account: the owner's nickname if they set one, otherwise "Savings" / "Checking".
export function accountLabel(account) {
  return account?.nickname || accountName(account?.accountType)
}

// "2026-09" -> "September 2026"
export function monthLabel(key) {
  const [year, month] = key.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

// The local "YYYY-MM" a timestamp falls in
export function monthKey(iso) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
