import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import api, { tokenStore } from '../api/axios.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  // `ready` is false until the stored token is validated, so routes never flash.
  const [ready, setReady] = useState(false)

  const logout = useCallback(() => {
    tokenStore.clear()
    setUser(null)
  }, [])

  // Restore the session on reload: token -> /auth/me.
  useEffect(() => {
    let cancelled = false

    async function restore() {
      if (!tokenStore.get()) {
        setReady(true)
        return
      }
      try {
        const { data } = await api.get('/auth/me')
        if (!cancelled) setUser(data.data.user)
      } catch {
        tokenStore.clear()
      } finally {
        if (!cancelled) setReady(true)
      }
    }

    restore()
    return () => {
      cancelled = true
    }
  }, [])

  // Triggered by the axios interceptor when the API rejects the token.
  useEffect(() => {
    window.addEventListener('kanban:unauthorized', logout)
    return () => window.removeEventListener('kanban:unauthorized', logout)
  }, [logout])

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password })
    tokenStore.set(data.data.token)
    setUser(data.data.user)
    return data.data.user
  }, [])

  const register = useCallback(async (name, email, password) => {
    const { data } = await api.post('/auth/register', { name, email, password })
    tokenStore.set(data.data.token)
    setUser(data.data.user)
    return data.data.user
  }, [])

  const value = useMemo(
    () => ({ user, ready, login, register, logout }),
    [user, ready, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>')
  return context
}
