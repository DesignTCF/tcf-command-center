#!/usr/bin/env node
// Fetches fresh data from all live sources and writes to data/ JSON files
// Run before each GitHub Pages build to keep static site current

// env vars come from GitHub Secrets in CI, or .env locally
try { require('dotenv').config({ path: '../.env' }) } catch {}
const fs = require('fs')
const path = require('path')
const https = require('https')

const DATA_DIR = path.join(__dirname, '../data')
const log = (msg) => console.log(`[fetch-data] ${msg}`)
const write = (file, data) => fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2))

function httpGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url)
    const options = { hostname: u.hostname, path: u.pathname + u.search, headers }
    https.get(options, res => {
      let body = ''
      res.on('data', d => body += d)
      res.on('end', () => {
        if (res.statusCode >= 400) reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 200)}`))
        else resolve(body)
      })
    }).on('error', reject)
  })
}

// ── Notion (uses SDK from server/node_modules — proven to work) ───────────────
function getNotionClient() {
  const token = process.env.NOTION_TOKEN
  if (!token) throw new Error('NOTION_TOKEN not set')
  // Load SDK from server's node_modules
  const { Client } = require(require('path').join(__dirname, '../server/node_modules/@notionhq/client'))
  return new Client({ auth: token })
}

function getText(prop) {
  if (!prop) return ''
  if (prop.title) return prop.title.map(t => t.plain_text).join('')
  if (prop.rich_text) return prop.rich_text.map(t => t.plain_text).join('')
  return ''
}

async function fetchAllNotionPages(notion, database_id, sorts = []) {
  const pages = []
  let cursor = undefined
  do {
    const res = await notion.databases.query({
      database_id,
      sorts,
      page_size: 100,
      ...(cursor ? { start_cursor: cursor } : {}),
    })
    pages.push(...res.results)
    cursor = res.has_more ? res.next_cursor : undefined
  } while (cursor)
  return pages
}

// ── Notion Tasks ──────────────────────────────────────────────────────────────
async function fetchNotionTasks() {
  try {
    const notion = getNotionClient()
    const dbId = process.env.NOTION_TODO_DB_ID || '337162124ddd80508602d598cd2896da'

    const pages = await fetchAllNotionPages(notion, dbId, [
      { timestamp: 'last_edited_time', direction: 'descending' }
    ])

    const tasks = pages.map(page => {
      const props = page.properties || {}
      const titleProp = props['Task name'] || props['Name'] || props['Title'] ||
        Object.values(props).find(p => p.type === 'title')
      const statusVal = props['Status']
      const statusName = statusVal?.status?.name || statusVal?.select?.name || ''
      return {
        id: page.id,
        title: getText(titleProp),
        status: statusName,
        dueDate: props['Due date']?.date?.start || props['Due Date']?.date?.start || null,
        assignee: (props['Assignee']?.people || []).map(p => p.name).join(', '),
        url: page.url,
        lastEdited: page.last_edited_time,
        done: ['done', 'complete', 'completed'].includes(statusName.toLowerCase()),
        source: 'notion',
      }
    })

    write('notion-tasks.json', tasks)
    log(`✓ Notion tasks: ${tasks.length} (${tasks.filter(t => !t.done).length} open)`)
  } catch (err) {
    log(`✗ Notion tasks FAILED: ${err.message}`)
    // Write empty array so generate-static-data doesn't use stale data
    if (!require('fs').existsSync(require('path').join(require('path').join(__dirname, '../data'), 'notion-tasks.json'))) {
      write('notion-tasks.json', [])
    }
  }
}

// ── Notion Content Calendar ───────────────────────────────────────────────────
async function fetchNotionContent() {
  try {
    const notion = getNotionClient()
    const CONTENT_DB_ID = '34116212-4ddd-80a4-8b44-fe0a634c2ef2'

    const pages = await fetchAllNotionPages(notion, CONTENT_DB_ID, [
      { property: 'Publish date', direction: 'descending' }
    ])

    const content = pages.map(page => {
      const props = page.properties || {}
      const titleProp = props['Content name'] || props['Name'] ||
        Object.values(props).find(p => p.type === 'title')
      return {
        id: page.id,
        title: getText(titleProp),
        status: props['Status']?.select?.name || '',
        platform: (props['Platform']?.multi_select || []).map(s => s.name),
        contentType: props['Content type']?.select?.name || '',
        publishDate: props['Publish date']?.date?.start || null,
        url: page.url,
      }
    })

    write('notion-content.json', content)
    log(`✓ Notion content: ${content.length}`)
  } catch (err) {
    log(`✗ Notion content FAILED: ${err.message}`)
  }
}

// ── Google Calendar (iCal) ────────────────────────────────────────────────────
async function fetchGoogleCalendar() {
  try {
    const feedsFile = path.join(DATA_DIR, 'gcal-feeds.json')
    const feeds = JSON.parse(fs.readFileSync(feedsFile, 'utf8') || '[]')
    if (!feeds.length) return

    const allEvents = []
    for (const feed of feeds) {
      try {
        const ics = await httpGet(feed.url)
        const events = parseICS(ics)
        allEvents.push(...events.map(e => ({ ...e, calendarName: feed.name || 'Calendar' })))
      } catch (err) {
        log(`✗ Calendar feed "${feed.name}": ${err.message}`)
      }
    }

    write('gcal-cache.json', { events: allEvents, fetchedAt: new Date().toISOString() })
    log(`✓ Calendar events: ${allEvents.length}`)
  } catch (err) {
    log(`✗ Calendar: ${err.message}`)
  }
}

function parseICS(text) {
  const unfolded = text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '')
  const lines = unfolded.split(/\r\n|\n/)
  const events = []
  let current = null

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { current = {}; continue }
    if (line === 'END:VEVENT') { if (current) events.push(current); current = null; continue }
    if (!current) continue
    const colon = line.indexOf(':')
    if (colon < 0) continue
    const key = line.slice(0, colon).split(';')[0].trim()
    const val = line.slice(colon + 1).trim()
    if (key === 'SUMMARY') current.title = val
    if (key === 'DTSTART') current.start = parseICSDate(val)
    if (key === 'DTEND') current.end = parseICSDate(val)
    if (key === 'DESCRIPTION') current.description = val.replace(/\\n/g, '\n')
    if (key === 'UID') current.id = val
  }
  return events
}

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

// ── Google Drive Sources (public share links) ─────────────────────────────────
async function fetchDriveSources() {
  try {
    const sourcesFile = path.join(DATA_DIR, 'sources.json')
    const sources = JSON.parse(fs.readFileSync(sourcesFile, 'utf8') || '[]')
    if (!sources.length) return

    let updated = 0
    for (const source of sources) {
      try {
        let raw, contentType
        if (source.type === 'sheet') {
          const url = `https://docs.google.com/spreadsheets/d/${source.fileId}/export?format=csv`
          raw = await httpGet(url)
          contentType = 'csv'
        } else if (source.type === 'doc') {
          const url = `https://docs.google.com/document/d/${source.fileId}/export?format=txt`
          raw = await httpGet(url)
          contentType = 'text'
        } else continue

        source.rawContent = raw
        source.contentType = contentType
        source.lastFetched = new Date().toISOString()
        source.error = null

        if (contentType === 'csv') {
          source.parsed = parseCSV(raw)
        }
        source.summary = buildSummary(source)
        updated++
      } catch (err) {
        source.error = err.message
        log(`✗ Source "${source.label}": ${err.message}`)
      }
    }

    write('sources.json', sources)
    log(`✓ Drive sources refreshed: ${updated}/${sources.length}`)
  } catch (err) {
    log(`✗ Drive sources: ${err.message}`)
  }
}

