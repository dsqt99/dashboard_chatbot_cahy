import { ArrowLeft, Download, ExternalLink, LogOut, Search } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, Navigate, NavLink, Route, Routes, useLocation, useParams, useSearchParams } from 'react-router-dom'
import Markdown from '../components/Markdown'
import Modal from '../components/Modal'
import { Empty, ErrorBox, PageHeader, fmtNum } from '../components/ui'
import { useAsync } from '../hooks/useAsync'
import {
  loginToWiki, wikiReader,
  type WikiArticle, type WikiDocument, type WikiPage, type WikiSession,
} from '../lib/wikiApi'

type Reader = ReturnType<typeof wikiReader>
type Row = { id: string }
type Column<T> = { label: string; cell: (row: T) => ReactNode }

const TABS = [
  { to: '/wiki/documents', label: 'Tài liệu' },
  { to: '/wiki/knowledge-types', label: 'Loại tri thức' },
  { to: '/wiki/departments', label: 'Phòng ban' },
  { to: '/wiki/accounts', label: 'Tài khoản' },
]

const DOCUMENT_STATUS: Record<string, { label: string; cls: string }> = {
  ready: { label: 'Sẵn sàng', cls: 'text-ok bg-ok/10' },
  pending: { label: 'Đang chờ', cls: 'text-accent bg-accent-soft' },
  queued: { label: 'Đang chờ', cls: 'text-accent bg-accent-soft' },
  processing: { label: 'Đang xử lý', cls: 'text-accent bg-accent-soft' },
  awaiting_approval: { label: 'Chờ duyệt', cls: 'text-warn bg-warn/10' },
  failed: { label: 'Lỗi xử lý', cls: 'text-danger bg-danger/10' },
  error: { label: 'Lỗi xử lý', cls: 'text-danger bg-danger/10' },
  deleting: { label: 'Đang xoá', cls: 'text-muted bg-sunken' },
}

const STATUS_FILTERS = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'ready', label: 'Sẵn sàng' },
  { value: 'pending,queued,processing', label: 'Đang xử lý' },
  { value: 'awaiting_approval', label: 'Chờ duyệt' },
  { value: 'failed,error', label: 'Lỗi xử lý' },
]

const SORTS = [
  { value: 'created_desc', label: 'Mới tải lên' },
  { value: 'created_asc', label: 'Cũ nhất' },
  { value: 'title_asc', label: 'Tên A–Z' },
  { value: 'issued_desc', label: 'Ngày ban hành mới nhất' },
]

const SCOPE: Record<string, string> = { global: 'Toàn hệ thống', department: 'Theo phòng ban', personal: 'Cá nhân' }

const fmtDate = (iso?: string | null, withTime = false) =>
  iso ? new Date(iso).toLocaleString('vi-VN', withTime ? { dateStyle: 'short', timeStyle: 'short' } : { dateStyle: 'short' }) : '—'

const fmtSize = (bytes?: number | null) =>
  !bytes ? '—' : bytes < 1024 * 1024 ? `${fmtNum(Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`

const docTitle = (doc: WikiDocument) => doc.title || doc.file_name || doc.id

