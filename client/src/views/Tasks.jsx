import { useMemo, useState } from 'react'
import { ExternalLink, ChevronDown, ChevronRight, Search } from 'lucide-react'
import { useApp } from '../store/AppContext.jsx'
import { tasksBySource, taskStats } from '../lib/derive.js'
import { priorityTone, fmtDate } from '../lib/utils.js'
import { Chip, StatCard, SectionCard, EmptyState } from '../components/ui.jsx'

function TaskRow({ t }) {
  return (
    <li className="group flex items-start gap-3 px-4 py-2.5 border-t border-border/70 first:border-t-0 hover:bg-surface2/50">
      <span className={`mt-1 w-3.5 h-3.5 rounded-full shrink-0 border-2 ${t.done ? 'bg-green border-green' : 'border-border2'}`} />
      <div className="min-w-0 flex-1">
        <a
          href={t.url}
          target="_blank"
          rel="noreferrer"
          className={`text-sm leading-snug inline-flex items-start gap-1 hover:text-teal-dim hover:underline ${t.done ? 'line-through text-ink-muted' : 'text-ink'}`}
        >
          {t.title}
          <ExternalLink size={12} className="mt-0.5 shrink-0 opacity-0 group-hover:opacity-60" />
        </a>
        {t.details?.length > 0 && (
          <ul className="mt-1 ml-1 space-y-0.5">
            {t.details.map((d, i) => (
              <li key={i} className="text-xs text-ink-muted flex gap-1.5"><span className="text-border2">→</span>{d}</li>
            ))}
          </ul>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {t.group && <span className="text-2xs font-medium text-ink-muted uppercase tracking-wide">{t.group}</span>}
          {t.priority && <Chip tone={priorityTone(t.priority)}>{t.priority}</Chip>}
          {t.dueDate && <span className="text-2xs text-ink-muted">Due {fmtDate(t.dueDate)}</span>}
          {t.assignee && <span className="text-2xs text-ink-muted">· {t.assignee}</span>}
        </div>
      </div>
    </li>
  )
}

export default function Tasks() {
  const { tasks } = useApp()
  const [q, setQ] = useState('')
  const [showDone, setShowDone] = useState(false)
  const [collapsed, setCollapsed] = useState({})
  const stats = useMemo(() => taskStats(tasks), [tasks])

  const groups = useMemo(() => {
    const query = q.trim().toLowerCase()
    return tasksBySource(tasks)
      .map(g => ({
        ...g,
        items: g.items.filter(t =>
          (showDone || !t.done) &&
          (!query || t.title.toLowerCase().includes(query) || (t.group || '').toLowerCase().includes(query)),
        ),
      }))
      .filter(g => g.items.length)
  }, [tasks, q, showDone])

  const toggle = (s) => setCollapsed(c => ({ ...c, [s]: !c[s] }))

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Open tasks" value={stats.open} tone="amber" />
        <StatCard label="High priority" value={stats.high.length} tone="red" />
        <StatCard label="Completed" value={stats.done} tone="green" />
        <StatCard label="All to-dos" value={stats.total} tone="teal" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search tasks…"
            className="w-full pl-9 pr-3 py-2 text-sm bg-surface border border-border rounded-lg focus:outline-none focus:border-teal"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-ink-dim select-none cursor-pointer">
          <input type="checkbox" checked={showDone} onChange={e => setShowDone(e.target.checked)} className="accent-teal" />
          Show completed
        </label>
      </div>

      <div className="space-y-4">
        {groups.length === 0 && <EmptyState>No tasks match your search.</EmptyState>}
        {groups.map(g => {
          const isCollapsed = collapsed[g.source]
          return (
            <SectionCard
              key={g.source}
              title={
                <button onClick={() => toggle(g.source)} className="flex items-center gap-1.5">
                  {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                  {g.source}
                </button>
              }
              count={`${g.items.filter(i => !i.done).length} open`}
              right={g.url && (
                <a href={g.url} target="_blank" rel="noreferrer" className="btn-ghost text-xs">
                  <ExternalLink size={13} /> Open in Drive
                </a>
              )}
            >
              {!isCollapsed && <ul>{g.items.map(t => <TaskRow key={t.id} t={t} />)}</ul>}
            </SectionCard>
          )
        })}
      </div>
    </div>
  )
}
