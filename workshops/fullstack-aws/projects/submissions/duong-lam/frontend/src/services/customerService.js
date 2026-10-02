import api from './api.js'

// DATA SERVICE for customers: the only file that knows the customer URLs.
// Components call these functions; they never build URLs or call Axios themselves.
// Each function waits for the response and returns just the JSON body (res.data).

export async function getAllCustomers() {
  const res = await api.get('/customers') // GET /api/customers
  return res.data
}

export async function getCustomerById(id) {
  const res = await api.get(`/customers/${id}`) // GET /api/customers/7
  return res.data
}

export async function createCustomer(customer) {
  const res = await api.post('/customers', customer) // body: { name, email }
  return res.data
}

export async function updateCustomer(id, customer) {
  const res = await api.put(`/customers/${id}`, customer)
  return res.data
}

export async function deleteCustomer(id) {
  await api.delete(`/customers/${id}`) // 204: nothing to return
}

export async function getCustomerAccounts(id) {
  const res = await api.get(`/customers/${id}/accounts`)
  return res.data
}

// The two filters below need the backend TODO routes (/search and /premium) to be done.
export async function searchCustomersByName(name) {
  const res = await api.get('/customers/search', { params: { name } }) // ?name=jo
  return res.data
}

export async function getPremiumCustomers(threshold) {
  const res = await api.get('/customers/premium', { params: { threshold } }) // ?threshold=1000
  return res.data
}

// Every transaction that touched this customer's accounts (money in and out), newest first.
export async function getCustomerTransactions(id) {
  const res = await api.get(`/customers/${id}/transactions`)
  return res.data
}
