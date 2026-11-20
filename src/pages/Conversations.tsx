import { ArrowLeft, ChevronLeft, ChevronRight, Download, X } from 'lucide-react'
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Empty, ErrorBox, PageHeader, SourceBadge, StatusPill, fmtAgo, fmtTime, sourceOf } from '../components/ui'
import { useAsync } from '../hooks/useAsync'
import { api, type Citation, type Conversation, type Message } from '../lib/api'

const LIMIT = 30
const SENDER: Record<string, string> = { user: 'Người dân', assistant: 'Trợ lý ảo', officer: 'Cán bộ', staff: 'Cán bộ', system: 'Hệ thống' }

const whoOf = (c: Conversation) => c.user?.display_name || c.user_id || 'Khách ẩn danh'
// Khách web ẩn danh chỉ có mã phiên ngẫu nhiên — không đáng hiển thị trong danh sách.
const nameOnly = (c: Conversation) => c.user?.display_name || (c.oa_id ? c.user_id : '')

// shortcut: chỉ render **đậm**, `code`, [link](url) và tự xuống dòng; cần bảng/ảnh thì thêm thư viện markdown.
function Md({ text }: { text: string }) {
  const out: ReactNode[] = []
  const re = /\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g
  let last = 0
  for (const m of text.matchAll(re)) {
    out.push(text.slice(last, m.index))
    if (m[1]) out.push(<strong key={m.index} className="font-semibold">{m[1]}</strong>)
    else if (m[2]) out.push(<code key={m.index} className="rounded bg-black/10 px-1 font-mono text-[0.85em]">{m[2]}</code>)
    else out.push(<a key={m.index} href={m[4]} target="_blank" rel="noreferrer" className="underline underline-offset-2">{m[3]}</a>)
    last = m.index! + m[0].length
  }
  out.push(text.slice(last))
  return <>{out.map((x, i) => <Fragment key={i}>{x}</Fragment>)}</>
}

const toTs = (d: string, end = false) => (d ? Math.floor(new Date(`${d}T${end ? '23:59:59' : '00:00:00'}+07:00`).getTime() / 1000) : 0)

async function exportXlsx(rows: Record<string, unknown>[], sheet: string, file: string) {
  const XLSX = await import('xlsx') // ~400KB, chỉ tải khi xuất
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), sheet)
  XLSX.writeFile(wb, file)
}

// Khung vừa khít phần còn lại của màn hình: trang không cuộn, header/pager đứng yên, chỉ phần giữa cuộn.
function useFitHeight() {
  const box = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    const fit = () => {
      const el = box.current
      if (el) el.style.height = `${Math.max(420, innerHeight - el.getBoundingClientRect().top - scrollY - 32)}px`
    }
    fit()
    addEventListener('resize', fit)
    return () => removeEventListener('resize', fit)
  }, [])
  return box
}

// Trang đầu, cuối, quanh trang hiện tại; khoảng hở thành dấu "…".
function pageItems(page: number, pages: number): (number | '…')[] {
  const keep = [...new Set([0, page - 1, page, page + 1, pages - 1])].filter((p) => p >= 0 && p < pages).sort((a, b) => a - b)
  return keep.flatMap((p, i) => (i && p - keep[i - 1] > 1 ? ['…' as const, p] : [p]))
}

