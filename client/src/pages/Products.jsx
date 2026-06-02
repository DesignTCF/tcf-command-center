import React, { useState } from 'react'
import { useApp } from '../store/AppContext'
import api from '../lib/api'
import StatusBadge from '../components/StatusBadge'
import Modal from '../components/Modal'
import EmptyState from '../components/EmptyState'

const STATUSES = [
  'Concept',
  'Formulating',
  'Stability Testing',
  'Packaging Development',
  'Artwork Development',
  'Approved',
  'Production',
  'Ready To Launch',
  'Live',
]

const CATEGORIES = [
  'Serum',
  'Moisturizer',
  'Cleanser',
  'Toner',
  'SPF',
  'Mask',
  'Eye Care',
  'Body',
  'Lip',
  'Hair',
  'Other',
]

const BRANDS = ['TCF House Brand', 'TCF Client']

const STATUS_BORDER = {
  'Concept': 'border-l-border2',
  'Formulating': 'border-l-blue',
  'Stability Testing': 'border-l-amber',
  'Packaging Development': 'border-l-gold',
  'Artwork Development': 'border-l-purple',
  'Approved': 'border-l-teal',
  'Production': 'border-l-green',
  'Ready To Launch': 'border-l-gold',
  'Live': 'border-l-green',
}

const ARTWORK_STATUS_OPTIONS = ['Not Started', 'In Progress', 'Approved']
const PHOTO_STATUS_OPTIONS = ['Not Started', 'Scheduled', 'Complete']
const WEBSITE_STATUS_OPTIONS = ['Not Started', 'In Progress', 'Live']
const MARKETING_STATUS_OPTIONS = ['Not Started', 'In Progress', 'Complete']

