import { useMemo } from 'react'
import { ExternalLink, Package2, CheckCircle2, Loader, Users } from 'lucide-react'
import { useApp } from '../store/AppContext.jsx'
import { clientsByBrand, clientStats, productProgress } from '../lib/derive.js'
import { statusTone, TONE_CLASS } from '../lib/utils.js'
import { StatCard, SectionCard, EmptyState } from '../components/ui.jsx'

function StageChip({ label, status }) {
  const done = /complet|deliver|receiv|approved|done/i.test(status)
  if (!status) {
    return (
      <div className="flex flex-col items-center gap-1 min-w-[74px]">
        <span className="text-2xs font-semibold uppercase tracking-wide text-ink-muted/70">{label}</span>
        <span className="chip bg-surface3 text-ink-muted/60">—</span>
      </div>
    )
  }
  return (
    <div className="flex flex-col items-center gap-1 min-w-[74px]">
      <span className="text-2xs font-semibold uppercase tracking-wide text-ink-muted">{label}</span>
      <span className={`chip ${TONE_CLASS[statusTone(status)]}`}>
        {done && <CheckCircle2 size={10} />}{status}
      </span>
    </div>
  )
}

function ProductRow({ p }) {
  const prog = useMemo(() => productProgress(p), [p])
  const complete = prog.total > 0 && prog.doneCount === prog.total
  return (
    <li className="px-4 py-3 border-t border-border/70 first:border-t-0">
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">{p.name}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-2xs text-ink-muted">
            {p.productType && <span>{p.productType}</span>}
            {p.size && <span>· {p.size}</span>}
            {p.bottleType && <span>· {p.bottleType}</span>}
            {p.upc && <span>· UPC {p.upc}</span>}
          </div>
        </div>
        <span className={`chip shrink-0 ${complete ? 'bg-green-soft text-green' : 'bg-amber-soft text-amber'}`}>
          {complete ? 'Ready' : `${prog.doneCount}/${prog.total} done`}
        </span>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {prog.stages.map(s => <StageChip key={s.key} label={s.key} status={s.status} />)}
      </div>
    </li>
  )
}

export default function Clients() {
  const { clients } = useApp()
  const stats = useMemo(() => clientStats(clients), [clients])
  const brands = useMemo(() => clientsByBrand(clients), [clients])

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Products" value={stats.total} tone="teal" icon={Package2} sub="in the pipeline" />
        <StatCard label="Ready" value={stats.ready} tone="green" icon={CheckCircle2} sub="all stages done" />
        <StatCard label="In development" value={stats.inDev} tone="amber" icon={Loader} sub="stages remaining" />
        <StatCard label="Client brands" value={stats.brands} tone="blue" icon={Users} sub="active" />
      </div>

      {brands.length === 0 && <EmptyState>Client Status Tracker data will appear here after the next refresh.</EmptyState>}

      {brands.map(b => (
        <SectionCard
          key={b.brand}
          title={b.brand}
          count={`${b.products.length} ${b.products.length === 1 ? 'product' : 'products'}`}
          right={
            <div className="flex items-center gap-3">
              {b.client && <span className="text-2xs text-ink-muted">{b.client}</span>}
              {clients.trackerUrl && (
                <a href={clients.trackerUrl} target="_blank" rel="noreferrer" className="btn-ghost text-xs">
                  <ExternalLink size={13} /> Open Tracker
                </a>
              )}
            </div>
          }
        >
          <ul>{b.products.map((p, i) => <ProductRow key={i} p={p} />)}</ul>
        </SectionCard>
      ))}
    </div>
  )
}