function Pager({ page, pages, onGo }: { page: number; pages: number; onGo: (p: number) => void }) {
  const btn = 'inline-flex h-8 min-w-[2rem] items-center justify-center rounded-md px-2 text-sm num transition-colors disabled:pointer-events-none disabled:opacity-40'
  return (
    <nav className="flex shrink-0 items-center justify-center gap-1 border-t border-line px-3 py-2" aria-label="Phân trang">
      <button className={`${btn} hover:bg-sunken`} disabled={page === 0} onClick={() => onGo(page - 1)} aria-label="Trang trước">
        <ChevronLeft className="h-4 w-4" aria-hidden />
      </button>
      {pageItems(page, pages).map((p, i) =>
        p === '…' ? <span key={`g${i}`} className="px-1 text-sm text-muted" aria-hidden>…</span> : (
          <button key={p} onClick={() => onGo(p)} aria-current={p === page ? 'page' : undefined} aria-label={`Trang ${p + 1}`}
            className={`${btn} ${p === page ? 'bg-accent font-semibold text-white dark:text-bg' : 'text-muted hover:bg-sunken hover:text-ink'}`}>
            {p + 1}
          </button>
        ))}
      <button className={`${btn} hover:bg-sunken`} disabled={page + 1 >= pages} onClick={() => onGo(page + 1)} aria-label="Trang sau">
        <ChevronRight className="h-4 w-4" aria-hidden />
      </button>
    </nav>
  )
}

function joinMessages(older: Message[], newer: Message[]) {
  return [...new Map([...older, ...newer].map((message) => [message.id, message])).values()]
}

function WebAttachment({ conversationId, messageId }: { conversationId: number; messageId: number }) {
  const [preview, setPreview] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const request = useRef<AbortController | null>(null)
  const url = useRef('')
  useEffect(() => () => {
    request.current?.abort()
    if (url.current) URL.revokeObjectURL(url.current)
  }, [])

  const open = async () => {
    if (request.current || url.current) return
    const controller = new AbortController()
    request.current = controller
    setLoading(true)
    setError('')
    try {
      const blob = await api.messageAttachment(conversationId, messageId, controller.signal)
      if (controller.signal.aborted) return
      url.current = URL.createObjectURL(blob)
      setPreview(url.current)
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Không mở được ảnh.')
    } finally {
      if (!controller.signal.aborted) setLoading(false)
      request.current = null
    }
  }

  return (
    <div className="mt-1.5">
      {preview ? (
        <a href={preview} target="_blank" rel="noreferrer" className="inline-block rounded-md focus-visible:outline-accent" aria-label="Mở ảnh đính kèm ở kích thước gốc">
          <img className="max-h-64 w-auto max-w-full rounded-md object-contain" src={preview} alt="Ảnh người dân gửi" />
        </a>
      ) : (
        <button type="button" onClick={open} disabled={loading} className="text-sm font-medium text-accent underline underline-offset-2 disabled:opacity-60">
          {loading ? 'Đang mở ảnh…' : 'Xem ảnh đính kèm'}
        </button>
      )}
      {error && <p role="alert" className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  )
}

function MessageSources({ citations }: { citations?: Citation[] }) {
  const sources = Array.isArray(citations) ? citations.filter((source) => source?.title || source?.source || source?.document_number) : []
  if (!sources.length) return null
  return (
    <details className="mt-2 border-t border-line pt-1.5 text-xs">
      <summary className="cursor-pointer font-medium text-accent">Nguồn tham khảo ({sources.length})</summary>
      <ul className="mt-1.5 space-y-1.5">
        {sources.map((source, i) => {
          const label = source.title || source.source || source.document_number
          const locator = [source.document_number, ...(Array.isArray(source.sections) ? source.sections : []), source.pages && `Trang ${source.pages}`].filter(Boolean).join(' · ')
          return (
            <li key={i}>
              <span className="font-medium">{label}</span>
              {locator && <span className="block text-muted">{locator}</span>}
              {source.url_verified === true && /^https:\/\//i.test(source.url || '') && (
                <a href={source.url} target="_blank" rel="noreferrer" className="text-accent underline underline-offset-2" aria-label={`Xem văn bản công khai ${source.document_number || label}`}>
                  Xem văn bản công khai
                </a>
              )}
            </li>
          )
        })}
      </ul>
    </details>
  )
}

function newReplyId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 15) | 64
  bytes[8] = (bytes[8] & 63) | 128
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('')
}

