import React, { useMemo, useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApp } from '../store/AppContext'
import { fmtDateShort, isOverdue } from '../lib/utils'
import StatusBadge from '../components/StatusBadge'
import api from '../lib/api'

const BRANDS = [
  { name: 'NeVoo',         client: 'Molly Smith',       color: '#0D9E9E' },
  { name: 'Daily Rou',     client: 'Meredith Baurband', color: '#A07A10' },
  { name: 'Nitt Beauty',   client: 'Gamze Gurlevik',    color: '#5533AA' },
  { name: 'Devoted Man',   client: 'Josh Smith',        color: '#2255AA' },
  { name: 'Salt Spa Yoga', client: 'Andrew Moss',       color: '#157A50' },
]

const COMPLETE_STATUSES = new Set(['Ready', 'Approved', 'Live', 'Ready To Launch'])
const INDEV_STATUSES    = new Set(['In Development', 'Formulating'])
const TESTING_STATUSES  = new Set(['Stability Testing'])

const QUICK_LINKS = [
  { label: 'QuickBooks',    url: 'https://accounts.intuit.com/',    group: 'Business' },
  { label: 'HubSpot',       url: 'https://app.hubspot.com/',         group: 'Business' },
  { label: 'Shopify',       url: 'https://accounts.shopify.com/',    group: 'Business' },
  { label: 'Alibaba',       url: 'https://login.alibaba.com/',       group: 'Suppliers' },
  { label: 'Bulk Apothecary', url: 'https://bulkapothecary.com/',    group: 'Suppliers' },
  { label: 'Chunbai (Doria)', url: 'https://alibaba.com/',           group: 'Suppliers' },
]

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function taskDot(title = '') {
  const t = title.toLowerCase()
  if (t.includes('packaging') || t.includes('approval')) return '#B52B2B'
  if (t.includes('website') || t.includes('update')) return '#A86200'
  return '#0D9E9E'
}

// ── Live Clock ────────────────────────────────────────────────────────────────
function LiveClock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })
  const date = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  const h = now.getHours()
  const greeting = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="panel p-4">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-[13px] font-medium text-ink-muted">{greeting}, Katherine</div>
          <div className="text-[11px] text-ink-muted mt-0.5">{date}</div>
        </div>
        <div className="text-right">
          <div className="text-[22px] font-bold text-ink tabular-nums leading-none">{time.split(' ')[0]}</div>
          <div className="text-[11px] font-semibold text-teal mt-0.5">{time.split(' ')[1]}</div>
        </div>
      </div>
    </div>
  )
}

// ── End of Day Recap ──────────────────────────────────────────────────────────
const RECAP_KEY = `tcf-recap-${todayStr()}`

