import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import * as echarts from 'echarts'
import { FileText, MessageSquare, RefreshCw } from 'lucide-react'
import { chatHistoryService, portalMessageService, type ChatSessionSummary, type PortalMessageRow } from '../services/n8n'
import { postgresService, type RagDocumentFile } from '../services/postgres'
import toast from 'react-hot-toast'
import { CardSkeleton } from '../components/Skeleton'

const toStatus = (doc: RagDocumentFile): 'uploaded' | 'processed' | 'unknown' => {
  const value = String(doc.status ?? '').toLowerCase()
  if (value === 'uploaded') return 'uploaded'
  if (value === 'processed') return 'processed'
  return 'unknown'
}

type RequestTimeRange = '24h' | '7d' | '30d' | 'all'

type MessageRole = 'human' | 'ai' | 'system' | 'tool' | 'unknown'

const parseMessageTime = (row: PortalMessageRow): Date | null => {
  const raw =
    row.timestamp ??
    row.created_at ??
    row.createdat ??
    row.createdAt ??
    row.time ??
    row.raw?.created_at ??
    row.raw?.createdat ??
    row.raw?.createdAt ??
    row.raw?.timestamp ??
    row.raw?.time

  if (raw == null) return null

  if (typeof raw === 'number') {
    const ms = raw > 1_000_000_000_000 ? raw : raw * 1000
    const d = new Date(ms)
    return Number.isNaN(d.getTime()) ? null : d
  }

  const n = Number(raw)
  if (Number.isFinite(n)) {
    const ms = n > 1_000_000_000_000 ? n : n * 1000
    const d = new Date(ms)
    return Number.isNaN(d.getTime()) ? null : d
  }

  const d = new Date(String(raw))
  return Number.isNaN(d.getTime()) ? null : d
}

const parseAnyTime = (raw: unknown): Date | null => {
  if (raw == null) return null
  if (typeof raw === 'number') {
    const ms = raw > 1_000_000_000_000 ? raw : raw * 1000
    const d = new Date(ms)
    return Number.isNaN(d.getTime()) ? null : d
  }
  const n = Number(raw)
  if (Number.isFinite(n)) {
    const ms = n > 1_000_000_000_000 ? n : n * 1000
    const d = new Date(ms)
    return Number.isNaN(d.getTime()) ? null : d
  }
  const d = new Date(String(raw))
  return Number.isNaN(d.getTime()) ? null : d
}

const normalizeRole = (raw: unknown): MessageRole => {
  const v = String(raw ?? '').toLowerCase().trim()
  if (v === 'human' || v === 'user') return 'human'
  if (v === 'ai' || v === 'assistant' || v === 'bot') return 'ai'
  if (v === 'system') return 'system'
  if (v === 'tool') return 'tool'
  return 'unknown'
}

const pad2 = (value: number) => String(value).padStart(2, '0')

