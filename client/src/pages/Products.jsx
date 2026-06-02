import { useState, useMemo } from 'react'
import { useApp } from '../store/AppContext'
import api from '../lib/api'
import StatusBadge from '../components/StatusBadge'
import Modal from '../components/Modal'
import EmptyState from '../components/EmptyState'

const STATUSES = [
  'Concept', 'Formulating', 'Stability Testing', 'Packaging Development',
  'Artwork Development', 'Approved', 'Production', 'Ready To Launch', 'Live', 'In Development',
]
const CATEGORIES = [
  'Serum', 'Moisturizer', 'Cleanser', 'Toner', 'SPF', 'Mask',
  'Eye Care', 'Body', 'Lip', 'Hair', 'Other',
]

// Client brands in preferred display order
const CLIENT_BRANDS = ['NeVoo', 'Daily Rou', 'Nitt Beauty', 'Devoted Man', 'Salt Spa Yoga']

const STATUS_COLORS = {
  'Ready': 'border-l-teal',
  'Ready To Launch': 'border-l-teal',
  'Approved': 'border-l-green',
  'Stability Testing': 'border-l-amber',
  'In Development': 'border-l-blue',
  'Formulating': 'border-l-blue',
  'Packaging Development': 'border-l-gold',
  'Artwork Development': 'border-l-purple',
  'Concept': 'border-l-ink-muted',
  'Production': 'border-l-green',
  'Live': 'border-l-green',
}

const BRAND_COLORS = {
  'NeVoo': '#1AADAD',
  'Daily Rou': '#B8921E',
  'Nitt Beauty': '#6644BB',
  'Devoted Man': '#3366CC',
  'Salt Spa Yoga': '#1A9E6A',
  'TCF House Brand': '#555555',
}

const BRAND_CLIENTS = {
  'NeVoo': 'Molly Smith',
  'Daily Rou': 'Meredith Baurband',
  'Nitt Beauty': 'Gamze Gurlevik',
  'Devoted Man': 'Josh Smith',
  'Salt Spa Yoga': 'Andrew Moss',
}

