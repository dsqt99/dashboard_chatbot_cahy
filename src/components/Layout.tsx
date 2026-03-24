import { ReactNode, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { 
  LayoutDashboard, 
  BookOpen,
  MessageSquare, 
  FileText, 
  Menu,
  X,
  ChevronRight,
  LogOut
} from 'lucide-react'

interface LayoutProps {
  children: ReactNode
  onLogout?: () => void
}

const menuItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/qna', label: 'Lịch sử trò chuyện', icon: MessageSquare },
  { path: '/qna-guide', label: 'Câu hỏi hướng dẫn', icon: BookOpen },
  { path: '/documents', label: 'Tài liệu PDF', icon: FileText },
]

export default function Layout({ children, onLogout }: LayoutProps) {
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-gray-900/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50 w-64 bg-police-900 text-white transform transition-transform duration-300 ease-in-out border-r border-police-800
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo Header */}
        <div className="h-20 flex items-center px-6 border-b border-police-800 bg-police-950/50">
             <div className="flex items-center gap-3">
              <img 
                src="/Logo-Bo-Cong-An.webp" 
                alt="Logo Bộ Công An" 
                className="w-10 h-10 object-contain flex-shrink-0 drop-shadow-md"
              />
              <div>
                <h1 className="text-sm font-bold uppercase tracking-wider text-white leading-none">
                  Cổng TTĐT
                </h1>
                <p className="text-[10px] font-semibold text-cahy-gold mt-1 uppercase tracking-wide">
                  Công An Hưng Yên
                </p>
              </div>
            </div>
            <button 
              className="lg:hidden ml-auto text-gray-400 hover:text-white"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-6 h-6" />
            </button>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 group ${
                  isActive
                    ? 'bg-cahy-red text-white shadow-lg shadow-cahy-red/20'
                    : 'text-police-200 hover:bg-police-800 hover:text-white'
                }`}
              >
                <div className="flex items-center">
                  <Icon className={`w-5 h-5 mr-3 ${isActive ? 'text-white' : 'text-police-400 group-hover:text-white'}`} />
                  {item.label}
                </div>
                {isActive && <ChevronRight className="w-4 h-4 text-white/50" />}
              </Link>
            )
          })}
        </nav>
        
        {/* Footer Info */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-police-800 bg-police-950/30">
            {onLogout && (
              <button
                onClick={onLogout}
                className="w-full flex items-center gap-2 px-3 py-2 mb-2 rounded-lg text-xs text-police-300 hover:bg-cahy-red/20 hover:text-white transition-all duration-200"
              >
                <LogOut className="w-4 h-4" />
                Đăng xuất
              </button>
            )}
            <div className="text-xs text-police-500 text-center">
                © 2025 Công an tỉnh Hưng Yên <br/> v1.0.0
            </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header for Mobile */}
        <header className="lg:hidden bg-white border-b border-gray-200 h-16 flex items-center justify-between px-4 shadow-sm z-30 sticky top-0">
             <div className="flex items-center gap-3">
                 <img 
                   src="/Logo-Bo-Cong-An.webp" 
                   alt="Logo Bộ Công An" 
                   className="w-8 h-8 object-contain"
                 />
                 <span className="font-bold text-police-900 uppercase text-sm">Công An Hưng Yên</span>
             </div>
             <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              <Menu className="w-6 h-6" />
            </button>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 animate-fade-in scroll-smooth">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
