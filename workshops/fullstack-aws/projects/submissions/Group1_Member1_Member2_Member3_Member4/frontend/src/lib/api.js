// Small fetch wrapper: adds the token, turns error responses into readable Error objects.
export const API_URL = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '')

const TOKEN_KEY = 'nbt.token'
let onUnauthorized = () => {}

export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn
}

export function getToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token) {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token)
    else sessionStorage.removeItem(TOKEN_KEY)
  } catch {
    /* storage blocked: stay signed in for this tab only */
  }
}

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message)
    this.status = status
    this.data = data || {}
  }
}

async function request(method, path, body) {
  const headers = {}
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  let res
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(
      import.meta.env.DEV
        ? `Can't reach the API at ${API_URL}. Is the backend running?`
        : "Can't reach the server. Check your connection and try again.",
      0,
    )
  }
  if (res.status === 204) return null
  let data = null
  try {
    data = await res.json()
  } catch {
    data = null
  }
  if (!res.ok) {
    if (res.status === 401 && path !== '/api/auth/login') onUnauthorized()
    const detail = data?.detail
    const message = typeof detail === 'string' ? detail : `Request failed (${res.status})`
    throw new ApiError(message, res.status, data)
  }
  return data
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body = {}) => request('POST', path, body),
  patch: (path, body) => request('PATCH', path, body),
  del: (path) => request('DELETE', path),
}

export function qs(params) {
  const p = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '' && v !== false) p.set(k, v)
  })
  const s = p.toString()
  return s ? `?${s}` : ''
}
