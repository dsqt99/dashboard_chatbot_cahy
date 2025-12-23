import axios from 'axios'

const n8nApiUrl = import.meta.env.VITE_N8N_API_URL || 'http://localhost:5678'
const n8nApiKey = import.meta.env.VITE_N8N_API_KEY || ''

const api = axios.create({
  baseURL: n8nApiUrl,
  headers: {
    'X-N8N-API-KEY': n8nApiKey,
  },
})

export interface Workflow {
  id: string
  name: string
  active: boolean
  nodes: any[]
  connections: any
}

export interface Execution {
  id: string
  workflowId: string
  finished: boolean
  mode: string
  retryOf?: string
  retrySuccessId?: string
  startedAt: string
  stoppedAt?: string
  workflowData: {
    name: string
  }
}

export const n8nService = {
  async getWorkflows(): Promise<Workflow[]> {
    const response = await api.get('/api/v1/workflows')
    return response.data.data || []
  },

  async getWorkflowById(id: string): Promise<Workflow> {
    const response = await api.get(`/api/v1/workflows/${id}`)
    return response.data
  },

  async activateWorkflow(id: string) {
    await api.post(`/api/v1/workflows/${id}/activate`)
  },

  async deactivateWorkflow(id: string) {
    await api.post(`/api/v1/workflows/${id}/deactivate`)
  },

  async executeWorkflow(id: string, data?: any) {
    const response = await api.post(`/api/v1/workflows/${id}/execute`, data)
    return response.data
  },

  async getExecutions(limit = 50): Promise<Execution[]> {
    const response = await api.get('/api/v1/executions', {
      params: { limit },
    })
    return response.data.data || []
  },

  async getExecutionById(id: string): Promise<Execution> {
    const response = await api.get(`/api/v1/executions/${id}`)
    return response.data
  },

  async getExecutionStats() {
    const executions = await this.getExecutions(100)
    const stats = {
      total: executions.length,
      success: executions.filter((e) => e.finished && !e.retryOf).length,
      failed: executions.filter((e) => !e.finished && !e.retryOf).length,
      byWorkflow: {} as Record<string, number>,
    }

    executions.forEach((exec) => {
      const workflowName = exec.workflowData?.name || 'Unknown'
      stats.byWorkflow[workflowName] = (stats.byWorkflow[workflowName] || 0) + 1
    })

    return stats
  },
}

const getHistorySessionUrl =
  import.meta.env.VITE_CHAT_HISTORY_ALL_URL ||
  'https://n8n-hungyen.cahy.io.vn/webhook/get_history_session'

const getHistoryFromSessionIdUrl =
  import.meta.env.VITE_CHAT_HISTORY_BY_SESSION_URL ||
  'https://n8n-hungyen.cahy.io.vn/webhook/get_history_from_sessionId'

export interface ChatHistoryRow {
  id: number | string
  session_id: string
  message: string
  created_at?: string
  createdat?: string
  createdAt?: string
}

export interface ChatSessionSummary {
  session_id: string
  length: number
  created_at?: string
  updated_at?: string
}

export interface ChatSessionPage {
  data: ChatSessionSummary[]
  total?: number
  total_page?: number
  hasNextPage: boolean
}

const unwrapChatSessionPayload = (payload: any): any => {
  if (Array.isArray(payload) && payload.length === 1) {
    const first = payload[0]
    if (first && (Array.isArray(first?.data) || Array.isArray(first?.result))) return first
  }
  return payload
}

const extractTotalPageFromChatSessionPayload = (payload: any): number | undefined => {
  const root = unwrapChatSessionPayload(payload)
  const candidates = [root?.total_page, root?.totalPage, root?.pagination?.total_page, root?.pageInfo?.total_page]
  for (const value of candidates) {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    const n = Number(value)
    if (Number.isFinite(n) && n > 0) return n
  }
  return undefined
}

const toEpochMsFromSessionTime = (value: unknown): number => {
  if (typeof value !== 'string') return 0
  const s = value.trim()
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/)
  if (m) {
    const [, yy, mm, dd, hh, mi, ss] = m
    return Date.UTC(Number(yy), Number(mm) - 1, Number(dd), Number(hh), Number(mi), Number(ss))
  }
  const n = Date.parse(s)
  return Number.isFinite(n) ? n : 0
}

