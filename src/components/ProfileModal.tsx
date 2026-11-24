import { Camera, Check, Copy, Eye, EyeOff, KeyRound, ShieldCheck, User as UserIcon } from 'lucide-react'
import QRCode from 'qrcode'
import { useEffect, useRef, useState } from 'react'
import { api, type User } from '../lib/api'
import Modal from './Modal'

export default function ProfileModal({
  open,
  user,
  onClose,
  onUserUpdate,
}: {
  open: boolean
  user: User
  onClose: () => void
  onUserUpdate: (u: User) => void
}) {
  const [tab, setTab] = useState<'profile' | 'password' | '2fa'>('profile')
  const [fullName, setFullName] = useState(user.full_name || '')
  const [avatar, setAvatar] = useState(user.avatar || '')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [okMsg, setOkMsg] = useState('')

  // Password tab
  const [curPass, setCurPass] = useState('')
  const [newPass, setNewPass] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [showPass, setShowPass] = useState(false)

  // 2FA tab
  const [totpSecret, setTotpSecret] = useState('')
  const [totpQr, setTotpQr] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [disablePass, setDisablePass] = useState('')
  const [copiedSecret, setCopiedSecret] = useState(false)

  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setFullName(user.full_name || '')
    setAvatar(user.avatar || '')
    setCurPass('')
    setNewPass('')
    setConfirmPass('')
    setTotpSecret('')
    setTotpQr('')
    setTotpCode('')
    setDisablePass('')
    setErr('')
    setOkMsg('')
  }, [open, user])

  const handleUploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setErr('')
    setOkMsg('')
    try {
      const res = await api.uploadAvatar(file)
      const nextAvatar = res.avatar_url || res.user?.avatar || ''
      setAvatar(nextAvatar)
      onUserUpdate(res.user ? res.user : { ...user, avatar: nextAvatar })
      setOkMsg('Đã cập nhật ảnh đại diện.')
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Tải ảnh đại diện thất bại')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setErr('')
    setOkMsg('')
    try {
      const res = await api.updateProfile({ full_name: fullName.trim(), avatar })
      onUserUpdate(res.user ? res.user : { ...user, full_name: fullName.trim(), avatar })
      setOkMsg('Đã lưu thông tin tài khoản.')
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Cập nhật hồ sơ thất bại')
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPass.length < 8) {
      setErr('Mật khẩu mới phải có ít nhất 8 ký tự.')
      return
    }
    if (newPass !== confirmPass) {
      setErr('Xác nhận mật khẩu mới không khớp.')
      return
    }
    setSaving(true)
    setErr('')
    setOkMsg('')
    try {
      await api.changePassword({ current_password: curPass, new_password: newPass })
      setCurPass('')
      setNewPass('')
      setConfirmPass('')
      setOkMsg('Đổi mật khẩu thành công.')
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Đổi mật khẩu thất bại')
    } finally {
      setSaving(false)
    }
  }

  const handleStartTotp = async () => {
    setSaving(true)
    setErr('')
    setOkMsg('')
    try {
      const res = await api.totpSetup()
      const qrDataUrl = await QRCode.toDataURL(res.otpauth_url, { width: 184, margin: 1 })
      setTotpSecret(res.secret)
      setTotpQr(qrDataUrl)
      setTotpCode('')
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Không khởi tạo được mã 2FA.')
    } finally {
      setSaving(false)
    }
  }

  const handleEnableTotp = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setErr('')
    setOkMsg('')
    try {
      const res = await api.totpEnable(totpCode)
      onUserUpdate(res.user ? res.user : { ...user, totp_enabled: true })
      setTotpSecret('')
      setTotpQr('')
      setTotpCode('')
      setOkMsg('Đã bật xác thực 2 lớp (TOTP) cho tài khoản.')
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Kích hoạt 2FA thất bại.')
    } finally {
      setSaving(false)
    }
  }

  const handleDisableTotp = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setErr('')
    setOkMsg('')
    try {
      const res = await api.totpDisable(disablePass, totpCode)
      onUserUpdate(res.user ? res.user : { ...user, totp_enabled: false })
      setDisablePass('')
      setTotpCode('')
      setOkMsg('Đã tắt xác thực 2 lớp.')
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Không tắt được 2FA.')
    } finally {
      setSaving(false)
    }
  }

  const copySecret = () => {
    if (!totpSecret) return
    navigator.clipboard?.writeText(totpSecret)
    setCopiedSecret(true)
    setTimeout(() => setCopiedSecret(false), 1500)
  }

  const initial = (user.full_name || user.username).slice(0, 1).toUpperCase()

  return (
    <Modal open={open} onClose={onClose} title="Cài đặt tài khoản">
      <div className="mb-4 flex gap-1 rounded-lg border border-line bg-sunken/50 p-1">
        <button
          type="button"
          onClick={() => { setTab('profile'); setErr(''); setOkMsg('') }}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-colors ${
            tab === 'profile' ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'
          }`}
        >
          <UserIcon className="h-3.5 w-3.5" aria-hidden /> Hồ sơ
        </button>
        <button
          type="button"
          onClick={() => { setTab('password'); setErr(''); setOkMsg('') }}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-colors ${
            tab === 'password' ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'
          }`}
        >
          <KeyRound className="h-3.5 w-3.5" aria-hidden /> Mật khẩu
        </button>
        <button
          type="button"
          onClick={() => { setTab('2fa'); setErr(''); setOkMsg('') }}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-colors ${
            tab === '2fa' ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'
          }`}
        >
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Bảo mật 2FA
        </button>
      </div>

      {err && <p className="mb-3 rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">{err}</p>}
      {okMsg && (
        <p className="mb-3 flex items-center gap-1.5 rounded-lg bg-ok/10 px-3 py-2 text-xs text-ok">
          <Check className="h-3.5 w-3.5 shrink-0" aria-hidden /> {okMsg}
        </p>
      )}

      {tab === 'profile' ? (
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative h-14 w-14 shrink-0">
              {avatar ? (
                <img src={avatar} alt="" className="h-14 w-14 rounded-full border border-line object-cover" />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-lg font-semibold text-accent">
                  {initial}
                </div>
              )}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-line bg-surface text-ink shadow-sm hover:bg-sunken"
                title="Đổi ảnh đại diện"
              >
                <Camera className="h-3.5 w-3.5" aria-hidden />
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUploadAvatar} />
            </div>
            <div className="min-w-0 text-xs">
              <p className="font-mono font-medium text-ink">@{user.username}</p>
              <p className="text-muted">
                {user.role === 'admin' ? 'Quản trị viên' : 'Cán bộ'}
                {user.department_name ? ` · ${user.department_name}` : ''}
              </p>
              {uploading && <p className="mt-0.5 text-accent">Đang tải ảnh...</p>}
            </div>
          </div>

          <div>
            <label htmlFor="pf-name" className="label">Họ và tên hiển thị</label>
            <input
              id="pf-name"
              className="field"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nhập họ tên..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-ghost" onClick={onClose}>Đóng</button>
            <button type="submit" className="btn-primary" disabled={saving || uploading}>
              {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </div>
        </form>
      ) : tab === 'password' ? (
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label htmlFor="pf-cur" className="label">Mật khẩu hiện tại</label>
            <div className="relative">
              <input
                id="pf-cur"
                type={showPass ? 'text' : 'password'}
                className="field pr-10"
                required
                value={curPass}
                onChange={(e) => setCurPass(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
                aria-label={showPass ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div>
            <label htmlFor="pf-new" className="label">Mật khẩu mới (tối thiểu 8 ký tự)</label>
            <input
              id="pf-new"
              type={showPass ? 'text' : 'password'}
              className="field"
              required
              minLength={8}
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="pf-cf" className="label">Xác nhận mật khẩu mới</label>
            <input
              id="pf-cf"
              type={showPass ? 'text' : 'password'}
              className="field"
              required
              minLength={8}
              value={confirmPass}
              onChange={(e) => setConfirmPass(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-ghost" onClick={onClose}>Đóng</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Đang cập nhật...' : 'Đổi mật khẩu'}
            </button>
          </div>
        </form>
      ) : null}
      {tab === '2fa' && (
        user.totp_enabled ? (
          <form onSubmit={handleDisableTotp} className="space-y-4">
            <div className="flex items-center gap-2 rounded-lg border border-ok/30 bg-ok/10 px-3 py-2.5 text-xs font-medium text-ok">
              <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden />
              Tài khoản đang được bảo vệ bằng xác thực 2 lớp (TOTP).
            </div>
            <div>
              <label htmlFor="pf-dis-pass" className="label">Mật khẩu hiện tại</label>
              <input
                id="pf-dis-pass"
                type="password"
                className="field"
                required
                value={disablePass}
                onChange={(e) => setDisablePass(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="pf-dis-code" className="label">Mã xác thực 6 số từ ứng dụng</label>
              <input
                id="pf-dis-code"
                className="field num tracking-widest"
                inputMode="numeric"
                maxLength={6}
                required
                placeholder="000000"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-ghost" onClick={onClose}>Đóng</button>
              <button type="submit" className="btn-ghost border-danger/40 text-danger hover:bg-danger/10" disabled={saving}>
                {saving ? 'Đang tắt...' : 'Tắt xác thực 2 lớp'}
              </button>
            </div>
          </form>
        ) : totpQr ? (
          <form onSubmit={handleEnableTotp} className="space-y-4">
            <p className="text-xs text-muted">
              Quét mã QR bằng <strong>Google Authenticator</strong> hoặc <strong>Microsoft Authenticator</strong>, rồi nhập mã 6 số để xác nhận.
            </p>
            <div className="flex flex-col items-center gap-2 rounded-lg border border-line bg-white p-3">
              <img src={totpQr} alt="Mã QR xác thực 2 lớp" width={184} height={184} className="h-44 w-44" />
            </div>
            <div>
              <span className="label">Hoặc nhập mã thủ công</span>
              <div className="flex gap-2">
                <input className="field font-mono text-xs" readOnly value={totpSecret} />
                <button type="button" onClick={copySecret} className="btn-ghost shrink-0 px-3" title="Sao chép mã bí mật">
                  {copiedSecret ? <Check className="h-4 w-4 text-ok" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <label htmlFor="pf-totp-code" className="label">Mã xác nhận 6 số</label>
              <input
                id="pf-totp-code"
                className="field num tracking-widest"
                inputMode="numeric"
                maxLength={6}
                required
                placeholder="000000"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-ghost" onClick={() => { setTotpQr(''); setTotpSecret('') }}>Huỷ</button>
              <button type="submit" className="btn-primary" disabled={saving || totpCode.trim().length < 6}>
                {saving ? 'Đang xác nhận...' : 'Xác nhận kích hoạt'}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted">
              Bật xác thực 2 lớp (TOTP) giúp bảo vệ tài khoản ngay cả khi lộ mật khẩu. Mỗi lần đăng nhập sẽ cần thêm mã 6 số từ điện thoại.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-ghost" onClick={onClose}>Đóng</button>
              <button type="button" className="btn-primary" onClick={() => void handleStartTotp()} disabled={saving}>
                <ShieldCheck className="h-4 w-4" aria-hidden />
                {saving ? 'Đang tạo mã...' : 'Bật xác thực 2 lớp'}
              </button>
            </div>
          </div>
        )
      )}
    </Modal>
  )
}

