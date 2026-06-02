import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import { fmtDate, fmtDateShort, timeAgo, isOverdue, daysUntil } from '../lib/utils';
import StatusBadge from '../components/StatusBadge';
import KPICard, { KPIStrip } from '../components/KPICard';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';
import api from '../lib/api';

const IN_DEV_STATUSES = ['Concept', 'Formulating', 'In Development', 'Stability Testing'];
const TASK_CATEGORIES = ['Operations', 'Product Development', 'Creative', 'Website', 'Purchasing', 'Inventory', 'Supplier Management', 'Marketing', 'Research'];
const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'];
const PRIORITY_COLORS = { Critical: '#B52B2B', High: '#A86200', Medium: '#0D9E9E', Low: '#58595b' };
const PRIORITY_TEXT = { Critical: 'text-red', High: 'text-amber', Medium: 'text-teal', Low: 'text-ink-muted' };
const PRIORITY_BG = { Critical: 'bg-red/10 border-red-500/30', High: 'bg-amber-500/10 border-amber-500/30', Medium: 'bg-teal-500/10 border-teal-500/30', Low: 'bg-border/40 border-border2' };

function todayStr() { return new Date().toISOString().slice(0, 10); }
function isWithin7Days(dateStr) {
  if (!dateStr) return false;
  const d = daysUntil(dateStr);
  return d >= 0 && d <= 7;
}

// ─── SVG Donut Chart ────────────────────────────────────────────────────────
function DonutChart({ data, size = 120 }) {
  // data: [{ label, value, color }]
  const total = data.reduce((s, d) => s + d.value, 0);
  const cx = size / 2, cy = size / 2, r = size * 0.35, sw = size * 0.12;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  const slices = data.map((d, i) => {
    const frac = total > 0 ? d.value / total : 0;
    const dash = frac * circ;
    const gap = circ - dash;
    const el = (
      <circle
        key={i}
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke={d.color}
        strokeWidth={sw}
        strokeDasharray={`${dash} ${gap}`}
        strokeDashoffset={-offset}
        style={{ transform: 'rotate(-90deg)', transformOrigin: `${cx}px ${cy}px` }}
      />
    );
    offset += dash;
    return el;
  });
  return (
    <svg width={size} height={size}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1C1C1C" strokeWidth={sw} />
      {total === 0
        ? <circle cx={cx} cy={cy} r={r} fill="none" stroke="#222" strokeWidth={sw} />
        : slices}
      <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle" fill="#F0EDE8" fontSize={size * 0.18} fontWeight="600">
        {total}
      </text>
    </svg>
  );
}

// ─── Horizontal Bar Chart ────────────────────────────────────────────────────
function HBarChart({ data, color = '#0D9E9E', maxBars = 6 }) {
  // data: [{ label, value }]
  const shown = data.slice(0, maxBars);
  const max = Math.max(...shown.map(d => d.value), 1);
  return (
    <div className="flex flex-col gap-1.5 w-full">
      {shown.map((d, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-ink-dim text-xs w-28 truncate shrink-0">{d.label}</span>
          <div className="flex-1 bg-surface2 rounded-sm h-3 relative">
            <div
              className="h-3 rounded-sm transition-all"
              style={{ width: `${(d.value / max) * 100}%`, backgroundColor: color }}
            />
          </div>
          <span className="text-ink-dim text-xs w-4 text-right">{d.value}</span>
        </div>
      ))}
      {shown.length === 0 && <span className="text-ink-muted text-xs">No data</span>}
    </div>
  );
}

