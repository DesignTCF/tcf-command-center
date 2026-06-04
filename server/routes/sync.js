const express = require('express')
const router = express.Router()
const fs = require('fs')
const path = require('path')

const DATA_DIR = path.join(__dirname, '../../data')

function readJSON(file, fallback = []) {
  try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8')) } catch { return fallback }
}
function writeJSON(file, data) {
  fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2))
}

// ── Notion ────────────────────────────────────────────────────────────────────
async function syncNotion() {
  const token = process.env.NOTION_TOKEN
  if (!token) return { ok: false, reason: 'No NOTION_TOKEN' }

  async function notionQuery(dbId) {
    const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
      },
      body: JSON.stringify({ sorts: [{ timestamp: 'last_edited_time', direction: 'descending' }], page_size: 100 }),
    })
    if (!res.ok) throw new Error(`Notion ${res.status}`)
    return res.json()
  }

  function getText(prop) {
    if (!prop) return ''
    if (prop.title) return prop.title.map(t => t.plain_text).join('')
    if (prop.rich_text) return prop.rich_text.map(t => t.plain_text).join('')
    return ''
  }

  let taskCount = 0, contentCount = 0

  try {
    const TODO_DB = process.env.NOTION_TODO_DB_ID || '337162124ddd80508602d598cd2896da'
    const result = await notionQuery(TODO_DB)
    const tasks = (result.results || []).map(page => {
      const props = page.properties || {}
      const titleProp = props['Task name'] || props['Name'] || props['Title'] || Object.values(props).find(p => p.type === 'title')
      const statusVal = props['Status']
      const statusName = statusVal?.status?.name || statusVal?.select?.name || ''
      return {
        id: page.id, title: getText(titleProp), status: statusName,
        dueDate: props['Due date']?.date?.start || props['Due Date']?.date?.start || null,
        url: page.url, lastEdited: page.last_edited_time,
        done: statusName === 'Done', source: 'notion',
      }
    })
    writeJSON('notion-tasks.json', tasks)
    taskCount = tasks.length
  } catch (err) {
    console.warn('Notion tasks sync failed:', err.message)
  }

  try {
    const CONTENT_DB = '34116212-4ddd-80a4-8b44-fe0a634c2ef2'
    const result = await notionQuery(CONTENT_DB)
    const content = (result.results || []).map(page => {
      const props = page.properties || {}
      const titleProp = props['Content name'] || props['Name'] || Object.values(props).find(p => p.type === 'title')
      return {
        id: page.id, title: getText(titleProp),
        status: props['Status']?.select?.name || '',
        platform: (props['Platform']?.multi_select || []).map(s => s.name),
        contentType: props['Content type']?.select?.name || '',
        publishDate: props['Publish date']?.date?.start || null,
        url: page.url,
      }
    })
    writeJSON('notion-content.json', content)
    contentCount = content.length
  } catch (err) {
    console.warn('Notion content sync failed:', err.message)
  }

  return { ok: true, tasks: taskCount, content: contentCount }
}

// ── Google Calendar ───────────────────────────────────────────────────────────
function parseICSDate(str) {
  if (!str) return null
  str = str.trim()
  if (/^\d{8}$/.test(str)) return `${str.slice(0,4)}-${str.slice(4,6)}-${str.slice(6,8)}`
  if (/^\d{8}T\d{6}/.test(str)) {
    const d = str.replace('Z','')
    return new Date(`${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}T${d.slice(9,11)}:${d.slice(11,13)}:${d.slice(13,15)}${str.endsWith('Z')?'Z':''}`).toISOString()
  }
  return str
}

function parseICS(text) {
  const unfolded = text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '')
  const lines = unfolded.split(/\r\n|\n/)
  const events = []; let cur = null
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { cur = {}; continue }
    if (line === 'END:VEVENT') { if (cur) events.push(cur); cur = null; continue }
    if (!cur) continue
    const ci = line.indexOf(':')
    if (ci < 0) continue
    const key = line.slice(0, ci).split(';')[0].trim()
    const val = line.slice(ci+1).trim().replace(/\\n/g,'\n').replace(/\\,/g,',').replace(/\\\\/g,'\\')
    if (key === 'SUMMARY')     cur.title = val
    if (key === 'DTSTART')     cur.start = parseICSDate(line.slice(ci+1).trim())
    if (key === 'DTEND')       cur.end   = parseICSDate(line.slice(ci+1).trim())
    if (key === 'DESCRIPTION') cur.description = val
    if (key === 'LOCATION')    cur.location = val
    if (key === 'UID')         cur.uid = val
  }
  return events.filter(e => e.title && e.start).sort((a,b) => (a.start||'').localeCompare(b.start||''))
}

