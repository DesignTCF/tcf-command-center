import { TONE_CLASS, statusTone } from '../lib/utils.js'

export function Chip({ tone = 'neutral', children }) {
  return <span className={`chip ${TONE_CLASS[tone] || TONE_CLASS.neutral}`}>{children}</span>
}

export function StatusChip({ status }) {
  if (!status) return null
  return <Chip tone={statusTone(status)}>{status}</Chip>
}

export function StatCard({ label, value, sub, tone = 'neutral', icon: Icon, onClick }) {
  const ring = {
    green: 'text-green', red: 'text-red', amber: 'text-amber',
    blue: 'text-blue', teal: 'text-teal', neutral: 'text-ink-dim',
  }[tone]
  return (
    <button
      onClick={onClick}
      className={`card p-4 text-left w-full transition-shadow ${onClick ? 'hover:shadow-pop cursor-pointer' : 'cursor-default'}`}
    >
      <div className="flex items-start justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</span>
        {Icon && <Icon size={16} className={ring} />}
      </div>
      <div className={`mt-2 text-3xl font-bold ${ring}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-ink-muted">{sub}</div>}
    </button>
  )
}

export function SectionCard({ title, count, right, children }) {
  return (
    <section className="card overflow-hidden">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface2/60">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-ink">{title}</h3>
          {count != null && (
            <span className="text-2xs font-semibold text-ink-muted bg-surface3 rounded-full px-2 py-0.5">{count}</span>
          )}
        </div>
        {right}
      </header>
      {children}
    </section>
  )
}

export function EmptyState({ children }) {
  return <div className="px-4 py-10 text-center text-sm text-ink-muted">{children}</div>
}
