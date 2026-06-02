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

// ── Product Card — fully inline editable ─────────────────────────────────────
function ProductCard({ product: p, expanded, onExpand, onEdit, onDelete }) {
  const { dispatch } = useApp()
  const [saving, setSaving] = useState(false)
  const borderColor = STATUS_COLORS[p.status] || 'border-l-border2'

  // Save a single field change immediately
  async function saveField(field, value) {
    const changes = { [field]: value }
    setSaving(true)
    try {
      const updated = await api.patch(`/data/products/${p.id}`, changes)
      dispatch({ type: 'UPDATE', key: 'products', id: p.id, value: updated })
    } catch {
      dispatch({ type: 'UPDATE', key: 'products', id: p.id, value: changes })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={`bg-white border border-border rounded-lg border-l-4 ${borderColor} transition-shadow hover:shadow-sm`}>
      {/* Card header — always visible */}
      <div className="px-4 pt-3.5 pb-2">
        <div className="flex items-start gap-2">
          {/* Product name — inline editable */}
          <input
            className="flex-1 text-sm font-semibold text-ink bg-transparent border-none outline-none focus:bg-surface focus:px-1.5 focus:rounded transition-all min-w-0 -ml-0.5"
            defaultValue={p.name}
            onBlur={e => e.target.value !== p.name && saveField('name', e.target.value)}
            onKeyDown={e => e.key === 'Enter' && e.target.blur()}
            placeholder="Product name"
          />
          {saving && <span className="text-[9px] text-teal shrink-0 mt-1">Saving…</span>}
          <button className="btn-icon text-xs text-ink-muted hover:text-red shrink-0 mt-0.5" onClick={e => { e.stopPropagation(); onDelete() }} title="Delete">✕</button>
        </div>

        {/* Status + Category row — both editable dropdowns */}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <select
            value={p.status || ''}
            onChange={e => saveField('status', e.target.value)}
            className="text-[10px] font-bold px-1.5 py-0.5 rounded border cursor-pointer bg-transparent focus:outline-none"
            style={{ borderColor: 'currentColor' }}
          >
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
          <select
            value={p.category || ''}
            onChange={e => saveField('category', e.target.value)}
            className="text-[10px] px-1.5 py-0.5 rounded border border-border bg-surface2 text-ink-muted cursor-pointer focus:outline-none"
          >
            <option value="">Category</option>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Expand toggle */}
      <div className="px-4 pb-2.5">
        <button onClick={onExpand} className="text-[10.5px] text-teal hover:text-teal-dim font-medium transition-colors">
          {expanded ? '▲ Collapse' : '▼ Edit All Fields'}
        </button>
      </div>

      {/* ── Expanded inline edit form ── */}
      {expanded && (
        <div className="border-t border-border bg-surface rounded-b-lg px-4 py-4 flex flex-col gap-4">

          {/* Row 1: Product info */}
          <div className="grid grid-cols-2 gap-3">
            <EditField label="Product / Label Name" value={p.marketingName} placeholder="Name on the label" onSave={v => saveField('marketingName', v)} />
            <EditField label="Internal / Project Name" value={p.name} placeholder="Internal name" onSave={v => saveField('name', v)} />
          </div>

          {/* Divider */}
          <div className="border-t border-border pt-1">
            <div className="text-[10px] font-bold uppercase tracking-widest text-teal mb-3">Formula</div>
            <div className="grid grid-cols-2 gap-3">
              <EditField label="Formula Number" value={p.formulaNumber} placeholder="e.g. FML-51-ly947" onSave={v => saveField('formulaNumber', v)} mono />
              <SelectField label="Formula Status" value={p.formulaStatus} options={STATUSES} onSave={v => saveField('formulaStatus', v)} />
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-border pt-1">
            <div className="text-[10px] font-bold uppercase tracking-widest text-teal mb-3">Packaging</div>
            <div className="grid grid-cols-2 gap-3">
              <EditField label="Bottle / Container" value={p.bottleName} placeholder="e.g. 30ml Frosted Glass Dropper" onSave={v => saveField('bottleName', v)} />
              <EditField label="Sourced From" value={p.bottleSupplier} placeholder="Supplier name" onSave={v => saveField('bottleSupplier', v)} />
              <SelectField label="Packaging Status" value={p.bottleStatus} options={['Sourcing', 'Sampling', 'Pending Approval', 'Approved', 'In Production', 'Received', 'Delivered']} onSave={v => saveField('bottleStatus', v)} />
              <EditField label="MOQ / Lead Time" value={p.packagingNotes} placeholder="e.g. 1,000 units · 8 weeks" onSave={v => saveField('packagingNotes', v)} />
            </div>
          </div>

          {/* Notes */}
          <div className="border-t border-border pt-1">
            <div className="text-[10px] font-bold uppercase tracking-widest text-ink-muted mb-2">Notes</div>
            <textarea
              className="input-field text-xs resize-none leading-relaxed"
              rows={3}
              defaultValue={p.notes || ''}
              placeholder="Add notes…"
              onBlur={e => e.target.value !== (p.notes || '') && saveField('notes', e.target.value)}
            />
          </div>

          {/* Delete */}
          <div className="flex justify-end pt-1 border-t border-border">
            <button className="text-[10.5px] text-ink-muted hover:text-red transition-colors" onClick={onDelete}>
              Delete product
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Inline field components ───────────────────────────────────────────────────
function EditField({ label, value, placeholder, onSave, mono }) {
  return (
    <div>
      <div className="text-[9.5px] font-bold uppercase tracking-wider text-ink-muted mb-1">{label}</div>
      <input
        className={`input-field text-xs py-1.5 ${mono ? 'font-mono' : ''}`}
        defaultValue={value || ''}
        placeholder={placeholder}
        onBlur={e => onSave(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && e.target.blur()}
      />
    </div>
  )
}

function SelectField({ label, value, options, onSave }) {
  return (
    <div>
      <div className="text-[9.5px] font-bold uppercase tracking-wider text-ink-muted mb-1">{label}</div>
      <select
        className="input-field text-xs py-1.5 cursor-pointer"
        value={value || ''}
        onChange={e => onSave(e.target.value)}
      >
        <option value="">— Select —</option>
        {options.map(o => <option key={o}>{o}</option>)}
      </select>
    </div>
  )
}
