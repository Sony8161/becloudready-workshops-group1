import api from './api.js'

// DATA SERVICE for accounts. Ready for the account screens.

export async function getAccount(id) {
  const res = await api.get(`/accounts/${id}`)
  return res.data
}

export async function createAccount(customerId, accountType) {
  const res = await api.post('/accounts', { customerId, accountType })
  return res.data
}

export async function deposit(id, amount) {
  const res = await api.post(`/accounts/${id}/deposit`, { amount })
  return res.data
}

export async function withdraw(id, amount) {
  const res = await api.post(`/accounts/${id}/withdraw`, { amount })
  return res.data
}

export async function getPremiumAccounts(threshold) {
  const res = await api.get('/accounts/premium', { params: { threshold } })
  return res.data
}

export async function getAccountTransactions(id) {
  const res = await api.get(`/accounts/${id}/transactions`)
  return res.data
}

// admin only
export async function getAllAccounts() {
  const res = await api.get('/accounts')
  return res.data
}

export async function transfer(fromAccountId, toAccountId, amount) {
  const res = await api.post('/transfers', { fromAccountId, toAccountId, amount })
  return res.data // the audit record of the transfer
}

// Confirmation of payee: who owns an account number, as "Jane S.", before you send money.
export async function getPayee(id) {
  const res = await api.get(`/accounts/${id}/payee`)
  return res.data // { accountId, name }
}

// The owner's own labels for an account. Never changes the balance.
export async function updateAccountSettings(id, { nickname, goal }) {
  const res = await api.patch(`/accounts/${id}/settings`, { nickname, goal })
  return res.data
}