function parseCSV(csv) {
  const lines = csv.split('\n').filter(l => l.trim())
  if (!lines.length) return { headers: [], rows: [], rowCount: 0 }
  function parseLine(line) {
    const result = []; let current = ''; let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') { inQuotes = !inQuotes }
      else if (line[i] === ',' && !inQuotes) { result.push(current.trim()); current = '' }
      else { current += line[i] }
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

function buildSummary(source) {
  if (source.contentType === 'csv') {
    const { headers, rows, rowCount } = source.parsed || {}
    const sample = (rows || []).slice(0, 5).map(r =>
      Object.entries(r).filter(([k,v]) => v && k).slice(0, 4).map(([k,v]) => `${k}: ${v}`).join(' | ')
    ).join('\n')
    return `Spreadsheet: ${source.label}\nColumns: ${(headers||[]).filter(h=>h).join(', ')}\nRows: ${rowCount}\nSample:\n${sample}`
  }
  if (source.contentType === 'text') {
    return `Document: ${source.label}\nContent preview:\n${source.rawContent?.slice(0, 800)}`
  }
  return ''
}

// ── Run all ───────────────────────────────────────────────────────────────────
async function main() {
  log('Starting data refresh...')
  await Promise.all([
    fetchNotionTasks(),
    fetchNotionContent(),
    fetchGoogleCalendar(),
    fetchDriveSources(),
  ])
  log('Done.')
}

main().catch(err => { console.error(err); process.exit(1) })
