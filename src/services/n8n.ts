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
}

export interface ChatSessionSummary {
  session_id: string
  length: number
}

export interface ChatSessionPage {
  data: ChatSessionSummary[]
  total?: number
  hasNextPage: boolean
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
  const rawList = extractList(payload)

  const map = new Map<string, number>()
  rawList.forEach((item: any) => {
    const session_id = String(item?.session_id ?? item?.sessionId ?? item?.session ?? '')
    const lengthRaw = item?.length ?? item?.count ?? item?.messages ?? item?.total
    const length = typeof lengthRaw === 'number' ? lengthRaw : Number(lengthRaw)
    if (!session_id) return
    const current = map.get(session_id) ?? 0
    map.set(session_id, Number.isFinite(length) ? Math.max(current, length) : current)
  })

  return {
    data: Array.from(map.entries()).map(([session_id, length]) => ({ session_id, length })),
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
      return { id: id ?? '', session_id, message }
    })
    .filter(Boolean) as ChatHistoryRow[]
}

export const chatHistoryService = {
  async getSessions(limit = 10, page = 1): Promise<ChatSessionSummary[]> {
    const result = await this.getSessionsPaged({ limit, n_page: page })
    return result.data
  },

  async getSessionsPaged(params: { limit: number; n_page: number }): Promise<ChatSessionPage> {
    const response = await axios.post(getHistorySessionUrl, params)
    const total = extractTotal(response.data)
    const { data, rawCount } = normalizeChatSessionSummaries(response.data)
    const hasNextPage = total ? params.n_page * params.limit < total : rawCount >= params.limit
    return { data, total, hasNextPage }
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

