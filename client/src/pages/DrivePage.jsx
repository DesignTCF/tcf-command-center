import { useState, useEffect } from 'react'
import api from '../lib/api'
import staticData from '../data/staticData'

// ── File type icons ───────────────────────────────────────────────────────────
function FileIcon({ type }) {
  if (type === 'sheet') return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="18" height="18" rx="2" fill="#0F9D58" opacity="0.15"/>
      <rect x="3" y="3" width="18" height="18" rx="2" stroke="#0F9D58" strokeWidth="1.5"/>
      <path d="M7 8h10M7 12h10M7 16h6" stroke="#0F9D58" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
  if (type === 'doc') return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="4" y="2" width="16" height="20" rx="2" fill="#4285F4" opacity="0.12"/>
      <rect x="4" y="2" width="16" height="20" rx="2" stroke="#4285F4" strokeWidth="1.5"/>
      <path d="M8 8h8M8 12h8M8 16h5" stroke="#4285F4" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
  if (type === 'slides') return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="2" y="4" width="20" height="16" rx="2" fill="#F4B400" opacity="0.15"/>
      <rect x="2" y="4" width="20" height="16" rx="2" stroke="#F4B400" strokeWidth="1.5"/>
      <rect x="6" y="8" width="12" height="8" rx="1" stroke="#F4B400" strokeWidth="1"/>
    </svg>
  )
  // folder (default)
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" fill="#FBB033" opacity="0.18"/>
      <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" stroke="#FBB033" strokeWidth="1.5"/>
    </svg>
  )
}

const ACCOUNT_COLORS = {
  'design@thecosmeticformulary.com': { dot: 'bg-teal',       label: 'TCF' },
  'design@paulyinc.com':             { dot: 'bg-blue-400',   label: 'Pauly' },
  'tcfdesign.katherinefox@gmail.com':{ dot: 'bg-purple-400', label: 'KF' },
}

const ACCOUNTS = [
  'design@thecosmeticformulary.com',
  'design@paulyinc.com',
  'tcfdesign.katherinefox@gmail.com',
]

