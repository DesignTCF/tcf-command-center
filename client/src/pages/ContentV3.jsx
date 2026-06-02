import React, { useState, useEffect } from 'react'
import { useApp } from '../store/AppContext'
import { fmtDate, fmtDateShort } from '../lib/utils'
import StatusBadge from '../components/StatusBadge'
import Modal from '../components/Modal'
import EmptyState from '../components/EmptyState'
import api from '../lib/api'

const PIPELINE_STAGES = ['Idea', 'Scripted', 'Filmed', 'Editing', 'Scheduled', 'Published']

const PLATFORM_COLORS = {
  Instagram: 'bg-purple-100 text-purple-800',
  TikTok: 'bg-red-100 text-red-800',
  YouTube: 'bg-red-100 text-red-800',
  LinkedIn: 'bg-blue-100 text-blue-800',
  Pinterest: 'bg-red-100 text-red-800',
  Email: 'bg-gray-100 text-gray-700',
}

const STAGE_COLORS = {
  Idea: 'bg-gray-100 text-gray-600',
  Scripted: 'bg-blue-100 text-blue-800',
  Filmed: 'bg-purple-100 text-purple-700',
  Editing: 'bg-amber-100 text-amber-800',
  Scheduled: 'bg-teal-100 text-teal-800',
  Published: 'bg-green-100 text-green-800',
}

function PlatformBadge({ platform }) {
  const cls = PLATFORM_COLORS[platform] || 'bg-gray-100 text-gray-700'
  return (
    <span className={`inline-block text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded ${cls}`}>
      {platform}
    </span>
  )
}

function groupByMonth(items) {
  const groups = {}
  const unscheduled = []

  items.forEach(item => {
    if (!item.postDate && !item.date) {
      unscheduled.push(item)
      return
    }
    const d = new Date(item.postDate || item.date)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleString('default', { month: 'long', year: 'numeric' })
    if (!groups[key]) groups[key] = { label, items: [] }
    groups[key].items.push(item)
  })

  // Sort groups by date
  const sorted = Object.keys(groups)
    .sort()
    .map(k => groups[k])

  if (unscheduled.length > 0) {
    sorted.push({ label: 'Unscheduled', items: unscheduled })
  }

  return sorted
}

const NOTION_CONTENT_URL = 'https://www.notion.so'

