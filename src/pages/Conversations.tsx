import { ArrowLeft, ChevronLeft, ChevronRight, Download, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Empty, ErrorBox, PageHeader, SourceBadge, StatusPill, fmtAgo, fmtTime, sourceOf } from '../components/ui'
import { useAsync } from '../hooks/useAsync'
import { api, type Conversation, type Message } from '../lib/api'

const LIMIT = 30
const SENDER: Record<string, string> = { user: 'Người dân', assistant: 'Trợ lý ảo', officer: 'Cán bộ', staff: 'Cán bộ', system: 'Hệ thống' }

const whoOf = (c: Conversation) => c.user?.display_name || c.user_id || 'Khách ẩn danh'

const toTs = (d: string, end = false) => (d ? Math.floor(new Date(`${d}T${end ? '23:59:59' : '00:00:00'}+07:00`).getTime() / 1000) : 0)

async function exportXlsx(rows: Record<string, unknown>[], sheet: string, file: string) {
  const XLSX = await import('xlsx') // ~400KB, chỉ tải khi xuất
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), sheet)
  XLSX.writeFile(wb, file)
}

function Transcript({ id, nameOf, onClose, onUpdated }: {
  id: number
  nameOf: (k: string) => string
  onClose: () => void
  onUpdated: () => void
}) {
  const conv = useAsync(() => api.conversation(id), [id])
  const msgs = useAsync(() => api.messages(id), [id])
  const end = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState('')
  const [pending, setPending] = useState<'reply' | 'close' | ''>('')
  const [actionError, setActionError] = useState('')
  const [notice, setNotice] = useState('')
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' })
  }, [msgs.data])

  const c = conv.data
  const s = c && sourceOf(c)
  const who = c ? whoOf(c) : ''

  const canReply = !!c?.oa_id && c.status !== 'closed'

  const handleAction = async (action: 'reply' | 'close') => {
    if (pending || !c || c.status === 'closed') return
    const message = draft.trim()
    if (action === 'reply' && (!canReply || !message)) return
    setPending(action)
    setActionError('')
    setNotice('')
    try {
      if (action === 'reply') {
        await api.replyToConversation(id, message)
        setDraft('')
        setNotice('Đã gửi qua Zalo.')
        msgs.reload()
      } else {
        await api.closeConversation(id)
        setNotice('Đã đóng hội thoại.')
      }
      conv.reload()
      onUpdated()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Thao tác thất bại. Vui lòng thử lại.')
    } finally {
      setPending('')
    }
  }

  const sendReply = (event: FormEvent) => {
    event.preventDefault()
    void handleAction('reply')
  }


  return (
    <section className="card flex min-h-[60dvh] flex-col lg:sticky lg:top-6 lg:h-[calc(100dvh-3rem)]" aria-label="Nội dung hội thoại">
      <header className="flex shrink-0 items-start gap-3 border-b border-line px-4 py-3">
        <button onClick={onClose} className="rounded-lg p-2 hover:bg-sunken lg:hidden" aria-label="Quay lại danh sách">
          <ArrowLeft className="h-4 w-4" aria-hidden />
        </button>
        <div className="min-w-0 flex-1">
          {c ? (
            <>
              <p className="line-clamp-2 font-semibold [overflow-wrap:anywhere]" title={c.title || who}>{c.title || who}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <SourceBadge kind={s!.kind} label={nameOf(s!.key)} />
                <StatusPill status={c.status} />
                {c.status === 'needs_human' && !!c.handoff_since && (
                  <span title={fmtTime(c.handoff_since)}>Cần hỗ trợ từ {fmtTime(c.handoff_since)}</span>
                )}
                {c.title && <span className="text-xs text-muted">{who}</span>}
                <span className="text-xs text-muted">Bắt đầu {fmtTime(c.started_at)}</span>
              </div>
            </>
          ) : conv.error ? (
            <ErrorBox message={conv.error} onRetry={conv.reload} />
          ) : (
            <div className="skeleton h-10 w-48" />
          )}
        </div>
        <button className="btn-ghost h-9 px-3" disabled={!msgs.data?.length}
          onClick={() => msgs.data && exportXlsx(
            msgs.data.map((m) => ({ 'Thời gian': fmtTime(m.created_at), 'Người gửi': SENDER[m.sender] || m.sender, 'Nội dung': m.content })),
            'Hoi thoai', `hoi-thoai-${id}.xlsx`)}>
          <Download className="h-4 w-4" aria-hidden /> <span className="hidden sm:inline">Xuất Excel</span>
        </button>
        <button onClick={onClose} className="hidden rounded-lg p-2 hover:bg-sunken lg:block" aria-label="Đóng">
          <X className="h-4 w-4" aria-hidden />
        </button>
      </header>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-sunken/50 px-4 py-4">
        {msgs.error ? (
          <ErrorBox message={msgs.error} onRetry={msgs.reload} />
        ) : !msgs.data ? (
          [0, 1, 2].map((i) => <div key={i} className={`skeleton h-14 w-2/3 ${i % 2 ? 'ml-auto' : ''}`} />)
        ) : !msgs.data.length ? (
          <Empty title="Hội thoại chưa có tin nhắn" />
        ) : (
          msgs.data.map((m: Message) => {
            const mine = m.sender === 'user'
            return (
              <div key={m.id} className={`flex flex-col ${mine ? 'items-start' : 'items-end'}`}>
                <div className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed [overflow-wrap:anywhere] ${
                  mine ? 'rounded-bl-md bg-surface shadow-card' : m.sender === 'assistant' ? 'rounded-br-md bg-accent text-white' : 'rounded-br-md bg-ok text-white'
                }`}>
                  {m.content || <em className="opacity-70">[không có nội dung văn bản]</em>}
                </div>
                <span className="mt-1 px-1 text-[11px] text-muted">{SENDER[m.sender] || m.sender} · {fmtTime(m.created_at)}</span>
              </div>
            )
          })
        )}
        <div ref={end} />
      </div>
      {c && (c.status !== 'closed' || notice || actionError) && (
        <footer className="shrink-0 space-y-2 border-t border-line p-3 sm:px-4">
          {actionError && <p role="alert" className="text-sm text-danger">{actionError}</p>}
          {notice && <p role="status" className="text-sm text-ok">{notice}</p>}
          {c.status !== 'closed' && (
            <form className="space-y-2" onSubmit={sendReply}>
              {canReply ? (
                <div>
                  <label htmlFor="officer-reply" className="label">Trả lời qua Zalo</label>
                  <textarea id="officer-reply" rows={2} maxLength={4000}
                    className="field !h-auto !min-h-0 !max-h-32 resize-y py-2" value={draft}
                    onChange={(event) => setDraft(event.target.value)} disabled={!!pending}
                    placeholder="Nhập nội dung gửi cho người dân..." />
                </div>
              ) : (
                <p className="text-sm text-muted">Hội thoại web. Đóng hội thoại sau khi đã xử lý qua kênh hỗ trợ phù hợp.</p>
              )}
              <div className="flex flex-wrap justify-end gap-2">
                <button type="button" className="btn-ghost" onClick={() => void handleAction('close')}
                  disabled={!!pending || conv.loading || !!draft.trim()}>
                  {pending === 'close' ? 'Đang đóng...' : 'Đóng hội thoại'}
                </button>
                {canReply && (
                  <button type="submit" className="btn-primary" disabled={!!pending || conv.loading || !draft.trim()}>
                    {pending === 'reply' ? 'Đang gửi...' : 'Gửi qua Zalo'}
                  </button>
                )}
              </div>
            </form>
          )}
        </footer>
      )}
    </section>
  )
}

export default function Conversations() {
  const [sp, setSp] = useSearchParams()
  const source = sp.get('source') || ''
  const queue = sp.get('status') === 'needs_human'
  const from = sp.get('from') || ''
  const to = sp.get('to') || ''
  const page = Math.max(0, Number(sp.get('page')) || 0)
  const openId = Number(sp.get('id')) || 0

  const set = (patch: Record<string, string | number>) => {
    const next = new URLSearchParams(sp)
    for (const [k, v] of Object.entries(patch)) v ? next.set(k, String(v)) : next.delete(k)
    if (!('page' in patch) && !('id' in patch)) next.delete('page')
    setSp(next, { replace: 'id' in patch })
  }

  const srcs = useAsync(api.sources, [])
  const list = useAsync(
    () => api.conversations({ source, status: queue ? 'needs_human' : '', date_from: toTs(from), date_to: toTs(to, true), offset: page * LIMIT, limit: LIMIT }),
    [source, queue, from, to, page],
  )
  const nameOf = (k: string) => srcs.data?.find((s) => s.source === k)?.name || k.replace(/^web:/, '')
  const total = list.data?.total || 0
  const pages = Math.max(1, Math.ceil(total / LIMIT))
  useEffect(() => {
    if (!list.loading && list.data && page >= pages) set({ page: pages - 1 })
  }, [list.loading, list.data, page, pages])

  const exportPage = () =>
    list.data && exportXlsx(
      list.data.conversations.map((c: Conversation) => ({
        'Mã': c.id, 'Tiêu đề': c.title, 'Người dân': whoOf(c), 'Nguồn': nameOf(sourceOf(c).key),
        'Số tin nhắn': c.message_count, 'Trạng thái': c.status, 'Bắt đầu': fmtTime(c.started_at), 'Gần nhất': fmtTime(c.last_message_at),
      })),
      'Danh sach', `hoi-thoai-trang-${page + 1}.xlsx`)

  return (
    <>
      <PageHeader
        title="Hội thoại"
        desc="Lịch sử hỏi đáp của người dân, lọc theo nguồn và thời gian."
        actions={
          <button className="btn-ghost" onClick={exportPage} disabled={!list.data?.conversations.length}>
            <Download className="h-4 w-4" aria-hidden /> Xuất trang này
          </button>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Chế độ xem hội thoại" className="flex gap-1 rounded-lg bg-sunken p-1">
          {[{ value: '', label: 'Tất cả' }, { value: 'needs_human', label: 'Cần xử lý' }].map(({ value, label }) => {
            const active = queue === !!value
            return (
              <button key={value} type="button" aria-pressed={active} onClick={() => set({ status: value, page: 0, id: 0 })}
                className={`rounded-md px-3 py-2 text-sm font-medium ${active ? 'bg-surface text-accent shadow-card' : 'text-muted hover:text-ink'}`}>
                {label}
              </button>
            )
          })}
        </div>
        {queue && <span className="text-sm text-muted">Chờ lâu nhất trước</span>}
        <button type="button" className="btn-ghost ml-auto" onClick={list.reload} disabled={list.loading}>Làm mới</button>
      </div>

      <div className="card mb-4 grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_170px_170px_auto] sm:items-end">
        <div>
          <label htmlFor="f-src" className="label">Nguồn</label>
          <select id="f-src" className="field" value={source} onChange={(e) => set({ source: e.target.value })}>
            <option value="">Tất cả nguồn</option>
            <option value="web">Tất cả cổng web</option>
            <option value="zalo">Tất cả Zalo OA</option>
            {srcs.data?.some((s) => s.kind === 'web') && (
              <optgroup label="Cổng web">
                {srcs.data.filter((s) => s.kind === 'web').map((s) => <option key={s.source} value={s.source}>{s.name}</option>)}
              </optgroup>
            )}
            {srcs.data?.some((s) => s.kind === 'zalo') && (
              <optgroup label="Zalo OA">
                {srcs.data.filter((s) => s.kind === 'zalo').map((s) => <option key={s.source} value={s.source}>{s.name}</option>)}
              </optgroup>
            )}
            {source && !['web', 'zalo'].includes(source) && srcs.data && !srcs.data.some((s) => s.source === source) && (
              <option value={source}>{nameOf(source)}</option>
            )}
          </select>
        </div>
        <div>
          <label htmlFor="f-from" className="label">Từ ngày</label>
          <input id="f-from" type="date" className="field" value={from} max={to || undefined} onChange={(e) => set({ from: e.target.value })} />
        </div>
        <div>
          <label htmlFor="f-to" className="label">Đến ngày</label>
          <input id="f-to" type="date" className="field" value={to} min={from || undefined} onChange={(e) => set({ to: e.target.value })} />
        </div>
        <button className="btn-ghost" disabled={!source && !from && !to} onClick={() => set({ source: '', from: '', to: '', page: 0, id: 0 })}>Xóa lọc</button>
      </div>

      <div className={`grid gap-4 ${openId ? 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]' : ''}`}>
        <section className={`card ${openId ? 'hidden lg:block' : ''}`} aria-label="Danh sách hội thoại">
          <div className="flex items-center justify-between border-b border-line px-4 py-3 text-sm text-muted" aria-live="polite">
            <span>{list.data ? <><span className="num font-medium text-ink">{total.toLocaleString('vi-VN')}</span> hội thoại</> : 'Đang tải...'}</span>
            <span className="num">Trang {page + 1}/{pages}</span>
          </div>
          {list.error ? (
            <ErrorBox message={list.error} onRetry={list.reload} />
          ) : !list.data ? (
            <div className="space-y-3 p-4">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-12" />)}</div>
          ) : !list.data.conversations.length ? (
            <Empty title={queue ? 'Không có hội thoại cần xử lý' : 'Không có hội thoại phù hợp'}
              hint={source || from || to ? 'Thử bỏ bớt bộ lọc hoặc chọn khoảng thời gian rộng hơn.' : undefined} />
          ) : (
            <ul className={`divide-y divide-line ${list.loading ? 'opacity-60' : ''}`}>
              {list.data.conversations.map((c) => {
                const s = sourceOf(c)
                const active = c.id === openId
                return (
                  <li key={c.id}>
                    <button onClick={() => set({ id: c.id })} aria-current={active || undefined}
                      className={`w-full px-4 py-3 text-left transition-colors ${active ? 'bg-accent-soft' : 'hover:bg-sunken'}`}>
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate text-sm font-medium" title={c.title || undefined}>{c.title || whoOf(c)}</span>
                        <span className="mt-0.5 shrink-0 whitespace-nowrap text-xs text-muted"
                          title={fmtTime(queue ? c.handoff_since || c.last_message_at : c.last_message_at)}>
                          {queue && 'Chờ từ '}{fmtAgo(queue ? c.handoff_since || c.last_message_at : c.last_message_at)}
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <span className="min-w-0"><SourceBadge kind={s.kind} label={nameOf(s.key)} /></span>
                        <StatusPill status={c.status} />
                        {c.title && <span className="min-w-0 truncate text-xs text-muted">{whoOf(c)}</span>}
                        <span className="num ml-auto shrink-0 text-xs text-muted">{c.message_count} tin</span>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          <nav className="flex items-center justify-between border-t border-line px-4 py-3" aria-label="Phân trang">
            <button className="btn-ghost h-9 px-3" disabled={page === 0} onClick={() => set({ page: page - 1 })}>
              <ChevronLeft className="h-4 w-4" aria-hidden /> Trước
            </button>
            <button className="btn-ghost h-9 px-3" disabled={page + 1 >= pages} onClick={() => set({ page: page + 1 })}>
              Sau <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </nav>
        </section>

        {openId > 0 && <Transcript key={openId} id={openId} nameOf={nameOf} onClose={() => set({ id: 0 })} onUpdated={list.reload} />}
      </div>
    </>
  )
}
