import axios from 'axios'
import { getToken } from '../auth/session.js'

// One Axios "instance" for the whole app: every request starts with this base URL.
// Change it in a .env file (VITE_API_URL=...) without touching code.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000/api',
  timeout: 10000, // give up after 10 seconds instead of spinning forever
})

// How many requests are in flight right now. TopLoader shows a bar while this is above 0.
let pending = 0
function changePending(step) {
  pending = Math.max(0, pending + step)
  window.dispatchEvent(new CustomEvent('api:loading', { detail: pending }))
}

// REQUEST INTERCEPTOR: runs before EVERY request. Adds the login token if we have one,
// so no service function has to remember to do it.
api.interceptors.request.use((config) => {
  const token = getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  changePending(+1)
  return config
})

// The signed-OUT auth routes. A 401 from these means "wrong password", not "your session ended".
const PUBLIC_AUTH = ['/auth/login', '/auth/register', '/auth/forgot-username', '/auth/forgot-password', '/auth/reset-password']

// RESPONSE INTERCEPTOR: runs on every failed response. A 401 means the token is missing,
// expired, fake, or was cancelled by "sign out everywhere", so tell AuthContext to log out
// (it listens for this event) and pass along the server's reason for the login page.
api.interceptors.response.use(
  (response) => {
    changePending(-1)
    return response
  },
  (error) => {
    changePending(-1)
    const url = error.config?.url ?? ''
    if (error.response?.status === 401 && !PUBLIC_AUTH.includes(url)) {
      const reason = error.response.data?.detail
      window.dispatchEvent(new CustomEvent('auth:expired', { detail: typeof reason === 'string' ? reason : '' }))
    }
    return Promise.reject(error) // the page's catch block still runs
  },
)

// Turns any failed request into ONE readable sentence for the screen.
export function errorMessage(error) {
  if (error.response) {
    // The backend answered, but with an error status (404, 400, 422, 500...)
    const detail = error.response.data?.detail
    if (typeof detail === 'string') return detail // our HTTPException messages, e.g. "Customer not found"
    if (Array.isArray(detail)) return detail.map((d) => d.msg).join('; ') // Pydantic 422 validation list
    return `Request failed with status ${error.response.status}`
  }
  if (error.request) {
    // The request went out but nothing came back: server down, wrong URL, or blocked by CORS
    return import.meta.env.DEV
      ? 'Cannot reach the server. Is the backend running on port 8000?'
      : 'Cannot reach the server right now. Please try again in a moment.'
  }
  return error.message
}

export default api