function DocStatus({ status }: { status: string }) {
  const s = DOCUMENT_STATUS[status] || { label: status, cls: 'text-muted bg-sunken' }
  return <span className={`inline-flex shrink-0 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span>
}

function Dot({ color }: { color?: string | null }) {
  return <span aria-hidden className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color || 'rgb(var(--muted))' }} />
}

/** Markdown chỉ đọc; react-markdown không render HTML thô nên an toàn với nội dung trích xuất. */
function Loading() {
  return <p className="p-4 text-sm text-muted" role="status">Đang tải…</p>
}

/** Bộ lọc lưu trên URL để quay lại từ trang chi tiết vẫn giữ nguyên. */
function useFilters() {
  const [params, setParams] = useSearchParams()
  function update(patch: Record<string, string>) {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) v ? next.set(k, v) : next.delete(k)
    if (!('page' in patch)) next.delete('page')
    setParams(next, { replace: true })
  }
  return [params, update] as const
}

function WikiLogin({ onLogin }: { onLogin: (session: WikiSession) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const request = useRef<AbortController | null>(null)
  useEffect(() => () => request.current?.abort(), [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (request.current) return
    const form = event.currentTarget
    const data = new FormData(form)
    const controller = new AbortController()
    request.current = controller
    setBusy(true)
    setError('')
    try {
      const session = await loginToWiki(String(data.get('email')).trim(), String(data.get('password')), controller.signal)
      if (!controller.signal.aborted) onLogin(session)
    } catch (error) {
      if (!controller.signal.aborted)
        setError(error instanceof Error ? error.message : 'Không đăng nhập được Wiki.')
    } finally {
      request.current = null
      if (!controller.signal.aborted) setBusy(false)
    }
  }

  return (
    <form className="card max-w-md space-y-4 p-5" onSubmit={submit}>
      <div>
        <label htmlFor="wiki-email" className="label">Email Wiki</label>
        <input id="wiki-email" name="email" className="field" type="email" autoComplete="username" required />
      </div>
      <div>
        <label htmlFor="wiki-password" className="label">Mật khẩu Wiki</label>
        <input id="wiki-password" name="password" className="field" type="password" autoComplete="current-password" required />
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <button className="btn-primary" disabled={busy}>{busy ? 'Đang đăng nhập…' : 'Đăng nhập Wiki'}</button>
    </form>
  )
}

function WikiTable<T extends Row>({ rows, columns, label }: { rows: T[]; columns: Column<T>[]; label: string }) {
  if (!rows.length) return <Empty title="Không tìm thấy kết quả" />
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm" aria-label={label}>
        <thead className="border-b border-line bg-sunken text-muted">
          <tr>{columns.map(({ label }) => <th key={label} scope="col" className="px-4 py-2.5 font-medium">{label}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row) => (
            <tr key={row.id}>
              {columns.map(({ label, cell }) => <td key={label} className="px-4 py-3 align-top [overflow-wrap:anywhere]">{cell(row)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SearchBox({ label, value, onSearch }: { label: string; value: string; onSearch: (q: string) => void }) {
  const id = useId()
  const [q, setQ] = useState(value)
  useEffect(() => setQ(value), [value])
  return (
    <form className="flex w-full items-end gap-2 sm:w-80" onSubmit={(e) => { e.preventDefault(); onSearch(q.trim()) }}>
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="label">{label}</label>
        <input id={id} className="field" type="search" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <button type="submit" className="btn-ghost"><Search className="h-4 w-4" aria-hidden /> Tìm</button>
    </form>
  )
}

function Select({ label, value, onChange, options }: {
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}) {
  const id = useId()
  return (
    <div className="w-full sm:w-48">
      <label htmlFor={id} className="label">{label}</label>
      <select id={id} className="field" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

function Pager<T>({ list, page, setPage }: { list: WikiPage<T>; page: number; setPage: (page: number) => void }) {
  const pages = list.total_pages || 1
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3 text-sm text-muted">
      <span aria-live="polite">{fmtNum(list.total)} kết quả</span>
      {(pages > 1 || page > 1) && (
        <div className="flex items-center gap-2">
          <button className="btn-ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>Trang trước</button>
          <span>Trang {fmtNum(page)} / {fmtNum(pages)}</span>
          <button className="btn-ghost" disabled={page >= pages} onClick={() => setPage(page + 1)}>Trang sau</button>
        </div>
      )}
    </div>
  )
}

function WikiDocuments({ reader }: { reader: Reader }) {
  const [params, update] = useFilters()
  const location = useLocation()
  const filters = {
    page: Number(params.get('page')) || 1,
    search: params.get('q') || '',
    knowledgeType: params.get('kt') || '',
    department: params.get('dept') || '',
    status: params.get('status') || '',
    sort: params.get('sort') || 'created_desc',
  }
  const list = useAsync(() => reader.documents(filters), [params.toString()])
  const types = useAsync(reader.knowledgeTypes, [])
  const depts = useAsync(reader.departments, [])
  const summary = useAsync(reader.processingSummary, [])
  const alerts = summary.data && [
    { n: summary.data.running, label: 'đang xử lý', cls: 'text-accent bg-accent-soft', status: 'pending,queued,processing' },
    { n: summary.data.review, label: 'chờ duyệt', cls: 'text-warn bg-warn/10', status: 'awaiting_approval' },
    { n: summary.data.failed, label: 'lỗi xử lý', cls: 'text-danger bg-danger/10', status: 'failed,error' },
  ].filter((a) => a.n > 0)

  return (
    <section className="card" aria-label="Danh sách tài liệu Wiki">
      <div className="space-y-3 border-b border-line p-4">
        <div className="flex flex-wrap items-end gap-2">
          <SearchBox label="Tìm theo tiêu đề hoặc tên tệp" value={filters.search} onSearch={(q) => update({ q })} />
          <Select label="Loại tri thức" value={filters.knowledgeType} onChange={(kt) => update({ kt })}
            options={[{ value: '', label: 'Tất cả loại' }, ...(types.data || []).map((t) => ({ value: t.id, label: t.name }))]} />
          <Select label="Phòng ban" value={filters.department} onChange={(dept) => update({ dept })}
            options={[{ value: '', label: 'Tất cả phòng ban' }, ...(depts.data || []).map((d) => ({ value: d.id, label: d.name }))]} />
          <Select label="Trạng thái" value={filters.status} onChange={(status) => update({ status })} options={STATUS_FILTERS} />
          <Select label="Sắp xếp" value={filters.sort} onChange={(sort) => update({ sort })} options={SORTS} />
        </div>
        {alerts && alerts.length > 0 && (
          <div className="flex flex-wrap gap-2 text-xs" aria-label="Tình trạng xử lý">
            {alerts.map((a) => (
              <button key={a.label} type="button" onClick={() => update({ status: a.status })}
                className={`rounded-md px-2 py-1 font-medium ${a.cls}`}>{fmtNum(a.n)} tài liệu {a.label}</button>
            ))}
          </div>
        )}
      </div>
      {list.loading ? <Loading />
        : list.error ? <ErrorBox message={list.error} onRetry={list.reload} />
        : list.data && (
          <>
            <WikiTable rows={list.data.items} label="Danh sách tài liệu Wiki" columns={[
              { label: 'Tài liệu', cell: (row) => {
                const meta = [row.doc_meta?.doc_number, row.doc_meta?.issuing_authority].filter(Boolean).join(' · ')
                return (
                  <div className="min-w-[16rem]">
                    <Link to={row.id} state={{ from: location.search }} className="font-medium text-accent hover:underline">{docTitle(row)}</Link>
                    {meta && <p className="mt-0.5 text-xs text-muted">{meta}</p>}
                  </div>
                )
              } },
              { label: 'Loại tri thức', cell: (row) => row.knowledge_type_name
                ? <span className="inline-flex items-center gap-1.5"><Dot color={row.knowledge_type_color} />{row.knowledge_type_name}</span> : '—' },
              { label: 'Phòng ban', cell: (row) => row.department_names?.join(', ') || <span className="text-muted">{SCOPE[row.scope_type || ''] || '—'}</span> },
              { label: 'Trang Wiki', cell: (row) => <span className="num">{fmtNum(row.wiki_page_count || 0)}</span> },
              { label: 'Trạng thái', cell: (row) => (
                <div>
                  <DocStatus status={row.status} />
                  {row.status !== 'ready' && row.progress_message && <p className="mt-1 text-xs text-muted">{row.progress_message}</p>}
                </div>
              ) },
              { label: 'Tải lên', cell: (row) => <span className="whitespace-nowrap text-muted">{fmtDate(row.created_at)}</span> },
            ]} />
            <Pager list={list.data} page={filters.page} setPage={(page) => update({ page: String(page) })} />
          </>
        )}
    </section>
  )
}

const DETAIL_TABS = [
  { key: 'content', label: 'Nội dung trích xuất' },
  { key: 'wiki', label: 'Trang Wiki' },
  { key: 'info', label: 'Thông tin' },
  { key: 'file', label: 'Tệp gốc' },
]

function DocumentDetail({ reader }: { reader: Reader }) {
  const { id = '' } = useParams()
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const tab = DETAIL_TABS.some((t) => t.key === params.get('tab')) ? params.get('tab')! : 'content'
  const doc = useAsync(() => reader.document(id), [id])
  const back = `/wiki/documents${(location.state as { from?: string } | null)?.from || ''}`

  return (
    <>
      <Link to={back} className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Danh sách tài liệu
      </Link>
      {doc.loading ? <div className="card"><Loading /></div>
        : doc.error ? <div className="card"><ErrorBox message={doc.error} onRetry={doc.reload} /></div>
        : doc.data && (
          <>
            <header className="mb-4">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                <DocStatus status={doc.data.status} />
                <span className="text-muted">{fmtNum(doc.data.wiki_page_count || 0)} trang wiki</span>
                <span className="rounded-md bg-sunken px-2 py-0.5 text-muted">{SCOPE[doc.data.scope_type || ''] || doc.data.scope_type}</span>
              </div>
              <h2 className="text-xl font-semibold tracking-tight [overflow-wrap:anywhere]">{docTitle(doc.data)}</h2>
              {doc.data.doc_meta?.official_title && <p className="mt-1 max-w-[80ch] text-sm text-muted">{doc.data.doc_meta.official_title}</p>}
              {doc.data.error_message && <p role="alert" className="mt-2 text-sm text-danger">{doc.data.error_message}</p>}
            </header>
            <div role="tablist" aria-label="Chi tiết tài liệu" className="mb-4 flex flex-wrap gap-1 border-b border-line">
              {DETAIL_TABS.map((t) => (
                <button key={t.key} type="button" role="tab" aria-selected={tab === t.key}
                  onClick={() => setParams(t.key === 'content' ? {} : { tab: t.key }, { replace: true, state: location.state })}
                  className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${tab === t.key ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-ink'}`}>
                  {t.label}{t.key === 'wiki' ? ` (${fmtNum(doc.data!.wiki_page_count || 0)})` : ''}
                </button>
              ))}
            </div>
            <div role="tabpanel">
              {tab === 'content' && (
                <section className="card p-5">
                  {doc.data.full_text ? <Markdown text={doc.data.full_text} /> : <Empty title="Tài liệu chưa có nội dung trích xuất" />}
                </section>
              )}
              {tab === 'wiki' && <DocumentArticles reader={reader} sourceId={id} />}
              {tab === 'info' && <DocumentInfo doc={doc.data} />}
              {tab === 'file' && <OriginalFile reader={reader} doc={doc.data} />}
            </div>
          </>
        )}
    </>
  )
}

