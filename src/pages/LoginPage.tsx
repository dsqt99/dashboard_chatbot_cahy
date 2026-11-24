import { Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Brand } from '../components/Layout'
import { api, type User } from '../lib/api'

export default function LoginPage({ onLogin }: { onLogin: (token: string, user: User) => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [totp, setTotp] = useState('')
  const [needTotp, setNeedTotp] = useState(false)
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const r = await api.login(username, password, totp)
      if (r.totp_required) {
        setNeedTotp(true)
        return
      }
      if (r.token && r.user) onLogin(r.token, r.user)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_minmax(420px,520px)]">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-[#0b2545] p-12 text-white lg:flex">
        <div className="absolute inset-x-0 top-0 h-1 bg-[#ce2029]" aria-hidden />
        <div className="flex items-center gap-3">
          <img src="/Logo-Bo-Cong-An.webp" alt="" width={44} height={44} className="h-11 w-11 object-contain" />
          <p className="text-sm font-medium text-white/80">Công an tỉnh Hưng Yên</p>
        </div>
        <div className="max-w-lg">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight">
            Theo dõi trợ lý ảo trên mọi cổng thông tin và Zalo OA
          </h1>
          <p className="mt-4 text-base leading-relaxed text-white/70">
            Số lượt hỏi, nguồn truy cập và toàn bộ lịch sử hội thoại của người dân, lấy trực tiếp từ hệ thống hiện hành.
          </p>
        </div>
        <p className="flex items-center gap-2 text-sm text-white/60">
          <ShieldCheck className="h-4 w-4" aria-hidden /> Chỉ dành cho cán bộ được cấp tài khoản
        </p>
      </section>

      <section className="flex items-center justify-center px-4 py-10 sm:px-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Brand />
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">Đăng nhập</h2>
          <p className="mt-1 text-sm text-muted">Dùng tài khoản trang quản trị chatbot.</p>

          <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
            <div>
              <label htmlFor="u" className="label">Tên đăng nhập</label>
              <input id="u" className="field" autoComplete="username" required value={username}
                onChange={(e) => setUsername(e.target.value)} autoFocus />
            </div>
            <div>
              <label htmlFor="p" className="label">Mật khẩu</label>
              <div className="relative">
                <input id="p" className="field pr-10" type={show ? 'text' : 'password'} autoComplete="current-password"
                  required value={password} onChange={(e) => setPassword(e.target.value)} />
                <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted hover:text-ink">
                  {show ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
                </button>
              </div>
            </div>
            {needTotp && (
              <div>
                <label htmlFor="t" className="label">Mã xác thực 2 lớp (TOTP)</label>
                <input id="t" className="field num tracking-widest" inputMode="numeric" autoComplete="one-time-code"
                  maxLength={6} placeholder="Nhập mã 6 số" value={totp} onChange={(e) => setTotp(e.target.value)} autoFocus />
                <p className="mt-1 text-xs text-muted">Mở ứng dụng Authenticator (Google / Microsoft) để lấy mã 6 số.</p>
              </div>
            )}
            {error && (
              <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
            )}
            <button className="btn-primary w-full" disabled={busy || !username || !password}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              {needTotp ? 'Xác nhận' : 'Đăng nhập'}
            </button>
          </form>
        </div>
      </section>
    </div>
  )
}