async function syncCalendar() {
  const feeds = readJSON('gcal-feeds.json', [])
  if (!feeds.length) return { ok: false, reason: 'No feeds configured' }

  const allEvents = []
  for (const feed of feeds) {
    try {
      const res = await fetch(feed.url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const ics = await res.text()
      const events = parseICS(ics)
      allEvents.push(...events.map(e => ({ ...e, calendarName: feed.name || 'Calendar' })))
    } catch (err) {
      console.warn(`GCal feed "${feed.name}" failed:`, err.message)
    }
  }

  writeJSON('gcal-cache.json', { events: allEvents, fetchedAt: new Date().toISOString() })
  return { ok: true, events: allEvents.length }
}

// ── Drive sources (public share links) ───────────────────────────────────────
function parseCSV(csv) {
  const lines = csv.split('\n').filter(l => l.trim())
  if (!lines.length) return { headers: [], rows: [], rowCount: 0 }
  function parseLine(line) {
    const result = []; let current = ''; let inQuotes = false
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes }
      else if (ch === ',' && !inQuotes) { result.push(current.trim()); current = '' }
      else { current += ch }
    }
    result.push(current.trim()); return result
  }
  const headers = parseLine(lines[0])
  const rows = lines.slice(1).map(l => {
    const vals = parseLine(l); const obj = {}
    headers.forEach((h, i) => { if (h) obj[h] = vals[i] || '' })
    return obj
  }).filter(r => Object.values(r).some(v => v))
  return { headers, rows, rowCount: rows.length }
}

async function syncSources() {
  const sources = readJSON('sources.json', [])
  if (!sources.length) return { ok: true, updated: 0 }

  let updated = 0
  for (const source of sources) {
    try {
      let raw, contentType
      if (source.type === 'sheet') {
        const res = await fetch(`https://docs.google.com/spreadsheets/d/${source.fileId}/export?format=csv`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        raw = await res.text(); contentType = 'csv'
      } else if (source.type === 'doc') {
        const res = await fetch(`https://docs.google.com/document/d/${source.fileId}/export?format=txt`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        raw = await res.text(); contentType = 'text'
      } else continue

      source.rawContent = raw
      source.contentType = contentType
      source.lastFetched = new Date().toISOString()
      source.error = null
      if (contentType === 'csv') source.parsed = parseCSV(raw)

      const { headers, rows, rowCount } = source.parsed || {}
      source.summary = contentType === 'csv'
        ? `Spreadsheet: ${source.label}\nColumns: ${(headers||[]).filter(h=>h).join(', ')}\nRows: ${rowCount}\nSample:\n${(rows||[]).slice(0,5).map(r=>Object.entries(r).filter(([k,v])=>v&&k).slice(0,4).map(([k,v])=>`${k}: ${v}`).join(' | ')).join('\n')}`
        : `Document: ${source.label}\nContent preview:\n${raw?.slice(0,800)}`

      updated++
    } catch (err) {
      source.error = err.message
      console.warn(`Source "${source.label}" failed:`, err.message)
    }
  }

  writeJSON('sources.json', sources)
  return { ok: true, updated, total: sources.length }
}

// ── POST /api/sync — run all syncs ───────────────────────────────────────────
router.post('/', async (req, res) => {
  const startedAt = new Date().toISOString()
  console.log('[sync] Starting full sync…')

  const [notion, calendar, sources] = await Promise.allSettled([
    syncNotion(),
    syncCalendar(),
    syncSources(),
  ])

  const result = {
    ok: true,
    completedAt: new Date().toISOString(),
    startedAt,
    notion:   notion.status   === 'fulfilled' ? notion.value   : { ok: false, error: notion.reason?.message },
    calendar: calendar.status === 'fulfilled' ? calendar.value : { ok: false, error: calendar.reason?.message },
    sources:  sources.status  === 'fulfilled' ? sources.value  : { ok: false, error: sources.reason?.message },
  }

  console.log('[sync] Done:', JSON.stringify(result))
  res.json(result)
})

// ── GET /api/sync/status ──────────────────────────────────────────────────────
router.get('/status', (req, res) => {
  const gcalCache = readJSON('gcal-cache.json', {})
  const sources   = readJSON('sources.json', [])
  const lastFetched = sources.reduce((latest, s) => {
    if (!s.lastFetched) return latest
    return !latest || s.lastFetched > latest ? s.lastFetched : latest
  }, gcalCache.fetchedAt || null)

  res.json({
    lastSynced: lastFetched,
    sources: sources.length,
    calendarEvents: (gcalCache.events || []).length,
  })
})

module.exports = router
