import { useState, useMemo } from 'react'
import { useApp } from '../store/AppContext'
import { fmtDate, timeAgo, isOverdue } from '../lib/utils'
import StatusBadge from '../components/StatusBadge'
import Modal from '../components/Modal'
import EmptyState from '../components/EmptyState'
import api from '../lib/api'

const SUP_STATUSES = ['Waiting', 'In Progress', 'Complete', 'No Response']
const PO_TYPES = ['RFQ', 'Quote', 'PO', 'Production Order']
const PO_STATUSES = ['Pending', 'Confirmed', 'In Progress', 'Received', 'Cancelled']
const INV_TYPES = ['Packaging', 'Raw Material', 'Finished Goods']

export default function Operations() {
  return (
    <div className="h-full overflow-y-auto grid grid-cols-2 gap-px bg-border p-0" style={{ gridTemplateRows: '1fr 1fr' }}>
      <EmailPanel />
      <SupplierPanel />
      <PurchasingPanel />
      <InventoryPanel />
    </div>
  )
}

// ── Email Panel ───────────────────────────────────────────────────────────────
function EmailPanel() {
  const { state, dispatch } = useApp()
  const [taskModal, setTaskModal] = useState(null)
  const [read, setRead] = useState(new Set())
  const threads = state.gmailThreads || []
  const unread = threads.filter(t => t.isUnread && !read.has(t.id)).length

  async function createTask(data) {
    try {
      const res = await api.post('/data/decisions', { title: data.title, context: data.notes })
      dispatch({ type: 'ADD', key: 'decisions', value: res })
    } catch {}
    setTaskModal(null)
  }

  return (
    <div className="bg-surface flex flex-col overflow-hidden">
      <div className="panel-header shrink-0">
        <div className="flex items-center gap-2">
          <span className="section-title">Inbox</span>
          {unread > 0 && <span className="text-[10px] font-bold bg-teal/20 text-teal border border-teal/30 px-1.5 py-0.5 rounded">{unread}</span>}
        </div>
        <a href="https://mail.google.com" target="_blank" rel="noopener" className="btn-ghost text-xs">Open Gmail ↗</a>
      </div>
      <div className="flex-1 overflow-y-auto">
        {!threads.length ? (
          <EmptyState message="Gmail not connected — add OAuth tokens to .env" />
        ) : (
          threads.slice(0, 20).map(t => {
            const isRead = read.has(t.id)
            const stale = t.stale || t.isStale
            const actionable = t.actionable || t.isActionable
            return (
              <div
                key={t.id}
                className={[
                  'px-4 py-3 border-b border-border cursor-pointer hover:bg-surface2 transition-colors group relative',
                  stale ? 'border-l-2 border-l-amber' : '',
                ].join(' ')}
              >
                {actionable && !isRead && <span className="absolute left-1.5 top-4 w-1.5 h-1.5 rounded-full bg-teal" />}
                <div className={`text-xs font-medium truncate ${!isRead && t.isUnread ? 'text-ink' : 'text-ink-dim'}`}>
                  {t.from?.replace(/<[^>]+>/, '').trim() || '—'}
                </div>
                <div className={`text-sm truncate ${!isRead && t.isUnread ? 'font-semibold text-ink' : 'text-ink-dim'}`}>
                  {t.subject}
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10.5px] text-ink-muted truncate max-w-[60%]">{t.snippet}</span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <a href={`https://mail.google.com/mail/u/0/#inbox/${t.id}`} target="_blank" rel="noopener"
                      className="btn-icon text-[10px] px-2 py-1 border border-border2 rounded" onClick={e => e.stopPropagation()}>
                      ↗
                    </a>
                    <button className="btn-icon text-[10px] px-2 py-1 border border-border2 rounded"
                      onClick={e => { e.stopPropagation(); setTaskModal(t) }}>
                      → Task
                    </button>
                    <button className="btn-icon text-[10px] px-2 py-1 border border-border2 rounded"
                      onClick={e => { e.stopPropagation(); setRead(s => new Set([...s, t.id])) }}>
                      ✓
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
      <Modal
        open={!!taskModal}
        title="Convert to Decision / Task"
        fields={[
          { id: 'title', label: 'Title', type: 'text', value: taskModal?.subject || '' },
          { id: 'notes', label: 'Context', type: 'textarea', value: taskModal?.snippet || '' },
        ]}
        onSave={createTask}
        onClose={() => setTaskModal(null)}
        saveLabel="Create Task"
      />
    </div>
  )
}

// ── Supplier Panel ────────────────────────────────────────────────────────────
function SupplierPanel() {
  const { state, dispatch } = useApp()
  const [modal, setModal] = useState(null)
  const suppliers = state.suppliers || []

  const fields = (s = {}) => [
    { id: 'supplier', label: 'Supplier', type: 'text', value: s.supplier || '' },
    { id: 'project', label: 'Project', type: 'text', value: s.project || '' },
    { id: 'waitingOn', label: 'Waiting On', type: 'text', value: s.waitingOn || '' },
    { id: 'lastContact', label: 'Last Contact', type: 'date', value: s.lastContact || '' },
    { id: 'nextFollowUp', label: 'Next Follow-Up', type: 'date', value: s.nextFollowUp || '' },
    { id: 'status', label: 'Status', type: 'select', options: SUP_STATUSES, value: s.status || 'Waiting' },
    { id: 'notes', label: 'Notes', type: 'textarea', value: s.notes || '' },
  ]

  async function save(data) {
    if (modal?.item) {
      const u = await api.patch(`/data/suppliers/${modal.item.id}`, data)
      dispatch({ type: 'UPDATE', key: 'suppliers', id: modal.item.id, value: u })
    } else {
      const c = await api.post('/data/suppliers', data)
      dispatch({ type: 'ADD', key: 'suppliers', value: c })
    }
    setModal(null)
  }

  async function remove(id) {
    if (!confirm('Delete?')) return
    await api.del(`/data/suppliers/${id}`)
    dispatch({ type: 'DELETE', key: 'suppliers', id })
  }

  return (
    <div className="bg-surface flex flex-col overflow-hidden">
      <div className="panel-header shrink-0">
        <span className="section-title">Supplier Tracker</span>
        <button className="btn-primary" onClick={() => setModal({})}>+ Add</button>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="table-base">
          <thead>
            <tr>{['Supplier', 'Project', 'Waiting On', 'Last Contact', 'Follow-Up', 'Status', ''].map(h => <th key={h}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {!suppliers.length ? (
              <tr><td colSpan={7}><EmptyState message="No supplier records" /></td></tr>
            ) : suppliers.map(s => {
              const overdue = isOverdue(s.nextFollowUp) && s.status !== 'Complete'
              return (
                <tr key={s.id} className={`cursor-pointer ${overdue ? 'border-l-2 border-l-amber' : ''}`}
                  onClick={() => setModal({ item: s })}>
                  <td className="font-medium text-ink text-xs">{s.supplier}</td>
                  <td className="text-ink-dim text-xs">{s.project}</td>
                  <td className="text-ink-muted text-xs max-w-[140px] truncate">{s.waitingOn || '—'}</td>
                  <td className="text-ink-dim text-xs">{fmtDate(s.lastContact)}</td>
                  <td className={`text-xs ${overdue ? 'text-amber font-semibold' : 'text-ink-dim'}`}>{fmtDate(s.nextFollowUp)}</td>
                  <td><StatusBadge status={s.status} /></td>
                  <td><button className="btn-icon" onClick={e => { e.stopPropagation(); remove(s.id) }}>✕</button></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <Modal open={!!modal} title={modal?.item ? 'Edit Supplier' : 'Add Supplier'}
        fields={fields(modal?.item)} onSave={save} onClose={() => setModal(null)}
        onDelete={modal?.item ? () => { remove(modal.item.id); setModal(null) } : null} />
    </div>
  )
}

// ── Purchasing Panel ──────────────────────────────────────────────────────────
function PurchasingPanel() {
  const { state, dispatch } = useApp()
  const [modal, setModal] = useState(null)
  const [filter, setFilter] = useState('All')
  const all = state.purchasing || []
  const items = filter === 'All' ? all : all.filter(p => p.type === filter)

  const fields = (p = {}) => [
    { id: 'type', label: 'Type', type: 'select', options: PO_TYPES, value: p.type || 'RFQ' },
    { id: 'supplier', label: 'Supplier', type: 'text', value: p.supplier || '' },
    { id: 'product', label: 'Product / Description', type: 'text', value: p.product || '' },
    { id: 'quantity', label: 'Quantity', type: 'number', value: p.quantity || '' },
    { id: 'cost', label: 'Cost ($)', type: 'number', value: p.cost || '' },
    { id: 'status', label: 'Status', type: 'select', options: PO_STATUSES, value: p.status || 'Pending' },
    { id: 'date', label: 'Date', type: 'date', value: p.date || '' },
    { id: 'notes', label: 'Notes', type: 'textarea', value: p.notes || '' },
  ]

  async function save(data) {
    if (modal?.item) {
      const u = await api.patch(`/data/purchasing/${modal.item.id}`, data)
      dispatch({ type: 'UPDATE', key: 'purchasing', id: modal.item.id, value: u })
    } else {
      const c = await api.post('/data/purchasing', data)
      dispatch({ type: 'ADD', key: 'purchasing', value: c })
    }
    setModal(null)
  }

  async function remove(id) {
    if (!confirm('Delete?')) return
    await api.del(`/data/purchasing/${id}`)
    dispatch({ type: 'DELETE', key: 'purchasing', id })
  }

  return (
    <div className="bg-surface flex flex-col overflow-hidden">
      <div className="panel-header shrink-0">
        <div className="flex items-center gap-3">
          <span className="section-title">Purchasing</span>
          <div className="flex gap-1">
            {['All', ...PO_TYPES].map(t => (
              <button key={t} onClick={() => setFilter(t)}
                className={`text-[10px] px-2 py-0.5 rounded transition-colors ${filter === t ? 'text-teal bg-teal/10' : 'text-ink-muted hover:text-ink'}`}>
                {t}
              </button>
            ))}
          </div>
        </div>
        <button className="btn-primary" onClick={() => setModal({})}>+ Add</button>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="table-base">
          <thead>
            <tr>{['Type', 'Supplier', 'Product', 'Qty', 'Cost', 'Status', 'Date', ''].map(h => <th key={h}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {!items.length ? (
              <tr><td colSpan={8}><EmptyState message="No purchasing records" /></td></tr>
            ) : items.map(p => (
              <tr key={p.id} className="cursor-pointer" onClick={() => setModal({ item: p })}>
                <td><span className="text-[10px] font-bold text-gold uppercase">{p.type}</span></td>
                <td className="text-ink-dim text-xs">{p.supplier}</td>
                <td className="text-ink text-xs max-w-[150px] truncate">{p.product}</td>
                <td className="text-ink-dim text-xs">{p.quantity || '—'}</td>
                <td className="text-ink-dim text-xs">{p.cost ? `$${Number(p.cost).toFixed(2)}` : '—'}</td>
                <td><StatusBadge status={p.status} /></td>
                <td className="text-ink-dim text-xs">{fmtDate(p.date)}</td>
                <td><button className="btn-icon" onClick={e => { e.stopPropagation(); remove(p.id) }}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Modal open={!!modal} title={modal?.item ? 'Edit Order' : 'Add Purchasing Record'}
        fields={fields(modal?.item)} onSave={save} onClose={() => setModal(null)}
        onDelete={modal?.item ? () => { remove(modal.item.id); setModal(null) } : null} />
    </div>
  )
}

// ── Inventory Panel ───────────────────────────────────────────────────────────
function InventoryPanel() {
  const { state, dispatch } = useApp()
  const [modal, setModal] = useState(null)
  const inventory = state.inventory || []

  const fields = (item = {}) => [
    { id: 'name', label: 'Item Name', type: 'text', value: item.name || '' },
    { id: 'type', label: 'Type', type: 'select', options: INV_TYPES, value: item.type || 'Packaging' },
    { id: 'currentStock', label: 'Current Stock', type: 'number', value: item.currentStock ?? '' },
    { id: 'reorderPoint', label: 'Reorder Point', type: 'number', value: item.reorderPoint ?? '' },
    { id: 'supplier', label: 'Supplier', type: 'text', value: item.supplier || '' },
    { id: 'leadTime', label: 'Lead Time', type: 'text', value: item.leadTime || '', placeholder: 'e.g. 8 weeks' },
    { id: 'unit', label: 'Unit', type: 'text', value: item.unit || 'units' },
    { id: 'notes', label: 'Notes', type: 'textarea', value: item.notes || '' },
  ]

  async function save(data) {
    const parsed = { ...data, currentStock: Number(data.currentStock) || 0, reorderPoint: Number(data.reorderPoint) || 0 }
    if (modal?.item) {
      const u = await api.patch(`/data/inventory/${modal.item.id}`, parsed)
      dispatch({ type: 'UPDATE', key: 'inventory', id: modal.item.id, value: u })
    } else {
      const c = await api.post('/data/inventory', parsed)
      dispatch({ type: 'ADD', key: 'inventory', value: c })
    }
    setModal(null)
  }

  async function remove(id) {
    if (!confirm('Delete?')) return
    await api.del(`/data/inventory/${id}`)
    dispatch({ type: 'DELETE', key: 'inventory', id })
  }

  return (
    <div className="bg-surface flex flex-col overflow-hidden">
      <div className="panel-header shrink-0">
        <span className="section-title">Inventory</span>
        <button className="btn-primary" onClick={() => setModal({})}>+ Add</button>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="table-base">
          <thead>
            <tr>{['Item', 'Type', 'Stock', 'Reorder At', 'Supplier', 'Lead Time', 'Status', ''].map(h => <th key={h}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {!inventory.length ? (
              <tr><td colSpan={8}><EmptyState message="No inventory records" /></td></tr>
            ) : inventory.map(item => {
              const low = item.currentStock <= item.reorderPoint
              return (
                <tr key={item.id}
                  className={`cursor-pointer ${low ? 'bg-red/5 border-l-2 border-l-red' : ''}`}
                  onClick={() => setModal({ item })}>
                  <td className="font-medium text-ink text-xs">{item.name}</td>
                  <td className="text-ink-dim text-xs">{item.type}</td>
                  <td className={`text-sm font-semibold tabular-nums ${low ? 'text-red' : 'text-ink'}`}>
                    {item.currentStock ?? '—'} <span className="text-ink-muted font-normal text-xs">{item.unit}</span>
                  </td>
                  <td className="text-ink-dim text-xs">{item.reorderPoint ?? '—'}</td>
                  <td className="text-ink-dim text-xs">{item.supplier}</td>
                  <td className="text-ink-dim text-xs">{item.leadTime || '—'}</td>
                  <td>
                    {low
                      ? <span className="text-[10px] font-bold text-red bg-red/10 border border-red/30 px-1.5 py-0.5 rounded">LOW</span>
                      : <span className="text-[10px] font-bold text-green bg-green/10 border border-green/30 px-1.5 py-0.5 rounded">OK</span>
                    }
                  </td>
                  <td><button className="btn-icon" onClick={e => { e.stopPropagation(); remove(item.id) }}>✕</button></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <Modal open={!!modal} title={modal?.item ? 'Edit Inventory' : 'Add Inventory Item'}
        fields={fields(modal?.item)} onSave={save} onClose={() => setModal(null)}
        onDelete={modal?.item ? () => { remove(modal.item.id); setModal(null) } : null} />
    </div>
  )
}
