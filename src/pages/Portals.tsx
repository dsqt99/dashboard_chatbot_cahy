import { Code2, ImagePlus, MessagesSquare, Pencil, Plus, Power, Trash2, X } from 'lucide-react'
import { useRef, useState, type FormEvent } from 'react'
import { Link, NavLink } from 'react-router-dom'
import Modal from '../components/Modal'
import { CopyField, DeptError, DeptOptions, Empty, ErrorBox, OrphanDept, PageHeader, fmtAgo, fmtNum } from '../components/ui'
import { useAsync } from '../hooks/useAsync'
import { api, type Portal, type PortalWidget, type Source } from '../lib/api'

// Tab chung cho trang Zalo OA và Cổng web (cùng mục "Kênh kết nối" trên menu).
export function ChannelTabs() {
  const tab = ({ isActive }: { isActive: boolean }) =>
    `-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
      isActive ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-ink'
    }`
  return (
    <nav className="mb-5 flex gap-1 border-b border-line" aria-label="Loại kênh">
      <NavLink to="/oas" end className={tab}>Zalo OA</NavLink>
      <NavLink to="/oas/portals" className={tab}>Cổng web (widget)</NavLink>
    </nav>
  )
}

const convLink = (keys: string[]) => keys.length === 1 ? `/conversations?source=${encodeURIComponent(keys[0])}` : '/conversations'

// Số liệu hoạt động của một kênh (gộp từ một hoặc nhiều nguồn), kèm lối tắt sang Hội thoại.
export function SourceStats({ sources }: { sources?: Source[] }) {
  if (!sources) return null
  const conv = sources.reduce((n, s) => n + s.conversations, 0)
  const msgs = sources.reduce((n, s) => n + s.messages, 0)
  const last = Math.max(0, ...sources.map((s) => s.last_message_at))
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
      <span className="num">{fmtNum(conv)} hội thoại · {fmtNum(msgs)} tin</span>
      <span>{last ? `Gần nhất ${fmtAgo(last)}` : 'Chưa có hội thoại'}</span>
      {conv > 0 && (
        <Link to={convLink(sources.map((s) => s.source))} className="inline-flex items-center gap-1 font-medium text-accent hover:underline">
          <MessagesSquare className="h-3.5 w-3.5" aria-hidden /> Xem hội thoại
        </Link>
      )}
    </p>
  )
}

const bareHost = (d: string) => d.trim().toLowerCase().replace(/^[a-z]+:\/\//, '').replace(/[/:].*$/, '')
const portalOwns = (p: Portal, s: Source) => {
  const host = s.source.replace(/^web:/, '').toLowerCase()
  return p.domains.some((d) => { const h = bareHost(d); return h && (host === h || host.endsWith(`.${h}`)) })
}

const MAX_SUGGESTIONS = 3

type Form = { name: string; domains: string; agent_id: string; department_id: string; debounce_seconds: string; suggestions: string[] } & Omit<PortalWidget, 'suggestions'>

const EMPTY: Form = {
  name: '', domains: '', agent_id: '', department_id: '', debounce_seconds: '0', suggestions: [],
  title: '', brand: '', tagline: '', tooltip: '', welcome: '', placeholder: '', position: 'right',
  bot_avatar: '', title_avatar: '',
}

const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean)

// Cắt vuông giữa ảnh, thu về 160px rồi trả data URL — lưu thẳng trong cấu hình widget.
function shrinkImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const S = 160
      const side = Math.min(img.width, img.height)
      const c = document.createElement('canvas')
      c.width = c.height = S
      c.getContext('2d')!.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, S, S)
      URL.revokeObjectURL(url)
      const out = c.toDataURL('image/webp', 0.86)
      resolve(out.startsWith('data:image/webp') ? out : c.toDataURL('image/png'))
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Không đọc được ảnh.')) }
    img.src = url
  })
}