function EndOfDayRecap({ calendarEvents, tasks }) {
  const [items, setItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem(RECAP_KEY) || '[]') } catch { return [] }
  })
  const [input, setInput] = useState('')
  const [adding, setAdding] = useState(false)

  function save(newItems) {
    setItems(newItems)
    localStorage.setItem(RECAP_KEY, JSON.stringify(newItems))
    // Also persist to server if available
    api.post('/data/daily-recap', { date: todayStr(), items: newItems }).catch(() => {})
  }

  function addItem() {
    if (!input.trim()) return
    const updated = [...items, { id: Date.now().toString(), text: input.trim(), ts: new Date().toISOString(), manual: true }]
    save(updated)
    setInput(''); setAdding(false)
  }

  function remove(id) {
    save(items.filter(i => i.id !== id))
  }

  // Auto-add today's calendar events as suggested completions
  const todayEvents = calendarEvents.filter(e => e.date === todayStr() && e.source !== 'gcal')
  const doneTasks = tasks.filter(t => t.done && (t.lastEdited || '').startsWith(todayStr()))

  return (
    <div className="panel">
      <div className="panel-header">
        <span className="section-title">End of Day Recap</span>
        <span className="text-[10px] text-ink-muted">{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
      </div>
      <div className="p-3 flex flex-col gap-2">

        {/* Auto-suggested from today's events */}
        {todayEvents.map(ev => {
          const already = items.find(i => i.id === `ev-${ev.id}`)
          return !already ? (
            <div key={ev.id} className="flex items-center gap-2 py-1 px-2 rounded-lg bg-teal/5 border border-teal/20">
              <span className="text-teal text-[11px] shrink-0">📅</span>
              <span className="text-[11px] text-ink flex-1 leading-snug line-clamp-1">{ev.title}</span>
              <button
                onClick={() => save([...items, { id: `ev-${ev.id}`, text: ev.title, ts: new Date().toISOString(), auto: true }])}
                className="text-[10px] text-teal hover:underline shrink-0 font-medium"
              >
                Mark done
              </button>
            </div>
          ) : null
        })}

        {doneTasks.slice(0, 3).map(t => {
          const already = items.find(i => i.id === `task-${t.id}`)
          return !already ? (
            <div key={t.id} className="flex items-center gap-2 py-1 px-2 rounded-lg bg-green-50 border border-green-200">
              <span className="text-[11px] shrink-0">✓</span>
              <span className="text-[11px] text-ink flex-1 leading-snug line-clamp-1">{t.title}</span>
              <button
                onClick={() => save([...items, { id: `task-${t.id}`, text: t.title, ts: new Date().toISOString(), auto: true }])}
                className="text-[10px] text-green-600 hover:underline shrink-0 font-medium"
              >
                Add
              </button>
            </div>
          ) : null
        })}

        {/* Logged items */}
        {items.length === 0 && !adding && todayEvents.length === 0 && doneTasks.length === 0 && (
          <div className="text-[11px] text-ink-muted py-2 text-center">Nothing logged yet today</div>
        )}
        {items.map(item => (
          <div key={item.id} className="flex items-start gap-2 py-0.5 group">
            <span className="text-green-600 text-[12px] mt-0.5 shrink-0">✓</span>
            <span className="text-[11.5px] text-ink leading-snug flex-1">{item.text}</span>
            <button onClick={() => remove(item.id)}
              className="text-[10px] text-ink-muted hover:text-red opacity-0 group-hover:opacity-100 shrink-0">✕</button>
          </div>
        ))}

        {/* Add input */}
        {adding ? (
          <div className="flex gap-1.5 mt-1">
            <input
              autoFocus
              className="input-field text-xs flex-1"
              placeholder="What did you accomplish?"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addItem(); if (e.key === 'Escape') setAdding(false) }}
            />
            <button onClick={addItem} className="btn-primary text-xs px-2 py-1">Add</button>
            <button onClick={() => { setAdding(false); setInput('') }} className="btn-ghost text-xs px-2 py-1">✕</button>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="mt-1 w-full text-left text-[11px] text-ink-muted hover:text-teal px-2 py-1.5 rounded-lg border border-dashed border-border hover:border-teal/40 transition-colors"
          >
            + Log an accomplishment
          </button>
        )}
      </div>
    </div>
  )
}