// ── Edit / Add modal ──────────────────────────────────────────────────────────
function ItemModal({ item, onSave, onClose, onDelete }) {
  const [form, setForm] = useState({
    name:    item?.name    || '',
    desc:    item?.desc    || '',
    url:     item?.url     || '',
    account: item?.account || 'design@thecosmeticformulary.com',
    type:    item?.type    || 'folder',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const isNew = !item?.id

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-[480px]" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-border">
          <div className="text-sm font-semibold text-ink">{isNew ? 'Add File or Folder' : 'Edit'}</div>
        </div>
        <div className="px-6 py-4 flex flex-col gap-3">
          <div>
            <label className="label-sm">Name</label>
            <input className="input-field w-full" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. NeVoo Brand Assets" autoFocus />
          </div>
          <div>
            <label className="label-sm">Description</label>
            <input className="input-field w-full" value={form.desc} onChange={e => set('desc', e.target.value)} placeholder="Brief description of what's inside" />
          </div>
          <div>
            <label className="label-sm">Google Drive URL</label>
            <input className="input-field w-full text-xs font-mono" value={form.url} onChange={e => set('url', e.target.value)} placeholder="https://drive.google.com/drive/folders/…" />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="label-sm">Account</label>
              <select className="input-field w-full" value={form.account} onChange={e => set('account', e.target.value)}>
                {ACCOUNTS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div style={{ width: 130 }}>
              <label className="label-sm">Type</label>
              <select className="input-field w-full" value={form.type} onChange={e => set('type', e.target.value)}>
                <option value="folder">Folder</option>
                <option value="sheet">Spreadsheet</option>
                <option value="doc">Document</option>
                <option value="slides">Slides</option>
              </select>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-border flex items-center">
          {!isNew && onDelete && (
            <button onClick={onDelete} className="text-xs text-red hover:underline mr-auto">Remove</button>
          )}
          <div className="flex gap-2 ml-auto">
            <button onClick={onClose} className="btn-ghost text-sm">Cancel</button>
            <button onClick={() => onSave(form)} disabled={!form.name}
              className="btn-primary text-sm disabled:opacity-40">Save</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── File card ─────────────────────────────────────────────────────────────────
function FileCard({ item, onEdit }) {
  const acc = ACCOUNT_COLORS[item.account] || { dot: 'bg-surface3', label: '—' }
  const hasUrl = !!item.url?.trim()

  return (
    <div className={`group relative bg-white border rounded-xl p-4 flex flex-col gap-3 transition-all hover:shadow-md ${hasUrl ? 'border-border hover:border-teal/30' : 'border-dashed border-border'}`}>

      {/* Account dot + edit */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full ${acc.dot}`} title={item.account} />
        <button
          onClick={onEdit}
          className="w-5 h-5 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-surface2 transition-all text-ink-muted"
        >
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M11.5 2.5l2 2-9 9H2.5v-2L11.5 2.5z"/>
          </svg>
        </button>
      </div>

      {/* Icon + name */}
      <div className="flex items-start gap-3 pr-10">
        <div className="shrink-0 mt-0.5"><FileIcon type={item.type} /></div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold text-ink leading-snug">{item.name}</div>
          {item.desc && (
            <div className="text-[11px] text-ink-muted mt-0.5 leading-snug line-clamp-2">{item.desc}</div>
          )}
        </div>
      </div>

      {/* Open / Add link */}
      {hasUrl ? (
        <a href={item.url} target="_blank" rel="noreferrer"
          className="flex items-center justify-center gap-1.5 py-2 rounded-lg bg-teal hover:bg-teal/90 text-white text-[12px] font-semibold transition-colors">
          Open
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M2 10L10 2M10 2H5M10 2v5"/>
          </svg>
        </a>
      ) : (
        <button onClick={onEdit}
          className="flex items-center justify-center gap-1 py-2 rounded-lg border border-dashed border-border text-ink-muted text-[11px] hover:border-teal/50 hover:text-teal transition-colors">
          + Paste Drive link
        </button>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DrivePage() {
  const [groups, setGroups]     = useState([])
  const [editing, setEditing]   = useState(null)   // { groupId, item } | null
  const [adding, setAdding]     = useState(null)   // groupId | null
  const [addingGroup, setAddingGroup] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [filterAcc, setFilterAcc] = useState('All')

  useEffect(() => {
    api.get('/data/drive-hub').then(d => { if (d?.length) setGroups(d) }).catch(() => {
      try {
        const stored = localStorage.getItem('tcf-drive-hub')
        if (stored) { setGroups(JSON.parse(stored)); return }
      } catch {}
      if (staticData.driveHub?.length) setGroups(staticData.driveHub)
    })
  }, [])

  function persist(updated) {
    setGroups(updated)
    localStorage.setItem('tcf-drive-hub', JSON.stringify(updated))
    api.post('/data/drive-hub', updated).catch(() => {})
  }

  function saveItem(form) {
    let updated
    if (editing?.item?.id) {
      // Edit existing
      updated = groups.map(g =>
        g.id !== editing.groupId ? g
          : { ...g, items: g.items.map(it => it.id === editing.item.id ? { ...it, ...form } : it) }
      )
    } else {
      // Add new to group
      const newItem = { id: `f-${Date.now()}`, ...form }
      updated = groups.map(g =>
        g.id !== adding ? g : { ...g, items: [...g.items, newItem] }
      )
    }
    persist(updated)
    setEditing(null); setAdding(null)
  }

  function deleteItem(groupId, itemId) {
    if (!confirm('Remove this item?')) return
    persist(groups.map(g =>
      g.id !== groupId ? g : { ...g, items: g.items.filter(i => i.id !== itemId) }
    ))
    setEditing(null)
  }

  function deleteGroup(groupId) {
    if (!confirm('Remove this group and all its items?')) return
    persist(groups.filter(g => g.id !== groupId))
  }

  function addGroup() {
    if (!newGroupName.trim()) return
    persist([...groups, { id: `grp-${Date.now()}`, group: newGroupName.trim(), items: [] }])
    setAddingGroup(false); setNewGroupName('')
  }

  const totalLinked = groups.reduce((n, g) => n + g.items.filter(i => i.url).length, 0)
  const totalItems  = groups.reduce((n, g) => n + g.items.length, 0)

  return (
    <div className="page-scroll">

      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[18px] font-bold text-ink">Drive Hub</h1>
          <p className="text-[12px] text-ink-muted mt-0.5">
            All your Google Drive files and folders across all 3 accounts in one place.
            {totalItems > 0 && ` · ${totalLinked} of ${totalItems} linked`}
          </p>
        </div>

        {/* Account filter */}
        <div className="flex items-center gap-1.5">
          {['All', ...ACCOUNTS].map(a => {
            const acc = ACCOUNT_COLORS[a]
            const label = a === 'All' ? 'All' : (acc?.label || a)
            return (
              <button key={a} onClick={() => setFilterAcc(a)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors border ${
                  filterAcc === a
                    ? 'bg-teal text-white border-teal'
                    : 'bg-white text-ink-muted border-border hover:border-teal/40 hover:text-ink'
                }`}>
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Empty state */}
      {groups.length === 0 && (
        <div className="panel p-10 text-center">
          <div className="text-3xl mb-3">📁</div>
          <div className="text-sm font-semibold text-ink mb-1">No folders yet</div>
          <div className="text-xs text-ink-muted mb-4">Add a group, then paste your Google Drive folder or file links.</div>
          <button onClick={() => setAddingGroup(true)} className="btn-primary text-sm">+ Add First Group</button>
        </div>
      )}

      {/* Groups */}
      {groups.map(group => {
        const items = filterAcc === 'All'
          ? group.items
          : group.items.filter(i => i.account === filterAcc)
        if (items.length === 0 && filterAcc !== 'All') return null

        return (
          <div key={group.id} className="mb-8">
            {/* Group header */}
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-[11px] font-bold uppercase tracking-widest text-ink-muted">{group.group}</h2>
              <div className="flex-1 h-px bg-border" />
              <button onClick={() => setAdding(group.id)}
                className="text-[11px] text-teal hover:underline font-medium">
                + Add
              </button>
              <button onClick={() => deleteGroup(group.id)}
                className="text-[11px] text-ink-muted hover:text-red transition-colors">
                ✕
              </button>
            </div>

            {/* Card grid */}
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
              {items.map(item => (
                <FileCard
                  key={item.id}
                  item={item}
                  onEdit={() => setEditing({ groupId: group.id, item })}
                />
              ))}
            </div>

            {items.length === 0 && (
              <div className="text-[11px] text-ink-muted py-4 text-center border border-dashed border-border rounded-xl">
                No items yet — click + Add to paste a Drive link
              </div>
            )}
          </div>
        )
      })}

      {/* Add new group */}
      <div className="mt-4">
        {addingGroup ? (
          <div className="flex items-center gap-2 max-w-sm">
            <input autoFocus className="input-field flex-1" placeholder="Group name (e.g. Brands, Formulation…)"
              value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addGroup(); if (e.key === 'Escape') setAddingGroup(false) }} />
            <button onClick={addGroup} className="btn-primary text-sm">Add</button>
            <button onClick={() => { setAddingGroup(false); setNewGroupName('') }} className="btn-ghost text-sm">Cancel</button>
          </div>
        ) : (
          <button onClick={() => setAddingGroup(true)}
            className="text-[12px] text-ink-muted hover:text-teal border border-dashed border-border hover:border-teal/40 px-4 py-2.5 rounded-xl transition-colors w-full">
            + Add new group
          </button>
        )}
      </div>

      {/* Edit / Add modal */}
      {(editing || adding) && (
        <ItemModal
          item={editing?.item || null}
          onSave={saveItem}
          onClose={() => { setEditing(null); setAdding(null) }}
          onDelete={editing?.item?.id ? () => deleteItem(editing.groupId, editing.item.id) : null}
        />
      )}
    </div>
  )
}
