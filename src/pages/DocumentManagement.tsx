import { useEffect, useRef, useState } from 'react'
import { Upload, FileText, RefreshCw, Trash2, Database } from 'lucide-react'
import { postgresService, type RagDocumentFile } from '../services/postgres'
import toast from 'react-hot-toast'

export default function DocumentManagement() {
  const [documents, setDocuments] = useState<RagDocumentFile[]>([])
  const [stats, setStats] = useState({ total: 0 })
  const [loading, setLoading] = useState(true)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [docStats, docs] = await Promise.all([
        postgresService.getDocumentStats(),
        postgresService.getDocuments(100),
      ])
      setStats(docStats)
      setDocuments(docs)
    } catch (error: any) {
      toast.error('Lỗi khi tải dữ liệu: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleUpload = async (file: File) => {
    try {
      await postgresService.uploadDocument(file)
      toast.success('Đã tải lên tài liệu')
      loadData()
    } catch (error: any) {
      toast.error('Lỗi khi tải lên: ' + error.message)
    }
  }

  const handleProcessDocuments = async () => {
    const toastId = toast.loading('Đang xử lý tài liệu, vui lòng chờ...')
    try {
      await postgresService.processDocuments()
      toast.success('Tài liệu đã được xử lý', { id: toastId })
      setTimeout(loadData, 5000)
    } catch (error: any) {
      toast.error('Lỗi: ' + error.message, { id: toastId })
    }
  }

  const handleDeleteDocument = async (googleDriveId: string) => {
    if (!confirm('Bạn có chắc muốn xóa file này?')) return
    try {
      await postgresService.deleteDocument(googleDriveId)
      toast.success('Đã xóa file')
      loadData()
    } catch (error: any) {
      toast.error('Lỗi khi xóa: ' + error.message)
    }
  }

  const getGoogleDriveLink = (googleDriveId: string) => {
    return `https://drive.google.com/file/d/${googleDriveId}/view`
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Quản lý Tài liệu</h1>
          <p className="mt-1 text-sm text-gray-500">
            Quản lý tài liệu dùng cho RAG (danh sách/xóa/tải lên)
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            ref={fileInputRef}
            type="file"
            // Accept many formats supported by MarkItDown
            accept=".pdf,.pptx,.docx,.xlsx,.xls,.jpg,.jpeg,.png,.wav,.mp3,.html,.csv,.json,.xml,.zip,.txt"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (!file) return
              handleUpload(file)
              e.target.value = ''
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
          >
            <Upload className="w-4 h-4 mr-2" />
            Tải lên Tài liệu
          </button>
          <button
            onClick={handleProcessDocuments}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 transition-all"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Xử lý Tài liệu
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-1">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Tổng Files</p>
              <p className="text-3xl font-bold text-gray-900">{stats.total.toLocaleString()}</p>
            </div>
            <div className="w-14 h-14 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
              <Database className="w-7 h-7 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-blue-800 mb-2">
          ℹ️ Hướng dẫn sử dụng
        </h3>
        <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
          <li>Click "Tải lên Tài liệu" để thêm tài liệu vào hệ thống (hỗ trợ PDF, Word, Excel, PPT, Ảnh, Audio, v.v.)</li>
          <li>Click "Xử lý Tài liệu" để chạy convert (MarkItDown) & chunking/embedding dữ liệu</li>
          <li>Hiển thị danh sách file, xóa tài liệu</li>
        </ul>
      </div>

      {/* Document List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Danh sách Files</h2>
        </div>
        {loading ? (
          <div className="p-12 text-center">
            <RefreshCw className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-4" />
            <p className="text-gray-500">Đang tải dữ liệu...</p>
          </div>
        ) : documents.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">Không có file nào</p>
            <p className="text-sm text-gray-400 mt-1">
              Hãy tải lên tài liệu hoặc trigger workflow để đồng bộ
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    File
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Trạng thái
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Link
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {documents.map((doc, index) => (
                  <tr
                    key={doc.google_drive_id}
                    className="hover:bg-gray-50 transition-colors animate-slide-up"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-xl">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-red-600" />
                        <div className="truncate" title={doc.file_name}>
                          {doc.file_name}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          String(doc.status || '').toLowerCase() === 'uploaded'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {String(doc.status || '').toLowerCase() === 'uploaded' ? 'Uploaded' : 'Processed'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <a
                        href={getGoogleDriveLink(doc.google_drive_id)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary-700 hover:text-primary-800 hover:underline"
                      >
                        Google Drive
                      </a>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleDeleteDocument(doc.google_drive_id)}
                          className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-sm text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                          title="Xóa file này"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
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

