#!/usr/bin/env node
// Fetches fresh data from all live sources and writes to data/ JSON files
// Run before each GitHub Pages build to keep static site current

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

// ── Google OAuth token refresh ────────────────────────────────────────────────
async function refreshAccessToken() {
  const refreshToken = process.env.DRIVE_REFRESH_TOKEN
  if (!refreshToken) return null

  return new Promise((resolve, reject) => {
    const body = [
      `client_id=${encodeURIComponent(process.env.GMAIL_CLIENT_ID || '')}`,
      `client_secret=${encodeURIComponent(process.env.GMAIL_CLIENT_SECRET || '')}`,
      `refresh_token=${encodeURIComponent(refreshToken)}`,
      `grant_type=refresh_token`,
    ].join('&')

    const req = https.request({
      hostname: 'oauth2.googleapis.com',
      path: '/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      },
    }, res => {
      let data = ''
      res.on('data', d => data += d)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) } catch { reject(new Error('Invalid token response')) }
      })
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

// ── Drive task parsers (mirrors server/routes/drive-tasks.js) ─────────────────

function parseDocTasks(text, sourceName, sourceUrl) {
  const tasks = []
  let currentGroup = sourceName
  let id = 0

  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line) continue

    // Headings become group context
    if (!line.startsWith('*') && !line.startsWith('-') && !line.match(/^\[/) && !line.match(/^\d+\./) && line.length < 80 && line.length > 2) {
      currentGroup = line.replace(/^#+\s*/, '').trim()
      continue
    }

    // Checkbox: [ ] or [x]
    const checkMatch = line.match(/^[\*\-]?\s*\[([xX ]?)\]\s+(.+)$/)
    if (checkMatch) {
      const done = checkMatch[1].toLowerCase() === 'x'
      const title = checkMatch[2].trim()
      if (title.length < 3) continue
      tasks.push({
        id: `drive-${sourceName.replace(/\s+/g, '-').toLowerCase()}-${++id}`,
        title, status: done ? 'Done' : 'Not started', done,
        group: currentGroup, source: 'drive', sourceName,
        dueDate: null, url: sourceUrl,
      })
      continue
    }

    // Numbered list: 1. Task text
    const numMatch = line.match(/^(\d+)\.\s+(.+)$/)
    if (numMatch) {
      const raw2 = numMatch[2]
      const title = raw2.replace(/\(.*?\)/g, '').trim()
      if (title.length < 3) continue
      const ownerMatch = raw2.match(/\(([^)]+)\)/)
      tasks.push({
        id: `drive-${sourceName.replace(/\s+/g, '-').toLowerCase()}-${++id}`,
        title, status: 'Not started', done: false,
        group: currentGroup, source: 'drive', sourceName,
        assignee: ownerMatch ? ownerMatch[1] : null,
        dueDate: null, url: sourceUrl,
      })
    }
  }
  return tasks
}

function parseSheetTasks(csv, sourceName, sourceUrl) {
  const lines = csv.split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length < 2) return []

  const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase())
  const tasks = []
  let lastCategory = sourceName
  let id = 0

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].match(/(".*?"|[^,]+|(?<=,)(?=,)|(?<=,)$|^(?=,))/g) || lines[i].split(',')
    const row = {}
    headers.forEach((h, idx) => { row[h] = (cols[idx] || '').replace(/^"|"$/g, '').trim() })

    const action = row['action'] || row['task'] || row['item'] || ''
    if (!action || action.length < 3) continue
    if (row['category'] && row['category'].length > 1) lastCategory = row['category']

    const rawStatus = (row['status'] || '').toLowerCase()
    const done = rawStatus.includes('complete') || rawStatus.includes('done')

    tasks.push({
      id: `drive-${sourceName.replace(/\s+/g, '-').toLowerCase()}-${++id}`,
      title: action, status: row['status'] || 'Not started', done,
      group: lastCategory, source: 'drive', sourceName,
      assignee: row['owner'] || null,
      dueDate: row['deadline'] || row['due date'] || row['due'] || null,
      priority: row['priority'] || null,
      notes: row['notes'] || null,
      url: sourceUrl,
    })
  }
  return tasks
}

// ── Drive Tasks ───────────────────────────────────────────────────────────────
const DRIVE_SOURCES = [
  { id: '1ofvcpceHYsEt7I-dwZXA78YycDH0WsdhlbUVlI0lYJA', name: 'TCF to-do List',             type: 'doc',   url: 'https://docs.google.com/document/d/1ofvcpceHYsEt7I-dwZXA78YycDH0WsdhlbUVlI0lYJA/edit' },
  { id: '1hg66MmORP86JiuprbWGV0d3r480A31mCpm47GBYcnxM', name: "Katherine's Notes",           type: 'doc',   url: 'https://docs.google.com/document/d/1hg66MmORP86JiuprbWGV0d3r480A31mCpm47GBYcnxM/edit' },
  { id: '1iPMeoBklpr90wV553ZGnYCsKqsmk4Jb9ww6kK-TXGjI', name: 'Salt Spa Action Items',      type: 'sheet', url: 'https://docs.google.com/spreadsheets/d/1iPMeoBklpr90wV553ZGnYCsKqsmk4Jb9ww6kK-TXGjI/edit' },
  { id: '1IU3mAtJVSA1wO_xK8-3jwPlHxEe8xNWPruZgFvbXLcw', name: 'Action Items – Class & Retail', type: 'doc', url: 'https://docs.google.com/document/d/1IU3mAtJVSA1wO_xK8-3jwPlHxEe8xNWPruZgFvbXLcw/edit' },
]

async function fetchDriveTasks() {
  try {
    const tokenRes = await refreshAccessToken()
    if (!tokenRes?.access_token) {
      log('⚠ DRIVE_REFRESH_TOKEN not set — skipping Drive task fetch')
      return
    }
    const accessToken = tokenRes.access_token

    const allTasks = []
    for (const source of DRIVE_SOURCES) {
      try {
        const mimeType = source.type === 'sheet' ? 'text/csv' : 'text/plain'
        const exportUrl = `https://www.googleapis.com/drive/v3/files/${source.id}/export?mimeType=${encodeURIComponent(mimeType)}`
        const content = await httpGet(exportUrl, { 'Authorization': `Bearer ${accessToken}` })
        const tasks = source.type === 'sheet'
          ? parseSheetTasks(content, source.name, source.url)
          : parseDocTasks(content, source.name, source.url)
        allTasks.push(...tasks)
        log(`✓ "${source.name}": ${tasks.length} tasks`)
      } catch (err) {
        log(`✗ "${source.name}": ${err.message}`)
      }
    }

    write('drive-tasks.json', allTasks)
    log(`✓ Drive tasks total: ${allTasks.length}`)
  } catch (err) {
    log(`✗ Drive tasks: ${err.message}`)
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
    const d = str.replace('Z', '')
    return new Date(`${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}T${d.slice(9,11)}:${d.slice(11,13)}:${d.slice(13,15)}${str.endsWith('Z') ? 'Z' : ''}`).toISOString()
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
        if (contentType === 'csv') source.parsed = parseCSV(raw)
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
      Object.entries(r).filter(([k, v]) => v && k).slice(0, 4).map(([k, v]) => `${k}: ${v}`).join(' | ')
    ).join('\n')
    return `Spreadsheet: ${source.label}\nColumns: ${(headers || []).filter(h => h).join(', ')}\nRows: ${rowCount}\nSample:\n${sample}`
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
    fetchDriveTasks(),
    fetchGoogleCalendar(),
    fetchDriveSources(),
  ])
  log('Done.')
}

main().catch(err => { console.error(err); process.exit(1) })
