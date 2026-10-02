// Where the login is kept between page reloads: the browser's localStorage.
// Trade-off to know for interviews: any script running on the page can read localStorage,
// so an XSS bug could steal the token. Many real banks use httpOnly cookies instead.
// localStorage keeps this project simple and lets you SEE the token in DevTools > Application.
const TOKEN_KEY = 'sb_token'
const USER_KEY = 'sb_user'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function saveSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

// The saved user, or null if there is none or the token has already expired.
export function readUser() {
  const token = getToken()
  const raw = localStorage.getItem(USER_KEY)
  if (!token || !raw || isExpired(token)) {
    clearSession()
    return null
  }
  try {
    return JSON.parse(raw)
  } catch {
    clearSession()
    return null
  }
}

// A JWT is header.payload.signature. The payload is base64 JSON that ANYONE can read
// (it's signed, not encrypted), so the browser can check the "exp" time without the secret.
// The server still checks the signature on every request; this is only a convenience.
export function tokenExpiry(token) {
  // when the token stops working, in milliseconds (what Date.now() uses), or 0 if unreadable
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(part)).exp * 1000
  } catch {
    return 0
  }
}

export function isExpired(token) {
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(atob(part))
    return payload.exp * 1000 < Date.now() // exp is in seconds, Date.now() in milliseconds
  } catch {
    return true
  }
}

// ---------- "Remember my username" on the sign-in page ----------
// Only the USERNAME is kept (never the password), and only if they ticked the box.
const REMEMBER_KEY = 'sb_remember'
const LAST_USERNAME_KEY = 'sb_last_username'

export function getRememberChoice() {
  try {
    return localStorage.getItem(REMEMBER_KEY) === '1'
  } catch {
    return false
  }
}

export function setRememberChoice(on) {
  try {
    localStorage.setItem(REMEMBER_KEY, on ? '1' : '0')
    if (!on) localStorage.removeItem(LAST_USERNAME_KEY)
  } catch {
    // storage blocked: the box just won't be remembered
  }
}

export function getRememberedUsername() {
  try {
    return localStorage.getItem(LAST_USERNAME_KEY) ?? ''
  } catch {
    return ''
  }
}

// Called after a successful sign-in.
export function rememberUsername(username) {
  try {
    if (getRememberChoice()) localStorage.setItem(LAST_USERNAME_KEY, username)
  } catch {
    // ignore
  }
}
