import axios from 'axios'

const getDocumentsUrl =
  import.meta.env.VITE_RAG_GET_DOCUMENTS_URL ||
  'https://traefik/n8n-hungyen.cahy.io.vn/webhook/get-documents'

const removeDocumentUrl =
  import.meta.env.VITE_RAG_REMOVE_DOCUMENT_URL ||
  'https://traefik/n8n-hungyen.cahy.io.vn/webhook/remove-document'

const uploadDocumentUrl =
  import.meta.env.VITE_RAG_UPLOAD_DOCUMENT_URL ||
  'https://traefik/n8n-hungyen.cahy.io.vn/webhook/upload-document'

const documentProcessingUrl =
  import.meta.env.VITE_RAG_DOCUMENT_PROCESSING_URL ||
  'https://traefik/n8n-hungyen.cahy.io.vn/webhook/document-processing'

export interface RagDocumentFile {
  file_id: string
  file_name: string
  google_drive_id: string
  mime_type?: string
  size?: number
  created_at?: string
  updated_at?: string
  status?: any
  uploaded?: boolean
  processed?: boolean
}

const normalizeDocumentList = (payload: any): RagDocumentFile[] => {
  const rawList = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : []

  return rawList
    .map((item: any) => {
      const file_id = String(item?.file_id ?? item?.id ?? '')
      const file_name = String(item?.file_name ?? item?.name ?? item?.filename ?? '')
      if (!file_id || !file_name) return null

      const normalized: RagDocumentFile = {
        file_id,
        file_name,
        google_drive_id: String(item?.google_drive_id ?? item?.googleDriveId ?? item?.drive_id ?? ''),
      }
      if (item?.mime_type) normalized.mime_type = String(item.mime_type)
      if (typeof item?.size === 'number') normalized.size = item.size
      if (item?.created_at) normalized.created_at = String(item.created_at)
      if (item?.updated_at) normalized.updated_at = String(item.updated_at)
      if (typeof item?.uploaded === 'boolean') normalized.uploaded = item.uploaded
      if (typeof item?.processed === 'boolean') normalized.processed = item.processed
      if (item?.status != null) normalized.status = item.status
      return normalized
    })
    .filter(Boolean) as RagDocumentFile[]
}

export const postgresService = {
  async getDocuments(limit = 100): Promise<RagDocumentFile[]> {
    const response = await axios.get(getDocumentsUrl)
    const docs = normalizeDocumentList(response.data)
    return docs.slice(0, limit)
  },

  async getDocumentStats() {
    const docs = await this.getDocuments(10000)
    return { total: docs.length }
  },

  async deleteDocument(fileId: string) {
    const formData = new FormData()
    formData.append('file_id', fileId)
    await axios.post(removeDocumentUrl, formData)
  },

  async uploadDocument(file: File, fileName?: string) {
    const formData = new FormData()
    formData.append('data', file)
    formData.append('file_name', fileName || file.name)
    await axios.post(uploadDocumentUrl, formData)
  },

  async processDocuments() {
    const response = await axios.post(documentProcessingUrl)
    return response.data
  },
}

