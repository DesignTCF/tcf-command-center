import { useState, useEffect, useMemo, useCallback } from 'react'
import { useApp } from '../store/AppContext'
import api from '../lib/api'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

const TYPE_META = {
  Deadline:           { bg: 'bg-red-50',     text: 'text-red-700',    border: 'border-red-200',    dot: 'bg-red-500',    label: 'Deadline' },
  Meeting:            { bg: 'bg-blue-50',    text: 'text-blue-700',   border: 'border-blue-200',   dot: 'bg-blue-500',   label: 'Meeting' },
  Task:               { bg: 'bg-teal/10',    text: 'text-teal',       border: 'border-teal/30',    dot: 'bg-teal',       label: 'Task' },
  'Supplier Follow-Up':{ bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200',  dot: 'bg-amber-500',  label: 'Supplier' },
  Project:            { bg: 'bg-purple-50',  text: 'text-purple-700', border: 'border-purple-200', dot: 'bg-purple-500', label: 'Project' },
  Launch:             { bg: 'bg-green-50',   text: 'text-green-700',  border: 'border-green-200',  dot: 'bg-green-500',  label: 'Launch' },
  Personal:           { bg: 'bg-surface2',   text: 'text-ink-muted',  border: 'border-border',     dot: 'bg-surface3',   label: 'Personal' },
  'Google Calendar':  { bg: 'bg-purple-50',  text: 'text-purple-700', border: 'border-purple-200', dot: 'bg-purple-400', label: 'GCal' },
}
const DEFAULT_TYPE = { bg: 'bg-surface2', text: 'text-ink-muted', border: 'border-border', dot: 'bg-surface3', label: '—' }

const EVENT_TYPES = ['Deadline', 'Meeting', 'Task', 'Supplier Follow-Up', 'Project', 'Launch', 'Personal']

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function makeDateStr(y, m, d) {
  return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
}
function fmtShort(dateStr) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  return `${MONTHS[parseInt(m)-1].slice(0,3)} ${parseInt(d)}`
}
function fmtFull(dateStr) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  return `${MONTHS[parseInt(m)-1]} ${parseInt(d)}, ${y}`
}

