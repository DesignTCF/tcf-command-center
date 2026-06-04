import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../store/AppContext'

// ── Type config ───────────────────────────────────────────────────────────────
const TYPES = {
  product:   { label: 'Product',   color: 'bg-teal/10 text-teal',          icon: '🧴' },
  project:   { label: 'Project',   color: 'bg-blue-50 text-blue-700',      icon: '📁' },
  task:      { label: 'Task',      color: 'bg-amber-50 text-amber-700',    icon: '✓' },
  decision:  { label: 'Decision',  color: 'bg-red-50 text-red-700',        icon: '⚡' },
  supplier:  { label: 'Supplier',  color: 'bg-purple-50 text-purple-700',  icon: '📦' },
  contact:   { label: 'Contact',   color: 'bg-green-50 text-green-700',    icon: '👤' },
  calendar:  { label: 'Event',     color: 'bg-indigo-50 text-indigo-700',  icon: '📅' },
  packaging: { label: 'Packaging', color: 'bg-orange-50 text-orange-700',  icon: '📫' },
  link:      { label: 'Link',      color: 'bg-surface2 text-ink-muted',    icon: '🔗' },
  intel:     { label: 'Note',      color: 'bg-surface2 text-ink-muted',    icon: '💡' },
}

function buildIndex(state) {
  const items = []

  // Products
  ;(state.products || []).forEach(p => items.push({
    id: `product-${p.id}`,
    type: 'product',
    title: p.name || p.marketingName || 'Untitled Product',
    sub: [p.clientBrand, p.status].filter(Boolean).join(' · '),
    to: '/brands',
    raw: `${p.name} ${p.marketingName} ${p.clientBrand} ${p.status} ${p.notes}`.toLowerCase(),
  }))

  // Projects
  ;(state.projects || []).forEach(p => items.push({
    id: `project-${p.id}`,
    type: 'project',
    title: p.name,
    sub: [p.status, p.brand || p.client].filter(Boolean).join(' · '),
    to: '/work',
    raw: `${p.name} ${p.status} ${p.brand} ${p.client} ${p.description}`.toLowerCase(),
  }))

  // Tasks
  ;(state.tasks || []).forEach(t => items.push({
    id: `task-${t.id}`,
    type: 'task',
    title: t.title,
    sub: [t.status, t.dueDate ? `Due ${t.dueDate}` : null].filter(Boolean).join(' · '),
    to: '/work',
    raw: `${t.title} ${t.status}`.toLowerCase(),
  }))

  // Notion page tasks
  ;(state.notionPageTasks || []).forEach(t => items.push({
    id: `ntask-${t.id}`,
    type: 'task',
    title: t.title,
    sub: [t.status, t.priority].filter(Boolean).join(' · '),
    to: '/work',
    raw: `${t.title} ${t.status} ${t.priority}`.toLowerCase(),
  }))

  // Decisions
  ;(state.decisions || []).filter(d => !d.resolved).forEach(d => items.push({
    id: `decision-${d.id}`,
    type: 'decision',
    title: d.title,
    sub: d.context?.slice(0, 60) || '',
    to: '/work',
    raw: `${d.title} ${d.context}`.toLowerCase(),
  }))

  // Suppliers
  ;(state.suppliers || []).forEach(s => items.push({
    id: `supplier-${s.id}`,
    type: 'supplier',
    title: s.supplier,
    sub: [s.project, s.status].filter(Boolean).join(' · '),
    to: '/work',
    raw: `${s.supplier} ${s.project} ${s.status} ${s.waitingOn}`.toLowerCase(),
  }))

  // Contacts
  ;(state.contacts || []).forEach(c => items.push({
    id: `contact-${c.id}`,
    type: 'contact',
    title: c.name,
    sub: [c.company, c.role, c.email].filter(Boolean).join(' · '),
    to: '/work',
    raw: `${c.name} ${c.company} ${c.role} ${c.email}`.toLowerCase(),
  }))

  // Calendar events
  ;(state.calendar || []).forEach(e => items.push({
    id: `cal-${e.id}`,
    type: 'calendar',
    title: e.title,
    sub: [e.date, e.type, e.brand].filter(Boolean).join(' · '),
    to: '/calendar',
    raw: `${e.title} ${e.type} ${e.brand} ${e.notes}`.toLowerCase(),
  }))

  // Packaging
  ;(state.packaging || []).forEach(p => items.push({
    id: `pkg-${p.id}`,
    type: 'packaging',
    title: p.name || p.item,
    sub: [p.brand, p.status, p.supplier].filter(Boolean).join(' · '),
    to: '/brands',
    raw: `${p.name} ${p.item} ${p.brand} ${p.status} ${p.supplier}`.toLowerCase(),
  }))

  // Intelligence notes
  ;(state.intelligence || []).forEach(n => items.push({
    id: `intel-${n.id}`,
    type: 'intel',
    title: n.title || n.note?.slice(0, 60),
    sub: n.category || '',
    to: '/work',
    raw: `${n.title} ${n.note} ${n.category}`.toLowerCase(),
  }))

  // Links
  ;(state.links || []).forEach(l => items.push({
    id: `link-${l.id}`,
    type: 'link',
    title: l.title || l.label,
    sub: l.url,
    href: l.url,
    raw: `${l.title} ${l.label} ${l.url} ${l.category}`.toLowerCase(),
  }))

  return items
}