const extractList = (payload: any): any[] => {
  return Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload?.result)
        ? payload.result
        : []
}

const extractTotal = (payload: any): number | undefined => {
  const candidates = [
    payload?.total,
    payload?.meta?.total,
    payload?.pagination?.total,
    payload?.pageInfo?.total,
  ]
  for (const value of candidates) {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    const n = Number(value)
    if (Number.isFinite(n) && n > 0) return n
  }
  return undefined
}

const normalizeChatSessionSummaries = (payload: any): { data: ChatSessionSummary[]; rawCount: number } => {
  const root = unwrapChatSessionPayload(payload)
  const rawList = extractList(root)

  const map = new Map<string, ChatSessionSummary>()
  rawList.forEach((item: any) => {
    const session_id = String(item?.session_id ?? item?.sessionId ?? item?.session ?? '')
    const lengthRaw = item?.length ?? item?.count ?? item?.messages ?? item?.total
    const length = typeof lengthRaw === 'number' ? lengthRaw : Number(lengthRaw)
    if (!session_id) return

    const created_at = typeof item?.created_at === 'string' ? item.created_at : undefined
    const updated_at = typeof item?.updated_at === 'string' ? item.updated_at : undefined

    const current = map.get(session_id)
    const next: ChatSessionSummary = {
      session_id,
      length: Number.isFinite(length) ? Math.max(current?.length ?? 0, length) : current?.length ?? 0,
      created_at: created_at ?? current?.created_at,
      updated_at: updated_at ?? current?.updated_at,
    }

    map.set(session_id, next)
  })

  const data = Array.from(map.values()).sort((a, b) => {
    const bt = toEpochMsFromSessionTime(b.updated_at ?? b.created_at)
    const at = toEpochMsFromSessionTime(a.updated_at ?? a.created_at)
    if (bt !== at) return bt - at
    return a.session_id.localeCompare(b.session_id)
  })

  return {
    data,
    rawCount: rawList.length,
  }
}

const normalizeChatHistoryRows = (payload: any): ChatHistoryRow[] => {
  const rawList = extractList(payload)

  return rawList
    .map((item: any) => {
      const id = item?.id ?? item?.ID ?? item?.row_id ?? item?.rowId
      const session_id = String(item?.session_id ?? item?.sessionId ?? item?.session ?? '')
      const message = typeof item?.message === 'string' ? item.message : item?.message ? JSON.stringify(item.message) : ''
      if (!session_id || !message) return null
      return {
        id: id ?? '',
        session_id,
        message,
        created_at: typeof item?.created_at === 'string' ? item.created_at : undefined,
        createdat: typeof item?.createdat === 'string' ? item.createdat : undefined,
        createdAt: typeof item?.createdAt === 'string' ? item.createdAt : undefined,
      }
    })
    .filter(Boolean) as ChatHistoryRow[]
}

export const chatHistoryService = {
  async getSessions(limit = 10, page = 1): Promise<ChatSessionSummary[]> {
    const result = await this.getSessionsPaged({ limit, page: page })
    return result.data
  },

  async getSessionsPaged(params: { limit: number; page: number }): Promise<ChatSessionPage> {
    const response = await axios.post(getHistorySessionUrl, params)
    const root = unwrapChatSessionPayload(response.data)
    const total = extractTotal(root)
    const total_page = extractTotalPageFromChatSessionPayload(root)
    const { data, rawCount } = normalizeChatSessionSummaries(root)
    const hasNextPage = typeof total_page === 'number' ? params.page < total_page : total ? params.page * params.limit < total : rawCount >= params.limit
    return { data, total, total_page, hasNextPage }
  },

  async getBySessionId(sessionId: string): Promise<ChatHistoryRow[]> {
    const response = await axios.post(getHistoryFromSessionIdUrl, { session_id: sessionId })
    return normalizeChatHistoryRows(response.data)
  },
}

const getAllMessagesUrl =
  import.meta.env.VITE_PORTAL_MESSAGES_URL || 'https://n8n-hungyen.cahy.io.vn/webhook/get_all_messages'

export interface PortalMessageRow {
  id?: number | string
  session_id?: string
  type?: string
  message?: string
  created_at?: string
  createdat?: string
  createdAt?: string
  timestamp?: number | string
  time?: string
  raw: any
}

