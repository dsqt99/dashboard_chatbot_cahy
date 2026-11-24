import { useCallback, useEffect, useState } from 'react'
import { api, auth, type User } from '../lib/api'

/** Phiên đăng nhập qua HttpOnly cookie của admin API (dùng chung với Zalo OA). */
export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    auth.clearLegacy()
    api.me().then(setUser).catch(() => setUser(null)).finally(() => setChecking(false))
  }, [])

  useEffect(() => {
    const onExpired = () => setUser(null)
    window.addEventListener('auth:expired', onExpired)
    return () => window.removeEventListener('auth:expired', onExpired)
  }, [])

  const login = useCallback((_token: string, u: User) => {
    setUser(u)
  }, [])

  const logout = useCallback(() => {
    void api.logout().catch(() => {})
    setUser(null)
  }, [])

  return { user, checking, login, logout, updateUser: setUser }
}