function score(item, q) {
  const title = (item.title || '').toLowerCase()
  const sub   = (item.sub || '').toLowerCase()
  const ql    = q.toLowerCase()
  if (title === ql)               return 100
  if (title.startsWith(ql))       return 80
  if (title.includes(ql))         return 60
  if (sub.includes(ql))           return 40
  if (item.raw?.includes(ql))     return 20
  return 0
}

const GROUP_ORDER = ['product', 'project', 'task', 'decision', 'supplier', 'contact', 'calendar', 'packaging', 'intel', 'link']

export default function DashboardSearch() {
  const { state } = useApp()
  const navigate  = useNavigate()
  const [open, setOpen]     = useState(false)
  const [query, setQuery]   = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef(null)
  const panelRef = useRef(null)

  // Build search index from all state
  const index = useMemo(() => buildIndex(state), [
    state.products, state.projects, state.tasks, state.notionPageTasks,
    state.decisions, state.suppliers, state.contacts, state.calendar,
    state.packaging, state.intelligence, state.links,
  ])

  // Filter + score results
  const results = useMemo(() => {
    if (!query.trim()) return []
    const q = query.trim()
    return index
      .map(item => ({ ...item, _score: score(item, q) }))
      .filter(item => item._score > 0)
      .sort((a, b) => b._score - a._score)
      .slice(0, 24)
  }, [index, query])

  // Group results
  const grouped = useMemo(() => {
    const groups = {}
    results.forEach(r => {
      if (!groups[r.type]) groups[r.type] = []
      groups[r.type].push(r)
    })
    return GROUP_ORDER.filter(t => groups[t]).map(t => ({ type: t, items: groups[t] }))
  }, [results])

  // Flat list for keyboard nav
  const flat = useMemo(() => results, [results])

  // Cmd+K to open
  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(true)
        setTimeout(() => inputRef.current?.focus(), 50)
      }
      if (e.key === 'Escape') { setOpen(false); setQuery('') }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function onClick(e) {
      if (!panelRef.current?.contains(e.target)) { setOpen(false); setQuery('') }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  // Reset cursor when results change
  useEffect(() => setCursor(0), [results])

  function onKeyDown(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, flat.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)) }
    if (e.key === 'Enter' && flat[cursor]) go(flat[cursor])
    if (e.key === 'Escape')    { setOpen(false); setQuery('') }
  }

  function go(item) {
    setOpen(false); setQuery('')
    if (item.href) { window.open(item.href, '_blank'); return }
    navigate(item.to)
  }

  function highlight(text, q) {
    if (!q || !text) return text
    const idx = text.toLowerCase().indexOf(q.toLowerCase())
    if (idx === -1) return text
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-teal/20 text-teal rounded px-0.5">{text.slice(idx, idx + q.length)}</mark>
        {text.slice(idx + q.length)}
      </>
    )
  }

  // Flatten results with group info for cursor tracking
  let flatIdx = 0
  const groupedWithIdx = grouped.map(g => ({
    ...g,
    items: g.items.map(item => ({ ...item, _flatIdx: flatIdx++ }))
  }))

  return (
    <div className="relative flex-1 max-w-[380px] mx-6" ref={panelRef}>
      {/* Search trigger */}
      <button
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50) }}
        className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg border border-border bg-surface hover:bg-surface2 transition-colors text-left"
      >
        <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className="text-ink-muted shrink-0">
          <circle cx="9" cy="9" r="6"/><path d="m15 15 3 3"/>
        </svg>
        <span className="text-[12px] text-ink-muted flex-1">Search dashboard…</span>
        <span className="text-[10px] text-ink-muted bg-surface3 border border-border rounded px-1.5 py-0.5 font-mono shrink-0">⌘K</span>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-[calc(100%+8px)] left-0 right-0 z-[200] bg-white rounded-xl border border-border shadow-2xl overflow-hidden"
          style={{ width: 520, left: '50%', transform: 'translateX(-50%)' }}>

          {/* Input */}
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border">
            <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className="text-ink-muted shrink-0">
              <circle cx="9" cy="9" r="6"/><path d="m15 15 3 3"/>
            </svg>
            <input
              ref={inputRef}
              value={query}
              onChange={e => { setQuery(e.target.value); setCursor(0) }}
              onKeyDown={onKeyDown}
              placeholder="Search products, projects, tasks, suppliers, contacts…"
              className="flex-1 text-[13px] text-ink bg-transparent outline-none placeholder:text-ink-muted"
            />
            {query && (
              <button onClick={() => setQuery('')} className="text-ink-muted hover:text-ink text-lg leading-none">×</button>
            )}
          </div>

          {/* Results */}
          <div className="max-h-[420px] overflow-y-auto">
            {!query.trim() && (
              <div className="px-4 py-8 text-center text-[12px] text-ink-muted">
                Type to search across all dashboard data
              </div>
            )}

            {query.trim() && results.length === 0 && (
              <div className="px-4 py-8 text-center text-[12px] text-ink-muted">
                No results for <span className="font-medium text-ink">"{query}"</span>
              </div>
            )}

            {groupedWithIdx.map(group => {
              const meta = TYPES[group.type] || TYPES.link
              return (
                <div key={group.type}>
                  <div className="px-4 pt-3 pb-1 text-[9.5px] font-bold uppercase tracking-widest text-ink-muted">
                    {meta.label}s
                  </div>
                  {group.items.map(item => {
                    const isActive = item._flatIdx === cursor
                    return (
                      <div
                        key={item.id}
                        onMouseEnter={() => setCursor(item._flatIdx)}
                        onClick={() => go(item)}
                        className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${isActive ? 'bg-teal/5' : 'hover:bg-surface'}`}
                      >
                        <span className="text-[15px] shrink-0">{meta.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-[12.5px] font-medium text-ink truncate">
                            {highlight(item.title, query)}
                          </div>
                          {item.sub && (
                            <div className="text-[10.5px] text-ink-muted truncate mt-0.5">
                              {highlight(item.sub, query)}
                            </div>
                          )}
                        </div>
                        <span className={`text-[9.5px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${meta.color}`}>
                          {meta.label}
                        </span>
                        {isActive && (
                          <span className="text-[10px] text-ink-muted shrink-0">↵</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>

          {results.length > 0 && (
            <div className="px-4 py-2 border-t border-border flex items-center gap-3 text-[10px] text-ink-muted bg-surface">
              <span>↑↓ navigate</span>
              <span>↵ open</span>
              <span>esc close</span>
              <span className="ml-auto">{results.length} result{results.length !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
