import { useState, useMemo, useEffect } from 'react'
import { useApp } from '../store/AppContext'
import { fmtDate, fmtDateShort, isOverdue } from '../lib/utils'
import StatusBadge from '../components/StatusBadge'
import Modal from '../components/Modal'
import EmptyState from '../components/EmptyState'
import api from '../lib/api'

const STATUSES = ['Active', 'Waiting Reply', 'Replied', 'Quoted', 'Negotiating', 'Sample Requested', 'Sample Received', 'Ordered', 'Closed']
const PRODUCT_TYPES = ['Bottle', 'Jar', 'Pump', 'Cap', 'Label', 'Box', 'Tube', 'Dropper', 'Bag', 'Other']

const STATUS_COLORS = {
  'Waiting Reply':    'text-amber bg-amber/10 border-amber/40',
  'Quoted':           'text-gold bg-gold/10 border-gold/40',
  'Negotiating':      'text-purple bg-purple/10 border-purple/40',
  'Sample Requested': 'text-blue bg-blue/10 border-blue/40',
  'Sample Received':  'text-teal bg-teal/10 border-teal/40',
  'Replied':          'text-blue bg-blue/10 border-blue/40',
  'Active':           'text-teal bg-teal/10 border-teal/40',
  'Ordered':          'text-green bg-green/10 border-green/40',
  'Closed':           'text-ink-muted bg-surface2 border-border',
}

// Group conversations by urgency
const GROUPS = [
  { id: 'action',   label: '🔴 Needs Your Reply',    filter: c => c.needsReply || c.hasUnread || c.status === 'Waiting Reply' },
  { id: 'active',   label: '🟡 Active Conversations', filter: c => !c.needsReply && !c.hasUnread && ['Active','Quoted','Negotiating','Sample Requested','Sample Received','Replied'].includes(c.status) },
  { id: 'complete', label: '✅ Ordered / Closed',     filter: c => ['Ordered','Closed'].includes(c.status) },
]

const REPLY_TEMPLATES = {
  intro:     `Hi [Name],\n\nI'm reaching out regarding pricing and availability for [Product]. We're a cosmetic manufacturing company based in Charleston, SC.\n\nCould you please provide:\n1. Unit pricing at MOQs of [X], [Y], and [Z] units\n2. Lead time for samples and production\n3. Customization options (color, finish, logo)\n4. Sample cost and availability\n\nThank you,\nKatherine Fox\nThe Cosmetic Formulary`,
  followup:  `Hi [Name],\n\nI wanted to follow up on my previous message regarding [Product]. Could you please share the pricing information when you get a chance?\n\nWe're on a timeline to make a decision, so any information you can provide would be very helpful.\n\nThank you,\nKatherine Fox\nThe Cosmetic Formulary`,
  sample:    `Hi [Name],\n\nThank you for the quote. We'd like to move forward with requesting a sample of [Product].\n\nShipping address:\nThe Cosmetic Formulary\nCharleston, SC\n\nPlease confirm the sample cost and estimated delivery time.\n\nThank you,\nKatherine Fox`,
  negotiate: `Hi [Name],\n\nThank you for the quote. We're very interested but hoping to get closer to [Target Price] per unit.\n\nWould this be possible if we committed to [Quantity] units for our initial order?\n\nBest regards,\nKatherine Fox\nThe Cosmetic Formulary`,
}

