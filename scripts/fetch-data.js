#!/usr/bin/env node
// TCF Command Center — live data fetcher.
// Pulls from Google Drive (to-do docs), Google Calendar (iCal), and the
// Supplier Tracker spreadsheet, then writes clean JSON into data/.
// Primary account = katherine@thecosmeticformulary.com.

const fs = require('fs')
const path = require('path')
const https = require('https')
const XLSX = require('xlsx')

// ── Load .env (dotenv optional; manual fallback) ──────────────────────────────
;(function loadEnv() {
  try { require('dotenv').config({ path: path.join(__dirname, '../.env') }); return } catch {}
  try {
    const lines = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8').split('\n')
    for (const line of lines) {
      const t = line.trim()
      if (!t || t.startsWith('#')) continue
      const i = t.indexOf('=')
      if (i < 1) continue
      const k = t.slice(0, i).trim(), v = t.slice(i + 1).trim()
      if (k && !process.env[k]) process.env[k] = v
    }
  } catch {}
})()

const DATA_DIR = path.join(__dirname, '../data')
const KATHERINE = 'katherine@thecosmeticformulary.com'
const DESIGN = 'design@thecosmeticformulary.com'
const log = (m) => console.log(`[fetch] ${m}`)
const write = (file, data) => fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2))

function httpGet(url, headers = {}, binary = false) {
  return new Promise((resolve, reject) => {
    const u = new URL(url)
    https.get({ hostname: u.hostname, path: u.pathname + u.search, headers }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(httpGet(res.headers.location, headers, binary))
      }
      const chunks = []
      res.on('data', d => chunks.push(d))
      res.on('end', () => {
        const buf = Buffer.concat(chunks)
        if (res.statusCode >= 400) reject(new Error(`HTTP ${res.statusCode}: ${buf.toString().slice(0, 200)}`))
        else resolve(binary ? buf : buf.toString('utf8'))
      })
    }).on('error', reject)
  })
}

// ── Google OAuth ──────────────────────────────────────────────────────────────
function getRefreshToken(account) {
  try {
    const tokens = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'drive-tokens.json'), 'utf8'))
    if (tokens[account]?.refresh_token) return tokens[account].refresh_token
  } catch {}
  if (account === KATHERINE) return process.env.KATHERINE_REFRESH_TOKEN || null
  return process.env.DRIVE_REFRESH_TOKEN || null
}

function refreshAccessToken(account) {
  const refreshToken = getRefreshToken(account)
  if (!refreshToken) return Promise.resolve(null)
  return new Promise((resolve, reject) => {
    const body = [
      `client_id=${encodeURIComponent(process.env.GMAIL_CLIENT_ID || '')}`,
      `client_secret=${encodeURIComponent(process.env.GMAIL_CLIENT_SECRET || '')}`,
      `refresh_token=${encodeURIComponent(refreshToken)}`,
      `grant_type=refresh_token`,
    ].join('&')
    const req = https.request({
      hostname: 'oauth2.googleapis.com', path: '/token', method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) },
    }, res => {
      let d = ''
      res.on('data', c => d += c)
      res.on('end', () => { try { resolve(JSON.parse(d)) } catch { reject(new Error('bad token response')) } })
    })
    req.on('error', reject); req.write(body); req.end()
  })
}

const _tokenCache = {}
async function accessTokenFor(account) {
  if (_tokenCache[account]) return _tokenCache[account]
  const res = await refreshAccessToken(account)
  _tokenCache[account] = res?.access_token || null
  return _tokenCache[account]
}

// ── Task parsers ──────────────────────────────────────────────────────────────
const hasWord = (s) => /[a-z0-9]/i.test(s)                 // real content vs pure decoration
const isSubPoint = (s) => /^[→▶▸►▪◦·➤➔]/.test(s)          // arrow/dot lead = detail of the task above

