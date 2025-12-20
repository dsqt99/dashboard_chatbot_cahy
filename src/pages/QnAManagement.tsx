import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, MessageSquare, RefreshCw, Search } from 'lucide-react'
import { chatHistoryService, type ChatHistoryRow, type ChatSessionSummary } from '../services/n8n'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'

type ParsedChatMessage = {
  type?: string
  content?: string
}

const parseChatMessage = (raw: string): ParsedChatMessage => {
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
      return {
        type: typeof parsed.type === 'string' ? parsed.type : undefined,
        content: typeof parsed.content === 'string' ? parsed.content : undefined,
      }
    }
    return {}
  } catch {
    return {}
  }
}

const toNumberOrZero = (value: unknown) => {
  if (typeof value === 'number') return value
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

export default function QnAManagement() {
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(true)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [sessionQuery, setSessionQuery] = useState('')
  const [selectedSessionId, setSelectedSessionId] = useState<string>('')
  const [sessionRows, setSessionRows] = useState<ChatHistoryRow[]>([])
  const [pageSize, setPageSize] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)
  const [hasNextPage, setHasNextPage] = useState(false)
  const [totalSessions, setTotalSessions] = useState<number | undefined>(undefined)
  const chatEndRef = useRef<HTMLDivElement | null>(null)

  const totalPages = useMemo(() => {
    if (!totalSessions) return undefined
    return Math.max(1, Math.ceil(totalSessions / pageSize))
  }, [pageSize, totalSessions])

  const sessionIndexBase = useMemo(() => (currentPage - 1) * pageSize, [currentPage, pageSize])

  const loadSessions = async () => {
    try {
      setSessionsLoading(true)
      const result = await chatHistoryService.getSessionsPaged({ limit: pageSize, n_page: currentPage })
      setSessions(result.data)
      setHasNextPage(result.hasNextPage)
      setTotalSessions(result.total)
    } catch (error: any) {
      toast.error('Lỗi khi tải danh sách cuộc trò chuyện: ' + error.message)
    } finally {
      setSessionsLoading(false)
    }
  }

  const loadSession = async (sessionId: string) => {
    if (!sessionId.trim()) return
    try {
      setMessagesLoading(true)
      const data = await chatHistoryService.getBySessionId(sessionId.trim())
      setSelectedSessionId(sessionId.trim())
      setSessionQuery(sessionId.trim())
      setSessionRows(data.sort((a, b) => toNumberOrZero(a.id) - toNumberOrZero(b.id)))
    } catch (error: any) {
      toast.error('Lỗi khi tải session: ' + error.message)
    } finally {
      setMessagesLoading(false)
    }
  }

  useEffect(() => {
    loadSessions()
  }, [currentPage, pageSize])

  useEffect(() => {
    if (!selectedSessionId) return
    if (sessionRows.length === 0) return
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [selectedSessionId, sessionRows.length])

  const toCreatedAtLabel = (row: ChatHistoryRow) => {
    const raw = row.created_at ?? row.createdat ?? row.createdAt
    if (!raw) return ''
    const d = new Date(raw)
    return Number.isNaN(d.getTime()) ? String(raw) : d.toLocaleString()
  }

  const downloadXlsx = (rows: Array<[string, string, string, string]>, filename: string) => {
    const aoa = [
      ['session_id', 'sender', 'message', 'created_at'],
      ...rows.map(([sessionId, sender, message, createdAt]) => [sessionId, sender, message, createdAt]),
    ]

    const ws = XLSX.utils.aoa_to_sheet(aoa)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'messages')

    const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    const blob = new Blob([out], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = filename
    link.click()
  }

  const exportRowsToExcel = (exportRows: ChatHistoryRow[], filename: string) => {
    const tableRows: Array<[string, string, string, string]> = exportRows.map((r) => {
      const parsed = parseChatMessage(r.message)
      const sender = parsed.type ?? ''
      const message = parsed.content ?? r.message
      const createdAt = toCreatedAtLabel(r)
      return [r.session_id ?? '', sender, message, createdAt]
    })

    downloadXlsx(tableRows, filename)
  }

  const handleExportExcel = async () => {
      const toastId = toast.loading('Đang xuất Excel...')
    try {
      if (selectedSessionId) {
        exportRowsToExcel(sessionRows, `chat_history_${selectedSessionId}.xlsx`)
        toast.success('Đã xuất Excel', { id: toastId })
        return
      }

      const allRows: ChatHistoryRow[] = []
      for (const s of sessions) {
        const rows = await chatHistoryService.getBySessionId(s.session_id)
        allRows.push(...rows)
      }

      exportRowsToExcel(allRows, `chat_history_page_${currentPage}.xlsx`)
      toast.success('Đã xuất Excel', { id: toastId })
    } catch (error: any) {
      toast.error('Lỗi khi xuất Excel: ' + (error?.message ?? 'Unknown error'), { id: toastId })
    }
  }

  const isBusy = sessionsLoading || messagesLoading

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Quản lý lịch sử trò chuyện</h1>
          <p className="mt-1 text-sm text-gray-500">
            Xem lịch sử theo cuộc trò chuyện và nội dung hội thoại (bot ai/người dân)
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={async () => {
              await loadSessions()
              if (selectedSessionId) await loadSession(selectedSessionId)
            }}
            disabled={isBusy}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isBusy ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleExportExcel}
            disabled={isBusy || (selectedSessionId ? sessionRows.length === 0 : sessions.length === 0)}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Download className="w-4 h-4 mr-2" />
            Export Excel
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Nhập session_id để xem lịch sử..."
              value={sessionQuery}
              onChange={(e) => setSessionQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadSession(sessionQuery)}
              className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 sm:text-sm transition-all"
            />
          </div>
          <button
            onClick={() => loadSession(sessionQuery)}
            disabled={isBusy || !sessionQuery.trim()}
            className="inline-flex items-center justify-center px-4 py-3 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            Xem session
          </button>
          {selectedSessionId && (
            <button
              onClick={() => {
                setSelectedSessionId('')
                setSessionRows([])
                setSessionQuery('')
              }}
              disabled={isBusy}
              className="inline-flex items-center justify-center px-4 py-3 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Xóa lọc
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[clamp(420px,60vh,720px)] lg:h-[clamp(520px,70vh,820px)]">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-gray-900">Danh sách cuộc trò chuyện</h2>
              <div className="flex items-center gap-2">
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value))
                    setCurrentPage(1)
                  }}
                  disabled={isBusy}
                  className="block w-24 border border-gray-300 rounded-lg px-2 py-1 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>
          </div>
          {sessionsLoading && sessions.length === 0 ? (
            <div className="flex-1 min-h-0 p-12 text-center">
              <RefreshCw className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-4" />
              <p className="text-gray-500">Đang tải dữ liệu...</p>
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex-1 min-h-0 p-12 text-center">
              <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 font-medium">Không có session nào</p>
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      STT
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Session ID
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Tổng tin nhắn
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sessions.map((s, index) => (
                    <tr
                      key={s.session_id}
                      className={`hover:bg-gray-50 transition-colors cursor-pointer ${
                        selectedSessionId === s.session_id ? 'bg-primary-50' : ''
                      }`}
                      onClick={() => loadSession(s.session_id)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {String(sessionIndexBase + index + 1)}
                      </td>
                      <td className="px-6 py-4 text-sm font-mono text-gray-700">
                        {s.session_id.substring(0, 8)}...
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-gray-700">
                        {Number(s.length ?? 0).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between gap-4">
            <div className="text-sm text-gray-600">
              Trang {String(currentPage)}
              {typeof totalPages === 'number' ? ` / ${String(totalPages)}` : ''}
              {typeof totalSessions === 'number' ? ` • Tổng: ${totalSessions.toLocaleString()}` : ''}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={isBusy || currentPage <= 1}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Trước
              </button>
              <button
                onClick={() => setCurrentPage((p) => p + 1)}
                disabled={isBusy || !hasNextPage}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Sau
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[clamp(420px,60vh,720px)] lg:h-[clamp(520px,70vh,820px)]">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Nội dung hội thoại</h2>
            {selectedSessionId && (
              <span className="text-sm font-mono text-gray-500">
                {selectedSessionId}
              </span>
            )}
          </div>

          {selectedSessionId ? (
            sessionRows.length === 0 && !messagesLoading ? (
              <div className="flex-1 min-h-0 p-12 text-center">
                <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 font-medium">Session không có dữ liệu</p>
              </div>
            ) : messagesLoading ? (
              <div className="flex-1 min-h-0 p-12 text-center">
                <RefreshCw className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-4" />
                <p className="text-gray-500">Đang tải hội thoại...</p>
              </div>
            ) : (
              <div className="flex-1 min-h-0 overflow-y-auto bg-gray-50 p-4 space-y-3">
                  {sessionRows.map((r) => {
                    const parsed = parseChatMessage(r.message)
                    const type = parsed.type || 'unknown'
                    const content = (parsed.content || r.message || '').trim()
                    const isHuman = type === 'human'

                    return (
                      <div
                        key={`${r.session_id}-${String(r.id)}`}
                        className={`flex items-end gap-2 ${isHuman ? 'justify-end' : 'justify-start'}`}
                      >
                        {!isHuman && (
                          <div className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center text-xs font-semibold">
                            Bot
                          </div>
                        )}
                        <div
                          className={`max-w-[80%] px-4 py-2 rounded-2xl shadow-sm ${
                            isHuman
                              ? 'bg-primary-600 text-white rounded-br-md'
                              : 'bg-white text-gray-900 border border-gray-200 rounded-bl-md'
                          }`}
                        >
                          <div className="whitespace-pre-wrap break-words text-sm">{content}</div>
                        </div>
                        {isHuman && (
                          <div className="w-8 h-8 rounded-full bg-primary-600 text-white flex items-center justify-center text-xs font-semibold">
                            ND
                          </div>
                        )}
                      </div>
                    )
                  })}
                  <div ref={chatEndRef} />
              </div>
            )
          ) : (
            <div className="flex-1 min-h-0 p-12 text-center">
              <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 font-medium">Chọn một session để xem nội dung</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
