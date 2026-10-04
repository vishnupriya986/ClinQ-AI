import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { apiRequest } from '../services/api'
import type { AuthStatus, User } from '../types'

interface AuthContextValue {
  user: User | null
  status: AuthStatus
  refresh: () => Promise<User | null>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')

  const refresh = useCallback(async () => {
    setStatus('loading')
    try {
      const result = await apiRequest<{ user: User }>('/api/auth/me')
      setUser(result.user)
      setStatus('authenticated')
      return result.user
    } catch (error) {
      if (error instanceof Error && 'status' in error && error.status === 401) {
        setUser(null)
        setStatus('anonymous')
        return null
      }
      setStatus('error')
      throw error
    }
  }, [])

  useEffect(() => {
    void refresh().catch(() => undefined)
  }, [refresh])

  const signOut = useCallback(async () => {
    await apiRequest<{ message: string }>('/api/auth/logout', { method: 'POST' })
    setUser(null)
    setStatus('anonymous')
  }, [])

  const value = useMemo(() => ({ user, status, refresh, signOut }), [user, status, refresh, signOut])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used within AuthProvider')
  return value
}
