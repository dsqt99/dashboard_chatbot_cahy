import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import QnAManagement from './pages/QnAManagement'
import QnAGuideManagement from './pages/QnAGuideManagement'
import DocumentManagement from './pages/DocumentManagement'
import LoginPage from './pages/LoginPage'
import { useAuth } from './hooks/useAuth'

function App() {
  const { isAuthenticated, logout } = useAuth()

  if (!isAuthenticated) {
    return (
      <>
        <LoginPage onLoginSuccess={() => window.location.reload()} />
        <Toaster position="top-right" />
      </>
    )
  }

  return (
    <Router>
      <Layout onLogout={logout}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/qna" element={<QnAManagement />} />
          <Route path="/qna-guide" element={<QnAGuideManagement />} />
          <Route path="/documents" element={<DocumentManagement />} />
        </Routes>
      </Layout>
      <Toaster position="top-right" />
    </Router>
  )
}

export default App
