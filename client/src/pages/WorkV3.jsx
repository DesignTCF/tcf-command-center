import { useState } from 'react'
import { useApp } from '../store/AppContext'
import api from '../lib/api'
import { fmtDate, fmtDateShort, isOverdue } from '../lib/utils'
import StatusBadge from '../components/StatusBadge'
import Modal from '../components/Modal'
import EmptyState from '../components/EmptyState'

const TABS = ['Tasks', 'Projects', 'Decisions', 'Pipeline', 'Purchasing']

const BRAND_COLORS = {
  nevoo: '#0D9E9E',
  'daily rou': '#A07A10',
  'nitt beauty': '#5533AA',
  nitt: '#5533AA',
  'devoted man': '#2255AA',
  devoted: '#2255AA',
  'salt spa': '#157A50',
  salt: '#157A50',
}

const PIPELINE_STAGES = ['Formula', 'Packaging', 'Artwork', 'Launch']

// ─── Task categorization ────────────────────────────────────────────────────

function categorizeTask(task) {
  const t = (task.title || '').toLowerCase()
  if (/packaging|bottle|label|print/.test(t)) return 'Packaging'
  if (/nevoo|daily rou|nitt|salt spa|devoted/.test(t)) return 'Brand / Client'
  return 'TCF / Business'
}

const CATEGORY_COLORS = {
  'Packaging': '#A86200',
  'Brand / Client': '#0D9E9E',
  'TCF / Business': '#5533AA',
}

function groupByCategory(tasks) {
  const groups = {}
  tasks.forEach(t => {
    const cat = categorizeTask(t)
    if (!groups[cat]) groups[cat] = []
    groups[cat].push(t)
  })
  return groups
}

// ─── Task dot ───────────────────────────────────────────────────────────────

function CategoryDot({ task }) {
  const cat = categorizeTask(task)
  return (
    <span
      style={{
        display: 'inline-block',
        width: 7,
        height: 7,
        borderRadius: '50%',
        background: CATEGORY_COLORS[cat],
        flexShrink: 0,
        marginTop: 2,
      }}
    />
  )
}

// ─── Task row ───────────────────────────────────────────────────────────────

function TaskRow({ task, dim, notionBaseUrl }) {
  const url = notionBaseUrl
    ? `${notionBaseUrl}/${task.id?.replace(/-/g, '')}`
    : null

  return (
    <div
      className="flex items-start gap-2 py-1.5"
      style={{ opacity: dim ? 0.55 : 1 }}
    >
      <CategoryDot task={task} />
      <span
        className="flex-1 text-xs leading-snug"
        style={{
          color: '#1A1A1A',
          textDecoration: dim ? 'line-through' : 'none',
        }}
      >
        {task.title || '(Untitled)'}
      </span>
      {task.dueDate && (
        <span
          className="text-xs flex-shrink-0"
          style={{ color: isOverdue(task.dueDate) && !dim ? '#B52B2B' : '#58595b' }}
        >
          {fmtDateShort(task.dueDate)}
        </span>
      )}
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="flex-shrink-0 text-xs"
          style={{ color: '#58595b', lineHeight: 1 }}
          title="Open in Notion"
        >
          ↗
        </a>
      )}
    </div>
  )
}

// ─── Tasks column ───────────────────────────────────────────────────────────

