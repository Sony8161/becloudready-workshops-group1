import api from './api.js'

// Dashboard totals, counted by MongoDB: one small request instead of downloading every record.
export async function getAdminStats() {
  const res = await api.get('/admin/stats')
  return res.data // { customers, accounts, savingsAccounts, totalBalance, premiumAccounts, ... }
}

// One page of customers, each with account count, total balance and login status.
// The SERVER filters and pages, so this stays fast with 1 customer or 1 million.
export async function getAdminCustomers({ query = '', premium = false, limit = 25, skip = 0 } = {}) {
  const params = { limit, skip }
  if (query.trim()) params.query = query.trim()
  if (premium) params.premium = true
  const res = await api.get('/admin/customers', { params })
  return { items: res.data, total: Number(res.headers['x-total-count'] ?? res.data.length) }
}

// Staff notes about one customer ("Called 10/1 about the lockout"), newest first.
export async function getCustomerNotes(customerId) {
  const res = await api.get(`/admin/customers/${customerId}/notes`)
  return res.data
}

export async function addCustomerNote(customerId, text) {
  const res = await api.post(`/admin/customers/${customerId}/notes`, { text })
  return res.data
}