// Parse a to-do doc: ALL-CAPS / short lines become section context (group),
// bullets & numbered lines become tasks, and arrow sub-points (→ …) attach to
// the task above them as details rather than becoming their own tasks.
function parseDocTasks(text, sourceName, sourceUrl) {
  const tasks = []
  let group = null, id = 0, last = null
  const titleUpper = sourceName.toUpperCase()

  for (const raw of text.split('\n')) {
    const line = raw.replace(/﻿/g, '').trim()
    if (!line || !hasWord(line)) continue                  // blank or decoration
    if (line.toUpperCase() === titleUpper) continue        // the doc's own title

    // Checkbox item: [ ] / [x]
    let m = line.match(/^[\*\-•]?\s*\[([xX ]?)\]\s+(.+)$/)
    if (m) {
      const title = m[2].trim()
      if (title.length >= 3 && hasWord(title)) { last = mkTask(++id, sourceName, title, m[1].toLowerCase() === 'x', group, sourceUrl); tasks.push(last) }
      continue
    }

    // Bullet item: * / - / •
    m = line.match(/^[\*\-•]\s+(.+)$/)
    if (m) {
      const content = m[1].trim()
      if (isSubPoint(content)) {                            // sub-point → detail of previous task
        const detail = content.replace(/^[→▶▸►▪◦·➤➔]+\s*/, '').trim()
        if (last && detail) (last.details = last.details || []).push(detail)
        continue
      }
      if (content.length >= 3 && hasWord(content)) { last = mkTask(++id, sourceName, content, false, group, sourceUrl); tasks.push(last) }
      continue
    }

    // Numbered item: 1. / 1)
    m = line.match(/^(\d+)[.)]\s+(.+)$/)
    if (m) {
      const title = m[2].replace(/\(.*?\)/g, '').trim()
      if (title.length >= 3 && hasWord(title)) { last = mkTask(++id, sourceName, title, false, group, sourceUrl); tasks.push(last) }
      continue
    }

    // Standalone arrow line (no bullet) → detail of previous task
    if (isSubPoint(line)) {
      const detail = line.replace(/^[→▶▸►▪◦·➤➔]+\s*/, '').trim()
      if (last && detail) (last.details = last.details || []).push(detail)
      continue
    }

    // Otherwise: a short line is a section header → group context; long prose is ignored.
    if (line.length <= 60) { group = line.replace(/^#+\s*/, '').trim(); last = null }
  }
  return tasks
}

function mkTask(id, sourceName, title, done, group, url) {
  return {
    id: `t-${sourceName.replace(/\s+/g, '-').toLowerCase()}-${id}`,
    title, done, status: done ? 'Done' : 'Open',
    group: group && group !== sourceName ? group : null,
    sourceName, url, dueDate: null, details: undefined,
  }
}

function parseSheetTasks(csv, sourceName, sourceUrl) {
  const lines = csv.split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase())
  const tasks = []; let cat = sourceName, id = 0
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].match(/(".*?"|[^,]+|(?<=,)(?=,)|(?<=,)$|^(?=,))/g) || lines[i].split(',')
    const row = {}; headers.forEach((h, idx) => { row[h] = (cols[idx] || '').replace(/^"|"$/g, '').trim() })
    const action = row['action'] || row['task'] || row['item'] || ''
    if (!action || action.length < 3) continue
    if (row['category']?.length > 1) cat = row['category']
    const done = /complete|done/.test((row['status'] || '').toLowerCase())
    tasks.push({
      id: `t-${sourceName.replace(/\s+/g, '-').toLowerCase()}-${++id}`,
      title: action, done, status: row['status'] || 'Open',
      group: cat, sourceName, url: sourceUrl,
      assignee: row['owner'] || null,
      dueDate: row['deadline'] || row['due date'] || row['due'] || null,
      priority: row['priority'] || null,
    })
  }
  return tasks
}

