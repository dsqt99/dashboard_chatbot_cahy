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

async function adminFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers)
  const token = auth.get()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json')
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
  return res
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  return (await adminFetch(path, init)).json()
}

const qs = (params: Record<string, string | number | undefined>) => {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '' && v !== 0) p.set(k, String(v))
  const s = p.toString()
  return s ? `?${s}` : ''
}

export type Role = 'admin' | 'staff'
export type UserStatus = 'pending' | 'active' | 'rejected' | 'suspended'

export interface User {
  id: number
  username: string
  full_name: string
  avatar?: string
  role: Role
  status?: UserStatus
  department_id?: string
  department_name: string
  approved_by?: string
  approved_at?: number
  last_login_at?: number
  created_at?: number
}

export interface OA {
  oa_id: string
  name: string
  agent_enabled: boolean
  webhook_verified: boolean
  has_token: boolean
  token_expires_at?: number | null
  created_at?: number | null
  message_count?: number
  agent_id?: string | null
  department_id?: string | null
  department_name?: string | null
  reply_mode?: 'all' | 'whitelist'
  allowed_user_ids?: string[]
}

export interface OAStats extends OA {
  oauth_callback_url: string
  webhook_url: string
}

export interface OACredentialStatus {
  oa_id: string
  zalo_app_id: string
  has_app_secret: boolean
  has_oa_secret_key: boolean
  has_token: boolean
}

export interface Agent {
  agent_id: string
  name: string
  system_prompt?: string
  department_id?: string | null
  department_name?: string | null
  knowledge_type?: string | null
  document_ids?: string[] | null
  created_at?: number | null
}

export interface Department {
  id: string
  name: string
  description?: string
  employee_count?: number
}

export interface Citation {
  title?: string
  source?: string
  url?: string
  snippet?: string
  document_number?: string
  sections?: string[]
  pages?: string
  url_verified?: boolean
}

export interface AgentTestResponse {
  reply: string
  needs_human?: boolean
  citations?: Citation[]
}

export interface QueueStatus {
  pending: number
  processing: number
  failed: number
  worker_active: boolean
  last_success_at: number
  last_error_at: number
}

export interface FailedWebhook {
  id: string
  oa_id: string
  event_name: string
  user_id: string
  attempt: number
  queued_at: number
}

export interface DependencyStatus {
  ok: boolean
  detail: string
}

export interface SystemStatusResponse {
  service: DependencyStatus
  database: DependencyStatus
  redis: DependencyStatus
  chat: DependencyStatus
  worker: DependencyStatus
}

export interface OABody {
  name?: string
  agent_id?: string
  department_id?: string
  department_name?: string
  reply_mode?: 'all' | 'whitelist'
  allowed_user_ids?: string[]
}

export interface AgentBody {
  name?: string
  system_prompt?: string
  department_id?: string
  department_name?: string
  knowledge_type?: string
  document_ids?: string[]
}

