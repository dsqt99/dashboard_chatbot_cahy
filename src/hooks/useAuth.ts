import { useCallback, useEffect, useState } from 'react'
import { api, auth, type User } from '../lib/api'

/** Phiên đăng nhập bằng JWT của admin API (tài khoản dùng chung với trang quản trị Zalo OA). */
export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [checking, setChecking] = useState(!!auth.get())

  useEffect(() => {
    if (!auth.get()) return
    api.me().then(setUser).catch(() => auth.clear()).finally(() => setChecking(false))
  }, [])

  useEffect(() => {
    const onExpired = () => setUser(null)
    window.addEventListener('auth:expired', onExpired)
    return () => window.removeEventListener('auth:expired', onExpired)
  }, [])

  const login = useCallback((token: string, u: User) => {
    auth.set(token)
    setUser(u)
  }, [])

  const logout = useCallback(() => {
    auth.clear()
    setUser(null)
  }, [])

  return { user, checking, login, logout, updateUser: setUser }
}
