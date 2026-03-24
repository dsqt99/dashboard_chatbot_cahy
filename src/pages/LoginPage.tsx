import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'

interface LoginPageProps {
  onLoginSuccess: () => void
}

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    await new Promise(r => setTimeout(r, 400))
    const ok = login(username, password)
    setLoading(false)
    if (ok) {
      onLoginSuccess()
    } else {
      setError('Tên đăng nhập hoặc mật khẩu không đúng')
      setPassword('')
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      /* police-900 → police-800 gradient, giống sidebar */
      background: 'linear-gradient(160deg, #1a202c 0%, #222b38 55%, #1e2733 100%)',
      fontFamily: "'Inter', 'Segoe UI', sans-serif",
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Decorative glow – cahy-red tint top-left */}
      <div style={{
        position: 'absolute', top: '-15%', left: '-10%',
        width: '520px', height: '520px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(206,32,41,0.12) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      {/* cahy-blue tint bottom-right */}
      <div style={{
        position: 'absolute', bottom: '-20%', right: '-10%',
        width: '600px', height: '600px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(0,78,154,0.14) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      {/* subtle gold accent line top */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        height: '3px',
        background: 'linear-gradient(90deg, #ce2029 0%, #d4af37 50%, #004e9a 100%)',
        pointerEvents: 'none',
      }} />

      <div style={{
        width: '100%',
        maxWidth: '420px',
        margin: '0 16px',
        background: 'rgba(40,49,60,0.85)',       /* police-800 with opacity */
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(212,175,55,0.18)', /* cahy-gold subtle border */
        borderRadius: '20px',
        padding: '48px 40px',
        boxShadow: '0 32px 64px rgba(0,0,0,0.5), inset 0 1px 0 rgba(212,175,55,0.10)',
        animation: 'slideUp 0.4s cubic-bezier(0.16,1,0.3,1)',
      }}>
        {/* Logo + Header */}
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <img
            src="/Logo-Bo-Cong-An.webp"
            alt="Logo Bộ Công An"
            style={{
              width: '64px', height: '64px',
              objectFit: 'contain',
              margin: '0 auto 14px',
              filter: 'drop-shadow(0 4px 12px rgba(206,32,41,0.35))',
              display: 'block',
            }}
            onError={e => {
              /* fallback shield emoji if image missing */
              (e.target as HTMLImageElement).style.display = 'none'
            }}
          />
          <h1 style={{
            color: '#f4f6f8',  /* police-50 */
            fontSize: '20px', fontWeight: 700,
            margin: '0 0 4px', letterSpacing: '0.04em', textTransform: 'uppercase',
          }}>
            Cổng TTĐT
          </h1>
          <p style={{
            color: '#d4af37', /* cahy-gold */
            fontSize: '12px', fontWeight: 600,
            margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.12em',
          }}>
            Công An Hưng Yên
          </p>
          <p style={{ color: '#6f8396', fontSize: '13px', margin: 0 }}>
            Vui lòng đăng nhập để tiếp tục
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Username */}
          <div>
            <label style={{
              display: 'block', color: '#9aaaba', /* police-300 */
              fontSize: '12px', fontWeight: 600,
              marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>
              Tên đăng nhập
            </label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Nhập tên đăng nhập"
              required
              autoFocus
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'rgba(26,32,44,0.7)',   /* police-900 */
                border: '1px solid rgba(154,170,186,0.2)',
                borderRadius: '10px',
                padding: '11px 14px',
                color: '#f4f6f8',
                fontSize: '14px',
                outline: 'none',
                transition: 'border-color 0.2s, box-shadow 0.2s',
              }}
              onFocus={e => {
                e.target.style.borderColor = 'rgba(206,32,41,0.6)'
                e.target.style.boxShadow = '0 0 0 3px rgba(206,32,41,0.08)'
              }}
              onBlur={e => {
                e.target.style.borderColor = 'rgba(154,170,186,0.2)'
                e.target.style.boxShadow = 'none'
              }}
            />
          </div>

          {/* Password */}
          <div>
            <label style={{
              display: 'block', color: '#9aaaba',
              fontSize: '12px', fontWeight: 600,
              marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>
              Mật khẩu
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu"
                required
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'rgba(26,32,44,0.7)',
                  border: '1px solid rgba(154,170,186,0.2)',
                  borderRadius: '10px',
                  padding: '11px 42px 11px 14px',
                  color: '#f4f6f8',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                }}
                onFocus={e => {
                  e.target.style.borderColor = 'rgba(206,32,41,0.6)'
                  e.target.style.boxShadow = '0 0 0 3px rgba(206,32,41,0.08)'
                }}
                onBlur={e => {
                  e.target.style.borderColor = 'rgba(154,170,186,0.2)'
                  e.target.style.boxShadow = 'none'
                }}
              />
              <button
                type="button"
                onClick={() => setShowPass(p => !p)}
                style={{
                  position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#4e6278', fontSize: '15px', padding: '4px',
                  display: 'flex', alignItems: 'center', transition: 'color 0.2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = '#9aaaba')}
                onMouseLeave={e => (e.currentTarget.style.color = '#4e6278')}
              >
                {showPass ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              background: 'rgba(206,32,41,0.12)',
              border: '1px solid rgba(206,32,41,0.35)',
              borderRadius: '10px',
              padding: '10px 14px',
              color: '#f87171',
              fontSize: '13px',
              display: 'flex', alignItems: 'center', gap: '8px',
            }}>
              ⚠️ {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: '8px',
              padding: '13px',
              background: loading
                ? 'rgba(206,32,41,0.35)'
                : 'linear-gradient(135deg, #ce2029 0%, #a01820 100%)', /* cahy-red */
              border: 'none',
              borderRadius: '10px',
              color: '#fff',
              fontSize: '14px',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              transition: 'all 0.2s',
              boxShadow: loading ? 'none' : '0 4px 20px rgba(206,32,41,0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            }}
            onMouseEnter={e => {
              if (!loading) {
                const btn = e.currentTarget
                btn.style.transform = 'translateY(-1px)'
                btn.style.boxShadow = '0 8px 28px rgba(206,32,41,0.45)'
              }
            }}
            onMouseLeave={e => {
              const btn = e.currentTarget
              btn.style.transform = 'translateY(0)'
              btn.style.boxShadow = loading ? 'none' : '0 4px 20px rgba(206,32,41,0.35)'
            }}
          >
            {loading ? (
              <>
                <span style={{
                  display: 'inline-block', width: '15px', height: '15px',
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: '#fff',
                  borderRadius: '50%',
                  animation: 'spin 0.7s linear infinite',
                }} />
                Đang xác thực...
              </>
            ) : 'Đăng nhập'}
          </button>
        </form>

        {/* Divider with gold */}
        <div style={{
          marginTop: '28px',
          borderTop: '1px solid rgba(212,175,55,0.12)',
          paddingTop: '16px',
          textAlign: 'center',
          color: '#4e6278', fontSize: '11px',
        }}>
          © 2025 Công an tỉnh Hưng Yên
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        input::placeholder { color: #3c4c5e; }
      `}</style>
    </div>
  )
}
