import { useState, useMemo } from 'react'
import { useApp } from '../store/AppContext'
import { fmtDate } from '../lib/utils'
import Modal from '../components/Modal'
import EmptyState from '../components/EmptyState'
import api from '../lib/api'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const EVENT_TYPES = ['Meeting', 'Deadline', 'Task', 'Supplier Follow-Up', 'Project', 'Launch', 'Personal']

const TYPE_COLORS = {
  Meeting: 'bg-blue/20 text-blue border-blue/30',
  Deadline: 'bg-red/20 text-red border-red/30',
  Task: 'bg-teal/20 text-teal border-teal/30',
  'Supplier Follow-Up': 'bg-gold/20 text-gold border-gold/30',
  Project: 'bg-purple/20 text-purple border-purple/30',
  Launch: 'bg-green/20 text-green border-green/30',
  Personal: 'bg-surface3 text-ink-dim border-border2',
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function makeDateStr(year, month, day) {
  return `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
}

export default function CalendarPage() {
  const { state, dispatch } = useApp()
  const now = new Date()
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth())
  const [modal, setModal] = useState(null)

  const today = todayStr()
  const events = state.calendar || []

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
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, month: viewMonth, year: viewYear, other: false })
    }
    const remaining = 42 - cells.length
    for (let d = 1; d <= remaining; d++) {
      const m = viewMonth === 11 ? 0 : viewMonth + 1
      const y = viewMonth === 11 ? viewYear + 1 : viewYear
      cells.push({ day: d, month: m, year: y, other: true })
    }
    return cells
  }, [viewYear, viewMonth])

  function eventsForDate(ds) {
    return events.filter(e => e.date === ds)
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  const fields = (ev = {}, preDate = '') => [
    { id: 'title', label: 'Title', type: 'text', value: ev.title || '' },
    { id: 'date', label: 'Date', type: 'date', value: ev.date || preDate || '' },
    { id: 'time', label: 'Time', type: 'time', value: ev.time || '' },
    { id: 'type', label: 'Type', type: 'select', options: EVENT_TYPES, value: ev.type || 'Meeting' },
    { id: 'notes', label: 'Notes', type: 'textarea', value: ev.notes || '' },
  ]

  async function save(data) {
    try {
      if (modal?.event) {
        const u = await api.patch(`/data/calendar/${modal.event.id}`, data)
        dispatch({ type: 'UPDATE', key: 'calendar', id: modal.event.id, value: u })
      } else {
        const c = await api.post('/data/calendar', data)
        dispatch({ type: 'ADD', key: 'calendar', value: c })
      }
    } catch (e) {
      const item = { id: Date.now().toString(), ...data, createdAt: new Date().toISOString() }
      if (modal?.event) dispatch({ type: 'UPDATE', key: 'calendar', id: modal.event.id, value: data })
      else dispatch({ type: 'ADD', key: 'calendar', value: item })
    }
    setModal(null)
  }

  async function remove(id) {
    if (!confirm('Delete this event?')) return
    await api.del(`/data/calendar/${id}`)
    dispatch({ type: 'DELETE', key: 'calendar', id })
    setModal(null)
  }

  const upcoming = useMemo(() => {
    const td = new Date(); td.setHours(0,0,0,0)
    const end = new Date(td); end.setDate(end.getDate() + 14)
    return events
      .filter(e => { const d = new Date(e.date); return d >= td && d <= end })
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [events])

  const thisMonthCount = events.filter(e =>
    e.date?.startsWith(`${viewYear}-${String(viewMonth+1).padStart(2,'0')}`)
  ).length

  return (
    <div className="h-full flex overflow-hidden">
      {/* Main calendar */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <button className="btn-icon text-xl leading-none" onClick={prevMonth}>‹</button>
            <h2 className="text-base font-semibold min-w-[180px] text-center">
              {MONTHS[viewMonth]} {viewYear}
            </h2>
            <button className="btn-icon text-xl leading-none" onClick={nextMonth}>›</button>
            <button className="btn-ghost text-xs ml-1"
              onClick={() => { setViewMonth(now.getMonth()); setViewYear(now.getFullYear()) }}>
              Today
            </button>
          </div>
          <button className="btn-primary" onClick={() => setModal({ preDate: today })}>+ Add Event</button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-border bg-surface shrink-0">
          {DAYS.map(d => (
            <div key={d} className="py-2.5 text-center text-[10px] font-bold tracking-[0.1em] uppercase text-ink-muted">
              {d}
            </div>
          ))}
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto grid grid-cols-7" style={{ gridAutoRows: 'minmax(90px, 1fr)' }}>
          {grid.map((cell, i) => {
            const ds = makeDateStr(cell.year, cell.month, cell.day)
            const cellEvents = eventsForDate(ds)
            const isToday = ds === today
            return (
              <div
                key={i}
                className={`border-r border-b border-border p-1.5 cursor-pointer hover:bg-surface2 transition-colors flex flex-col ${cell.other ? 'opacity-25' : ''}`}
                onClick={() => !cell.other && setModal({ preDate: ds })}
              >
                <div className={`text-xs font-medium mb-1.5 w-6 h-6 flex items-center justify-center rounded-full flex-shrink-0 ${isToday ? 'bg-teal text-black font-bold' : 'text-ink-dim'}`}>
                  {cell.day}
                </div>
                <div className="flex flex-col gap-0.5 overflow-hidden">
                  {cellEvents.slice(0, 3).map(ev => (
                    <div
                      key={ev.id}
                      className={`text-[10px] px-1.5 py-0.5 rounded border truncate ${TYPE_COLORS[ev.type] || 'bg-surface3 text-ink-dim border-border2'}`}
                      onClick={e => { e.stopPropagation(); setModal({ event: ev }) }}
                    >
                      {ev.time ? `${ev.time.slice(0,5)} ` : ''}{ev.title}
                    </div>
                  ))}
                  {cellEvents.length > 3 && (
                    <div className="text-[9px] text-ink-muted px-1">+{cellEvents.length - 3} more</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Sidebar */}
      <div className="w-[220px] border-l border-border flex flex-col bg-surface shrink-0">
        <div className="panel-header">
          <span className="section-title">Upcoming</span>
          <span className="text-[10px] text-ink-muted">14 days</span>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-border">
          {!upcoming.length ? (
            <EmptyState message="No upcoming events" />
          ) : upcoming.map(ev => (
            <div
              key={ev.id}
              className="px-3 py-2.5 cursor-pointer hover:bg-surface2 transition-colors"
              onClick={() => setModal({ event: ev })}
            >
              <div className="text-[10px] text-ink-muted mb-0.5">
                {fmtDate(ev.date)}{ev.time ? ` · ${ev.time.slice(0,5)}` : ''}
              </div>
              <div className="text-xs font-medium text-ink leading-snug">{ev.title}</div>
              <span className={`mt-1 text-[9px] px-1.5 py-0.5 rounded border inline-block ${TYPE_COLORS[ev.type] || 'bg-surface3 text-ink-dim border-border2'}`}>
                {ev.type}
              </span>
            </div>
          ))}
        </div>
        <div className="p-3 border-t border-border text-[10px] text-ink-muted">
          {thisMonthCount} event{thisMonthCount !== 1 ? 's' : ''} this month
        </div>
      </div>

      <Modal
        open={!!modal}
        title={modal?.event ? 'Edit Event' : 'Add Event'}
        fields={fields(modal?.event, modal?.preDate)}
        onSave={save}
        onClose={() => setModal(null)}
        onDelete={modal?.event ? () => remove(modal.event.id) : null}
      />
    </div>
  )
}