// ── Immediate Actions ─────────────────────────────────────────────────────────
function ImmediateActions({ tasks, suppliers, calendar, gmailThreads }) {
  const today = todayStr()
  const now = new Date()

  const actions = useMemo(() => {
    const list = []

    // Overdue tasks with a due date
    tasks
      .filter(t => !t.done && t.dueDate && new Date(t.dueDate) < now)
      .slice(0, 3)
      .forEach(t => list.push({
        id: `task-${t.id}`, type: 'overdue',
        text: t.title,
        meta: `Task overdue since ${fmtDateShort(t.dueDate)}`,
        link: '/work', urgency: 'high',
      }))

    // Overdue supplier follow-ups
    suppliers
      .filter(s => s.status === 'Waiting' && s.nextFollowUp && new Date(s.nextFollowUp) <= now)
      .slice(0, 2)
      .forEach(s => list.push({
        id: `sup-${s.id}`, type: 'supplier',
        text: `Follow up with ${s.supplier} — ${s.project}`,
        meta: `Due ${fmtDateShort(s.nextFollowUp)}`,
        link: '/work', urgency: 'high',
      }))

    // Today's calendar events
    calendar
      .filter(e => e.date === today && e.source !== 'gcal')
      .slice(0, 2)
      .forEach(e => list.push({
        id: `cal-${e.id}`, type: 'today',
        text: e.title,
        meta: 'On your calendar today',
        link: '/calendar', urgency: 'medium',
      }))

    // Unread Gmail threads (most recent first)
    gmailThreads
      .filter(t => t.unread)
      .slice(0, 2)
      .forEach(t => list.push({
        id: `gmail-${t.id}`, type: 'email',
        text: `${t.from ? `From: ${t.from}` : 'Email'} — ${t.subject || '(no subject)'}`,
        meta: 'Unread message',
        link: '/work', urgency: 'medium',
      }))

    return list.slice(0, 6)
  }, [tasks, suppliers, calendar, gmailThreads, today])

  if (actions.length === 0) return null

  const URGENCY_STYLE = {
    high:   { bar: 'bg-red-500',   bg: 'bg-red-50',   border: 'border-red-200',   text: 'text-red-700',   meta: 'text-red-500' },
    medium: { bar: 'bg-amber-400', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', meta: 'text-amber-600' },
  }

  const TYPE_ICON = { overdue: '⚠', supplier: '📦', today: '📅', email: '✉' }

  return (
    <div className="panel">
      <div className="panel-header">
        <span className="section-title">Immediate Actions</span>
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: '#FEE2E2', color: '#B91C1C' }}>
          {actions.length}
        </span>
      </div>
      <div className="p-3 flex flex-col gap-2">
        {actions.map(a => {
          const s = URGENCY_STYLE[a.urgency] || URGENCY_STYLE.medium
          return (
            <Link
              key={a.id}
              to={a.link}
              className={`flex items-start gap-2.5 px-2.5 py-2 rounded-lg border ${s.bg} ${s.border} hover:opacity-80 transition-opacity`}
            >
              <span className="text-[13px] shrink-0 mt-0.5">{TYPE_ICON[a.type]}</span>
              <div className="flex-1 min-w-0">
                <div className={`text-[11.5px] font-medium leading-snug ${s.text} line-clamp-2`}>{a.text}</div>
                <div className={`text-[10px] mt-0.5 ${s.meta}`}>{a.meta}</div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function HomeV3() {
  const { state } = useApp()
  const navigate = useNavigate()

  const focusTasks = useMemo(() => {
    const notionTasks = (state.tasks || [])
      .filter(t => !t.done && t.status !== 'Done' && t.status !== 'Complete')
      .filter(t => t.status === 'In progress' || t.status === 'In Progress')
    const pageTasks = (state.notionPageTasks || [])
      .filter(t => t.priority === 'High' && t.status !== 'Done' && t.status !== 'Complete')
      .slice(0, 5)
    return [...notionTasks, ...pageTasks].slice(0, 8)
  }, [state.tasks, state.notionPageTasks])

  const openDecisions = useMemo(() =>
    (state.decisions || []).filter(d => !d.resolved), [state.decisions])

  const brandRows = useMemo(() => BRANDS.map(b => {
    const prods   = (state.products || []).filter(p => p.clientBrand === b.name)
    const complete = prods.filter(p => COMPLETE_STATUSES.has(p.status)).length
    const inDev    = prods.filter(p => INDEV_STATUSES.has(p.status)).length
    const testing  = prods.filter(p => TESTING_STATUSES.has(p.status)).length
    const total    = prods.length
    const pct      = total > 0 ? Math.round((complete / total) * 100) : 0
    return { ...b, total, complete, inDev, testing, pct }
  }), [state.products])

  const waitingSuppliers = useMemo(() =>
    (state.suppliers || []).filter(s => s.status === 'Waiting').slice(0, 4),
  [state.suppliers])

  const notionTasks = useMemo(() => {
    const notDone   = (state.tasks || []).filter(t => t.status !== 'Done' && t.status !== 'Complete' && t.status !== 'Completed')
    const inProg    = notDone.filter(t => t.status === 'In progress' || t.status === 'In Progress')
    const notStart  = notDone.filter(t => t.status === 'Not started' || t.status === 'Not Started')
    return [...inProg, ...notStart].slice(0, 10)
  }, [state.tasks])

  const contentItems = useMemo(() => {
    const items = [...(state.content || [])]
    const withDate = items.filter(c => c.publishDate || c.dueDate || c.date)
    if (withDate.length >= 3) {
      return withDate
        .sort((a, b) => new Date(a.publishDate || a.dueDate || a.date) - new Date(b.publishDate || b.dueDate || b.date))
        .slice(0, 5)
    }
    return items.slice(0, 5)
  }, [state.content])

  const calendarWithSource = useMemo(() =>
    (state.calendar || []).map(e => ({ ...e, source: 'dashboard' })),
  [state.calendar])

  return (
    <div className="page-scroll flex gap-5 min-h-full" style={{ paddingTop: '1.5rem' }}>

      {/* ── LEFT COLUMN ── */}
      <div style={{ width: 300, flexShrink: 0 }} className="flex flex-col gap-4">

        {/* Live Clock */}
        <LiveClock />

        {/* Today's Focus */}
        <div className="panel">
          <div className="panel-header">
            <span className="section-title">Today's Focus</span>
            <span className="text-[10.5px] text-[#58595b]">{focusTasks.length} active</span>
          </div>
          <div className="p-3 flex flex-col gap-1.5">
            {focusTasks.length === 0 && (
              <div className="text-[11.5px] text-[#58595b] py-2 text-center">No active tasks</div>
            )}
            {focusTasks.map(task => (
              <Link
                key={task.id}
                to="/work"
                className="flex items-start gap-2 py-1 px-1 rounded hover:bg-[#F5F5F5] transition-colors group"
              >
                <span className="mt-[4px] w-[7px] h-[7px] rounded-full flex-shrink-0" style={{ backgroundColor: taskDot(task.title) }} />
                <span className="text-[12px] text-[#1A1A1A] leading-snug group-hover:text-[#0D9E9E] transition-colors line-clamp-2">
                  {task.title}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* Immediate Actions */}
        <ImmediateActions
          tasks={state.tasks || []}
          suppliers={state.suppliers || []}
          calendar={calendarWithSource}
          gmailThreads={state.gmailThreads || []}
        />

        {/* Open Decisions */}
        <div className="panel">
          <div className="panel-header">
            <span className="section-title">Open Decisions</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: '#FAE5E5', color: '#B52B2B' }}>
              {openDecisions.length}
            </span>
          </div>
          <div className="p-3 flex flex-col gap-2.5">
            {openDecisions.length === 0 && (
              <div className="text-[11.5px] text-[#58595b] py-2 text-center">All decisions resolved</div>
            )}
            {openDecisions.slice(0, 3).map(d => (
              <div key={d.id} className="border border-[#E5E5E5] rounded-[6px] p-2.5 bg-white">
                <div className="text-[12px] font-semibold text-[#1A1A1A] leading-snug mb-1">{d.title}</div>
                {d.context && <div className="text-[11px] text-[#58595b] leading-snug line-clamp-2">{d.context}</div>}
              </div>
            ))}
            {openDecisions.length > 3 && (
              <div className="text-[11px] text-[#58595b]">+{openDecisions.length - 3} more decisions</div>
            )}
          </div>
        </div>

      </div>

      {/* ── MIDDLE COLUMN ── */}
      <div className="flex-1 min-w-0 flex flex-col gap-4">

        {/* Brands at a Glance */}
        <div className="panel">
          <div className="panel-header">
            <span className="section-title">Brands at a Glance</span>
            <span className="text-[11px] text-[#58595b]">{BRANDS.length} active brands</span>
          </div>
          <div className="divide-y divide-[#EEEEEE]">
            {brandRows.map(b => (
              <div
                key={b.name}
                onClick={() => navigate(`/brands#${b.name.replace(/\s+/g, '')}`)}
                className="flex items-center gap-4 px-4 py-3 hover:bg-[#F5F5F5] cursor-pointer transition-colors"
                style={{ borderLeft: `3px solid ${b.color}` }}
              >
                <div style={{ width: 160, flexShrink: 0 }}>
                  <div className="text-[13px] font-bold" style={{ color: b.color }}>{b.name}</div>
                  <div className="text-[11px] text-[#58595b]">{b.client}</div>
                </div>
                <div style={{ width: 64, flexShrink: 0 }} className="text-center">
                  <div className="text-[16px] font-bold text-[#1A1A1A]">{b.total}</div>
                  <div className="text-[10px] text-[#58595b]">products</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10.5px] text-[#58595b]">
                      {b.complete > 0 && <span className="text-[#0A7A7A] font-semibold">{b.complete} Ready</span>}
                      {b.complete > 0 && (b.inDev > 0 || b.testing > 0) && <span className="text-[#D8D8D8]"> · </span>}
                      {b.inDev > 0 && <span className="text-[#2255AA]">{b.inDev} In Dev</span>}
                      {b.inDev > 0 && b.testing > 0 && <span className="text-[#D8D8D8]"> · </span>}
                      {b.testing > 0 && <span className="text-[#A86200]">{b.testing} Testing</span>}
                      {b.complete === 0 && b.inDev === 0 && b.testing === 0 && <span className="text-[#58595b]">No data</span>}
                    </span>
                    <span className="text-[10px] text-[#58595b] ml-2 flex-shrink-0">{b.pct}%</span>
                  </div>
                  <div className="h-[6px] rounded-full bg-[#E5E5E5] overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${b.pct}%`, backgroundColor: b.color }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Supplier Tracker */}
        <div className="panel">
          <div className="panel-header">
            <span className="section-title">Supplier Tracker — Waiting</span>
            <Link to="/work" className="text-[11px] text-[#0D9E9E] hover:underline">View all</Link>
          </div>
          {waitingSuppliers.length === 0 ? (
            <div className="p-4 text-[11.5px] text-[#58595b] text-center">No suppliers waiting</div>
          ) : (
            <table className="table-base">
              <thead><tr><th>Supplier</th><th>Project</th><th>Waiting On</th><th>Follow-up</th></tr></thead>
              <tbody>
                {waitingSuppliers.map(s => (
                  <tr key={s.id}>
                    <td className="font-medium text-[#1A1A1A]">{s.supplier}</td>
                    <td className="text-[#444444]">{s.project}</td>
                    <td className="text-[#444444] max-w-[200px] truncate">{s.waitingOn || '—'}</td>
                    <td>
                      {s.nextFollowUp
                        ? <span className={`text-[11.5px] font-medium ${isOverdue(s.nextFollowUp) ? 'text-[#B52B2B]' : 'text-[#444444]'}`}>{fmtDateShort(s.nextFollowUp)}</span>
                        : <span className="text-[#58595b]">—</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* End of Day Recap */}
        <EndOfDayRecap calendarEvents={calendarWithSource} tasks={state.tasks || []} />

      </div>

      {/* ── RIGHT COLUMN ── */}
      <div style={{ width: 280, flexShrink: 0 }} className="flex flex-col gap-4">

        {/* Notion Tasks */}
        <div className="panel">
          <div className="panel-header">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#0D9E9E] inline-block" />
              <span className="section-title">From Notion</span>
            </div>
            <span className="text-[10.5px] text-[#58595b]">{notionTasks.length} open</span>
          </div>
          <div className="p-3 flex flex-col gap-1.5">
            {notionTasks.length === 0 && (
              <div className="text-[11.5px] text-[#58595b] py-2 text-center">All tasks complete</div>
            )}
            {notionTasks.map(task => (
              <div key={task.id} className="flex items-start gap-2 py-1">
                <div className="mt-[2px] w-[14px] h-[14px] rounded-full border flex-shrink-0"
                  style={{ borderColor: task.status === 'In progress' || task.status === 'In Progress' ? '#0D9E9E' : '#BBBBBB', background: 'white' }} />
                <div className="flex-1 min-w-0">
                  <div className="text-[11.5px] text-[#1A1A1A] leading-snug line-clamp-2 mb-0.5">{task.title}</div>
                  <StatusBadge status={task.status} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming from Calendar */}
        <div className="panel">
          <div className="panel-header">
            <span className="section-title">Upcoming</span>
            <Link to="/calendar" className="text-[11px] text-[#0D9E9E] hover:underline">Full calendar</Link>
          </div>
          <div className="p-3 flex flex-col gap-2">
            {(() => {
              const td = new Date(); td.setHours(0,0,0,0)
              const end = new Date(td); end.setDate(end.getDate() + 14)
              const upcoming = calendarWithSource
                .filter(e => { const d = new Date(e.date + 'T00:00:00'); return d >= td && d <= end })
                .sort((a, b) => a.date.localeCompare(b.date))
                .slice(0, 5)
              if (!upcoming.length) return <div className="text-[11.5px] text-[#58595b] text-center py-2">No events in the next 14 days</div>
              return upcoming.map(ev => (
                <Link key={ev.id} to="/calendar" className="flex items-start gap-2 border-b border-[#EEEEEE] pb-2 last:border-0 last:pb-0 hover:opacity-70 transition-opacity">
                  <div className="flex-shrink-0 w-10 text-center rounded py-1 bg-[#F5F5F5]">
                    <div className="text-[9px] text-[#58595b] uppercase">{new Date(ev.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' })}</div>
                    <div className="text-[14px] font-bold text-[#1A1A1A] leading-tight">{new Date(ev.date + 'T00:00:00').getDate()}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11.5px] font-medium text-[#1A1A1A] leading-snug line-clamp-1">{ev.title}</div>
                    <div className="text-[10px] text-[#58595b] mt-0.5">{ev.type}{ev.brand ? ` · ${ev.brand}` : ''}</div>
                  </div>
                </Link>
              ))
            })()}
          </div>
        </div>

        {/* Quick Links */}
        <div className="panel">
          <div className="panel-header"><span className="section-title">Quick Links</span></div>
          <div className="p-3 flex flex-col gap-3">
            {['Business', 'Suppliers'].map(group => (
              <div key={group}>
                <div className="text-[9.5px] font-bold uppercase tracking-wider text-[#58595b] mb-1.5">{group}</div>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_LINKS.filter(l => l.group === group).map(link => (
                    <a key={link.label} href={link.url} target="_blank" rel="noopener noreferrer"
                      className="px-2.5 py-1 rounded-full border border-[#BBBBBB] text-[11px] text-[#444444] hover:border-[#0D9E9E] hover:text-[#0D9E9E] transition-colors whitespace-nowrap">
                      {link.label}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
