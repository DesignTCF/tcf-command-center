import { useMemo } from 'react'
import { ExternalLink, Truck, FlaskConical, AlertTriangle, PackageCheck } from 'lucide-react'
import { useApp } from '../store/AppContext.jsx'
import { inventoryStats } from '../lib/derive.js'
import { statusTone, TONE_CLASS } from '../lib/utils.js'
import { StatCard, SectionCard, EmptyState, Chip } from '../components/ui.jsx'

function Cell({ column, value, statusKey, isFirst }) {
  const v = String(value ?? '').trim()
  const base = `px-3 py-2 align-top ${isFirst ? 'font-medium text-ink whitespace-nowrap' : ''}`
  if (!v) return <td className={`${base} text-ink-muted/50`}>—</td>
  if (column === statusKey) {
    return <td className={base}><span className={`chip ${TONE_CLASS[statusTone(v)]}`}>{v}</span></td>
  }
  const isNotes = /notes|feedback|confirm/i.test(column)
  return <td className={`${base} ${isNotes ? 'text-ink-muted min-w-[220px] max-w-[320px]' : 'text-ink'}`}>{v}</td>
}

function TrackerTable({ tab }) {
  if (!tab.rows.length) return <EmptyState>No entries yet on this tab.</EmptyState>
  const cols = tab.columns
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left text-2xs uppercase tracking-wide text-ink-muted bg-surface2">
            {cols.map(c => <th key={c} className="px-3 py-2 font-semibold whitespace-nowrap">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {tab.rows.map((row, i) => (
            <tr key={i} className="border-t border-border/70 hover:bg-surface2/50">
              {cols.map((c, j) => (
                <Cell key={c} column={c} value={row[c]} statusKey={tab.statusKey} isFirst={j === 0} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function Inventory() {
  const { inventory } = useApp()
  const stats = useMemo(() => inventoryStats(inventory), [inventory])
  const tabs = inventory?.tabs || []

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Incoming orders" value={stats.incomingOrders} tone="amber" icon={Truck} sub="ordered / in transit" />
        <StatCard label="Samples incoming" value={stats.incomingSamples} tone="blue" icon={FlaskConical} sub="requested or shipped" />
        <StatCard label="Needs follow-up" value={stats.followUps} tone="red" icon={AlertTriangle} sub="issues / delays" />
        <StatCard label="Delivered" value={stats.delivered} tone="green" icon={PackageCheck} sub="completed items" />
      </div>

      {stats.followUpRows.length > 0 && (
        <SectionCard title="⚠ Needs your attention" count={stats.followUpRows.length}>
          <ul className="divide-y divide-border">
            {stats.followUpRows.map((f, i) => {
              const name = f.row['Supplier / Company'] || f.row['Brand'] || f.row['Item Ordered'] || 'Item'
              const item = f.row['Item Ordered'] || f.row['Product / Component'] || f.row['Product / Description'] || ''
              return (
                <li key={i} className="px-4 py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-ink truncate">{name}{item && <span className="text-ink-muted"> · {item}</span>}</p>
                    <span className="text-2xs text-ink-muted">{f.tab}</span>
                  </div>
                  <Chip tone={statusTone(f.row[f.statusKey])}>{f.row[f.statusKey]}</Chip>
                </li>
              )
            })}
          </ul>
        </SectionCard>
      )}

      {tabs.length === 0 && <EmptyState>Supplier Tracker data will appear here after the next refresh.</EmptyState>}

      {tabs.map(tab => (
        <SectionCard
          key={tab.key}
          title={tab.label}
          count={`${tab.rows.length} ${tab.rows.length === 1 ? 'entry' : 'entries'}`}
          right={inventory.trackerUrl && (
            <a href={inventory.trackerUrl} target="_blank" rel="noreferrer" className="btn-ghost text-xs">
              <ExternalLink size={13} /> Open Tracker
            </a>
          )}
        >
          <TrackerTable tab={tab} />
        </SectionCard>
      ))}
    </div>
  )
}