function ProductDetailPanel({ product, formulas, packaging, onClose, onSave }) {
  const [activeTab, setActiveTab] = useState('FORMULA')
  const [localProduct, setLocalProduct] = useState({ ...product })

  const relatedFormulas = formulas.filter(
    f => f.brand && product.brand && f.brand.toLowerCase() === product.brand.toLowerCase()
  )
  const relatedPackaging = packaging.filter(
    p => p.brand && product.brand && p.brand.toLowerCase() === product.brand.toLowerCase()
  )

  function handleFieldChange(field, value) {
    const updated = { ...localProduct, [field]: value }
    setLocalProduct(updated)
    onSave(product.id, { [field]: value })
  }

  const tabs = ['FORMULA', 'PACKAGING', 'ARTWORK', 'LAUNCH']

  return (
    <div className="col-span-full panel mt-1 mb-3 border-l-4 border-l-teal">
      <div className="panel-header">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold tracking-widest text-ink-dim uppercase">{product.name}</span>
          <StatusBadge status={product.status} />
        </div>
        <button className="btn-icon text-ink-muted hover:text-ink" onClick={onClose}>✕</button>
      </div>

      <div className="flex gap-0 border-b border-border px-4">
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-[10.5px] font-semibold tracking-[0.08em] uppercase transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? 'border-teal text-teal'
                : 'border-transparent text-ink-muted hover:text-ink-dim'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="p-5">
        {activeTab === 'FORMULA' && (
          <div className="flex flex-col gap-5">
            {relatedFormulas.length === 0 ? (
              <div className="text-ink-muted text-xs py-4">No formulas linked to this brand. Add formulas via the Formulas tab.</div>
            ) : (
              relatedFormulas.map(formula => (
                <div key={formula.id} className="bg-surface2 border border-border rounded p-4 flex flex-col gap-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-sm font-semibold text-ink">{formula.name}</span>
                    {formula.sku && <span className="text-[10px] text-ink-muted font-mono bg-surface3 px-2 py-0.5 rounded">{formula.sku}</span>}
                    {formula.status && <StatusBadge status={formula.status} />}
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-[11px]">
                    {formula.chemist && (
                      <div>
                        <div className="text-ink-muted uppercase tracking-wider mb-0.5">Chemist</div>
                        <div className="text-ink">{formula.chemist}</div>
                      </div>
                    )}
                    {formula.batchNumber && (
                      <div>
                        <div className="text-ink-muted uppercase tracking-wider mb-0.5">Batch #</div>
                        <div className="text-ink font-mono">{formula.batchNumber}</div>
                      </div>
                    )}
                  </div>
                  {formula.inci && (
                    <div>
                      <div className="text-[10px] text-ink-muted uppercase tracking-wider mb-1">INCI</div>
                      <p className="text-[11px] text-ink-dim leading-relaxed line-clamp-3">{formula.inci}</p>
                    </div>
                  )}
                  {formula.notes && (
                    <div>
                      <div className="text-[10px] text-ink-muted uppercase tracking-wider mb-1">Notes</div>
                      <p className="text-[11px] text-ink-dim leading-relaxed">{formula.notes}</p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'PACKAGING' && (
          <div className="flex flex-col gap-3">
            {relatedPackaging.length === 0 ? (
              <div className="text-ink-muted text-xs py-4">No packaging linked — add via Packaging tab.</div>
            ) : (
              relatedPackaging.map(pkg => (
                <div key={pkg.id} className="bg-surface2 border border-border rounded p-4 grid grid-cols-4 gap-4 text-[11px]">
                  <div>
                    <div className="text-ink-muted uppercase tracking-wider mb-0.5">Supplier</div>
                    <div className="text-ink">{pkg.supplier || '—'}</div>
                  </div>
                  <div>
                    <div className="text-ink-muted uppercase tracking-wider mb-0.5">MOQ</div>
                    <div className="text-ink">{pkg.moq || '—'}</div>
                  </div>
                  <div>
                    <div className="text-ink-muted uppercase tracking-wider mb-0.5">Lead Time</div>
                    <div className="text-ink">{pkg.leadTime || '—'}</div>
                  </div>
                  <div>
                    <div className="text-ink-muted uppercase tracking-wider mb-1">Status</div>
                    {pkg.status ? <StatusBadge status={pkg.status} /> : <span className="text-ink-muted">—</span>}
                  </div>
                  {pkg.dielineLink && (
                    <div className="col-span-4">
                      <div className="text-ink-muted uppercase tracking-wider mb-0.5">Dieline</div>
                      <a href={pkg.dielineLink} target="_blank" rel="noreferrer" className="text-teal hover:underline text-[11px]">{pkg.dielineLink}</a>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'ARTWORK' && (
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="text-[10px] text-ink-muted uppercase tracking-wider block mb-1.5">Label Status</label>
              <select
                className="input-field text-sm"
                value={localProduct.artworkLabelStatus || 'Not Started'}
                onChange={e => handleFieldChange('artworkLabelStatus', e.target.value)}
              >
                {ARTWORK_STATUS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-ink-muted uppercase tracking-wider block mb-1.5">Box Status</label>
              <select
                className="input-field text-sm"
                value={localProduct.artworkBoxStatus || 'Not Started'}
                onChange={e => handleFieldChange('artworkBoxStatus', e.target.value)}
              >
                {ARTWORK_STATUS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-[10px] text-ink-muted uppercase tracking-wider block mb-1.5">Dieline Links</label>
              <input
                type="text"
                className="input-field text-sm"
                value={localProduct.artworkDielineLinks || ''}
                onChange={e => handleFieldChange('artworkDielineLinks', e.target.value)}
                placeholder="https://..."
              />
            </div>
            <div className="col-span-2">
              <label className="text-[10px] text-ink-muted uppercase tracking-wider block mb-1.5">Artwork Notes</label>
              <textarea
                className="input-field text-sm"
                rows={3}
                value={localProduct.artworkNotes || ''}
                onChange={e => handleFieldChange('artworkNotes', e.target.value)}
                placeholder="Notes..."
              />
            </div>
          </div>
        )}

        {activeTab === 'LAUNCH' && (
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="text-[10px] text-ink-muted uppercase tracking-wider block mb-1.5">Launch Date</label>
              <input
                type="date"
                className="input-field text-sm"
                value={localProduct.launchDate || ''}
                onChange={e => handleFieldChange('launchDate', e.target.value)}
              />
            </div>
            <div>
              <label className="text-[10px] text-ink-muted uppercase tracking-wider block mb-1.5">Photography Status</label>
              <select
                className="input-field text-sm"
                value={localProduct.photographyStatus || 'Not Started'}
                onChange={e => handleFieldChange('photographyStatus', e.target.value)}
              >
                {PHOTO_STATUS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-ink-muted uppercase tracking-wider block mb-1.5">Website Status</label>
              <select
                className="input-field text-sm"
                value={localProduct.websiteStatus || 'Not Started'}
                onChange={e => handleFieldChange('websiteStatus', e.target.value)}
              >
                {WEBSITE_STATUS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-ink-muted uppercase tracking-wider block mb-1.5">Marketing Status</label>
              <select
                className="input-field text-sm"
                value={localProduct.marketingStatus || 'Not Started'}
                onChange={e => handleFieldChange('marketingStatus', e.target.value)}
              >
                {MARKETING_STATUS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-[10px] text-ink-muted uppercase tracking-wider block mb-1.5">Notes</label>
              <textarea
                className="input-field text-sm"
                rows={3}
                value={localProduct.launchNotes || ''}
                onChange={e => handleFieldChange('launchNotes', e.target.value)}
                placeholder="Notes..."
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ProductCard({ product, isExpanded, onExpand, onEdit }) {
  const borderClass = STATUS_BORDER[product.status] || 'border-l-border2'

  return (
    <div className={`panel border-l-4 ${borderClass} flex flex-col gap-3 cursor-pointer hover:border-border2 transition-colors`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
          <span className="text-sm font-semibold text-ink leading-snug truncate">{product.name}</span>
          <div className="flex items-center gap-2 flex-wrap">
            {product.brand && (
              <span className={`text-[9.5px] font-semibold tracking-[0.07em] uppercase px-1.5 py-0.5 rounded ${
                product.brand === 'TCF House Brand'
                  ? 'bg-teal/10 text-teal border border-teal/20'
                  : 'bg-gold/10 text-gold border border-gold/20'
              }`}>
                {product.brand === 'TCF House Brand' ? 'House' : 'Client'}
              </span>
            )}
            {product.category && (
              <span className="text-[9.5px] font-medium text-ink-muted bg-surface2 px-1.5 py-0.5 rounded border border-border">
                {product.category}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
          <button
            className="btn-icon text-ink-muted hover:text-ink"
            onClick={e => { e.stopPropagation(); onEdit(product) }}
            title="Edit"
          >
            ✎
          </button>
          <button
            className={`btn-icon transition-colors ${isExpanded ? 'text-teal' : 'text-ink-muted hover:text-ink'}`}
            onClick={e => { e.stopPropagation(); onExpand(product.id) }}
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? '▲' : '▼'}
          </button>
        </div>
      </div>
      <div onClick={() => onExpand(product.id)}>
        <StatusBadge status={product.status} />
      </div>
      {product.notes && (
        <p className="text-[11px] text-ink-muted leading-relaxed line-clamp-2">{product.notes}</p>
      )}
    </div>
  )
}

export default function Products() {
  const { state, dispatch } = useApp()
  const products = state.products || []
  const formulas = state.formulas || []
  const packaging = state.packaging || []

  const [statusFilter, setStatusFilter] = useState('All')
  const [brandFilter, setBrandFilter] = useState('All')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [expandedId, setExpandedId] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)

  const categories = ['All', ...CATEGORIES]
  const brandOptions = ['All', ...BRANDS]

  const filtered = products.filter(p => {
    if (statusFilter !== 'All' && p.status !== statusFilter) return false
    if (brandFilter !== 'All' && p.brand !== brandFilter) return false
    if (categoryFilter !== 'All' && p.category !== categoryFilter) return false
    return true
  })

  const statusCounts = {}
  STATUSES.forEach(s => {
    statusCounts[s] = products.filter(p => p.status === s).length
  })

  function handleExpand(id) {
    setExpandedId(prev => prev === id ? null : id)
  }

  function openAdd() {
    setEditingProduct(null)
    setModalOpen(true)
  }

  function openEdit(product) {
    setEditingProduct(product)
    setModalOpen(true)
  }

  async function handleSave(data) {
    if (editingProduct) {
      const updated = { ...editingProduct, ...data }
      try {
        await api.patch(`/products/${editingProduct.id}`, data)
      } catch (_) {}
      dispatch({ type: 'UPDATE', key: 'products', id: editingProduct.id, value: data })
    } else {
      const newItem = {
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
        ...data,
      }
      try {
        await api.post('/products', newItem)
      } catch (_) {}
      dispatch({ type: 'ADD', key: 'products', value: newItem })
    }
    setModalOpen(false)
    setEditingProduct(null)
  }

  async function handleDelete() {
    if (!editingProduct) return
    try {
      await api.del(`/products/${editingProduct.id}`)
    } catch (_) {}
    dispatch({ type: 'DELETE', key: 'products', id: editingProduct.id })
    if (expandedId === editingProduct.id) setExpandedId(null)
    setModalOpen(false)
    setEditingProduct(null)
  }

  async function handleInlineUpdate(productId, changes) {
    try {
      await api.patch(`/products/${productId}`, changes)
    } catch (_) {}
    dispatch({ type: 'UPDATE', key: 'products', id: productId, value: changes })
  }

  const modalFields = [
    {
      id: 'name',
      label: 'Product Name',
      type: 'text',
      value: editingProduct?.name || '',
      placeholder: 'e.g. Peptide Renewal Serum',
    },
    {
      id: 'brand',
      label: 'Brand',
      type: 'select',
      options: BRANDS,
      value: editingProduct?.brand || BRANDS[0],
    },
    {
      id: 'category',
      label: 'Category',
      type: 'select',
      options: CATEGORIES,
      value: editingProduct?.category || CATEGORIES[0],
    },
    {
      id: 'status',
      label: 'Status',
      type: 'select',
      options: STATUSES,
      value: editingProduct?.status || STATUSES[0],
    },
    {
      id: 'notes',
      label: 'Notes',
      type: 'textarea',
      value: editingProduct?.notes || '',
      placeholder: 'Product development notes...',
    },
  ]

  // Build rows of cards with expanded panel injected after rows
  const COLS = 3
  const rows = []
  let i = 0
  while (i < filtered.length) {
    const rowItems = filtered.slice(i, i + COLS)
    rows.push({ items: rowItems, startIdx: i })
    i += COLS
  }

  return (
    <div className="page-scroll">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">Products</h1>
          <p className="text-xs text-ink-muted mt-0.5">{products.length} product{products.length !== 1 ? 's' : ''} in development</p>
        </div>
        <button className="btn-primary" onClick={openAdd}>+ Add Product</button>
      </div>

      {/* Status Pipeline Strip */}
      <div className="flex items-center gap-2 flex-wrap mb-4">
        <button
          onClick={() => setStatusFilter('All')}
          className={`px-3 py-1 rounded text-[10.5px] font-semibold tracking-[0.06em] uppercase border transition-colors ${
            statusFilter === 'All'
              ? 'bg-teal/20 border-teal/40 text-teal'
              : 'bg-surface2 border-border2 text-ink-muted hover:text-ink-dim'
          }`}
        >
          All <span className="ml-1 opacity-70">{products.length}</span>
        </button>
        {STATUSES.map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 rounded text-[10.5px] font-semibold tracking-[0.06em] uppercase border transition-colors ${
              statusFilter === s
                ? 'bg-teal/20 border-teal/40 text-teal'
                : 'bg-surface2 border-border2 text-ink-muted hover:text-ink-dim'
            }`}
          >
            {s} <span className="ml-1 opacity-70">{statusCounts[s] || 0}</span>
          </button>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex items-center gap-1">
          {brandOptions.map(b => (
            <button
              key={b}
              onClick={() => setBrandFilter(b)}
              className={`px-2.5 py-1 rounded text-[10.5px] font-medium transition-colors ${
                brandFilter === b
                  ? 'bg-surface3 text-ink border border-border2'
                  : 'text-ink-muted hover:text-ink-dim'
              }`}
            >
              {b}
            </button>
          ))}
        </div>
        <div className="w-px h-4 bg-border self-center" />
        <select
          className="input-field text-[11px] py-1 px-2 h-auto"
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
        >
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Products Grid */}
      {filtered.length === 0 ? (
        <EmptyState
          title="No products found"
          description={statusFilter !== 'All' || brandFilter !== 'All' || categoryFilter !== 'All'
            ? 'Try adjusting your filters.'
            : 'Add your first product to get started.'}
          action={statusFilter === 'All' && brandFilter === 'All' && categoryFilter === 'All'
            ? { label: '+ Add Product', onClick: openAdd }
            : undefined}
        />
      ) : (
        <div>
          {rows.map((row, rowIdx) => {
            const expandedInRow = row.items.find(item => item.id === expandedId)
            return (
              <React.Fragment key={rowIdx}>
                <div className="grid grid-cols-3 gap-3 mb-0">
                  {row.items.map(product => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      isExpanded={expandedId === product.id}
                      onExpand={handleExpand}
                      onEdit={openEdit}
                    />
                  ))}
                  {/* Fill empty slots */}
                  {row.items.length < COLS && Array.from({ length: COLS - row.items.length }).map((_, idx) => (
                    <div key={`empty-${idx}`} />
                  ))}
                </div>
                {expandedInRow && (
                  <div className="grid grid-cols-1 gap-0 mt-2 mb-2">
                    <ProductDetailPanel
                      product={expandedInRow}
                      formulas={formulas}
                      packaging={packaging}
                      onClose={() => setExpandedId(null)}
                      onSave={handleInlineUpdate}
                    />
                  </div>
                )}
              </React.Fragment>
            )
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal
        open={modalOpen}
        title={editingProduct ? 'Edit Product' : 'Add Product'}
        fields={modalFields}
        onSave={handleSave}
        onClose={() => { setModalOpen(false); setEditingProduct(null) }}
        onDelete={editingProduct ? handleDelete : undefined}
        saveLabel={editingProduct ? 'Save Changes' : 'Add Product'}
      />
    </div>
  )
}
