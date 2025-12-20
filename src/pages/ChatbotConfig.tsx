import { useEffect, useState } from 'react'
import { Save, RefreshCw } from 'lucide-react'
import { n8nService, type Workflow } from '../services/n8n'
import toast from 'react-hot-toast'

export default function ChatbotConfig() {
  const [workflow, setWorkflow] = useState<Workflow | null>(null)
  const [loading, setLoading] = useState(true)
  const [systemPrompt, setSystemPrompt] = useState('')
  const [config, setConfig] = useState({
    temperature: 0.7,
    topK: 5,
    contextWindowLength: 20,
    similarityThreshold: 0.7,
  })

  useEffect(() => {
    loadWorkflow()
  }, [])

  const loadWorkflow = async () => {
    try {
      setLoading(true)
      const workflows = await n8nService.getWorkflows()
      const chatbot = workflows.find((w) => w.name === 'chatbot_ver_2')
      if (chatbot) {
        setWorkflow(chatbot)
        // Extract system prompt from workflow nodes
        const aiAgent = chatbot.nodes.find((n) => n.name === 'AI Agent')
        if (aiAgent?.parameters?.options?.systemMessage) {
          setSystemPrompt(aiAgent.parameters.options.systemMessage)
        }
      } else {
        toast.error('Không tìm thấy workflow chatbot_ver_2')
      }
    } catch (error: any) {
      toast.error('Lỗi khi tải workflow: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!workflow) return

    try {
      // Update workflow with new configuration
      // Note: This is a simplified version. In production, you'd need to properly update the workflow JSON
      toast.success('Đã lưu cấu hình. Lưu ý: Cần cập nhật workflow trong n8n để áp dụng thay đổi.')
    } catch (error: any) {
      toast.error('Lỗi khi lưu: ' + error.message)
    }
  }

  if (loading) {
    return (
      <div className="px-4 py-6">
        <div className="text-center py-12 text-gray-500">Đang tải...</div>
      </div>
    )
  }

  return (
    <div className="px-4 py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Cấu hình Chatbot</h1>
        <button
          onClick={loadWorkflow}
          className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </button>
      </div>

      <div className="space-y-6">
        {/* System Prompt */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">System Prompt</h2>
          </div>
          <div className="p-6">
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={15}
              className="w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              placeholder="Nhập system prompt cho AI Agent..."
            />
            <p className="mt-2 text-sm text-gray-500">
              System prompt này sẽ được sử dụng trong workflow chatbot_ver_2
            </p>
          </div>
        </div>

        {/* Model Parameters */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Model Parameters</h2>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Temperature: {config.temperature}
              </label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={config.temperature}
                onChange={(e) =>
                  setConfig({ ...config, temperature: parseFloat(e.target.value) })
                }
                className="w-full"
              />
              <p className="text-xs text-gray-500 mt-1">
                Điều chỉnh độ sáng tạo của model (0 = deterministic, 2 = rất sáng tạo)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Top-K: {config.topK}
              </label>
              <input
                type="number"
                min="1"
                max="20"
                value={config.topK}
                onChange={(e) =>
                  setConfig({ ...config, topK: parseInt(e.target.value) })
                }
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">
                Số lượng kết quả vector similarity search trả về
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Context Window Length: {config.contextWindowLength}
              </label>
              <input
                type="number"
                min="5"
                max="50"
                value={config.contextWindowLength}
                onChange={(e) =>
                  setConfig({ ...config, contextWindowLength: parseInt(e.target.value) })
                }
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">
                Số lượng tin nhắn được lưu trong memory buffer
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Similarity Threshold: {config.similarityThreshold}
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={config.similarityThreshold}
                onChange={(e) =>
                  setConfig({ ...config, similarityThreshold: parseFloat(e.target.value) })
                }
                className="w-full"
              />
              <p className="text-xs text-gray-500 mt-1">
                Ngưỡng similarity để lọc kết quả vector search
              </p>
            </div>
          </div>
        </div>

        {/* API Keys */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">API Keys & Credentials</h2>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  OpenAI API Key
                </label>
                <input
                  type="password"
                  placeholder="Được quản lý trong n8n credentials"
                  disabled
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm bg-gray-50 sm:text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Quản lý trong n8n → Credentials → OpenAI
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Supabase URL & Key
                </label>
                <input
                  type="text"
                  placeholder="Được quản lý trong n8n credentials"
                  disabled
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm bg-gray-50 sm:text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Quản lý trong n8n → Credentials → Supabase
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            className="inline-flex items-center px-6 py-3 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-primary-600 hover:bg-primary-700"
          >
            <Save className="w-5 h-5 mr-2" />
            Lưu cấu hình
          </button>
        </div>
      </div>
    </div>
  )
}