function TaskColumn({ label, tasks, dim = false, collapsed = false, onToggle, count }) {
  const groups = groupByCategory(tasks)
  const cats = Object.keys(groups)

  return (
    <div className="flex flex-col" style={{ minWidth: 0 }}>
      <div
        className="flex items-center gap-2 mb-3"
        style={{ borderBottom: '1px solid #D8D8D8', paddingBottom: 8 }}
      >
        <span className="section-title">{label}</span>
        <span
          className="text-xs font-bold px-1.5 py-0.5 rounded-full"
          style={{ background: '#EEEEEE', color: '#58595b' }}
        >
          {count}
        </span>
        {onToggle && (
          <button
            onClick={onToggle}
            className="ml-auto text-xs"
            style={{ color: '#58595b' }}
          >
            {collapsed ? `Show (${count})` : 'Hide'}
          </button>
        )}
      </div>

      {collapsed ? null : cats.length === 0 ? (
        <p className="text-xs" style={{ color: '#58595b' }}>Nothing here.</p>
      ) : (
        cats.map((cat, ci) => (
          <div key={cat} className={ci > 0 ? 'mt-3' : ''}>
            <div
              className="text-xs font-semibold mb-1 uppercase tracking-wide"
              style={{ color: CATEGORY_COLORS[cat], fontSize: 9, letterSpacing: '0.08em' }}
            >
              {cat}
            </div>
            {groups[cat].map(t => (
              <TaskRow key={t.id} task={t} dim={dim} />
            ))}
          </div>
        ))
      )}
    </div>
  )
}

// ─── Add Task Modal ──────────────────────────────────────────────────────────

