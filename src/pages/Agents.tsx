import { Bot, FlaskConical, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
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
  const [docsError, setDocsError] = useState('')
  const [docsReloadSeq, setDocsReloadSeq] = useState(0)
  const [docSearch, setDocSearch] = useState('')
  const [docDeptFilter, setDocDeptFilter] = useState('')

  useEffect(() => {
    if (!formOpen) return
    let alive = true
    setDocsLoading(true)
    setDocsError('')
    api
      .documents(knowledgeType)
      .then((list) => {
        if (alive) setDocs(list)
      })
      .catch((ex) => {
        if (alive) {
          setDocs([])
          setDocsError(ex instanceof Error ? ex.message : 'Không tải được danh sách tài liệu từ Wiki.')
        }
      })
      .finally(() => {
        if (alive) setDocsLoading(false)
      })
    return () => {
      alive = false
    }
  }, [formOpen, knowledgeType, docsReloadSeq])

  const openCreate = () => {
    setEditing(null)
    setName('')
    setDeptId('')
    setKnowledgeType('')
    setSelectedDocs([])
    setSystemPrompt('')
    setDocSearch('')
    setDocDeptFilter('')
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
      setDocSearch('')
      setDocDeptFilter('')
      setFormOpen(true)
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Không tải được chi tiết Agent')
    }
  }

  const isDocShared = (d: Doc) =>
    Boolean(d.is_shared) ||
    d.scope_type === 'global' ||
    (!(d.department_ids && d.department_ids.length) && d.scope_type !== 'department' && d.scope_type !== 'personal')

  const docDeptOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const d of docs) {
      const ids = d.department_ids || []
      const names = d.department_names || []
      ids.forEach((id, idx) => {
        if (id && !map.has(id)) {
          map.set(id, names[idx] || depts.data?.find((dep) => dep.id === id)?.name || id)
        }
      })
    }
    return [...map.entries()]
      .map(([id, label]) => ({ id, name: label }))
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
  }, [docs, depts.data])

  const filteredDocs = useMemo(() => {
    const q = docSearch.trim().toLowerCase()
    return docs.filter((d) => {
      if (docDeptFilter === '__shared__' && !isDocShared(d)) return false
      if (docDeptFilter && docDeptFilter !== '__shared__' && !(d.department_ids || []).includes(docDeptFilter)) {
        return false
      }
      if (!q) return true
      return (
        (d.title || '').toLowerCase().includes(q) ||
        d.source_id.toLowerCase().includes(q) ||
        (d.knowledge_type || '').toLowerCase().includes(q)
      )
    })
  }, [docs, docSearch, docDeptFilter])

  const allDocsSelected = filteredDocs.length > 0 && filteredDocs.every((d) => selectedDocs.includes(d.source_id))

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
            <div className="mb-2 grid gap-2 sm:grid-cols-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" aria-hidden />
                <input
                  type="search"
                  className="field h-8 pl-8 text-xs"
                  value={docSearch}
                  onChange={(e) => setDocSearch(e.target.value)}
                  placeholder="Tìm theo tên tài liệu..."
                  aria-label="Tìm tài liệu"
                />
              </div>
              <select
                className="field h-8 text-xs"
                value={docDeptFilter}
                onChange={(e) => setDocDeptFilter(e.target.value)}
                aria-label="Lọc tài liệu theo phạm vi"
              >
                <option value="">Tất cả tài liệu ({docs.length})</option>
                <option value="__shared__">Tài liệu chung</option>
                {docDeptOptions.map((dep) => (
                  <option key={dep.id} value={dep.id}>
                    {dep.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="max-h-52 overflow-y-auto rounded-lg border border-line bg-sunken/40 p-2">
              {docsLoading ? (
                <p className="p-2 text-xs text-muted">Đang tải danh sách tài liệu...</p>
              ) : docsError ? (
                <div className="flex items-center justify-between gap-2 p-2 text-xs text-danger">
                  <span>{docsError}</span>
                  <button type="button" className="shrink-0 font-medium text-accent hover:underline" onClick={() => setDocsReloadSeq((n) => n + 1)}>
                    Thử lại
                  </button>
                </div>
              ) : !docs.length ? (
                <p className="p-2 text-xs text-muted">Không có tài liệu nào trong lĩnh vực này.</p>
              ) : !filteredDocs.length ? (
                <p className="p-2 text-xs text-muted">Không tìm thấy tài liệu phù hợp với bộ lọc.</p>
              ) : (
                <div className="space-y-1">
                  <label className="flex cursor-pointer items-center gap-2 rounded border-b border-line px-2 pb-1.5 pt-1 text-xs font-medium hover:bg-surface">
                    <input type="checkbox" checked={allDocsSelected}
                      ref={(el) => { if (el) el.indeterminate = !allDocsSelected && filteredDocs.some((d) => selectedDocs.includes(d.source_id)) }}
                      onChange={() => {
                        const ids = filteredDocs.map((d) => d.source_id)
                        setSelectedDocs((prev) => allDocsSelected
                          ? prev.filter((x) => !ids.includes(x))
                          : [...new Set([...prev, ...ids])])
                      }} />
                    Chọn tất cả ({filteredDocs.length})
                  </label>
                  {filteredDocs.map((d) => {
                    const shared = isDocShared(d)
                    const deptLabel = d.department_names?.length ? d.department_names.join(', ') : ''
                    return (
                      <label key={d.source_id} className="flex cursor-pointer items-center justify-between gap-2 rounded px-2 py-1 text-xs hover:bg-surface">
                        <span className="flex min-w-0 items-center gap-2">
                          <input type="checkbox" checked={selectedDocs.includes(d.source_id)} onChange={() => toggleDoc(d.source_id)} />
                          <span className="truncate">{d.title || d.source_id}</span>
                        </span>
                        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${shared ? 'bg-accent-soft text-accent' : 'bg-sunken text-muted'}`}>
                          {shared ? 'Chung' : (deptLabel || 'Phòng ban')}
                        </span>
                      </label>
                    )
                  })}
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