// ── Tasks: read every doc/sheet in katherine@'s "To Do lists" folder ──────────
// Whatever lives in this folder is what shows on the dashboard — add/remove a
// list in Drive and the dashboard follows. No hardcoded document list.
const TODO_FOLDER_ID = '1DXnEI4EXPKkuOxoCX0qkmwocH6dj26Pr'
// Preferred display order (by title); anything else falls in after, alphabetically.
const TASK_DOC_ORDER = ['THE COSMETIC FORMULARY — MASTER TO-DO LIST', 'NEVOO', 'SIP & FORMULATE + SALT SPA & YOGA']

function docUrl(id) { return `https://docs.google.com/document/d/${id}/edit` }
function sheetUrl(id) { return `https://docs.google.com/spreadsheets/d/${id}/edit` }

async function listFolder(token, folderId) {
  const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`)
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,mimeType,modifiedTime)&pageSize=100`
  const res = await httpGet(url, { Authorization: `Bearer ${token}` })
  return JSON.parse(res).files || []
}

async function fetchTasks() {
  try {
    const token = await accessTokenFor(KATHERINE)
    if (!token) { log('⚠ no katherine@ token — skip tasks'); write('tasks.json', []); return }

    let files = await listFolder(token, TODO_FOLDER_ID)
    files = files
      .filter(f => f.mimeType === 'application/vnd.google-apps.document' || f.mimeType === 'application/vnd.google-apps.spreadsheet')
      .sort((a, b) => {
        const ia = TASK_DOC_ORDER.indexOf(a.name), ib = TASK_DOC_ORDER.indexOf(b.name)
        if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
        return a.name.localeCompare(b.name)
      })

    const all = []
    for (const f of files) {
      try {
        const isSheet = f.mimeType === 'application/vnd.google-apps.spreadsheet'
        const mime = isSheet ? 'text/csv' : 'text/plain'
        const url = `https://www.googleapis.com/drive/v3/files/${f.id}/export?mimeType=${encodeURIComponent(mime)}`
        const content = await httpGet(url, { Authorization: `Bearer ${token}` })
        const fileUrl = isSheet ? sheetUrl(f.id) : docUrl(f.id)
        const tasks = isSheet ? parseSheetTasks(content, f.name, fileUrl) : parseDocTasks(content, f.name, fileUrl)
        all.push(...tasks.map(t => ({ ...t, modifiedTime: f.modifiedTime })))
        log(`✓ "${f.name}": ${tasks.length}`)
      } catch (e) { log(`✗ "${f.name}": ${e.message}`) }
    }
    write('tasks.json', all)
    log(`✓ tasks total: ${all.length} from ${files.length} docs`)
  } catch (e) { log(`✗ tasks: ${e.message}`) }
}

// ── Google Calendar (iCal) ────────────────────────────────────────────────────
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

function parseICS(text) {
  const lines = text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r\n|\n/)
  const events = []; let cur = null
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { cur = {}; continue }
    if (line === 'END:VEVENT') { if (cur) events.push(cur); cur = null; continue }
    if (!cur) continue
    const c = line.indexOf(':'); if (c < 0) continue
    const key = line.slice(0, c).split(';')[0].trim(), val = line.slice(c + 1).trim()
    if (key === 'SUMMARY') cur.title = val
    if (key === 'DTSTART') cur.start = parseICSDate(val)
    if (key === 'DTEND') cur.end = parseICSDate(val)
    if (key === 'LOCATION') cur.location = val
    if (key === 'DESCRIPTION') cur.description = val.replace(/\\n/g, '\n').replace(/\\,/g, ',')
    if (key === 'UID') cur.id = val
  }
  return events
}

