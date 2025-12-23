import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import {
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  X,
  Edit,
  CheckSquare,
  Square,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'
import { qnaVectorstoreService, type QnAGuideRow } from '../services/n8n'

type DraftGuideRow = {
  id?: string
  created_at?: string
  question: string
  answer: string
  type: string
  note?: string
}

const normalizeHeaderKey = (value: unknown) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')

const toDraftFromSheetRow = (row: Record<string, any>): DraftGuideRow | null => {
  const entries = Object.entries(row)
  const normalized = new Map<string, any>()
  entries.forEach(([k, v]) => normalized.set(normalizeHeaderKey(k), v))

  const question = String(normalized.get('question') ?? '').trim()
  const answer = String(normalized.get('answer') ?? '').trim()
  const type = String(normalized.get('type') ?? '').trim()
  const noteRaw = normalized.get('note')
  const note = noteRaw != null && String(noteRaw).trim() ? String(noteRaw).trim() : undefined

  const idRaw = normalized.get('id')
  const createdAtRaw = normalized.get('created_at') ?? normalized.get('createdat')

  if (!question || !answer || !type) return null

  return {
    id: idRaw != null && String(idRaw).trim() ? String(idRaw).trim() : undefined,
    created_at: createdAtRaw != null && String(createdAtRaw).trim() ? String(createdAtRaw).trim() : undefined,
    question,
    answer,
    type,
    note,
  }
}

const readFileAsArrayBuffer = (file: File) =>
  new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Không đọc được file'))
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.readAsArrayBuffer(file)
  })

