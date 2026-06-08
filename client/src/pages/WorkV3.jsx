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

const CATEGORIES = [
  {
    key: 'Formulas & R&D',
    color: '#157A50',
    icon: '⚗',
    test: (t, src) =>
      /formula|inci|ingredient|batch|stability|formul|which formula|r&d|formulating|chemist|active|concentration|ph |preservative|emulsifier|surfactant|raw material/.test(t),
  },
  {
    key: 'Packaging & Labels',
    color: '#A86200',
    icon: '📦',
    test: (t, src) =>
      /packaging|bottle|jar|tube|closure|pump|cap|dieline|label|artwork|print|silkscreen|finish|carton|box|container|airless|matte|gloss|frosted|pantone|upc|barcode|mockup|render|seal|fill weight|bottle direction|label system|packaging material|packaging direction/.test(t),
  },
  {
    key: 'Website & Digital',
    color: '#2255AA',
    icon: '🌐',
    test: (t, src) =>
      /website|web |homepage|e-commerce|shopify|catalog|store|navigation|menu|landing|digital direction|site direction|page structure|mockup.*site|site.*mockup|catalog.*architecture|collection page|product page|booking.*flow|digital/.test(t),
  },
  {
    key: 'Brand Identity & Design',
    color: '#5533AA',
    icon: '✦',
    test: (t, src) =>
      /brand identity|visual system|typography|color palette|logo|color strategy|design direction|visual direction|brand tone|brand story|reference.*visual|visual.*reference|mockup|concept mock|identity|brand direction|design system|creative/.test(t),
  },
  {
    key: 'Salt Spa — Legal & Finance',
    color: '#B52B2B',
    icon: '⚖',
    test: (t, src) =>
      src.includes('salt spa') && /agreement|legal|contract|lease|attorney|tax|ein|llc|operating agreement|waiver|consent|signage|financial model|cash flow|bank account|quickbooks|revenue|budget|distribution gate|financial review|financing|capital/.test(t),
  },
  {
    key: 'Salt Spa — Build-out & Equipment',
    color: '#C17F24',
    icon: '🏗',
    test: (t, src) =>
      src.includes('salt spa') && /floor plan|build|install|furniture|equipment|hydrafacial|led|microcurrent|shelf|display|window|signage|partition|classroom|office|acoust|room|event space|mixing bar|refill bar|beauty bar|apothecary wall|front window/.test(t),
  },
  {
    key: 'Salt Spa — Retail, Products & Hiring',
    color: '#157A50',
    icon: '🛍',
    test: (t, src) =>
      src.includes('salt spa') && /retail|wholesale|inventory|hire|staff|position|train|commission|sku|apothecary|formulate|brand.*wall|pos|booking system|faire|catalog|trade show|product|import|vendor|exclusiv|merchandis|commission|return policy|checklist|cash handling/.test(t),
  },
  {
    key: 'Client Brand Work',
    color: '#0D9E9E',
    icon: '◈',
    test: (t, src) =>
      /nevoo|daily rou|nitt beauty|devoted man|skin axis|sip.formulate|salt spa|client profile|molly smith|gamze|meredith|josh smith|andrew moss/.test(t),
  },
  {
    key: 'TCF — Operations & Compliance',
    color: '#444444',
    icon: '◎',
    test: () => true, // catch-all
  },
]

function categorizeTask(task) {
  const t = (task.title || '').toLowerCase()
  const src = (task.sourceName || '').toLowerCase()
  for (const cat of CATEGORIES) {
    if (cat.test(t, src)) return cat.key
  }
  return 'TCF — Operations & Compliance'
}

const CATEGORY_COLORS = Object.fromEntries(CATEGORIES.map(c => [c.key, c.color]))
const CATEGORY_ICONS  = Object.fromEntries(CATEGORIES.map(c => [c.key, c.icon]))

