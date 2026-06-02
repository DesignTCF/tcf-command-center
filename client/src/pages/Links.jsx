import { useState, useMemo, useEffect } from 'react'
import Modal from '../components/Modal'
import EmptyState from '../components/EmptyState'
import api from '../lib/api'

const CATEGORIES = ['All', 'Design', 'Suppliers', 'E-Commerce', 'Business', 'Google', 'Social', 'Communication', 'AI Tools', 'Equipment']

const CATEGORY_ICONS = {
  Design: '✏️',
  Suppliers: '📦',
  'E-Commerce': '🛒',
  Business: '💼',
  Google: '🔵',
  Social: '📱',
  Communication: '📡',
  'AI Tools': '✦',
  Equipment: '🖨️',
}

const CATEGORY_COLORS = {
  Design: 'text-purple border-purple/30 bg-purple/10',
  Suppliers: 'text-gold border-gold/30 bg-gold/10',
  'E-Commerce': 'text-green border-green/30 bg-green/10',
  Business: 'text-teal border-teal/30 bg-teal/10',
  Google: 'text-blue border-blue/30 bg-blue/10',
  Social: 'text-amber border-amber/30 bg-amber/10',
  Communication: 'text-teal border-teal/30 bg-teal/10',
  'AI Tools': 'text-teal border-teal/30 bg-teal/10',
  Equipment: 'text-ink-dim border-border2 bg-surface3',
}

// Group unique domains for deduplication display
function getDomain(url) {
  try {
    return new URL(url).hostname.replace('www.', '')
  } catch {
    return url
  }
}

// Service favicon from Google
function FaviconImg({ url, title }) {
  const [err, setErr] = useState(false)
  if (err) {
    return (
      <div className="w-8 h-8 rounded-md bg-surface3 flex items-center justify-center text-sm font-bold text-ink-muted shrink-0">
        {title?.[0]?.toUpperCase() || '?'}
      </div>
    )
  }
  try {
    const domain = new URL(url).hostname
    return (
      <img
        src={`https://www.google.com/s2/favicons?sz=32&domain=${domain}`}
        alt=""
        className="w-8 h-8 rounded-md shrink-0 object-contain bg-surface3"
        onError={() => setErr(true)}
      />
    )
  } catch {
    return (
      <div className="w-8 h-8 rounded-md bg-surface3 flex items-center justify-center text-sm font-bold text-ink-muted shrink-0">
        {title?.[0]?.toUpperCase() || '?'}
      </div>
    )
  }
}

