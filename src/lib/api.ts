// Client cho admin API của service Zalo OA (/admin/*) — đọc thẳng PostgreSQL hiện tại.
// Dev: Vite proxy /admin -> localhost:8081. Prod: nginx proxy cùng origin.

const TOKEN_KEY = 'cahy_dashboard_token'

export const auth = {
  get: () => sessionStorage.getItem(TOKEN_KEY) || '',
  set: (t: string) => sessionStorage.setItem(TOKEN_KEY, t),
  clear: () => sessionStorage.removeItem(TOKEN_KEY),
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  const token = auth.get()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (init.body) headers.set('Content-Type', 'application/json')
  const res = await fetch(`/admin${path}`, { ...init, headers })
  if (res.status === 401 && token) {
    auth.clear()
    window.dispatchEvent(new Event('auth:expired'))
  }
  if (!res.ok) {
    let msg = `Lỗi ${res.status}`
    try {
      const data = await res.json()
      if (typeof data.detail === 'string') msg = data.detail
    } catch {
      /* body không phải JSON */
    }
    throw new ApiError(res.status, msg)
  }
  return res.json()
}

const qs = (params: Record<string, string | number | undefined>) => {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '' && v !== 0) p.set(k, String(v))
  const s = p.toString()
  return s ? `?${s}` : ''
}

export interface User {
  id: number
  username: string
  full_name: string
  role: 'admin' | 'staff'
  department_name: string
}

export interface Source {
  source: string // web:<host> | zalo:<oa_id>
  kind: 'web' | 'zalo'
  name: string
  oa_id: string
  enabled: boolean
  department_name: string
  conversations: number
  messages: number
  last_message_at: number
}

export interface Conversation {
  id: number
  thread_id: string
  channel: string
  user_id: string
  oa_id: string
  message_count: number
  status: string
  started_at: number
  last_message_at: number
  user: { display_name: string; avatar: string; phone: string } | null
}

export interface Message {
  id: number
  sender: 'user' | 'assistant' | 'officer' | 'staff' | 'system'
  content: string
  created_at: number
}

export interface Overview {
  oas: { total: number; active: number; connected: number; messages: number }
  agents: { total: number }
  conversations: { total: number; messages: number; last_message_at: number }
}

export interface DailyPoint {
  day: string
  kind: 'web' | 'zalo'
  count: number
}

export interface Doc {
  source_id: string
  title: string
  knowledge_type: string
}

export const api = {
  login: (username: string, password: string, totp_code = '') =>
    request<{ token: string; totp_required: boolean; user?: User }>('/login', {
      method: 'POST',
      body: JSON.stringify({ username, password, totp_code }),
    }),
  me: () => request<User>('/me'),
  overview: () => request<Overview>('/overview'),
  sources: () => request<{ sources: Source[] }>('/sources').then((r) => r.sources),
  daily: (days: number, source = '') =>
    request<{ series: DailyPoint[] }>(`/stats/daily${qs({ days, source })}`).then((r) => r.series),
  conversations: (p: { source?: string; date_from?: number; date_to?: number; offset?: number; limit?: number }) =>
    request<{ conversations: Conversation[]; total: number }>(`/conversations${qs(p)}`),
  conversation: (id: number) => request<Conversation>(`/conversations/${id}`),
  messages: (id: number) =>
    request<{ messages: Message[] }>(`/conversations/${id}/messages?limit=500`).then((r) => r.messages),
  scopes: () => request<{ scopes: { name: string; description?: string }[] }>('/scopes').then((r) => r.scopes),
  documents: (scope = '') =>
    request<{ documents: Doc[] }>(`/documents${qs({ scope })}`).then((r) => r.documents),
}
