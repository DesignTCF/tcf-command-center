import { useState, useEffect, useRef } from 'react'
import api from '../lib/api'
import staticData from '../data/staticData'

// ── Icons ─────────────────────────────────────────────────────────────────────
function FolderIcon({ type }) {
  if (type === 'sheet') return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="18" height="18" rx="2" fill="#0F9D58" opacity="0.15"/>
      <rect x="3" y="3" width="18" height="18" rx="2" stroke="#0F9D58" strokeWidth="1.5"/>
      <path d="M7 8h10M7 12h10M7 16h6" stroke="#0F9D58" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
  if (type === 'doc') return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
      <rect x="4" y="2" width="16" height="20" rx="2" fill="#4285F4" opacity="0.12"/>
      <rect x="4" y="2" width="16" height="20" rx="2" stroke="#4285F4" strokeWidth="1.5"/>
      <path d="M8 8h8M8 12h8M8 16h5" stroke="#4285F4" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
      <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" fill="#FBB033" opacity="0.2"/>
      <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" stroke="#FBB033" strokeWidth="1.5"/>
    </svg>
  )
}

const ACCOUNT_COLORS = {
  'design@thecosmeticformulary.com': { bg: 'bg-teal/10',   text: 'text-teal',       short: 'TCF' },
  'design@paulyinc.com':             { bg: 'bg-blue-50',   text: 'text-blue-600',   short: 'Pauly' },
  'tcfdesign.katherinefox@gmail.com':{ bg: 'bg-purple-50', text: 'text-purple-600', short: 'KF' },
}

// ── Edit modal ────────────────────────────────────────────────────────────────
function EditModal({ item, onSave, onClose }) {
  const [form, setForm] = useState({ name: item.name, desc: item.desc || '', url: item.url || '', account: item.account || '', type: item.type || 'folder' })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-[480px]" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-border">
          <div className="text-sm font-semibold text-ink">Edit Folder / File</div>
        </div>
        <div className="px-6 py-4 flex flex-col gap-3">
          <div>
            <label className="label-sm">Name</label>
            <input className="input-field w-full" value={form.name} onChange={e => set('name', e.target.value)} />
          </div>
          <div>
            <label className="label-sm">Description</label>
            <input className="input-field w-full" value={form.desc} onChange={e => set('desc', e.target.value)} placeholder="What's in this folder?" />
          </div>
          <div>
            <label className="label-sm">Google Drive URL</label>
            <input className="input-field w-full font-mono text-xs" value={form.url} onChange={e => set('url', e.target.value)} placeholder="https://drive.google.com/drive/folders/..." />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="label-sm">Account</label>
              <select className="input-field w-full" value={form.account} onChange={e => set('account', e.target.value)}>
                <option value="">— Select account —</option>
                <option value="design@thecosmeticformulary.com">design@thecosmeticformulary.com</option>
                <option value="design@paulyinc.com">design@paulyinc.com</option>
                <option value="tcfdesign.katherinefox@gmail.com">tcfdesign.katherinefox@gmail.com</option>
              </select>
            </div>
            <div style={{ width: 140 }}>
              <label className="label-sm">Type</label>
              <select className="input-field w-full" value={form.type} onChange={e => set('type', e.target.value)}>
                <option value="folder">Folder</option>
                <option value="sheet">Spreadsheet</option>
                <option value="doc">Document</option>
              </select>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost text-sm">Cancel</button>
          <button onClick={() => onSave(form)} disabled={!form.name}
            className="btn-primary text-sm disabled:opacity-40">Save</button>
        </div>
      </div>
    </div>
  )
}

