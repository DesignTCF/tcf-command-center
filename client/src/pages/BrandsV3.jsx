import { useState, useMemo, useRef } from 'react'
import { useApp } from '../store/AppContext'
import api from '../lib/api'
import { fmtDate, fmtDateShort, timeAgo, isOverdue } from '../lib/utils'
import StatusBadge from '../components/StatusBadge'
import EmptyState from '../components/EmptyState'

const BRANDS = ['NeVoo', 'Daily Rou', 'Nitt Beauty', 'Devoted Man', 'Salt Spa Yoga']

const BRAND_META = {
  'NeVoo': {
    color: '#0D9E9E',
    textColor: '#fff',
    client: 'Molly Smith',
    keywords: ['nevoo', 'ne voo'],
  },
  'Daily Rou': {
    color: '#A07A10',
    textColor: '#fff',
    client: 'Meredith Baurband',
    keywords: ['daily rou', 'dailyrou'],
  },
  'Nitt Beauty': {
    color: '#5533AA',
    textColor: '#fff',
    client: 'Gamze Gurlevik',
    keywords: ['nitt', 'nitt beauty'],
  },
  'Devoted Man': {
    color: '#2255AA',
    textColor: '#fff',
    client: 'Josh Smith',
    keywords: ['devoted man', 'devotedman'],
  },
  'Salt Spa Yoga': {
    color: '#157A50',
    textColor: '#fff',
    client: 'Andrew Moss',
    keywords: ['salt spa', 'salt spa yoga'],
  },
}

function matchesBrand(str, brand) {
  if (!str) return false
  const lower = str.toLowerCase()
  return BRAND_META[brand].keywords.some(k => lower.includes(k)) || lower.includes(brand.toLowerCase())
}

