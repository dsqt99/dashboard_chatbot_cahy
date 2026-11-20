import { AlertTriangle, Check, Copy, Globe, Inbox, MessageCircle, RotateCw } from 'lucide-react'
import { useState, type ReactNode } from 'react'

const nf = new Intl.NumberFormat('vi-VN')
export const fmtNum = (n: number) => nf.format(n || 0)

export const fmtTime = (ts: number) =>
  ts ? new Date(ts * 1000).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : 'Chưa có'

export function fmtAgo(ts: number) {
  if (!ts) return 'Chưa có hoạt động'
  const s = Math.max(0, Date.now() / 1000 - ts)
  if (s < 60) return 'Vừa xong'
  if (s < 3600) return `${Math.floor(s / 60)} phút trước`
  if (s < 86400) return `${Math.floor(s / 3600)} giờ trước`
  if (s < 86400 * 30) return `${Math.floor(s / 86400)} ngày trước`
  return fmtTime(ts)
}

/** Nhãn hiển thị cho khóa nguồn `web:<host>` / `zalo:<oa_id>`. */
export function sourceOf(c: { channel: string; oa_id: string }) {
  if (c.oa_id) return { kind: 'zalo' as const, key: `zalo:${c.oa_id}` }
  return { kind: 'web' as const, key: c.channel || 'web:unknown' }
}

export function SourceBadge({ kind, label }: { kind: 'web' | 'zalo'; label: string }) {
  const Icon = kind === 'zalo' ? MessageCircle : Globe
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ${
        kind === 'zalo' ? 'bg-zalo/10 text-zalo' : 'bg-accent-soft text-accent'
      }`}
      title={label}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="truncate">{label}</span>
    </span>
  )
}

const STATUS: Record<string, { label: string; cls: string }> = {
  active: { label: 'Đang mở', cls: 'text-ok bg-ok/10' },
  processing: { label: 'Đang xử lý', cls: 'text-accent bg-accent-soft' },
  needs_human: { label: 'Cần cán bộ', cls: 'text-warn bg-warn/10' },
  replied: { label: 'Đã trả lời', cls: 'text-ok bg-ok/10' },
  closed: { label: 'Đã đóng', cls: 'text-muted bg-sunken' },
}

export function StatusPill({ status }: { status: string }) {
  const s = STATUS[status] || { label: status, cls: 'text-muted bg-sunken' }
  return <span className={`inline-flex shrink-0 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span>
}

export function PageHeader({ title, desc, actions }: { title: string; desc?: string; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {desc && <p className="mt-1 max-w-[65ch] text-sm text-muted">{desc}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <Inbox className="mb-3 h-8 w-8 text-muted/60" aria-hidden />
      <p className="text-sm font-medium">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-sm text-muted">{hint}</p>}
    </div>
  )
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <AlertTriangle className="h-7 w-7 text-danger" aria-hidden />
      <p className="max-w-md text-sm">{message}</p>
      {onRetry && (
        <button className="btn-ghost" onClick={onRetry}>
          <RotateCw className="h-4 w-4" aria-hidden /> Thử lại
        </button>
      )}
    </div>
  )
}

export function Segmented<T extends string | number>({
  value, options, onChange, label,
}: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg border border-line bg-surface p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={`h-8 rounded-md px-3 text-sm font-medium transition-colors ${
            o.value === value ? 'bg-accent-soft text-accent' : 'text-muted hover:text-ink'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

// Ô chỉ đọc + nút sao chép (URL webhook, mã nhúng widget...).
export function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard?.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex gap-2">
        <input className="field font-mono text-xs" readOnly value={value} />
        <button type="button" onClick={copy} className="btn-ghost shrink-0 px-3" title="Sao chép">
          {copied ? <Check className="h-4 w-4 text-ok" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
    </div>
  )
}

/** Phòng ban đã lưu nhưng không còn trong danh mục Arkon (bị xoá hoặc ngừng). */
const isOrphanDept = (id: string | null | undefined, depts?: { id: string }[]) =>
  !!id && !!depts?.length && !depts.some((d) => d.id === id)

export function OrphanDept({ id, depts }: { id?: string | null; depts?: { id: string }[] }) {
  return isOrphanDept(id, depts) ? <span className="text-danger"> (không còn trong Arkon)</span> : null
}

export function DeptOptions({ value, depts }: { value: string; depts?: { id: string; name: string }[] }) {
  return (
    <>
      <option value="">Không gán phòng ban</option>
      {depts?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
      {/* Danh mục chưa tải được: vẫn giữ phòng ban đang gán để select không hiện sai "Không gán". */}
      {value && !depts && <option value={value}>Phòng ban hiện tại</option>}
      {/* Giữ ID cũ trong select để lưu các trường khác không đổi phòng ban ngầm. */}
      {isOrphanDept(value, depts) && <option value={value}>Phòng ban cũ (không còn trong Arkon)</option>}
    </>
  )
}

/** Danh mục Arkon lỗi thì nói rõ, tránh để select chỉ còn "Không gán" như thể không có phòng ban nào. */
export function DeptError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <p role="alert" className="mt-1 text-xs text-danger">
      Không tải được danh mục phòng ban: {message}{' '}
      <button type="button" className="underline" onClick={onRetry}>Thử lại</button>
    </p>
  )
}
