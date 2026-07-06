import { useMemo } from 'react'
import { CheckSquare, CalendarDays, Truck, AlertTriangle, ArrowRight, MapPin } from 'lucide-react'
import { useApp } from '../store/AppContext.jsx'
import { taskStats, upcomingEvents, inventoryStats } from '../lib/derive.js'
import { fmtDate, toDate, daysUntil, priorityTone } from '../lib/utils.js'
import { StatCard, SectionCard, EmptyState, Chip } from '../components/ui.jsx'

function dayLabel(v) {
  const n = daysUntil(v)
  if (n === 0) return 'Today'
  if (n === 1) return 'Tomorrow'
  if (n != null && n > 1 && n < 7) return toDate(v)?.toLocaleDateString([], { weekday: 'long' })
  return fmtDate(v)
}

export default function Overview({ onNavigate }) {
  const { tasks, calendar, inventory } = useApp()
  const tStats = useMemo(() => taskStats(tasks), [tasks])
  const iStats = useMemo(() => inventoryStats(inventory), [inventory])
  const upcoming = useMemo(() => upcomingEvents(calendar, 30), [calendar])
  const thisWeek = useMemo(() => upcomingEvents(calendar, 7), [calendar])
  const priorityTasks = useMemo(
    () => (tStats.high.length ? tStats.high : tasks.filter(t => !t.done)).slice(0, 6),
    [tStats, tasks],
  )

  return (
    <div className="space-y-5">
      {/* Headline numbers across the whole operation */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Open tasks" value={tStats.open} tone="amber" icon={CheckSquare}
          sub={`${tStats.high.length} high priority`} onClick={() => onNavigate('tasks')} />
        <StatCard label="Events this week" value={thisWeek.length} tone="teal" icon={CalendarDays}
          sub="next 7 days" onClick={() => onNavigate('calendar')} />
        <StatCard label="Incoming orders & samples" value={iStats.incomingOrders + iStats.incomingSamples} tone="blue" icon={Truck}
          sub={`${iStats.incomingOrders} orders · ${iStats.incomingSamples} samples`} onClick={() => onNavigate('inventory')} />
        <StatCard label="Needs follow-up" value={iStats.followUps} tone="red" icon={AlertTriangle}
          sub="supplier issues / delays" onClick={() => onNavigate('inventory')} />
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Coming up */}
        <SectionCard
          title="Coming up"
          right={<button onClick={() => onNavigate('calendar')} className="btn-ghost text-xs">View all <ArrowRight size={13} /></button>}
        >
          {upcoming.length === 0 && <EmptyState>Nothing scheduled in the next 30 days.</EmptyState>}
          <ul className="divide-y divide-border">
            {upcoming.slice(0, 6).map((e, i) => (
              <li key={e.id || i} className="px-4 py-2.5 flex items-center gap-3">
                <div className="w-14 shrink-0 text-center">
                  <div className="text-2xs font-semibold uppercase text-ink-muted">{dayLabel(e.date)}</div>
                </div>
                <span className="w-1 self-stretch rounded-full" style={{ backgroundColor: e.color || '#0D9E9E' }} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink truncate">{e.title || '(untitled)'}</p>
                  {e.location && (
                    <span className="text-2xs text-ink-muted inline-flex items-center gap-1"><MapPin size={10} />{e.location}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>

        {/* Priority tasks */}
        <SectionCard
          title={tStats.high.length ? 'High-priority tasks' : 'Open tasks'}
          right={<button onClick={() => onNavigate('tasks')} className="btn-ghost text-xs">View all <ArrowRight size={13} /></button>}
        >
          {priorityTasks.length === 0 && <EmptyState>You're all caught up. 🎉</EmptyState>}
          <ul className="divide-y divide-border">
            {priorityTasks.map(t => (
              <li key={t.id} className="px-4 py-2.5 flex items-start gap-3">
                <span className="mt-1 w-3 h-3 rounded-full border-2 border-border2 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink leading-snug">{t.title}</p>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className="text-2xs text-ink-muted">{t.sourceName}</span>
                    {t.priority && <Chip tone={priorityTone(t.priority)}>{t.priority}</Chip>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      {/* Supplier follow-ups (only if any) */}
      {iStats.followUpRows.length > 0 && (
        <SectionCard
          title="⚠ Supplier items needing attention"
          count={iStats.followUpRows.length}
          right={<button onClick={() => onNavigate('inventory')} className="btn-ghost text-xs">Go to Inventory <ArrowRight size={13} /></button>}
        >
          <ul className="divide-y divide-border">
            {iStats.followUpRows.slice(0, 5).map((f, i) => {
              const name = f.row['Supplier / Company'] || f.row['Brand'] || f.row['Item Ordered'] || 'Item'
              return (
                <li key={i} className="px-4 py-2.5 flex items-center justify-between gap-3">
                  <p className="text-sm text-ink truncate">{name} <span className="text-2xs text-ink-muted">· {f.tab}</span></p>
                  <Chip tone="red">{f.row[f.statusKey]}</Chip>
                </li>
              )
            })}
          </ul>
        </SectionCard>
      )}
    </div>
  )
}
