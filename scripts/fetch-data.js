#!/usr/bin/env node
// Fetches fresh data from all live sources and writes to data/ JSON files
// Run before each GitHub Pages build to keep static site current

try { require('dotenv').config({ path: '../.env' }) } catch {}
const fs   = require('fs')
const path = require('path')
const https = require('https')

const DATA_DIR = path.join(__dirname, '../data')
const log   = (msg) => console.log(`[fetch-data] ${msg}`)
const write = (file, data) => fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2))

// ── Notion SDK (from server/node_modules — proven to work) ────────────────────
function getNotionClient() {
  const token = process.env.NOTION_TOKEN
  if (!token) throw new Error('NOTION_TOKEN not set')
  const { Client } = require(path.join(__dirname, '../server/node_modules/@notionhq/client'))
  return new Client({ auth: token })
}

function getText(prop) {
  if (!prop) return ''
  if (prop.title)      return prop.title.map(t => t.plain_text).join('')
  if (prop.rich_text)  return prop.rich_text.map(t => t.plain_text).join('')
  return ''
}

function blockText(block) {
  const data = block[block.type] || {}
  return (data.rich_text || []).map(t => t.plain_text).join('')
}

async function fetchAllPages(notion, database_id, sorts = []) {
  const pages = []
  let cursor
  do {
    const res = await notion.databases.query({
      database_id, sorts, page_size: 100,
      ...(cursor ? { start_cursor: cursor } : {}),
    })
    pages.push(...res.results)
    cursor = res.has_more ? res.next_cursor : undefined
  } while (cursor)
  return pages
}

async function fetchBlocks(notion, block_id, depth = 0) {
  if (depth > 2) return []
  try {
    const res = await notion.blocks.children.list({ block_id, page_size: 100 })
    return await Promise.all((res.results || []).map(async block => {
      const type = block.type
      const data = block[type] || {}
      const item = {
        id: block.id,
        type,
        text: (data.rich_text || []).map(t => t.plain_text).join(''),
        checked: data.checked || false,
        hasChildren: block.has_children || false,
        children: [],
      }
      if (block.has_children && depth < 2) {
        item.children = await fetchBlocks(notion, block.id, depth + 1)
      }
      return item
    }))
  } catch { return [] }
}

// ── Notion Tasks (with full block content) ────────────────────────────────────
async function fetchNotionTasks() {
  try {
    const notion = getNotionClient()
    const dbId = process.env.NOTION_TODO_DB_ID || '33716212-4ddd-809c-9ca1-c6a649bca6e4'

    const pages = await fetchAllPages(notion, dbId, [
      { timestamp: 'last_edited_time', direction: 'descending' }
    ])

    // Fetch block children for every page in parallel
    const tasks = await Promise.all(pages.map(async page => {
      const props = page.properties || {}
      const titleProp = props['Task name'] || props['Name'] || props['Title'] ||
        Object.values(props).find(p => p.type === 'title')
      const statusVal  = props['Status']
      const statusName = statusVal?.status?.name || statusVal?.select?.name || ''
      const done = ['done', 'complete', 'completed'].includes(statusName.toLowerCase())

      const blocks = await fetchBlocks(notion, page.id)

      return {
        id:          page.id,
        title:       getText(titleProp),
        status:      statusName,
        dueDate:     props['Due date']?.date?.start || props['Due Date']?.date?.start || null,
        assignee:    (props['Assignee']?.people || []).map(p => p.name).join(', '),
        url:         page.url,
        lastEdited:  page.last_edited_time,
        done,
        source:      'notion',
        blocks,
      }
    }))

    write('notion-tasks.json', tasks)
    const open     = tasks.filter(t => !t.done)
    const todoDone = tasks.reduce((n,t) => n + (t.blocks||[]).filter(b=>b.type==='to_do'&&!b.checked).length, 0)
    log(`✓ Notion tasks: ${tasks.length} sections, ${open.length} open, ${todoDone} unchecked to-dos`)
  } catch (err) {
    log(`✗ Notion tasks FAILED: ${err.message}`)
    write('notion-tasks.json', [])
  }
}

// ── Notion Content Calendar ───────────────────────────────────────────────────
async function fetchNotionContent() {
  try {
    const notion = getNotionClient()
    const CONTENT_DB_ID = '34116212-4ddd-80a4-8b44-fe0a634c2ef2'

    const pages = await fetchAllPages(notion, CONTENT_DB_ID, [
      { property: 'Publish date', direction: 'descending' }
    ])

    const content = pages.map(page => {
      const props = page.properties || {}
      const titleProp = props['Content name'] || props['Name'] ||
        Object.values(props).find(p => p.type === 'title')
      return {
        id:          page.id,
        title:       getText(titleProp),
        status:      props['Status']?.select?.name || '',
        platform:    (props['Platform']?.multi_select || []).map(s => s.name),
        contentType: props['Content type']?.select?.name || '',
        publishDate: props['Publish date']?.date?.start || null,
        url:         page.url,
      }
    })

    write('notion-content.json', content)
    log(`✓ Notion content: ${content.length}`)
  } catch (err) {
    log(`✗ Notion content FAILED: ${err.message}`)
  }
}