function StatusPill({ status }) {
  const cls = STATUS_COLORS[status] || 'text-ink-muted bg-surface2 border-border'
  return <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[10.5px] font-semibold uppercase ${cls}`}>{status}</span>
}

export default function Alibaba() {
  const { state, dispatch } = useApp()
  const [selectedConvo, setSelectedConvo] = useState(null)
  const [draftedReply, setDraftedReply] = useState('')
  const [draftLoading, setDraftLoading] = useState(false)
  const [copySuccess, setCopySuccess] = useState(false)
  const [modal, setModal] = useState(null)
  const [search, setSearch] = useState('')
  const [templatePick, setTemplatePick] = useState(false)
  const [syncedData, setSyncedData] = useState({ conversations: [], lastSync: null })
  const [activeGroup, setActiveGroup] = useState('all')

  // Load synced conversations from bookmarklet
  useEffect(() => {
    api.get('/api/alibaba-sync').then(d => setSyncedData(d)).catch(() => {})
  }, [])

  // Combine manual + synced conversations, dedup by supplier name
  const allConvos = useMemo(() => {
    const manual = state.alibabaCo || []
    const synced = (syncedData.conversations || []).filter(sc =>
      !manual.some(m => m.supplierName?.toLowerCase() === sc.supplierName?.toLowerCase())
    ).map(sc => ({ ...sc, source: 'synced' }))
    return [...manual, ...synced].filter(c => {
      if (!search) return true
      const q = search.toLowerCase()
      return c.supplierName?.toLowerCase().includes(q) || c.product?.toLowerCase().includes(q)
    })
  }, [state.alibabaCo, syncedData, search])

  // Stats
  const needsReplyCount = allConvos.filter(c => c.needsReply || c.hasUnread || c.status === 'Waiting Reply').length
  const activeCount = allConvos.filter(c => ['Active','Quoted','Negotiating','Sample Requested','Sample Received','Replied'].includes(c.status)).length
  const orderedCount = allConvos.filter(c => ['Ordered','Closed'].includes(c.status)).length

  // Filtered by group
  const displayed = useMemo(() => {
    if (activeGroup === 'all') return allConvos
    const group = GROUPS.find(g => g.id === activeGroup)
    return group ? allConvos.filter(group.filter) : allConvos
  }, [allConvos, activeGroup])

  // Group for display
  const grouped = useMemo(() => {
    if (activeGroup !== 'all') return { [activeGroup]: displayed }
    const g = {}
    GROUPS.forEach(grp => {
      const items = allConvos.filter(grp.filter)
      if (items.length > 0) g[grp.id] = { label: grp.label, items }
    })
    return g
  }, [allConvos, activeGroup, displayed])

  const convoFields = (c = {}) => [
    { id: 'supplierName', label: 'Supplier Name', type: 'text', value: c.supplierName || '' },
    { id: 'supplierUrl', label: 'Alibaba URL', type: 'text', value: c.supplierUrl || '' },
    { id: 'product', label: 'Product', type: 'text', value: c.product || '' },
    { id: 'productType', label: 'Product Type', type: 'select', options: PRODUCT_TYPES, value: c.productType || 'Bottle' },
    { id: 'status', label: 'Status', type: 'select', options: STATUSES, value: c.status || 'Active' },
    { id: 'quotedPrice', label: 'Quoted Price (per unit)', type: 'text', value: c.quotedPrice || '' },
    { id: 'moq', label: 'MOQ', type: 'text', value: c.moq || '' },
    { id: 'leadTime', label: 'Lead Time', type: 'text', value: c.leadTime || '' },
    { id: 'lastContactDate', label: 'Last Contact', type: 'date', value: c.lastContactDate || '' },
    { id: 'followUpDate', label: 'Follow-Up Date', type: 'date', value: c.followUpDate || '' },
    { id: 'lastMessage', label: 'Last Message Received', type: 'textarea', value: c.lastMessage || '' },
    { id: 'notes', label: 'Notes', type: 'textarea', value: c.notes || '' },
  ]

  async function save(data) {
    try {
      if (modal?.convo) {
        const u = await api.patch(`/data/alibaba-convos/${modal.convo.id}`, data)
        dispatch({ type: 'UPDATE', key: 'alibabaCo', id: modal.convo.id, value: u })
      } else {
        const c = await api.post('/data/alibaba-convos', data)
        dispatch({ type: 'ADD', key: 'alibabaCo', value: c })
      }
    } catch {
      const item = { id: Date.now().toString(), ...data }
      if (modal?.convo) dispatch({ type: 'UPDATE', key: 'alibabaCo', id: modal.convo.id, value: data })
      else dispatch({ type: 'ADD', key: 'alibabaCo', value: item })
    }
    setModal(null)
  }

  async function remove(id) {
    if (!confirm('Remove this conversation?')) return
    await api.del(`/data/alibaba-convos/${id}`)
    dispatch({ type: 'DELETE', key: 'alibabaCo', id })
    if (selectedConvo?.id === id) setSelectedConvo(null)
    setModal(null)
  }

  async function draftAIReply(convo) {
    setDraftLoading(true); setDraftedReply('')
    try {
      const res = await api.post('/ai/chat', {
        message: `Draft a professional reply for Katherine Fox (The Cosmetic Formulary, Charleston SC) to send to this Alibaba supplier.\n\nSupplier: ${convo.supplierName}\nProduct: ${convo.product}\nStatus: ${convo.status}\nQuoted Price: ${convo.quotedPrice || 'not quoted'}\nMOQ: ${convo.moq || 'unknown'}\nLast message: "${convo.lastMessage || 'No message recorded'}"\nNotes: ${convo.notes || 'none'}\n\nWrite a concise, professional reply appropriate for the current status. Sign as Katherine Fox, The Cosmetic Formulary. Under 200 words.`,
        context: {}
      })
      setDraftedReply(res.reply)
    } catch (err) {
      setDraftedReply('Add your ANTHROPIC_API_KEY to .env to enable AI drafts.')
    } finally { setDraftLoading(false) }
  }

  function copyReply() {
    navigator.clipboard.writeText(draftedReply)
    setCopySuccess(true)
    setTimeout(() => setCopySuccess(false), 2000)
  }

  return (
    <div className="h-full flex overflow-hidden">

      {/* ── LEFT: Conversation List ────────────────────────── */}
      <div className="w-[340px] border-r border-border flex flex-col shrink-0">

        {/* Header + stats */}
        <div className="px-4 py-3 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="font-semibold text-sm text-ink">Alibaba Suppliers</div>
              <div className="text-[10.5px] text-ink-muted mt-0.5">
                {syncedData.lastSync ? `Last synced ${fmtDateShort(syncedData.lastSync)}` : 'Not yet synced from Alibaba'}
              </div>
            </div>
            <div className="flex gap-2">
              <a href="/alibaba-sync-setup" className="btn-ghost text-xs py-1">📦 Setup Sync</a>
              <button className="btn-primary text-xs py-1" onClick={() => setModal({})}>+ Add</button>
            </div>
          </div>

          {/* Stat pills */}
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { id: 'action',   label: 'Need Reply', count: needsReplyCount, color: needsReplyCount > 0 ? 'bg-amber/10 text-amber border-amber/30' : 'bg-surface2 text-ink-muted border-border' },
              { id: 'active',   label: 'Active',     count: activeCount,     color: 'bg-teal/10 text-teal border-teal/30' },
              { id: 'complete', label: 'Ordered',    count: orderedCount,    color: 'bg-green/10 text-green border-green/30' },
            ].map(s => (
              <button key={s.id}
                onClick={() => setActiveGroup(activeGroup === s.id ? 'all' : s.id)}
                className={`rounded-lg border px-2 py-2 text-center transition-all ${s.color} ${activeGroup === s.id ? 'ring-2 ring-offset-1 ring-teal/40' : ''}`}>
                <div className="text-lg font-bold leading-none">{s.count}</div>
                <div className="text-[10px] font-semibold uppercase tracking-wide mt-0.5">{s.label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className="px-3 py-2 border-b border-border">
          <input type="text" placeholder="Search suppliers or products…" value={search}
            onChange={e => setSearch(e.target.value)} className="input-field text-xs w-full" />
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {Object.keys(grouped).length === 0 ? (
            <EmptyState message="No conversations yet" action="Add your first supplier" onAction={() => setModal({})} />
          ) : (
            Object.entries(grouped).map(([groupId, group]) => {
              const groupLabel = GROUPS.find(g => g.id === groupId)?.label || group.label
              const items = group.items || displayed

              return (
                <div key={groupId}>
                  {activeGroup === 'all' && (
                    <div className="px-3 py-2 bg-surface border-b border-border">
                      <div className="text-[10.5px] font-bold text-ink-muted uppercase tracking-wider">{groupLabel}</div>
                    </div>
                  )}
                  {items.map(c => {
                    const overdue = isOverdue(c.followUpDate) && !['Ordered','Closed'].includes(c.status)
                    const urgent = c.needsReply || c.hasUnread || c.status === 'Waiting Reply'
                    const selected = selectedConvo?.id === c.id

                    return (
                      <div key={c.id}
                        onClick={() => { setSelectedConvo(c); setDraftedReply('') }}
                        className={`px-4 py-3 cursor-pointer border-b border-border transition-colors ${selected ? 'bg-teal/5 border-l-2 border-l-teal' : 'hover:bg-surface'} ${urgent && !selected ? 'border-l-2 border-l-amber' : ''}`}>

                        <div className="flex items-start justify-between gap-2 mb-1">
                          <span className="font-semibold text-sm text-ink truncate">{c.supplierName || 'Unnamed'}</span>
                          <StatusPill status={c.status || 'Active'} />
                        </div>

                        <div className="text-xs text-ink-muted truncate mb-1.5">{c.product || '—'}</div>

                        <div className="flex items-center gap-3 flex-wrap">
                          {c.quotedPrice && <span className="text-[10.5px] font-semibold text-gold">{c.quotedPrice}/unit</span>}
                          {c.moq && <span className="text-[10.5px] text-ink-muted">MOQ: {c.moq}</span>}
                          {c.source === 'synced' && <span className="text-[9px] bg-teal/10 text-teal px-1.5 py-0.5 rounded font-semibold">SYNCED</span>}
                          {overdue && <span className="text-[10px] text-amber font-semibold ml-auto">Follow-up overdue</span>}
                          {urgent && !overdue && <span className="text-[10px] text-amber font-semibold ml-auto">Awaiting reply</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* ── RIGHT: Conversation Detail ─────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!selectedConvo ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-ink-muted">
            <div className="text-4xl opacity-20">💬</div>
            <div className="text-sm text-center">Select a conversation to view details<br/>and draft replies</div>
          </div>
        ) : (
          <>
            {/* Detail header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-base font-semibold text-ink">{selectedConvo.supplierName}</h2>
                  <StatusPill status={selectedConvo.status || 'Active'} />
                  {selectedConvo.source === 'synced' && (
                    <span className="text-[10px] bg-teal/10 text-teal px-1.5 py-0.5 rounded border border-teal/20 font-semibold">Synced from Alibaba</span>
                  )}
                </div>
                <div className="text-sm text-ink-muted mt-0.5">{selectedConvo.product}</div>
              </div>
              <div className="flex gap-2 shrink-0">
                {selectedConvo.supplierUrl && (
                  <a href={selectedConvo.supplierUrl} target="_blank" rel="noopener" className="btn-ghost text-xs">View on Alibaba ↗</a>
                )}
                <button className="btn-ghost text-xs" onClick={() => setModal({ convo: selectedConvo })}>Edit</button>
                <button className="btn-icon text-ink-muted hover:text-red" onClick={() => remove(selectedConvo.id)}>✕</button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* Specs */}
              <div className="grid grid-cols-4 gap-px bg-border border-b border-border shrink-0">
                {[
                  { label: 'Quoted Price', value: selectedConvo.quotedPrice || '—', accent: true },
                  { label: 'MOQ', value: selectedConvo.moq || '—' },
                  { label: 'Lead Time', value: selectedConvo.leadTime || '—' },
                  { label: 'Follow-Up', value: selectedConvo.followUpDate ? fmtDate(selectedConvo.followUpDate) : '—', overdue: isOverdue(selectedConvo.followUpDate) },
                ].map(s => (
                  <div key={s.label} className="bg-white px-4 py-3">
                    <div className="text-[10px] uppercase tracking-wider text-ink-muted mb-0.5">{s.label}</div>
                    <div className={`text-sm font-semibold ${s.accent ? 'text-gold' : s.overdue ? 'text-red' : 'text-ink'}`}>{s.value}</div>
                  </div>
                ))}
              </div>

              <div className="p-5 grid grid-cols-2 gap-5">
                {/* Last message */}
                <div>
                  <div className="section-title mb-2">Last Message from Supplier</div>
                  <div className="bg-surface rounded-lg border border-border p-3 text-sm text-ink leading-relaxed min-h-[80px]">
                    {selectedConvo.lastMessage || <span className="text-ink-muted italic">No message recorded yet</span>}
                  </div>
                  {selectedConvo.lastContactDate && (
                    <div className="text-[10.5px] text-ink-muted mt-1.5">{fmtDate(selectedConvo.lastContactDate)}</div>
                  )}
                </div>

                {/* Notes */}
                <div>
                  <div className="section-title mb-2">Notes</div>
                  <div className="bg-surface rounded-lg border border-border p-3 text-sm text-ink leading-relaxed min-h-[80px]">
                    {selectedConvo.notes || <span className="text-ink-muted italic">No notes</span>}
                  </div>
                </div>
              </div>

              {/* Reply drafting */}
              <div className="px-5 pb-5">
                <div className="border border-border rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 bg-surface border-b border-border">
                    <div className="section-title">Draft Reply</div>
                    <div className="flex gap-2">
                      {/* Templates */}
                      <div className="relative">
                        <button className="btn-ghost text-xs" onClick={() => setTemplatePick(p => !p)}>Templates ▾</button>
                        {templatePick && (
                          <div className="absolute right-0 top-8 z-10 bg-white border border-border rounded-lg shadow-lg w-44 overflow-hidden">
                            {[
                              { key: 'intro', label: 'Introduction' },
                              { key: 'followup', label: 'Follow-up' },
                              { key: 'sample', label: 'Request Sample' },
                              { key: 'negotiate', label: 'Negotiate Price' },
                            ].map(t => (
                              <button key={t.key} onClick={() => { setDraftedReply(REPLY_TEMPLATES[t.key]); setTemplatePick(false) }}
                                className="w-full text-left px-3 py-2.5 text-xs text-ink hover:bg-surface transition-colors border-b border-border last:border-0">
                                {t.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <button onClick={() => draftAIReply(selectedConvo)} disabled={draftLoading}
                        className="btn-primary text-xs disabled:opacity-50">
                        {draftLoading ? '✦ Writing…' : '✦ AI Draft'}
                      </button>
                    </div>
                  </div>

                  <div className="p-4">
                    <textarea value={draftedReply} onChange={e => setDraftedReply(e.target.value)}
                      placeholder="Click '✦ AI Draft' to generate a reply, or choose a template above."
                      className="input-field text-sm w-full leading-relaxed" rows={8} />
                    {draftedReply && (
                      <div className="flex items-center gap-3 mt-3">
                        <button onClick={copyReply} className="btn-primary text-xs">
                          {copySuccess ? '✓ Copied!' : '⧉ Copy to Clipboard'}
                        </button>
                        <span className="text-[10.5px] text-ink-muted">Paste directly into Alibaba messenger</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <Modal open={!!modal} title={modal?.convo ? 'Edit Conversation' : 'Add Alibaba Supplier'}
        fields={convoFields(modal?.convo)} onSave={save} onClose={() => setModal(null)}
        onDelete={modal?.convo ? () => remove(modal.convo.id) : null} />
    </div>
  )
}
