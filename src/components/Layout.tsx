import {
  Activity,
  Bot,
  ChevronsUpDown,
  FileText,
  FlaskConical,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquarePlus,
  MessagesSquare,
  Moon,
  Radio,
  Sun,
  UserCog,
  Users,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import type { User } from '../lib/api'
import ProfileModal from './ProfileModal'

const NAV = [
  { to: '/', label: 'Tổng quan', icon: LayoutDashboard },
  { to: '/sources', label: 'Nguồn chatbot', icon: Radio },
  { to: '/oas', label: 'Quản lý Zalo OA', icon: MessageSquarePlus },
  { to: '/agents', label: 'Quản lý Agent', icon: Bot },
  { to: '/agent-test', label: 'Test Agent', icon: FlaskConical },
  { to: '/conversations', label: 'Hội thoại', icon: MessagesSquare },
  { to: '/documents', label: 'Tài liệu tri thức', icon: FileText },
  { to: '/operations', label: 'Vận hành', icon: Activity },
  { to: '/users', label: 'Quản lý tài khoản', icon: Users, adminOnly: true },
]

const item = 'flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-sm text-ink hover:bg-sunken'

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

export default function Layout({
  user,
  onLogout,
  onUserUpdate,
  children,
}: {
  user: User
  onLogout: () => void
  onUserUpdate: (u: User) => void
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const [dark, setDark] = useTheme()
  const { pathname } = useLocation()

  useEffect(() => {
    if (!menuOpen) return
    const away = (e: PointerEvent) => !menuRef.current?.contains(e.target as Node) && setMenuOpen(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false)
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [menuOpen])

  useEffect(() => {
    setOpen(false)
    setMenuOpen(false)
    document.getElementById('main')?.focus()
  }, [pathname])

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="px-5 py-5">
        <Brand />
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3" aria-label="Điều hướng chính">
        {NAV.filter((item) => !item.adminOnly || user.role === 'admin').map(({ to, label, icon: Icon }) => (
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
      <div className="relative border-t border-line p-3" ref={menuRef}>
        {menuOpen && (
          <div role="menu" aria-label="Tài khoản"
            className="absolute inset-x-3 bottom-full mb-2 overflow-hidden rounded-xl border border-line bg-surface p-1.5 shadow-pop">
            <div className="border-b border-line px-3 pb-2.5 pt-1.5">
              <p className="truncate text-sm font-medium">{user.full_name || user.username}</p>
              <p className="truncate text-xs text-muted">{user.department_name || 'Toàn hệ thống'}</p>
            </div>
            <div className="pt-1.5">
              <button role="menuitem" autoFocus onClick={() => { setMenuOpen(false); setProfileOpen(true) }} className={item}>
                <UserCog className="h-4 w-4" aria-hidden /> Cài đặt tài khoản
              </button>
              <button role="menuitem" onClick={() => setDark(!dark)} className={item}>
                {dark ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
                {dark ? 'Giao diện sáng' : 'Giao diện tối'}
              </button>
              <div className="my-1.5 border-t border-line" />
              <button role="menuitem" onClick={onLogout} className={`${item} text-danger hover:bg-danger/10 hover:text-danger`}>
                <LogOut className="h-4 w-4" aria-hidden /> Đăng xuất
              </button>
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-sunken ${menuOpen ? 'bg-sunken' : ''}`}
        >
          {user.avatar ? (
            <img src={user.avatar} alt="" className="h-9 w-9 shrink-0 rounded-full border border-line object-cover" />
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold uppercase text-accent">
              {(user.full_name || user.username).slice(0, 1)}
            </div>
          )}
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-medium">{user.full_name || user.username}</p>
            <p className="truncate text-xs text-muted">{user.role === 'admin' ? 'Quản trị viên' : 'Cán bộ'} · @{user.username}</p>
          </div>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted" aria-hidden />
        </button>
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

      <ProfileModal open={profileOpen} user={user} onClose={() => setProfileOpen(false)} onUserUpdate={onUserUpdate} />
    </div>
  )
}
