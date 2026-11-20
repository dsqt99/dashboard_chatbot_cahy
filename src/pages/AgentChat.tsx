import { Bot, ExternalLink, RotateCcw, Send, User as UserIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import Markdown from '../components/Markdown'
import Modal from '../components/Modal'
import { api, type Agent, type Citation } from '../lib/api'

interface TestMsg {
  role: 'user' | 'assistant'
  content: string
  needsHuman?: boolean
  citations?: Citation[]
}

const newSessionId = () => `test-${Math.random().toString(36).slice(2, 10)}`

/** Khung chạy thử hội thoại với một Agent, mở ngay trong trang Agent. */
export default function AgentChat({ agent, onClose }: { agent: Agent; onClose: () => void }) {
  const [sessionId, setSessionId] = useState(newSessionId)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<TestMsg[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const activeRequest = useRef<AbortController | null>(null)
  const bottom = useRef<HTMLDivElement>(null)

  useEffect(() => () => activeRequest.current?.abort(), [])
  useEffect(() => { bottom.current?.scrollIntoView({ block: 'end' }) }, [messages, busy])

  const resetChat = () => {
    activeRequest.current?.abort()
    activeRequest.current = null
    setMessages([])
    setSessionId(newSessionId())
    setInput('')
    setErr('')
    setBusy(false)
  }

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || activeRequest.current) return
    const controller = new AbortController()
    activeRequest.current = controller
    setInput('')
    setErr('')
    setMessages((prev) => [...prev, { role: 'user', content: text }])
    setBusy(true)
    try {
      const res = await api.testAgent(agent.agent_id, { message: text, session_id: sessionId }, controller.signal)
      if (activeRequest.current !== controller) return
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: res.reply, needsHuman: res.needs_human, citations: res.citations },
      ])
    } catch (ex) {
      if (activeRequest.current === controller) setErr(ex instanceof Error ? ex.message : 'Gửi tin nhắn thử thất bại')
    } finally {
      if (activeRequest.current === controller) {
        activeRequest.current = null
        setBusy(false)
      }
    }
  }

  return (
    <Modal open onClose={onClose} title={`Chạy thử: ${agent.name}`} maxWidth="max-w-2xl">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span>Hội thoại thử không gửi tới người dân. Phiên <span className="font-mono">{sessionId}</span></span>
        <button type="button" className="btn-ghost h-8 px-2.5 text-xs" onClick={resetChat}>
          <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Phiên mới
        </button>
      </div>
      <section className="flex h-[60dvh] min-h-[320px] flex-col rounded-lg border border-line" aria-label="Khung chat thử nghiệm">
        <div className="flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite">
          {!messages.length ? (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted">
              Nhập câu hỏi bên dưới để kiểm tra câu trả lời và nguồn trích dẫn của Agent.
            </div>
          ) : (
            messages.map((m, idx) => (
              <div key={idx} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.role === 'assistant' && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                    <Bot className="h-4 w-4" aria-hidden />
                  </div>
                )}
                <div className={`max-w-[80%] rounded-xl px-4 py-3 text-sm ${
                  m.role === 'user' ? 'bg-accent text-white dark:text-bg' : 'border border-line bg-sunken/60 text-ink'
                }`}>
                  {m.role === 'assistant'
                    ? <Markdown text={m.content} />
                    : <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{m.content}</p>}
                  {m.needsHuman && (
                    <span className="mt-2 inline-block rounded bg-warn/15 px-2 py-0.5 text-xs font-medium text-warn">
                      Guardrail: Cần chuyển cán bộ
                    </span>
                  )}
                  {m.citations && m.citations.length > 0 && (
                    <div className="mt-2 space-y-1 border-t border-line/60 pt-2 text-xs text-muted">
                      <p className="font-medium text-ink">Trích dẫn ({m.citations.length}):</p>
                      {m.citations.map((c, ci) => (
                        <div key={ci} className="truncate">
                          {c.url ? (
                            <a href={c.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">
                              {c.title || c.source || c.url} <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            <span>{c.title || c.source || 'Tài liệu'}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {m.role === 'user' && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sunken text-muted">
                    <UserIcon className="h-4 w-4" aria-hidden />
                  </div>
                )}
              </div>
            ))
          )}
          {busy && <div className="text-xs text-muted">Agent đang trả lời…</div>}
          <div ref={bottom} />
        </div>

        {err && <p role="alert" className="border-t border-line bg-danger/10 px-4 py-2 text-xs text-danger">{err}</p>}

        <form onSubmit={send} className="flex gap-2 border-t border-line p-3">
          <label htmlFor="t-input" className="sr-only">Tin nhắn thử</label>
          <input id="t-input" className="field flex-1" placeholder="Nhập câu hỏi thử…" autoFocus
            value={input} onChange={(e) => setInput(e.target.value)} disabled={busy} />
          <button type="submit" className="btn-primary px-4" disabled={busy || !input.trim()}>
            <Send className="h-4 w-4" aria-hidden /> Gửi
          </button>
        </form>
      </section>
    </Modal>
  )
}
