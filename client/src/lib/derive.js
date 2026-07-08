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

// Items that are on their way / in progress (not yet delivered) — the "upcoming"
// side of purchasing. Sorted by expected arrival when available.
export function incomingItems(inventory) {
  const out = []
  for (const tab of inventory?.tabs || []) {
    for (const row of tab.rows || []) {
      const blob = Object.entries(row).filter(([k]) => /status/i.test(k)).map(([, v]) => String(v).toLowerCase()).join(' ')
      if (!blob.trim()) continue
      if (/deliver|received|complete|not moving|cancel/.test(blob)) continue
      if (!/shipped|transit|ordered|production|requested|incoming|processing|paid/.test(blob)) continue
      out.push({
        name: row['Supplier / Company'] || row['Brand'] || row['Item Ordered'] || 'Item',
        item: row['Item Ordered'] || row['Product / Component'] || row['Product / Description'] || '',
        tab: tab.label,
        status: row[tab.statusKey] || '',
        eta: row['Expected Arrival'] || '',
      })
    }
  }
  return out.sort((a, b) => {
    if (a.eta && b.eta) return String(a.eta).localeCompare(String(b.eta))
    return a.eta ? -1 : b.eta ? 1 : 0
  })
}

// ── Clients / product pipeline ────────────────────────────────────────────────
export const STAGE_ORDER = ['Formula', 'Bottle', 'Artwork', 'Bottle Print', 'Box Print']

export function productProgress(p) {
  const stages = STAGE_ORDER.map(k => ({ key: k, status: p.stages?.[k] || '' }))
  const filled = stages.filter(s => s.status)
  const done = filled.filter(s => /complet|deliver|receiv|approved|done/i.test(s.status))
  return { stages, doneCount: done.length, total: filled.length, pct: filled.length ? Math.round((done.length / filled.length) * 100) : 0 }
}

export function clientsByBrand(clients) {
  const map = new Map()
  for (const p of clients?.products || []) {
    if (!map.has(p.brand)) map.set(p.brand, [])
    map.get(p.brand).push(p)
  }
  return [...map.entries()].map(([brand, products]) => ({ brand, client: products.find(p => p.client)?.client || '', products }))
}

export function clientStats(clients) {
  const products = clients?.products || []
  let ready = 0, inDev = 0
  for (const p of products) {
    const pr = productProgress(p)
    if (pr.total && pr.doneCount === pr.total) ready++
    else inDev++
  }
  return { total: products.length, ready, inDev, brands: new Set(products.map(p => p.brand)).size }
}

export { statusTone, daysUntil }
