import { useMemo } from 'react'
import { MapPin, Clock } from 'lucide-react'
import { useApp } from '../store/AppContext.jsx'
import { upcomingEvents, groupEventsByDay } from '../lib/derive.js'
import { fmtDate, toDate, daysUntil } from '../lib/utils.js'
import { StatCard, SectionCard, EmptyState } from '../components/ui.jsx'

function timeLabel(e) {
  const d = toDate(e.start)
  if (!d) return null
  // All-day events come through as YYYY-MM-DD (no time component).
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(e.start))) return 'All day'
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function dayHeading(key) {
  const n = daysUntil(key)
  if (n === 0) return 'Today'
  if (n === 1) return 'Tomorrow'
  return fmtDate(key, { weekday: true })
}

export default function Calendar() {
  const { calendar } = useApp()
  const upcoming = useMemo(() => upcomingEvents(calendar, 90), [calendar])
  const thisWeek = useMemo(() => upcomingEvents(calendar, 7), [calendar])
  const days = useMemo(() => groupEventsByDay(upcoming), [upcoming])

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard label="This week" value={thisWeek.length} tone="teal" sub="events in next 7 days" />
        <StatCard label="Next 90 days" value={upcoming.length} tone="blue" sub="upcoming events" />
        <StatCard label="Next up" value={upcoming[0] ? dayHeading(upcoming[0].date) : '—'} tone="amber" sub={upcoming[0]?.title || 'nothing scheduled'} />
      </div>

      <SectionCard title="Upcoming schedule" count={`${upcoming.length} events`}>
        {days.length === 0 && <EmptyState>No upcoming events on the calendar.</EmptyState>}
        <div className="divide-y divide-border">
          {days.map(([key, events]) => (
            <div key={key} className="px-4 py-3">
              <div className="flex items-baseline gap-2 mb-2">
                <h4 className="text-sm font-bold text-ink">{dayHeading(key)}</h4>
                <span className="text-2xs text-ink-muted">{fmtDate(key)}</span>
              </div>
              <ul className="space-y-2">
                {events.map((e, i) => (
                  <li key={e.id || i} className="flex gap-3">
                    <span className="mt-0.5 w-1 rounded-full shrink-0" style={{ backgroundColor: e.color || '#0D9E9E' }} />
                    <div className="min-w-0">
                      <p className="text-sm text-ink leading-snug">{e.title || '(untitled)'}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-2xs text-ink-muted">
                        <span className="inline-flex items-center gap-1"><Clock size={11} />{timeLabel(e)}</span>
                        {e.location && <span className="inline-flex items-center gap-1"><MapPin size={11} />{e.location}</span>}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  )
}
