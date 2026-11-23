import {
  CategoryScale, Chart as ChartJS, Filler, Legend, LinearScale, LineElement, PointElement, Tooltip,
} from 'chart.js'
import { ArrowRight, MessageSquare, TrendingDown, TrendingUp } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { Line } from 'react-chartjs-2'
import { Link } from 'react-router-dom'
import { ErrorBox, Empty, PageHeader, Segmented, SourceBadge, StatusPill, fmtAgo, fmtNum, sourceOf } from '../components/ui'
import { useAsync } from '../hooks/useAsync'
import { api, type DailyPoint, type Overview as OverviewData, type Source } from '../lib/api'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler)

const css = (v: string) => `rgb(${getComputedStyle(document.documentElement).getPropertyValue(v).trim()})`

/** Nhãn ngày (YYYY-MM-DD, giờ VN) từ `from` ngày trước đến `to` ngày trước. */
function dayLabels(from: number, to: number) {
  const out: string[] = []
  for (let i = from - 1; i >= to; i--) {
    out.push(new Date(Date.now() - i * 86400000).toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }))
  }
  return out
}

function useDaily(days: number) {
  const q = useAsync(() => api.daily(days * 2), [days])
  const view = useMemo(() => {
    if (!q.data) return null
    const sum = (labels: string[], kind?: string) =>
      q.data!.filter((p: DailyPoint) => labels.includes(p.day) && (!kind || p.kind === kind)).reduce((a, p) => a + p.count, 0)
    const cur = dayLabels(days, 0), prev = dayLabels(days * 2, days)
    const pick = (kind: string) => cur.map((l) => q.data!.find((p) => p.day === l && p.kind === kind)?.count || 0)
    const total = sum(cur), before = sum(prev)
    return {
      labels: cur, web: pick('web'), zalo: pick('zalo'), total, before,
      delta: before ? Math.round(((total - before) / before) * 100) : null,
    }
  }, [q.data, days])
  return { ...q, view }
}