export interface UserBody {
  full_name?: string
  avatar?: string
  role?: Role
  status?: UserStatus
  department_id?: string
  department_name?: string
  password?: string
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

export interface PortalWidget {
  title?: string
  brand?: string
  tagline?: string
  tooltip?: string
  welcome?: string
  placeholder?: string
  position?: 'left' | 'right'
  suggestions?: string[]
  bot_avatar?: string // data:image/...;base64 — nút mở + tin nhắn bot
  title_avatar?: string // data:image/...;base64 — đầu khung chat
}

export interface Portal {
  portal_id: string // = data-key của widget
  name: string
  domains: string[]
  enabled: boolean
  agent_id?: string | null
  department_id?: string | null
  department_name?: string | null
  widget: PortalWidget
  created_at?: number | null
}

export type PortalBody = Partial<Omit<Portal, 'portal_id' | 'created_at'>>

export interface Conversation {
  id: number
  thread_id: string
  title: string
  channel: string
  user_id: string
  oa_id: string
  message_count: number
  status: string
  handoff_since?: number
  web_reply_available?: boolean
  started_at: number
  last_message_at: number
  user: { display_name: string; avatar: string; phone: string } | null
}

export interface Message {
  id: number
  sender: 'user' | 'assistant' | 'officer' | 'staff' | 'system'
  content: string
  created_at: number
  has_image?: boolean
  metadata?: { citations?: Citation[] }
}

export interface Overview {
  oas: { total: number; active: number; connected: number; webhook_verified: number; messages: number }
  agents: { total: number }
  conversations: { total: number; messages: number; last_message_at: number }
  queues: QueueStatus
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
  updateProfile: (body: { full_name?: string; avatar?: string }) =>
    request<{ ok: boolean; user?: User | null }>('/me', { method: 'PUT', body: JSON.stringify(body) }),
  uploadAvatar: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return request<{ ok: boolean; avatar_url: string; user?: User | null }>('/me/avatar', {
      method: 'POST',
      body: form,
    })
  },
  changePassword: (body: { current_password: string; new_password: string }) =>
    request<{ ok: boolean }>('/me/change-password', { method: 'POST', body: JSON.stringify(body) }),
  overview: () => request<Overview>('/overview'),
  sources: () => request<{ sources: Source[] }>('/sources').then((r) => r.sources),
  daily: (days: number, source = '') =>
    request<{ series: DailyPoint[] }>(`/stats/daily${qs({ days, source })}`).then((r) => r.series),
  conversations: (p: { source?: string; status?: string; date_from?: number; date_to?: number; offset?: number; limit?: number }) =>
    request<{ conversations: Conversation[]; total: number }>(`/conversations${qs(p)}`),
  conversation: (id: number) => request<Conversation>(`/conversations/${id}`),
  recentMessages: (id: number, beforeId?: number, limit = 50) =>
    request<{ messages: Message[]; next_before_id: number | null }>(
      `/conversations/${id}/messages${qs({ latest: 'true', limit, before_id: beforeId })}`,
    ),
  messageAttachment: (id: number, messageId: number, signal: AbortSignal) =>
    adminFetch(`/conversations/${id}/messages/${messageId}/attachment`, { signal }).then((res) => res.blob()),
  replyToConversation: (id: number, message: string, requestId?: string) =>
    request<{ ok: boolean; message_id?: string | number }>(`/conversations/${id}/reply`, {
      method: 'POST', body: JSON.stringify({ message, request_id: requestId }),
    }),
  closeConversation: (id: number) =>
    request<{ ok: boolean; status: string }>(`/conversations/${id}/status`, {
      method: 'POST', body: JSON.stringify({ status: 'closed' }),
    }),
  scopes: () => request<{ scopes: { slug?: string; name: string; description?: string; doc_count?: number }[] }>('/scopes').then((r) => r.scopes),
  documents: (scope = '') =>
    request<{ documents: Doc[] }>(`/documents${qs({ scope })}`).then((r) => r.documents),
  departments: () => request<{ departments: Department[] }>('/departments').then((r) => r.departments),