function InlineField({ value, field, productId, onSave, monospace, italic, className }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value || '')
  const inputRef = useRef(null)

  function startEdit() {
    setDraft(value || '')
    setEditing(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function handleBlur() {
    setEditing(false)
    if (draft !== (value || '')) {
      onSave(productId, { [field]: draft })
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') inputRef.current?.blur()
    if (e.key === 'Escape') { setDraft(value || ''); setEditing(false) }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        className={`border border-[#0D9E9E] rounded px-1 py-0 text-[12px] text-[#1A1A1A] outline-none bg-white w-full ${monospace ? 'font-mono' : ''} ${className || ''}`}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
      />
    )
  }

  return (
    <span
      onClick={startEdit}
      title="Click to edit"
      className={`cursor-text hover:bg-[#F0FAFA] rounded px-0.5 transition-colors ${italic ? 'italic text-[#444444]' : ''} ${monospace ? 'font-mono text-[#58595b]' : ''} ${className || ''}`}
    >
      {value || <span className="text-[#BBBBBB] italic">—</span>}
    </span>
  )
}

function ProductCard({ product, onSave }) {
  return (
    <div className="panel rounded-lg p-4 mb-3 border-l-4" style={{ borderLeftColor: BRAND_META[product.clientBrand]?.color || '#D8D8D8' }}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-[#1A1A1A] text-[13px] leading-tight">
            <InlineField value={product.name} field="name" productId={product.id} onSave={onSave} />
          </div>
          {(product.marketingName || true) && (
            <div className="text-[12px] mt-0.5">
              <InlineField
                value={product.marketingName}
                field="marketingName"
                productId={product.id}
                onSave={onSave}
                italic
              />
            </div>
          )}
        </div>
        <StatusBadge status={product.status} />
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-3">
        {product.formulaNumber && (
          <div>
            <div className="section-title text-[9px] mb-0.5">Formula #</div>
            <InlineField
              value={product.formulaNumber}
              field="formulaNumber"
              productId={product.id}
              onSave={onSave}
              monospace
              className="text-[11px]"
            />
          </div>
        )}
        {product.bottleName && (
          <div>
            <div className="section-title text-[9px] mb-0.5">Container</div>
            <div className="text-[12px] text-[#1A1A1A]">
              <InlineField value={product.bottleName} field="bottleName" productId={product.id} onSave={onSave} />
            </div>
          </div>
        )}
        {product.bottleSupplier && (
          <div>
            <div className="section-title text-[9px] mb-0.5">Bottle Supplier</div>
            <div className="text-[12px] text-[#444444]">
              <InlineField value={product.bottleSupplier} field="bottleSupplier" productId={product.id} onSave={onSave} />
            </div>
          </div>
        )}
        {product.bottleStatus && (
          <div>
            <div className="section-title text-[9px] mb-0.5">Bottle Status</div>
            <StatusBadge status={product.bottleStatus} small />
          </div>
        )}
      </div>
    </div>
  )
}

function BrandDetail({ brand, state, onSave }) {
  const meta = BRAND_META[brand]

  const products = useMemo(() =>
    (state.products || []).filter(p => p.clientBrand === brand),
    [state.products, brand]
  )

  const decisions = useMemo(() =>
    (state.decisions || []).filter(d => matchesBrand(d.title, brand) || matchesBrand(d.description, brand)),
    [state.decisions, brand]
  )

  const aliBaba = useMemo(() =>
    (state.alibabaCo || []).filter(c =>
      matchesBrand(c.notes, brand) || matchesBrand(c.product, brand) || matchesBrand(c.supplier, brand)
    ),
    [state.alibabaCo, brand]
  )

  const packaging = useMemo(() =>
    (state.packaging || []).filter(p =>
      matchesBrand(p.brand, brand) || matchesBrand(p.item, brand) || matchesBrand(p.notes, brand)
    ),
    [state.packaging, brand]
  )

  const tasks = useMemo(() =>
    (state.tasks || []).filter(t =>
      matchesBrand(t.title, brand) || matchesBrand(t.description, brand)
    ),
    [state.tasks, brand]
  )

  const contact = useMemo(() =>
    (state.contacts || []).find(c =>
      c.name === meta.client || matchesBrand(c.company, brand)
    ),
    [state.contacts, brand, meta.client]
  )

  return (
    <div className="flex gap-5 min-h-0">
      <div style={{ flex: '0 0 60%' }} className="min-w-0">
        <div className="flex items-center justify-between mb-3">
          <span className="section-title">Products ({products.length})</span>
          <span className="text-[11px] text-[#58595b]">Click any field to edit</span>
        </div>
        {products.length === 0 ? (
          <EmptyState message={`No products found for ${brand}`} />
        ) : (
          products.map(p => (
            <ProductCard key={p.id} product={p} onSave={onSave} />
          ))
        )}
      </div>

      <div style={{ flex: '0 0 40%' }} className="min-w-0 flex flex-col gap-4">
        <div className="panel rounded-lg overflow-hidden">
          <div className="panel-header" style={{ borderBottomColor: '#D8D8D8' }}>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: meta.color }} />
              <span className="section-title">{brand}</span>
            </div>
          </div>
          <div className="p-4">
            <div className="text-[13px] font-semibold text-[#1A1A1A]">{meta.client}</div>
            {contact ? (
              <div className="mt-2 space-y-1">
                {contact.email && (
                  <div className="text-[12px] text-[#444444]">
                    <span className="text-[#58595b]">Email: </span>
                    <a href={`mailto:${contact.email}`} className="text-[#0D9E9E] hover:underline">{contact.email}</a>
                  </div>
                )}
                {contact.phone && (
                  <div className="text-[12px] text-[#444444]">
                    <span className="text-[#58595b]">Phone: </span>{contact.phone}
                  </div>
                )}
                {contact.company && (
                  <div className="text-[12px] text-[#58595b]">{contact.company}</div>
                )}
              </div>
            ) : (
              <div className="text-[12px] text-[#BBBBBB] mt-1">No contact record</div>
            )}

            <div className="mt-3 pt-3 border-t border-[#EEEEEE] grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-[18px] font-bold text-[#1A1A1A]">{products.length}</div>
                <div className="text-[10px] text-[#58595b] uppercase tracking-wide">Products</div>
              </div>
              <div>
                <div className="text-[18px] font-bold text-[#1A1A1A]">{tasks.filter(t => t.status !== 'Done').length}</div>
                <div className="text-[10px] text-[#58595b] uppercase tracking-wide">Open Tasks</div>
              </div>
              <div>
                <div className="text-[18px] font-bold text-[#1A1A1A]">{decisions.length}</div>
                <div className="text-[10px] text-[#58595b] uppercase tracking-wide">Decisions</div>
              </div>
            </div>
          </div>
        </div>

        {packaging.length > 0 && (
          <div className="panel rounded-lg overflow-hidden">
            <div className="panel-header">
              <span className="section-title">Packaging Tracker</span>
              <span className="text-[10px] text-[#58595b]">{packaging.length} items</span>
            </div>
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Supplier</th>
                    <th>Status</th>
                    <th>Due</th>
                  </tr>
                </thead>
                <tbody>
                  {packaging.map((pkg, i) => (
                    <tr key={pkg.id || i}>
                      <td className="text-[12px] font-medium text-[#1A1A1A] max-w-[120px] truncate">{pkg.item || pkg.name || '—'}</td>
                      <td className="text-[11px] text-[#444444]">{pkg.supplier || '—'}</td>
                      <td><StatusBadge status={pkg.status} small /></td>
                      <td className="text-[11px] text-[#58595b] whitespace-nowrap">
                        {pkg.dueDate ? fmtDateShort(pkg.dueDate) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {decisions.length > 0 && (
          <div className="panel rounded-lg overflow-hidden">
            <div className="panel-header">
              <span className="section-title">Open Decisions</span>
              <span className="text-[10px] text-[#58595b]">{decisions.length}</span>
            </div>
            <div className="p-3 space-y-2">
              {decisions.map((d, i) => (
                <div key={d.id || i} className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#A86200] mt-1.5 flex-shrink-0" />
                  <div>
                    <div className="text-[12px] text-[#1A1A1A] font-medium leading-snug">{d.title}</div>
                    {d.description && <div className="text-[11px] text-[#58595b] mt-0.5 leading-snug">{d.description}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tasks.filter(t => t.status !== 'Done').length > 0 && (
          <div className="panel rounded-lg overflow-hidden">
            <div className="panel-header">
              <span className="section-title">Open Tasks</span>
              <span className="text-[10px] text-[#58595b]">{tasks.filter(t => t.status !== 'Done').length}</span>
            </div>
            <div className="p-3 space-y-2">
              {tasks.filter(t => t.status !== 'Done').map((t, i) => (
                <div key={t.id || i} className="flex items-start gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${isOverdue(t.dueDate) ? 'bg-[#B52B2B]' : 'bg-[#0D9E9E]'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] text-[#1A1A1A] leading-snug truncate">{t.title}</div>
                    <div className="flex gap-2 mt-0.5">
                      {t.dueDate && (
                        <span className={`text-[10px] ${isOverdue(t.dueDate) ? 'text-[#B52B2B] font-semibold' : 'text-[#58595b]'}`}>
                          Due {fmtDateShort(t.dueDate)}
                        </span>
                      )}
                      {t.assignee && <span className="text-[10px] text-[#58595b]">{t.assignee}</span>}
                    </div>
                  </div>
                  <StatusBadge status={t.status} small />
                </div>
              ))}
            </div>
          </div>
        )}

        {aliBaba.length > 0 && (
          <div className="panel rounded-lg overflow-hidden">
            <div className="panel-header">
              <span className="section-title">Supplier Conversations</span>
              <span className="text-[10px] text-[#58595b]">{aliBaba.length}</span>
            </div>
            <div className="p-3 space-y-3">
              {aliBaba.map((conv, i) => (
                <div key={conv.id || i} className="border-b border-[#EEEEEE] last:border-0 pb-2 last:pb-0">
                  <div className="text-[12px] font-medium text-[#1A1A1A]">{conv.supplier || conv.product || 'Supplier'}</div>
                  {conv.notes && <div className="text-[11px] text-[#58595b] mt-0.5 leading-snug line-clamp-2">{conv.notes}</div>}
                  {conv.date && <div className="text-[10px] text-[#BBBBBB] mt-0.5">{timeAgo(conv.date)}</div>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function AllBrandsView({ state, onBrandClick }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
      {BRANDS.map(brand => {
        const meta = BRAND_META[brand]
        const products = (state.products || []).filter(p => p.clientBrand === brand)
        const tasks = (state.tasks || []).filter(t =>
          (matchesBrand(t.title, brand) || matchesBrand(t.description, brand)) && t.status !== 'Done'
        )
        const decisions = (state.decisions || []).filter(d =>
          matchesBrand(d.title, brand) || matchesBrand(d.description, brand)
        )
        const liveCount = products.filter(p => ['Live', 'Ready To Launch', 'Approved'].includes(p.status)).length
        const inDevCount = products.filter(p => !['Live', 'Ready To Launch', 'Approved', 'Done'].includes(p.status)).length

        return (
          <button
            key={brand}
            onClick={() => onBrandClick(brand)}
            className="panel rounded-lg p-5 text-left hover:shadow-md transition-shadow cursor-pointer"
            style={{ borderTopWidth: 3, borderTopColor: meta.color, borderTopStyle: 'solid' }}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="font-bold text-[14px] text-[#1A1A1A]">{brand}</div>
                <div className="text-[11px] text-[#58595b] mt-0.5">{meta.client}</div>
              </div>
              <div
                className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: meta.color + '18', color: meta.color }}
              >
                {products.length} products
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center mt-3 pt-3 border-t border-[#EEEEEE]">
              <div>
                <div className="text-[16px] font-bold text-[#157A50]">{liveCount}</div>
                <div className="text-[9px] text-[#58595b] uppercase tracking-wide">Live</div>
              </div>
              <div>
                <div className="text-[16px] font-bold text-[#2255AA]">{inDevCount}</div>
                <div className="text-[9px] text-[#58595b] uppercase tracking-wide">In Dev</div>
              </div>
              <div>
                <div className={`text-[16px] font-bold ${tasks.length > 0 ? 'text-[#A86200]' : 'text-[#BBBBBB]'}`}>{tasks.length}</div>
                <div className="text-[9px] text-[#58595b] uppercase tracking-wide">Tasks</div>
              </div>
            </div>

            {decisions.length > 0 && (
              <div className="mt-2 pt-2 border-t border-[#EEEEEE]">
                <div className="text-[10px] text-[#A86200] font-semibold">{decisions.length} open decision{decisions.length !== 1 ? 's' : ''}</div>
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}

export default function BrandsV3() {
  const { state, dispatch } = useApp()
  const [activeBrand, setActiveBrand] = useState('All')

  async function handleSave(productId, changes) {
    try {
      await api.patch(`/data/products/${productId}`, changes)
      dispatch({ type: 'UPDATE', key: 'products', id: productId, value: changes })
    } catch (err) {
      console.error('Save failed', err)
    }
  }

  return (
    <div className="page-scroll">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[18px] font-bold text-[#1A1A1A]">Brands</h1>
          <p className="text-[12px] text-[#58595b] mt-0.5">Client brand overview, products, and open items</p>
        </div>
        <div className="text-[11px] text-[#BBBBBB]">
          {(state.products || []).length} products across {BRANDS.length} brands
        </div>
      </div>

      <div className="flex gap-2 flex-wrap mb-6">
        <button
          onClick={() => setActiveBrand('All')}
          className={`px-4 py-1.5 rounded-full text-[12px] font-semibold border transition-colors ${
            activeBrand === 'All'
              ? 'bg-[#1A1A1A] text-white border-[#1A1A1A]'
              : 'bg-white text-[#444444] border-[#D8D8D8] hover:border-[#BBBBBB]'
          }`}
        >
          All Brands
        </button>
        {BRANDS.map(brand => {
          const meta = BRAND_META[brand]
          const isActive = activeBrand === brand
          return (
            <button
              key={brand}
              onClick={() => setActiveBrand(brand)}
              className="px-4 py-1.5 rounded-full text-[12px] font-semibold border transition-all"
              style={isActive
                ? { backgroundColor: meta.color, color: meta.textColor, borderColor: meta.color }
                : { backgroundColor: '#fff', color: '#444444', borderColor: '#D8D8D8' }
              }
            >
              {brand}
            </button>
          )
        })}
      </div>

      {activeBrand === 'All' ? (
        <AllBrandsView state={state} onBrandClick={setActiveBrand} />
      ) : (
        <BrandDetail brand={activeBrand} state={state} onSave={handleSave} />
      )}
    </div>
  )
}