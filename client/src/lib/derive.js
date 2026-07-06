import { statusTone, toDate, startOfToday, daysUntil } from './utils.js'

// ── Tasks ─────────────────────────────────────────────────────────────────────
export function taskStats(tasks) {
  const open = tasks.filter(t => !t.done)
  const high = open.filter(t => (t.priority || '').toLowerCase().includes('high'))
  return { total: tasks.length, open: open.length, done: tasks.length - open.length, high }
}

export function tasksBySource(tasks) {
  const map = new Map()
  for (const t of tasks) {
    if (!map.has(t.sourceName)) map.set(t.sourceName, [])
    map.get(t.sourceName).push(t)
  }
  return [...map.entries()].map(([source, items]) => ({
    source,
    url: items[0]?.url,
    items,
    open: items.filter(i => !i.done).length,
  }))
}

// ── Calendar ──────────────────────────────────────────────────────────────────
export function upcomingEvents(events, days = 60) {
  const today = startOfToday().getTime()
  const horizon = today + days * 86400000
  return events
    .filter(e => {
      const d = toDate(e.start || e.date)
      if (!d) return false
      const t = d.getTime()
      return t >= today && t <= horizon
    })
    .sort((a, b) => (a.start || a.date || '').localeCompare(b.start || b.date || ''))
}

export function eventsThisWeek(events) {
  return upcomingEvents(events, 7)
}

export function groupEventsByDay(events) {
  const map = new Map()
  for (const e of events) {
    const key = (e.date || (e.start || '').slice(0, 10))
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(e)
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
}

// ── Inventory / Supplier Tracker ──────────────────────────────────────────────
// Roll up all rows across tabs into headline counts for the operations view.
export function inventoryStats(inventory) {
  const tabs = inventory?.tabs || []
  let incomingOrders = 0, incomingSamples = 0, followUps = 0, delivered = 0, planned = 0, active = 0
  const followUpRows = []

  for (const tab of tabs) {
    for (const row of tab.rows || []) {
      const status = String(row[tab.statusKey] || '').toLowerCase()
      const anyStatus = Object.entries(row)
        .filter(([k]) => /status/i.test(k))
        .map(([, v]) => String(v).toLowerCase())
        .join(' ')
      const blob = `${status} ${anyStatus}`
      active++

      if (/deliver|received|complete/.test(blob)) delivered++
      if (/issue|follow.?up|delay|problem/.test(blob)) {
        followUps++
        followUpRows.push({ tab: tab.label, row, statusKey: tab.statusKey })
      }
      if (/sample (requested|shipped)/.test(blob) || (tab.key === 'Incoming Samples' && /requested|shipped/.test(blob))) incomingSamples++
      if (tab.key === 'Packaging Orders' || tab.key === 'Branded Accessories') {
        if (/(ordered|production|transit|shipped|incoming|processing)/.test(blob) && !/deliver|received|complete/.test(blob)) incomingOrders++
      }
      if (/planned|sourcing|decision/.test(blob)) planned++
    }
  }
  return { incomingOrders, incomingSamples, followUps, delivered, planned, active, followUpRows }
}

export { statusTone, daysUntil }
