import { useState } from 'react'
import { useApp } from '../store/AppContext'
import { fmtDate, isOverdue } from '../lib/utils'
import StatusBadge from '../components/StatusBadge'
import Modal from '../components/Modal'
import EmptyState from '../components/EmptyState'
import api from '../lib/api'

const TABS = ['Website', 'Packaging', 'Content']

const WEB_STATUSES = ['Not Started', 'In Progress', 'Review', 'Approved', 'Live']
const WEB_APPROVAL = ['Pending', 'Approved', 'Changes Requested']
const PKG_STATUSES = ['Sourcing', 'Sampling', 'Pending Approval', 'Approved', 'In Production', 'Received']
const PKG_TYPES = ['Bottle', 'Pump', 'Cap', 'Label', 'Box', 'Tube', 'Jar', 'Dropper', 'Carton', 'Bag', 'Other']
const CONTENT_STAGES = ['Idea', 'Scripted', 'Filmed', 'Editing', 'Scheduled', 'Published']
const PLATFORMS = ['Instagram', 'TikTok', 'YouTube', 'LinkedIn', 'Pinterest', 'Email', 'Blog', 'Other']
const PLATFORM_COLORS = {
  Instagram: 'text-purple', TikTok: 'text-ink', YouTube: 'text-red',
  LinkedIn: 'text-blue', Pinterest: 'text-red', Email: 'text-teal', Blog: 'text-gold', Other: 'text-ink-dim',
}

export default function Creative() {
  const [activeTab, setActiveTab] = useState('Website')
  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex items-center gap-0 border-b border-border px-6 bg-bg shrink-0">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={[
              'relative h-11 px-5 text-[11.5px] font-medium tracking-[0.06em] uppercase transition-colors',
              activeTab === t ? 'text-ink' : 'text-ink-muted hover:text-ink',
            ].join(' ')}
          >
            {t}
            {activeTab === t && <span className="absolute bottom-0 left-3 right-3 h-[2px] bg-teal rounded-t-sm" />}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-hidden">
        {activeTab === 'Website' && <WebsiteSection />}
        {activeTab === 'Packaging' && <PackagingSection />}
        {activeTab === 'Content' && <ContentSection />}
      </div>
    </div>
  )
}