// ── Google Calendar (iCal) ────────────────────────────────────────────────────
function httpGet(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url)
    https.get({ hostname: u.hostname, path: u.pathname + u.search }, res => {
      let body = ''
      res.on('data', d => body += d)
      res.on('end', () => {
        if (res.statusCode >= 400) reject(new Error(`HTTP ${res.statusCode}`))
        else resolve(body)
      })
    }).on('error', reject)
  })
}

function parseICS(text) {
  const lines = text.replace(/\r\n[ \t]/g,'').replace(/\n[ \t]/g,'').split(/\r\n|\n/)
  const events = []; let cur = null
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { cur = {}; continue }
    if (line === 'END:VEVENT')   { if (cur) events.push(cur); cur = null; continue }
    if (!cur) continue
    const ci = line.indexOf(':')
    if (ci < 0) continue
    const key = line.slice(0,ci).split(';')[0].trim()
    const val = line.slice(ci+1).trim()
    if (key==='SUMMARY')     cur.title       = val
    if (key==='DTSTART')     cur.start       = parseICSDate(line.slice(ci+1).trim())
    if (key==='DTEND')       cur.end         = parseICSDate(line.slice(ci+1).trim())
    if (key==='DESCRIPTION') cur.description = val
    if (key==='UID')         cur.uid         = val
  }
  return events.filter(e=>e.title&&e.start).sort((a,b)=>(a.start||'').localeCompare(b.start||''))
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

async function fetchGoogleCalendar() {
  try {
    const feedsFile = path.join(DATA_DIR, 'gcal-feeds.json')
    const feeds = JSON.parse(fs.readFileSync(feedsFile,'utf8') || '[]')
    if (!feeds.length) return
    const allEvents = []
    for (const feed of feeds) {
      try {
        const ics = await httpGet(feed.url)
        allEvents.push(...parseICS(ics).map(e => ({ ...e, calendarName: feed.name || 'Calendar' })))
      } catch (err) { log(`✗ Calendar feed "${feed.name}": ${err.message}`) }
    }
    write('gcal-cache.json', { events: allEvents, fetchedAt: new Date().toISOString() })
    log(`✓ Calendar events: ${allEvents.length}`)
  } catch (err) { log(`✗ Calendar: ${err.message}`) }
}

// ── Google Drive Sources (public share links) ─────────────────────────────────
function parseCSV(csv) {
  const lines = csv.split('\n').filter(l=>l.trim())
  if (!lines.length) return { headers:[], rows:[], rowCount:0 }
  function parseLine(line) {
    const r=[]; let c=''; let q=false
    for (const ch of line) {
      if (ch==='"') { q=!q }
      else if (ch===','&&!q) { r.push(c.trim()); c='' }
      else { c+=ch }
    }
    r.push(c.trim()); return r
  }
  const headers = parseLine(lines[0])
  const rows = lines.slice(1).map(l=>{
    const vals=parseLine(l); const obj={}
    headers.forEach((h,i)=>{ if(h) obj[h]=vals[i]||'' })
    return obj
  }).filter(r=>Object.values(r).some(v=>v))
  return { headers, rows, rowCount: rows.length }
}

async function fetchDriveSources() {
  try {
    const sourcesFile = path.join(DATA_DIR, 'sources.json')
    const sources = JSON.parse(fs.readFileSync(sourcesFile,'utf8') || '[]')
    if (!sources.length) return
    let updated = 0
    for (const source of sources) {
      try {
        let raw, contentType
        if (source.type === 'sheet') {
          raw = await httpGet(`https://docs.google.com/spreadsheets/d/${source.fileId}/export?format=csv`)
          contentType = 'csv'
        } else if (source.type === 'doc') {
          raw = await httpGet(`https://docs.google.com/document/d/${source.fileId}/export?format=txt`)
          contentType = 'text'
        } else continue
        source.rawContent = raw; source.contentType = contentType
        source.lastFetched = new Date().toISOString(); source.error = null
        if (contentType === 'csv') source.parsed = parseCSV(raw)
        const {headers,rows,rowCount} = source.parsed || {}
        source.summary = contentType==='csv'
          ? `Spreadsheet: ${source.label}\nColumns: ${(headers||[]).filter(h=>h).join(', ')}\nRows: ${rowCount}`
          : `Document: ${source.label}\nContent preview:\n${raw?.slice(0,800)}`
        updated++
      } catch (err) { source.error = err.message; log(`✗ Source "${source.label}": ${err.message}`) }
    }
    write('sources.json', sources)
    log(`✓ Drive sources refreshed: ${updated}/${sources.length}`)
  } catch (err) { log(`✗ Drive sources: ${err.message}`) }
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
