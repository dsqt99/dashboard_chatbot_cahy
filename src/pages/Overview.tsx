import {
  CategoryScale, Chart as ChartJS, Filler, Legend, LinearScale, LineElement, PointElement, Tooltip,
} from 'chart.js'
import { ArrowRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Line } from 'react-chartjs-2'
import { Link } from 'react-router-dom'
import { ErrorBox, Empty, PageHeader, Segmented, SourceBadge, StatusPill, fmtAgo, fmtNum, sourceOf } from '../components/ui'
import { useAsync } from '../hooks/useAsync'
import { api, type Source } from '../lib/api'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler)

const css = (v: string) => `rgb(${getComputedStyle(document.documentElement).getPropertyValue(v).trim()})`

function Kpi({ label, value, hint }: { label: string; value?: number; hint?: string }) {
  return (
    <div className="card p-5">
      <p className="text-sm text-muted">{label}</p>
      {value === undefined ? (
        <div className="skeleton mt-2 h-8 w-24" />
      ) : (
        <p className="num mt-1 text-3xl font-semibold tracking-tight">{fmtNum(value)}</p>
      )}
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  )
}

function DailyChart({ days }: { days: number }) {
  const { data, error, loading, reload } = useAsync(() => api.daily(days), [days])
  const chart = useMemo(() => {
    if (!data) return null
    const labels: string[] = []
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000)
      labels.push(d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }))
    }
    const pick = (kind: string) => labels.map((l) => data.find((p) => p.day === l && p.kind === kind)?.count || 0)
    const accent = css('--accent'), zalo = css('--zalo')
    return {
      labels: labels.map((l) => l.slice(8, 10) + '/' + l.slice(5, 7)),
      datasets: [
        { label: 'Cổng web', data: pick('web'), borderColor: accent, backgroundColor: accent, tension: 0.3, pointRadius: 2 },
        { label: 'Zalo OA', data: pick('zalo'), borderColor: zalo, backgroundColor: zalo, borderDash: [5, 4], tension: 0.3, pointRadius: 2 },
      ],
      total: pick('web').reduce((a, b) => a + b, 0) + pick('zalo').reduce((a, b) => a + b, 0),
    }
  }, [data, days])

  if (error) return <ErrorBox message={error} onRetry={reload} />
  if (loading || !chart) return <div className="skeleton h-64 w-full" />
  if (!chart.total) return <Empty title="Chưa có câu hỏi nào trong khoảng này" hint="Số liệu sẽ xuất hiện khi người dân bắt đầu hỏi trên cổng web hoặc Zalo OA." />
  const grid = css('--line'), muted = css('--muted')
  return (
    <div className="h-64">
      <Line
        data={chart}
        aria-label={`Biểu đồ số câu hỏi theo ngày trong ${days} ngày, tổng ${chart.total}`}
        options={{
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: { legend: { position: 'bottom', labels: { color: muted, usePointStyle: true, boxHeight: 6 } } },
          scales: {
            x: { grid: { display: false }, ticks: { color: muted, maxRotation: 0, autoSkipPadding: 12 } },
            y: { beginAtZero: true, grid: { color: grid }, ticks: { color: muted, precision: 0 } },
          },
        }}
      />
    </div>
  )
}