// ── Website ───────────────────────────────────────────────────────────────────
function WebsiteSection() {
  const { state, dispatch } = useApp()
  const [modal, setModal] = useState(null)
  const items = state.websiteProjects || []

  const fields = (item = {}) => [
    { id: 'name', label: 'Project Name', type: 'text', value: item.name || '', placeholder: 'e.g. TCF Homepage' },
    { id: 'status', label: 'Status', type: 'select', options: WEB_STATUSES, value: item.status || 'Not Started' },
    { id: 'designer', label: 'Designer', type: 'text', value: item.designer || '', placeholder: 'Katherine' },
    { id: 'developer', label: 'Developer', type: 'text', value: item.developer || '', placeholder: 'TBD' },
    { id: 'approvalStatus', label: 'Approval Status', type: 'select', options: WEB_APPROVAL, value: item.approvalStatus || 'Pending' },
    { id: 'launchDate', label: 'Launch Date', type: 'date', value: item.launchDate || '' },
    { id: 'notes', label: 'Notes', type: 'textarea', value: item.notes || '' },
  ]

  async function save(data) {
    if (modal?.item) {
      const updated = await api.patch(`/data/website-projects/${modal.item.id}`, data)
      dispatch({ type: 'UPDATE', key: 'websiteProjects', id: modal.item.id, value: updated })
    } else {
      const created = await api.post('/data/website-projects', data)
      dispatch({ type: 'ADD', key: 'websiteProjects', value: created })
    }
    setModal(null)
  }

  async function remove(id) {
    if (!confirm('Delete this project?')) return
    await api.del(`/data/website-projects/${id}`)
    dispatch({ type: 'DELETE', key: 'websiteProjects', id })
  }

  return (
    <div className="page-scroll">
      <div className="flex items-center justify-between mb-5">
        <h2 className="section-title">Website Projects</h2>
        <button className="btn-primary" onClick={() => setModal({})}>+ Add</button>
      </div>
      <div className="panel overflow-hidden">
        <table className="table-base">
          <thead>
            <tr>
              {['Project', 'Status', 'Designer', 'Developer', 'Approval', 'Launch Date', 'Notes', ''].map(h => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={8}><EmptyState message="No website projects" /></td></tr>
            ) : items.map(item => (
              <tr key={item.id} className="cursor-pointer" onClick={() => setModal({ item })}>
                <td className="font-medium text-ink">{item.name}</td>
                <td><StatusBadge status={item.status} /></td>
                <td className="text-ink-dim">{item.designer || '—'}</td>
                <td className="text-ink-dim">{item.developer || '—'}</td>
                <td><StatusBadge status={item.approvalStatus} /></td>
                <td className={`text-sm ${isOverdue(item.launchDate) ? 'text-red' : 'text-ink-dim'}`}>{fmtDate(item.launchDate)}</td>
                <td className="text-ink-muted text-xs max-w-[200px] truncate">{item.notes}</td>
                <td><button className="btn-icon" onClick={e => { e.stopPropagation(); remove(item.id) }}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Modal open={!!modal} title={modal?.item ? 'Edit Project' : 'Add Website Project'}
        fields={fields(modal?.item)} onSave={save} onClose={() => setModal(null)}
        onDelete={modal?.item ? () => { remove(modal.item.id); setModal(null) } : null} />
    </div>
  )
}

// ── Packaging ─────────────────────────────────────────────────────────────────
function PackagingSection() {
  const { state, dispatch } = useApp()
  const [modal, setModal] = useState(null)
  const [filter, setFilter] = useState('all')
  const items = (state.packaging || []).filter(p => filter === 'all' || p.status === filter)

  const fields = (item = {}) => [
    { id: 'item', label: 'Item Name', type: 'text', value: item.item || '', placeholder: 'e.g. 30ml Frosted Dropper' },
    { id: 'brand', label: 'Brand / Client', type: 'text', value: item.brand || '' },
    { id: 'type', label: 'Type', type: 'select', options: PKG_TYPES, value: item.type || 'Bottle' },
    { id: 'supplier', label: 'Supplier', type: 'text', value: item.supplier || '' },
    { id: 'status', label: 'Status', type: 'select', options: PKG_STATUSES, value: item.status || 'Sourcing' },
    { id: 'moq', label: 'MOQ', type: 'text', value: item.moq || '' },
    { id: 'leadTime', label: 'Lead Time', type: 'text', value: item.leadTime || '', placeholder: 'e.g. 8 weeks' },
    { id: 'dueDate', label: 'Due Date', type: 'date', value: item.dueDate || '' },
    { id: 'notes', label: 'Notes', type: 'textarea', value: item.notes || '' },
  ]

  async function save(data) {
    if (modal?.item) {
      const updated = await api.patch(`/data/packaging/${modal.item.id}`, data)
      dispatch({ type: 'UPDATE', key: 'packaging', id: modal.item.id, value: updated })
    } else {
      const created = await api.post('/data/packaging', data)
      dispatch({ type: 'ADD', key: 'packaging', value: created })
    }
    setModal(null)
  }

  async function remove(id) {
    if (!confirm('Delete?')) return
    await api.del(`/data/packaging/${id}`)
    dispatch({ type: 'DELETE', key: 'packaging', id })
  }

  return (
    <div className="page-scroll">
      <div className="flex items-center justify-between mb-4">
        <h2 className="section-title">Packaging</h2>
        <button className="btn-primary" onClick={() => setModal({})}>+ Add</button>
      </div>
      <div className="flex gap-2 flex-wrap mb-4">
        {['all', ...PKG_STATUSES].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${filter === s ? 'bg-teal/10 border-teal/40 text-teal' : 'bg-surface border-border text-ink-muted hover:border-teal hover:text-teal'}`}>
            {s === 'all' ? 'All' : s}
          </button>
        ))}
      </div>
      <div className="panel overflow-auto">
        <table className="table-base">
          <thead>
            <tr>{['Item', 'Brand', 'Type', 'Supplier', 'Status', 'MOQ', 'Lead Time', 'Due Date', 'Notes', ''].map(h => <th key={h}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={10}><EmptyState message="No packaging items" /></td></tr>
            ) : items.map(p => (
              <tr key={p.id} className="cursor-pointer" onClick={() => setModal({ item: p })}>
                <td className="font-medium text-ink whitespace-nowrap">{p.item}</td>
                <td className="text-ink-dim text-xs">{p.brand}</td>
                <td className="text-ink-dim text-xs">{p.type}</td>
                <td className="text-ink-dim text-xs">{p.supplier}</td>
                <td><StatusBadge status={p.status} /></td>
                <td className="text-ink-dim text-xs">{p.moq || '—'}</td>
                <td className="text-ink-dim text-xs">{p.leadTime || '—'}</td>
                <td className={`text-xs ${isOverdue(p.dueDate) ? 'text-red' : 'text-ink-dim'}`}>{fmtDate(p.dueDate)}</td>
                <td className="text-ink-muted text-xs max-w-[160px] truncate">{p.notes}</td>
                <td><button className="btn-icon" onClick={e => { e.stopPropagation(); remove(p.id) }}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Modal open={!!modal} title={modal?.item ? 'Edit Packaging' : 'Add Packaging Item'}
        fields={fields(modal?.item)} onSave={save} onClose={() => setModal(null)}
        onDelete={modal?.item ? () => { remove(modal.item.id); setModal(null) } : null} />
    </div>
  )
}

// ── Content ───────────────────────────────────────────────────────────────────
function ContentSection() {
  const { state, dispatch } = useApp()
  const [modal, setModal] = useState(null)
  const content = state.content || []

  const fields = (item = {}) => [
    { id: 'title', label: 'Title', type: 'text', value: item.title || '', placeholder: 'Content title or concept' },
    { id: 'platform', label: 'Platform', type: 'select', options: PLATFORMS, value: item.platform || 'Instagram' },
    { id: 'stage', label: 'Stage', type: 'select', options: CONTENT_STAGES, value: item.stage || 'Idea' },
    { id: 'hook', label: 'Hook / Concept', type: 'textarea', value: item.hook || '', rows: 3 },
    { id: 'postDate', label: 'Post Date', type: 'date', value: item.postDate || '' },
  ]

  async function save(data) {
    if (modal?.item) {
      const updated = await api.patch(`/data/content/${modal.item.id}`, data)
      dispatch({ type: 'UPDATE', key: 'content', id: modal.item.id, value: updated })
    } else {
      const created = await api.post('/data/content', data)
      dispatch({ type: 'ADD', key: 'content', value: created })
    }
    setModal(null)
  }

  async function remove(id) {
    if (!confirm('Delete?')) return
    await api.del(`/data/content/${id}`)
    dispatch({ type: 'DELETE', key: 'content', id })
  }

  async function moveStage(item, newStage) {
    const updated = await api.patch(`/data/content/${item.id}`, { stage: newStage })
    dispatch({ type: 'UPDATE', key: 'content', id: item.id, value: updated })
  }

  return (
    <div className="page-scroll">
      <div className="flex items-center justify-between mb-5">
        <h2 className="section-title">Content Production</h2>
        <button className="btn-primary" onClick={() => setModal({})}>+ Add Content</button>
      </div>
      {/* Pipeline Board */}
      <div className="flex border border-border rounded-lg overflow-hidden mb-6" style={{ height: '340px', gap: '1px', background: '#222' }}>
        {CONTENT_STAGES.map(stage => {
          const cards = content.filter(c => c.stage === stage)
          return (
            <div key={stage} className="pipeline-col" style={{ flex: 1 }}>
              <div className="pipeline-col-head">
                <span>{stage}</span>
                <span className="text-ink-muted ml-2">({cards.length})</span>
              </div>
              <div className="pipeline-cards">
                {cards.map(c => (
                  <div key={c.id} className="pipeline-card" onClick={() => setModal({ item: c })}>
                    <div className="font-medium text-ink text-xs leading-snug mb-1.5">{c.title}</div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {c.platform && <span className={`text-[9px] font-bold uppercase tracking-wider ${PLATFORM_COLORS[c.platform] || 'text-ink-muted'}`}>{c.platform}</span>}
                      {c.postDate && <span className="text-[9px] text-ink-muted">{fmtDate(c.postDate)}</span>}
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => setModal({ defaultStage: stage })}
                  className="text-[10px] text-ink-muted hover:text-teal transition-colors py-1 text-center"
                >+ Add</button>
              </div>
            </div>
          )
        })}
      </div>
      <Modal
        open={!!modal}
        title={modal?.item ? 'Edit Content' : 'Add Content'}
        fields={fields(modal?.item || { stage: modal?.defaultStage })}
        onSave={save}
        onClose={() => setModal(null)}
        onDelete={modal?.item ? () => { remove(modal.item.id); setModal(null) } : null}
      />
    </div>
  )
}