function Transcript({ id, nameOf, onClose, onUpdated }: {
  id: number
  nameOf: (k: string) => string
  onClose: () => void
  onUpdated: () => void
}) {
  const conv = useAsync(() => api.conversation(id), [id])
  const msgs = useAsync(() => api.recentMessages(id), [id])
  const scroll = useRef<HTMLDivElement>(null)
  const prependAnchor = useRef<{ height: number; top: number } | null>(null)
  const box = useFitHeight()
  const heading = useRef<HTMLHeadingElement>(null)
  const [draft, setDraft] = useState('')
  const webReply = useRef<{ content: string; id: string } | null>(null)
  const [pending, setPending] = useState<'reply' | 'close' | ''>('')
  const [actionError, setActionError] = useState('')
  const [notice, setNotice] = useState('')
  const [history, setHistory] = useState<{ messages: Message[]; beforeId: number | null } | null>(null)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [olderError, setOlderError] = useState('')
  const [exporting, setExporting] = useState(false)
  const beforeId = history ? history.beforeId : msgs.data?.next_before_id
  const messages = useMemo(
    () => joinMessages(history?.messages ?? [], msgs.data?.messages ?? []),
    [history, msgs.data],
  )
  useLayoutEffect(() => {
    if (!matchMedia('(max-width: 1023px)').matches) return
    box.current?.scrollIntoView({ block: 'start' })
    heading.current?.focus({ preventScroll: true })
  }, [box])

  useLayoutEffect(() => {
    const box = scroll.current
    if (!box || !messages.length) return
    const anchor = prependAnchor.current
    box.scrollTop = anchor ? anchor.top + box.scrollHeight - anchor.height : box.scrollHeight
    prependAnchor.current = null
  }, [messages])

  const loadOlder = async () => {
    if (!beforeId || loadingOlder) return
    setLoadingOlder(true)
    try {
      const page = await api.recentMessages(id, beforeId)
      const box = scroll.current
      if (box) prependAnchor.current = { height: box.scrollHeight, top: box.scrollTop }
      setOlderError('')
      setHistory((prev) => ({
        messages: joinMessages(page.messages, prev?.messages ?? []),
        beforeId: page.next_before_id,
      }))
    } catch (error) {
      setOlderError(error instanceof Error ? error.message : 'Không tải được tin nhắn cũ.')
    } finally {
      setLoadingOlder(false)
    }
  }

  const exportTranscript = async () => {
    if (exporting) return
    setExporting(true)
    setActionError('')
    try {
      const pages: Message[][] = []
      let cursor: number | undefined
      do {
        const page = await api.recentMessages(id, cursor, 100)
        pages.push(page.messages)
        cursor = page.next_before_id ?? undefined
      } while (cursor)
      await exportXlsx(
        pages.reverse().flat().map((m) => ({ 'Thời gian': fmtTime(m.created_at), 'Người gửi': SENDER[m.sender] || m.sender, 'Nội dung': m.content })),
        'Hoi thoai', `hoi-thoai-${id}.xlsx`,
      )
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Không xuất được hội thoại.')
    } finally {
      setExporting(false)
    }
  }

  const c = conv.data
  const s = c && sourceOf(c)
  const who = c ? whoOf(c) : ''
  const isWeb = c?.channel.startsWith('web:') && !c.oa_id
  const canReply = c?.status !== 'closed' && (!!c?.oa_id || (isWeb && !!c?.web_reply_available))

  const handleAction = async (action: 'reply' | 'close') => {
    if (pending || !c || c.status === 'closed') return
    const message = draft.trim()
    if (action === 'reply' && (!canReply || !message)) return
    setPending(action)
    setActionError('')
    setNotice('')
    try {
      if (action === 'reply') {
        if (isWeb && webReply.current?.content !== message) {
          webReply.current = { id: newReplyId(), content: message }
        }
        await api.replyToConversation(id, message, isWeb ? webReply.current?.id : undefined)
        webReply.current = null
        setDraft('')
        setNotice(isWeb ? 'Đã lưu phản hồi cho phiên web.' : 'Đã gửi qua Zalo.')
        // Sau khi tải lại trang mới nhất, giữ các tin vừa rơi ra khỏi trang đó.
        if (msgs.data) {
          const latest = msgs.data
          setHistory((prev) => ({
            messages: joinMessages(prev?.messages ?? [], latest.messages),
            beforeId: prev ? prev.beforeId : latest.next_before_id,
          }))
        }
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
    <section ref={box} className="card flex scroll-mt-16 flex-col overflow-hidden lg:sticky lg:top-4 lg:self-start" aria-label="Nội dung hội thoại">
      <header className="flex shrink-0 items-start gap-3 border-b border-line px-4 py-3">
        <button onClick={onClose} className="rounded-lg p-2 hover:bg-sunken lg:hidden" aria-label="Quay lại danh sách">
          <ArrowLeft className="h-4 w-4" aria-hidden />
        </button>
        <div className="min-w-0 flex-1">
          <h2 ref={heading} tabIndex={-1} className="line-clamp-2 text-[15px] font-semibold leading-snug [overflow-wrap:anywhere]"
            title={c ? c.title || who : undefined}>{c ? c.title || who : 'Nội dung hội thoại'}</h2>
          {c ? (
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted">
                <span className="max-w-[16rem]"><SourceBadge kind={s!.kind} label={nameOf(s!.key)} /></span>
                <StatusPill status={c.status} />
                {c.status === 'needs_human' && !!c.handoff_since && (
                  <span title={fmtTime(c.handoff_since)}>Cần hỗ trợ từ {fmtTime(c.handoff_since)}</span>
                )}
                <span>{c.message_count} tin · bắt đầu {fmtTime(c.started_at)}</span>
                <span className="truncate font-mono" title={who}>{nameOnly(c) || who}</span>
              </div>
          ) : conv.error ? (
            <ErrorBox message={conv.error} onRetry={conv.reload} />
          ) : (
            <div className="skeleton mt-2 h-4 w-48" />
          )}
        </div>
        <button className="btn-ghost h-9 shrink-0 px-2.5" disabled={!messages.length || exporting}
          title={exporting ? 'Đang xuất Excel' : 'Xuất toàn bộ hội thoại'} aria-label="Xuất Excel" onClick={exportTranscript}>
          <Download className="h-4 w-4" aria-hidden /> <span className="hidden 2xl:inline">Xuất Excel</span>
        </button>
        <button onClick={onClose} className="hidden rounded-lg p-2 hover:bg-sunken lg:block" aria-label="Đóng">
          <X className="h-4 w-4" aria-hidden />
        </button>
      </header>
      <div ref={scroll} className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain bg-sunken/40 px-4 py-5 [overflow-anchor:none] sm:px-5">
        {msgs.error && !messages.length ? (
          <ErrorBox message={msgs.error} onRetry={msgs.reload} />
        ) : !msgs.data && !messages.length ? (
          [0, 1, 2].map((i) => <div key={i} className={`skeleton h-14 w-2/3 ${i % 2 ? 'ml-auto' : ''}`} />)
        ) : !messages.length ? (
          <Empty title="Hội thoại chưa có tin nhắn" />
        ) : (
          <>
          {(beforeId || olderError) && (
            <div className="space-y-2 text-center">
              {olderError && <p role="alert" className="text-sm text-danger">{olderError}</p>}
              <button type="button" className="btn-ghost" onClick={loadOlder} disabled={loadingOlder || msgs.loading}>
                {loadingOlder ? 'Đang tải tin cũ…' : 'Tải thêm tin cũ'}
              </button>
            </div>
          )}
          {messages.map((m: Message) => {
            const mine = m.sender === 'user'
            return (
              <div key={m.id} className={`flex flex-col ${mine ? 'items-start' : 'items-end'}`}>
                <div className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed [overflow-wrap:anywhere] ${
                  mine ? 'rounded-bl-md border border-line bg-surface'
                    : m.sender === 'assistant' ? 'rounded-br-md border border-accent/25 bg-accent-soft'
                    : 'rounded-br-md border border-ok/30 bg-ok/10'
                }`}>
                  {m.content && (!m.has_image || m.content !== '[ảnh]') && <Md text={m.content} />}
                  {m.has_image ? <WebAttachment conversationId={id} messageId={m.id} />
                    : !m.content && <em className="text-muted">[không có nội dung văn bản]</em>}
                  {m.sender === 'assistant' && <MessageSources citations={m.metadata?.citations} />}
                </div>
                <span className="mt-1 px-1 text-[11px] text-muted">{SENDER[m.sender] || m.sender} · {fmtTime(m.created_at)}</span>
              </div>
            )
          })}
          {msgs.error && <ErrorBox message={msgs.error} onRetry={msgs.reload} />}
          </>
        )}
      </div>
      {c && (c.status !== 'closed' || notice || actionError) && (
        <footer className="shrink-0 space-y-2 border-t border-line p-3 sm:px-4">
          {actionError && <p role="alert" className="text-sm text-danger">{actionError}</p>}
          {notice && <p role="status" className="text-sm text-ok">{notice}</p>}
          {c.status !== 'closed' && (
            <form className="space-y-2" onSubmit={sendReply}>
              {canReply ? (
                <div>
                  <label htmlFor="officer-reply" className="label">{isWeb ? 'Trả lời trên widget web' : 'Trả lời qua Zalo'}</label>
                  <textarea id="officer-reply" rows={2} maxLength={4000}
                    className="field !h-auto !min-h-0 !max-h-32 resize-y py-2" value={draft}
                    onChange={(event) => setDraft(event.target.value)} disabled={!!pending}
                    placeholder="Nhập nội dung gửi cho người dân..." />
                </div>
              ) : (
                <p className="text-sm text-muted">{isWeb ? 'Phiên web chưa đăng ký nhận phản hồi. Người dân có thể mở lại widget và bấm Cần cán bộ hỗ trợ.' : 'Chưa có kênh trả lời cho hội thoại này.'}</p>
              )}
              <div className="flex flex-wrap justify-end gap-2">
                <button type="button" className="btn-ghost" onClick={() => void handleAction('close')}
                  disabled={!!pending || conv.loading || !!draft.trim()}>
                  {pending === 'close' ? 'Đang đóng...' : 'Đóng hội thoại'}
                </button>
                {canReply && (
                  <button type="submit" className="btn-primary" disabled={!!pending || conv.loading || !draft.trim()}>
                    {pending === 'reply' ? 'Đang gửi...' : isWeb ? 'Gửi lên widget' : 'Gửi qua Zalo'}
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
    if (!('id' in patch)) next.delete('id')
    if (!('page' in patch) && !('id' in patch)) next.delete('page')
    setSp(next, { replace: 'id' in patch })
  }

  const srcs = useAsync(api.sources, [])
  const listKey = JSON.stringify([source, queue, from, to, page])
  const list = useAsync(
    async () => ({ key: listKey, ...await api.conversations({ source, status: queue ? 'needs_human' : '', date_from: toTs(from), date_to: toTs(to, true), offset: page * LIMIT, limit: LIMIT }) }),
    [listKey],
  )
  const currentList = list.data?.key === listKey ? list.data : undefined
  const nameOf = (k: string) => srcs.data?.find((s) => s.source === k)?.name || k.replace(/^web:/, '')
  const total = currentList?.total || 0
  const pages = Math.max(1, Math.ceil(total / LIMIT))
  const listBox = useFitHeight()
  useEffect(() => {
    if (!list.loading && currentList && page >= pages) set({ page: pages - 1 })
  }, [list.loading, currentList, page, pages])

  const exportPage = () =>
    currentList && !list.loading && exportXlsx(
      currentList.conversations.map((c: Conversation) => ({
        'Mã': c.id, 'Tiêu đề': c.title, 'Người dân': whoOf(c), 'Nguồn': nameOf(sourceOf(c).key),
        'Số tin nhắn': c.message_count, 'Trạng thái': c.status, 'Bắt đầu': fmtTime(c.started_at), 'Gần nhất': fmtTime(c.last_message_at),
      })),
      'Danh sach', `hoi-thoai-trang-${page + 1}.xlsx`)

  return (
    <>
      <div className={openId > 0 ? 'hidden lg:block' : undefined}>
      <PageHeader
        title="Hội thoại"
        desc="Lịch sử hỏi đáp của người dân, lọc theo nguồn và thời gian."
        actions={
          <button className="btn-ghost" onClick={exportPage} disabled={list.loading || !currentList?.conversations.length}>
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
      </div>

      <div className={`grid gap-4 ${openId ? 'lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)] xl:grid-cols-[400px_minmax(0,1fr)]' : ''}`}>
        <section ref={listBox} className={`card flex-col overflow-hidden ${openId ? 'hidden lg:flex' : 'flex'}`} aria-label="Danh sách hội thoại">
          <div className="flex shrink-0 items-center justify-between border-b border-line px-4 py-3 text-sm text-muted" aria-live="polite">
            <span>{currentList ? <><span className="num font-medium text-ink">{total.toLocaleString('vi-VN')}</span> hội thoại</> : !list.error && 'Đang tải...'}</span>
            {total > 0 && <span className="num">{page * LIMIT + 1}–{Math.min(total, (page + 1) * LIMIT)}</span>}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {list.error ? (
            <ErrorBox message={list.error} onRetry={list.reload} />
          ) : !currentList ? (
            <div className="space-y-3 p-4">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-12" />)}</div>
          ) : !currentList.conversations.length ? (
            <Empty title={queue ? 'Không có hội thoại cần xử lý' : 'Không có hội thoại phù hợp'}
              hint={source || from || to ? 'Thử bỏ bớt bộ lọc hoặc chọn khoảng thời gian rộng hơn.' : undefined} />
          ) : (
            <ul className={`divide-y divide-line ${list.loading ? 'opacity-60' : ''}`}>
              {currentList.conversations.map((c) => {
                const s = sourceOf(c)
                const active = c.id === openId
                return (
                  <li key={c.id}>
                    <button onClick={() => set({ id: c.id })} disabled={list.loading} aria-current={active || undefined}
                      className={`w-full px-4 py-3 text-left transition-colors ${active ? 'bg-accent-soft' : 'hover:bg-sunken'}`}>
                      <div className="flex items-start justify-between gap-3">
                        <span className="line-clamp-2 text-sm font-medium leading-snug [overflow-wrap:anywhere]" title={c.title || undefined}>{c.title || whoOf(c)}</span>
                        <span className="mt-0.5 shrink-0 whitespace-nowrap text-xs text-muted"
                          title={fmtTime(queue ? c.handoff_since || c.last_message_at : c.last_message_at)}>
                          {queue && 'Chờ từ '}{fmtAgo(queue ? c.handoff_since || c.last_message_at : c.last_message_at)}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="min-w-0 max-w-[60%]"><SourceBadge kind={s.kind} label={nameOf(s.key)} /></span>
                        <StatusPill status={c.status} />
                        {c.title && nameOnly(c) && <span className="min-w-0 truncate text-xs text-muted">{nameOnly(c)}</span>}
                        <span className="num ml-auto shrink-0 whitespace-nowrap text-xs text-muted">{c.message_count} tin</span>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          </div>
          {pages > 1 && <Pager page={page} pages={pages} onGo={(p) => set({ page: p })} />}
        </section>

        {openId > 0 && <Transcript key={openId} id={openId} nameOf={nameOf} onClose={() => set({ id: 0 })} onUpdated={list.reload} />}
      </div>
    </>
  )
}