// ── File card ─────────────────────────────────────────────────────────────────
function FileCard({ item, onEdit, onDelete }) {
  const acc = ACCOUNT_COLORS[item.account] || { bg: 'bg-surface2', text: 'text-ink-muted', short: '—' }
  const hasUrl = !!item.url

  return (
    <div className={`group relative bg-white border border-border rounded-xl p-4 flex flex-col gap-3 hover:border-teal/40 hover:shadow-md transition-all ${!hasUrl ? 'opacity-70' : ''}`}>
      {/* Account badge */}
      <div className={`absolute top-3 right-10 text-[9px] font-bold px-1.5 py-0.5 rounded ${acc.bg} ${acc.text}`}>
        {acc.short}
      </div>

      {/* Edit button */}
      <button
        onClick={onEdit}
        className="absolute top-2.5 right-2.5 w-6 h-6 flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 hover:bg-surface2 transition-all text-ink-muted hover:text-ink"
        title="Edit"
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M11.5 2.5l2 2-9 9H2.5v-2L11.5 2.5z"/>
        </svg>
      </button>

      {/* Icon + name */}
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5"><FolderIcon type={item.type} /></div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold text-ink leading-snug">{item.name}</div>
          {item.desc && <div className="text-[11px] text-ink-muted mt-0.5 leading-snug line-clamp-2">{item.desc}</div>}
        </div>
      </div>

      {/* Open button */}
      {hasUrl ? (
        <a
          href={item.url}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg bg-[#1a73e8] hover:bg-[#1558b0] text-white text-[12px] font-semibold transition-colors"
        >
          Open
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M2 10L10 2M10 2H5M10 2v5"/>
          </svg>
        </a>
      ) : (
        <button
          onClick={onEdit}
          className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg border border-dashed border-border text-ink-muted text-[11px] font-medium hover:border-teal/40 hover:text-teal transition-colors"
        >
          + Add link
        </button>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DrivePage() {
  const [groups, setGroups]   = useState([])
  const [editing, setEditing] = useState(null)   // { groupId, item }
  const [adding, setAdding]   = useState(null)   // groupId for new item
  const [newGroup, setNewGroup] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [filterAccount, setFilterAccount] = useState('All')

  useEffect(() => {
    api.get('/data/drive-hub').then(setGroups).catch(() => {
      // fallback: staticData → localStorage
      const stored = localStorage.getItem('tcf-drive-hub')
      if (stored) { try { setGroups(JSON.parse(stored)); return } catch {} }
      if (staticData.driveHub?.length) setGroups(staticData.driveHub)
    })
  }, [])

  function persist(updated) {
    setGroups(updated)
    localStorage.setItem('tcf-drive-hub', JSON.stringify(updated))
    api.post('/data/drive-hub', updated).catch(() => {})
  }

  function saveEdit(form) {
    const updated = groups.map(g => {
      if (g.id !== editing.groupId) return g
      return { ...g, items: g.items.map(it => it.id === editing.item.id ? { ...it, ...form } : it) }
    })
    persist(updated)
    setEditing(null)
  }

  function saveNew(form) {
    const newItem = { id: `f-${Date.now()}`, ...form }
    const updated = groups.map(g =>
      g.id === adding ? { ...g, items: [...g.items, newItem] } : g
    )
    persist(updated)
    setAdding(null)
  }

  function deleteItem(groupId, itemId) {
    if (!confirm('Remove this item?')) return
    const updated = groups.map(g =>
      g.id === groupId ? { ...g, items: g.items.filter(it => it.id !== itemId) } : g
    )
    persist(updated)
    setEditing(null)
  }

  function addGroup() {
    if (!newGroupName.trim()) return
    const updated = [...groups, { id: `grp-${Date.now()}`, group: newGroupName.trim(), items: [] }]
    persist(updated)
    setNewGroup(false); setNewGroupName('')
  }

  function deleteGroup(groupId) {
    if (!confirm('Remove this entire group?')) return
    persist(groups.filter(g => g.id !== groupId))
  }

  const ACCOUNTS = ['All', 'design@thecosmeticformulary.com', 'design@paulyinc.com', 'tcfdesign.katherinefox@gmail.com']

  const totalLinks = groups.reduce((n, g) => n + g.items.filter(i => i.url).length, 0)
  const totalItems = groups.reduce((n, g) => n + g.items.length, 0)

  return (
    <div className="h-full overflow-y-auto bg-[#0D1117]">
      <div className="max-w-[1100px] mx-auto px-8 py-10">

        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-[28px] font-bold text-white mb-2">Katherine's Drive Hub</h1>
          <p className="text-[13px] text-gray-400">Every folder, every account — all in one place. Click any folder to open it. Click the pencil to update the link.</p>
          <div className="mt-3 flex items-center justify-center gap-4 text-[11px] text-gray-500">
            <span>{totalLinks} linked · {totalItems - totalLinks} need links</span>
          </div>
        </div>

        {/* Account filter */}
        <div className="flex items-center gap-2 mb-8 justify-center flex-wrap">
          {ACCOUNTS.map(a => {
            const acc = ACCOUNT_COLORS[a]
            const isActive = filterAccount === a
            return (
              <button
                key={a}
                onClick={() => setFilterAccount(a)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-medium transition-all border ${
                  isActive
                    ? 'bg-white text-[#0D1117] border-white'
                    : 'bg-transparent text-gray-400 border-gray-700 hover:border-gray-400 hover:text-gray-200'
                }`}
              >
                {a === 'All' ? 'All Accounts' : a}
              </button>
            )
          })}
        </div>

        {/* Groups */}
        {groups.map(group => {
          const items = filterAccount === 'All'
            ? group.items
            : group.items.filter(i => i.account === filterAccount)
          if (items.length === 0 && filterAccount !== 'All') return null

          return (
            <div key={group.id} className="mb-10">
              {/* Group header */}
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-[11px] font-bold uppercase tracking-[0.15em] text-gray-400">{group.group}</h2>
                <div className="flex-1 h-px bg-gray-800" />
                <button
                  onClick={() => setAdding(group.id)}
                  className="text-[10px] text-gray-500 hover:text-gray-200 transition-colors px-2 py-1 rounded border border-gray-700 hover:border-gray-500"
                >
                  + Add
                </button>
                <button
                  onClick={() => deleteGroup(group.id)}
                  className="text-[10px] text-gray-600 hover:text-red-400 transition-colors px-1"
                  title="Remove group"
                >
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
                    onDelete={() => deleteItem(group.id, item.id)}
                  />
                ))}

                {/* Add card placeholder */}
                {adding === group.id && (
                  <div className="bg-white border border-dashed border-teal/40 rounded-xl p-4 flex items-center justify-center">
                    <button
                      onClick={() => setEditing({ groupId: group.id, item: { id: `f-${Date.now()}`, name: '', desc: '', url: '', account: 'design@thecosmeticformulary.com', type: 'folder' }, isNew: true })}
                      className="text-sm text-teal font-medium hover:underline"
                    >
                      Fill in details →
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {/* Add group */}
        <div className="mt-8 border-t border-gray-800 pt-8">
          {newGroup ? (
            <div className="flex items-center gap-3 max-w-sm mx-auto">
              <input
                autoFocus
                className="input-field flex-1 bg-gray-900 border-gray-700 text-white placeholder:text-gray-600"
                placeholder="Group name (e.g. Marketing)"
                value={newGroupName}
                onChange={e => setNewGroupName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addGroup(); if (e.key === 'Escape') setNewGroup(false) }}
              />
              <button onClick={addGroup} className="btn-primary text-sm">Add</button>
              <button onClick={() => setNewGroup(false)} className="btn-ghost text-sm text-gray-400">Cancel</button>
            </div>
          ) : (
            <div className="text-center">
              <button
                onClick={() => setNewGroup(true)}
                className="px-4 py-2 rounded-lg border border-dashed border-gray-700 text-gray-500 text-[12px] hover:border-gray-400 hover:text-gray-200 transition-colors"
              >
                + Add new group
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Edit modal */}
      {editing && (
        <EditModal
          item={editing.item}
          onSave={editing.isNew ? saveNew : saveEdit}
          onClose={() => { setEditing(null); setAdding(null) }}
        />
      )}
    </div>
  )
}
