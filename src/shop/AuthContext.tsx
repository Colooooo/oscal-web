/* eslint-disable react-refresh/only-export-components -- Context and hook share an API. */
import { createContext, useContext, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
export type User = { id: string; name: string; email: string; verified: boolean; address: { phone?: string; street?: string; city?: string } }
export async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(path, { method, credentials: 'same-origin', ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000) })
  let data
  try { data = await response.json() } catch { throw new Error('No pudimos conectar con el servicio. Intentá nuevamente.') }
  if (!response.ok) throw new Error(data.error || 'No pudimos completar la solicitud.')
  return data
}
function useAuthState() {
  const enabled = useLocation().pathname !== "/"
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [unavailable, setUnavailable] = useState(false)
  useEffect(() => {
    if (!enabled) return
    let active = true
    api<{ user: User | null }>('/api/auth/session').then(data => { if (active) setUser(data.user) }).catch(() => { if (active) setUnavailable(true) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [enabled])
  return { user, loading, unavailable,
    async authenticate(mode: 'login' | 'register', form: { name: string; email: string; password: string }) {
      const data = await api<{ user: User }>(`/api/auth/${mode}`, 'POST', form)
      setUser(data.user); setUnavailable(false)
    },
    async refresh() { const data=await api<{user:User|null}>('/api/auth/session');setUser(data.user) },
    async logoutAll() { await api('/api/auth/logout-all','POST',{});setUser(null) },
    async logout() { await api('/api/auth/logout', 'POST', {}); setUser(null) },
    async saveAddress(address: User['address']) { const data = await api<{ user: User }>('/api/auth/address', 'PUT', address); setUser(data.user) },
  }
}
const Context = createContext<ReturnType<typeof useAuthState> | null>(null)
export function AuthProvider({ children }: { children: ReactNode }) { return <Context.Provider value={useAuthState()}>{children}</Context.Provider> }
export function useAuth() { const value = useContext(Context); if (!value) throw new Error('AuthProvider missing'); return value }
