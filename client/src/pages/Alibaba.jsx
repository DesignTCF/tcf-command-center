import { useState, useMemo } from 'react'
import { useApp } from '../store/AppContext'
import { fmtDate, fmtDateShort, isOverdue } from '../lib/utils'
import Modal from '../components/Modal'
import EmptyState from '../components/EmptyState'
import api from '../lib/api'

const STATUSES = ['Active', 'Waiting Reply', 'Replied', 'Quoted', 'Negotiating', 'Sample Requested', 'Sample Received', 'Ordered', 'Closed']
const STATUS_COLORS = {
  Active: 'text-teal border-teal/40 bg-teal/10',
  'Waiting Reply': 'text-amber border-amber/40 bg-amber/10',
  Replied: 'text-blue border-blue/40 bg-blue/10',
  Quoted: 'text-gold border-gold/40 bg-gold/10',
  Negotiating: 'text-purple border-purple/40 bg-purple/10',
  'Sample Requested': 'text-teal border-teal/40 bg-teal/10',
  'Sample Received': 'text-green border-green/40 bg-green/10',
  Ordered: 'text-green border-green/40 bg-green/10',
  Closed: 'text-ink-muted border-border bg-surface3',
}
const SORT_OPTIONS = ['Last Contact', 'Status', 'Supplier', 'Product']
const PRODUCT_TYPES = ['Bottle', 'Jar', 'Pump', 'Cap', 'Label', 'Box', 'Tube', 'Dropper', 'Bag', 'Other']

const REPLY_TEMPLATES = {
  intro: `Hi [Name],\n\nI'm reaching out regarding pricing and availability for [Product]. We're a cosmetic manufacturing company based in Charleston, SC working on a project that requires this item.\n\nCould you please provide:\n1. Unit pricing at MOQs of [X], [Y], and [Z] units\n2. Lead time for samples and production\n3. Customization options (color, finish, logo)\n4. Sample cost and availability\n\nThank you,\nKatherine Fox\nThe Cosmetic Formulary`,
  followup: `Hi [Name],\n\nI wanted to follow up on my previous message regarding [Product]. Could you please share the pricing information when you get a chance?\n\nWe're on a timeline to make a decision by [Date], so any information you can provide would be very helpful.\n\nThank you,\nKatherine Fox\nThe Cosmetic Formulary`,
  sample: `Hi [Name],\n\nThank you for the quote. We'd like to move forward with requesting a sample of [Product].\n\nShipping address:\nThe Cosmetic Formulary\nCharleston, SC\n\nPlease confirm the sample cost and payment method, and let us know the estimated delivery time.\n\nThank you,\nKatherine Fox`,
  negotiate: `Hi [Name],\n\nThank you for the quote of [Price] per unit at [MOQ] MOQ. We're very interested in working with you, however we were hoping to achieve a price closer to [Target Price] per unit. \n\nWould this be possible, especially if we committed to [Higher Quantity] units for our initial order?\n\nWe look forward to building a long-term relationship with your company.\n\nBest regards,\nKatherine Fox\nThe Cosmetic Formulary`,
}

