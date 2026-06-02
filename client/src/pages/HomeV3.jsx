import React, { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApp } from '../store/AppContext'
import { fmtDateShort, isOverdue } from '../lib/utils'
import StatusBadge from '../components/StatusBadge'

const BRANDS = [
  { name: 'NeVoo',        client: 'Molly Smith',       color: '#0D9E9E' },
  { name: 'Daily Rou',    client: 'Meredith Baurband', color: '#A07A10' },
  { name: 'Nitt Beauty',  client: 'Gamze Gurlevik',    color: '#5533AA' },
  { name: 'Devoted Man',  client: 'Josh Smith',         color: '#2255AA' },
  { name: 'Salt Spa Yoga',client: 'Andrew Moss',        color: '#157A50' },
]

const COMPLETE_STATUSES = new Set(['Ready', 'Approved', 'Live', 'Ready To Launch'])
const INDEV_STATUSES    = new Set(['In Development', 'Formulating'])
const TESTING_STATUSES  = new Set(['Stability Testing'])

function taskDot(title = '') {
  const t = title.toLowerCase()
  if (t.includes('packaging') || t.includes('approval')) return '#B52B2B'
  if (t.includes('website') || t.includes('update')) return '#A86200'
  return '#0D9E9E'
}

const QUICK_LINKS = [
  { label: 'QuickBooks', url: 'https://accounts.intuit.com/',    group: 'Business' },
  { label: 'HubSpot',    url: 'https://app.hubspot.com/',         group: 'Business' },
  { label: 'Shopify',    url: 'https://accounts.shopify.com/',    group: 'Business' },
  { label: 'Alibaba',    url: 'https://login.alibaba.com/',       group: 'Suppliers' },
  { label: 'Bulk Apothecary', url: 'https://bulkapothecary.com/', group: 'Suppliers' },
  { label: 'Chunbai (Doria)', url: 'https://alibaba.com/',        group: 'Suppliers' },
]

function todayLabel() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

function getHour() {
  return new Date().getHours()
}

