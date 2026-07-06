import { useMemo } from 'react'
import { CheckSquare, CalendarDays, Truck, AlertTriangle, ArrowRight, MapPin, FlaskConical } from 'lucide-react'
import { useApp } from '../store/AppContext.jsx'
import { taskStats, upcomingEvents, inventoryStats, incomingItems } from '../lib/derive.js'
import { fmtDate, toDate, daysUntil, priorityTone } from '../lib/utils.js'
import { StatCard, SectionCard, EmptyState, Chip, StatusChip } from '../components/ui.jsx'

function dayLabel(v) {
  const n = daysUntil(v)
  if (n === 0) return 'Today'
  if (n === 1) return 'Tomorrow'
  if (n != null && n > 1 && n < 7) return toDate(v)?.toLocaleDateString([], { weekday: 'short' })
  return fmtDate(v)
}

export default function Overview({ onNavigate }) {
  const { tasks, calendar, inventory } = useApp()
  const tStats = useMemo(() => taskStats(tasks), [tasks])
  const iStats = useMemo(() => inventoryStats(inventory), [inventory])
  const incoming = useMemo(() => incomingItems(inventory), [inventory])
  const thisWeek = useMemo(() => upcomingEvents(calendar, 7), [calendar])
  const upcoming = useMemo(() => upcomingEvents(calendar, 30), [calendar])

  // Urgent = supplier issues/delays + high-priority tasks.
  const attention = useMemo(() => {
    const items = []
    for (const f of iStats.followUpRows) {
      items.push({
        kind: 'supplier',
        title: f.row['Supplier / Company'] || f.row['Brand'] || f.row['Item Ordered'] || 'Supplier item',
        sub: `${f.tab}`,
        status: f.row[f.statusKey],
      })
    }
    for (const t of tStats.high) items.push({ kind: 'task', title: t.title, sub: t.sourceName, status: t.priority, url: t.url })
    return items
  }, [iStats, tStats])

  return (
    <div className="space-y-5">
      {/* Urgent + upcoming headline numbers */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Needs follow-up" value={iStats.followUps} tone="red" icon={AlertTriangle}
          sub="supplier issues / delays" onClick={() => onNavigate('inventory')} />
        <StatCard label="Arriving soon" value={incoming.length} tone="amber" icon={Truck}
          sub="orders & samples in progress" onClick={() => onNavigate('inventory')} />
        <StatCard label="Events this week" value={thisWeek.length} tone="teal" icon={CalendarDays}
          sub="next 7 days" onClick={() => onNavigate('calendar')} />
        <StatCard label="Open to-dos" value={tStats.open} tone="blue" icon={CheckSquare}
          sub={tStats.high.length ? `${tStats.high.length} high priority` : 'across all lists'} onClick={() => onNavigate('tasks')} />
      </div>

      {/* Needs attention — only shows when there's something urgent */}
      {attention.length > 0 && (
        <SectionCard title="⚠ Needs attention" count={attention.length}>
          <ul className="divide-y divide-border">
            {attention.slice(0, 8).map((a, i) => (
              <li key={i} className="px-4 py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-ink truncate">
                    {a.url ? <a href={a.url} target="_blank" rel="noreferrer" className="hover:text-teal-dim hover:underline">{a.title}</a> : a.title}
                  </p>
                  <span className="text-2xs text-ink-muted">{a.sub}</span>
                </div>
                <StatusChip status={a.status} />
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Coming up — calendar */}
        <SectionCard
          title="Coming up"
          right={<button onClick={() => onNavigate('calendar')} className="btn-ghost text-xs">Calendar <ArrowRight size={13} /></button>}
        >
          {upcoming.length === 0 && <EmptyState>Nothing scheduled in the next 30 days.</EmptyState>}
          <ul className="divide-y divide-border">
            {upcoming.slice(0, 6).map((e, i) => (
              <li key={e.id || i} className="px-4 py-2.5 flex items-center gap-3">
                <div className="w-12 shrink-0 text-2xs font-semibold uppercase text-ink-muted">{dayLabel(e.date)}</div>
                <span className="w-1 self-stretch rounded-full" style={{ backgroundColor: e.color || '#0D9E9E' }} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink truncate">{e.title || '(untitled)'}</p>
                  {e.location && <span className="text-2xs text-ink-muted inline-flex items-center gap-1"><MapPin size={10} />{e.location}</span>}
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>

        {/* Incoming orders & samples */}
        <SectionCard
          title="Incoming orders & samples"
          count={incoming.length}
          right={<button onClick={() => onNavigate('inventory')} className="btn-ghost text-xs">Inventory <ArrowRight size={13} /></button>}
        >
          {incoming.length === 0 && <EmptyState>Nothing currently in transit.</EmptyState>}
          <ul className="divide-y divide-border">
            {incoming.slice(0, 6).map((it, i) => (
              <li key={i} className="px-4 py-2.5 flex items-center gap-3">
                <FlaskConical size={14} className="text-ink-muted shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink truncate">{it.name}{it.item && <span className="text-ink-muted"> · {it.item}</span>}</p>
                  <span className="text-2xs text-ink-muted">{it.tab}{it.eta ? ` · arrives ${fmtDate(it.eta)}` : ''}</span>
                </div>
                <StatusChip status={it.status} />
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>
    </div>
  )
}