const normalizePortalMessages = (payload: any): PortalMessageRow[] => {
  const rawList = extractList(payload)
  return rawList
    .map((item: any) => {
      const id = item?.id ?? item?.ID ?? item?.row_id ?? item?.rowId
      const session_id = typeof item?.session_id === 'string' ? item.session_id : typeof item?.sessionId === 'string' ? item.sessionId : undefined

      const messageObj = item?.message && typeof item.message === 'object' ? item.message : undefined
      const type =
        typeof messageObj?.type === 'string'
          ? messageObj.type
          : typeof item?.type === 'string'
            ? item.type
            : typeof item?.role === 'string'
              ? item.role
              : undefined

      const message =
        typeof messageObj?.content === 'string'
          ? messageObj.content
          : typeof item?.message === 'string'
            ? item.message
            : typeof item?.content === 'string'
              ? item.content
              : item?.message
                ? JSON.stringify(item.message)
                : item?.content
                  ? JSON.stringify(item.content)
                  : undefined

      return {
        id,
        session_id,
        type,
        message,
        created_at: typeof item?.created_at === 'string' ? item.created_at : undefined,
        createdat: typeof item?.createdat === 'string' ? item.createdat : undefined,
        createdAt: typeof item?.createdAt === 'string' ? item.createdAt : undefined,
        timestamp: item?.timestamp ?? item?.ts ?? item?.timeUnix,
        time: typeof item?.time === 'string' ? item.time : typeof item?.datetime === 'string' ? item.datetime : undefined,
        raw: item,
      }
    })
    .filter(Boolean) as PortalMessageRow[]
}

export const portalMessageService = {
  async getAll(): Promise<PortalMessageRow[]> {
    const response = await axios.post(getAllMessagesUrl, {})
    return normalizePortalMessages(response.data)
  },
}

const qnaVectorstoreProcessingUrl =
  import.meta.env.VITE_QNA_VECTORSTORE_PROCESSING_URL ||
  'https://n8n-hungyen.cahy.io.vn/webhook/qnavectorstore_processing'

const updateQnaRowUrl =
  import.meta.env.VITE_QNA_VECTORSTORE_UPDATE_URL ||
  'https://n8n-hungyen.cahy.io.vn/webhook/update_qna_row'

const removeQnaRowUrl =
  import.meta.env.VITE_QNA_VECTORSTORE_REMOVE_URL ||
  'https://n8n-hungyen.cahy.io.vn/webhook/remove_qna_row'

const getQnaVectorstoreUrl =
  import.meta.env.VITE_QNA_VECTORSTORE_LIST_URL ||
  'https://n8n-hungyen.cahy.io.vn/webhook/get_qna_vectorstore'

const searchQnaUrl =
  import.meta.env.VITE_QNA_VECTORSTORE_SEARCH_URL || 'https://n8n-hungyen.cahy.io.vn/webhook/search_qna'

export interface QnAGuideRow {
  id?: string
  created_at?: string
  question: string
  answer: string
  type: string
  note?: string
  raw?: any
}

export interface QnAGuidePage {
  data: QnAGuideRow[]
  total?: number
  total_page?: number
  hasNextPage: boolean
}

const unwrapQnaVectorstorePayload = (payload: any): any => {
  if (Array.isArray(payload) && payload.length === 1) {
    const first = payload[0]
    if (first && (Array.isArray(first?.data) || Array.isArray(first?.result))) return first
  }
  return payload
}

const normalizeQnAGuideRows = (payload: any): QnAGuideRow[] => {
  const root = unwrapQnaVectorstorePayload(payload)
  const rawList = extractList(root)
  return rawList
    .map((item: any) => {
      const idRaw = item?.id ?? item?.ID ?? item?.uuid ?? item?.row_id ?? item?.rowId
      const createdAtRaw =
        item?.created_at ?? item?.createdAt ?? item?.createdat ?? item?.created ?? item?.time

      const question =
        typeof item?.question === 'string'
          ? item.question
          : typeof item?.['Câu hỏi'] === 'string'
            ? item['Câu hỏi']
            : ''
      const answer =
        typeof item?.answer === 'string'
          ? item.answer
          : typeof item?.['Câu trả lời'] === 'string'
            ? item['Câu trả lời']
            : ''
      const type =
        typeof item?.type === 'string'
          ? item.type
          : typeof item?.['Loại câu hỏi'] === 'string'
            ? item['Loại câu hỏi']
            : ''
      const note =
        typeof item?.note === 'string'
          ? item.note
          : typeof item?.['Lưu ý'] === 'string'
            ? item['Lưu ý']
            : undefined

      if (!question || !answer || !type) return null

      return {
        id: idRaw != null ? String(idRaw) : undefined,
        created_at: typeof createdAtRaw === 'string' ? createdAtRaw : createdAtRaw != null ? String(createdAtRaw) : undefined,
        question,
        answer,
        type,
        note,
        raw: item,
      } satisfies QnAGuideRow
    })
    .filter(Boolean) as QnAGuideRow[]
}

