import { Code2, Pencil, Plus, Power, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { NavLink } from 'react-router-dom'
import Modal from '../components/Modal'
import { CopyField, Empty, ErrorBox, PageHeader, fmtAgo } from '../components/ui'
import { useAsync } from '../hooks/useAsync'
import { api, type Department, type Portal, type PortalWidget } from '../lib/api'

// Tab chung cho trang Zalo OA và Cổng web (cùng mục "Kênh Zalo OA & Web" trên menu).
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

type Form = { name: string; domains: string; agent_id: string; department_id: string; suggestions: string } & Omit<PortalWidget, 'suggestions'>

const EMPTY: Form = {
  name: '', domains: '', agent_id: '', department_id: '', suggestions: '',
  title: '', brand: '', tagline: '', tooltip: '', welcome: '', placeholder: '', position: 'right',
}

const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean)

export default function Portals() {
  const list = useAsync(api.listPortals, [])
  const agents = useAsync(api.listAgents, [])
  const depts = useAsync(() => api.departments().catch(() => [] as Department[]), [])

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
      department_id: p.department_id || '', suggestions: (p.widget.suggestions || []).join('\n'),
    } : EMPTY)
    setFormOpen(true)
  }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setErr('')
    const { name, domains, agent_id, department_id, suggestions, ...widget } = f
    const body = {
      name, agent_id, department_id,
      department_name: depts.data?.find((d) => d.id === department_id)?.name || '',
      domains: lines(domains),
      widget: { ...widget, suggestions: lines(suggestions) },
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
        title="Kênh Zalo OA & Web"
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
                  {p.department_name ? ` · ${p.department_name}` : ''}
                  {` · ${p.domains.length ? p.domains.join(', ') : 'Mọi tên miền'}`}
                  {p.created_at ? ` · tạo ${fmtAgo(p.created_at)}` : ''}
                </p>
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
                <option value="">Không gán phòng ban</option>
                {depts.data?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>

          <fieldset className="space-y-3 rounded-lg border border-line p-4">
            <legend className="px-1 text-sm font-semibold">Giao diện widget</legend>
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
              <textarea id="pw-welcome" rows={3} className="field" value={f.welcome || ''} onChange={(e) => set({ welcome: e.target.value })} />
            </div>
            <div>
              <label htmlFor="pw-sugg" className="label">Câu hỏi gợi ý (mỗi dòng một câu, tối đa 8)</label>
              <textarea id="pw-sugg" rows={3} className="field" value={f.suggestions} onChange={(e) => set({ suggestions: e.target.value })} />
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