// ─── Urgency scoring ─────────────────────────────────────────────────────────
function urgencyScore(task) {
  let score = 0
  const t = (task.title || '').toLowerCase()
  const now = new Date()

  // Due date urgency
  if (task.dueDate) {
    const due = new Date(task.dueDate)
    const daysUntil = (due - now) / (1000 * 60 * 60 * 24)
    if (daysUntil < 0)       score += 100  // overdue
    else if (daysUntil < 3)  score += 80
    else if (daysUntil < 7)  score += 60
    else if (daysUntil < 14) score += 40
    else if (daysUntil < 30) score += 20
  }

  // Status boost
  if (task.status === 'In progress' || task.status === 'In Progress') score += 50

  // Keyword urgency
  if (/confirm|sign|approve|urgent|asap|rush|deadline|overdue|today|this week|by friday|by monday/.test(t)) score += 30
  if (/draft|finalize|complete|finish|submit|send|review/.test(t)) score += 10

  return score
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

function TaskRow({ task, dim }) {
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
      {task.url && (
        <a
          href={task.url}
          target="_blank"
          rel="noreferrer"
          className="flex-shrink-0 text-xs"
          style={{ color: '#58595b', lineHeight: 1 }}
          title={`Open in Drive — ${task.sourceName || ''}`}
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
      const res = await api.post('/drive-tasks/tasks', form)
      dispatch({ type: 'ADD', key: 'tasks', value: { ...form, id: res?.id || String(Date.now()), status: 'Not started', source: 'drive' } })
      onClose()
    } catch (e) {
      setErr('Could not add to Drive. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Add Task to Drive" onClose={onClose}>
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
            {saving ? 'Saving…' : 'Add to Drive'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Tasks Tab ───────────────────────────────────────────────────────────────

const DRIVE_SOURCE_DOCS = [
  { name: 'TCF to-do List',               url: 'https://docs.google.com/document/d/1ofvcpceHYsEt7I-dwZXA78YycDH0WsdhlbUVlI0lYJA/edit' },
  { name: "Katherine's Notes",             url: 'https://docs.google.com/document/d/1hg66MmORP86JiuprbWGV0d3r480A31mCpm47GBYcnxM/edit' },
  { name: 'Salt Spa Action Items',         url: 'https://docs.google.com/spreadsheets/d/1iPMeoBklpr90wV553ZGnYCsKqsmk4Jb9ww6kK-TXGjI/edit' },
  { name: 'Action Items – Class & Retail', url: 'https://docs.google.com/document/d/1IU3mAtJVSA1wO_xK8-3jwPlHxEe8xNWPruZgFvbXLcw/edit' },
]

function TasksTab() {
  const { state } = useApp()
  const [filter, setFilter] = useState('all')
  const [showDone, setShowDone] = useState(false)
  const [addOpen, setAddOpen] = useState(false)

  const allActive = (state.tasks || []).filter(t => !t.done && t.status !== 'Done' && t.status !== 'Complete' && t.status !== 'Completed')

  const filtered = filter === 'inprogress'
    ? allActive.filter(t => t.status === 'In progress' || t.status === 'In Progress')
    : filter === 'notstarted'
    ? allActive.filter(t => t.status !== 'In progress' && t.status !== 'In Progress')
    : allActive

  const done = (state.tasks || []).filter(t => t.done || t.status === 'Done' || t.status === 'Complete' || t.status === 'Completed')

  // Group by category, sort tasks within each by urgency (highest first)
  const rawGroups = groupByCategory(filtered)
  const sortedGroups = Object.fromEntries(
    Object.entries(rawGroups).map(([cat, tasks]) => [
      cat,
      [...tasks].sort((a, b) => urgencyScore(b) - urgencyScore(a)),
    ])
  )

  // Order categories: categories with any overdue/in-progress tasks first,
  // then follow CATEGORIES definition order (already priority-ordered)
  const catMaxScore = cat => Math.max(0, ...(sortedGroups[cat] || []).map(urgencyScore))
  const orderedCats = CATEGORIES.map(c => c.key)
    .filter(k => sortedGroups[k]?.length > 0)
    .sort((a, b) => {
      // If one has overdue tasks, it wins
      const aScore = catMaxScore(a)
      const bScore = catMaxScore(b)
      if (aScore !== bScore) return bScore - aScore
      return 0 // preserve definition order when tied
    })

  // Task counts per source doc (for chips)
  const sourceCounts = {}
  allActive.forEach(t => { const n = t.sourceName || 'Other'; sourceCounts[n] = (sourceCounts[n] || 0) + 1 })

  return (
    <div className="flex flex-col gap-5">

      {/* Connected Drive Sources */}
      <div className="panel p-3">
        <div className="flex items-center gap-2 mb-2.5">
          <span className="text-[9.5px] font-bold uppercase tracking-wider text-ink-muted">Connected Google Drive Sources</span>
          <span className="text-[9px] text-ink-muted">· auto-syncs 4× daily · click any doc to edit directly</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {DRIVE_SOURCE_DOCS.map(doc => (
            <a key={doc.name} href={doc.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border hover:border-teal hover:bg-teal/5 transition-colors group">
              <span className="text-[11.5px] font-medium text-ink group-hover:text-teal transition-colors">{doc.name}</span>
              {sourceCounts[doc.name] > 0 && (
                <span className="text-[9px] bg-teal/10 text-teal px-1.5 py-0.5 rounded-full font-bold">
                  {sourceCounts[doc.name]}
                </span>
              )}
              <span className="text-[10px] text-ink-muted group-hover:text-teal">↗</span>
            </a>
          ))}
        </div>
      </div>

      {/* Status filter + count */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 p-1 rounded-lg" style={{ background: '#EEEEEE', width: 'fit-content' }}>
          {[['all', 'All'], ['inprogress', 'In Progress'], ['notstarted', 'Not Started']].map(([v, label]) => (
            <button key={v} onClick={() => setFilter(v)}
              className="text-xs font-semibold px-3 py-1.5 rounded-md transition-all"
              style={filter === v
                ? { background: '#FFFFFF', color: '#0D9E9E', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }
                : { color: '#58595b' }}>
              {label}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-ink-muted">{filtered.length} task{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Category Sections — ordered by urgency */}
      {filtered.length === 0 ? (
        <EmptyState message="No tasks match this filter." />
      ) : (
        orderedCats.map(cat => {
          const tasks = sortedGroups[cat] || []
          if (tasks.length === 0) return null
          const color = CATEGORY_COLORS[cat] || '#58595b'
          const icon  = CATEGORY_ICONS[cat]  || '•'
          const topScore = catMaxScore(cat)
          const isUrgent = topScore >= 80
          return (
            <div key={cat} className="panel overflow-hidden">
              <div className="panel-header" style={{
                background: color + '10',
                borderBottom: '1px solid ' + color + '25',
              }}>
                <div className="flex items-center gap-2">
                  <span className="text-[13px]">{icon}</span>
                  <span className="text-[11.5px] font-bold" style={{ color }}>{cat}</span>
                  {isUrgent && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ background: '#FEE2E2', color: '#B91C1C' }}>URGENT</span>
                  )}
                </div>
                <span className="text-[10.5px] text-ink-muted">{tasks.length} task{tasks.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="divide-y divide-border">
                {tasks.map((t, idx) => {
                  const score = urgencyScore(t)
                  const overdue = t.dueDate && isOverdue(t.dueDate)
                  const inProg  = t.status === 'In progress' || t.status === 'In Progress'
                  return (
                    <div key={t.id} className="flex items-start gap-3 px-4 py-2.5 hover:bg-surface2 group transition-colors">
                      {/* Priority indicator */}
                      <div className="flex flex-col items-center gap-0.5 shrink-0 mt-[3px]">
                        <div className="w-2 h-2 rounded-full border"
                          style={{
                            background: overdue ? '#B52B2B' : inProg ? color : 'white',
                            borderColor: overdue ? '#B52B2B' : inProg ? color : '#BBBBBB',
                          }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[12.5px] text-ink leading-snug">{t.title}</div>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span className="text-[10px] text-ink-muted">{t.sourceName}</span>
                          {inProg && <span className="text-[9px] font-semibold text-teal bg-teal/10 px-1.5 py-0.5 rounded-full">In Progress</span>}
                          {overdue && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: '#FEE2E2', color: '#B91C1C' }}>Overdue</span>}
                          {t.dueDate && !overdue && (
                            <span className="text-[10px]" style={{ color: '#888' }}>· Due {t.dueDate}</span>
                          )}
                        </div>
                      </div>
                      {t.url && (
                        <a href={t.url} target="_blank" rel="noopener noreferrer"
                          className="opacity-0 group-hover:opacity-100 text-[11px] text-teal hover:underline shrink-0 mt-0.5 font-medium transition-opacity"
                          title={`Open in Drive — ${t.sourceName || ''}`}>↗</a>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })
      )}

      {/* Completed */}
      <div className="panel p-4" style={{ borderColor: '#D8D8D8' }}>
        <TaskColumn label="Completed" tasks={done} count={done.length} dim collapsed={!showDone} onToggle={() => setShowDone(v => !v)} />
      </div>

      <div>
        <button className="btn-primary text-xs px-3 py-2" onClick={() => setAddOpen(true)}>+ Add Task</button>
      </div>
      {addOpen && <AddTaskModal onClose={() => setAddOpen(false)} />}
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
