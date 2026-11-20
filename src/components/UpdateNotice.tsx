import { RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'

// Vite gắn hash vào tên bundle; hash trong index.html khác bản đang chạy = đã deploy bản mới.
const bundle = (s: string) => s.match(/\/assets\/index-[\w-]+\.js/)?.[0]
const CHECK_MS = 5 * 60_000

/** Báo người dùng tải lại trang khi dashboard vừa được deploy bản mới. */
export default function UpdateNotice() {
  const [stale, setStale] = useState(false)

  useEffect(() => {
    if (import.meta.env.DEV) return
    const current = bundle(document.documentElement.innerHTML)
    if (!current) return
    const check = async () => {
      try {
        const res = await fetch('/', { cache: 'no-store' })
        const latest = res.ok ? bundle(await res.text()) : undefined
        if (latest && latest !== current) setStale(true)
      } catch {
        // mất mạng tạm thời: bỏ qua, lần sau kiểm tra lại
      }
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') check()
    }
    const id = setInterval(check, CHECK_MS)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  if (!stale) return null
  return (
    <div role="status" className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-sm shadow-pop">
      <span>Đã có phiên bản dashboard mới.</span>
      <button type="button" className="btn-primary h-8 px-3 text-xs" onClick={() => location.reload()}>
        <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Tải lại
      </button>
    </div>
  )
}