function AddTaskModal({ onClose }) {
  const { dispatch } = useApp()
  const [form, setForm] = useState({ title: '', dueDate: '', assignee: '' })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)

  async function handleSave() {
    if (!form.title.trim()) return
    setSaving(true)
    try {
      const res = await api.post('/notion/tasks', form)
      dispatch({ type: 'ADD', key: 'tasks', value: { ...form, id: res?.id || String(Date.now()), status: 'Not started' } })
      onClose()
    } catch (e) {
      setErr('Could not add to Notion. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Add Task to Notion" onClose={onClose}>
      <div className="flex flex-col gap-3 p-4">
        <div>
          <label className="section-title block mb-1">Task Name</label>
          <input
            className="input-field w-full"
            placeholder="e.g. Review NeVoo label proof"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          />
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="section-title block mb-1">Due Date</label>
            <input
              type="date"
              className="input-field w-full"
              value={form.dueDate}
              onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
            />
          </div>
          <div className="flex-1">
            <label className="section-title block mb-1">Assignee</label>
            <input
              className="input-field w-full"
              placeholder="e.g. Katherine"
              value={form.assignee}
              onChange={e => setForm(f => ({ ...f, assignee: e.target.value }))}
            />
          </div>
        </div>
        {err && <p className="text-xs" style={{ color: '#B52B2B' }}>{err}</p>}
        <div className="flex gap-2 justify-end mt-1">
          <button className="btn-ghost text-xs px-3 py-1.5" onClick={onClose}>Cancel</button>
          <button className="btn-primary text-xs px-3 py-1.5" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Add to Notion'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Done status detection ────────────────────────────────────────────────────
const DONE_STATUSES = new Set(['done', 'complete', 'completed', 'finished', 'closed'])
function isDone(task) {
  return task.done || DONE_STATUSES.has((task.status || '').toLowerCase())
}

// ─── To-do block row (read-only — never writes to Notion) ────────────────────
function TodoBlock({ block, indent = 0 }) {
  const checked = block.checked
  return (
    <>
      <div
        className={`flex items-start gap-2.5 py-2 px-4 border-b border-border last:border-0 ${checked ? 'opacity-40' : ''}`}
        style={{ paddingLeft: 16 + indent * 20 }}
      >
        {/* Read-only checkbox indicator */}
        <div className={`mt-0.5 w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center ${
          checked ? 'bg-teal border-teal' : 'border-border'
        }`}>
          {checked && (
            <svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth="2">
              <path d="M1.5 5l2.5 2.5 5-5"/>
            </svg>
          )}
        </div>
        <span className={`text-[12.5px] leading-snug flex-1 ${checked ? 'line-through text-ink-muted' : 'text-ink'}`}>
          {block.text || '(empty)'}
        </span>
      </div>
      {(block.children || []).map(child => (
        <TodoBlock key={child.id} block={child} indent={indent + 1} />
      ))}
    </>
  )
}

// ─── Notion task panel (read-only) ───────────────────────────────────────────
function NotionTaskPanel({ task }) {
  const [expanded, setExpanded] = useState(true)
  const [blocks, setBlocks] = useState(task.blocks || [])
  const [loading, setLoading] = useState(false)

  // On mount: if server is up and blocks weren't baked in, fetch them
  useEffect(() => {
    if (blocks.length === 0 && !isDone(task)) {
      setLoading(true)
      api.get(`/notion/tasks/${task.id}/blocks`)
        .then(b => { if (b?.length) setBlocks(b) })
        .catch(() => {})
        .finally(() => setLoading(false))
    }
  }, [task.id])

  const todoBlocks = blocks.filter(b => b.type === 'to_do')
  const noteBlocks = blocks.filter(b => b.type === 'paragraph' && b.text)
  const openCount  = todoBlocks.filter(b => !b.checked).length
  const otherBlocks = blocks.filter(b => b.type !== 'to_do' && b.type !== 'paragraph')

  return (
    <div className="panel overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-surface2 transition-colors border-b border-border"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold text-ink leading-snug">{task.title}</div>
          {noteBlocks[0] && (
            <div className="text-[11px] text-ink-muted mt-0.5 truncate">{noteBlocks[0].text}</div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {openCount > 0 && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-surface2 text-ink-muted">
              {openCount} open
            </span>
          )}
          <StatusBadge status={task.status} />
          {task.url && (
            <a href={task.url} target="_blank" rel="noreferrer"
              onClick={e => e.stopPropagation()}
              title="Open in Notion"
              className="text-[10px] text-ink-muted hover:text-teal">↗</a>
          )}
          <span className="text-ink-muted text-[11px]">{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* Body */}
      {expanded && (
        <div>
          {loading && <div className="px-4 py-3 text-[11px] text-ink-muted">Loading from Notion…</div>}

          {!loading && blocks.length === 0 && (
            <div className="px-4 py-3 text-[11px] text-ink-muted italic">
              No items — click ↗ to view in Notion
            </div>
          )}

          {/* Additional note paragraphs */}
          {noteBlocks.slice(1).map(b => (
            <div key={b.id} className="px-4 py-2 text-[11.5px] text-ink-muted border-b border-border bg-surface/40 italic">
              {b.text}
            </div>
          ))}

          {/* To-do items — read-only */}
          {todoBlocks.map(block => (
            <TodoBlock key={block.id} block={block} />
          ))}

          {/* Other block types */}
          {otherBlocks.map(b => b.text && (
            <div key={b.id} className="flex items-start gap-2 px-4 py-1.5 border-b border-border last:border-0">
              <span className="text-[12px] text-ink-muted">{b.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Status display order — active statuses first
const STATUS_ORDER = ['In progress', 'Not started', 'Backlog', 'Blocked', 'Waiting', 'Review']

// Status pill colors
const STATUS_COLORS = {
  'in progress':  { bg: 'bg-teal/10',    text: 'text-teal',        dot: 'bg-teal' },
  'not started':  { bg: 'bg-surface2',   text: 'text-ink-muted',   dot: 'bg-surface3' },
  'backlog':      { bg: 'bg-surface2',   text: 'text-ink-muted',   dot: 'bg-surface3' },
  'blocked':      { bg: 'bg-red-50',     text: 'text-red-600',     dot: 'bg-red-500' },
  'waiting':      { bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-400' },
  'review':       { bg: 'bg-purple-50',  text: 'text-purple-700',  dot: 'bg-purple-400' },
}
function statusStyle(status) {
  return STATUS_COLORS[(status || '').toLowerCase()] || { bg: 'bg-surface2', text: 'text-ink-muted', dot: 'bg-surface3' }
}

// ─── Live Notion Task Row ─────────────────────────────────────────────────────
function NotionTaskRow({ task, onMarkDone }) {
  const [marking, setMarking] = useState(false)
  const style = statusStyle(task.status)

  async function handleDone(e) {
    e.stopPropagation()
    setMarking(true)
    await onMarkDone(task.id)
    setMarking(false)
  }

  return (
    <div className="flex items-start gap-3 py-2.5 px-4 border-b border-border last:border-0 group hover:bg-surface transition-colors">
      {/* Checkbox */}
      <button
        onClick={handleDone}
        disabled={marking}
        title="Mark done in Notion"
        className={`mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 transition-all flex items-center justify-center ${
          marking ? 'border-teal bg-teal/20' : 'border-border group-hover:border-teal'
        }`}
      >
        {marking && <span className="text-[8px] text-teal">✓</span>}
      </button>

      {/* Title */}
      <div className="flex-1 min-w-0">
        <div className="text-[12.5px] text-ink leading-snug">{task.title || '(Untitled)'}</div>
        {task.dueDate && (
          <div className={`text-[10px] mt-0.5 ${isOverdue(task.dueDate) ? 'text-red font-semibold' : 'text-ink-muted'}`}>
            Due {fmtDateShort(task.dueDate)}
          </div>
        )}
      </div>

      {/* Status pill */}
      <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${style.bg} ${style.text}`}>
        {task.status || '—'}
      </span>

      {/* Open in Notion */}
      {task.url && (
        <a href={task.url} target="_blank" rel="noreferrer"
          className="text-[10px] text-ink-muted hover:text-teal opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5"
          title="Open in Notion">
          ↗
        </a>
      )}
    </div>
  )
}

// ─── Tasks Tab ───────────────────────────────────────────────────────────────

function TasksTab() {
  const { state } = useApp()
  const [showDone, setShowDone] = useState(false)

  const allTasks    = state.tasks || []
  const activeTasks = allTasks.filter(t => !isDone(t))
  const doneTasks   = allTasks.filter(t => isDone(t))
  const totalTodos  = activeTasks.reduce((n, t) =>
    n + (t.blocks || []).filter(b => b.type === 'to_do' && !b.checked).length, 0)

  return (
    <div className="flex flex-col gap-4">

      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-teal animate-pulse" />
        <span className="text-[11px] text-ink-muted font-medium">
          Live from Notion · {activeTasks.length} open sections · {totalTodos} to-dos
        </span>
        <span className="text-[10px] text-ink-muted/60 ml-1">— read only, use Sync All to refresh</span>
      </div>

      {/* Open task panels */}
      {activeTasks.length === 0 && (
        <div className="panel p-8 text-center text-ink-muted text-sm">
          No open tasks — click Sync All to refresh from Notion
        </div>
      )}

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
        {activeTasks.map(task => (
          <NotionTaskPanel key={task.id} task={task} />
        ))}
      </div>

      {/* Done — collapsible */}
      {doneTasks.length > 0 && (
        <div className="panel overflow-hidden mt-2">
          <div
            className="flex items-center gap-2 px-4 py-3 cursor-pointer hover:bg-surface2 transition-colors"
            onClick={() => setShowDone(v => !v)}
          >
            <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Completed in Notion</span>
            <span className="text-[10px] text-ink-muted bg-surface2 px-1.5 py-0.5 rounded font-semibold">{doneTasks.length}</span>
            <span className="ml-auto text-[10px] text-ink-muted">{showDone ? '▲ Hide' : '▼ Show'}</span>
          </div>
          {showDone && (
            <div className="divide-y divide-border">
              {doneTasks.map(t => (
                <div key={t.id} className="flex items-center gap-3 px-4 py-2.5 opacity-40">
                  <span className="text-teal text-[12px] shrink-0">✓</span>
                  <span className="text-[12.5px] text-ink line-through flex-1">{t.title}</span>
                  {t.url && (
                    <a href={t.url} target="_blank" rel="noreferrer"
                      className="text-[10px] text-ink-muted hover:text-teal">↗</a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Progress Bar ────────────────────────────────────────────────────────────

function ProgressBar({ value }) {
  const pct = Math.min(100, Math.max(0, Number(value) || 0))
  return (
    <div className="w-full rounded-full overflow-hidden" style={{ height: 4, background: '#EEEEEE' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: '#0D9E9E', transition: 'width 0.3s' }} />
    </div>
  )
}

// ─── Projects Tab ────────────────────────────────────────────────────────────

const DEPT_COLORS = {
  Design: '#5533AA',
  Manufacturing: '#157A50',
  Operations: '#A07A10',
  Business: '#2255AA',
}

function ProjectRow({ project }) {
  const [expanded, setExpanded] = useState(false)
  const { dispatch } = useApp()
  const [form, setForm] = useState({ ...project })

  async function handleSave() {
    try {
      await api.put(`/data/projects/${project.id}`, form)
      dispatch({ type: 'UPDATE', key: 'projects', id: project.id, value: form })
    } catch {}
    setExpanded(false)
  }

  return (
    <div
      className="border-b last:border-0 cursor-pointer"
      style={{ borderColor: '#EEEEEE' }}
    >
      <div
        className="flex items-center gap-3 py-2.5 px-3 hover:bg-surface2 transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        <span className="flex-1 text-xs font-medium" style={{ color: '#1A1A1A' }}>
          {project.name}
        </span>
        <StatusBadge status={project.status} />
        <div style={{ width: 80 }}>
          <ProgressBar value={project.percentComplete} />
          <div className="text-center" style={{ fontSize: 9, color: '#58595b', marginTop: 1 }}>
            {project.percentComplete || 0}%
          </div>
        </div>
        {project.dueDate && (
          <span
            className="text-xs flex-shrink-0"
            style={{ color: isOverdue(project.dueDate) ? '#B52B2B' : '#58595b', minWidth: 60 }}
          >
            {fmtDateShort(project.dueDate)}
          </span>
        )}
        {project.blockers && (
          <span
            className="text-xs px-1.5 py-0.5 rounded"
            style={{ background: '#FFF0F0', color: '#B52B2B', fontSize: 9 }}
          >
            Blocked
          </span>
        )}
        <span className="text-xs" style={{ color: '#BBBBBB' }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div className="px-4 pb-4 pt-2" style={{ background: '#FAFAFA' }}>
          <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div>
              <label className="section-title block mb-1">Status</label>
              <select
                className="input-field w-full text-xs"
                value={form.status || ''}
                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
              >
                {['Not Started', 'In Progress', 'Complete', 'On Hold', 'Blocked'].map(s => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="section-title block mb-1">% Complete</label>
              <input
                type="number"
                className="input-field w-full text-xs"
                value={form.percentComplete || ''}
                onChange={e => setForm(f => ({ ...f, percentComplete: e.target.value }))}
              />
            </div>
            <div>
              <label className="section-title block mb-1">Due Date</label>
              <input
                type="date"
                className="input-field w-full text-xs"
                value={form.dueDate || ''}
                onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
              />
            </div>
            <div>
              <label className="section-title block mb-1">Owner</label>
              <input
                className="input-field w-full text-xs"
                value={form.owner || ''}
                onChange={e => setForm(f => ({ ...f, owner: e.target.value }))}
              />
            </div>
            <div className="col-span-2">
              <label className="section-title block mb-1">Blockers</label>
              <textarea
                className="input-field w-full text-xs"
                rows={2}
                value={form.blockers || ''}
                onChange={e => setForm(f => ({ ...f, blockers: e.target.value }))}
              />
            </div>
            <div className="col-span-2">
              <label className="section-title block mb-1">Notes</label>
              <textarea
                className="input-field w-full text-xs"
                rows={2}
                value={form.notes || ''}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end mt-3">
            <button className="btn-ghost text-xs px-3 py-1.5" onClick={() => setExpanded(false)}>Cancel</button>
            <button className="btn-primary text-xs px-3 py-1.5" onClick={handleSave}>Save</button>
          </div>
        </div>
      )}
    </div>
  )
}

function ProjectsTab() {
  const { state } = useApp()
  const projects = state.projects || []
  const departments = ['Design', 'Manufacturing', 'Operations', 'Business']

  return (
    <div className="flex flex-col gap-5">
      {departments.map(dept => {
        const items = projects.filter(p => (p.department || 'Business') === dept)
        return (
          <div key={dept} className="panel overflow-hidden">
            <div
              className="panel-header"
              style={{ background: DEPT_COLORS[dept] + '10', borderBottom: '1px solid ' + DEPT_COLORS[dept] + '30' }}
            >
              <span className="text-xs font-bold" style={{ color: DEPT_COLORS[dept] }}>
                {dept}
              </span>
              <span className="text-xs" style={{ color: '#58595b' }}>{items.length} projects</span>
            </div>
            {items.length === 0 ? (
              <p className="text-xs p-3" style={{ color: '#58595b' }}>No {dept.toLowerCase()} projects.</p>
            ) : (
              items.map(p => <ProjectRow key={p.id} project={p} />)
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Decisions Tab ───────────────────────────────────────────────────────────

function DecisionRow({ decision }) {
  const { dispatch } = useApp()

  async function markResolved() {
    try {
      await api.put(`/data/decisions/${decision.id}`, { resolved: true })
      dispatch({ type: 'UPDATE', key: 'decisions', id: decision.id, value: { resolved: true } })
    } catch {}
  }

  return (
    <div className="panel p-4 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-medium" style={{ color: '#1A1A1A', flex: 1 }}>
          {decision.title}
        </span>
        <div className="flex items-center gap-2 flex-shrink-0">
          {decision.dueDate && (
            <span
              className="text-xs"
              style={{ color: isOverdue(decision.dueDate) ? '#B52B2B' : '#58595b' }}
            >
              Due {fmtDateShort(decision.dueDate)}
            </span>
          )}
          <button
            className="btn-ghost text-xs px-2 py-1"
            onClick={markResolved}
          >
            Mark Resolved
          </button>
        </div>
      </div>
      {decision.context && (
        <p className="text-xs leading-relaxed" style={{ color: '#58595b' }}>
          {decision.context}
        </p>
      )}
    </div>
  )
}

function AddDecisionModal({ onClose }) {
  const { dispatch } = useApp()
  const [form, setForm] = useState({ title: '', context: '', dueDate: '' })
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!form.title.trim()) return
    setSaving(true)
    try {
      const res = await api.post('/data/decisions', form)
      dispatch({ type: 'ADD', key: 'decisions', value: { ...form, id: res?.id || String(Date.now()), resolved: false } })
      onClose()
    } catch {} finally { setSaving(false) }
  }

  return (
    <Modal title="New Decision" onClose={onClose}>
      <div className="flex flex-col gap-3 p-4">
        <div>
          <label className="section-title block mb-1">Decision Title</label>
          <input className="input-field w-full" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Choose bottle supplier for NeVoo" />
        </div>
        <div>
          <label className="section-title block mb-1">Context</label>
          <textarea className="input-field w-full" rows={3} value={form.context} onChange={e => setForm(f => ({ ...f, context: e.target.value }))} />
        </div>
        <div>
          <label className="section-title block mb-1">Due Date</label>
          <input type="date" className="input-field w-full" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
        </div>
        <div className="flex gap-2 justify-end mt-1">
          <button className="btn-ghost text-xs px-3 py-1.5" onClick={onClose}>Cancel</button>
          <button className="btn-primary text-xs px-3 py-1.5" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </Modal>
  )
}

function DecisionsTab() {
  const { state } = useApp()
  const [addOpen, setAddOpen] = useState(false)
  const open = (state.decisions || []).filter(d => !d.resolved)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="section-title">{open.length} Open Decision{open.length !== 1 ? 's' : ''}</span>
        <button className="btn-primary text-xs px-3 py-1.5" onClick={() => setAddOpen(true)}>+ Add Decision</button>
      </div>
      {open.length === 0
        ? <EmptyState message="No open decisions." />
        : open.map(d => <DecisionRow key={d.id} decision={d} />)
      }
      {addOpen && <AddDecisionModal onClose={() => setAddOpen(false)} />}
    </div>
  )
}

// ─── Pipeline Tab ────────────────────────────────────────────────────────────

const STAGE_STATUS_COLORS = {
  done: { bg: '#E8F8F2', text: '#157A50' },
  'in progress': { bg: '#E8F5FF', text: '#2255AA' },
  pending: { bg: '#FFFFF0', text: '#A07A10' },
  blocked: { bg: '#FFF0F0', text: '#B52B2B' },
  default: { bg: '#F5F5F5', text: '#58595b' },
}

function stageColor(val) {
  if (!val) return STAGE_STATUS_COLORS.default
  const v = val.toLowerCase()
  if (v.includes('done') || v.includes('complete') || v.includes('approved')) return STAGE_STATUS_COLORS.done
  if (v.includes('progress') || v.includes('active') || v.includes('review')) return STAGE_STATUS_COLORS['in progress']
  if (v.includes('pending') || v.includes('wait') || v.includes('tbd')) return STAGE_STATUS_COLORS.pending
  if (v.includes('block')) return STAGE_STATUS_COLORS.blocked
  return STAGE_STATUS_COLORS.default
}

function PipelineCell({ value }) {
  const c = stageColor(value)
  return (
    <td style={{ padding: '6px 10px' }}>
      <span
        className="text-xs px-2 py-0.5 rounded-full font-medium"
        style={{ background: c.bg, color: c.text, whiteSpace: 'nowrap' }}
      >
        {value || '—'}
      </span>
    </td>
  )
}

function getBrandColor(brand) {
  const b = (brand || '').toLowerCase()
  for (const key of Object.keys(BRAND_COLORS)) {
    if (b.includes(key)) return BRAND_COLORS[key]
  }
  return '#58595b'
}

function PipelineTab() {
  const { state } = useApp()
  const products = state.products || []

  if (products.length === 0) return <EmptyState message="No products in pipeline." />

  return (
    <div className="panel overflow-hidden">
      <div className="overflow-x-auto">
        <table className="table-base" style={{ minWidth: 700 }}>
          <thead>
            <tr style={{ background: '#F5F5F5' }}>
              <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 10, color: '#58595b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', width: 200 }}>Product</th>
              <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 10, color: '#58595b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Brand</th>
              {PIPELINE_STAGES.map(s => (
                <th key={s} style={{ textAlign: 'left', padding: '8px 10px', fontSize: 10, color: '#58595b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {products.map(p => (
              <tr
                key={p.id}
                style={{ borderBottom: '1px solid #EEEEEE' }}
                className="hover:bg-surface2 transition-colors"
              >
                <td style={{ padding: '7px 12px' }}>
                  <div className="text-xs font-medium" style={{ color: '#1A1A1A' }}>{p.name || p.marketingName || '—'}</div>
                  {p.formulaNumber && <div className="text-xs" style={{ color: '#58595b' }}>{p.formulaNumber}</div>}
                </td>
                <td style={{ padding: '7px 10px' }}>
                  <span
                    className="text-xs font-semibold"
                    style={{ color: getBrandColor(p.clientBrand || p.brand) }}
                  >
                    {p.clientBrand || p.brand || '—'}
                  </span>
                </td>
                <PipelineCell value={p.formulaStatus || p.status} />
                <PipelineCell value={p.bottleStatus || p.packagingStatus} />
                <PipelineCell value={p.artworkStatus} />
                <PipelineCell value={p.launchStatus} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Purchasing Tab ──────────────────────────────────────────────────────────

const PO_TYPES = ['RFQ', 'Quote', 'PO', 'Production Order']

function PurchasingTab() {
  const { state } = useApp()
  const purchasing = state.purchasing || []
  const inventory = state.inventory || []

  const lowStock = inventory.filter(i => {
    const qty = Number(i.quantity || i.stock || 0)
    const min = Number(i.minimum || i.minStock || 0)
    return qty <= min && min > 0
  })

  return (
    <div className="flex flex-col gap-5">
      {lowStock.length > 0 && (
        <div className="panel p-4" style={{ borderColor: '#B52B2B', borderLeftWidth: 3 }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="section-title" style={{ color: '#B52B2B' }}>Low Stock Alert</span>
            <span
              className="text-xs font-bold px-1.5 py-0.5 rounded-full"
              style={{ background: '#FFF0F0', color: '#B52B2B' }}
            >
              {lowStock.length}
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            {lowStock.map((item, i) => (
              <div key={item.id || i} className="flex items-center justify-between text-xs">
                <span style={{ color: '#1A1A1A' }}>{item.name || item.sku || '—'}</span>
                <span style={{ color: '#B52B2B', fontWeight: 600 }}>
                  {item.quantity ?? item.stock ?? 0} remaining
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {PO_TYPES.map(type => {
        const items = purchasing.filter(p => (p.type || '').toLowerCase() === type.toLowerCase())
        return (
          <div key={type} className="panel overflow-hidden">
            <div className="panel-header">
              <span className="section-title">{type}</span>
              <span className="text-xs" style={{ color: '#58595b' }}>{items.length}</span>
            </div>
            {items.length === 0 ? (
              <p className="text-xs p-3" style={{ color: '#58595b' }}>No {type} items.</p>
            ) : (
              <table className="table-base w-full" style={{ fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#F5F5F5' }}>
                    <th style={{ textAlign: 'left', padding: '6px 12px' }}>Item</th>
                    <th style={{ textAlign: 'left', padding: '6px 10px' }}>Supplier</th>
                    <th style={{ textAlign: 'left', padding: '6px 10px' }}>Status</th>
                    <th style={{ textAlign: 'left', padding: '6px 10px' }}>Amount</th>
                    <th style={{ textAlign: 'left', padding: '6px 10px' }}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((p, i) => (
                    <tr key={p.id || i} style={{ borderBottom: '1px solid #EEEEEE' }} className="hover:bg-surface2">
                      <td style={{ padding: '6px 12px', color: '#1A1A1A', fontWeight: 500 }}>{p.name || p.item || '—'}</td>
                      <td style={{ padding: '6px 10px', color: '#58595b' }}>{p.supplier || '—'}</td>
                      <td style={{ padding: '6px 10px' }}>
                        <StatusBadge status={p.status} />
                      </td>
                      <td style={{ padding: '6px 10px', color: '#1A1A1A' }}>
                        {p.amount ? `$${Number(p.amount).toLocaleString()}` : '—'}
                      </td>
                      <td style={{ padding: '6px 10px', color: '#58595b' }}>
                        {p.date ? fmtDateShort(p.date) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function WorkV3() {
  const [activeTab, setActiveTab] = useState('Tasks')

  return (
    <div className="page-scroll">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-base font-bold" style={{ color: '#1A1A1A' }}>Work</h1>
      </div>

      {/* Tab Switcher */}
      <div
        className="flex gap-1 mb-6 p-1 rounded-lg"
        style={{ background: '#EEEEEE', width: 'fit-content' }}
      >
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="text-xs font-semibold px-4 py-1.5 rounded-md transition-all"
            style={
              activeTab === tab
                ? { background: '#FFFFFF', color: '#0D9E9E', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }
                : { color: '#58595b' }
            }
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'Tasks' && <TasksTab />}
      {activeTab === 'Projects' && <ProjectsTab />}
      {activeTab === 'Decisions' && <DecisionsTab />}
      {activeTab === 'Pipeline' && <PipelineTab />}
      {activeTab === 'Purchasing' && <PurchasingTab />}
    </div>
  )
}