export default function QnAGuideManagement() {
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [rows, setRows] = useState<QnAGuideRow[]>([])
  const [query, setQuery] = useState('')
  const [queryDebounced, setQueryDebounced] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [pageSize, setPageSize] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalRows, setTotalRows] = useState<number | undefined>(undefined)
  const [totalPages, setTotalPages] = useState<number | undefined>(undefined)
  const [hasNextPage, setHasNextPage] = useState(false)
  const [metaLoading, setMetaLoading] = useState(false)
  const [metaTotal, setMetaTotal] = useState<number | undefined>(undefined)
  const [metaTypes, setMetaTypes] = useState<string[]>([])
  const [jumpPage, setJumpPage] = useState('')

  const [draftQuestion, setDraftQuestion] = useState('')
  const [draftAnswer, setDraftAnswer] = useState('')
  const [draftType, setDraftType] = useState('')
  const [draftNote, setDraftNote] = useState('')

  const [uploadPreview, setUploadPreview] = useState<DraftGuideRow[]>([])
  const [uploadFileName, setUploadFileName] = useState('')
  const [uploadDragActive, setUploadDragActive] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [draftId, setDraftId] = useState<string | undefined>(undefined)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const loadMeta = async () => {
    try {
      setMetaLoading(true)
      const allRows = await qnaVectorstoreService.listAll()
      setMetaTotal(allRows.length)
      const set = new Set<string>()
      allRows.forEach((r) => set.add(String(r.type ?? '').trim()))
      setMetaTypes(Array.from(set).filter(Boolean).sort((a, b) => a.localeCompare(b)))
    } catch {
      setMetaTotal(undefined)
      setMetaTypes([])
    } finally {
      setMetaLoading(false)
    }
  }

  const loadRows = async () => {
    try {
      setLoading(true)
      const trimmed = queryDebounced.trim()
      const res = trimmed
        ? await qnaVectorstoreService.searchPaged({
            limit: pageSize,
            page: currentPage,
            query: trimmed,
          })
        : await qnaVectorstoreService.listPaged({
            limit: pageSize,
            page: currentPage,
            type: typeFilter === 'all' ? undefined : typeFilter,
          })
      setRows(res.data)
      setTotalRows(res.total)
      setTotalPages(res.total_page)
      setHasNextPage(res.hasNextPage)
      setSelectedIds(new Set()) // Clear selection on page change
    } catch (error: any) {
      toast.error('Lỗi khi tải danh sách: ' + (error?.message ?? String(error)))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRows()
  }, [currentPage, pageSize, queryDebounced, typeFilter])

  useEffect(() => {
    const next = query.trim()
    const t = window.setTimeout(() => {
      setQueryDebounced(next)
    }, 400)
    return () => window.clearTimeout(t)
  }, [query])

  useEffect(() => {
    if (currentPage !== 1) setCurrentPage(1)
  }, [query])

  useEffect(() => {
    if (queryDebounced.trim()) {
      setTypeFilter('all')
      if (currentPage !== 1) setCurrentPage(1)
    }
  }, [currentPage, queryDebounced])

  useEffect(() => {
    loadMeta()
  }, [])

  const types = useMemo(() => {
    if (metaTypes.length > 0) return metaTypes
    const set = new Set<string>()
    rows.forEach((r) => set.add(String(r.type ?? '').trim()))
    return Array.from(set).filter(Boolean).sort((a, b) => a.localeCompare(b))
  }, [metaTypes, rows])

  useEffect(() => {
    setJumpPage(String(currentPage))
  }, [currentPage])

  const filteredRows = useMemo(() => {
    return rows
      .filter((r) => (typeFilter === 'all' ? true : String(r.type) === typeFilter))
  }, [rows, typeFilter])

  const selectableIds = useMemo(() => {
    const set = new Set<string>()
    filteredRows.forEach((r) => {
      if (r.id) set.add(r.id)
    })
    return Array.from(set)
  }, [filteredRows])

  const isAllSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedIds.has(id))

  const goToPage = (value: string) => {
    const n = Number(value)
    if (!Number.isFinite(n)) return
    const page = Math.floor(n)
    if (page < 1) return
    if (typeof totalPages === 'number' && page > totalPages) return
    setCurrentPage(page)
  }

  useEffect(() => {
    if (loading) return
    if (rows.length > 0) return
    if (currentPage <= 1) return
    setCurrentPage((p) => Math.max(1, p - 1))
  }, [currentPage, loading, rows.length])

  const handleAddOne = async () => {
    const row: DraftGuideRow = {
      id: draftId,
      question: draftQuestion.trim(),
      answer: draftAnswer.trim(),
      type: draftType.trim(),
      note: draftNote.trim() ? draftNote.trim() : undefined,
    }

    if (!row.question || !row.answer || !row.type) {
      toast.error('Vui lòng nhập đủ: Câu hỏi, Câu trả lời, Loại câu hỏi')
      return
    }
    if (draftId && !row.id) {
      toast.error('Thiếu id để sửa dòng')
      return
    }

    try {
      setBusy(true)
      if (draftId) {
        await qnaVectorstoreService.updateRows([row])
      } else {
        await qnaVectorstoreService.upsert(row)
      }
      toast.success(draftId ? 'Đã cập nhật câu hỏi hướng dẫn' : 'Đã lưu câu hỏi hướng dẫn')
      setDraftQuestion('')
      setDraftAnswer('')
      setDraftType('')
      setDraftNote('')
      setDraftId(undefined)
      setAddModalOpen(false)
      if (!draftId) setCurrentPage(1) // Only reset to page 1 if adding new
      await loadRows() // Reload rows to show changes
      await loadMeta()
    } catch (error: any) {
      toast.error('Lỗi khi lưu: ' + (error?.message ?? String(error)))
    } finally {
      setBusy(false)
    }
  }

  const openAddModal = () => {
    setDraftQuestion('')
    setDraftAnswer('')
    setDraftType('')
    setDraftNote('')
    setDraftId(undefined)
    setAddModalOpen(true)
  }

  const handleEditRow = (row: QnAGuideRow) => {
    setDraftId(row.id)
    setDraftQuestion(row.question)
    setDraftAnswer(row.answer)
    setDraftType(row.type)
    setDraftNote(row.note ?? '')
    setAddModalOpen(true)
  }

  const handleSelectRow = (id: string) => {
    const newSet = new Set(selectedIds)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedIds(newSet)
  }

  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set())
    } else {
      const newSet = new Set<string>()
      selectableIds.forEach((id) => newSet.add(id))
      setSelectedIds(newSet)
    }
  }

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return
    const ok = window.confirm(`Xóa ${selectedIds.size} câu hỏi đã chọn?`)
    if (!ok) return

    try {
      setBusy(true)
      const rowsToRemove = filteredRows
        .filter((r) => r.id && selectedIds.has(r.id))
        .map((r) => ({
          id: r.id,
          question: r.question,
          answer: r.answer,
          type: r.type,
          note: r.note,
          created_at: r.created_at,
        }))

      if (rowsToRemove.length === 0) return

      await qnaVectorstoreService.removeRows(rowsToRemove)
      toast.success(`Đã xóa ${selectedIds.size} dòng`)
      setSelectedIds(new Set())
      await loadRows()
      await loadMeta()
    } catch (error: any) {
      toast.error('Lỗi khi xóa: ' + (error?.message ?? String(error)))
    } finally {
      setBusy(false)
    }
  }

  const openUploadModal = () => {
    setUploadPreview([])
    setUploadFileName('')
    setUploadDragActive(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
    setUploadModalOpen(true)
  }

  const handlePickFile = () => fileInputRef.current?.click()

  const handleFileChange = async (file: File | null) => {
    if (!file) return
    try {
      setBusy(true)
      setUploadFileName(file.name)
      const data = await readFileAsArrayBuffer(file)
      const workbook = XLSX.read(data, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const ws = workbook.Sheets[sheetName]
      const sheetRows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' })
      const parsed = sheetRows.map(toDraftFromSheetRow).filter(Boolean) as DraftGuideRow[]
      setUploadPreview(parsed)
      toast.success(`Đã đọc ${parsed.length.toLocaleString()} dòng`)
    } catch (error: any) {
      setUploadPreview([])
      toast.error('Lỗi khi đọc file: ' + (error?.message ?? String(error)))
    } finally {
      setBusy(false)
    }
  }

  const handleUploadDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    if (busy) return
    setUploadDragActive(false)
    const file = event.dataTransfer?.files?.[0] ?? null
    await handleFileChange(file)
  }

  const handleUpload = async () => {
    if (uploadPreview.length === 0) {
      toast.error('Chưa có dữ liệu upload')
      return
    }
    try {
      setBusy(true)
      await qnaVectorstoreService.upsertMany(uploadPreview)
      toast.success(`Đã đẩy ${uploadPreview.length.toLocaleString()} dòng`)
      setUploadPreview([])
      setUploadFileName('')
      if (fileInputRef.current) fileInputRef.current.value = ''
      setUploadModalOpen(false)
      setCurrentPage(1)
      await loadMeta()
    } catch (error: any) {
      toast.error('Lỗi khi đẩy dữ liệu: ' + (error?.message ?? String(error)))
    } finally {
      setBusy(false)
    }
  }

  const handleDeleteRow = async (row: QnAGuideRow) => {
    if (!row.id) {
      toast.error('Dòng này không có id để xóa')
      return
    }
    const ok = window.confirm(`Xóa câu hỏi hướng dẫn id=${row.id}?`)
    if (!ok) return
    try {
      setBusy(true)
      await qnaVectorstoreService.removeRows([
        {
          id: row.id,
          question: row.question,
          answer: row.answer,
          type: row.type,
          note: row.note,
          created_at: row.created_at,
        },
      ])
      toast.success('Đã xóa')
      await loadRows()
      await loadMeta()
    } catch (error: any) {
      toast.error('Lỗi khi xóa: ' + (error?.message ?? String(error)))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {addModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50"
          onClick={() => (busy ? undefined : setAddModalOpen(false))}
        >
          <div
            className="w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {draftId ? 'Sửa câu hỏi hướng dẫn' : 'Thêm câu hỏi hướng dẫn'}
                </h2>
              </div>
              <button
                onClick={() => setAddModalOpen(false)}
                disabled={busy}
                className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Câu hỏi</label>
                <textarea
                  value={draftQuestion}
                  onChange={(e) => setDraftQuestion(e.target.value)}
                  rows={3}
                  disabled={busy}
                  className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cahy-blue/20 focus:border-cahy-blue"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Câu trả lời</label>
                <textarea
                  value={draftAnswer}
                  onChange={(e) => setDraftAnswer(e.target.value)}
                  rows={4}
                  disabled={busy}
                  className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cahy-blue/20 focus:border-cahy-blue"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Loại câu hỏi</label>
                  <input
                    value={draftType}
                    onChange={(e) => setDraftType(e.target.value)}
                    disabled={busy}
                    className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cahy-blue/20 focus:border-cahy-blue"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Lưu ý</label>
                  <input
                    value={draftNote}
                    onChange={(e) => setDraftNote(e.target.value)}
                    disabled={busy}
                    className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cahy-blue/20 focus:border-cahy-blue"
                  />
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-2 bg-gray-50">
              <button
                onClick={() => setAddModalOpen(false)}
                disabled={busy}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Đóng
              </button>
              <button
                onClick={handleAddOne}
                disabled={busy}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-cahy-blue hover:bg-cahy-blue/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Plus className="w-4 h-4 mr-2" />
                Lưu
              </button>
            </div>
          </div>
        </div>
      )}

      {uploadModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50"
          onClick={() => (busy ? undefined : setUploadModalOpen(false))}
        >
          <div
            className="w-full max-w-3xl bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Upload Excel/CSV</h2>
                <p className="text-sm text-gray-500">Format: `question, answer, type, note`</p>
              </div>
              <button
                onClick={() => setUploadModalOpen(false)}
                disabled={busy}
                className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
              />

              <div
                onDragEnter={(e) => {
                  e.preventDefault()
                  if (busy) return
                  setUploadDragActive(true)
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                  if (busy) return
                  setUploadDragActive(true)
                }}
                onDragLeave={(e) => {
                  e.preventDefault()
                  setUploadDragActive(false)
                }}
                onDrop={handleUploadDrop}
                className={`rounded-lg border-2 border-dashed p-4 transition-colors ${
                  uploadDragActive ? 'border-cahy-blue bg-blue-50/60' : 'border-gray-200 bg-gray-50'
                } ${busy ? 'opacity-60' : 'cursor-pointer hover:border-gray-300'}`}
                onClick={() => (busy ? undefined : handlePickFile())}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center">
                    <Upload className="w-5 h-5 text-gray-500" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-900">
                      Kéo & thả file vào đây hoặc bấm để chọn file
                    </div>
                    <div className="text-xs text-gray-500">Hỗ trợ .xlsx, .xls, .csv</div>
                    {uploadFileName && (
                      <div className="mt-1 text-xs text-gray-700 truncate">Đã chọn: {uploadFileName}</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <button
                  onClick={handlePickFile}
                  disabled={busy}
                  className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Chọn file
                </button>
                <button
                  onClick={handleUpload}
                  disabled={busy || uploadPreview.length === 0}
                  className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-cahy-red hover:bg-cahy-red/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Đẩy lên
                </button>
                <div className="text-sm text-gray-600 sm:ml-auto">
                  Preview: {uploadPreview.length.toLocaleString()} dòng
                </div>
              </div>

              {uploadPreview.length > 0 && (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="max-h-80 overflow-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Loại câu hỏi</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Câu hỏi</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {uploadPreview.slice(0, 30).map((r, idx) => (
                          <tr key={`${r.type}-${idx}`}>
                            <td className="px-4 py-2 text-sm text-gray-700 font-mono">{r.type}</td>
                            <td className="px-4 py-2 text-sm text-gray-700">{r.question}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {uploadPreview.length > 30 && (
                    <div className="px-4 py-2 text-xs text-gray-500 bg-gray-50">
                      Hiển thị 30/{uploadPreview.length.toLocaleString()} dòng
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Câu hỏi hướng dẫn</h1>
          <p className="mt-1 text-sm text-gray-500">Nhập tay hoặc upload Excel/CSV theo format chatbot_qna_rows.csv</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={openAddModal}
            disabled={busy}
            className="inline-flex items-center justify-center w-10 h-10 border border-gray-300 rounded-lg shadow-sm text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Thêm câu hỏi hướng dẫn"
            title="Thêm"
          >
            <Plus className="w-5 h-5" />
          </button>
          <button
            onClick={openUploadModal}
            disabled={busy}
            className="inline-flex items-center justify-center w-10 h-10 border border-gray-300 rounded-lg shadow-sm text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Upload Excel/CSV"
            title="Upload"
          >
            <Upload className="w-5 h-5" />
          </button>
          <button
            onClick={async () => {
              await Promise.all([loadRows(), loadMeta()])
            }}
            disabled={loading || busy}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Làm mới
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="text-xs text-gray-500">Tổng câu hỏi</div>
          <div className="mt-1 text-2xl font-bold text-gray-900">
            {metaLoading ? '…' : typeof metaTotal === 'number' ? metaTotal.toLocaleString() : '—'}
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="text-xs text-gray-500">Tổng loại câu hỏi</div>
          <div className="mt-1 text-2xl font-bold text-gray-900">
            {metaLoading ? '…' : types.length.toLocaleString()}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 min-w-0">
              <select
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value)
                  setCurrentPage(1)
                }}
                disabled={busy || Boolean(queryDebounced.trim())}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cahy-blue/20 focus:border-cahy-blue bg-white"
              >
                <option value="all">Tất cả loại câu hỏi</option>
                {types.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <div className="relative w-full sm:w-96 min-w-0">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Tìm theo câu hỏi / trả lời"
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cahy-blue/20 focus:border-cahy-blue"
                />
              </div>
              <div className="text-sm text-gray-600">
                {filteredRows.length.toLocaleString()} / {rows.length.toLocaleString()}
                {typeof totalRows === 'number' ? ` • Tổng: ${totalRows.toLocaleString()}` : ''}
              </div>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-2">
              <select
                value={String(pageSize)}
                onChange={(e) => {
                  const nextSize = Math.max(1, Number(e.target.value) || 10)
                  setPageSize(nextSize)
                  setCurrentPage(1)
                }}
                disabled={busy}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cahy-blue/20 focus:border-cahy-blue bg-white"
              >
                <option value="10">10 / trang</option>
                <option value="20">20 / trang</option>
                <option value="50">50 / trang</option>
              </select>
            </div>
          </div>
        </div>

        {selectedIds.size > 0 && (
          <div className="px-6 py-2 bg-blue-50 border-b border-blue-100 flex items-center justify-between animate-fade-in">
            <span className="text-sm text-blue-700 font-medium">Đã chọn {selectedIds.size} dòng</span>
            <button
              onClick={handleDeleteSelected}
              disabled={busy}
              className="inline-flex items-center px-3 py-1.5 border border-transparent rounded text-xs font-medium text-red-700 bg-red-100 hover:bg-red-200 disabled:opacity-50 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              Xóa đã chọn
            </button>
          </div>
        )}

        {loading ? (
          <div className="p-12 text-center">
            <RefreshCw className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-4" />
            <p className="text-gray-500">Đang tải...</p>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-500 font-medium">Không có dữ liệu</p>
          </div>
        ) : (
          <div className="max-h-[65vh] overflow-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-left w-10">
                    <button
                      onClick={handleSelectAll}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      {isAllSelected ? (
                        <CheckSquare className="w-5 h-5 text-cahy-blue" />
                      ) : (
                        <Square className="w-5 h-5" />
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Thời gian tạo</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Loại câu hỏi</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Câu hỏi</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Câu trả lời</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Lưu ý</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Thao tác</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredRows.map((r, index) => {
                  const isSelected = r.id ? selectedIds.has(r.id) : false
                  return (
                    <tr
                      key={String(r.id ?? `${r.type}-${index}`)}
                      className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'} ${isSelected ? 'bg-blue-50/50' : ''}`}
                    >
                      <td className="px-4 py-4 whitespace-nowrap">
                        <button
                          onClick={() => r.id && handleSelectRow(r.id)}
                          disabled={!r.id}
                          className={`${!r.id ? 'opacity-30 cursor-not-allowed' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                          {isSelected ? (
                            <CheckSquare className="w-5 h-5 text-cahy-blue" />
                          ) : (
                            <Square className="w-5 h-5" />
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500 font-mono">
                        {r.created_at ? new Date(r.created_at).toLocaleString() : '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-mono">{r.type}</td>
                      <td className="px-6 py-4 text-sm text-gray-700 max-w-[360px]">
                        <div className="max-h-20 overflow-hidden">{r.question}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700 max-w-[420px]">
                        <div className="max-h-24 overflow-hidden whitespace-pre-wrap">{r.answer}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700 max-w-[280px]">
                        <div className="max-h-20 overflow-hidden">{r.note ?? ''}</div>
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEditRow(r)}
                            disabled={busy}
                            className="inline-flex items-center px-2 py-1.5 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 text-xs text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Sửa"
                          >
                            <Edit className="w-3.5 h-3.5 mr-1" />
                            Sửa
                          </button>
                          <button
                            onClick={() => handleDeleteRow(r)}
                            disabled={busy}
                            className="inline-flex items-center px-2 py-1.5 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 text-xs text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Xóa"
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-1 text-cahy-red" />
                            Xóa
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between gap-3 bg-white">
          <div className="text-sm text-gray-600">
            <span className="sm:hidden">
              Trang {currentPage}
              {typeof totalPages === 'number' ? ` / ${totalPages}` : ''}
            </span>
            <span className="hidden sm:inline">Trang {currentPage}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={busy || loading || currentPage <= 1}
              className="p-2 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Trang trước"
              title="Trang trước"
            >
              <ChevronLeft className="w-5 h-5 text-gray-700" />
            </button>

            <div className="flex items-center gap-2">
              <input
                value={jumpPage}
                onChange={(e) => setJumpPage(e.target.value.replace(/[^\d]/g, ''))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') goToPage(jumpPage)
                }}
                onBlur={() => goToPage(jumpPage)}
                inputMode="numeric"
                disabled={busy || loading}
                className="w-16 sm:w-20 px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-center focus:outline-none focus:ring-2 focus:ring-cahy-blue/20 focus:border-cahy-blue disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Nhập số trang"
              />
              <div className="hidden sm:block text-sm text-gray-500">
                / {typeof totalPages === 'number' ? totalPages : '—'}
              </div>
            </div>

            <button
              onClick={() => setCurrentPage((p) => p + 1)}
              disabled={busy || loading || !hasNextPage}
              className="p-2 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Trang sau"
              title="Trang sau"
            >
              <ChevronRight className="w-5 h-5 text-gray-700" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