export default function Products() {
  const { state, dispatch } = useApp()
  const [statusFilter, setStatusFilter] = useState('All')
  const [brandTab, setBrandTab] = useState('All') // All | TCF House Brand | TCF Client
  const [clientBrandFilter, setClientBrandFilter] = useState('All') // specific client brand
  const [expandedProduct, setExpandedProduct] = useState(null)
  const [modal, setModal] = useState(null)

  const products = state.products || []

  // Count per status
  const statusCounts = useMemo(() => {
    const counts = {}
    products.forEach(p => { counts[p.status] = (counts[p.status] || 0) + 1 })
    return counts
  }, [products])

  // Count per client brand
  const clientBrandCounts = useMemo(() => {
    const counts = { All: 0 }
    products.filter(p => p.brand === 'TCF Client').forEach(p => {
      const cb = p.clientBrand || 'Other'
      counts[cb] = (counts[cb] || 0) + 1
      counts.All++
    })
    return counts
  }, [products])

  // Filtered products
  const filtered = useMemo(() => {
    return products.filter(p => {
      if (statusFilter !== 'All' && p.status !== statusFilter) return false
      if (brandTab === 'TCF House Brand' && p.brand !== 'TCF House Brand') return false
      if (brandTab === 'TCF Client') {
        if (p.brand !== 'TCF Client') return false
        if (clientBrandFilter !== 'All' && p.clientBrand !== clientBrandFilter) return false
      }
      return true
    })
  }, [products, statusFilter, brandTab, clientBrandFilter])

  // Group by clientBrand for display
  const grouped = useMemo(() => {
    if (brandTab !== 'TCF Client') {
      return { 'TCF House Brand': filtered }
    }
    // Group by brand, maintain order
    const groups = {}
    const order = clientBrandFilter !== 'All'
      ? [clientBrandFilter]
      : CLIENT_BRANDS
    order.forEach(b => { groups[b] = [] })
    filtered.forEach(p => {
      const b = p.clientBrand || 'Other'
      if (!groups[b]) groups[b] = []
      groups[b].push(p)
    })
    // Remove empty groups
    Object.keys(groups).forEach(k => { if (!groups[k].length) delete groups[k] })
    return groups
  }, [filtered, brandTab, clientBrandFilter])

  // Add product
  const addFields = [
    { id: 'name', label: 'Product Name', type: 'text', value: '', placeholder: 'e.g. Vitamin C Serum' },
    { id: 'brand', label: 'Brand Type', type: 'select', options: ['TCF House Brand', 'TCF Client'], value: 'TCF Client' },
    { id: 'clientBrand', label: 'Client Brand', type: 'text', value: '', placeholder: 'e.g. NeVoo, Daily Rou…' },
    { id: 'category', label: 'Category', type: 'select', options: CATEGORIES, value: 'Serum' },
    { id: 'status', label: 'Status', type: 'select', options: STATUSES, value: 'In Development' },
    { id: 'notes', label: 'Notes', type: 'textarea', value: '' },
  ]

  async function saveProduct(data) {
    try {
      if (modal?.product) {
        const updated = await api.patch(`/data/products/${modal.product.id}`, data)
        dispatch({ type: 'UPDATE', key: 'products', id: modal.product.id, value: updated })
      } else {
        const created = await api.post('/data/products', data)
        dispatch({ type: 'ADD', key: 'products', value: created })
      }
    } catch {
      const item = { id: Date.now().toString(), ...data }
      if (modal?.product) dispatch({ type: 'UPDATE', key: 'products', id: modal.product.id, value: data })
      else dispatch({ type: 'ADD', key: 'products', value: item })
    }
    setModal(null)
  }

  async function deleteProduct(id) {
    if (!confirm('Remove this product?')) return
    try { await api.del(`/data/products/${id}`) } catch {}
    dispatch({ type: 'DELETE', key: 'products', id })
    setExpandedProduct(null)
  }

  const totalClientBrands = Object.keys(grouped).length

  return (
    <div className="page-scroll">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold text-ink">Products</h1>
          <p className="text-sm text-ink-muted mt-0.5">{products.length} products · {Object.keys(grouped).length} brand{Object.keys(grouped).length !== 1 ? 's' : ''} shown</p>
        </div>
        <button className="btn-primary" onClick={() => setModal({})}>+ Add Product</button>
      </div>

      {/* Status pipeline strip */}
      <div className="flex gap-1.5 flex-wrap mb-4 overflow-x-auto pb-1">
        <button
          onClick={() => setStatusFilter('All')}
          className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${statusFilter === 'All' ? 'bg-teal/10 border-teal/40 text-teal' : 'bg-surface border-border text-ink-muted hover:border-teal/40 hover:text-teal'}`}
        >
          All <span className="opacity-60">{products.length}</span>
        </button>
        {STATUSES.filter(s => statusCounts[s] > 0).map(s => (
          <button key={s} onClick={() => setStatusFilter(statusFilter === s ? 'All' : s)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${statusFilter === s ? 'bg-teal/10 border-teal/40 text-teal' : 'bg-surface border-border text-ink-muted hover:border-teal/40 hover:text-teal'}`}>
            {s} <span className="opacity-60">{statusCounts[s]}</span>
          </button>
        ))}
      </div>

      {/* Brand type tabs */}
      <div className="flex items-center border-b border-border mb-5 gap-0">
        {['All', 'TCF House Brand', 'TCF Client'].map(tab => (
          <button key={tab} onClick={() => { setBrandTab(tab); setClientBrandFilter('All') }}
            className={`relative px-4 py-2.5 text-xs font-semibold tracking-wide uppercase transition-colors ${brandTab === tab ? 'text-ink' : 'text-ink-muted hover:text-ink'}`}>
            {tab}
            {brandTab === tab && <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-teal rounded-t-sm" />}
          </button>
        ))}
      </div>

      {/* Client brand sub-filter (only when TCF Client selected) */}
      {brandTab === 'TCF Client' && (
        <div className="flex gap-2 flex-wrap mb-5">
          <button
            onClick={() => setClientBrandFilter('All')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors ${clientBrandFilter === 'All' ? 'text-ink border-ink/30 bg-ink/5' : 'bg-surface border-border text-ink-muted hover:border-border2 hover:text-ink'}`}>
            All Clients
            <span className="opacity-60">{clientBrandCounts.All || 0}</span>
          </button>
          {CLIENT_BRANDS.filter(b => clientBrandCounts[b] > 0).map(b => (
            <button key={b} onClick={() => setClientBrandFilter(clientBrandFilter === b ? 'All' : b)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors ${clientBrandFilter === b ? 'text-white' : 'bg-surface border-border text-ink-muted hover:border-border2 hover:text-ink'}`}
              style={clientBrandFilter === b ? { backgroundColor: BRAND_COLORS[b], borderColor: BRAND_COLORS[b] } : {}}>
              {b}
              <span className={clientBrandFilter === b ? 'opacity-70' : 'opacity-60'}>{clientBrandCounts[b] || 0}</span>
            </button>
          ))}
        </div>
      )}

      {/* Products — grouped by brand */}
      {Object.keys(grouped).length === 0 ? (
        <EmptyState message="No products match this filter" action="Add Product" onAction={() => setModal({})} />
      ) : (
        <div className="flex flex-col gap-8">
          {Object.entries(grouped).map(([brandName, brandProducts]) => (
            <BrandSection
              key={brandName}
              brandName={brandName === 'TCF House Brand' && brandTab === 'All' ? 'TCF House Brand' : brandName}
              products={brandProducts}
              showBrandHeader={brandTab !== 'TCF House Brand'}
              expandedProduct={expandedProduct}
              setExpandedProduct={setExpandedProduct}
              onEdit={(p) => setModal({ product: p })}
              onDelete={deleteProduct}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      <Modal
        open={!!modal}
        title={modal?.product ? 'Edit Product' : 'Add Product'}
        fields={modal?.product
          ? addFields.map(f => ({ ...f, value: modal.product[f.id] || '' }))
          : addFields}
        onSave={saveProduct}
        onClose={() => setModal(null)}
        onDelete={modal?.product ? () => { deleteProduct(modal.product.id); setModal(null) } : null}
      />
    </div>
  )
}

// ── Brand Section ─────────────────────────────────────────────────────────────
function BrandSection({ brandName, products, showBrandHeader, expandedProduct, setExpandedProduct, onEdit, onDelete }) {
  const color = BRAND_COLORS[brandName] || '#888'
  const client = BRAND_CLIENTS[brandName]
  const statusGroups = {}
  products.forEach(p => {
    const s = p.status || 'Unknown'
    if (!statusGroups[s]) statusGroups[s] = []
    statusGroups[s].push(p)
  })

  return (
    <div>
      {/* Brand header */}
      {showBrandHeader && (
        <div className="flex items-center gap-3 mb-3 pb-2.5 border-b-2" style={{ borderColor: color }}>
          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
          <div>
            <h2 className="text-base font-bold text-ink">{brandName}</h2>
            {client && <p className="text-xs text-ink-muted">Client: {client}</p>}
          </div>
          <div className="ml-auto flex items-center gap-1.5 flex-wrap">
            {Object.entries(statusGroups).map(([status, items]) => (
              <span key={status} className="text-[10px] px-2 py-0.5 rounded-full border bg-surface font-medium text-ink-muted border-border">
                {items.length} {status}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Product cards grid */}
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
        {products.map(p => (
          <ProductCard
            key={p.id}
            product={p}
            expanded={expandedProduct === p.id}
            onExpand={() => setExpandedProduct(expandedProduct === p.id ? null : p.id)}
            onEdit={() => onEdit(p)}
            onDelete={() => onDelete(p.id)}
          />
        ))}
      </div>
    </div>
  )
}

// ── Product Card ──────────────────────────────────────────────────────────────
function ProductCard({ product: p, expanded, onExpand, onEdit, onDelete }) {
  const borderColor = STATUS_COLORS[p.status] || 'border-l-border2'

  return (
    <div className={`bg-white border border-border rounded-lg border-l-4 ${borderColor} transition-shadow hover:shadow-sm`}>
      {/* Card header */}
      <div className="px-4 pt-3.5 pb-3 cursor-pointer" onClick={onExpand}>
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-ink leading-snug">{p.name}</h3>
          <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <button className="btn-icon text-xs" onClick={e => { e.stopPropagation(); onEdit() }}>✎</button>
            <button className="btn-icon text-xs text-ink-muted hover:text-red" onClick={e => { e.stopPropagation(); onDelete() }}>✕</button>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <StatusBadge status={p.status} />
          {p.category && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface2 text-ink-muted border border-border font-medium">
              {p.category}
            </span>
          )}
        </div>
        {p.notes && (
          <p className="text-[11.5px] text-ink-muted mt-2 leading-snug line-clamp-2">{p.notes}</p>
        )}
      </div>

      {/* Expand button */}
      <div className="px-4 pb-3 flex items-center justify-between">
        <button
          onClick={onExpand}
          className="text-[10.5px] text-teal hover:text-teal-dim font-medium transition-colors"
        >
          {expanded ? '▲ Less' : '▼ Details'}
        </button>
        <div className="flex gap-1">
          <button className="btn-icon text-xs opacity-50 hover:opacity-100" onClick={e => { e.stopPropagation(); onEdit() }} title="Edit">✎</button>
          <button className="btn-icon text-xs text-ink-muted hover:text-red opacity-50 hover:opacity-100" onClick={e => { e.stopPropagation(); onDelete() }} title="Delete">✕</button>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-border px-4 py-3 bg-surface rounded-b-lg">
          <ExpandedDetails product={p} />
        </div>
      )}
    </div>
  )
}

// ── Expanded Details ──────────────────────────────────────────────────────────
function ExpandedDetails({ product: p }) {
  const { state } = useApp()

  const relatedFormulas = (state.formulas || []).filter(f =>
    f.brand?.toLowerCase().includes('client') ||
    f.name?.toLowerCase().includes(p.name?.split('—')[0]?.toLowerCase().trim().slice(0, 10))
  ).slice(0, 2)

  const relatedPackaging = (state.packaging || []).filter(pkg =>
    pkg.brand && p.name && (
      pkg.brand.toLowerCase().includes(p.clientBrand?.toLowerCase() || '') ||
      p.name.toLowerCase().includes(pkg.brand.toLowerCase().split(' ')[0])
    )
  ).slice(0, 3)

  return (
    <div className="grid grid-cols-2 gap-3 text-xs">
      {/* Formula info */}
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-ink-muted mb-1.5">Formula</div>
        {relatedFormulas.length > 0 ? relatedFormulas.map(f => (
          <div key={f.id} className="mb-1.5">
            <div className="font-medium text-ink text-[11px]">{f.name}</div>
            <div className="text-ink-muted text-[10.5px]">{f.batch || '—'} · <StatusBadge status={f.status} /></div>
          </div>
        )) : (
          <div className="text-ink-muted text-[11px]">No formula linked</div>
        )}
      </div>

      {/* Packaging info */}
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-ink-muted mb-1.5">Packaging</div>
        {relatedPackaging.length > 0 ? relatedPackaging.map(pkg => (
          <div key={pkg.id} className="mb-1.5">
            <div className="font-medium text-ink text-[11px]">{pkg.item}</div>
            <div className="text-ink-muted text-[10.5px]">{pkg.supplier || '—'} · <StatusBadge status={pkg.status} /></div>
          </div>
        )) : (
          <div className="text-ink-muted text-[11px]">No packaging linked</div>
        )}
      </div>

      {/* Full notes */}
      {p.notes && (
        <div className="col-span-2 pt-2 border-t border-border">
          <div className="text-[10px] font-bold uppercase tracking-wider text-ink-muted mb-1">Notes</div>
          <p className="text-ink-muted text-[11.5px] leading-relaxed">{p.notes}</p>
        </div>
      )}
    </div>
  )
}
