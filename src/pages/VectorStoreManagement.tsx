import { useEffect, useState } from 'react'
import { Database, RefreshCw, Search } from 'lucide-react'
import { n8nService, qnaVectorstoreService } from '../services/n8n'
import { postgresService } from '../services/postgres'
import toast from 'react-hot-toast'

type QueryType = {
  id: string
  type: string
  description?: string
}

export default function VectorStoreManagement() {
  const [stats, setStats] = useState({
    qna_count: 0,
    document_count: 0,
    query_type_count: 0,
  })
  const [queryTypes, setQueryTypes] = useState<QueryType[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [qna, docs] = await Promise.all([qnaVectorstoreService.listAll(), postgresService.getDocuments(10000)])
      setStats({
        qna_count: qna.length,
        document_count: docs.length,
        query_type_count: 0,
      })
      setQueryTypes([])
    } catch (error: any) {
      toast.error('Lỗi khi tải dữ liệu: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleReindexQnA = async () => {
    try {
      const workflows = await n8nService.getWorkflows()
      const dataloader = workflows.find((w) => w.name === 'Dataloader')
      if (dataloader) {
        await n8nService.executeWorkflow(dataloader.id)
        toast.success('Đã trigger re-index Q&A vector store')
        setTimeout(loadData, 2000)
      } else {
        toast.error('Không tìm thấy workflow Dataloader')
      }
    } catch (error: any) {
      toast.error('Lỗi: ' + error.message)
    }
  }

  const handleReindexQueryTypes = async () => {
    try {
      const workflows = await n8nService.getWorkflows()
      const dataloader = workflows.find((w) => w.name === 'Dataloader')
      if (dataloader) {
        await n8nService.executeWorkflow(dataloader.id)
        toast.success('Đã trigger re-index Query Types vector store')
        setTimeout(loadData, 2000)
      } else {
        toast.error('Không tìm thấy workflow Dataloader')
      }
    } catch (error: any) {
      toast.error('Lỗi: ' + error.message)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Quản lý Vector Stores</h1>
        <p className="mt-1 text-sm text-gray-500">
          Quản lý các vector stores: Q&A (Supabase), Documents (PostgreSQL), Query Types (Supabase)
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow animate-slide-up" style={{ animationDelay: '0ms' }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Q&A Vector Store</p>
              <p className="text-3xl font-bold text-gray-900">
                {stats.qna_count.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 mt-1">Supabase Vector Store</p>
            </div>
            <div className="w-14 h-14 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
              <Database className="w-7 h-7 text-white" />
            </div>
          </div>
          <button
            onClick={handleReindexQnA}
            className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 transition-all"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Re-index
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow animate-slide-up" style={{ animationDelay: '100ms' }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Document Vector Store</p>
              <p className="text-3xl font-bold text-gray-900">
                {stats.document_count.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 mt-1">PostgreSQL PGVector</p>
            </div>
            <div className="w-14 h-14 bg-gradient-to-br from-green-400 to-green-600 rounded-xl flex items-center justify-center shadow-lg">
              <Database className="w-7 h-7 text-white" />
            </div>
          </div>
          <a
            href="/documents"
            className="w-full inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
          >
            Quản lý Documents
          </a>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow animate-slide-up" style={{ animationDelay: '200ms' }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Query Type Vector Store</p>
              <p className="text-3xl font-bold text-gray-900">
                {stats.query_type_count.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 mt-1">Supabase Vector Store</p>
            </div>
            <div className="w-14 h-14 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-xl flex items-center justify-center shadow-lg">
              <Database className="w-7 h-7 text-white" />
            </div>
          </div>
          <button
            onClick={handleReindexQueryTypes}
            className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-gradient-to-r from-yellow-600 to-yellow-700 hover:from-yellow-700 hover:to-yellow-800 transition-all"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Re-index
          </button>
        </div>
      </div>

      {/* Query Types */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Query Types</h2>
        </div>
        {loading ? (
          <div className="p-12 text-center">
            <RefreshCw className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-4" />
            <p className="text-gray-500">Đang tải...</p>
          </div>
        ) : queryTypes.length === 0 ? (
          <div className="p-12 text-center">
            <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">Không có query types nào</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Description
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {queryTypes.map((qt, index) => (
                  <tr
                    key={qt.id}
                    className="hover:bg-gray-50 transition-colors animate-slide-up"
                    style={{ animationDelay: `${index * 30}ms` }}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        {qt.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{qt.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

