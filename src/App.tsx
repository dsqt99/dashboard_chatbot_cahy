import { Loader2 } from 'lucide-react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { useAuth } from './hooks/useAuth'
import AgentTest from './pages/AgentTest'
import Conversations from './pages/Conversations'
import Documents from './pages/Documents'
import LoginPage from './pages/LoginPage'
import Overview from './pages/Overview'
import Sources from './pages/Sources'

export default function App() {
  const { user, checking, login, logout } = useAuth()

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
        <Layout user={user} onLogout={logout}>
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/sources" element={<Sources />} />
            <Route path="/agent-test" element={<AgentTest />} />
            <Route path="/conversations" element={<Conversations />} />
            <Route path="/documents" element={<Documents />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      )}
    </BrowserRouter>
  )
}