function AvatarField({ id, label, hint, value, onChange, onError }: {
  id: string; label: string; hint: string; value?: string
  onChange: (v: string) => void; onError: (m: string) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const pick = async (file?: File) => {
    if (!file) return
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return onError('Chỉ nhận ảnh PNG, JPEG hoặc WebP.')
    if (file.size > 5 * 1024 * 1024) return onError('Ảnh quá lớn (tối đa 5 MB).')
    try { onChange(await shrinkImage(file)) } catch (e) { onError((e as Error).message) }
  }
  return (
    <div className="flex items-center gap-3">
      <button type="button" onClick={() => input.current?.click()} aria-describedby={`${id}-hint`}
        className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full border border-dashed border-line bg-surface text-muted transition-colors hover:border-accent hover:text-accent">
        {value ? <img src={value} alt="" className="h-full w-full object-cover" /> : <ImagePlus className="h-5 w-5" aria-hidden />}
        <span className="sr-only">Chọn {label.toLowerCase()}</span>
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p id={`${id}-hint`} className="text-xs text-muted">{hint}</p>
        <div className="mt-1 flex gap-3 text-xs">
          <button type="button" className="font-medium text-accent hover:underline" onClick={() => input.current?.click()}>
            {value ? 'Đổi ảnh' : 'Tải ảnh lên'}
          </button>
          {value && (
            <button type="button" className="inline-flex items-center gap-0.5 text-muted hover:text-danger" onClick={() => onChange('')}>
              <X className="h-3 w-3" aria-hidden /> Dùng mặc định
            </button>
          )}
        </div>
      </div>
      <input ref={input} id={id} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
        onChange={(e) => { pick(e.target.files?.[0]); e.target.value = '' }} />
    </div>
  )
}

export default function Portals() {
  const list = useAsync(api.listPortals, [])
  const agents = useAsync(api.listAgents, [])
  const depts = useAsync(() => api.departments(), [])
  const sources = useAsync(api.sources, [])
  const web = sources.data?.filter((s) => s.kind === 'web')
  const unmatched = web?.filter((s) => !list.data?.portals.some((p) => portalOwns(p, s)))

  const [err, setErr] = useState('')
  const [editing, setEditing] = useState<Portal | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [f, setF] = useState<Form>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [embed, setEmbed] = useState<Portal | null>(null)

  const set = (patch: Partial<Form>) => setF((cur) => ({ ...cur, ...patch }))
  const agentName = (id?: string | null) => (id ? agents.data?.find((a) => a.agent_id === id)?.name || id : 'Agent mặc định')
  const snippet = (p: Portal) => `<script src="${list.data?.script_url}" data-key="${p.portal_id}" defer></script>`

  const openForm = (p: Portal | null) => {
    setEditing(p)
    setErr('')
    setF(p ? {
      ...EMPTY, ...p.widget,
      name: p.name, domains: p.domains.join('\n'), agent_id: p.agent_id || '',
      department_id: p.department_id || '',
      debounce_seconds: String(p.debounce_seconds ?? 0),
      suggestions: (p.widget.suggestions || []).slice(0, MAX_SUGGESTIONS),
    } : EMPTY)
    setFormOpen(true)
  }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setErr('')
    const { name, domains, agent_id, department_id, debounce_seconds, suggestions, ...widget } = f
    const parsedDebounce = Math.max(0, Math.min(300, Math.floor(Number(debounce_seconds) || 0)))
    const body = {
      name, agent_id, department_id,
      department_name: depts.data?.find((d) => d.id === department_id)?.name || '',
      domains: lines(domains),
      debounce_seconds: parsedDebounce,
      widget: { ...widget, suggestions: suggestions.map((s) => s.trim()).filter(Boolean).slice(0, MAX_SUGGESTIONS) },
    }
    try {
      if (editing) await api.updatePortal(editing.portal_id, body)
      else await api.createPortal({ ...body, enabled: true })
      setFormOpen(false)
      list.reload()
    } catch (ex) {
      setErr((ex as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const act = async (fn: () => Promise<unknown>) => {
    setErr('')
    try {
      await fn()
      list.reload()
    } catch (ex) {
      setErr((ex as Error).message)
    }
  }

  const text = (key: Exclude<keyof PortalWidget, 'suggestions' | 'position'>, label: string, ph: string) => (
    <div>
      <label htmlFor={`pw-${key}`} className="label">{label}</label>
      <input id={`pw-${key}`} className="field" value={(f[key] as string) || ''} placeholder={ph}
        onChange={(e) => set({ [key]: e.target.value })} />
    </div>
  )

  return (
    <>
      <PageHeader
        title="Kênh kết nối"
        desc="Tạo widget chatbot nhúng cho cổng thông tin điện tử: gán Agent, giới hạn tên miền, tuỳ chỉnh lời chào."
        actions={
          <button className="btn-primary" onClick={() => openForm(null)}>
            <Plus className="h-4 w-4" aria-hidden /> Thêm cổng web
          </button>
        }
      />

      <ChannelTabs />

      {err && !formOpen && (
        <div role="alert" className="mb-4 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{err}</div>
      )}

      {list.error ? (
        <div className="card"><ErrorBox message={list.error} onRetry={list.reload} /></div>
      ) : !list.data ? (
        <div className="space-y-3">{[0, 1].map((i) => <div key={i} className="skeleton h-20" />)}</div>
      ) : !list.data.portals.length ? (
        <div className="card"><Empty title="Chưa có cổng web nào" hint="Nhấn Thêm cổng web để tạo widget chatbot và lấy mã nhúng." /></div>
      ) : (
        <div className="grid gap-3">
          {list.data.portals.map((p) => (
            <article key={p.portal_id} className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold">{p.name}</h2>
                  <span className="rounded-md bg-sunken px-2 py-0.5 font-mono text-xs text-muted">{p.portal_id}</span>
                </div>
                <p className="text-xs text-muted [overflow-wrap:anywhere]">
                  Agent: <span className="font-medium text-ink">{agentName(p.agent_id)}</span>
                  {p.department_name ? ` · ${p.department_name}` : ''}<OrphanDept id={p.department_id} depts={depts.data} />
                  {` · ${p.domains.length ? p.domains.join(', ') : 'Mọi tên miền'}`}
                  {(p.debounce_seconds ?? 0) > 0 ? ` · Chờ gom tin: ${p.debounce_seconds}s` : ''}
                  {p.created_at ? ` · tạo ${fmtAgo(p.created_at)}` : ''}
                </p>
                <SourceStats sources={web?.filter((s) => portalOwns(p, s))} />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => act(() => api.updatePortal(p.portal_id, { enabled: !p.enabled }))}
                  className={`btn-ghost h-9 px-3 text-xs ${p.enabled ? 'border-ok/40 text-ok' : 'text-muted'}`}
                  title={p.enabled ? 'Tắt widget' : 'Bật widget'}>
                  <Power className="h-3.5 w-3.5" aria-hidden /> {p.enabled ? 'Đang bật' : 'Đang tắt'}
                </button>
                <button type="button" onClick={() => setEmbed(p)} className="btn-ghost h-9 px-3 text-xs">
                  <Code2 className="h-3.5 w-3.5" aria-hidden /> Mã nhúng
                </button>
                <button type="button" onClick={() => openForm(p)} className="btn-ghost h-9 px-3 text-xs" aria-label={`Sửa ${p.name}`}>
                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                </button>
                <button type="button" aria-label={`Xoá ${p.name}`} className="btn-ghost h-9 px-3 text-xs text-danger hover:bg-danger/10"
                  onClick={() => confirm(`Xoá cổng web "${p.name}"? Widget đã nhúng sẽ ngừng hoạt động.`) && act(() => api.deletePortal(p.portal_id))}>
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {!!unmatched?.length && list.data && (
        <section className="card mt-5 p-5" aria-labelledby="unmatched-web">
          <h2 id="unmatched-web" className="text-sm font-semibold">Nguồn web chưa gắn cổng</h2>
          <p className="mb-3 text-xs text-muted">Hội thoại đến từ tên miền chưa khai báo trong cổng nào. Thêm tên miền vào cổng để quản lý tập trung.</p>
          <ul className="divide-y divide-line">
            {unmatched.map((s) => (
              <li key={s.source} className="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="font-mono text-xs [overflow-wrap:anywhere]">{s.source.replace(/^web:/, '')}</span>
                <SourceStats sources={[s]} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <Modal open={formOpen} onClose={() => setFormOpen(false)} maxWidth="max-w-2xl"
        title={editing ? `Cập nhật cổng web: ${editing.name}` : 'Thêm cổng web mới'}>
        <form onSubmit={save} className="space-y-4">
          {err && <p className="rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">{err}</p>}
          <div>
            <label htmlFor="pt-name" className="label">Tên cổng</label>
            <input id="pt-name" className="field" required value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="vd: Cổng thông tin Công an tỉnh" />
          </div>
          <div>
            <label htmlFor="pt-domains" className="label">Tên miền được phép (mỗi dòng một tên miền)</label>
            <textarea id="pt-domains" rows={2} className="field font-mono text-xs" value={f.domains}
              onChange={(e) => set({ domains: e.target.value })} placeholder={'congan.hungyen.gov.vn\nwww.congan.hungyen.gov.vn'} />
            <p className="mt-1 text-xs text-muted">Để trống = cho phép mọi tên miền. Nên khai báo khi đưa lên thật.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="pt-agent" className="label">Agent trả lời</label>
              <select id="pt-agent" className="field" value={f.agent_id} onChange={(e) => set({ agent_id: e.target.value })}>
                <option value="">— Agent mặc định —</option>
                {agents.data?.map((a) => <option key={a.agent_id} value={a.agent_id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="pt-dept" className="label">Phòng ban</label>
              <select id="pt-dept" className="field" value={f.department_id} onChange={(e) => set({ department_id: e.target.value })}>
                <DeptOptions value={f.department_id} depts={depts.data} />
              </select>
              {depts.error && <DeptError message={depts.error} onRetry={depts.reload} />}
            </div>
          </div>
          <div>
            <label htmlFor="pt-debounce" className="label">Thời gian chờ gom tin nhắn (giây)</label>
            <input
              id="pt-debounce"
              type="number"
              min={0}
              max={300}
              className="field"
              value={f.debounce_seconds}
              onChange={(e) => set({ debounce_seconds: e.target.value })}
            />
            <p className="mt-1 text-xs text-muted">
              Chờ người dùng ngừng nhắn thêm trong khoảng thời gian này rồi gom thành 1 lượt trả lời (0–300s). Đặt 0 để trả lời ngay.
            </p>
          </div>

          <fieldset className="space-y-3 rounded-lg border border-line p-4">
            <legend className="px-1 text-sm font-semibold">Giao diện widget</legend>
            <div className="grid gap-4 rounded-lg bg-sunken/60 p-3 sm:grid-cols-2">
              <AvatarField id="pw-bot-avatar" label="Ảnh trợ lý" hint="Nút mở chat và cạnh tin nhắn"
                value={f.bot_avatar} onChange={(v) => set({ bot_avatar: v })} onError={setErr} />
              <AvatarField id="pw-title-avatar" label="Ảnh đầu khung chat" hint="Logo / huy hiệu đơn vị"
                value={f.title_avatar} onChange={(v) => set({ title_avatar: v })} onError={setErr} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {text('title', 'Tiêu đề khung chat', 'Trợ lý ảo Công an tỉnh')}
              {text('brand', 'Tên đơn vị', 'Công an tỉnh Hưng Yên')}
              {text('tagline', 'Dòng phụ', 'Hỗ trợ thủ tục hành chính 24/7')}
              {text('tooltip', 'Chú thích nút mở', 'Hỏi trợ lý ảo')}
              {text('placeholder', 'Gợi ý ô nhập', 'Nhập câu hỏi...')}
              <div>
                <label htmlFor="pw-position" className="label">Vị trí nút</label>
                <select id="pw-position" className="field" value={f.position} onChange={(e) => set({ position: e.target.value as 'left' | 'right' })}>
                  <option value="right">Góc phải</option>
                  <option value="left">Góc trái</option>
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="pw-welcome" className="label">Lời chào (hỗ trợ markdown)</label>
              <textarea id="pw-welcome" rows={4} className="field" value={f.welcome || ''} onChange={(e) => set({ welcome: e.target.value })}
                placeholder={'# Xin chào!\nTôi có thể hỗ trợ bạn tra cứu thủ tục hành chính...'} />
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="label !mb-0">
                  Câu hỏi gợi ý <span className="num font-normal text-muted">({f.suggestions.length}/{MAX_SUGGESTIONS})</span>
                </span>
                {f.suggestions.length < MAX_SUGGESTIONS && (
                  <button
                    type="button"
                    onClick={() => set({ suggestions: [...f.suggestions, ''] })}
                    className="inline-flex items-center gap-1 rounded-md border border-line bg-surface px-2.5 py-1 text-xs font-medium text-accent transition-colors hover:bg-accent-soft"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden /> Thêm câu hỏi
                  </button>
                )}
              </div>
              {f.suggestions.length === 0 ? (
                <p className="rounded-lg border border-dashed border-line px-3 py-2.5 text-xs text-muted">
                  Chưa thêm câu hỏi — widget sẽ dùng 3 câu gợi ý mặc định.
                </p>
              ) : (
                <div className="space-y-2">
                  {f.suggestions.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="num flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sunken text-xs font-medium text-muted">
                        {idx + 1}
                      </span>
                      <input
                        type="text"
                        maxLength={120}
                        aria-label={`Câu hỏi gợi ý ${idx + 1}`}
                        className="field h-9 flex-1"
                        value={item}
                        placeholder={
                          idx === 0 ? 'vd: Đăng ký xe lần đầu cần giấy tờ gì?'
                            : idx === 1 ? 'vd: Đăng ký thường trú cần chuẩn bị gì?'
                            : 'vd: Làm lại thẻ căn cước cần giấy tờ gì?'
                        }
                        onChange={(e) => {
                          const next = [...f.suggestions]
                          next[idx] = e.target.value
                          set({ suggestions: next })
                        }}
                      />
                      <button
                        type="button"
                        aria-label={`Xoá câu hỏi ${idx + 1}`}
                        title="Xoá câu hỏi"
                        onClick={() => set({ suggestions: f.suggestions.filter((_, i) => i !== idx) })}
                        className="btn-ghost h-9 w-9 shrink-0 p-0 text-muted hover:text-danger"
                      >
                        <X className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <p className="text-xs text-muted">Để trống trường nào thì widget dùng nội dung mặc định.</p>
          </fieldset>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn-ghost" onClick={() => setFormOpen(false)}>Huỷ</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu'}</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!embed} onClose={() => setEmbed(null)} title={`Mã nhúng: ${embed?.name || ''}`}>
        {embed && (
          <div className="space-y-4 text-sm">
            <p>Dán đoạn mã sau vào trước thẻ <code className="font-mono">&lt;/body&gt;</code> của cổng thông tin:</p>
            <CopyField label="Mã nhúng widget" value={snippet(embed)} />
            {!embed.enabled && <p className="rounded-lg bg-warn/10 px-3 py-2 text-xs text-warn">Cổng đang tắt — widget sẽ không hiển thị cho tới khi bật.</p>}
            {!embed.domains.length && <p className="text-xs text-muted">Chưa giới hạn tên miền: mọi trang web đều nhúng được mã này.</p>}
          </div>
        )}
      </Modal>
    </>
  )
}
