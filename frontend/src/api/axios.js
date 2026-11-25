import axios from 'axios'

const TOKEN_KEY = 'kanban.token'

// Single source of truth for the JWT: localStorage, so a refresh keeps the session.
export const tokenStore = {
  get() {
    return localStorage.getItem(TOKEN_KEY)
  },
  set(token) {
    localStorage.setItem(TOKEN_KEY, token)
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY)
  },
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api',
  headers: { 'Content-Type': 'application/json' },
})

// Every request carries the bearer token when one is stored.
api.interceptors.request.use((config) => {
  const token = tokenStore.get()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// An expired/invalid token drops the session once, instead of on every request.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status
    const isAuthCall = /\/auth\/(login|register)$/.test(error.config?.url ?? '')
    if (status === 401 && !isAuthCall && tokenStore.get()) {
      tokenStore.clear()
      window.dispatchEvent(new Event('kanban:unauthorized'))
    }
    return Promise.reject(error)
  },
)

// API errors are `{ "error": "message" }`; surface that, never a raw axios string.
export function errorMessage(error, fallback = 'Something went wrong') {
  return error?.response?.data?.error ?? error?.response?.data?.details ?? fallback
}

export default api