// Build Google Calendar "add event" URL
function gcalAddUrl(ev) {
  const date = (ev.date || '').replace(/-/g, '')
  // next day for end (all-day events)
  const dt = new Date(ev.date + 'T00:00:00')
  dt.setDate(dt.getDate() + 1)
  const end = `${dt.getFullYear()}${String(dt.getMonth()+1).padStart(2,'0')}${String(dt.getDate()).padStart(2,'0')}`
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: ev.title,
    dates: `${date}/${end}`,
    details: ev.notes || '',
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

// ── Event detail panel ────────────────────────────────────────────────────────
function EventDetail({ ev, onClose, onEdit, onDelete }) {
  const meta = TYPE_META[ev.type] || DEFAULT_TYPE
  const isGcal = ev.source === 'gcal'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-[480px] max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={`px-6 pt-6 pb-4 rounded-t-2xl ${meta.bg} border-b ${meta.border}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${meta.text}`}>{meta.label}</div>
              <div className="text-base font-semibold text-ink leading-snug">{ev.title}</div>
              {ev.brand && <div className="text-xs text-ink-muted mt-1">{ev.brand}</div>}
            </div>
            <button onClick={onClose} className="text-ink-muted hover:text-ink text-xl leading-none mt-0.5">×</button>
          </div>
          <div className={`text-sm font-medium mt-3 ${meta.text}`}>{fmtFull(ev.date)}</div>
        </div>

        <div className="px-6 py-4">
          {ev.notes && (
            <p className="text-sm text-ink leading-relaxed mb-5">{ev.notes}</p>
          )}
          {ev.description && !ev.notes && (
            <p className="text-sm text-ink-muted leading-relaxed mb-5">{ev.description}</p>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            {/* Add to Google Calendar */}
            {!isGcal && (
              <a
                href={gcalAddUrl(ev)}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#4285F4] text-white text-xs font-semibold hover:bg-[#3367D6] transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3h-1V1h-2v2H8V1H6v2H5C3.89 3 3 3.89 3 5v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.11-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/></svg>
                Add to Google Calendar
              </a>
            )}
            {!isGcal && (
              <>
                <button onClick={onEdit}
                  className="px-3 py-2 rounded-lg border border-border text-xs font-medium text-ink hover:bg-surface2 transition-colors">
                  Edit
                </button>
                <button onClick={onDelete}
                  className="px-3 py-2 rounded-lg border border-red/30 text-xs font-medium text-red hover:bg-red/5 transition-colors ml-auto">
                  Delete
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Edit / Add modal ──────────────────────────────────────────────────────────
function EventModal({ ev, preDate, onSave, onClose }) {
  const [form, setForm] = useState({
    title: ev?.title || '',
    date: ev?.date || preDate || todayStr(),
    type: ev?.type || 'Meeting',
    notes: ev?.notes || '',
    brand: ev?.brand || '',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-[440px]" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-border">
          <div className="text-sm font-semibold text-ink">{ev ? 'Edit Event' : 'New Event'}</div>
        </div>
        <div className="px-6 py-4 flex flex-col gap-3">
          <div>
            <label className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider block mb-1">Title</label>
            <input className="input-field w-full" value={form.title} onChange={e => set('title', e.target.value)} placeholder="Event title…" />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider block mb-1">Date</label>
              <input type="date" className="input-field w-full" value={form.date} onChange={e => set('date', e.target.value)} />
            </div>
            <div className="flex-1">
              <label className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider block mb-1">Type</label>
              <select className="input-field w-full" value={form.type} onChange={e => set('type', e.target.value)}>
                {EVENT_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider block mb-1">Brand / Client</label>
            <input className="input-field w-full" value={form.brand} onChange={e => set('brand', e.target.value)} placeholder="e.g. NeVoo, Daily Rou, TCF…" />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider block mb-1">Notes</label>
            <textarea className="input-field w-full resize-none" rows={3} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Details, action items…" />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost text-sm">Cancel</button>
          <button onClick={() => onSave(form)} disabled={!form.title || !form.date}
            className="btn-primary text-sm disabled:opacity-40">Save</button>
        </div>
      </div>
    </div>
  )
}

// ── Main calendar ─────────────────────────────────────────────────────────────
export default function CalendarPage() {
  const { state, dispatch } = useApp()
  const now = new Date()
  const [viewYear, setViewYear]   = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth())
  const [selected, setSelected]   = useState(null)   // { ev } | { preDate }
  const [editing, setEditing]     = useState(null)    // ev to edit, or true for new
  const [gcalEvents, setGcalEvents] = useState([])
  const [showGcal, setShowGcal]   = useState(true)
  const [filter, setFilter]       = useState('All')

  const today = todayStr()

  // Load Google Calendar events
  useEffect(() => {
    api.get('/gcal/events').then(data => {
      const evs = (data || []).map(e => ({
        ...e,
        date: (e.start || '').slice(0, 10),
        source: 'gcal',
        type: 'Google Calendar',
        id: e.uid || e.id || Math.random().toString(36),
      }))
      setGcalEvents(evs)
    }).catch(() => {})
  }, [])

  const dashboardEvents = state.calendar || []

  // All events merged
  const allEvents = useMemo(() => {
    const base = dashboardEvents.map(e => ({ ...e, source: 'dashboard' }))
    return showGcal ? [...base, ...gcalEvents] : base
  }, [dashboardEvents, gcalEvents, showGcal])

  // Build calendar grid
  const grid = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay()
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const daysInPrev = new Date(viewYear, viewMonth, 0).getDate()
    const cells = []
    for (let i = firstDay - 1; i >= 0; i--) {
      const m = viewMonth === 0 ? 11 : viewMonth - 1
      const y = viewMonth === 0 ? viewYear - 1 : viewYear
      cells.push({ day: daysInPrev - i, month: m, year: y, other: true })
    }
    for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, month: viewMonth, year: viewYear, other: false })
    const rem = 42 - cells.length
    for (let d = 1; d <= rem; d++) {
      const m = viewMonth === 11 ? 0 : viewMonth + 1
      const y = viewMonth === 11 ? viewYear + 1 : viewYear
      cells.push({ day: d, month: m, year: y, other: true })
    }
    return cells
  }, [viewYear, viewMonth])

  function eventsForDate(ds) {
    return allEvents.filter(e => e.date === ds)
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  async function saveEvent(form) {
    try {
      if (editing?.id) {
        const updated = await api.patch(`/data/calendar/${editing.id}`, form)
        dispatch({ type: 'UPDATE', key: 'calendar', id: editing.id, value: updated })
      } else {
        const created = await api.post('/data/calendar', form)
        dispatch({ type: 'ADD', key: 'calendar', value: created })
      }
    } catch {
      const item = { id: Date.now().toString(36), ...form, createdAt: new Date().toISOString() }
      if (editing?.id) dispatch({ type: 'UPDATE', key: 'calendar', id: editing.id, value: form })
      else dispatch({ type: 'ADD', key: 'calendar', value: item })
    }
    setEditing(null); setSelected(null)
  }

  async function deleteEvent(id) {
    if (!confirm('Delete this event?')) return
    try { await api.del(`/data/calendar/${id}`) } catch {}
    dispatch({ type: 'DELETE', key: 'calendar', id })
    setSelected(null)
  }

  // Upcoming — next 30 days
  const upcoming = useMemo(() => {
    const td = new Date(); td.setHours(0,0,0,0)
    const end = new Date(td); end.setDate(end.getDate() + 30)
    return allEvents
      .filter(e => { const d = new Date(e.date + 'T00:00:00'); return d >= td && d <= end })
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [allEvents])

  // Google Calendar events this month for the feed section
  const gcalThisMonth = useMemo(() => {
    const prefix = `${viewYear}-${String(viewMonth+1).padStart(2,'0')}`
    return gcalEvents.filter(e => e.date?.startsWith(prefix)).sort((a,b) => a.date.localeCompare(b.date))
  }, [gcalEvents, viewYear, viewMonth])

  const dashCount = dashboardEvents.filter(e =>
    e.date?.startsWith(`${viewYear}-${String(viewMonth+1).padStart(2,'0')}`)
  ).length

  return (
    <div className="h-full flex overflow-hidden">

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <button className="btn-icon text-xl" onClick={prevMonth}>‹</button>
            <h2 className="text-base font-semibold min-w-[200px] text-center">
              {MONTHS[viewMonth]} {viewYear}
            </h2>
            <button className="btn-icon text-xl" onClick={nextMonth}>›</button>
            <button className="btn-ghost text-xs ml-1"
              onClick={() => { setViewMonth(now.getMonth()); setViewYear(now.getFullYear()) }}>
              Today
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* GCal toggle */}
            <button
              onClick={() => setShowGcal(v => !v)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-all ${
                showGcal
                  ? 'bg-purple-50 border-purple-200 text-purple-700'
                  : 'bg-surface border-border text-ink-muted'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${showGcal ? 'bg-purple-400' : 'bg-surface3'}`} />
              Google Calendar
            </button>
            <button className="btn-primary text-sm"
              onClick={() => { setEditing(true); setSelected(null) }}>
              + Add Event
            </button>
          </div>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-border bg-surface shrink-0">
          {DAYS.map(d => (
            <div key={d} className="py-2.5 text-center text-[10px] font-bold tracking-widest uppercase text-ink-muted">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="flex-1 overflow-y-auto grid grid-cols-7" style={{ gridAutoRows: 'minmax(96px, 1fr)' }}>
          {grid.map((cell, i) => {
            const ds = makeDateStr(cell.year, cell.month, cell.day)
            const cellEvs = eventsForDate(ds)
            const isToday = ds === today
            return (
              <div
                key={i}
                onClick={() => !cell.other && setEditing({ preDate: ds })}
                className={`border-r border-b border-border p-1.5 flex flex-col transition-colors ${
                  cell.other ? 'opacity-30 pointer-events-none' : 'cursor-pointer hover:bg-surface2'
                } ${isToday ? 'bg-teal/5' : ''}`}
              >
                <div className={`text-xs font-medium mb-1.5 w-6 h-6 flex items-center justify-center rounded-full shrink-0 ${
                  isToday ? 'bg-teal text-white font-bold' : 'text-ink-dim'
                }`}>
                  {cell.day}
                </div>
                <div className="flex flex-col gap-0.5 overflow-hidden">
                  {cellEvs.slice(0, 3).map(ev => {
                    const meta = TYPE_META[ev.type] || DEFAULT_TYPE
                    return (
                      <div
                        key={ev.id}
                        onClick={e => { e.stopPropagation(); setSelected(ev); setEditing(null) }}
                        className={`text-[10px] px-1.5 py-0.5 rounded border truncate cursor-pointer ${meta.bg} ${meta.text} ${meta.border} hover:opacity-80`}
                      >
                        {ev.title}
                      </div>
                    )
                  })}
                  {cellEvs.length > 3 && (
                    <div className="text-[9px] text-ink-muted px-1">+{cellEvs.length - 3} more</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* ── Google Calendar feed section ── */}
        <div className="shrink-0 border-t border-border bg-surface">
          <div className="flex items-center justify-between px-6 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-400" />
              <span className="text-sm font-semibold text-ink">Google Calendar — The Cosmetic Formulary Operations</span>
            </div>
            <span className="text-[11px] text-ink-muted">{gcalThisMonth.length} events this month</span>
          </div>
          {gcalThisMonth.length === 0 ? (
            <div className="px-6 py-4 text-sm text-ink-muted">No Google Calendar events for {MONTHS[viewMonth]}.</div>
          ) : (
            <div className="flex overflow-x-auto gap-3 px-6 py-3">
              {gcalThisMonth.map(ev => (
                <div
                  key={ev.id}
                  onClick={() => { setSelected(ev); setEditing(null) }}
                  className="flex-shrink-0 w-[200px] bg-purple-50 border border-purple-200 rounded-xl p-3 cursor-pointer hover:bg-purple-100 transition-colors"
                >
                  <div className="text-[10px] font-bold text-purple-500 uppercase tracking-wider mb-1">{fmtShort(ev.date)}</div>
                  <div className="text-xs font-semibold text-purple-800 leading-snug line-clamp-2">{ev.title}</div>
                  {ev.description && (
                    <div className="text-[10px] text-purple-600 mt-1 line-clamp-2">{ev.description}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Sidebar ── */}
      <div className="w-[240px] border-l border-border flex flex-col bg-surface shrink-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <span className="text-sm font-semibold text-ink">Upcoming</span>
          <span className="text-[10px] text-ink-muted">30 days</span>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-border">
          {upcoming.length === 0 && (
            <div className="px-4 py-6 text-sm text-ink-muted text-center">No upcoming events</div>
          )}
          {upcoming.map(ev => {
            const meta = TYPE_META[ev.type] || DEFAULT_TYPE
            return (
              <div
                key={ev.id}
                onClick={() => { setSelected(ev); setEditing(null) }}
                className="px-4 py-3 cursor-pointer hover:bg-surface2 transition-colors"
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${meta.dot}`} />
                  <span className="text-[10px] text-ink-muted">{fmtShort(ev.date)}</span>
                </div>
                <div className="text-xs font-medium text-ink leading-snug">{ev.title}</div>
                {ev.brand && <div className="text-[10px] text-ink-muted mt-0.5">{ev.brand}</div>}
                {/* Add to GCal inline */}
                {ev.source !== 'gcal' && (
                  <a
                    href={gcalAddUrl(ev)}
                    target="_blank"
                    rel="noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-[#4285F4] hover:underline"
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3h-1V1h-2v2H8V1H6v2H5C3.89 3 3 3.89 3 5v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.11-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/></svg>
                    Add to Google Calendar
                  </a>
                )}
              </div>
            )
          })}
        </div>

        <div className="px-4 py-3 border-t border-border text-[10px] text-ink-muted space-y-0.5">
          <div>{dashCount} dashboard event{dashCount !== 1 ? 's' : ''} this month</div>
          <div>{gcalThisMonth.length} Google Calendar event{gcalThisMonth.length !== 1 ? 's' : ''}</div>
        </div>
      </div>

      {/* ── Event detail panel ── */}
      {selected && !editing && (
        <EventDetail
          ev={selected}
          onClose={() => setSelected(null)}
          onEdit={() => { setEditing(selected); setSelected(null) }}
          onDelete={() => deleteEvent(selected.id)}
        />
      )}

      {/* ── Add / Edit modal ── */}
      {editing && editing !== true && editing.preDate === undefined && (
        <EventModal
          ev={editing?.id ? editing : null}
          preDate={null}
          onSave={saveEvent}
          onClose={() => setEditing(null)}
        />
      )}
      {(editing === true || editing?.preDate !== undefined) && (
        <EventModal
          ev={null}
          preDate={editing?.preDate || today}
          onSave={saveEvent}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