function TopSources({ sources }: { sources?: Source[] }) {
  if (!sources) return <div className="space-y-3 p-5">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-8" />)}</div>
  const top = sources.filter((s) => s.conversations).slice(0, 6)
  if (!top.length) return <Empty title="Chưa có nguồn nào phát sinh hội thoại" />
  const max = Math.max(...top.map((s) => s.conversations))
  return (
    <ul className="divide-y divide-line">
      {top.map((s) => (
        <li key={s.source}>
          <Link to={`/conversations?source=${encodeURIComponent(s.source)}`} className="block px-5 py-3 hover:bg-sunken">
            <div className="flex items-center justify-between gap-3">
              <SourceBadge kind={s.kind} label={s.name} />
              <span className="num text-sm font-medium">{fmtNum(s.conversations)}</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sunken">
              <div className={`h-full rounded-full ${s.kind === 'zalo' ? 'bg-zalo' : 'bg-accent'}`} style={{ width: `${(s.conversations / max) * 100}%` }} />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )
}

export default function Overview() {
  const [days, setDays] = useState(14)
  const ov = useAsync(api.overview, [])
  const src = useAsync(api.sources, [])
  const recent = useAsync(() => api.conversations({ limit: 8 }), [])

  const web = src.data?.filter((s) => s.kind === 'web')
  const zalo = src.data?.filter((s) => s.kind === 'zalo')
  const nameOf = (key: string) => src.data?.find((s) => s.source === key)?.name || key.replace(/^web:/, '')

  return (
    <>
      <PageHeader title="Tổng quan" desc="Hoạt động của trợ lý ảo trên các cổng thông tin điện tử và Zalo OA." />

      {ov.error ? (
        <div className="card mb-6"><ErrorBox message={ov.error} onRetry={ov.reload} /></div>
      ) : (
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Kpi label="Hội thoại" value={ov.data?.conversations.total} hint={ov.data && `Gần nhất: ${fmtAgo(ov.data.conversations.last_message_at)}`} />
          <Kpi label="Tin nhắn" value={ov.data?.conversations.messages} />
          <Kpi label="Cổng web" value={web?.length} hint="Nguồn đã phát sinh hội thoại" />
          <Kpi label="Zalo OA" value={zalo?.length} hint={zalo && `${zalo.filter((z) => z.enabled).length} OA đang bật trợ lý`} />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-2" aria-labelledby="h-daily">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 id="h-daily" className="font-semibold">Câu hỏi theo ngày</h2>
            <Segmented label="Khoảng thời gian" value={days} onChange={setDays}
              options={[{ value: 7, label: '7 ngày' }, { value: 14, label: '14 ngày' }, { value: 30, label: '30 ngày' }]} />
          </div>
          <DailyChart days={days} />
        </section>

        <section className="card" aria-labelledby="h-top">
          <div className="flex items-center justify-between px-5 pt-5 pb-2">
            <h2 id="h-top" className="font-semibold">Nguồn nhiều hội thoại</h2>
            <Link to="/sources" className="text-sm font-medium text-accent hover:underline">Tất cả</Link>
          </div>
          {src.error ? <ErrorBox message={src.error} onRetry={src.reload} /> : <TopSources sources={src.data} />}
        </section>
      </div>

      <section className="card mt-6" aria-labelledby="h-recent">
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 id="h-recent" className="font-semibold">Hội thoại gần đây</h2>
          <Link to="/conversations" className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
            Xem tất cả <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
        {recent.error ? (
          <ErrorBox message={recent.error} onRetry={recent.reload} />
        ) : !recent.data ? (
          <div className="space-y-3 px-5 pb-5">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-10" />)}</div>
        ) : !recent.data.conversations.length ? (
          <Empty title="Chưa có hội thoại" />
        ) : (
          <ul className="divide-y divide-line border-t border-line">
            {recent.data.conversations.map((c) => {
              const s = sourceOf(c)
              return (
                <li key={c.id}>
                  <Link to={`/conversations?id=${c.id}`} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-5 py-3 hover:bg-sunken sm:grid-cols-[minmax(0,1fr)_200px_110px_120px]">
                    <span className="truncate text-sm font-medium">{c.user?.display_name || c.user_id || 'Khách ẩn danh'}</span>
                    <span className="hidden min-w-0 sm:block"><SourceBadge kind={s.kind} label={nameOf(s.key)} /></span>
                    <span className="hidden sm:block"><StatusPill status={c.status} /></span>
                    <span className="text-right text-xs text-muted">{fmtAgo(c.last_message_at)}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </>
  )
}