export default function Links() {
  const [links, setLinks] = useState([])
  const [activeCategory, setActiveCategory] = useState('All')
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null)
  const [copied, setCopied] = useState(null)

  useEffect(() => {
    api.get('/data/links').then(setLinks).catch(() => {})
  }, [])

  const filtered = useMemo(() => {
    let items = [...links]
    if (activeCategory !== 'All') items = items.filter(l => l.category === activeCategory)
    if (search.trim()) {
      const q = search.toLowerCase()
      items = items.filter(l =>
        l.title?.toLowerCase().includes(q) ||
        l.url?.toLowerCase().includes(q) ||
        l.username?.toLowerCase().includes(q) ||
        l.category?.toLowerCase().includes(q)
      )
    }
    return items
  }, [links, activeCategory, search])

  // Group by category for display
  const grouped = useMemo(() => {
    if (activeCategory !== 'All') return { [activeCategory]: filtered }
    return CATEGORIES.slice(1).reduce((acc, cat) => {
      const items = filtered.filter(l => l.category === cat)
      if (items.length) acc[cat] = items
      return acc
    }, {})
  }, [filtered, activeCategory])

  const categoryCounts = useMemo(() =>
    CATEGORIES.slice(1).reduce((acc, cat) => {
      acc[cat] = links.filter(l => l.category === cat).length
      return acc
    }, {}),
  [links])

  function copyUsername(username, id) {
    navigator.clipboard.writeText(username)
    setCopied(id)
    setTimeout(() => setCopied(null), 1800)
  }

  const addFields = [
    { id: 'title', label: 'Title', type: 'text', value: '', placeholder: 'e.g. Supplier Portal' },
    { id: 'url', label: 'URL', type: 'text', value: '', placeholder: 'https://...' },
    { id: 'username', label: 'Username / Email', type: 'text', value: '' },
    { id: 'category', label: 'Category', type: 'select', options: CATEGORIES.slice(1), value: 'Business' },
    { id: 'notes', label: 'Notes', type: 'text', value: '' },
  ]

  async function saveLink(data) {
    if (!data.url?.startsWith('http')) data.url = 'https://' + data.url
    if (modal?.link) {
      const updated = await api.patch(`/data/links/${modal.link.id}`, data)
      setLinks(prev => prev.map(l => l.id === modal.link.id ? updated : l))
    } else {
      const created = await api.post('/data/links', data)
      setLinks(prev => [...prev, created])
    }
    setModal(null)
  }

  async function removeLink(id) {
    if (!confirm('Remove this link?')) return
    await api.del(`/data/links/${id}`)
    setLinks(prev => prev.filter(l => l.id !== id))
    setModal(null)
  }

  return (
    <div className="h-full flex overflow-hidden">
      {/* Sidebar */}
      <div className="w-[200px] border-r border-border bg-surface flex flex-col shrink-0">
        <div className="px-4 py-3 border-b border-border">
          <div className="section-title">External Links</div>
          <div className="text-[10px] text-ink-muted mt-0.5">{links.length} total</div>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {CATEGORIES.map(cat => {
            const count = cat === 'All' ? links.length : (categoryCounts[cat] || 0)
            const active = activeCategory === cat
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`w-full flex items-center justify-between px-4 py-2 text-left transition-colors ${active ? 'bg-teal/10 text-teal' : 'text-ink-muted hover:text-ink hover:bg-surface2'}`}
              >
                <span className="text-xs font-medium flex items-center gap-2">
                  {cat !== 'All' && <span>{CATEGORY_ICONS[cat]}</span>}
                  {cat}
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${active ? 'bg-teal/20 text-teal' : 'bg-surface3 text-ink-muted'}`}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>
        <div className="p-3 border-t border-border">
          <button className="btn-primary w-full text-xs" onClick={() => setModal({})}>+ Add Link</button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Search bar */}
        <div className="px-5 py-3 border-b border-border flex items-center gap-3 shrink-0">
          <input
            type="text"
            placeholder="Search by name, URL, or username…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input-field flex-1 text-sm"
          />
          <span className="text-[10.5px] text-ink-muted shrink-0">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
        </div>

        {/* Link grid */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {Object.entries(grouped).length === 0 ? (
            <EmptyState message="No links match your search" />
          ) : (
            Object.entries(grouped).map(([cat, items]) => (
              <div key={cat} className="mb-7">
                {/* Category header */}
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
                  <span className="text-sm">{CATEGORY_ICONS[cat]}</span>
                  <h3 className="section-title">{cat}</h3>
                  <span className="text-[10px] text-ink-muted">({items.length})</span>
                </div>

                {/* Cards grid */}
                <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
                  {items.map(link => (
                    <LinkCard
                      key={link.id}
                      link={link}
                      onEdit={() => setModal({ link })}
                      onCopy={() => copyUsername(link.username, link.id)}
                      copied={copied === link.id}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add/Edit modal */}
      <Modal
        open={!!modal}
        title={modal?.link ? 'Edit Link' : 'Add External Link'}
        fields={modal?.link ? addFields.map(f => ({ ...f, value: modal.link[f.id] || '' })) : addFields}
        onSave={saveLink}
        onClose={() => setModal(null)}
        onDelete={modal?.link ? () => removeLink(modal.link.id) : null}
      />
    </div>
  )
}

function LinkCard({ link, onEdit, onCopy, copied }) {
  const colorCls = CATEGORY_COLORS[link.category] || 'text-ink-muted border-border bg-surface3'

  return (
    <div className="panel flex items-start gap-3 p-3.5 group hover:border-border2 transition-colors">
      <FaviconImg url={link.url} title={link.title} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-semibold text-ink truncate">{link.title}</span>
          <span className={`shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded border ${colorCls}`}>
            {link.category}
          </span>
        </div>
        <div className="text-[11px] text-ink-muted truncate mb-1">{link.username}</div>
        <div className="text-[10.5px] text-ink-muted/60 truncate">{getDomain(link.url)}</div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary text-[10px] px-2.5 py-1 text-center leading-none"
          onClick={e => e.stopPropagation()}
        >
          Open ↗
        </a>
        <button
          className="btn-ghost text-[10px] px-2.5 py-1 leading-none"
          onClick={onCopy}
        >
          {copied ? '✓ Copied' : '⧉ User'}
        </button>
        <button
          className="btn-icon text-[10px] px-2.5 py-1 leading-none text-ink-muted hover:text-ink"
          onClick={onEdit}
        >
          Edit
        </button>
      </div>
    </div>
  )
}
