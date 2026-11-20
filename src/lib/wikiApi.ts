export interface WikiSession {
  token: string
  name: string
}

export interface WikiDocMeta {
  doc_type?: string | null
  doc_number?: string | null
  issuing_authority?: string | null
  official_title?: string | null
  issued_date?: string | null
  effective_date?: string | null
  expiry_date?: string | null
}

export interface WikiDocument {
  id: string
  title: string | null
  file_name?: string | null
  source_type?: string
  url?: string | null
  file_size?: number | null
  page_count?: number | null
  wiki_page_count?: number | null
  extracted_token_count?: number | null
  status: string
  progress?: number | null
  progress_message?: string | null
  error_message?: string | null
  knowledge_type_id?: string | null
  knowledge_type_name?: string | null
  knowledge_type_color?: string | null
  department_names?: string[]
  managing_department_name?: string | null
  contributed_by_name?: string | null
  scope_type?: string | null
  security_label?: string | null
  doc_meta?: WikiDocMeta | null
  created_at?: string | null
  updated_at?: string | null
}

interface WikiDocumentDetail extends WikiDocument {
  full_text?: string | null
}

export interface WikiProcessingSummary {
  failed: number
  running: number
  review: number
}

export interface WikiDepartment {
  id: string
  name: string
  code?: string | null
  description?: string | null
  employee_count: number
  is_active?: boolean
}

export interface WikiKnowledgeType {
  id: string
  slug: string
  name: string
  color?: string | null
  description?: string | null
  source_count: number
}

export interface WikiAccount {
  id: string
  name: string
  email: string
  username?: string
  role: string
  identity_roles?: { id: string; name: string }[]
  department_names?: string[]
  last_connected?: string | null
  is_active: boolean
}

export interface WikiArticle {
  id: string
  slug: string
  title: string
  page_type?: string
  status?: string
  summary?: string | null
  version?: number
  updated_at?: string | null
}

interface WikiArticleDetail extends WikiArticle {
  content_md?: string | null
}

export interface WikiPage<T> {
  items: T[]
  total: number
  total_pages: number
}

export interface DocumentFilters {
  page: number
  search: string
  knowledgeType: string
  department: string
  status: string
  sort: string
}

class WikiUnauthorized extends Error {}

async function wikiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const response = await fetch(`/wiki-api/${path}`, {
    ...init,
    cache: 'no-store',
    credentials: 'omit',
    redirect: 'error',
  })
  if (response.ok) return response
  if (response.status === 401) throw new WikiUnauthorized()
  if (response.status === 403) {
    const data = await response.json().catch(() => null)
    throw new Error(data?.detail === 'Password login is disabled, use SSO'
      ? 'Wiki yêu cầu đăng nhập SSO.'
      : 'Tài khoản Wiki chưa có quyền truy cập mục này.')
  }
  throw new Error(`Không tải được dữ liệu từ Wiki (lỗi ${response.status}).`)
}

async function wikiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await wikiFetch(path, init)
  if (!response.headers.get('content-type')?.includes('application/json'))
    throw new Error('Wiki API trả về định dạng không hợp lệ.')
  return response.json()
}

export async function loginToWiki(email: string, password: string, signal: AbortSignal): Promise<WikiSession> {
  try {
    const { access_token, user } = await wikiRequest<{ access_token: string; user: { name: string } }>('auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      signal,
    })
    if (!access_token) throw new Error('Wiki không trả về phiên đăng nhập.')
    return { token: access_token, name: user?.name || email }
  } catch (error) {
    if (error instanceof WikiUnauthorized) throw new Error('Email hoặc mật khẩu Wiki không đúng.')
    throw error
  }
}

const query = (params: Record<string, string | number>) =>
  new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '').map(([k, v]) => [k, String(v)])).toString()

export function wikiReader(token: string, onExpired: (token: string) => void) {
  async function call<T>(run: (headers: HeadersInit) => Promise<T>): Promise<T> {
    try {
      return await run({ Authorization: `Bearer ${token}` })
    } catch (error) {
      if (error instanceof WikiUnauthorized) onExpired(token)
      throw error
    }
  }
  const get = <T>(path: string) => call((headers) => wikiRequest<T>(path, { headers }))
  const id = encodeURIComponent

  return {
    documents: (f: DocumentFilters) => get<WikiPage<WikiDocument>>(`sources?${query({
      page: f.page, page_size: 20, search: f.search, knowledge_type_id: f.knowledgeType,
      department_id: f.department, status: f.status, sort: f.sort,
    })}`),
    document: (sourceId: string) => get<WikiDocumentDetail>(`sources/${id(sourceId)}`),
    processingSummary: () => get<WikiProcessingSummary>('sources/processing-summary'),
    originalFile: (sourceId: string) =>
      call((headers) => wikiFetch(`sources/${id(sourceId)}/preview`, { headers }).then((r) => r.blob())),
    articles: (sourceId: string) => get<WikiArticle[]>(`wiki/pages?${query({ source_id: sourceId, limit: 1000 })}`),
    article: (slug: string) => get<WikiArticleDetail>(`wiki/pages/${id(slug)}`),
    knowledgeTypes: () => get<WikiKnowledgeType[]>('knowledge-types'),
    departments: () => get<WikiDepartment[]>('departments?include_inactive=true'),
    accounts: (page: number, search: string, department: string) =>
      get<WikiPage<WikiAccount>>(`employees?${query({ page, page_size: 20, search, department_id: department })}`),
  }
}