async function fetchCalendar() {
  try {
    const feeds = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'gcal-feeds.json'), 'utf8') || '[]')
    const all = []
    for (const feed of feeds) {
      try {
        const ics = await httpGet(feed.url)
        const events = parseICS(ics).map(e => ({
          ...e,
          date: (e.start || '').slice(0, 10),
          calendarName: feed.name || 'Calendar',
          color: feed.color || '#0D9E9E',
        }))
        all.push(...events)
      } catch (e) { log(`✗ calendar "${feed.name}": ${e.message}`) }
    }
    all.sort((a, b) => (a.start || '').localeCompare(b.start || ''))
    write('calendar.json', { events: all, fetchedAt: new Date().toISOString() })
    log(`✓ calendar events: ${all.length}`)
  } catch (e) { log(`✗ calendar: ${e.message}`) }
}

// ── Supplier Tracker (Inventory & Purchasing) ─────────────────────────────────
const SUPPLIER_TRACKER_ID = '1P9yy12GMjJaIpOdM7AcQ5GwWyKpQ77GN'

// Preferred display order + friendly labels for known tabs. Any other tab in the
// workbook (except Dashboard) is still shown — order/label are auto-derived — so
// adding or renaming tabs in the spreadsheet needs no code change.
const TAB_ORDER = ['Packaging Orders', 'Branded Accessories', 'Incoming Samples', 'Planned Orders', 'Supplier Conversations']
const TAB_LABELS = { 'Planned Orders': 'Future / Planned Orders' }
const SKIP_TABS = ['Dashboard']

// Pick the column that best represents a row's "state" for status chips/counts.
function inferStatusKey(columns) {
  const lc = columns.map(c => c.toLowerCase())
  const exact = ['incoming status', 'current status', 'status', 'conversation status', 'production status']
  for (const want of exact) { const i = lc.indexOf(want); if (i >= 0) return columns[i] }
  const i = lc.findIndex(c => c.includes('status')); return i >= 0 ? columns[i] : null
}

function rowIsEmpty(obj) { return !Object.values(obj).some(v => String(v).trim()) }

async function fetchSupplierTracker() {
  try {
    const token = await accessTokenFor(KATHERINE)
    if (!token) { log('⚠ no katherine@ token — skip Supplier Tracker'); return }
    const url = `https://www.googleapis.com/drive/v3/files/${SUPPLIER_TRACKER_ID}?alt=media`
    const buf = await httpGet(url, { Authorization: `Bearer ${token}` }, true)
    const wb = XLSX.read(buf, { type: 'buffer' })

    // Auto-discover tabs: known order first, then any extras (except skipped).
    const present = wb.SheetNames.filter(n => !SKIP_TABS.includes(n))
    const ordered = [
      ...TAB_ORDER.filter(n => present.includes(n)),
      ...present.filter(n => !TAB_ORDER.includes(n)),
    ]

    const tabs = []
    for (const name of ordered) {
      const ws = wb.Sheets[name]
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })
        .filter(r => !rowIsEmpty(r))
        .map(r => {
          const clean = {}
          for (const [k, v] of Object.entries(r)) clean[String(k).trim()] = typeof v === 'string' ? v.trim() : v
          return clean
        })
      const columns = rows.length ? Object.keys(rows[0]) : []
      tabs.push({ key: name, label: TAB_LABELS[name] || name, statusKey: inferStatusKey(columns), columns, rows })
      log(`  · ${TAB_LABELS[name] || name}: ${rows.length} rows`)
    }

    write('inventory.json', {
      trackerUrl: `https://docs.google.com/spreadsheets/d/${SUPPLIER_TRACKER_ID}/edit`,
      tabs,
      fetchedAt: new Date().toISOString(),
    })
    log(`✓ Supplier Tracker: ${tabs.length} tabs`)
  } catch (e) { log(`✗ Supplier Tracker: ${e.message}`) }
}

// ── Run ───────────────────────────────────────────────────────────────────────
async function main() {
  log('Starting refresh…')
  await Promise.all([fetchTasks(), fetchCalendar(), fetchSupplierTracker()])
  log('Done.')
}
main().catch(e => { console.error(e); process.exit(1) })
