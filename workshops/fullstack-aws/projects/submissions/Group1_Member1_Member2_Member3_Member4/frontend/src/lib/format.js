export function fmtDate(value) {
  if (!value) return '—'
  const d = value.length === 10 ? new Date(`${value}T00:00:00`) : new Date(value)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function fmtShort(value) {
  if (!value) return '—'
  const d = value.length === 10 ? new Date(`${value}T00:00:00`) : new Date(value)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function fmtDateTime(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

export function timeAgo(value) {
  if (!value) return 'never'
  const secs = Math.round((Date.now() - new Date(value).getTime()) / 1000)
  if (secs < 60) return 'just now'
  const mins = Math.round(secs / 60)
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs} h ago`
  const days = Math.round(hrs / 24)
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`
  return fmtDate(value)
}

export function daysUntil(dateStr) {
  if (!dateStr) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(`${dateStr}T00:00:00`)
  return Math.round((d - today) / 86400000)
}

export function dueLabel(dateStr) {
  const n = daysUntil(dateStr)
  if (n === null) return 'No due date'
  if (n < 0) return `${-n} day${n === -1 ? '' : 's'} overdue`
  if (n === 0) return 'Due today'
  if (n === 1) return 'Due tomorrow'
  return `Due in ${n} days`
}

export function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('')
}

export const STATUS = {
  ON_TRACK: { label: 'On track', tone: 'good' },
  COMPLETE: { label: 'Complete', tone: 'good' },
  BEHIND: { label: 'Behind', tone: 'warn' },
  NOT_REPORTING: { label: 'Not reporting', tone: 'warn' },
  BLOCKED: { label: 'Blocked', tone: 'bad' },
  UNASSIGNED: { label: 'Unassigned', tone: 'muted' },
  INACTIVE: { label: 'Inactive', tone: 'muted' },
  IN_PROGRESS: { label: 'In progress', tone: 'info' },
  DONE: { label: 'Done', tone: 'good' },
  ACTIVE: { label: 'Active', tone: 'good' },
  ARCHIVED: { label: 'Archived', tone: 'muted' },
  NORMAL: { label: 'Normal', tone: 'muted' },
  IMPORTANT: { label: 'Important', tone: 'warn' },
  URGENT: { label: 'Urgent', tone: 'bad' },
  HR: { label: 'HR', tone: 'info' },
  MANAGER: { label: 'Manager', tone: 'info' },
  TRAINEE: { label: 'Trainee', tone: 'muted' },
}