const toYmd = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`

const toYmdHour = (d: Date) => `${toYmd(d)} ${pad2(d.getHours())}:00`

export default function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([])
  const [sessionsTotal, setSessionsTotal] = useState<number | undefined>(undefined)
  const [sessionsHasNextPage, setSessionsHasNextPage] = useState(false)
  const [documents, setDocuments] = useState<RagDocumentFile[]>([])
  const [portalMessages, setPortalMessages] = useState<PortalMessageRow[]>([])
  const [requestRange, setRequestRange] = useState<RequestTimeRange>('7d')
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null)
  const requestChartElRef = useRef<HTMLDivElement | null>(null)
  const requestChartInstanceRef = useRef<echarts.ECharts | null>(null)
  const [portalQuery, setPortalQuery] = useState('')
  const [portalType, setPortalType] = useState<'all' | 'human' | 'ai' | 'unknown'>('all')
  const [portalLimit, setPortalLimit] = useState<number | 'all'>(50)
  const [tooltip, setTooltip] = useState<{ content: string, x: number, y: number } | null>(null)

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    try {
      setLoading(true)
      const [sessionPage, docs, allMessages] = await Promise.all([
        chatHistoryService.getSessionsPaged({ limit: 10, page: 1 }),
        postgresService.getDocuments(5000),
        portalMessageService.getAll(),
      ])
      setSessions(sessionPage.data)
      setSessionsTotal(sessionPage.total)
      setSessionsHasNextPage(sessionPage.hasNextPage)
      setDocuments(docs)
      setPortalMessages(allMessages)
      setLastUpdatedAt(new Date())
    } catch (error: any) {
      toast.error('Lỗi khi tải thống kê: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const documentSummary = useMemo(() => {
    const total = documents.length
    let uploaded = 0
    let processed = 0
    let unknown = 0

    documents.forEach((doc) => {
      const status = toStatus(doc)
      if (status === 'uploaded') uploaded += 1
      else if (status === 'processed') processed += 1
      else unknown += 1
    })

    return { total, uploaded, processed, unknown }
  }, [documents])

  const portalMessagesTotal = useMemo(() => portalMessages.length, [portalMessages])

  const sessionsTotalLabel = useMemo(() => {
    if (typeof sessionsTotal === 'number') return sessionsTotal.toLocaleString()
    if (sessionsHasNextPage) return `${sessions.length}+`
    return sessions.length.toLocaleString()
  }, [sessions.length, sessionsHasNextPage, sessionsTotal])

  const portalMessagesView = useMemo(() => {
    const q = portalQuery.trim().toLowerCase()
    const filtered = portalMessages
      .map((m) => ({ m, t: parseMessageTime(m) ?? parseAnyTime(m.raw?.createdat ?? m.raw?.created_at ?? m.raw?.timestamp ?? m.raw?.time) }))
      .filter((x) => x.m != null)
      .filter((x) => {
        if (!q) return true
        const message = String(x.m.message ?? x.m.raw?.message?.content ?? x.m.raw?.message ?? x.m.raw?.content ?? '')
        const sid = String(x.m.session_id ?? x.m.raw?.session_id ?? x.m.raw?.sessionId ?? '')
        return message.toLowerCase().includes(q) || sid.toLowerCase().includes(q)
      })
      .filter((x) => {
        if (portalType === 'all') return true
        const role = normalizeRole(x.m.type ?? x.m.raw?.message?.type ?? x.m.raw?.type ?? x.m.raw?.role)
        return portalType === role || (portalType === 'unknown' && role === 'unknown')
      })
      .sort((a, b) => {
        const at = a.t?.getTime() ?? 0
        const bt = b.t?.getTime() ?? 0
        return bt - at
      })

    return {
      total: filtered.length,
      data: portalLimit === 'all' ? filtered : filtered.slice(0, Math.max(1, portalLimit)),
    }
  }, [portalLimit, portalMessages, portalQuery, portalType])

  const requestChart = useMemo(() => {
    const now = new Date()
    const start =
      requestRange === '24h'
        ? new Date(now.getTime() - 24 * 60 * 60 * 1000)
        : requestRange === '7d'
          ? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          : requestRange === '30d'
            ? new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
            : null

    const filtered = portalMessages
      .map((m) => ({ m, t: parseMessageTime(m) }))
      .filter((x) => x.t != null)
      .filter((x) => {
        if (start && x.t) return x.t >= start && x.t <= now
        return true
      })
      .filter((x) => {
        const type = String(x.m.type ?? x.m.raw?.message?.type ?? x.m.raw?.type ?? x.m.raw?.role ?? '').toLowerCase()
        if (!type) return true
        return type === 'human' || type === 'user'
      }) as Array<{ m: PortalMessageRow; t: Date }>

    const rangeDays =
      filtered.length > 0
        ? Math.max(
            1,
            Math.ceil((now.getTime() - Math.min(...filtered.map((x) => x.t.getTime()))) / (24 * 60 * 60 * 1000))
          )
        : 0

    const bucketMode: 'hour' | 'day' | 'month' =
      requestRange === '24h' ? 'hour' : requestRange === 'all' && rangeDays > 120 ? 'month' : 'day'

    const counts = new Map<string, number>()
    filtered.forEach(({ t }) => {
      const key =
        bucketMode === 'hour'
          ? toYmdHour(t)
          : bucketMode === 'day'
            ? toYmd(t)
            : `${t.getFullYear()}-${pad2(t.getMonth() + 1)}`
      counts.set(key, (counts.get(key) ?? 0) + 1)
    })

    const labels = Array.from(counts.keys()).sort((a, b) => a.localeCompare(b))
    const data = labels.map((l) => counts.get(l) ?? 0)
    const total = data.reduce((sum, v) => sum + v, 0)

    return {
      labels,
      data,
      total,
      bucketMode,
    }
  }, [portalMessages, requestRange])

  const requestEChartsOption = useMemo<echarts.EChartsOption>(() => {
    const labels = requestChart.labels
    const values = requestChart.data
    const hasData = labels.length > 0
    const showZoom = labels.length > 32

    const axisLabelFormatter =
      requestChart.bucketMode === 'hour'
        ? (value: string) => String(value).slice(11, 16)
        : requestChart.bucketMode === 'day'
          ? (value: string) => String(value).slice(5)
          : (value: string) => String(value)

    return {
      animation: true,
      grid: {
        left: 16,
        right: 16,
        top: 18,
        bottom: showZoom ? 40 : 24,
        containLabel: true,
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'line',
          lineStyle: { color: '#93c5fd', width: 2 },
        },
        backgroundColor: 'rgba(17, 24, 39, 0.92)',
        borderWidth: 0,
        textStyle: { color: '#fff' },
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: labels,
        axisLine: { lineStyle: { color: '#e5e7eb' } },
        axisTick: { show: false },
        axisLabel: {
          color: '#6b7280',
          formatter: axisLabelFormatter as any,
          hideOverlap: true,
        },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        minInterval: 1,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: '#6b7280' },
        splitLine: { lineStyle: { color: '#e5e7eb', type: 'dashed' } },
      },
      dataZoom: showZoom
        ? [
            { type: 'inside', zoomOnMouseWheel: true, moveOnMouseMove: true, moveOnMouseWheel: true },
            {
              type: 'slider',
              height: 18,
              bottom: 8,
              backgroundColor: '#f3f4f6',
              borderColor: '#e5e7eb',
              fillerColor: 'rgba(59, 130, 246, 0.18)',
              handleStyle: { color: '#3b82f6' },
              textStyle: { color: '#6b7280' },
            },
          ]
        : [{ type: 'inside', zoomOnMouseWheel: true, moveOnMouseMove: true, moveOnMouseWheel: true }],
      series: [
        {
          name: 'Requests',
          type: 'line',
          smooth: true,
          data: values,
          symbol: 'circle',
          showSymbol: labels.length <= 40,
          symbolSize: 8,
          lineStyle: { width: 3, color: '#3b82f6' },
          itemStyle: { color: '#3b82f6' },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(59, 130, 246, 0.35)' },
              { offset: 1, color: 'rgba(59, 130, 246, 0.02)' },
            ]),
          },
          emphasis: { focus: 'series' },
        },
      ],
      graphic: hasData
        ? undefined
        : {
            type: 'text',
            left: 'center',
            top: 'middle',
            style: {
              text: 'Không có dữ liệu trong khung thời gian đã chọn',
              fill: '#6b7280',
              fontSize: 14,
            },
          },
    }
  }, [requestChart.bucketMode, requestChart.data, requestChart.labels])

  useEffect(() => {
    if (loading) return
    const el = requestChartElRef.current
    if (!el) return
    if (requestChartInstanceRef.current) return

    const chart = echarts.init(el, undefined, { renderer: 'canvas' })
    requestChartInstanceRef.current = chart

    const ro = new ResizeObserver(() => {
      chart.resize()
    })
    ro.observe(el)

    return () => {
      ro.disconnect()
      chart.dispose()
      requestChartInstanceRef.current = null
    }
  }, [loading])

  useEffect(() => {
    if (loading) return
    const chart = requestChartInstanceRef.current
    if (!chart) return
    chart.setOption(requestEChartsOption, { notMerge: true })
  }, [loading, requestEChartsOption])

  return (
    <div className="space-y-8 animate-fade-in">
        {/* Page Header & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
                <h2 className="text-2xl font-bold text-police-900 uppercase tracking-wide">Tổng Quan Hệ Thống</h2>
                <p className="text-sm text-police-500 mt-1">Theo dõi hoạt động Chatbot, tài liệu và tương tác người dùng</p>
            </div>
            <div className="flex items-center gap-3">
                {lastUpdatedAt && (
                    <div className="hidden md:block text-xs text-police-500 font-medium bg-white px-3 py-1.5 rounded-full border border-gray-200 shadow-sm">
                        Cập nhật: {lastUpdatedAt.toLocaleTimeString()}
                    </div>
                )}
                <button
                    onClick={loadStats}
                    disabled={loading}
                    className="group relative inline-flex items-center px-4 py-2 border border-gray-200 rounded-lg shadow-sm text-sm font-semibold text-police-700 bg-white hover:bg-police-50 hover:text-police-900 disabled:opacity-75 disabled:cursor-not-allowed transition-all active:scale-95"
                >
                    <RefreshCw className={`w-4 h-4 mr-2 text-cahy-red ${loading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
                    Làm mới
                </button>
            </div>
        </div>
        
        {/* Stats Grid */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)
          ) : (
            <>
              {/* PDF Stats Card */}
              <div className="group relative bg-white rounded-xl shadow-soft hover:shadow-card-hover border-l-4 border-l-cahy-blue transition-all duration-300 overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                   <FileText className="w-24 h-24 text-cahy-blue transform rotate-12" />
                </div>
                <div className="p-6 relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                      <FileText className="w-6 h-6 text-cahy-blue" />
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-cahy-blue border border-blue-100">
                      Hệ thống
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-police-500 uppercase tracking-wide">Tài liệu PDF</p>
                  <div className="mt-2 flex items-baseline gap-2">
                    <p className="text-3xl font-bold text-police-900">{documentSummary.total.toLocaleString()}</p>
                    <span className="text-sm text-police-400">files</span>
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-4 text-xs font-medium text-police-500">
                     <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500" /> Uploaded: {documentSummary.uploaded}</span>
                     <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500" /> Processed: {documentSummary.processed}</span>
                  </div>
                </div>
              </div>

              {/* Pending PDF Card */}
              <div className="group relative bg-white rounded-xl shadow-soft hover:shadow-card-hover border-l-4 border-l-police-500 transition-all duration-300 overflow-hidden">
                 <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                   <FileText className="w-24 h-24 text-police-500 transform -rotate-6" />
                </div>
                <div className="p-6 relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                      <FileText className="w-6 h-6 text-police-600" />
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-police-600 border border-gray-200">
                      Queue
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-police-500 uppercase tracking-wide">PDF Chờ Xử Lý</p>
                  <div className="mt-2 flex items-baseline gap-2">
                    <p className="text-3xl font-bold text-police-900">{documentSummary.uploaded.toLocaleString()}</p>
                    <span className="text-sm text-police-400">files</span>
                  </div>
                   <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-4 text-xs font-medium text-police-500">
                     <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" /> Trạng thái 'uploaded'</span>
                  </div>
                </div>
              </div>

              {/* Conversation Stats Card */}
              <div className="group relative bg-white rounded-xl shadow-soft hover:shadow-card-hover border-l-4 border-l-cahy-red transition-all duration-300 overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                   <MessageSquare className="w-24 h-24 text-cahy-red transform -rotate-12" />
                </div>
                <div className="p-6 relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                      <MessageSquare className="w-6 h-6 text-cahy-red" />
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-cahy-red border border-red-100">
                      Live
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-police-500 uppercase tracking-wide">Cuộc trò chuyện</p>
                  <div className="mt-2 flex items-baseline gap-2">
                    <p className="text-3xl font-bold text-police-900">{sessionsTotalLabel}</p>
                    <span className="text-sm text-police-400">phiên</span>
                  </div>
                </div>
              </div>

              {/* Message Stats Card */}
              <div className="group relative bg-white rounded-xl shadow-soft hover:shadow-card-hover border-l-4 border-l-cahy-gold transition-all duration-300 overflow-hidden">
                 <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                   <MessageSquare className="w-24 h-24 text-cahy-gold transform rotate-6" />
                </div>
                <div className="p-6 relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-yellow-50 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                      <MessageSquare className="w-6 h-6 text-cahy-gold" />
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-50 text-yellow-700 border border-yellow-100">
                      Tương tác
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-police-500 uppercase tracking-wide">Tổng tin nhắn</p>
                  <div className="mt-2 flex items-baseline gap-2">
                    <p className="text-3xl font-bold text-police-900">{portalMessagesTotal.toLocaleString()}</p>
                    <span className="text-sm text-police-400">tin nhắn</span>
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-4 text-xs font-medium text-police-500">
                     <span className="truncate">Nguồn: Portal Messages</span>
                  </div>
                </div>
              </div>


            </>
          )}
        </div>

        {!loading && (
          <>
            {/* Chart Section */}
            <div className="bg-white rounded-xl shadow-soft border border-gray-100 overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h2 className="text-lg font-bold text-police-900 flex items-center gap-2">
                            <span className="w-1 h-6 bg-cahy-blue rounded-full"></span>
                            Lượng Request Đến Cổng
                        </h2>
                        <p className="text-xs text-police-500 mt-1 ml-3 font-medium">
                            Tổng: <span className="text-police-900 font-bold">{requestChart.total.toLocaleString()}</span> • Mode: {requestChart.bucketMode.toUpperCase()}
                        </p>
                    </div>
                    <div className="relative">
                        <select
                        value={requestRange}
                        onChange={(e) => setRequestRange(e.target.value as RequestTimeRange)}
                        className="appearance-none pl-4 pr-10 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-police-700 focus:outline-none focus:ring-2 focus:ring-cahy-blue/20 focus:border-cahy-blue transition-all cursor-pointer hover:border-gray-300 shadow-sm"
                        >
                        <option value="24h">24 Giờ Qua</option>
                        <option value="7d">7 Ngày Qua</option>
                        <option value="30d">30 Ngày Qua</option>
                        <option value="all">Tất Cả</option>
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-gray-500">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                        </div>
                    </div>
                </div>
                <div className="p-6">
                    <div className="h-80 w-full">
                         <div ref={requestChartElRef} className="w-full h-full" />
                    </div>
                </div>
            </div>

            {/* Portal Messages Table */}
            <div className="bg-white rounded-xl shadow-soft border border-gray-100 overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div>
                        <h2 className="text-lg font-bold text-police-900 flex items-center gap-2">
                            <span className="w-1 h-6 bg-cahy-gold rounded-full"></span>
                            Portal Messages Monitor
                        </h2>
                        <p className="text-xs text-police-500 mt-1 ml-3 font-medium">
                            Live Feed: <span className="text-police-900 font-bold">{portalMessagesView.data.length.toLocaleString()}</span> / {portalMessagesView.total.toLocaleString()} records
                        </p>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="relative">
                            <input
                                value={portalQuery}
                                onChange={(e) => setPortalQuery(e.target.value)}
                                placeholder="Tìm kiếm nội dung..."
                                className="pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cahy-blue/20 focus:border-cahy-blue w-full sm:w-64 transition-all shadow-sm"
                            />
                            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                            <select
                                value={portalType}
                                onChange={(e) => setPortalType(e.target.value as any)}
                                className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-police-700 focus:outline-none focus:ring-2 focus:ring-cahy-blue/20 focus:border-cahy-blue shadow-sm"
                            >
                                <option value="all">Tất cả Loại</option>
                                <option value="human">Người dùng</option>
                                <option value="ai">AI Bot</option>
                            </select>
                            
                            <select
                                value={String(portalLimit)}
                                onChange={(e) => {
                                    const val = e.target.value
                                    setPortalLimit(val === 'all' ? 'all' : Number(val))
                                }}
                                className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-police-700 focus:outline-none focus:ring-2 focus:ring-cahy-blue/20 focus:border-cahy-blue shadow-sm"
                            >
                                <option value="10">10 dòng</option>
                                <option value="50">50 dòng</option>
                                <option value="all">Toàn bộ tin nhắn</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
                        <table className="min-w-full divide-y divide-gray-100">
                            <thead className="bg-gray-50 sticky top-0 z-20 shadow-sm">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-police-500 uppercase tracking-wider bg-gray-50">Thời gian</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-police-500 uppercase tracking-wider bg-gray-50">Loại</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-police-500 uppercase tracking-wider bg-gray-50">Session ID</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-police-500 uppercase tracking-wider bg-gray-50">Nội dung tin nhắn</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-100">
                                {portalMessagesView.data.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-12 text-center text-sm text-gray-400">
                                            <div className="flex flex-col items-center justify-center">
                                                <FileText className="w-8 h-8 mb-2 opacity-20" />
                                                Không tìm thấy dữ liệu phù hợp
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    portalMessagesView.data.map(({ m, t }, idx) => {
                                        const role = normalizeRole(m.type ?? m.raw?.message?.type ?? m.raw?.type ?? m.raw?.role)
                                        const msg = String(m.message ?? m.raw?.message?.content ?? m.raw?.message ?? m.raw?.content ?? '')
                                        const sid = String(m.session_id ?? m.raw?.session_id ?? m.raw?.sessionId ?? '')
                                        const timeLabel = t ? t.toLocaleString() : 'N/A'
                                        
                                        // Row styling based on role
                                        const isHuman = role === 'human'
                                        const rowClass = idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
                                        
                                        return (
                                            <tr key={String(m.id ?? idx)} className={`${rowClass} hover:bg-blue-50/30 transition-colors group`}>
                                                <td className="px-6 py-3 whitespace-nowrap text-xs text-gray-500 font-mono">
                                                    {timeLabel}
                                                </td>
                                                <td className="px-6 py-3 whitespace-nowrap">
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${
                                                        isHuman 
                                                        ? 'bg-blue-50 text-blue-700 border-blue-200' 
                                                        : role === 'ai'
                                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                            : 'bg-gray-100 text-gray-600 border-gray-200'
                                                    }`}>
                                                        {role === 'human' && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5" />}
                                                        {role === 'ai' && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" />}
                                                        {role}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-3 whitespace-nowrap text-xs text-police-600 font-mono group-hover:text-cahy-blue transition-colors">
                                                    {sid ? sid.slice(0, 8) + '...' + sid.slice(-4) : '—'}
                                                </td>
                                                <td className="px-6 py-3 text-sm text-police-800">
                                                    <div 
                                                        className="line-clamp-2 cursor-help"
                                                        onMouseEnter={(e) => {
                                                            if (!msg) return
                                                            const rect = e.currentTarget.getBoundingClientRect()
                                                            setTooltip({ content: msg, x: rect.left, y: rect.bottom + 5 })
                                                        }}
                                                        onMouseLeave={() => setTooltip(null)}
                                                    >
                                                        {msg || <span className="italic text-gray-400">Empty content</span>}
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
          </>
        )}
        {tooltip && createPortal(
            <div 
                className="fixed z-[9999] max-w-lg p-4 bg-white rounded-lg shadow-xl border border-gray-200 text-sm text-police-800 animate-fade-in pointer-events-none"
                style={{ top: tooltip.y, left: tooltip.x }}
            >
                {tooltip.content}
            </div>,
            document.body
        )}
    </div>
  )
}