export default function Alibaba() {
  const { state, dispatch } = useApp()
  const [sort, setSort] = useState('Last Contact')
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null)
  const [selectedConvo, setSelectedConvo] = useState(null)
  const [draftLoading, setDraftLoading] = useState(false)
  const [draftedReply, setDraftedReply] = useState('')
  const [copySuccess, setCopySuccess] = useState(false)
  const [templatePick, setTemplatePick] = useState(null)

  const convos = state.alibabaCo || state['alibaba-convos'] || []

  const filtered = useMemo(() => {
    let items = [...convos]
    if (statusFilter !== 'all') items = items.filter(c => c.status === statusFilter)
    if (search) {
      const q = search.toLowerCase()
      items = items.filter(c =>
        c.supplierName?.toLowerCase().includes(q) ||
        c.product?.toLowerCase().includes(q) ||
        c.waitingOn?.toLowerCase().includes(q)
      )
    }
    items.sort((a, b) => {
      if (sort === 'Last Contact') return (b.lastContactDate || '').localeCompare(a.lastContactDate || '')
      if (sort === 'Status') return (a.status || '').localeCompare(b.status || '')
      if (sort === 'Supplier') return (a.supplierName || '').localeCompare(b.supplierName || '')
      if (sort === 'Product') return (a.product || '').localeCompare(b.product || '')
      return 0
    })
    return items
  }, [convos, statusFilter, search, sort])

  const convoFields = (c = {}) => [
    { id: 'supplierName', label: 'Supplier Name', type: 'text', value: c.supplierName || '', placeholder: 'e.g. Zhejiang Poya Co.' },
    { id: 'supplierUrl', label: 'Alibaba Profile URL', type: 'text', value: c.supplierUrl || '', placeholder: 'https://alibaba.com/...' },
    { id: 'product', label: 'Product', type: 'text', value: c.product || '', placeholder: 'e.g. 30ml Frosted Glass Dropper' },
    { id: 'productType', label: 'Product Type', type: 'select', options: PRODUCT_TYPES, value: c.productType || 'Bottle' },
    { id: 'status', label: 'Status', type: 'select', options: STATUSES, value: c.status || 'Active' },
    { id: 'quotedPrice', label: 'Quoted Price (per unit)', type: 'text', value: c.quotedPrice || '', placeholder: '$0.00' },
    { id: 'moq', label: 'MOQ', type: 'text', value: c.moq || '', placeholder: 'e.g. 1,000' },
    { id: 'leadTime', label: 'Lead Time', type: 'text', value: c.leadTime || '', placeholder: 'e.g. 8 weeks' },
    { id: 'lastContactDate', label: 'Last Contact Date', type: 'date', value: c.lastContactDate || '' },
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
      const item = { id: Date.now().toString(), ...data, createdAt: new Date().toISOString() }
      if (modal?.convo) dispatch({ type: 'UPDATE', key: 'alibabaCo', id: modal.convo.id, value: data })
      else dispatch({ type: 'ADD', key: 'alibabaCo', value: item })
    }
    setModal(null)
  }

  async function remove(id) {
    if (!confirm('Delete this conversation?')) return
    await api.del(`/data/alibaba-convos/${id}`)
    dispatch({ type: 'DELETE', key: 'alibabaCo', id })
    if (selectedConvo?.id === id) setSelectedConvo(null)
    setModal(null)
  }

  async function draftAIReply(convo) {
    setDraftLoading(true)
    setDraftedReply('')
    try {
      const prompt = `Draft a professional reply message for Katherine Fox (Art Director, The Cosmetic Formulary, Charleston SC) to send to an Alibaba supplier.

Supplier: ${convo.supplierName}
Product: ${convo.product}
Status: ${convo.status}
Quoted Price: ${convo.quotedPrice || 'not yet quoted'}
MOQ: ${convo.moq || 'unknown'}
Last message from supplier: "${convo.lastMessage || 'No message recorded'}"
Notes: ${convo.notes || 'none'}

Write a concise, professional reply appropriate for the current status.
- If status is "Waiting Reply", write a follow-up.
- If status is "Quoted", write a response evaluating the quote or requesting samples.
- If status is "Sample Received", write feedback or next steps.
- If status is "Negotiating", write a counter-offer.
- Keep it under 200 words. Professional but warm. Sign as Katherine Fox, The Cosmetic Formulary.`

      const res = await api.post('/ai/chat', {
        message: prompt,
        context: { tasks: [], projects: [], decisions: [], suppliers: [], products: [] }
      })
      setDraftedReply(res.reply)
    } catch (err) {
      setDraftedReply(`Error drafting reply: ${err.message}`)
    } finally {
      setDraftLoading(false)
    }
  }

  function useTemplate(key) {
    setDraftedReply(REPLY_TEMPLATES[key] || '')
    setTemplatePick(null)
  }

  function copyReply() {
    navigator.clipboard.writeText(draftedReply)
    setCopySuccess(true)
    setTimeout(() => setCopySuccess(false), 2000)
  }

  // KPI summary
  const waiting = convos.filter(c => c.status === 'Waiting Reply').length
  const overdue = convos.filter(c => isOverdue(c.followUpDate) && !['Ordered','Closed'].includes(c.status)).length
  const active = convos.filter(c => !['Ordered','Closed'].includes(c.status)).length

  return (
    <div className="h-full flex overflow-hidden">
      {/* Left: conversation list */}
      <div className="w-[360px] border-r border-border flex flex-col shrink-0">
        {/* Header */}
        <div className="panel-header shrink-0">
          <div>
            <div className="section-title">Alibaba Suppliers</div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] text-ink-muted">{active} active</span>
              {waiting > 0 && <span className="text-[10px] text-amber font-semibold">{waiting} waiting</span>}
              {overdue > 0 && <span className="text-[10px] text-red font-semibold">{overdue} overdue</span>}
            </div>
          </div>
          <button className="btn-primary" onClick={() => setModal({})}>+ Add</button>
        </div>

        {/* Search + sort */}
        <div className="px-3 py-2 border-b border-border space-y-2 shrink-0">
          <input
            type="text" placeholder="Search suppliers or products…" value={search}
            onChange={e => setSearch(e.target.value)}
            className="input-field text-xs w-full"
          />
          <div className="flex items-center gap-2">
            <select value={sort} onChange={e => setSort(e.target.value)}
              className="input-field text-xs flex-1 py-1">
              {SORT_OPTIONS.map(s => <option key={s}>{s}</option>)}
            </select>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="input-field text-xs flex-1 py-1">
              <option value="all">All Status</option>
              {STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto divide-y divide-border">
          {!filtered.length ? (
            <EmptyState message="No conversations yet" action="Add your first supplier" onAction={() => setModal({})} />
          ) : filtered.map(c => {
            const followUpOverdue = isOverdue(c.followUpDate) && !['Ordered','Closed'].includes(c.status)
            const selected = selectedConvo?.id === c.id
            return (
              <div
                key={c.id}
                className={`px-4 py-3 cursor-pointer transition-colors ${selected ? 'bg-teal/10 border-l-2 border-l-teal' : 'hover:bg-surface2'} ${followUpOverdue && !selected ? 'border-l-2 border-l-amber' : ''}`}
                onClick={() => { setSelectedConvo(c); setDraftedReply('') }}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="font-semibold text-sm text-ink truncate">{c.supplierName || 'Unnamed Supplier'}</div>
                  <span className={`shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded border ${STATUS_COLORS[c.status] || 'text-ink-muted border-border bg-surface3'}`}>
                    {c.status}
                  </span>
                </div>
                <div className="text-xs text-ink-dim truncate mb-1">{c.product}</div>
                <div className="flex items-center gap-3 text-[10px] text-ink-muted">
                  {c.quotedPrice && <span className="text-gold font-medium">{c.quotedPrice}/unit</span>}
                  {c.moq && <span>MOQ: {c.moq}</span>}
                  {c.lastContactDate && <span>{fmtDateShort(c.lastContactDate)}</span>}
                  {followUpOverdue && <span className="text-amber font-semibold">Follow-up overdue</span>}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Right: conversation detail + reply drafting */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!selectedConvo ? (
          <div className="flex-1 flex flex-col items-center justify-center text-ink-muted gap-3">
            <div className="text-4xl opacity-30">↑</div>
            <div className="text-sm">Select a supplier conversation to view details and draft replies</div>
          </div>
        ) : (
          <>
            {/* Convo header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-base font-semibold text-ink">{selectedConvo.supplierName}</h2>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${STATUS_COLORS[selectedConvo.status] || ''}`}>
                    {selectedConvo.status}
                  </span>
                </div>
                <div className="text-sm text-ink-dim mt-0.5">{selectedConvo.product}</div>
              </div>
              <div className="flex items-center gap-2">
                {selectedConvo.supplierUrl && (
                  <a href={selectedConvo.supplierUrl} target="_blank" rel="noopener" className="btn-ghost text-xs">
                    View on Alibaba ↗
                  </a>
                )}
                <button className="btn-ghost text-xs" onClick={() => setModal({ convo: selectedConvo })}>Edit</button>
                <button className="btn-icon text-ink-muted hover:text-red" onClick={() => remove(selectedConvo.id)}>✕</button>
              </div>
            </div>

            {/* Detail + reply in scrollable area */}
            <div className="flex-1 overflow-y-auto">
              {/* Specs row */}
              <div className="grid grid-cols-4 gap-px bg-border border-b border-border">
                {[
                  { label: 'Quoted Price', value: selectedConvo.quotedPrice || '—' },
                  { label: 'MOQ', value: selectedConvo.moq || '—' },
                  { label: 'Lead Time', value: selectedConvo.leadTime || '—' },
                  { label: 'Follow-Up', value: selectedConvo.followUpDate ? fmtDate(selectedConvo.followUpDate) : '—' },
                ].map(s => (
                  <div key={s.label} className="bg-surface px-4 py-3">
                    <div className="text-[10px] uppercase tracking-wider text-ink-muted mb-1">{s.label}</div>
                    <div className={`text-sm font-semibold ${s.label === 'Quoted Price' ? 'text-gold' : 'text-ink'}`}>{s.value}</div>
                  </div>
                ))}
              </div>

              <div className="p-6 grid grid-cols-2 gap-6">
                {/* Last message */}
                <div>
                  <div className="section-title mb-2">Last Message Received</div>
                  <div className="bg-surface2 border border-border rounded-lg p-3 text-sm text-ink-dim leading-relaxed min-h-[80px]">
                    {selectedConvo.lastMessage || <span className="text-ink-muted italic">No message recorded</span>}
                  </div>
                  {selectedConvo.lastContactDate && (
                    <div className="text-[10px] text-ink-muted mt-1.5">{fmtDate(selectedConvo.lastContactDate)}</div>
                  )}
                </div>

                {/* Notes */}
                <div>
                  <div className="section-title mb-2">Notes</div>
                  <div className="bg-surface2 border border-border rounded-lg p-3 text-sm text-ink-dim leading-relaxed min-h-[80px]">
                    {selectedConvo.notes || <span className="text-ink-muted italic">No notes</span>}
                  </div>
                </div>
              </div>

              {/* Reply drafting */}
              <div className="px-6 pb-6">
                <div className="border border-border rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 bg-surface border-b border-border">
                    <div className="section-title">Draft Reply</div>
                    <div className="flex items-center gap-2">
                      {/* Template picker */}
                      <div className="relative">
                        <button className="btn-ghost text-xs" onClick={() => setTemplatePick(p => p ? null : 'open')}>
                          Templates ▾
                        </button>
                        {templatePick && (
                          <div className="absolute right-0 top-8 z-10 bg-surface2 border border-border2 rounded-lg shadow-xl w-48 overflow-hidden">
                            {[
                              { key: 'intro', label: 'Introduction' },
                              { key: 'followup', label: 'Follow-up' },
                              { key: 'sample', label: 'Request Sample' },
                              { key: 'negotiate', label: 'Negotiate Price' },
                            ].map(t => (
                              <button key={t.key} onClick={() => useTemplate(t.key)}
                                className="w-full text-left px-3 py-2 text-xs text-ink-dim hover:bg-surface3 hover:text-ink transition-colors">
                                {t.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => draftAIReply(selectedConvo)}
                        disabled={draftLoading}
                        className="btn-primary text-xs disabled:opacity-50"
                      >
                        {draftLoading ? '✦ Drafting…' : '✦ AI Draft'}
                      </button>
                    </div>
                  </div>

                  <div className="p-4">
                    <textarea
                      value={draftedReply}
                      onChange={e => setDraftedReply(e.target.value)}
                      placeholder="Click 'AI Draft' to generate a reply based on the conversation context, or choose a template to start from."
                      className="input-field text-sm w-full leading-relaxed"
                      rows={10}
                    />
                    {draftedReply && (
                      <div className="flex items-center gap-2 mt-3">
                        <button onClick={copyReply} className="btn-primary text-xs">
                          {copySuccess ? '✓ Copied!' : '⧉ Copy to Clipboard'}
                        </button>
                        <span className="text-[10px] text-ink-muted">
                          Copy and paste into Alibaba messaging
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <Modal
        open={!!modal}
        title={modal?.convo ? 'Edit Supplier Conversation' : 'Add Alibaba Supplier'}
        fields={convoFields(modal?.convo)}
        onSave={save}
        onClose={() => setModal(null)}
        onDelete={modal?.convo ? () => remove(modal.convo.id) : null}
      />
    </div>
  )
}