  // Zalo OA
  listOAs: () => request<{ oas: OA[] }>('/oa').then((r) => r.oas),
  createOA: (body: {
    oa_id: string
    name: string
    agent_id?: string
    department_id?: string
    department_name?: string
    reply_mode?: 'all' | 'whitelist'
    allowed_user_ids?: string[]
  }) => request<{ ok: boolean; oa_id?: string }>('/oa', { method: 'POST', body: JSON.stringify(body) }),
  updateOA: (oaId: string, body: OABody) =>
    request<{ ok: boolean }>(`/oa/${encodeURIComponent(oaId)}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteOA: (oaId: string) =>
    request<{ ok: boolean }>(`/oa/${encodeURIComponent(oaId)}`, { method: 'DELETE' }),
  toggleOA: (oaId: string, agent_enabled: boolean) =>
    request<{ ok?: boolean; agent_enabled?: boolean }>(`/oa/${encodeURIComponent(oaId)}/toggle`, {
      method: 'POST',
      body: JSON.stringify({ agent_enabled }),
    }),
  oaStats: (oaId: string) => request<OAStats>(`/oa/${encodeURIComponent(oaId)}/stats`),
  getOACredentials: (oaId: string) => request<OACredentialStatus>(`/oa/${encodeURIComponent(oaId)}/credentials`),
  updateOACredentials: (oaId: string, zalo_app_id: string, app_secret = '', oa_secret_key = '') =>
    request<OACredentialStatus>(`/oa/${encodeURIComponent(oaId)}/credentials`, {
      method: 'PUT',
      body: JSON.stringify({ zalo_app_id, app_secret, oa_secret_key }),
    }),
  deleteOACredentials: (oaId: string) =>
    request<{ ok: boolean }>(`/oa/${encodeURIComponent(oaId)}/credentials`, { method: 'DELETE' }),
  oauthUrl: (oaId: string) => request<{ oauth_url: string }>(`/oa/${encodeURIComponent(oaId)}/oauth-url`),
  disconnectOA: (oaId: string) =>
    request<{ ok: boolean }>(`/oa/${encodeURIComponent(oaId)}/disconnect`, { method: 'POST' }),

  // Cổng web (widget chatbot nhúng)
  listPortals: () => request<{ portals: Portal[]; script_url: string }>('/portals'),
  createPortal: (body: PortalBody) =>
    request<{ ok: boolean; portal_id: string }>('/portals', { method: 'POST', body: JSON.stringify(body) }),
  updatePortal: (id: string, body: PortalBody) =>
    request<{ ok: boolean }>(`/portals/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(body) }),
  deletePortal: (id: string) =>
    request<{ ok: boolean }>(`/portals/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  // Agents
  listAgents: () => request<{ agents: Agent[] }>('/agent').then((r) => r.agents),
  getAgent: (agentId: string) => request<Agent>(`/agent/${encodeURIComponent(agentId)}`),
  createAgent: (body: AgentBody) =>
    request<{ ok: boolean; agent_id?: string }>('/agent', { method: 'POST', body: JSON.stringify(body) }),
  updateAgent: (agentId: string, body: AgentBody) =>
    request<{ ok: boolean }>(`/agent/${encodeURIComponent(agentId)}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteAgent: (agentId: string) =>
    request<{ ok: boolean }>(`/agent/${encodeURIComponent(agentId)}`, { method: 'DELETE' }),
  testAgent: (agentId: string, body: { message: string; session_id: string }, signal?: AbortSignal) =>
    request<AgentTestResponse>(`/agent/${encodeURIComponent(agentId)}/test`, {
      method: 'POST',
      signal,
      body: JSON.stringify(body),
    }),

  // Vận hành & Webhook
  systemStatus: () => request<SystemStatusResponse>('/system/status'),
  webhookStatus: () => request<QueueStatus>('/webhooks/status'),
  listFailedWebhooks: (offset = 0, limit = 50) =>
    request<{ events: FailedWebhook[]; total: number }>(`/webhooks/failed?offset=${offset}&limit=${limit}`),
  retryFailedWebhook: (eventId: string) =>
    request<{ ok: boolean }>(`/webhooks/failed/${encodeURIComponent(eventId)}/retry`, { method: 'POST' }),
  deleteFailedWebhook: (eventId: string) =>
    request<{ ok: boolean }>(`/webhooks/failed/${encodeURIComponent(eventId)}`, { method: 'DELETE' }),

  // Quản lý tài khoản (Admin)
  listUsers: (status = '') =>
    request<{ users: User[]; pending_count: number }>(`/users${status ? `?status=${encodeURIComponent(status)}` : ''}`),
  createUser: (body: {
    username: string
    password: string
    full_name?: string
    role?: Role
    department_id?: string
    department_name?: string
  }) => request<{ ok: boolean; user?: User | null }>('/users', { method: 'POST', body: JSON.stringify(body) }),
  updateUser: (userId: number, body: UserBody) =>
    request<{ ok: boolean; user?: User | null }>(`/users/${userId}`, { method: 'PUT', body: JSON.stringify(body) }),
  approveUser: (userId: number) =>
    request<{ ok: boolean; user?: User | null }>(`/users/${userId}/approve`, { method: 'POST' }),
  rejectUser: (userId: number) =>
    request<{ ok: boolean; user?: User | null }>(`/users/${userId}/reject`, { method: 'POST' }),
  deleteUser: (userId: number) => request<{ ok: boolean }>(`/users/${userId}`, { method: 'DELETE' }),
}
