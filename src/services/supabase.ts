import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Types
export interface QnA {
  id?: number
  'Câu hỏi': string
  'Câu trả lời': string
  'Loại câu hỏi': string
  'Lưu ý'?: string
}

export interface QueryType {
  id?: number
  type: string
  description: string
}

export interface VectorStoreStats {
  qna_count: number
  document_count: number
  query_type_count: number
}

// QnA Operations
export const qnaService = {
  async getAll() {
    const { data, error } = await supabase
      .from('chatbot_qna')
      .select('*')
      .order('id', { ascending: false })
    if (error) throw error
    return data
  },

  async getById(id: number) {
    const { data, error } = await supabase
      .from('chatbot_qna')
      .select('*')
      .eq('id', id)
      .single()
    if (error) throw error
    return data
  },

  async create(qna: QnA) {
    const { data, error } = await supabase
      .from('chatbot_qna')
      .insert([qna])
      .select()
      .single()
    if (error) throw error
    return data
  },

  async update(id: number, qna: Partial<QnA>) {
    const { data, error } = await supabase
      .from('chatbot_qna')
      .update(qna)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async delete(id: number) {
    const { error } = await supabase
      .from('chatbot_qna')
      .delete()
      .eq('id', id)
    if (error) throw error
  },

  async search(query: string) {
    const { data, error } = await supabase
      .from('chatbot_qna')
      .select('*')
      .or(`Câu hỏi.ilike.%${query}%,Câu trả lời.ilike.%${query}%`)
    if (error) throw error
    return data
  },
}

// Query Type Operations
export const queryTypeService = {
  async getAll() {
    const { data, error } = await supabase
      .from('query_type')
      .select('*')
      .order('id', { ascending: true })
    if (error) throw error
    return data
  },

  async create(queryType: QueryType) {
    const { data, error } = await supabase
      .from('query_type')
      .insert([queryType])
      .select()
      .single()
    if (error) throw error
    return data
  },

  async update(id: number, queryType: Partial<QueryType>) {
    const { data, error } = await supabase
      .from('query_type')
      .update(queryType)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async delete(id: number) {
    const { error } = await supabase
      .from('query_type')
      .delete()
      .eq('id', id)
    if (error) throw error
  },
}

// Vector Store Stats
export const vectorStoreService = {
  async getStats(): Promise<VectorStoreStats> {
    // Get counts from vector stores
    const [qnaResult, docResult, queryTypeResult] = await Promise.all([
      supabase.from('chatbot_qna_vectorstore').select('id', { count: 'exact', head: true }),
      supabase.from('chatbot_document_vectorstore').select('id', { count: 'exact', head: true }),
      supabase.from('query_type_vectorstore').select('id', { count: 'exact', head: true }),
    ])

    return {
      qna_count: qnaResult.count || 0,
      document_count: docResult.count || 0,
      query_type_count: queryTypeResult.count || 0,
    }
  },
}