function DocumentInfo({ doc }: { doc: WikiDocument }) {
  const m = doc.doc_meta || {}
  const rows: [string, ReactNode][] = [
    ['Tên tệp', doc.file_name || (doc.url && <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">{doc.url}</a>)],
    ['Kích thước', fmtSize(doc.file_size)],
    ['Số trang', doc.page_count ? fmtNum(doc.page_count) : '—'],
    ['Token trích xuất', doc.extracted_token_count ? fmtNum(doc.extracted_token_count) : '—'],
    ['Loại tri thức', doc.knowledge_type_name],
    ['Phòng ban được xem', doc.department_names?.join(', ')],
    ['Phòng ban quản lý', doc.managing_department_name],
    ['Phạm vi', SCOPE[doc.scope_type || ''] || doc.scope_type],
    ['Nhãn bảo mật', doc.security_label],
    ['Người đóng góp', doc.contributed_by_name],
    ['Loại văn bản', m.doc_type],
    ['Số hiệu', m.doc_number],
    ['Cơ quan ban hành', m.issuing_authority],
    ['Ngày ban hành', m.issued_date && fmtDate(m.issued_date)],
    ['Ngày hiệu lực', m.effective_date && fmtDate(m.effective_date)],
    ['Ngày hết hiệu lực', m.expiry_date && fmtDate(m.expiry_date)],
    ['Tiến trình', doc.progress_message],
    ['Tải lên lúc', fmtDate(doc.created_at, true)],
    ['Cập nhật lúc', fmtDate(doc.updated_at, true)],
  ]
  return (
    <section className="card p-5">
      <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[12rem_minmax(0,1fr)]">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted">{k}</dt>
            <dd className="[overflow-wrap:anywhere]">{v || '—'}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function DocumentArticles({ reader, sourceId }: { reader: Reader; sourceId: string }) {
  const articles = useAsync(() => reader.articles(sourceId), [sourceId])
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<WikiArticle | null>(null)
  const shown = useMemo(() => {
    const k = q.trim().toLowerCase()
    return (articles.data || []).filter((a) => !k || a.title.toLowerCase().includes(k) || a.summary?.toLowerCase().includes(k))
  }, [articles.data, q])

  return (
    <section className="card" aria-label="Các trang Wiki được tạo từ tài liệu">
      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-line p-4">
        <p className="text-sm text-muted">Các trang Wiki được tạo từ tài liệu này.</p>
        <div className="w-full sm:w-64">
          <label htmlFor="wiki-article-q" className="label">Lọc trang Wiki</label>
          <input id="wiki-article-q" className="field" type="search" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      {articles.loading ? <Loading />
        : articles.error ? <ErrorBox message={articles.error} onRetry={articles.reload} />
        : !shown.length ? <Empty title="Không có trang Wiki" />
        : (
          <ul className="divide-y divide-line">
            {shown.map((a) => (
              <li key={a.id}>
                <button type="button" onClick={() => setOpen(a)} className="block w-full px-4 py-3 text-left hover:bg-sunken">
                  <span className="font-medium">{a.title}</span>
                  {a.summary && <span className="mt-0.5 line-clamp-2 block text-sm text-muted">{a.summary.replace(/[*_`#]+/g, "")}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      {open && <ArticleModal reader={reader} article={open} onClose={() => setOpen(null)} />}
    </section>
  )
}

function ArticleModal({ reader, article, onClose }: { reader: Reader; article: WikiArticle; onClose: () => void }) {
  const detail = useAsync(() => reader.article(article.slug), [article.slug])
  return (
    <Modal open title={article.title} onClose={onClose} maxWidth="max-w-3xl">
      <p className="mb-3 text-xs text-muted">
        Phiên bản {fmtNum(article.version || 1)} · cập nhật {fmtDate(article.updated_at, true)}
      </p>
      {detail.loading ? <Loading />
        : detail.error ? <ErrorBox message={detail.error} onRetry={detail.reload} />
        : detail.data?.content_md ? <Markdown text={detail.data.content_md} />
        : <Empty title="Trang Wiki chưa có nội dung" />}
    </Modal>
  )
}

function OriginalFile({ reader, doc }: { reader: Reader; doc: WikiDocument }) {
  const isFile = doc.source_type !== 'url'
  const file = useAsync(() => isFile ? reader.originalFile(doc.id) : Promise.resolve(null), [doc.id])
  const url = useMemo(() => file.data ? URL.createObjectURL(file.data) : '', [file.data])
  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])

  if (!isFile) return (
    <section className="card p-5 text-sm">
      Nguồn web: <a href={doc.url || '#'} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">
        {doc.url} <ExternalLink className="h-3.5 w-3.5" aria-hidden /></a>
    </section>
  )
  const type = file.data?.type || ''
  const inline = type === 'application/pdf' || type.startsWith('image/') || type.startsWith('text/')
  return (
    <section className="card overflow-hidden">
      {file.loading ? <Loading />
        : file.error ? <ErrorBox message={file.error} onRetry={file.reload} />
        : url && (
          <>
            <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3 text-sm">
              <span className="[overflow-wrap:anywhere]">{doc.file_name}</span>
              <a href={url} download={doc.file_name || 'tai-lieu'} className="btn-ghost"><Download className="h-4 w-4" aria-hidden /> Tải tệp gốc</a>
            </div>
            {inline
              ? <iframe title={`Tệp gốc: ${docTitle(doc)}`} src={url} className="h-[75dvh] w-full bg-white" sandbox={type === 'application/pdf' ? undefined : ''} />
              : <Empty title="Không xem trước được định dạng này" hint="Bấm “Tải tệp gốc” để mở bằng ứng dụng trên máy." />}
          </>
        )}
    </section>
  )
}

function WikiKnowledgeTypes({ reader }: { reader: Reader }) {
  const types = useAsync(reader.knowledgeTypes, [])
  return (
    <section className="card" aria-label="Danh sách loại tri thức">
      {types.loading ? <Loading />
        : types.error ? <ErrorBox message={types.error} onRetry={types.reload} />
        : types.data && <WikiTable rows={types.data} label="Danh sách loại tri thức" columns={[
          { label: 'Loại tri thức', cell: (row) => <span className="inline-flex items-center gap-1.5 font-medium"><Dot color={row.color} />{row.name}</span> },
          { label: 'Mã', cell: (row) => <code className="text-xs">{row.slug}</code> },
          { label: 'Mô tả', cell: (row) => row.description || '—' },
          { label: 'Số tài liệu', cell: (row) => row.source_count
            ? <Link to={`/wiki/documents?kt=${row.id}`} className="num text-accent hover:underline">{fmtNum(row.source_count)}</Link>
            : <span className="num">0</span> },
        ]} />}
    </section>
  )
}

function WikiDepartments({ reader }: { reader: Reader }) {
  const departments = useAsync(reader.departments, [])
  return (
    <section className="card" aria-label="Danh sách phòng ban Wiki">
      {departments.loading ? <Loading />
        : departments.error ? <ErrorBox message={departments.error} onRetry={departments.reload} />
        : departments.data && <WikiTable rows={departments.data} label="Danh sách phòng ban Wiki" columns={[
          { label: 'Phòng ban', cell: (row) => <span className="font-medium">{row.name}</span> },
          { label: 'Mã', cell: (row) => row.code || '—' },
          { label: 'Mô tả', cell: (row) => row.description || '—' },
          { label: 'Số tài khoản', cell: (row) => row.employee_count
            ? <Link to={`/wiki/accounts?dept=${row.id}`} className="num text-accent hover:underline">{fmtNum(row.employee_count)}</Link>
            : <span className="num">0</span> },
          { label: 'Tài liệu', cell: (row) => <Link to={`/wiki/documents?dept=${row.id}`} className="text-accent hover:underline">Xem tài liệu</Link> },
          { label: 'Trạng thái', cell: (row) => row.is_active === false ? 'Ngừng hoạt động' : 'Đang hoạt động' },
        ]} />}
    </section>
  )
}

function WikiAccounts({ reader }: { reader: Reader }) {
  const [params, update] = useFilters()
  const page = Number(params.get('page')) || 1
  const search = params.get('q') || ''
  const dept = params.get('dept') || ''
  const list = useAsync(() => reader.accounts(page, search, dept), [page, search, dept])
  const depts = useAsync(reader.departments, [])
  return (
    <section className="card" aria-label="Danh sách tài khoản Wiki">
      <div className="flex flex-wrap items-end gap-2 border-b border-line p-4">
        <SearchBox label="Tìm theo tên hoặc email" value={search} onSearch={(q) => update({ q })} />
        <Select label="Phòng ban" value={dept} onChange={(d) => update({ dept: d })}
          options={[{ value: '', label: 'Tất cả phòng ban' }, ...(depts.data || []).map((d) => ({ value: d.id, label: d.name }))]} />
      </div>
      {list.loading ? <Loading />
        : list.error ? <ErrorBox message={list.error} onRetry={list.reload} />
        : list.data && (
          <>
            <WikiTable rows={list.data.items} label="Danh sách tài khoản Wiki" columns={[
              { label: 'Họ tên', cell: (row) => <span className="font-medium">{row.name}</span> },
              { label: 'Email', cell: (row) => row.email || row.username || '—' },
              { label: 'Vai trò', cell: (row) => row.identity_roles?.map((r) => r.name).join(', ')
                || (row.role === 'admin' ? 'Quản trị viên' : row.role === 'employee' ? 'Nhân sự' : row.role) },
              { label: 'Phòng ban', cell: (row) => row.department_names?.join(', ') || '—' },
              { label: 'Kết nối gần nhất', cell: (row) => <span className="whitespace-nowrap text-muted">{fmtDate(row.last_connected, true)}</span> },
              { label: 'Trạng thái', cell: (row) => row.is_active ? 'Đang hoạt động' : 'Ngừng hoạt động' },
            ]} />
            <Pager list={list.data} page={page} setPage={(p) => update({ page: String(p) })} />
          </>
        )}
    </section>
  )
}

export default function Wiki({ session, onLogin, onLogout }: {
  session: WikiSession | null
  onLogin: (session: WikiSession) => void
  onLogout: (token: string) => void
}) {
  const reader = useMemo(() => session && wikiReader(session.token, onLogout), [session, onLogout])
  const gate = (page: (reader: Reader) => ReactNode) => reader ? page(reader) : <WikiLogin onLogin={onLogin} />
  return (
    <>
      <PageHeader title="Document Wiki" desc={session ? 'Chỉ xem. Thêm, sửa tài liệu tại hệ thống Document Wiki gốc.' : 'Đăng nhập bằng tài khoản Document Wiki để xem dữ liệu theo quyền được cấp.'} actions={session && (
        <button type="button" className="btn-ghost" onClick={() => onLogout(session.token)} title={session.name}>
          <LogOut className="h-4 w-4" aria-hidden /> Đăng xuất Wiki
        </button>
      )} />
      <nav aria-label="Document Wiki" className="mb-4 flex flex-wrap gap-1 border-b border-line pb-2">
        {TABS.map(({ to, label }) => (
          <NavLink key={to} to={to} className={({ isActive }) =>
            `rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-sunken'}`
          }>{label}</NavLink>
        ))}
      </nav>
      <Routes>
        <Route path="documents" element={gate((r) => <WikiDocuments reader={r} />)} />
        <Route path="documents/:id" element={gate((r) => <DocumentDetail reader={r} />)} />
        <Route path="knowledge-types" element={gate((r) => <WikiKnowledgeTypes reader={r} />)} />
        <Route path="departments" element={gate((r) => <WikiDepartments reader={r} />)} />
        <Route path="accounts" element={gate((r) => <WikiAccounts reader={r} />)} />
        <Route path="*" element={<Navigate to="/wiki/documents" replace />} />
      </Routes>
    </>
  )
}