export default function ContentV3() {
  const { state, dispatch } = useApp()
  const [refreshing, setRefreshing] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [newItem, setNewItem] = useState({ title: '', platform: 'Instagram', stage: 'Idea', hook: '', postDate: '' })
  const [gcalEvents, setGcalEvents] = useState([])
  const [gcalFeeds, setGcalFeeds] = useState([])
  const [gcalLoading, setGcalLoading] = useState(false)
  const [addCalModal, setAddCalModal] = useState(false)
  const [calUrl, setCalUrl] = useState('')
  const [calName, setCalName] = useState('')

  useEffect(() => {
    loadGcal()
  }, [])

  async function loadGcal() {
    setGcalLoading(true)
    try {
      const [eventsRes, feedsRes] = await Promise.all([
        api.get('/gcal/events'),
        api.get('/gcal/feeds'),
      ])
      setGcalEvents(eventsRes.events || [])
      setGcalFeeds(feedsRes || [])
    } catch {}
    setGcalLoading(false)
  }

  async function addCalendar() {
    if (!calUrl.trim()) return
    try {
      await api.post('/gcal/feeds', { url: calUrl, name: calName || 'Calendar' })
      setCalUrl(''); setCalName(''); setAddCalModal(false)
      loadGcal()
    } catch (e) { alert(e.message) }
  }

  // Group gcal events by month
  const gcalByMonth = {}
  gcalEvents.forEach(e => {
    const d = new Date(e.start)
    if (isNaN(d)) return
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
    const label = d.toLocaleString('default', { month: 'long', year: 'numeric' })
    if (!gcalByMonth[key]) gcalByMonth[key] = { label, events: [] }
    gcalByMonth[key].events.push(e)
  })

  const allContent = state.content || []

  // Split by source: local items have 'stage', Notion items do not
  const notionItems = allContent.filter(i => !i.stage)
  const localItems = allContent.filter(i => i.stage)

  const calendarGroups = groupByMonth(notionItems)

  // Group local items by stage
  const byStage = {}
  PIPELINE_STAGES.forEach(s => { byStage[s] = [] })
  localItems.forEach(item => {
    const stage = item.stage || 'Idea'
    if (!byStage[stage]) byStage[stage] = []
    byStage[stage].push(item)
  })

  function handleRefresh() {
    setRefreshing(true)
    setTimeout(() => setRefreshing(false), 1200)
  }

  function handleAddContent() {
    if (!newItem.title.trim()) return
    const item = {
      id: `c-${Date.now()}`,
      ...newItem,
      createdAt: new Date().toISOString(),
    }
    dispatch({ type: 'ADD', key: 'content', value: item })
    setNewItem({ title: '', platform: 'Instagram', stage: 'Idea', hook: '', postDate: '' })
    setShowModal(false)
  }

  return (
    <div className="page-scroll">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-ink">Content Calendar</h1>
          <div className="flex items-center gap-1.5 text-xs text-ink-muted">
            <span className="w-2 h-2 rounded-full bg-teal inline-block"></span>
            Synced from Notion
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="btn-ghost text-xs px-3 py-1.5 flex items-center gap-1.5"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <svg className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
          <button className="btn-primary px-3 py-1.5 text-xs" onClick={() => setShowModal(true)}>
            + Add Content
          </button>
        </div>
      </div>

      {/* SECTION 0 — Google Calendar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="section-title">Google Calendar</span>
            {gcalFeeds.map(f => (
              <span key={f.id} className="flex items-center gap-1.5 text-[10.5px] text-ink-muted border border-border rounded-full px-2.5 py-0.5">
                <span className="w-2 h-2 rounded-full" style={{ background: f.color || '#0D9E9E' }} />
                {f.name}
                {f.eventCount > 0 && <span className="font-semibold">{f.eventCount}</span>}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadGcal} className="btn-ghost text-xs py-1">
              {gcalLoading ? '↻ Syncing…' : '↻ Refresh'}
            </button>
            <button onClick={() => setAddCalModal(true)} className="btn-ghost text-xs py-1">+ Add Calendar</button>
          </div>
        </div>

        {gcalLoading ? (
          <div className="text-sm text-ink-muted py-4 text-center">Loading calendar…</div>
        ) : gcalEvents.length === 0 ? (
          <div className="panel px-4 py-5 text-center">
            <div className="text-2xl mb-2">📅</div>
            <div className="text-sm font-medium text-ink mb-1">The Cosmetic Formulary Operations calendar is connected</div>
            <div className="text-xs text-ink-muted">No upcoming events yet. Add events in Google Calendar and they'll appear here automatically.</div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {Object.entries(gcalByMonth).sort(([a],[b]) => a.localeCompare(b)).map(([key, month]) => (
              <div key={key}>
                <div className="text-[11px] font-bold text-ink-muted uppercase tracking-wider mb-2">{month.label}</div>
                <div className="flex flex-col gap-1.5">
                  {month.events.map((ev, i) => {
                    const d = new Date(ev.start)
                    const isAllDay = ev.start?.length === 10
                    return (
                      <div key={i} className="flex items-start gap-3 panel px-4 py-3">
                        <div className="shrink-0 text-center w-10">
                          <div className="text-[10px] text-ink-muted font-semibold uppercase">{d.toLocaleString('default',{month:'short'})}</div>
                          <div className="text-lg font-bold text-ink leading-none">{d.getDate()}</div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm text-ink">{ev.title}</div>
                          {!isAllDay && <div className="text-xs text-ink-muted mt-0.5">{d.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}</div>}
                          {ev.description && <div className="text-xs text-ink-muted mt-1 line-clamp-2">{ev.description}</div>}
                          {ev.location && <div className="text-xs text-teal mt-0.5">📍 {ev.location}</div>}
                        </div>
                        <div className="shrink-0">
                          <span className="text-[9.5px] px-2 py-0.5 rounded-full border border-border text-ink-muted">
                            {ev.feedName || 'Calendar'}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add calendar modal */}
        {addCalModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setAddCalModal(false)}>
            <div className="bg-white rounded-xl p-6 w-[460px] shadow-xl" onClick={e => e.stopPropagation()}>
              <h3 className="font-semibold text-base mb-4">Add Google Calendar</h3>
              <div className="flex flex-col gap-3">
                <div>
                  <label className="section-title block mb-1">Calendar Name</label>
                  <input value={calName} onChange={e => setCalName(e.target.value)} className="input-field" placeholder="e.g. Content Calendar" />
                </div>
                <div>
                  <label className="section-title block mb-1">iCal URL (from Google Calendar Settings)</label>
                  <input value={calUrl} onChange={e => setCalUrl(e.target.value)} className="input-field text-xs font-mono" placeholder="https://calendar.google.com/calendar/ical/..." />
                  <div className="text-[10.5px] text-ink-muted mt-1">Calendar Settings → "Secret address in iCal format" → Copy</div>
                </div>
                <div className="flex gap-2 justify-end pt-2">
                  <button onClick={() => setAddCalModal(false)} className="btn-ghost text-xs">Cancel</button>
                  <button onClick={addCalendar} className="btn-primary text-xs">Connect Calendar</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 1 — Notion Calendar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <p className="section-title">Notion Content Calendar</p>
          <a
            href={NOTION_CONTENT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-teal hover:text-teal-dim font-medium"
          >
            Open in Notion ↗
          </a>
        </div>

        <div className="panel overflow-hidden">
          {notionItems.length === 0 ? (
            <div className="p-6">
              <EmptyState message="No Notion content calendar items. Connect Notion to sync your content schedule." />
            </div>
          ) : (
            <div>
              {calendarGroups.map((group, gi) => (
                <div key={gi}>
                  {/* Month header */}
                  <div className="px-4 py-2 bg-surface2 border-b border-border">
                    <span className="text-[11px] font-bold uppercase tracking-widest text-ink-muted">
                      {group.label}
                    </span>
                  </div>
                  {/* Items */}
                  {group.items.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      className="flex items-center gap-4 px-4 py-3 border-b border-border last:border-0 hover:bg-surface transition-colors"
                    >
                      {/* Date */}
                      <div className="w-20 shrink-0 text-xs text-ink-muted font-mono">
                        {item.postDate || item.date
                          ? fmtDateShort(item.postDate || item.date)
                          : <span className="text-border2">—</span>}
                      </div>
                      {/* Title */}
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-ink font-medium truncate block">{item.title}</span>
                      </div>
                      {/* Platform */}
                      <div className="shrink-0">
                        {item.platform ? <PlatformBadge platform={item.platform} /> : null}
                      </div>
                      {/* Type */}
                      {item.type && (
                        <div className="shrink-0 text-xs text-ink-muted">{item.type}</div>
                      )}
                      {/* Status */}
                      {item.status && (
                        <div className="shrink-0">
                          <StatusBadge status={item.status} />
                        </div>
                      )}
                      {/* Notion link */}
                      {item.notionUrl && (
                        <a
                          href={item.notionUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 text-[11px] text-teal hover:text-teal-dim font-medium whitespace-nowrap"
                        >
                          Open ↗
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* SECTION 2 — Production Pipeline Kanban */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="section-title">Production Pipeline</p>
          <span className="text-xs text-ink-muted">{localItems.length} item{localItems.length !== 1 ? 's' : ''}</span>
        </div>

        {localItems.length === 0 ? (
          <div className="panel p-6">
            <EmptyState message="No pipeline content yet. Add content to track it through production stages." />
          </div>
        ) : (
          <div className="overflow-x-auto pb-2">
            <div className="flex gap-3 min-w-max">
              {PIPELINE_STAGES.map(stage => {
                const cards = byStage[stage] || []
                return (
                  <div key={stage} className="w-56 shrink-0">
                    {/* Column header */}
                    <div className="flex items-center justify-between mb-2 px-1">
                      <span className="text-[11px] font-bold uppercase tracking-widest text-ink-muted">{stage}</span>
                      <span className="text-[11px] font-semibold text-ink-muted bg-surface2 rounded-full px-1.5 py-0.5 leading-none">
                        {cards.length}
                      </span>
                    </div>
                    {/* Cards */}
                    <div className="flex flex-col gap-2">
                      {cards.map((card, idx) => (
                        <div key={card.id || idx} className="panel p-3 cursor-default hover:border-border2 transition-colors">
                          {/* Platform + Stage */}
                          <div className="flex items-center gap-1.5 mb-2">
                            {card.platform && <PlatformBadge platform={card.platform} />}
                          </div>
                          {/* Title */}
                          <p className="text-[13px] font-semibold text-ink leading-snug mb-1.5 line-clamp-2">
                            {card.title}
                          </p>
                          {/* Hook */}
                          {card.hook && (
                            <p className="text-[11px] text-ink-muted leading-relaxed line-clamp-3 italic">
                              "{card.hook}"
                            </p>
                          )}
                          {/* Post date */}
                          {card.postDate && (
                            <p className="text-[10px] text-ink-muted mt-2 font-mono">
                              {fmtDateShort(card.postDate)}
                            </p>
                          )}
                        </div>
                      ))}
                      {cards.length === 0 && (
                        <div className="border border-dashed border-border rounded-lg p-4 text-center">
                          <span className="text-[11px] text-border2">Empty</span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Add Content Modal */}
      {showModal && (
        <Modal title="Add Content" onClose={() => setShowModal(false)}>
          <div className="flex flex-col gap-4">
            <div>
              <label className="section-title block mb-1">Title</label>
              <input
                className="input-field w-full"
                placeholder="Content title…"
                value={newItem.title}
                onChange={e => setNewItem(p => ({ ...p, title: e.target.value }))}
              />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="section-title block mb-1">Platform</label>
                <select
                  className="input-field w-full"
                  value={newItem.platform}
                  onChange={e => setNewItem(p => ({ ...p, platform: e.target.value }))}
                >
                  {['Instagram', 'TikTok', 'YouTube', 'LinkedIn', 'Pinterest', 'Email'].map(pl => (
                    <option key={pl}>{pl}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="section-title block mb-1">Stage</label>
                <select
                  className="input-field w-full"
                  value={newItem.stage}
                  onChange={e => setNewItem(p => ({ ...p, stage: e.target.value }))}
                >
                  {PIPELINE_STAGES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="section-title block mb-1">Hook / Description</label>
              <textarea
                className="input-field w-full h-20 resize-none"
                placeholder="Hook or short description…"
                value={newItem.hook}
                onChange={e => setNewItem(p => ({ ...p, hook: e.target.value }))}
              />
            </div>
            <div>
              <label className="section-title block mb-1">Planned Post Date</label>
              <input
                type="date"
                className="input-field w-full"
                value={newItem.postDate}
                onChange={e => setNewItem(p => ({ ...p, postDate: e.target.value }))}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn-ghost px-4 py-2 text-xs" onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button className="btn-primary px-4 py-2 text-xs" onClick={handleAddContent}>
                Add to Pipeline
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