const extractTotalPage = (payload: any): number | undefined => {
  const root = unwrapQnaVectorstorePayload(payload)
  const candidates = [root?.total_page, root?.totalPage, root?.pagination?.total_page, root?.pageInfo?.total_page]
  for (const value of candidates) {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    const n = Number(value)
    if (Number.isFinite(n) && n > 0) return n
  }
  return undefined
}

export const qnaVectorstoreService = {
  async listPaged(params: { limit: number; page: number; type?: string }): Promise<QnAGuidePage> {
    const payload = {
      limit: params.limit,
      page: params.page,
      ...(params.type ? { type: params.type } : {}),
    }
    const response = await axios.post(getQnaVectorstoreUrl, payload)
    const root = unwrapQnaVectorstorePayload(response.data)
    const total = extractTotal(root)
    const total_page = extractTotalPage(root)
    const data = normalizeQnAGuideRows(root)
    const hasNextPage = typeof total_page === 'number' ? params.page < total_page : total ? params.page * params.limit < total : data.length >= params.limit
    return { data, total, total_page, hasNextPage }
  },

  async searchPaged(params: { limit: number; page: number; query: string }): Promise<QnAGuidePage> {
    const payload = {
      limit: params.limit,
      page: params.page,
      query: params.query,
    }
    const response = await axios.post(searchQnaUrl, payload)
    const root = unwrapQnaVectorstorePayload(response.data)
    const total = extractTotal(root)
    const total_page = extractTotalPage(root)
    const data = normalizeQnAGuideRows(root)
    const hasNextPage = typeof total_page === 'number' ? params.page < total_page : total ? params.page * params.limit < total : data.length >= params.limit
    return { data, total, total_page, hasNextPage }
  },

  async listAll(): Promise<QnAGuideRow[]> {
    const response = await axios.post(getQnaVectorstoreUrl, { limit: -1, page: 1 })
    const root = unwrapQnaVectorstorePayload(response.data)
    return normalizeQnAGuideRows(root)
  },

  async list(): Promise<QnAGuideRow[]> {
    const page = await this.listPaged({ limit: 1000, page: 1 })
    return page.data
  },

  async upsert(row: Omit<QnAGuideRow, 'raw'>) {
    await axios.post(qnaVectorstoreProcessingUrl, { rows: [row] })
  },

  async upsertMany(rows: Array<Omit<QnAGuideRow, 'raw'>>) {
    await axios.post(qnaVectorstoreProcessingUrl, { rows })
  },

  async updateRows(rows: Array<Omit<QnAGuideRow, 'raw'>>) {
    await axios.post(updateQnaRowUrl, { rows })
  },

  async removeRows(rows: Array<Omit<QnAGuideRow, 'raw'>>) {
    await axios.post(removeQnaRowUrl, { rows })
  },

  async deleteById(id: string) {
    const all = await this.listAll()
    const match = all.find((r) => r.id === id)
    if (match) {
      await this.removeRows([
        {
          id: match.id,
          question: match.question,
          answer: match.answer,
          type: match.type,
          note: match.note,
          created_at: match.created_at,
        },
      ])
      return
    }
    await this.removeRows([{ id, question: '', answer: '', type: '' }])
  },

  async deleteByType(type: string) {
    const all = await this.listAll()
    const rows = all
      .filter((r) => String(r.type) === type)
      .map((r) => ({
        id: r.id,
        question: r.question,
        answer: r.answer,
        type: r.type,
        note: r.note,
        created_at: r.created_at,
      }))
    await axios.post(removeQnaRowUrl, { rows })
  },
}
