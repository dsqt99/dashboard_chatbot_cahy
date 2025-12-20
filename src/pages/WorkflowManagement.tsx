import { useEffect, useState } from 'react'
import { Play, Square, RefreshCw, CheckCircle, XCircle, Clock } from 'lucide-react'
import { n8nService, type Workflow, type Execution } from '../services/n8n'
import toast from 'react-hot-toast'

export default function WorkflowManagement() {
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [executions, setExecutions] = useState<Execution[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [workflowsData, executionsData] = await Promise.all([
        n8nService.getWorkflows(),
        n8nService.getExecutions(20),
      ])
      setWorkflows(workflowsData)
      setExecutions(executionsData)
    } catch (error: any) {
      toast.error('Lỗi khi tải dữ liệu: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleActivate = async (id: string) => {
    try {
      await n8nService.activateWorkflow(id)
      toast.success('Đã kích hoạt workflow')
      loadData()
    } catch (error: any) {
      toast.error('Lỗi: ' + error.message)
    }
  }

  const handleDeactivate = async (id: string) => {
    try {
      await n8nService.deactivateWorkflow(id)
      toast.success('Đã tắt workflow')
      loadData()
    } catch (error: any) {
      toast.error('Lỗi: ' + error.message)
    }
  }

  const handleExecute = async (id: string) => {
    try {
      await n8nService.executeWorkflow(id)
      toast.success('Đã trigger workflow')
      setTimeout(loadData, 2000)
    } catch (error: any) {
      toast.error('Lỗi: ' + error.message)
    }
  }

  const getStatusIcon = (finished: boolean) => {
    if (finished) {
      return <CheckCircle className="w-5 h-5 text-green-500" />
    }
    return <XCircle className="w-5 h-5 text-red-500" />
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('vi-VN')
  }

  const chatbotWorkflows = [
    'Chatbot-widget-ver2',
    'Chatbot-widget',
    'qna_retrieval',
    'Dataloader',
    'document_store',
    'update_db',
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Quản lý Workflows n8n</h1>
          <p className="mt-1 text-sm text-gray-500">
            Quản lý và theo dõi các workflows của hệ thống chatbot
          </p>
        </div>
        <button
          onClick={loadData}
          className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </button>
      </div>

      {/* Workflows */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Workflows</h2>
        </div>
        {loading ? (
          <div className="p-12 text-center">
            <RefreshCw className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-4" />
            <p className="text-gray-500">Đang tải...</p>
          </div>
        ) : (
          <div className="p-6">
            <div className="grid grid-cols-1 gap-4">
              {workflows
                .filter((w) => chatbotWorkflows.includes(w.name))
                .map((workflow, index) => (
                  <div
                    key={workflow.id}
                    className="flex items-center justify-between p-5 border border-gray-200 rounded-xl hover:shadow-md transition-shadow animate-slide-up"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="flex items-center">
                      <div
                        className={`w-4 h-4 rounded-full mr-4 ${
                          workflow.active ? 'bg-green-500 animate-pulse' : 'bg-gray-300'
                        }`}
                      />
                      <div>
                        <h3 className="text-base font-semibold text-gray-900">{workflow.name}</h3>
                        <p className="text-sm text-gray-500 mt-1">
                          {workflow.active ? '🟢 Đang hoạt động' : '⚫ Đã tắt'}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {workflow.active ? (
                        <button
                          onClick={() => handleDeactivate(workflow.id)}
                          className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                        >
                          <Square className="w-4 h-4 mr-1" />
                          Tắt
                        </button>
                      ) : (
                        <button
                          onClick={() => handleActivate(workflow.id)}
                          className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-green-600 hover:bg-green-700 transition-colors"
                        >
                          <Play className="w-4 h-4 mr-1" />
                          Kích hoạt
                        </button>
                      )}
                      <button
                        onClick={() => handleExecute(workflow.id)}
                        className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 transition-all"
                      >
                        <Play className="w-4 h-4 mr-1" />
                        Chạy
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Recent Executions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Recent Executions</h2>
        </div>
        {loading ? (
          <div className="p-12 text-center">
            <RefreshCw className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-4" />
            <p className="text-gray-500">Đang tải...</p>
          </div>
        ) : executions.length === 0 ? (
          <div className="p-12 text-center">
            <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">Chưa có executions nào</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Workflow
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Started
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Duration
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {executions.map((exec, index) => (
                  <tr
                    key={exec.id}
                    className="hover:bg-gray-50 transition-colors animate-slide-up"
                    style={{ animationDelay: `${index * 30}ms` }}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {exec.workflowData?.name || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusIcon(exec.finished)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(exec.startedAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {exec.stoppedAt
                        ? `${Math.round(
                            (new Date(exec.stoppedAt).getTime() -
                              new Date(exec.startedAt).getTime()) /
                              1000
                          )}s`
                        : '-'}
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

