import api from './api.js'

// DATA SERVICE for logins: sign in, sign up, forgot / reset / change password, staff tools.

export async function login(username, password) {
  const res = await api.post('/auth/login', { username, password })
  return res.data // { accessToken, tokenType, user: { id, username, role, customerId } }
}

export async function register({ name, email, username, password }) {
  const res = await api.post('/auth/register', { name, email, username, password })
  return res.data // same shape as login: sign-up logs you straight in
}

// ---------- Signed out: "I forgot..." ----------
// Both answer with the SAME message whether or not the account exists,
// so nobody can use these forms to find out who banks here.

export async function forgotUsername(email) {
  const res = await api.post('/auth/forgot-username', { email })
  return res.data.message
}

export async function forgotPassword(usernameOrEmail) {
  const res = await api.post('/auth/forgot-password', { usernameOrEmail })
  return res.data.message
}

// token = the long code from the emailed link (/reset-password?token=...)
export async function resetPassword(token, newPassword) {
  const res = await api.post('/auth/reset-password', { token, newPassword })
  return res.data.message
}

// ---------- Signed in: my own login ----------

export async function getMe() {
  const res = await api.get('/auth/me')
  return res.data
}

// Returns a NEW session: changing the password signs out every other device,
// so the old token stops working and this browser gets a fresh one.
export async function changePassword(currentPassword, newPassword) {
  const res = await api.put('/auth/me/password', { currentPassword, newPassword })
  return res.data
}

export async function signOutEverywhere() {
  const res = await api.post('/auth/me/sign-out-everywhere')
  return res.data // a fresh session for THIS browser
}

// My sign-ins, wrong passwords, resets... newest first.
export async function getMyEvents(limit = 20) {
  const res = await api.get('/auth/me/events', { params: { limit } })
  return res.data
}

// ---------- Staff only ----------

export async function listLogins() {
  const res = await api.get('/auth/users')
  return res.data
}

// Turn on online banking for an existing customer.
export async function createLogin(customerId, username, password) {
  const res = await api.post('/auth/users', { customerId, username, password })
  return res.data
}

// End a lockout early (after 5 wrong passwords).
export async function unlockLogin(userId) {
  const res = await api.post(`/auth/users/${userId}/unlock`)
  return res.data // LoginInfo: { id, username, locked, failedLogins, ... }
}

// The bank sets a new random password and reads it to the customer once.
export async function setTemporaryPassword(userId) {
  const res = await api.post(`/auth/users/${userId}/temporary-password`)
  return res.data // { username, temporaryPassword }
}

// "Stay signed in": a fresh token while the current one still works.
export async function refreshSession() {
  const res = await api.post('/auth/refresh')
  return res.data // a new session, same shape as login
}
