import { ChevronRight, Globe, MessageCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Empty, ErrorBox, PageHeader, fmtAgo, fmtNum } from '../components/ui'
import { useAsync } from '../hooks/useAsync'
import { api, type Source } from '../lib/api'

function Group({ title, icon: Icon, items, empty }: { title: string; icon: typeof Globe; items: Source[]; empty: string }) {
  return (
    <section className="card" aria-label={title}>
      <header className="flex items-center gap-2 border-b border-line px-5 py-4">
        <Icon className="h-5 w-5 text-muted" aria-hidden />
        <h2 className="font-semibold">{title}</h2>
        <span className="num ml-auto text-sm text-muted">{items.length}</span>
      </header>
      {!items.length ? (
        <Empty title={empty} />
      ) : (
        <ul className="divide-y divide-line">
          {items.map((s) => (
            <li key={s.source}>
              <Link to={`/conversations?source=${encodeURIComponent(s.source)}`}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-4 hover:bg-sunken sm:grid-cols-[minmax(0,1fr)_100px_100px_130px_20px]">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium" title={s.name}>{s.name}</p>
                  <p className="truncate text-xs text-muted">
                    {s.kind === 'zalo'
                      ? [s.department_name, s.enabled ? 'Trợ lý đang bật' : 'Trợ lý đang tắt'].filter(Boolean).join(' · ')
                      : 'Widget nhúng trên cổng'}
                  </p>
                </div>
                <div className="hidden text-right sm:block">
                  <p className="num text-sm font-medium">{fmtNum(s.conversations)}</p>
                  <p className="text-xs text-muted">hội thoại</p>
                </div>
                <div className="hidden text-right sm:block">
                  <p className="num text-sm font-medium">{fmtNum(s.messages)}</p>
                  <p className="text-xs text-muted">tin nhắn</p>
                </div>
                <p className="text-right text-xs text-muted">{fmtAgo(s.last_message_at)}</p>
                <ChevronRight className="hidden h-4 w-4 text-muted sm:block" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default function Sources() {
  const { data, error, reload } = useAsync(api.sources, [])
  return (
    <>
      <PageHeader title="Nguồn chatbot" desc="Mỗi cổng thông tin nhúng widget và mỗi Zalo OA là một nguồn. Chọn một nguồn để xem hội thoại của nguồn đó." />
      {error ? (
        <div className="card"><ErrorBox message={error} onRetry={reload} /></div>
      ) : !data ? (
        <div className="grid gap-6">{[0, 1].map((i) => <div key={i} className="skeleton h-48" />)}</div>
      ) : (
        <div className="grid gap-6">
          <Group title="Cổng thông tin điện tử" icon={Globe} items={data.filter((s) => s.kind === 'web')}
            empty="Chưa ghi nhận cổng nào. Nguồn web tự xuất hiện khi có người hỏi qua widget." />
          <Group title="Zalo Official Account" icon={MessageCircle} items={data.filter((s) => s.kind === 'zalo')}
            empty="Chưa có Zalo OA nào được kết nối." />
        </div>
      )}
    </>
  )
}
