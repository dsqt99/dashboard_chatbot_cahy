import {
  ExternalLink,
  KeyRound,
  Link2,
  Link2Off,
  Pencil,
  Plus,
  Power,
  Settings2,
  Trash2,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Modal from '../components/Modal'
import { CopyField, DeptError, DeptOptions, Empty, ErrorBox, OrphanDept, PageHeader, fmtAgo, fmtNum, fmtTime } from '../components/ui'
import { ChannelTabs, SourceStats } from './Portals'
import { useAsync } from '../hooks/useAsync'
import { api, type Agent, type OA, type OACredentialStatus, type OAStats } from '../lib/api'

export default function OAs() {
  const oas = useAsync(api.listOAs, [])
  const agents = useAsync(api.listAgents, [])
  const depts = useAsync(() => api.departments(), [])
  const sources = useAsync(api.sources, [])

  const [err, setErr] = useState('')
  const [searchParams, setSearchParams] = useSearchParams()
  const [oauthNotice, setOauthNotice] = useState<'success' | 'error' | null>(null)

  useEffect(() => {
    const oauth = searchParams.get('oauth')
    if (oauth === 'success' || oauth === 'error') {
      setOauthNotice(oauth)
      const next = new URLSearchParams(searchParams)
      next.delete('oauth')
      setSearchParams(next, { replace: true })
    }
  }, [searchParams, setSearchParams])
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<OA | null>(null)
  const [detailOA, setDetailOA] = useState<OA | null>(null)
  const [stats, setStats] = useState<OAStats | null>(null)
  const [creds, setCreds] = useState<OACredentialStatus | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // Form states
  const [oaId, setOaId] = useState('')
  const [name, setName] = useState('')
  const [agentId, setAgentId] = useState('')
  const [deptId, setDeptId] = useState('')
  const [replyMode, setReplyMode] = useState<'all' | 'whitelist'>('all')
  const [whitelistText, setWhitelistText] = useState('')
  const [saving, setSaving] = useState(false)

  // Credentials states
  const [zaloAppId, setZaloAppId] = useState('')
  const [appSecret, setAppSecret] = useState('')
  const [oaSecretKey, setOaSecretKey] = useState('')
  const [credSaving, setCredSaving] = useState(false)

  const agentName = (id?: string | null) => {
    if (!id) return 'Chưa gán Agent'
    return agents.data?.find((a: Agent) => a.agent_id === id)?.name || id
  }

  const openCreate = () => {
    setEditing(null)
    setOaId('')
    setName('')
    setAgentId('')
    setDeptId('')
    setReplyMode('all')
    setWhitelistText('')
    setErr('')
    setFormOpen(true)
  }

  const openEdit = (oa: OA) => {
    setEditing(oa)
    setOaId(oa.oa_id)
    setName(oa.name)
    setAgentId(oa.agent_id || '')
    setDeptId(oa.department_id || '')
    setReplyMode(oa.reply_mode || 'all')
    setWhitelistText((oa.allowed_user_ids || []).join('\n'))
    setErr('')
    setFormOpen(true)
  }

  const openDetail = async (oa: OA) => {
    setDetailOA(oa)
    setDetailLoading(true)
    setErr('')
    setAppSecret('')
    setOaSecretKey('')
    try {
      const [s, c] = await Promise.all([api.oaStats(oa.oa_id), api.getOACredentials(oa.oa_id)])
      setStats(s)
      setCreds(c)
      setZaloAppId(c.zalo_app_id || '')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Không tải được chi tiết OA')
    } finally {
      setDetailLoading(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setErr('')
    const dept = depts.data?.find((d) => d.id === deptId)
    const allowed_user_ids = whitelistText
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean)

    try {
      if (editing) {
        await api.updateOA(editing.oa_id, {
          name: name.trim(),
          agent_id: agentId,
          department_id: deptId,
          department_name: dept?.name || '',
          reply_mode: replyMode,
          allowed_user_ids,
        })
      } else {
        await api.createOA({
          oa_id: oaId.trim(),
          name: name.trim(),
          agent_id: agentId,
          department_id: deptId,
          department_name: dept?.name || '',
          reply_mode: replyMode,
          allowed_user_ids,
        })
      }
      setFormOpen(false)
      oas.reload()
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Lưu OA thất bại')
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (oa: OA) => {
    setErr('')
    try {
      await api.toggleOA(oa.oa_id, !oa.agent_enabled)
      oas.reload()
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Không đổi được trạng thái')
    }
  }

  const handleDelete = async (oa: OA) => {
    if (!confirm(`Xoá Zalo OA "${oa.name}" (${oa.oa_id})?`)) return
    setErr('')
    try {
      await api.deleteOA(oa.oa_id)
      oas.reload()
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Xoá OA thất bại')
    }
  }

  const handleSaveCreds = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!detailOA) return
    setCredSaving(true)
    setErr('')
    try {
      const updated = await api.updateOACredentials(detailOA.oa_id, zaloAppId.trim(), appSecret.trim(), oaSecretKey.trim())
      setCreds(updated)
      setAppSecret('')
      setOaSecretKey('')
      oas.reload()
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Lưu credentials thất bại')
    } finally {
      setCredSaving(false)
    }
  }

  const handleOAuth = async () => {
    if (!detailOA) return
    setErr('')
    try {
      const { oauth_url } = await api.oauthUrl(detailOA.oa_id)
      window.location.assign(oauth_url)
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Không lấy được link OAuth Zalo')
    }
  }

  const handleDisconnect = async () => {
    if (!detailOA || !confirm(`Ngắt kết nối OAuth của OA "${detailOA.name}"?`)) return
    setErr('')
    try {
      await api.disconnectOA(detailOA.oa_id)
      await openDetail(detailOA)
      oas.reload()
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Ngắt kết nối thất bại')
    }
  }

  return (
    <>
      <PageHeader
        title="Kênh kết nối"
        desc="Kết nối Official Account, gán Agent trả lời tự động, cấu hình OAuth và khóa bí mật Zalo."
        actions={
          <button className="btn-primary" onClick={openCreate}>
            <Plus className="h-4 w-4" aria-hidden /> Thêm OA
          </button>
        }
      />

      <ChannelTabs />

      {oauthNotice === 'success' && (
        <div role="status" className="mb-4 flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
          <span>Kết nối OAuth Zalo OA thành công.</span>
          <button type="button" onClick={() => setOauthNotice(null)} className="ml-4 text-xs underline opacity-80 hover:opacity-100">Đóng</button>
        </div>
      )}
      {oauthNotice === 'error' && (
        <div role="alert" className="mb-4 flex items-center justify-between rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          <span>Kết nối OAuth Zalo OA thất bại. Vui lòng kiểm tra App ID, App Secret và thử lại.</span>
          <button type="button" onClick={() => setOauthNotice(null)} className="ml-4 text-xs underline opacity-80 hover:opacity-100">Đóng</button>
        </div>
      )}

      {err && !formOpen && !detailOA && (
        <div role="alert" className="mb-4 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {err}
        </div>
      )}

      {oas.error ? (
        <div className="card"><ErrorBox message={oas.error} onRetry={oas.reload} /></div>
      ) : !oas.data ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-20" />)}</div>
      ) : !oas.data.length ? (
        <div className="card"><Empty title="Chưa có Zalo OA nào" hint="Nhấn Thêm OA để khai báo Official Account mới." /></div>
      ) : (
        <div className="grid gap-3">
          {oas.data.map((oa) => (
            <article key={oa.oa_id} className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold">{oa.name}</h2>
                  <span className="num rounded-md bg-sunken px-2 py-0.5 font-mono text-xs text-muted">{oa.oa_id}</span>
                  <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${oa.has_token ? 'bg-ok/10 text-ok' : 'bg-warn/10 text-warn'}`}>
                    {oa.has_token ? 'Đã kết nối OAuth' : 'Chưa kết nối OAuth'}
                  </span>
                  {oa.webhook_verified && (
                    <span className="rounded-md bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">Webhook OK</span>
                  )}
                </div>
                <p className="text-xs text-muted">
                  Agent: {oa.agent_id
                    ? <Link to="/agents" className="font-medium text-ink hover:text-accent hover:underline">{agentName(oa.agent_id)}</Link>
                    : <span className="font-medium text-warn">Chưa gán Agent</span>}
                  {oa.department_name ? ` · ${oa.department_name}` : ''}<OrphanDept id={oa.department_id} depts={depts.data} />
                  {oa.reply_mode === 'whitelist' ? ` · Whitelist (${oa.allowed_user_ids?.length || 0})` : ''}
                </p>
                {sources.data
                  ? <SourceStats sources={sources.data.filter((s) => s.source === `zalo:${oa.oa_id}`)} />
                  : <p className="text-xs text-muted">{fmtNum(oa.message_count || 0)} tin nhắn</p>}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleToggle(oa)}
                  className={`btn-ghost h-9 px-3 text-xs ${oa.agent_enabled ? 'border-ok/40 text-ok' : 'text-muted'}`}
                  title={oa.agent_enabled ? 'Tắt trợ lý ảo' : 'Bật trợ lý ảo'}
                >
                  <Power className="h-3.5 w-3.5" aria-hidden />
                  {oa.agent_enabled ? 'Đang bật' : 'Đang tắt'}
                </button>
                <button type="button" onClick={() => openDetail(oa)} className="btn-ghost h-9 px-3 text-xs">
                  <Settings2 className="h-3.5 w-3.5" aria-hidden /> Kết nối & Key
                </button>
                <button type="button" onClick={() => openEdit(oa)} className="btn-ghost h-9 px-3 text-xs" aria-label={`Sửa ${oa.name}`}>
                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                </button>
                <button type="button" onClick={() => handleDelete(oa)} className="btn-ghost h-9 px-3 text-xs text-danger hover:bg-danger/10" aria-label={`Xoá ${oa.name}`}>
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Modal Tạo / Sửa OA */}
      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editing ? `Cập nhật OA: ${editing.name}` : 'Thêm Zalo OA mới'}>
        <form onSubmit={handleSave} className="space-y-4">
          {err && <p className="rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">{err}</p>}
          <div>
            <label htmlFor="oa-id" className="label">OA ID</label>
            <input id="oa-id" className="field font-mono" required disabled={!!editing} value={oaId} onChange={(e) => setOaId(e.target.value)} placeholder="vd: 1234567890123456" />
          </div>
          <div>
            <label htmlFor="oa-name" className="label">Tên hiển thị</label>
            <input id="oa-name" className="field" required value={name} onChange={(e) => setName(e.target.value)} placeholder="vd: Công an tỉnh Hưng Yên" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="oa-agent" className="label">Agent phụ trách</label>
              <select id="oa-agent" className="field" value={agentId} onChange={(e) => setAgentId(e.target.value)}>
                <option value="">— Chưa gán Agent —</option>
                {agents.data?.map((a) => <option key={a.agent_id} value={a.agent_id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="oa-dept" className="label">Phòng ban</label>
              <select id="oa-dept" className="field" value={deptId} onChange={(e) => setDeptId(e.target.value)}>
                <DeptOptions value={deptId} depts={depts.data} />
              </select>
              {depts.error && <DeptError message={depts.error} onRetry={depts.reload} />}
            </div>
          </div>
          <div>
            <label htmlFor="oa-mode" className="label">Chế độ phản hồi</label>
            <select id="oa-mode" className="field" value={replyMode} onChange={(e) => setReplyMode(e.target.value as 'all' | 'whitelist')}>
              <option value="all">Trả lời tất cả người dùng</option>
              <option value="whitelist">Chỉ trả lời danh sách cho phép (Whitelist)</option>
            </select>
          </div>
          {replyMode === 'whitelist' && (
            <div>
              <label htmlFor="oa-wl" className="label">Danh sách Zalo User ID (mỗi dòng 1 ID)</label>
              <textarea id="oa-wl" rows={3} className="field h-auto py-2 font-mono text-xs" value={whitelistText} onChange={(e) => setWhitelistText(e.target.value)} />
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-ghost" onClick={() => setFormOpen(false)}>Hủy</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu OA'}</button>
          </div>
        </form>
      </Modal>

      {/* Modal Chi tiết OAuth & Credentials */}
      <Modal open={!!detailOA} onClose={() => setDetailOA(null)} title={`Kết nối & Key: ${detailOA?.name || ''}`} maxWidth="max-w-xl">
        {detailLoading ? (
          <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-12" />)}</div>
        ) : (
          <div className="space-y-5">
            {err && <p className="rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">{err}</p>}

            {stats && (
              <div className="space-y-3 rounded-lg border border-line bg-sunken/50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span>Trạng thái token: <strong className={stats.has_token ? 'text-ok' : 'text-warn'}>{stats.has_token ? 'Đã kết nối' : 'Chưa có token'}</strong></span>
                  {!!stats.token_expires_at && <span className="text-muted">Hết hạn: {fmtTime(stats.token_expires_at)} ({fmtAgo(stats.token_expires_at)})</span>}
                </div>
                <CopyField label="Webhook URL" value={stats.webhook_url} />
                <CopyField label="OAuth Callback URL" value={stats.oauth_callback_url} />
                <div className="flex flex-wrap gap-2 pt-1">
                  <button type="button" onClick={handleOAuth} disabled={!creds?.has_app_secret} className="btn-primary h-9 text-xs"
                    title={creds?.has_app_secret ? undefined : 'Lưu App ID và App Secret bên dưới trước'}>
                    <Link2 className="h-3.5 w-3.5" aria-hidden /> Kết nối OAuth Zalo <ExternalLink className="h-3 w-3" aria-hidden />
                  </button>
                  {!creds?.has_app_secret && <span className="self-center text-xs text-muted">Lưu App ID và App Secret bên dưới trước khi kết nối OAuth.</span>}
                  {stats.has_token && (
                    <button type="button" onClick={handleDisconnect} className="btn-ghost h-9 text-xs text-danger">
                      <Link2Off className="h-3.5 w-3.5" aria-hidden /> Ngắt kết nối
                    </button>
                  )}
                </div>
              </div>
            )}

            <form onSubmit={handleSaveCreds} className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <KeyRound className="h-4 w-4 text-accent" aria-hidden /> Cấu hình Zalo App Credentials
              </div>
              <div>
                <label htmlFor="cred-app-id" className="label">Zalo App ID</label>
                <input id="cred-app-id" className="field font-mono" value={zaloAppId} onChange={(e) => setZaloAppId(e.target.value)} placeholder="Nhập App ID..." />
              </div>
              <div>
                <label htmlFor="cred-app-sec" className="label">
                  App Secret {creds?.has_app_secret && <span className="text-ok">(đã lưu — để trống nếu giữ nguyên)</span>}
                </label>
                <input id="cred-app-sec" type="password" className="field font-mono" value={appSecret} onChange={(e) => setAppSecret(e.target.value)} placeholder="••••••••" />
              </div>
              <div>
                <label htmlFor="cred-oa-sec" className="label">
                  OA Secret Key (xác thực webhook) {creds?.has_oa_secret_key && <span className="text-ok">(đã lưu — để trống nếu giữ nguyên)</span>}
                </label>
                <input id="cred-oa-sec" type="password" className="field font-mono" value={oaSecretKey} onChange={(e) => setOaSecretKey(e.target.value)} placeholder="••••••••" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="btn-ghost" onClick={() => setDetailOA(null)}>Đóng</button>
                <button type="submit" className="btn-primary" disabled={credSaving}>{credSaving ? 'Đang lưu...' : 'Lưu Credentials'}</button>
              </div>
            </form>
          </div>
        )}
      </Modal>
    </>
  )
}

