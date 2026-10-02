import api from './api.js'

// DATA SERVICE for the audit trail (admin only).

// One page of the audit log, filtered by the SERVER. Returns the rows + how many match in all
// (the X-Total-Count header), so the page can say "Showing 1-25 of 230".
export async function getTransactionsPage({ limit = 25, skip = 0, type, customerId } = {}) {
  const params = { limit, skip }
  if (type && type !== 'ALL') params.type = type
  if (customerId) params.customerId = customerId
  const res = await api.get('/audit/transactions', { params })
  return { items: res.data, total: Number(res.headers['x-total-count'] ?? res.data.length) }
}

// The sign-in log: logins, wrong passwords, lockouts, sign-ups, resets.
// problems = true keeps only wrong passwords and lockouts.
export async function getSecurityEvents({ limit = 25, skip = 0, problems = false } = {}) {
  const params = { limit, skip }
  if (problems) params.problems = true
  const res = await api.get('/audit/security-events', { params })
  return { items: res.data, total: Number(res.headers['x-total-count'] ?? res.data.length) }
}
