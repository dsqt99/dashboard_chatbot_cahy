import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { useAuth } from './hooks/useAuth'
import Agents from './pages/Agents'
import Conversations from './pages/Conversations'
import LoginPage from './pages/LoginPage'
import OAs from './pages/OAs'
import Portals from './pages/Portals'
import Overview from './pages/Overview'
import Users from './pages/Users'
import Wiki from './pages/Wiki'
import type { User } from './lib/api'
import type { WikiSession } from './lib/wikiApi'

function Dashboard({ user, logout, updateUser }: {
  user: User
  logout: () => void
  updateUser: (user: User) => void
}) {
  const [wikiSession, setWikiSession] = useState<WikiSession | null>(null)

  return (
    <Layout user={user} onLogout={logout} onUserUpdate={updateUser}>
      <Routes>
        <Route path="/" element={<Overview />} />
        <Route path="/sources" element={<Navigate to="/oas" replace />} />
        <Route path="/oas" element={<OAs />} />
        <Route path="/oas/portals" element={<Portals />} />
        <Route path="/agents" element={<Agents />} />
        <Route path="/agent-test" element={<Navigate to="/agents" replace />} />
        <Route path="/conversations" element={<Conversations />} />
        <Route path="/documents" element={<Navigate to="/wiki/documents" replace />} />
        <Route path="/wiki/*" element={
          <Wiki
            session={wikiSession}
            onLogin={setWikiSession}
            onLogout={(token) => setWikiSession((current) => current?.token === token ? null : current)}
          />
        } />
        <Route path="/users" element={user.role === 'admin' ? <Users /> : <Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}

export default function App() {
  const { user, checking, login, logout, updateUser } = useAuth()

  if (checking)
    return (
      <div className="flex min-h-dvh items-center justify-center text-muted" role="status">
        <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
        <span className="sr-only">Đang kiểm tra phiên đăng nhập</span>
      </div>
    )

  return (
    <BrowserRouter>
      {!user ? (
        <LoginPage onLogin={login} />
      ) : (
        <Dashboard key={user.id} user={user} logout={logout} updateUser={updateUser} />
      )}
    </BrowserRouter>
  )
}
