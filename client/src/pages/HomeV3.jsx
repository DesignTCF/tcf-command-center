import React, { useMemo, useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApp } from '../store/AppContext'
import { fmtDateShort, isOverdue } from '../lib/utils'
import staticData from '../data/staticData'

const BRANDS = [
  { name: 'NeVoo',         client: 'Molly Smith',       color: '#0D9E9E' },
  { name: 'Daily Rou',     client: 'Meredith Baurband', color: '#A07A10' },
  { name: 'Nitt Beauty',   client: 'Gamze Gurlevik',    color: '#5533AA' },
  { name: 'Devoted Man',   client: 'Josh Smith',        color: '#2255AA' },
  { name: 'Salt Spa Yoga', client: 'Andrew Moss',       color: '#157A50' },
]

const COMPLETE_STATUSES = new Set(['Ready', 'Approved', 'Live', 'Ready To Launch'])
const INDEV_STATUSES    = new Set(['In Development', 'Formulating'])

const QUICK_LINKS = [
  { label: 'QuickBooks',      url: 'https://accounts.intuit.com/' },
  { label: 'HubSpot',         url: 'https://app.hubspot.com/' },
  { label: 'Shopify',         url: 'https://accounts.shopify.com/' },
  { label: 'Alibaba',         url: 'https://login.alibaba.com/' },
  { label: 'Bulk Apothecary', url: 'https://bulkapothecary.com/' },
  { label: 'Drive',           url: 'https://drive.google.com/' },
  { label: 'Gmail',           url: 'https://mail.google.com/' },
]

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function fmtRelative(isoStr) {
  if (!isoStr) return null
  const diff = Date.now() - new Date(isoStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 2)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// ── Live Header ───────────────────────────────────────────────────────────────
function Header({ onSync, syncing, syncedAt }) {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const h = now.getHours()
  const greeting = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  const date = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  const lastBaked = staticData.generatedAt
  const lastSyncLabel = syncedAt
    ? `Synced ${fmtRelative(syncedAt)}`
    : lastBaked
    ? `Data from ${fmtRelative(lastBaked)}`
    : 'Static data'

  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-[#EEEEEE] bg-white mb-1">
      <div>
        <div className="text-[15px] font-semibold text-[#1A1A1A]">{greeting}, Katherine</div>
        <div className="text-[11px] text-[#58595b] mt-0.5">{date} · {time}</div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-[10.5px] text-[#58595b]">{lastSyncLabel}</span>
        <button
          onClick={onSync}
          disabled={syncing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all"
          style={{
            background: syncing ? '#E5E5E5' : '#0D9E9E',
            color: syncing ? '#999' : 'white',
            cursor: syncing ? 'not-allowed' : 'pointer',
          }}
        >
          <span style={{ display: 'inline-block', animation: syncing ? 'spin 1s linear infinite' : 'none' }}>↻</span>
          {syncing ? 'Syncing…' : 'Sync'}
        </button>
      </div>
    </div>
  )
}

// ── Needs Attention ───────────────────────────────────────────────────────────
function NeedsAttention({ tasks, suppliers, serverUp }) {
  const now = new Date()

  const items = useMemo(() => {
    const list = []

    // Overdue supplier follow-ups
    suppliers
      .filter(s => s.status === 'Waiting' && s.nextFollowUp && new Date(s.nextFollowUp) <= now)
      .forEach(s => list.push({
        id: `sup-${s.id}`,
        priority: 0,
        label: 'FOLLOW-UP',
        labelColor: '#B52B2B',
        labelBg: '#FEE2E2',
        text: `${s.supplier} — ${s.project}`,
        meta: `Overdue since ${fmtDateShort(s.nextFollowUp)}`,
      }))

    // Tasks with overdue due dates
    tasks
      .filter(t => !t.done && t.status !== 'Done' && t.status !== 'Complete' && t.dueDate && new Date(t.dueDate) < now)
      .forEach(t => list.push({
        id: `task-ov-${t.id}`,
        priority: 1,
        label: 'OVERDUE',
        labelColor: '#B52B2B',
        labelBg: '#FEE2E2',
        text: t.title,
        meta: `Due ${fmtDateShort(t.dueDate)}${t.sourceName ? ` · ${t.sourceName}` : ''}`,
        url: t.url,
      }))

    // In-progress tasks
    tasks
      .filter(t => !t.done && (t.status === 'In progress' || t.status === 'In Progress'))
      .slice(0, 8)
      .forEach(t => list.push({
        id: `task-ip-${t.id}`,
        priority: 2,
        label: 'IN PROGRESS',
        labelColor: '#0A7A7A',
        labelBg: '#E6F7F7',
        text: t.title,
        meta: t.sourceName || t.category || '',
        url: t.url,
      }))

    // High-priority not-started
    tasks
      .filter(t => !t.done && t.status !== 'Done' && t.status !== 'Complete'
        && t.status !== 'In progress' && t.status !== 'In Progress'
        && (t.priority === 'High' || t.priority === 'Urgent'))
      .slice(0, 5)
      .forEach(t => list.push({
        id: `task-hi-${t.id}`,
        priority: 3,
        label: 'HIGH',
        labelColor: '#7C4A00',
        labelBg: '#FEF3C7',
        text: t.title,
        meta: t.sourceName || t.category || '',
        url: t.url,
      }))

    const seen = new Set()
    return list
      .filter(i => { if (seen.has(i.id)) return false; seen.add(i.id); return true })
      .sort((a, b) => a.priority - b.priority)
      .slice(0, 12)
  }, [tasks, suppliers])

  const urgentCount = items.filter(i => i.priority <= 1).length

  if (items.length === 0) {
    return (
      <div className="panel">
        <div className="panel-header">
          <span className="section-title">Needs Attention</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded font-bold" style={{ background: '#E6F7F7', color: '#0A7A7A' }}>All clear</span>
        </div>
        <div className="p-6 text-center text-[12px] text-[#58595b]">
          {serverUp ? 'Nothing urgent right now.' : 'Sync to load live tasks from Drive.'}
        </div>
      </div>
    )
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <span className="section-title">Needs Attention</span>
        <div className="flex items-center gap-2">
          {urgentCount > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded font-bold" style={{ background: '#FEE2E2', color: '#B52B2B' }}>
              {urgentCount} urgent
            </span>
          )}
          <Link to="/work" className="text-[10.5px] text-[#0D9E9E] hover:underline">All tasks →</Link>
        </div>
      </div>
      <div className="divide-y divide-[#F0F0F0]">
        {items.map(item => (
          <div key={item.id} className="flex items-start gap-3 px-4 py-3 hover:bg-[#FAFAFA] transition-colors group">
            <span
              className="mt-[2px] text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 leading-tight whitespace-nowrap"
              style={{ background: item.labelBg, color: item.labelColor }}
            >
              {item.label}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-[12.5px] text-[#1A1A1A] leading-snug">{item.text}</div>
              {item.meta && <div className="text-[10.5px] text-[#58595b] mt-0.5">{item.meta}</div>}
            </div>
            {item.url && (
              <a href={item.url} target="_blank" rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="shrink-0 text-[#BBBBBB] hover:text-[#0D9E9E] opacity-0 group-hover:opacity-100 transition-opacity text-[12px] mt-0.5"
                title="Open in Drive">↗</a>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Today ─────────────────────────────────────────────────────────────────────
function Today({ calendar }) {
  const today = todayStr()
  const events = useMemo(() =>
    calendar.filter(e => e.date === today).sort((a, b) => (a.time || '').localeCompare(b.time || '')),
  [calendar, today])

  return (
    <div className="panel">
      <div className="panel-header">
        <span className="section-title">Today</span>
        <span className="text-[10.5px] text-[#58595b]">
          {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </span>
      </div>
      {events.length === 0 ? (
        <div className="px-4 py-3 text-[11.5px] text-[#58595b]">Nothing scheduled today</div>
      ) : (
        <div className="divide-y divide-[#F0F0F0]">
          {events.map(ev => (
            <div key={ev.id} className="flex items-start gap-3 px-4 py-2.5">
              {ev.time && (
                <span className="text-[10.5px] text-[#0D9E9E] font-medium shrink-0 w-14 mt-0.5">
                  {ev.time}
                </span>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-[12px] text-[#1A1A1A] leading-snug">{ev.title}</div>
                {ev.type && <div className="text-[10px] text-[#58595b] mt-0.5">{ev.type}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Brands ────────────────────────────────────────────────────────────────────
function BrandsPanel({ products }) {
  const navigate = useNavigate()
  const rows = useMemo(() => BRANDS.map(b => {
    const prods    = products.filter(p => p.clientBrand === b.name)
    const complete = prods.filter(p => COMPLETE_STATUSES.has(p.status)).length
    const inDev    = prods.filter(p => INDEV_STATUSES.has(p.status)).length
    const total    = prods.length
    const pct      = total > 0 ? Math.round((complete / total) * 100) : 0
    return { ...b, total, complete, inDev, pct }
  }), [products])

  return (
    <div className="panel">
      <div className="panel-header">
        <span className="section-title">Brands</span>
        <Link to="/brands" className="text-[10.5px] text-[#0D9E9E] hover:underline">Details →</Link>
      </div>
      <div className="divide-y divide-[#F0F0F0]">
        {rows.map(b => (
          <div
            key={b.name}
            onClick={() => navigate(`/brands#${b.name.replace(/\s+/g, '')}`)}
            className="flex items-center gap-3 px-4 py-3 hover:bg-[#FAFAFA] cursor-pointer transition-colors"
          >
            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: b.color }} />
            <div style={{ width: 90, flexShrink: 0 }}>
              <div className="text-[11.5px] font-semibold text-[#1A1A1A]">{b.name}</div>
              <div className="text-[9.5px] text-[#58595b]">{b.client.split(' ')[0]}</div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9.5px] text-[#58595b]">
                  {b.complete > 0 && <span style={{ color: b.color }}>{b.complete} ready</span>}
                  {b.complete > 0 && b.inDev > 0 && <span className="text-[#D8D8D8]"> · </span>}
                  {b.inDev > 0 && <span className="text-[#58595b]">{b.inDev} in dev</span>}
                  {b.complete === 0 && b.inDev === 0 && <span className="text-[#BBBBBB]">no data</span>}
                </span>
                <span className="text-[9.5px] text-[#AAAAAA] ml-1">{b.pct}%</span>
              </div>
              <div className="h-[4px] rounded-full bg-[#EEEEEE] overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${b.pct}%`, background: b.color }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Suppliers Waiting ─────────────────────────────────────────────────────────
function SuppliersWaiting({ suppliers }) {
  const waiting = useMemo(() =>
    suppliers.filter(s => s.status === 'Waiting').slice(0, 4),
  [suppliers])

  if (waiting.length === 0) return null

  return (
    <div className="panel">
      <div className="panel-header">
        <span className="section-title">Suppliers — Waiting</span>
        <Link to="/work" className="text-[10.5px] text-[#0D9E9E] hover:underline">All →</Link>
      </div>
      <div className="divide-y divide-[#F0F0F0]">
        {waiting.map(s => (
          <div key={s.id} className="px-4 py-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="text-[11.5px] font-medium text-[#1A1A1A]">{s.supplier}</div>
                <div className="text-[10px] text-[#58595b] mt-0.5 line-clamp-1">{s.project}</div>
              </div>
              {s.nextFollowUp && (
                <span className={`text-[10.5px] font-medium shrink-0 ${isOverdue(s.nextFollowUp) ? 'text-[#B52B2B]' : 'text-[#58595b]'}`}>
                  {fmtDateShort(s.nextFollowUp)}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Quick Links ───────────────────────────────────────────────────────────────
function QuickLinks() {
  return (
    <div className="panel">
      <div className="panel-header"><span className="section-title">Quick Links</span></div>
      <div className="p-3 flex flex-wrap gap-1.5">
        {QUICK_LINKS.map(l => (
          <a key={l.label} href={l.url} target="_blank" rel="noopener noreferrer"
            className="px-2.5 py-1 rounded-full border border-[#DDDDDD] text-[11px] text-[#444444] hover:border-[#0D9E9E] hover:text-[#0D9E9E] transition-colors whitespace-nowrap">
            {l.label}
          </a>
        ))}
      </div>
    </div>
  )
}

// ── Upcoming (next 7 days) ────────────────────────────────────────────────────
function Upcoming({ calendar }) {
  const upcoming = useMemo(() => {
    const td  = new Date(); td.setHours(0,0,0,0)
    const end = new Date(td); end.setDate(end.getDate() + 7)
    return calendar
      .filter(e => {
        const d = new Date(e.date + 'T00:00:00')
        return d > td && d <= end
      })
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 5)
  }, [calendar])

  if (upcoming.length === 0) return null

  return (
    <div className="panel">
      <div className="panel-header">
        <span className="section-title">Upcoming</span>
        <Link to="/calendar" className="text-[10.5px] text-[#0D9E9E] hover:underline">Calendar →</Link>
      </div>
      <div className="divide-y divide-[#F0F0F0]">
        {upcoming.map(ev => {
          const d = new Date(ev.date + 'T00:00:00')
          const label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
          return (
            <div key={ev.id} className="flex items-start gap-3 px-4 py-2.5">
              <div className="text-[10px] text-[#58595b] shrink-0 w-20 mt-0.5">{label}</div>
              <div className="text-[11.5px] text-[#1A1A1A] leading-snug">{ev.title}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function HomeV3() {
  const { state, dispatch } = useApp()

  const allTasks = useMemo(() => {
    const live = state.tasks || []
    if (live.length > 0) return live
    return (staticData.notionPageTasks || []).map(t => ({ ...t, sourceName: 'TCF to-do List' }))
  }, [state.tasks])

  async function handleSync() {
    if (state.syncing) return
    dispatch({ type: 'SYNCING', value: true })
    try {
      await fetch(
        'https://api.github.com/repos/DesignTCF/tcf-command-center/actions/workflows/refresh-and-deploy.yml/dispatches',
        {
          method: 'POST',
          headers: { 'Accept': 'application/vnd.github+json', 'Content-Type': 'application/json' },
          body: JSON.stringify({ ref: 'main' }),
        }
      )
    } catch {}
    setTimeout(() => dispatch({ type: 'SYNCED' }), 3000)
  }

  return (
    <div className="page-scroll">
      <Header onSync={handleSync} syncing={state.syncing} syncedAt={state.syncedAt} />

      <div className="flex gap-5 pt-5" style={{ alignItems: 'flex-start' }}>

        {/* ── LEFT: main content ── */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          <NeedsAttention
            tasks={allTasks}
            suppliers={state.suppliers || []}
            serverUp={state.serverUp}
          />
          <Today calendar={state.calendar || []} />
        </div>

        {/* ── RIGHT: sidebar ── */}
        <div style={{ width: 300, flexShrink: 0 }} className="flex flex-col gap-4">
          <BrandsPanel products={state.products || []} />
          <SuppliersWaiting suppliers={state.suppliers || []} />
          <Upcoming calendar={state.calendar || []} />
          <QuickLinks />
        </div>

      </div>
    </div>
  )
}
