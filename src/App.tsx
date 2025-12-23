import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import QnAManagement from './pages/QnAManagement'
import QnAGuideManagement from './pages/QnAGuideManagement'
import DocumentManagement from './pages/DocumentManagement'

function App() {
  return (
    <Router>
      <Layout>
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
