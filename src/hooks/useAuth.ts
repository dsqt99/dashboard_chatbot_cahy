import { useState } from 'react'

const AUTH_KEY = 'dashboard_auth'

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem(AUTH_KEY) === 'true'
  })

  const login = (username: string, password: string): boolean => {
    const validUser = import.meta.env.VITE_ADMIN_USERNAME
    const validPass = import.meta.env.VITE_ADMIN_PASSWORD
    if (username === validUser && password === validPass) {
      sessionStorage.setItem(AUTH_KEY, 'true')
      setIsAuthenticated(true)
      return true
    }
    return false
  }

  const logout = () => {
    sessionStorage.removeItem(AUTH_KEY)
    setIsAuthenticated(false)
  }

  return { isAuthenticated, login, logout }
}
