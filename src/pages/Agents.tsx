import { Bot, FlaskConical, Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Modal from '../components/Modal'
import { DeptError, DeptOptions, Empty, ErrorBox, OrphanDept, PageHeader, fmtTime } from '../components/ui'
import { useAsync } from '../hooks/useAsync'
import { api, type Agent, type Doc } from '../lib/api'
import AgentChat from './AgentChat'

export default function Agents() {
  const agents = useAsync(api.listAgents, [])
  const scopes = useAsync(api.scopes, [])
  const depts = useAsync(() => api.departments(), [])
  const oas = useAsync(api.listOAs, [])
  const portals = useAsync(api.listPortals, [])
  const [testing, setTesting] = useState<Agent | null>(null)

  const [err, setErr] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Agent | null>(null)
  const [saving, setSaving] = useState(false)

  // Form state
  const [name, setName] = useState('')
  const [deptId, setDeptId] = useState('')
  const [knowledgeType, setKnowledgeType] = useState('')
  const [selectedDocs, setSelectedDocs] = useState<string[]>([])
  const [systemPrompt, setSystemPrompt] = useState('')
  const [docs, setDocs] = useState<Doc[]>([])
  const [docsLoading, setDocsLoading] = useState(false)

  useEffect(() => {
    if (!formOpen) return
    let alive = true
    setDocsLoading(true)
    api
      .documents(knowledgeType)
      .then((list) => {
        if (alive) setDocs(list)
      })
      .catch(() => {
        if (alive) setDocs([])
      })
      .finally(() => {
        if (alive) setDocsLoading(false)
      })
    return () => {
      alive = false
    }
  }, [formOpen, knowledgeType])

  const openCreate = () => {
    setEditing(null)
    setName('')
    setDeptId('')
    setKnowledgeType('')
    setSelectedDocs([])
    setSystemPrompt('')
    setErr('')
    setFormOpen(true)
  }

  const openEdit = async (a: Agent) => {
    setErr('')
    try {
      const full = await api.getAgent(a.agent_id)
      setEditing(full)
      setName(full.name)
      setDeptId(full.department_id || '')
      setKnowledgeType(full.knowledge_type || '')
      setSelectedDocs(full.document_ids || [])
      setSystemPrompt(full.system_prompt || '')
      setFormOpen(true)
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Không tải được chi tiết Agent')
    }
  }

  const allDocsSelected = docs.length > 0 && docs.every((d) => selectedDocs.includes(d.source_id))

  const toggleDoc = (id: string) => {
    setSelectedDocs((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setErr('')
    const dept = depts.data?.find((d) => d.id === deptId)
    const body = {
      name: name.trim(),
      department_id: deptId,
      department_name: dept?.name || '',
      knowledge_type: knowledgeType,
      document_ids: selectedDocs,
      system_prompt: systemPrompt.trim(),
    }
    try {
      if (editing) await api.updateAgent(editing.agent_id, body)
      else await api.createAgent(body)
      setFormOpen(false)
      agents.reload()
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Lưu Agent thất bại')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (a: Agent) => {
    if (!confirm(`Xoá Agent "${a.name}"?`)) return
    setErr('')
    try {
      await api.deleteAgent(a.agent_id)
      agents.reload()
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Xoá Agent thất bại')
    }
  }

  return (
    <>
      <PageHeader
        title="Agent"
        desc="Cấu hình trợ lý AI, chạy thử ngay, rồi gắn vào kênh Zalo OA hoặc cổng web."
        actions={
          <button className="btn-primary" onClick={openCreate}>
            <Plus className="h-4 w-4" aria-hidden /> Tạo Agent
          </button>
        }
      />

      {err && !formOpen && (
        <div role="alert" className="mb-4 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {err}
        </div>
      )}

      {agents.error ? (
        <div className="card"><ErrorBox message={agents.error} onRetry={agents.reload} /></div>
      ) : !agents.data ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-20" />)}</div>
      ) : !agents.data.length ? (
        <div className="card"><Empty title="Chưa có Agent nào" hint="Tạo Agent để gắn vào Zalo OA hoặc chạy thử." /></div>
      ) : (
        <div className="grid gap-3">
          {agents.data.map((a) => (
            <article key={a.agent_id} className="card flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Bot className="h-4 w-4 text-accent" aria-hidden />
                  <h2 className="text-base font-semibold">{a.name}</h2>
                  <span className="rounded-md bg-sunken px-2 py-0.5 font-mono text-xs text-muted">{a.agent_id}</span>
                </div>
                <p className="text-xs text-muted">
                  {a.department_name || 'Toàn bộ phòng ban'}<OrphanDept id={a.department_id} depts={depts.data} />
                  {a.knowledge_type ? ` · Tri thức: ${a.knowledge_type}` : ' · Toàn bộ tri thức'}
                  {a.document_ids?.length ? ` · ${a.document_ids.length} tài liệu chọn riêng` : ' · Toàn bộ tài liệu'}
                  {a.created_at ? ` · Tạo ${fmtTime(a.created_at)}` : ''}
                </p>
                <ChannelUsage oaCount={oas.data?.filter((o) => o.agent_id === a.agent_id).length}
                  portalCount={portals.data?.portals.filter((p) => p.agent_id === a.agent_id).length} />
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setTesting(a)} className="btn-primary h-9 px-3 text-xs">
                  <FlaskConical className="h-3.5 w-3.5" aria-hidden /> Chạy thử
                </button>
                <button type="button" onClick={() => openEdit(a)} className="btn-ghost h-9 px-3 text-xs">
                  <Pencil className="h-3.5 w-3.5" aria-hidden /> Sửa
                </button>
                <button type="button" onClick={() => handleDelete(a)} className="btn-ghost h-9 px-3 text-xs text-danger hover:bg-danger/10" aria-label={`Xoá ${a.name}`}>
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editing ? `Chỉnh sửa Agent: ${editing.name}` : 'Tạo Agent mới'} maxWidth="max-w-xl">
        <form onSubmit={handleSave} className="space-y-4">
          {err && <p className="rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">{err}</p>}
          <div>
            <label htmlFor="ag-name" className="label">Tên Agent</label>
            <input id="ag-name" className="field" required value={name} onChange={(e) => setName(e.target.value)} placeholder="vd: Agent Căn cước" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="ag-dept" className="label">Phòng ban phụ trách</label>
              <select id="ag-dept" className="field" value={deptId} onChange={(e) => setDeptId(e.target.value)}>
                <DeptOptions value={deptId} depts={depts.data} emptyLabel="Toàn bộ phòng ban" />
              </select>
              {depts.error && <DeptError message={depts.error} onRetry={depts.reload} />}
            </div>
            <div>
              <label htmlFor="ag-scope" className="label">Knowledge Type (bộ lọc tri thức)</label>
              <select id="ag-scope" className="field" value={knowledgeType} onChange={(e) => setKnowledgeType(e.target.value)}>
                <option value="">Toàn bộ lĩnh vực</option>
                {scopes.data?.map((s) => (
                  <option key={s.slug || s.name} value={s.slug || s.name}>
                    {s.description || s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="label mb-0">Phạm vi tài liệu ({selectedDocs.length ? `${selectedDocs.length} đã chọn` : 'Mặc định toàn bộ'})</span>
              {selectedDocs.length > 0 && (
                <button type="button" className="text-xs text-accent hover:underline" onClick={() => setSelectedDocs([])}>
                  Bỏ chọn tất cả
                </button>
              )}
            </div>
            <div className="max-h-40 overflow-y-auto rounded-lg border border-line bg-sunken/40 p-2">
              {docsLoading ? (
                <p className="p-2 text-xs text-muted">Đang tải danh sách tài liệu...</p>
              ) : !docs.length ? (
                <p className="p-2 text-xs text-muted">Không có tài liệu nào trong lĩnh vực này.</p>
              ) : (
                <div className="space-y-1">
                  <label className="flex cursor-pointer items-center gap-2 rounded border-b border-line px-2 pb-1.5 pt-1 text-xs font-medium hover:bg-surface">
                    <input type="checkbox" checked={allDocsSelected}
                      ref={(el) => { if (el) el.indeterminate = !allDocsSelected && docs.some((d) => selectedDocs.includes(d.source_id)) }}
                      onChange={() => {
                        const ids = docs.map((d) => d.source_id)
                        setSelectedDocs((prev) => allDocsSelected
                          ? prev.filter((x) => !ids.includes(x))
                          : [...new Set([...prev, ...ids])])
                      }} />
                    Chọn tất cả ({docs.length})
                  </label>
                  {docs.map((d) => (
                    <label key={d.source_id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs hover:bg-surface">
                      <input type="checkbox" checked={selectedDocs.includes(d.source_id)} onChange={() => toggleDoc(d.source_id)} />
                      <span className="truncate">{d.title || d.source_id}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="ag-prompt" className="label">System Prompt (tùy chọn)</label>
            <textarea
              id="ag-prompt"
              rows={4}
              className="field h-auto py-2 text-xs"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="Ghi đè hướng dẫn trả lời mặc định của chatbot..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-ghost" onClick={() => setFormOpen(false)}>Hủy</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu Agent'}</button>
          </div>
        </form>
      </Modal>

      {testing && <AgentChat agent={testing} onClose={() => setTesting(null)} />}
    </>
  )
}

function ChannelUsage({ oaCount, portalCount }: { oaCount?: number; portalCount?: number }) {
  if (oaCount === undefined && portalCount === undefined) return null
  const parts = [oaCount ? `${oaCount} Zalo OA` : '', portalCount ? `${portalCount} cổng web` : ''].filter(Boolean)
  return (
    <p className="text-xs">
      {parts.length
        ? <span className="text-ok">Đang dùng ở {parts.join(', ')}</span>
        : <span className="text-warn">Chưa gắn kênh nào · <Link to="/oas" className="text-accent hover:underline">Gắn vào kênh</Link></span>}
    </p>
  )
}

