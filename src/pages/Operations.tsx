import { Activity, CheckCircle2, RotateCw, Trash2, XCircle } from 'lucide-react'
import { useState } from 'react'
import { Empty, ErrorBox, PageHeader, fmtAgo, fmtNum, fmtTime } from '../components/ui'
import { useAsync } from '../hooks/useAsync'
import { api, type DependencyStatus } from '../lib/api'

function HealthCard({ name, status }: { name: string; status: DependencyStatus }) {
  return (
    <div className="card flex items-start gap-3 p-4">
      {status.ok ? (
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-ok" aria-hidden />
      ) : (
        <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-danger" aria-hidden />
      )}
      <div className="min-w-0">
        <p className="text-sm font-semibold">{name}</p>
        <p className="truncate text-xs text-muted" title={status.detail}>{status.detail || (status.ok ? 'Hoạt động bình thường' : 'Lỗi kết nối')}</p>
      </div>
    </div>
  )
}

export default function Operations() {
  const sys = useAsync(api.systemStatus, [])
  const queue = useAsync(api.webhookStatus, [])
  const failed = useAsync(() => api.listFailedWebhooks(0, 50), [])
  const [err, setErr] = useState('')
  const [busyId, setBusyId] = useState('')

  const reloadAll = () => {
    sys.reload()
    queue.reload()
    failed.reload()
  }

  const handleRetry = async (id: string) => {
    setBusyId(id)
    setErr('')
    try {
      await api.retryFailedWebhook(id)
      reloadAll()
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Retry thất bại')
    } finally {
      setBusyId('')
    }
  }

  const handleDelete = async (id: string) => {
    setBusyId(id)
    setErr('')
    try {
      await api.deleteFailedWebhook(id)
      failed.reload()
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Xoá webhook lỗi thất bại')
    } finally {
      setBusyId('')
    }
  }

  return (
    <>
      <PageHeader
        title="Vận hành hệ thống"
        desc="Theo dõi trạng thái dịch vụ Zalo OA, hàng đợi webhook và xử lý sự kiện lỗi."
        actions={
          <button type="button" className="btn-ghost" onClick={reloadAll}>
            <RotateCw className="h-4 w-4" aria-hidden /> Làm mới
          </button>
        }
      />

      {err && (
        <div role="alert" className="mb-4 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {err}
        </div>
      )}

      {/* Trạng thái hệ thống */}
      <section className="mb-6" aria-label="Trạng thái dịch vụ">
        <h2 className="mb-3 text-sm font-semibold text-muted">Trạng thái thành phần</h2>
        {sys.error ? (
          <div className="card"><ErrorBox message={sys.error} onRetry={sys.reload} /></div>
        ) : !sys.data ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-20" />)}</div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <HealthCard name="Service Zalo OA" status={sys.data.service} />
            <HealthCard name="PostgreSQL" status={sys.data.database} />
            <HealthCard name="Redis" status={sys.data.redis} />
            <HealthCard name="Chat App" status={sys.data.chat} />
            <HealthCard name="Worker" status={sys.data.worker} />
          </div>
        )}
      </section>

      {/* Hàng đợi Webhook */}
      <section className="mb-6" aria-label="Hàng đợi webhook">
        <h2 className="mb-3 text-sm font-semibold text-muted">Hàng đợi Webhook</h2>
        {queue.error ? (
          <div className="card"><ErrorBox message={queue.error} onRetry={queue.reload} /></div>
        ) : !queue.data ? (
          <div className="skeleton h-24" />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="card p-4">
              <p className="text-xs text-muted">Đang chờ (Pending)</p>
              <p className="num mt-1 text-2xl font-semibold">{fmtNum(queue.data.pending)}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-muted">Đang xử lý</p>
              <p className="num mt-1 text-2xl font-semibold">{fmtNum(queue.data.processing)}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-muted">Thất bại (DLQ)</p>
              <p className={`num mt-1 text-2xl font-semibold ${queue.data.failed > 0 ? 'text-danger' : ''}`}>
                {fmtNum(queue.data.failed)}
              </p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-muted">Worker</p>
              <p className={`mt-1 flex items-center gap-1.5 text-sm font-semibold ${queue.data.worker_active ? 'text-ok' : 'text-danger'}`}>
                <Activity className="h-4 w-4" aria-hidden />
                {queue.data.worker_active ? 'Đang chạy' : 'Ngừng hoạt động'}
              </p>
              <p className="mt-1 text-xs text-muted">Thành công gần nhất: {fmtAgo(queue.data.last_success_at)}</p>
            </div>
          </div>
        )}
      </section>

      {/* Danh sách Webhook lỗi */}
      <section className="card" aria-label="Webhook thất bại">
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-semibold">Sự kiện Webhook thất bại</h2>
          {failed.data && <span className="num text-xs text-muted">{fmtNum(failed.data.total)} sự kiện</span>}
        </header>
        {failed.error ? (
          <ErrorBox message={failed.error} onRetry={failed.reload} />
        ) : !failed.data ? (
          <div className="space-y-3 p-4">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-10" />)}</div>
        ) : !failed.data.events.length ? (
          <Empty title="Không có sự kiện lỗi" hint="Mọi webhook đều được xử lý thành công." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-sunken/50 text-xs text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Event ID</th>
                  <th className="px-4 py-3 font-medium">Sự kiện</th>
                  <th className="px-4 py-3 font-medium">OA ID</th>
                  <th className="px-4 py-3 font-medium">User ID</th>
                  <th className="px-4 py-3 font-medium">Thử lại</th>
                  <th className="px-4 py-3 font-medium">Thời gian</th>
                  <th className="px-4 py-3 text-right font-medium">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {failed.data.events.map((ev) => (
                  <tr key={ev.id} className="hover:bg-sunken/40">
                    <td className="px-4 py-3 font-mono text-xs">{ev.id}</td>
                    <td className="px-4 py-3">{ev.event_name}</td>
                    <td className="px-4 py-3 font-mono text-xs">{ev.oa_id}</td>
                    <td className="px-4 py-3 font-mono text-xs">{ev.user_id}</td>
                    <td className="num px-4 py-3">{ev.attempt}</td>
                    <td className="px-4 py-3 text-xs text-muted">{fmtTime(ev.queued_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-1">
                        <button
                          type="button"
                          disabled={busyId === ev.id}
                          onClick={() => handleRetry(ev.id)}
                          className="btn-ghost h-8 px-2.5 text-xs"
                          title="Thử lại"
                        >
                          <RotateCw className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={busyId === ev.id}
                          onClick={() => handleDelete(ev.id)}
                          className="btn-ghost h-8 px-2.5 text-xs text-danger hover:bg-danger/10"
                          title="Xoá"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}