function greeting() {
  const h = getHour()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function HomeV3() {
  const { state } = useApp()
  const navigate = useNavigate()

  // LEFT: all open tasks — Notion tasks + TCF project tasks from page content
  const focusTasks = useMemo(() => {
    const notionTasks = (state.tasks || [])
      .filter(t => !t.done && t.status !== 'Done' && t.status !== 'Complete')
      .filter(t => t.status === 'In progress' || t.status === 'In Progress')

    // High-priority tasks pulled from Notion page content
    const pageTasks = (state.notionPageTasks || [])
      .filter(t => t.priority === 'High' && t.status !== 'Done' && t.status !== 'Complete')
      .slice(0, 5)

    return [...notionTasks, ...pageTasks].slice(0, 10)
  }, [state.tasks, state.notionPageTasks])

  // LEFT: open decisions
  const openDecisions = useMemo(() => {
    return (state.decisions || []).filter(d => !d.resolved)
  }, [state.decisions])

  // MIDDLE: brands
  const brandRows = useMemo(() => {
    return BRANDS.map(b => {
      const prods = (state.products || []).filter(p => p.clientBrand === b.name)
      const complete  = prods.filter(p => COMPLETE_STATUSES.has(p.status)).length
      const inDev     = prods.filter(p => INDEV_STATUSES.has(p.status)).length
      const testing   = prods.filter(p => TESTING_STATUSES.has(p.status)).length
      const total     = prods.length
      const pct       = total > 0 ? Math.round((complete / total) * 100) : 0
      return { ...b, total, complete, inDev, testing, pct }
    })
  }, [state.products])

  // MIDDLE: waiting suppliers
  const waitingSuppliers = useMemo(() => {
    return (state.suppliers || [])
      .filter(s => s.status === 'Waiting')
      .slice(0, 4)
  }, [state.suppliers])

  // RIGHT: notion tasks not done
  const notionTasks = useMemo(() => {
    const notDone = (state.tasks || []).filter(t =>
      t.status !== 'Done' && t.status !== 'Complete' && t.status !== 'Completed'
    )
    const inProg = notDone.filter(t => t.status === 'In progress' || t.status === 'In Progress')
    const notStarted = notDone.filter(t => t.status === 'Not started' || t.status === 'Not Started')
    return [...inProg, ...notStarted].slice(0, 10)
  }, [state.tasks])

  // RIGHT: content calendar
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

  return (
    <div className="page-scroll flex gap-5 min-h-full" style={{ paddingTop: '1.5rem' }}>

      {/* ── LEFT COLUMN ── */}
      <div style={{ width: 300, flexShrink: 0 }} className="flex flex-col gap-4">

        {/* Greeting */}
        <div>
          <div className="text-[15px] font-semibold text-[#1A1A1A] leading-snug">
            {greeting()}, Katherine
          </div>
          <div className="text-[11.5px] text-[#58595b] mt-0.5">{todayLabel()}</div>
        </div>

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
                <span
                  className="mt-[4px] w-[7px] h-[7px] rounded-full flex-shrink-0"
                  style={{ backgroundColor: taskDot(task.title) }}
                />
                <span className="text-[12px] text-[#1A1A1A] leading-snug group-hover:text-[#0D9E9E] transition-colors line-clamp-2">
                  {task.title}
                </span>
              </Link>
            ))}
            {focusTasks.length === 0 && (state.tasks || []).filter(t => t.status !== 'Done').length > 0 && (
              <div className="text-[11px] text-[#58595b] mt-1">
                <Link to="/work" className="hover:text-[#0D9E9E]">
                  View all tasks →
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Open Decisions */}
        <div className="panel">
          <div className="panel-header">
            <span className="section-title">Open Decisions</span>
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded"
              style={{ background: '#FAE5E5', color: '#B52B2B' }}
            >
              {openDecisions.length}
            </span>
          </div>
          <div className="p-3 flex flex-col gap-2.5">
            {openDecisions.length === 0 && (
              <div className="text-[11.5px] text-[#58595b] py-2 text-center">All decisions resolved</div>
            )}
            {openDecisions.slice(0, 3).map(d => (
              <div key={d.id} className="border border-[#E5E5E5] rounded-[6px] p-2.5 bg-white">
                <div className="text-[12px] font-semibold text-[#1A1A1A] leading-snug mb-1">
                  {d.title}
                </div>
                {d.context && (
                  <div className="text-[11px] text-[#58595b] leading-snug line-clamp-2">
                    {d.context}
                  </div>
                )}
              </div>
            ))}
            {openDecisions.length > 3 && (
              <div className="text-[11px] text-[#58595b]">
                +{openDecisions.length - 3} more decisions
              </div>
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
                {/* Brand + client */}
                <div style={{ width: 160, flexShrink: 0 }}>
                  <div className="text-[13px] font-bold text-[#1A1A1A]" style={{ color: b.color }}>
                    {b.name}
                  </div>
                  <div className="text-[11px] text-[#58595b]">{b.client}</div>
                </div>

                {/* Product count */}
                <div style={{ width: 64, flexShrink: 0 }} className="text-center">
                  <div className="text-[16px] font-bold text-[#1A1A1A]">{b.total}</div>
                  <div className="text-[10px] text-[#58595b]">products</div>
                </div>

                {/* Progress bar */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10.5px] text-[#58595b]">
                      {b.complete > 0 && <span className="text-[#0A7A7A] font-semibold">{b.complete} Ready</span>}
                      {b.complete > 0 && (b.inDev > 0 || b.testing > 0) && <span className="text-[#D8D8D8]"> · </span>}
                      {b.inDev > 0 && <span className="text-[#2255AA]">{b.inDev} In Dev</span>}
                      {b.inDev > 0 && b.testing > 0 && <span className="text-[#D8D8D8]"> · </span>}
                      {b.testing > 0 && <span className="text-[#A86200]">{b.testing} Testing</span>}
                      {b.complete === 0 && b.inDev === 0 && b.testing === 0 && (
                        <span className="text-[#58595b]">No data</span>
                      )}
                    </span>
                    <span className="text-[10px] text-[#58595b] ml-2 flex-shrink-0">{b.pct}%</span>
                  </div>
                  <div className="h-[6px] rounded-full bg-[#E5E5E5] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${b.pct}%`, backgroundColor: b.color }}
                    />
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
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th>Project</th>
                  <th>Waiting On</th>
                  <th>Follow-up</th>
                </tr>
              </thead>
              <tbody>
                {waitingSuppliers.map(s => (
                  <tr key={s.id}>
                    <td className="font-medium text-[#1A1A1A]">{s.supplier}</td>
                    <td className="text-[#444444]">{s.project}</td>
                    <td className="text-[#444444] max-w-[200px] truncate">{s.waitingOn || '—'}</td>
                    <td>
                      {s.nextFollowUp ? (
                        <span className={`text-[11.5px] font-medium ${isOverdue(s.nextFollowUp) ? 'text-[#B52B2B]' : 'text-[#444444]'}`}>
                          {fmtDateShort(s.nextFollowUp)}
                        </span>
                      ) : (
                        <span className="text-[#58595b]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

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
                {/* visual checkbox circle */}
                <div
                  className="mt-[2px] w-[14px] h-[14px] rounded-full border flex-shrink-0"
                  style={{
                    borderColor: task.status === 'In progress' || task.status === 'In Progress'
                      ? '#0D9E9E' : '#BBBBBB',
                    background: 'white'
                  }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[11.5px] text-[#1A1A1A] leading-snug line-clamp-2 mb-0.5">
                    {task.title}
                  </div>
                  <StatusBadge status={task.status} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Content Calendar */}
        <div className="panel">
          <div className="panel-header">
            <span className="section-title">Content Calendar</span>
            <Link to="/calendar" className="text-[11px] text-[#0D9E9E] hover:underline">View all</Link>
          </div>
          <div className="p-3 flex flex-col gap-2">
            {contentItems.length === 0 && (
              <div className="text-[11.5px] text-[#58595b] py-2 text-center">No content items</div>
            )}
            {contentItems.map((item, i) => {
              const dateVal = item.publishDate || item.dueDate || item.date
              return (
                <div key={item.id || i} className="flex items-start gap-2 border-b border-[#EEEEEE] pb-2 last:border-0 last:pb-0">
                  {dateVal && (
                    <div
                      className="flex-shrink-0 w-10 text-center rounded py-1"
                      style={{ background: '#F5F5F5' }}
                    >
                      <div className="text-[10px] text-[#58595b] uppercase leading-none">
                        {new Date(dateVal).toLocaleDateString('en-US', { month: 'short' })}
                      </div>
                      <div className="text-[14px] font-bold text-[#1A1A1A] leading-tight">
                        {new Date(dateVal).getDate()}
                      </div>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-[11.5px] font-medium text-[#1A1A1A] leading-snug line-clamp-1">
                      {item.title || item.name || 'Untitled'}
                    </div>
                    <div className="text-[10.5px] text-[#58595b] mt-0.5">
                      {item.platform || item.type || item.brand || ''}
                    </div>
                  </div>
                  {item.status && <StatusBadge status={item.status} />}
                </div>
              )
            })}
          </div>
        </div>

        {/* Quick Links */}
        <div className="panel">
          <div className="panel-header">
            <span className="section-title">Quick Links</span>
          </div>
          <div className="p-3 flex flex-col gap-3">
            {['Business', 'Suppliers'].map(group => (
              <div key={group}>
                <div className="text-[9.5px] font-bold uppercase tracking-wider text-[#58595b] mb-1.5">
                  {group}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_LINKS.filter(l => l.group === group).map(link => (
                    <a
                      key={link.label}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 rounded-full border border-[#BBBBBB] text-[11px] text-[#444444] hover:border-[#0D9E9E] hover:text-[#0D9E9E] transition-colors whitespace-nowrap"
                    >
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
