import { Bot, ExternalLink, RotateCcw, Send, User as UserIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Empty, ErrorBox, PageHeader } from '../components/ui'
import { useAsync } from '../hooks/useAsync'
import { api, type Citation } from '../lib/api'

interface TestMsg {
  role: 'user' | 'assistant'
  content: string
  needsHuman?: boolean
  citations?: Citation[]
}

const newSessionId = () => `test-${Math.random().toString(36).slice(2, 10)}`

export default function AgentTest() {
  const agents = useAsync(api.listAgents, [])
  const [agentId, setAgentId] = useState('')
  const [sessionId, setSessionId] = useState(newSessionId)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<TestMsg[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const activeRequest = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!agentId && agents.data?.length) {
      setAgentId(agents.data[0].agent_id)
    }
  }, [agentId, agents.data])

  useEffect(() => () => {
    activeRequest.current?.abort()
    activeRequest.current = null
  }, [])

  const resetChat = (nextSessionId = newSessionId()) => {
    activeRequest.current?.abort()
    activeRequest.current = null
    setMessages([])
    setSessionId(nextSessionId)
    setInput('')
    setErr('')
    setBusy(false)
  }

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    const text = input.trim()
    const session = sessionId.trim()
    if (!text || !agentId || !session || activeRequest.current) return
    const controller = new AbortController()
    activeRequest.current = controller
    setInput('')
    setErr('')
    setMessages((prev) => [...prev, { role: 'user', content: text }])
    setBusy(true)
    try {
      const res = await api.testAgent(agentId, { message: text, session_id: session }, controller.signal)
      if (activeRequest.current !== controller) return
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: res.reply, needsHuman: res.needs_human, citations: res.citations },
      ])
    } catch (ex) {
      if (activeRequest.current === controller) {
        setErr(ex instanceof Error ? ex.message : 'Gửi tin nhắn thử thất bại')
      }
    } finally {
      if (activeRequest.current === controller) {
        activeRequest.current = null
        setBusy(false)
      }
    }
  }

  return (
    <>
      <PageHeader
        title="Test Agent"
        desc="Chạy thử hội thoại trực tiếp với Agent trước khi gắn vào Zalo OA."
        actions={
          <button type="button" className="btn-ghost" onClick={() => resetChat()}>
            <RotateCcw className="h-4 w-4" aria-hidden /> Phiên mới
          </button>
        }
      />

      {agents.error ? (
        <div className="card"><ErrorBox message={agents.error} onRetry={agents.reload} /></div>
      ) : !agents.data ? (
        <div className="skeleton h-64" />
      ) : !agents.data.length ? (
        <div className="card"><Empty title="Chưa có Agent nào" hint="Hãy tạo ít nhất một Agent ở mục Quản lý Agent trước." /></div>
      ) : (
        <div className="grid gap-4">
          <div className="card grid gap-3 p-4 sm:grid-cols-2">
            <div>
              <label htmlFor="t-agent" className="label">Chọn Agent</label>
              <select id="t-agent" className="field" value={agentId} onChange={(e) => { setAgentId(e.target.value); resetChat() }}>
                {agents.data.map((a) => (
                  <option key={a.agent_id} value={a.agent_id}>
                    {a.name} ({a.agent_id})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="t-sess" className="label">Session ID</label>
              <input id="t-sess" className="field font-mono text-xs" value={sessionId} onChange={(e) => resetChat(e.target.value)} />
            </div>
          </div>

          <section className="card flex h-[60dvh] min-h-[380px] flex-col" aria-label="Khung chat thử nghiệm">
            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              {!messages.length ? (
                <div className="flex h-full items-center justify-center text-sm text-muted">
                  Nhập câu hỏi bên dưới để kiểm tra phản hồi và nguồn trích dẫn của Agent.
                </div>
              ) : (
                messages.map((m, idx) => (
                  <div key={idx} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {m.role === 'assistant' && (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                        <Bot className="h-4 w-4" aria-hidden />
                      </div>
                    )}
                    <div
                      className={`max-w-[80%] rounded-xl px-4 py-3 text-sm ${
                        m.role === 'user' ? 'bg-accent text-white dark:text-bg' : 'border border-line bg-sunken/60 text-ink'
                      }`}
                    >
                      <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{m.content}</p>
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
              {busy && <div className="text-xs text-muted">Agent đang trả lời...</div>}
            </div>

            {err && <p className="border-t border-line bg-danger/10 px-4 py-2 text-xs text-danger">{err}</p>}

            <form onSubmit={send} className="flex gap-2 border-t border-line p-3">
              <input
                className="field flex-1"
                placeholder="Nhập tin nhắn kiểm tra..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={busy}
              />
              <button type="submit" className="btn-primary px-4" disabled={busy || !agentId || !sessionId.trim() || !input.trim()}>
                <Send className="h-4 w-4" aria-hidden /> Gửi
              </button>
            </form>
          </section>
        </div>
      )}
    </>
  )
}
