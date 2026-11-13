import { FileText, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Empty, ErrorBox, PageHeader, fmtNum } from '../components/ui'
import { useAsync } from '../hooks/useAsync'
import { api } from '../lib/api'

export default function Documents() {
  const [scope, setScope] = useState('')
  const [q, setQ] = useState('')
  const scopes = useAsync(api.scopes, [])
  const docs = useAsync(() => api.documents(scope), [scope])

  const shown = useMemo(() => {
    const k = q.trim().toLowerCase()
    return (docs.data || []).filter((d) => !k || d.title.toLowerCase().includes(k))
  }, [docs.data, q])

  return (
    <>
      <PageHeader title="Tài liệu tri thức" desc="Tài liệu trợ lý ảo dùng để trả lời, lấy từ kho tri thức hiện hành. Thêm hoặc sửa tài liệu trong hệ thống quản lý tri thức." />

      <div className="card mb-4 grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_260px]">
        <div>
          <label htmlFor="d-q" className="label">Tìm theo tiêu đề</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
            <input id="d-q" type="search" className="field pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        <div>
          <label htmlFor="d-s" className="label">Lĩnh vực</label>
          <select id="d-s" className="field" value={scope} onChange={(e) => setScope(e.target.value)}>
            <option value="">Tất cả lĩnh vực</option>
            {scopes.data?.map((s) => <option key={s.name} value={s.name}>{s.description || s.name}</option>)}
          </select>
        </div>
      </div>

      <section className="card" aria-label="Danh sách tài liệu">
        <div className="border-b border-line px-4 py-3 text-sm text-muted" aria-live="polite">
          {docs.data ? <><span className="num font-medium text-ink">{fmtNum(shown.length)}</span> tài liệu</> : 'Đang tải...'}
        </div>
        {docs.error ? (
          <ErrorBox message={docs.error} onRetry={docs.reload} />
        ) : !docs.data ? (
          <div className="space-y-3 p-4">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-10" />)}</div>
        ) : !shown.length ? (
          <Empty title="Không tìm thấy tài liệu" hint={q ? 'Thử từ khóa khác.' : undefined} />
        ) : (
          <ul className="divide-y divide-line">
            {shown.map((d) => (
              <li key={d.source_id} className="flex items-center gap-3 px-4 py-3">
                <FileText className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                <span className="min-w-0 flex-1 text-sm [overflow-wrap:anywhere]">{d.title || d.source_id}</span>
                {d.knowledge_type && <span className="shrink-0 rounded-md bg-sunken px-2 py-0.5 text-xs text-muted">{d.knowledge_type}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