function Kpi({ label, value, hint, trend }: { label: string; value?: number | string; hint?: ReactNode; trend?: number | null }) {
  return (
    <div className="card p-5">
      <p className="text-sm text-muted">{label}</p>
      {value === undefined ? (
        <div className="skeleton mt-2 h-8 w-24" />
      ) : (
        <div className="mt-1 flex items-baseline gap-2">
          <p className="num text-3xl font-semibold tracking-tight">{typeof value === 'number' ? fmtNum(value) : value}</p>
          {trend != null && (
            <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${trend >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
              {trend >= 0 ? <TrendingUp className="h-3.5 w-3.5" aria-hidden /> : <TrendingDown className="h-3.5 w-3.5" aria-hidden />}
              {trend > 0 ? '+' : ''}{trend}%
            </span>
          )}
        </div>
      )}
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  )
}

function DailyChart({ view, days }: { view: NonNullable<ReturnType<typeof useDaily>['view']>; days: number }) {
  if (!view.total) return <Empty title="Chưa có câu hỏi nào trong khoảng này" hint="Số liệu sẽ xuất hiện khi người dân bắt đầu hỏi trên cổng web hoặc Zalo OA." />
  const accent = css('--accent'), zalo = css('--zalo'), grid = css('--line'), muted = css('--muted')
  return (
    <div className="h-64">
      <Line
        data={{
          labels: view.labels.map((l) => l.slice(8, 10) + '/' + l.slice(5, 7)),
          datasets: [
            { label: 'Cổng web', data: view.web, borderColor: accent, backgroundColor: accent, tension: 0.3, pointRadius: 2 },
            { label: 'Zalo OA', data: view.zalo, borderColor: zalo, backgroundColor: zalo, borderDash: [5, 4], tension: 0.3, pointRadius: 2 },
          ],
        }}
        aria-label={`Biểu đồ số câu hỏi theo ngày trong ${days} ngày, tổng ${view.total}`}
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

function Row({ label, value, tone }: { label: string; value: ReactNode; tone?: 'ok' | 'warn' | 'bad' }) {
  const color = tone === 'bad' ? 'text-red-600 dark:text-red-400' : tone === 'warn' ? 'text-amber-600 dark:text-amber-400' : tone === 'ok' ? 'text-emerald-600 dark:text-emerald-400' : ''
  return (
    <div className="flex items-center justify-between gap-3 py-2 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className={`num font-medium ${color}`}>{value}</dd>
    </div>
  )
}

function Health({ data }: { data?: OverviewData }) {
  if (!data) return <div className="space-y-3 p-5">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-6" />)}</div>
  const { oas, queues: q, agents } = data
  return (
    <div className="px-5 pb-4">
      <dl className="divide-y divide-line">
        <Row label="Worker xử lý Zalo" value={q.worker_active ? 'Đang chạy' : 'Không hoạt động'} tone={q.worker_active ? 'ok' : 'bad'} />
        <Row label="Chờ / đang xử lý" value={`${fmtNum(q.pending)} / ${fmtNum(q.processing)}`} tone={q.pending > 20 ? 'warn' : undefined} />
        <Row label="Sự kiện lỗi" value={fmtNum(q.failed)} tone={q.failed ? 'bad' : 'ok'} />
        <Row label="OA đã kết nối" value={`${oas.connected}/${oas.total}`} tone={oas.connected < oas.total ? 'warn' : undefined} />
        <Row label="OA bật trợ lý" value={`${oas.active}/${oas.total}`} />
        <Row label="Webhook đã xác minh" value={`${oas.webhook_verified}/${oas.total}`} tone={oas.webhook_verified < oas.total ? 'warn' : undefined} />
        <Row label="Trợ lý ảo (agent)" value={fmtNum(agents.total)} />
      </dl>
      {q.last_success_at > 0 && <p className="mt-2 text-xs text-muted">Xử lý thành công gần nhất {fmtAgo(q.last_success_at)}</p>}
    </div>
  )
}

function Channels({ sources }: { sources?: Source[] }) {
  if (!sources) return <div className="space-y-3 p-5">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-8" />)}</div>
  const active = sources.filter((s) => s.conversations)
  if (!active.length) return <Empty title="Chưa có nguồn nào phát sinh hội thoại" />
  const web = active.filter((s) => s.kind === 'web').reduce((a, s) => a + s.conversations, 0)
  const zalo = active.filter((s) => s.kind === 'zalo').reduce((a, s) => a + s.conversations, 0)
  const all = web + zalo, max = Math.max(...active.map((s) => s.conversations))
  const pct = (n: number) => Math.round((n / all) * 100)
  return (
    <>
      <div className="px-5 pb-4">
        <div className="flex h-2.5 overflow-hidden rounded-full bg-sunken" role="img" aria-label={`Cổng web ${pct(web)}%, Zalo OA ${pct(zalo)}%`}>
          <div className="bg-accent" style={{ width: `${pct(web)}%` }} />
          <div className="bg-zalo" style={{ width: `${pct(zalo)}%` }} />
        </div>
        <div className="mt-2 flex justify-between text-xs text-muted">
          <span><span className="num font-medium text-ink">{pct(web)}%</span> cổng web ({fmtNum(web)})</span>
          <span><span className="num font-medium text-ink">{pct(zalo)}%</span> Zalo OA ({fmtNum(zalo)})</span>
        </div>
      </div>
      <ul className="divide-y divide-line border-t border-line">
        {active.slice(0, 5).map((s) => (
          <li key={s.source}>
            <Link to={`/conversations?source=${encodeURIComponent(s.source)}`} className="block px-5 py-3 hover:bg-sunken">
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0"><SourceBadge kind={s.kind} label={s.name} /></span>
                <span className="num shrink-0 text-sm font-medium">{fmtNum(s.conversations)}</span>
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full">
                <div className={`h-full rounded-full ${s.kind === 'zalo' ? 'bg-zalo' : 'bg-accent'}`} style={{ width: `${(s.conversations / max) * 100}%` }} />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}

export default function Overview() {
  const [days, setDays] = useState(14)
  const ov = useAsync(api.overview, [])
  const src = useAsync(api.sources, [])
  const recent = useAsync(() => api.conversations({ limit: 8 }), [])
  const daily = useDaily(days)

  const web = src.data?.filter((s) => s.kind === 'web' && s.conversations).length
  const zalo = src.data?.filter((s) => s.kind === 'zalo' && s.conversations).length
  const nameOf = (key: string) => src.data?.find((s) => s.source === key)?.name || key.replace(/^web:/, '')
  const c = ov.data?.conversations

  return (
    <>
      <PageHeader title="Tổng quan" desc="Hoạt động của trợ lý ảo trên các cổng thông tin điện tử và Zalo OA." />

      {ov.error ? (
        <div className="card mb-6"><ErrorBox message={ov.error} onRetry={ov.reload} /></div>
      ) : (
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Kpi label="Tổng hội thoại" value={c?.total} hint={c && `Gần nhất ${fmtAgo(c.last_message_at)}`} />
          <Kpi label={`Câu hỏi ${days} ngày qua`} value={daily.view?.total} trend={daily.view?.delta}
            hint={daily.view && `Kỳ trước: ${fmtNum(daily.view.before)}`} />
          <Kpi label="TB tin nhắn / hội thoại" value={c && (c.total ? (c.messages / c.total).toFixed(1).replace('.', ',') : '0')}
            hint={c && `${fmtNum(c.messages)} tin nhắn`} />
          <Kpi label="Nguồn có hội thoại" value={web === undefined || zalo === undefined ? undefined : web + zalo}
            hint={web !== undefined && `${web} cổng web, ${zalo} Zalo OA`} />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-2" aria-labelledby="h-daily">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 id="h-daily" className="font-semibold">Câu hỏi theo ngày</h2>
            <Segmented label="Khoảng thời gian" value={days} onChange={setDays}
              options={[{ value: 7, label: '7 ngày' }, { value: 14, label: '14 ngày' }, { value: 30, label: '30 ngày' }]} />
          </div>
          {daily.error ? <ErrorBox message={daily.error} onRetry={daily.reload} />
            : !daily.view ? <div className="skeleton h-64 w-full" />
            : <DailyChart view={daily.view} days={days} />}
        </section>

        <section className="card" aria-labelledby="h-health">
          <div className="flex items-center justify-between px-5 pt-5 pb-2">
            <h2 id="h-health" className="font-semibold">Vận hành</h2>
          </div>
          {ov.error ? <ErrorBox message={ov.error} onRetry={ov.reload} /> : <Health data={ov.data} />}
        </section>

        <section className="card lg:col-span-2" aria-labelledby="h-recent">
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <h2 id="h-recent" className="font-semibold">Hội thoại gần đây</h2>
            <Link to="/conversations" className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
              Xem tất cả <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
          {recent.error ? (
            <ErrorBox message={recent.error} onRetry={recent.reload} />
          ) : !recent.data ? (
            <div className="space-y-3 px-5 pb-5">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-12" />)}</div>
          ) : !recent.data.conversations.length ? (
            <Empty title="Chưa có hội thoại" />
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {recent.data.conversations.map((c) => {
                const s = sourceOf(c)
                return (
                  <li key={c.id}>
                    <Link to={`/conversations?id=${c.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-sunken">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium" title={c.title || undefined}>
                          {c.title || <span className="text-muted">(Chưa có câu hỏi)</span>}
                        </p>
                        <div className="mt-1 flex min-w-0 items-center gap-2 text-xs text-muted">
                          <span className="truncate">{c.user?.display_name || 'Khách ẩn danh'}</span>
                          <span className="hidden min-w-0 sm:inline-flex"><SourceBadge kind={s.kind} label={nameOf(s.key)} /></span>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="text-xs text-muted">{fmtAgo(c.last_message_at)}</span>
                        <span className="flex items-center gap-2">
                          <span className="num inline-flex items-center gap-1 text-xs text-muted"><MessageSquare className="h-3.5 w-3.5" aria-hidden />{c.message_count}</span>
                          <StatusPill status={c.status} />
                        </span>
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section className="card" aria-labelledby="h-top">
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <h2 id="h-top" className="font-semibold">Phân bổ theo kênh</h2>
            <Link to="/oas" className="text-sm font-medium text-accent hover:underline">Tất cả</Link>
          </div>
          {src.error ? <ErrorBox message={src.error} onRetry={src.reload} /> : <Channels sources={src.data} />}
        </section>
      </div>
    </>
  )
}
