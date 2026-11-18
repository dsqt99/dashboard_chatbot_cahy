import { FileText, FlaskConical, LayoutDashboard, LogOut, Menu, MessagesSquare, Moon, Radio, Sun, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import type { User } from '../lib/api'

const NAV = [
  { to: '/', label: 'Tổng quan', icon: LayoutDashboard },
  { to: '/sources', label: 'Nguồn chatbot', icon: Radio },
  { to: '/agent-test', label: 'Test Agent', icon: FlaskConical },
  { to: '/conversations', label: 'Hội thoại', icon: MessagesSquare },
  { to: '/documents', label: 'Tài liệu tri thức', icon: FileText },
]

function useTheme() {
  const [dark, setDark] = useState(() => {
    try {
      const saved = localStorage.getItem('theme')
      return saved ? saved === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches
    } catch {
      return false
    }
  })
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    try {
      localStorage.setItem('theme', dark ? 'dark' : 'light')
    } catch {
      /* storage bị chặn */
    }
  }, [dark])
  return [dark, setDark] as const
}

export function Brand() {
  return (
    <div className="flex items-center gap-3">
      <img src="/Logo-Bo-Cong-An.webp" alt="" width={36} height={36} className="h-9 w-9 shrink-0 object-contain" />
      <div className="leading-tight">
        <p className="text-sm font-semibold">Trợ lý ảo CAHY</p>
        <p className="text-xs text-muted">Công an tỉnh Hưng Yên</p>
      </div>
    </div>
  )
}

export default function Layout({ user, onLogout, children }: { user: User; onLogout: () => void; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [dark, setDark] = useTheme()
  const { pathname } = useLocation()

  useEffect(() => {
    setOpen(false)
    document.getElementById('main')?.focus()
  }, [pathname])

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="px-5 py-5">
        <Brand />
      </div>
      <nav className="flex-1 space-y-1 px-3" aria-label="Điều hướng chính">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors ${
                isActive ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-sunken hover:text-ink'
              }`
            }
          >
            <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="space-y-1 border-t border-line p-3">
        <button
          onClick={() => setDark(!dark)}
          className="flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm text-muted hover:bg-sunken hover:text-ink"
        >
          {dark ? <Sun className="h-[18px] w-[18px]" aria-hidden /> : <Moon className="h-[18px] w-[18px]" aria-hidden />}
          {dark ? 'Giao diện sáng' : 'Giao diện tối'}
        </button>
        <div className="flex items-center gap-3 rounded-lg px-3 py-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold uppercase text-accent">
            {(user.full_name || user.username).slice(0, 1)}
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-medium">{user.full_name || user.username}</p>
            <p className="truncate text-xs text-muted">
              {user.role === 'admin' ? 'Quản trị viên' : user.department_name || 'Cán bộ'}
            </p>
          </div>
          <button onClick={onLogout} className="rounded-md p-2 text-muted hover:bg-danger/10 hover:text-danger" aria-label="Đăng xuất" title="Đăng xuất">
            <LogOut className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-dvh lg:pl-64">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2">
        Bỏ qua tới nội dung
      </a>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-line bg-surface lg:block">{sidebar}</aside>

      <div className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-line bg-surface/95 px-4 backdrop-blur lg:hidden">
        <Brand />
        <button onClick={() => setOpen(true)} className="rounded-lg p-2 hover:bg-sunken" aria-label="Mở menu" aria-expanded={open}>
          <Menu className="h-5 w-5" aria-hidden />
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-surface shadow-pop">
            <button onClick={() => setOpen(false)} className="absolute right-3 top-4 rounded-lg p-2 hover:bg-sunken" aria-label="Đóng menu">
              <X className="h-5 w-5" aria-hidden />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <main id="main" tabIndex={-1} className="mx-auto max-w-7xl px-4 py-6 outline-none sm:px-6 lg:px-8 lg:py-8">
        {children}
      </main>
    </div>
  )
}