// ─── Priority Badge ──────────────────────────────────────────────────────────
function PriBadge({ priority }) {
  const map = { Critical: 'bg-red/10 text-red', High: 'bg-amber/10 text-amber', Medium: 'bg-teal/10 text-teal', Low: 'bg-surface3 text-ink-muted' };
  return <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${map[priority] || map.Low}`}>{priority || 'Low'}</span>;
}

// ─── Type Tag ───────────────────────────────────────────────────────────────
function TypeTag({ type }) {
  const map = { task: 'bg-blue-500/20 text-blue-400', decision: 'bg-purple-500/20 text-purple-400', project: 'bg-gold/20 text-gold' };
  return <span className={`text-xs px-1.5 py-0.5 rounded ${map[type] || 'bg-surface3 text-ink-dim'}`}>{type}</span>;
}

// ─── Item Row ────────────────────────────────────────────────────────────────
function ItemRow({ item }) {
  const overdue = item.dueDate && isOverdue(item.dueDate);
  return (
    <div className="flex items-center gap-2 py-1.5 px-3 hover:bg-surface2 rounded transition-colors group">
      <div className="flex-1 min-w-0">
        <span className="text-ink text-sm truncate block">{item.title || item.name}</span>
      </div>
      <TypeTag type={item._type} />
      {item.priority && <PriBadge priority={item.priority} />}
      {item.status && <StatusBadge status={item.status} />}
      {item.dueDate && (
        <span className={`text-xs shrink-0 ${overdue ? 'text-red' : 'text-ink-dim'}`}>
          {overdue ? '⚠ ' : ''}{fmtDateShort(item.dueDate)}
        </span>
      )}
    </div>
  );
}

// ─── Week Calendar ───────────────────────────────────────────────────────────
function WeekCalendar({ events, onAdd, navigate }) {
  const today = new Date();
  const dow = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-7 gap-1">
        {days.map((d, i) => {
          const ds = d.toISOString().slice(0, 10);
          const isToday = ds === todayStr();
          const dayEvents = events.filter(e => e.date && e.date.slice(0, 10) === ds);
          return (
            <div key={i} className={`rounded p-1.5 min-h-[80px] ${isToday ? 'bg-teal/10 border border-teal/30' : 'bg-surface2 border border-border'}`}>
              <div className={`text-xs font-medium mb-1 ${isToday ? 'text-teal' : 'text-ink-dim'}`}>
                {dayLabels[i]} <span className={isToday ? 'text-teal' : 'text-ink-muted'}>{d.getDate()}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                {dayEvents.slice(0, 3).map((ev, j) => (
                  <div key={j} className="text-xs bg-teal/20 text-teal rounded px-1 truncate">{ev.title}</div>
                ))}
                {dayEvents.length > 3 && <div className="text-xs text-ink-muted">+{dayEvents.length - 3}</div>}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex gap-2">
        <button onClick={onAdd} className="btn-ghost text-xs">+ Add Event</button>
        <button onClick={() => navigate('/calendar')} className="text-xs text-teal hover:underline">View Full Calendar →</button>
      </div>
    </div>
  );
}

// ─── Quick-Add Modals ────────────────────────────────────────────────────────
function TaskModal({ onClose, onSave }) {
  const [form, setForm] = useState({ title: '', priority: 'Medium', category: 'Operations', dueDate: '' });
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  return (
    <Modal title="Add Task" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <input className="input-field" placeholder="Task title" value={form.title} onChange={set('title')} />
        <div className="grid grid-cols-2 gap-2">
          <select className="input-field" value={form.priority} onChange={set('priority')}>
            {PRIORITIES.map(p => <option key={p}>{p}</option>)}
          </select>
          <select className="input-field" value={form.category} onChange={set('category')}>
            {TASK_CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <input type="date" className="input-field" value={form.dueDate} onChange={set('dueDate')} />
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={() => onSave(form)} disabled={!form.title.trim()}>Add Task</button>
        </div>
      </div>
    </Modal>
  );
}

function DecisionModal({ onClose, onSave }) {
  const [form, setForm] = useState({ title: '', context: '', dueDate: '', priority: 'Medium' });
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  return (
    <Modal title="Add Decision" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <input className="input-field" placeholder="Decision title" value={form.title} onChange={set('title')} />
        <textarea className="input-field resize-none" rows={3} placeholder="Context / background" value={form.context} onChange={set('context')} />
        <div className="grid grid-cols-2 gap-2">
          <select className="input-field" value={form.priority} onChange={set('priority')}>
            {PRIORITIES.map(p => <option key={p}>{p}</option>)}
          </select>
          <input type="date" className="input-field" value={form.dueDate} onChange={set('dueDate')} />
        </div>
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={() => onSave(form)} disabled={!form.title.trim()}>Add Decision</button>
        </div>
      </div>
    </Modal>
  );
}

function ProductModal({ onClose, onSave }) {
  const [form, setForm] = useState({ name: '', brand: 'TCF', category: 'Skincare', status: 'Concept' });
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  return (
    <Modal title="Add Product" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <input className="input-field" placeholder="Product name" value={form.name} onChange={set('name')} />
        <div className="grid grid-cols-3 gap-2">
          <select className="input-field" value={form.brand} onChange={set('brand')}>
            {['TCF', 'Private Label', 'Partner'].map(b => <option key={b}>{b}</option>)}
          </select>
          <select className="input-field" value={form.category} onChange={set('category')}>
            {['Skincare', 'Haircare', 'Body', 'Tools', 'Accessories'].map(c => <option key={c}>{c}</option>)}
          </select>
          <select className="input-field" value={form.status} onChange={set('status')}>
            {['Concept', 'Formulating', 'In Development', 'Stability Testing', 'Ready', 'Active'].map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={() => onSave(form)} disabled={!form.name.trim()}>Add Product</button>
        </div>
      </div>
    </Modal>
  );
}

function EventModal({ onClose, onSave }) {
  const [form, setForm] = useState({ title: '', date: todayStr(), type: 'Meeting' });
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  return (
    <Modal title="Add Event" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <input className="input-field" placeholder="Event title" value={form.title} onChange={set('title')} />
        <div className="grid grid-cols-2 gap-2">
          <input type="date" className="input-field" value={form.date} onChange={set('date')} />
          <select className="input-field" value={form.type} onChange={set('type')}>
            {['Meeting', 'Deadline', 'Review', 'Launch', 'Other'].map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={() => onSave(form)} disabled={!form.title.trim()}>Add Event</button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Main Dashboard ──────────────────────────────────────────────────────────
export default function Dashboard() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();

  const [activeView, setActiveView] = useState('priority');
  const [taskModal, setTaskModal] = useState(false);
  const [decisionModal, setDecisionModal] = useState(false);
  const [productModal, setProductModal] = useState(false);
  const [eventModal, setEventModal] = useState(false);

  const tasks = state.tasks || [];
  const projects = state.projects || [];
  const products = state.products || [];
  const suppliers = state.suppliers || [];
  const decisions = state.decisions || [];
  const calendar = state.calendar || [];
  const gmailThreads = state.gmailThreads || [];

  // ── KPI values ──
  const openTasks = tasks.filter(t => !t.done).length;
  const overdueTasks = tasks.filter(t => !t.done && isOverdue(t.dueDate)).length;
  const productsInDev = products.filter(p => IN_DEV_STATUSES.includes(p.status)).length;
  const supplierWaiting = suppliers.filter(s => s.status === 'Waiting').length;
  const openDecisions = decisions.filter(d => d.status !== 'Decided').length;
  const activeProjects = projects.filter(p => p.status === 'In Progress').length;
  const upcoming7 = [
    ...tasks.filter(t => !t.done && isWithin7Days(t.dueDate)),
    ...decisions.filter(d => d.status !== 'Decided' && isWithin7Days(d.dueDate)),
    ...calendar.filter(e => isWithin7Days(e.date))
  ].length;

  // ── Chart data ──
  const taskPriorityCounts = useMemo(() => {
    const open = tasks.filter(t => !t.done);
    return PRIORITIES.map(p => ({ label: p, value: open.filter(t => (t.priority || 'Low') === p).length, color: PRIORITY_COLORS[p] }));
  }, [tasks]);

  const taskCategoryCounts = useMemo(() => {
    const open = tasks.filter(t => !t.done);
    return TASK_CATEGORIES.map(c => ({ label: c, value: open.filter(t => t.category === c).length }))
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [tasks]);

  const productStatusCounts = useMemo(() => {
    const statuses = [...new Set(products.map(p => p.status).filter(Boolean))];
    const colorMap = { Active: '#157A50', 'In Development': '#0D9E9E', Concept: '#5533AA', Formulating: '#2255AA', 'Stability Testing': '#A86200', Discontinued: '#B52B2B', Ready: '#A07A10' };
    return statuses.map(s => ({ label: s, value: products.filter(p => p.status === s).length, color: colorMap[s] || '#444' }));
  }, [products]);

  const projectStatusCounts = useMemo(() => {
    const statusDef = [
      { label: 'Not Started', color: '#444' },
      { label: 'In Progress', color: '#0D9E9E' },
      { label: 'Complete', color: '#157A50' },
      { label: 'Blocked', color: '#B52B2B' },
      { label: 'On Hold', color: '#A86200' },
    ];
    return statusDef.map(s => ({ ...s, value: projects.filter(p => p.status === s.label).length })).filter(d => d.value > 0);
  }, [projects]);

  // ── All items for views ──
  const allOpenItems = useMemo(() => [
    ...tasks.filter(t => !t.done).map(t => ({ ...t, _type: 'task', _priority: t.priority || 'Low' })),
    ...decisions.filter(d => d.status !== 'Decided').map(d => ({ ...d, _type: 'decision', _priority: d.priority || 'Medium' })),
    ...projects.filter(p => p.status !== 'Complete').map(p => ({ ...p, title: p.name, _type: 'project', _priority: p.priority || 'Medium' })),
  ], [tasks, decisions, projects]);

  // ── Today priorities ──
  const todayItems = useMemo(() => allOpenItems
    .filter(i => i.dueDate && isOverdue(i.dueDate) || i._priority === 'Critical')
    .sort((a, b) => {
      const po = { Critical: 0, High: 1, Medium: 2, Low: 3 };
      return (po[a._priority] || 3) - (po[b._priority] || 3);
    })
    .slice(0, 8), [allOpenItems]);

  // ── Activity feed ──
  const activityFeed = useMemo(() => {
    const feed = [];
    gmailThreads.slice(0, 3).forEach(t => feed.push({ text: t.subject || 'Email thread', sub: t.from, time: t.date, icon: '✉' }));
    tasks.filter(t => t.done).slice(-3).forEach(t => feed.push({ text: t.title, sub: 'Task completed', time: t.updatedAt || t.dueDate, icon: '✓' }));
    decisions.filter(d => d.status === 'Decided').slice(-2).forEach(d => feed.push({ text: d.title, sub: 'Decision made', time: d.updatedAt, icon: '◆' }));
    return feed.sort((a, b) => (b.time || '') > (a.time || '') ? 1 : -1).slice(0, 8);
  }, [gmailThreads, tasks, decisions]);

  // ── Handlers ──
  async function saveTask(form) {
    const res = await api.post('/data/tasks', { ...form, done: false });
    dispatch({ type: 'ADD', key: 'tasks', value: res });
    setTaskModal(false);
  }
  async function saveDecision(form) {
    const res = await api.post('/data/decisions', { ...form, status: 'Open' });
    dispatch({ type: 'ADD', key: 'decisions', value: res });
    setDecisionModal(false);
  }
  async function saveProduct(form) {
    const res = await api.post('/data/products', form);
    dispatch({ type: 'ADD', key: 'products', value: res });
    setProductModal(false);
  }
  async function saveEvent(form) {
    const res = await api.post('/data/calendar', form);
    dispatch({ type: 'ADD', key: 'calendar', value: res });
    setEventModal(false);
  }

  // ── Views ──
  function PriorityView() {
    return (
      <div className="flex flex-col gap-4">
        {PRIORITIES.map(pri => {
          const items = allOpenItems.filter(i => (i._priority || 'Low') === pri);
          return (
            <div key={pri} className={`rounded-lg border ${PRIORITY_BG[pri]} overflow-hidden`}>
              <div className="px-4 py-2 flex items-center gap-2 border-b border-border/40">
                <span className={`font-semibold text-sm ${PRIORITY_TEXT[pri]}`}>{pri}</span>
                <span className="text-xs text-ink-muted bg-surface3 px-1.5 py-0.5 rounded">{items.length}</span>
              </div>
              {items.length === 0
                ? <div className="px-4 py-3 text-xs text-ink-muted">Nothing at this priority</div>
                : <div className="divide-y divide-border/20">
                    {items.map((item, i) => <ItemRow key={i} item={item} />)}
                  </div>
              }
            </div>
          );
        })}
      </div>
    );
  }

  function CategoryView() {
    return (
      <div className="flex flex-col gap-4">
        {TASK_CATEGORIES.map(cat => {
          const items = allOpenItems.filter(i =>
            (i._type === 'task' && i.category === cat) ||
            (i._type === 'decision' && i.category === cat) ||
            (i._type === 'project' && i.department === cat)
          );
          if (items.length === 0) return null;
          return (
            <div key={cat} className="rounded-lg border border-border2 bg-surface overflow-hidden">
              <div className="px-4 py-2 flex items-center gap-2 border-b border-border bg-surface2">
                <span className="font-semibold text-sm text-gold">{cat}</span>
                <span className="text-xs text-ink-muted bg-surface3 px-1.5 py-0.5 rounded">{items.length}</span>
              </div>
              <div className="divide-y divide-border/20">
                {items.map((item, i) => <ItemRow key={i} item={item} />)}
              </div>
            </div>
          );
        })}
        {TASK_CATEGORIES.every(cat => allOpenItems.filter(i =>
          (i._type === 'task' && i.category === cat) ||
          (i._type === 'decision' && i.category === cat) ||
          (i._type === 'project' && i.department === cat)
        ).length === 0) && <EmptyState message="No items with categories assigned" />}
      </div>
    );
  }

  function ProjectView() {
    const sorted = [...projects].sort((a, b) => {
      const po = { Critical: 0, High: 1, Medium: 2, Low: 3 };
      const so = { 'In Progress': 0, 'Not Started': 1, 'On Hold': 2, Blocked: 3, Complete: 4 };
      const pd = (po[a.priority] || 2) - (po[b.priority] || 2);
      if (pd !== 0) return pd;
      return (so[a.status] || 5) - (so[b.status] || 5);
    });
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {sorted.map((proj, i) => {
          const pct = proj.percentComplete || proj.progress || 0;
          return (
            <div key={i} className="panel p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-ink font-medium text-sm">{proj.name}</div>
                  {proj.owner && <div className="text-ink-muted text-xs mt-0.5">{proj.owner}</div>}
                </div>
                <StatusBadge status={proj.status} />
              </div>
              <div>
                <div className="flex justify-between text-xs text-ink-muted mb-1">
                  <span>Progress</span><span>{pct}%</span>
                </div>
                <div className="h-1.5 bg-surface2 rounded-full">
                  <div className="h-1.5 rounded-full bg-teal transition-all" style={{ width: `${Math.min(pct, 100)}%` }} />
                </div>
              </div>
              <div className="flex items-center justify-between">
                {proj.priority && <PriBadge priority={proj.priority} />}
                {proj.dueDate && (
                  <span className={`text-xs ${isOverdue(proj.dueDate) ? 'text-red' : 'text-ink-muted'}`}>
                    Due {fmtDateShort(proj.dueDate)}
                  </span>
                )}
              </div>
              {proj.blockerNote && (
                <div className="text-xs text-red bg-red/10 px-2 py-1 rounded border border-red/30">
                  ⚠ {proj.blockerNote}
                </div>
              )}
            </div>
          );
        })}
        {sorted.length === 0 && <div className="col-span-3"><EmptyState message="No projects yet" /></div>}
      </div>
    );
  }

  function CalendarView() {
    return (
      <WeekCalendar events={calendar} onAdd={() => setEventModal(true)} navigate={navigate} />
    );
  }

  const views = { priority: PriorityView, category: CategoryView, project: ProjectView, calendar: CalendarView };
  const ViewComponent = views[activeView] || PriorityView;

  return (
    <div className="page-scroll">
      {/* KPI Strip */}
      <KPIStrip>
        <KPICard label="Open Tasks" value={openTasks} onClick={() => setActiveView('priority')} />
        <KPICard label="Overdue" value={overdueTasks} color="red" onClick={() => setActiveView('priority')} />
        <KPICard label="In Development" value={productsInDev} onClick={() => setActiveView('category')} />
        <KPICard label="Supplier Waits" value={supplierWaiting} color="amber" />
        <KPICard label="Open Decisions" value={openDecisions} color="amber" onClick={() => setActiveView('priority')} />
        <KPICard label="Active Projects" value={activeProjects} onClick={() => setActiveView('project')} />
        <KPICard label="Upcoming 7 days" value={upcoming7} onClick={() => setActiveView('calendar')} />
      </KPIStrip>

      {/* View Switcher */}
      <div className="flex gap-1 mb-5 flex-wrap">
        {[
          { id: 'priority', label: 'Priority View' },
          { id: 'category', label: 'Category View' },
          { id: 'project', label: 'Project View' },
          { id: 'calendar', label: 'Calendar View' },
        ].map(v => (
          <button
            key={v.id}
            onClick={() => setActiveView(v.id)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              activeView === v.id
                ? 'bg-teal text-bg'
                : 'bg-surface2 text-ink-dim hover:text-ink hover:bg-surface3'
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {/* Chart 1 - Tasks by Priority */}
        <div className="panel p-4">
          <div className="text-xs text-ink-muted font-medium uppercase tracking-wider mb-3">Tasks by Priority</div>
          <div className="flex flex-col items-center gap-3">
            <DonutChart data={taskPriorityCounts} size={100} />
            <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center">
              {taskPriorityCounts.map(d => (
                <div key={d.label} className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                  <span className="text-xs text-ink-muted">{d.label} <span className="text-ink">{d.value}</span></span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Chart 2 - Tasks by Category */}
        <div className="panel p-4">
          <div className="text-xs text-ink-muted font-medium uppercase tracking-wider mb-3">Tasks by Category</div>
          <HBarChart data={taskCategoryCounts} color="#0D9E9E" maxBars={6} />
        </div>

        {/* Chart 3 - Products by Status */}
        <div className="panel p-4">
          <div className="text-xs text-ink-muted font-medium uppercase tracking-wider mb-3">Products by Status</div>
          <div className="flex flex-col items-center gap-3">
            <DonutChart data={productStatusCounts} size={100} />
            <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center">
              {productStatusCounts.map(d => (
                <div key={d.label} className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                  <span className="text-xs text-ink-muted">{d.label} <span className="text-ink">{d.value}</span></span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Chart 4 - Projects by Status */}
        <div className="panel p-4">
          <div className="text-xs text-ink-muted font-medium uppercase tracking-wider mb-3">Projects by Status</div>
          <HBarChart
            data={projectStatusCounts.map(d => ({ label: d.label, value: d.value }))}
            color="#0D9E9E"
            maxBars={5}
          />
        </div>
      </div>

      {/* Main View Content */}
      <div className="mb-5">
        <ViewComponent />
      </div>

      {/* Today + Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        {/* Today's Priorities */}
        <div className="panel">
          <div className="panel-header">
            <span className="section-title">Today's Priorities</span>
          </div>
          <div className="divide-y divide-border/20">
            {todayItems.length === 0
              ? <div className="px-4 py-6 text-center text-ink-muted text-sm">All clear — no critical or overdue items</div>
              : todayItems.map((item, i) => <ItemRow key={i} item={item} />)
            }
          </div>
        </div>

        {/* Activity Feed */}
        <div className="panel">
          <div className="panel-header">
            <span className="section-title">Activity Feed</span>
          </div>
          <div className="divide-y divide-border/20">
            {activityFeed.length === 0
              ? <div className="px-4 py-6 text-center text-ink-muted text-sm">No recent activity</div>
              : activityFeed.map((item, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-2.5 hover:bg-surface2 transition-colors">
                  <span className="text-teal text-xs mt-0.5 shrink-0">{item.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-ink text-sm truncate">{item.text}</div>
                    {item.sub && <div className="text-ink-muted text-xs">{item.sub}</div>}
                  </div>
                  {item.time && <span className="text-ink-muted text-xs shrink-0">{timeAgo ? timeAgo(item.time) : fmtDateShort(item.time)}</span>}
                </div>
              ))
            }
          </div>
        </div>
      </div>

      {/* Quick Add Row */}
      <div className="flex gap-2 flex-wrap pb-8">
        <button className="btn-primary text-sm" onClick={() => setTaskModal(true)}>+ Task</button>
        <button className="btn-ghost text-sm" onClick={() => setDecisionModal(true)}>+ Decision</button>
        <button className="btn-ghost text-sm" onClick={() => setProductModal(true)}>+ Product</button>
      </div>

      {/* Modals */}
      {taskModal && <TaskModal onClose={() => setTaskModal(false)} onSave={saveTask} />}
      {decisionModal && <DecisionModal onClose={() => setDecisionModal(false)} onSave={saveDecision} />}
      {productModal && <ProductModal onClose={() => setProductModal(false)} onSave={saveProduct} />}
      {eventModal && <EventModal onClose={() => setEventModal(false)} onSave={saveEvent} />}
    </div>
  );
}
