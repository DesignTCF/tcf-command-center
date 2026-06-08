/**
 * drive-tasks.js
 * Replaces Notion as the task/to-do source.
 * Reads Google Drive docs & sheets and returns structured tasks.
 *
 * Primary sources (auto-read on every sync):
 *   1. TCF to-do List          — Google Doc  (checkbox items)
 *   2. Katherine's Notes       — Google Doc  (checkbox items)
 *   3. Salt Spa Action Items   — Spreadsheet (structured CSV)
 *   4. Action Items Class/Retail — Google Doc (numbered list)
 *
 * Additional sources can be added via POST /api/drive-tasks/sources
 */

const express = require('express')
const router = express.Router()
const { google } = require('googleapis')
const fs = require('fs')
const path = require('path')

const TOKENS_FILE  = path.join(__dirname, '../../data/drive-tokens.json')
const SOURCES_FILE = path.join(__dirname, '../../data/drive-task-sources.json')

// ── Default Drive file sources ───────────────────────────────────────────────
const DEFAULT_SOURCES = [
  { id: '1ofvcpceHYsEt7I-dwZXA78YycDH0WsdhlbUVlI0lYJA', name: 'TCF to-do List',            type: 'doc',   account: 'design@thecosmeticformulary.com' },
  { id: '1hg66MmORP86JiuprbWGV0d3r480A31mCpm47GBYcnxM', name: "Katherine's Notes",          type: 'doc',   account: 'design@thecosmeticformulary.com' },
  { id: '1iPMeoBklpr90wV553ZGnYCsKqsmk4Jb9ww6kK-TXGjI', name: 'Salt Spa Action Items',     type: 'sheet', account: 'design@thecosmeticformulary.com' },
  { id: '1IU3mAtJVSA1wO_xK8-3jwPlHxEe8xNWPruZgFvbXLcw', name: 'Action Items – Class & Retail', type: 'doc', account: 'design@thecosmeticformulary.com' },
]

function readSources() {
  try { return JSON.parse(fs.readFileSync(SOURCES_FILE, 'utf8')) } catch { return DEFAULT_SOURCES }
}
function writeSources(data) {
  fs.writeFileSync(SOURCES_FILE, JSON.stringify(data, null, 2))
}

// ── Auth helpers ─────────────────────────────────────────────────────────────
const ACCOUNTS = (process.env.GMAIL_ACCOUNTS || '').split(',').map(a => a.trim()).filter(Boolean)

function readTokens() {
  try { return JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf8')) } catch { return {} }
}

function getAuth(email) {
  const tokens = readTokens()
  const t = tokens[email]
  if (!t?.refresh_token) return null
  const auth = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    process.env.DRIVE_REDIRECT_URI || 'http://localhost:3001/auth/drive/callback'
  )
  auth.setCredentials({ access_token: t.access_token, refresh_token: t.refresh_token, expiry_date: t.expiry_date })
  return auth
}

function getFirstConnectedAuth() {
  const tokens = readTokens()
  for (const email of ACCOUNTS) {
    if (tokens[email]?.refresh_token) return getAuth(email)
  }
  return null
}

// ── Parsers ───────────────────────────────────────────────────────────────────

/** Parse a Google Doc text export for checkbox-style tasks and numbered items */
function parseDocTasks(text, sourceName) {
  const tasks = []
  let currentGroup = sourceName
  let id = 0

  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line) continue

    // Heading (non-checkbox, non-bullet, short line) → update group context
    if (!line.startsWith('*') && !line.startsWith('-') && !line.match(/^\[/) && !line.match(/^\d+\./) && line.length < 80 && line.length > 2) {
      currentGroup = line.replace(/^#+\s*/, '').trim()
      continue
    }

    // Checkbox-style: [ ] or [x] or * [ ] or - [ ]
    const checkMatch = line.match(/^[\*\-]?\s*\[([xX ]?)\]\s+(.+)$/)
    if (checkMatch) {
      const done = checkMatch[1].toLowerCase() === 'x'
      const title = checkMatch[2].trim()
      if (title.length < 3) continue
      tasks.push({
        id: `drive-${sourceName.replace(/\s+/g,'-').toLowerCase()}-${++id}`,
        title,
        status: done ? 'Done' : 'Not started',
        done,
        group: currentGroup,
        source: 'drive',
        sourceName,
        dueDate: null,
        url: null,
      })
      continue
    }

    // Numbered list: 1. Task text (Owner / Deadline)
    const numMatch = line.match(/^(\d+)\.\s+(.+)$/)
    if (numMatch) {
      const title = numMatch[2].replace(/\(.*?\)/g, '').trim()
      if (title.length < 3) continue
      // Extract owner if present in parens
      const ownerMatch = numMatch[2].match(/\(([^)]+)\)/)
      tasks.push({
        id: `drive-${sourceName.replace(/\s+/g,'-').toLowerCase()}-${++id}`,
        title,
        status: 'Not started',
        done: false,
        group: currentGroup,
        source: 'drive',
        sourceName,
        assignee: ownerMatch ? ownerMatch[1] : null,
        dueDate: null,
        url: null,
      })
    }
  }

  return tasks
}

/** Parse a spreadsheet CSV export (Salt Spa Action Items style) */
function parseSheetTasks(csv, sourceName) {
  const lines = csv.split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length < 2) return []

  const headers = lines[0].split(',').map(h => h.replace(/"/g,'').trim().toLowerCase())
  const tasks = []
  let lastCategory = sourceName
  let id = 0

  for (let i = 1; i < lines.length; i++) {
    // Simple CSV parse (handles basic quoted fields)
    const cols = lines[i].match(/(".*?"|[^,]+|(?<=,)(?=,)|(?<=,)$|^(?=,))/g) || lines[i].split(',')
    const row = {}
    headers.forEach((h, idx) => {
      row[h] = (cols[idx] || '').replace(/^"|"$/g,'').trim()
    })

    const action = row['action'] || row['task'] || row['item'] || ''
    if (!action || action.length < 3) continue

    if (row['category'] && row['category'].length > 1) lastCategory = row['category']

    const rawStatus = (row['status'] || '').toLowerCase()
    const done = rawStatus.includes('complete') || rawStatus.includes('done')

    tasks.push({
      id: `drive-${sourceName.replace(/\s+/g,'-').toLowerCase()}-${++id}`,
      title: action,
      status: row['status'] || 'Not started',
      done,
      group: lastCategory,
      source: 'drive',
      sourceName,
      assignee: row['owner'] || null,
      dueDate: row['deadline'] || row['due date'] || row['due'] || null,
      priority: row['priority'] || null,
      notes: row['notes'] || null,
      url: null,
    })
  }

  return tasks
}

// ── Fetch a single Drive file as text ────────────────────────────────────────
async function fetchFileText(fileId, accountEmail) {
  const email = accountEmail || ACCOUNTS[0]
  const auth = getAuth(email) || getFirstConnectedAuth()
  if (!auth) throw new Error('No connected Drive account')

  const drive = google.drive({ version: 'v3', auth })

  const meta = await drive.files.get({ fileId, fields: 'id,name,mimeType,modifiedTime,webViewLink' })
  const { mimeType, name, webViewLink, modifiedTime } = meta.data

  let content = ''
  let contentType = 'unknown'

  if (mimeType === 'application/vnd.google-apps.document') {
    const res = await drive.files.export({ fileId, mimeType: 'text/plain' }, { responseType: 'text' })
    content = res.data
    contentType = 'doc'
  } else if (mimeType === 'application/vnd.google-apps.spreadsheet') {
    const res = await drive.files.export({ fileId, mimeType: 'text/csv' }, { responseType: 'text' })
    content = res.data
    contentType = 'sheet'
  } else {
    throw new Error(`Unsupported file type: ${mimeType}`)
  }

  return { name, content, contentType, url: webViewLink, modified: modifiedTime }
}

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /api/drive-tasks/tasks — fetch and return all tasks from all Drive sources
router.get('/tasks', async (req, res) => {
  const sources = readSources()
  const allTasks = []
  const errors = []

  await Promise.all(sources.map(async source => {
    try {
      const { content, contentType, url, name } = await fetchFileText(source.id, source.account)
      const tasks = contentType === 'sheet'
        ? parseSheetTasks(content, source.name || name)
        : parseDocTasks(content, source.name || name)

      // Attach the Drive URL to each task
      tasks.forEach(t => { t.url = url; t.fileId = source.id })
      allTasks.push(...tasks)
    } catch (err) {
      errors.push({ source: source.name, error: err.message })
    }
  }))

  res.json({ tasks: allTasks, errors, sources: sources.map(s => s.name) })
})

// GET /api/drive-tasks/tasks/flat — returns flat array (Notion-compatible shape)
router.get('/tasks/flat', async (req, res) => {
  const sources = readSources()
  const allTasks = []

  await Promise.all(sources.map(async source => {
    try {
      const { content, contentType, url, name } = await fetchFileText(source.id, source.account)
      const tasks = contentType === 'sheet'
        ? parseSheetTasks(content, source.name || name)
        : parseDocTasks(content, source.name || name)
      tasks.forEach(t => { t.url = url; t.fileId = source.id })
      allTasks.push(...tasks)
    } catch { /* skip failed source */ }
  }))

  res.json(allTasks)
})

// GET /api/drive-tasks/sources — list configured sources
router.get('/sources', (req, res) => res.json(readSources()))

// POST /api/drive-tasks/sources — add a new Drive file as a task source
router.post('/sources', async (req, res) => {
  const { fileId, account, name } = req.body
  if (!fileId) return res.status(400).json({ error: 'fileId required' })

  try {
    // Validate the file is accessible and get its name
    const auth = getAuth(account || ACCOUNTS[0]) || getFirstConnectedAuth()
    if (!auth) return res.status(400).json({ error: 'No connected Drive account' })
    const drive = google.drive({ version: 'v3', auth })
    const meta = await drive.files.get({ fileId, fields: 'id,name,mimeType' })
    const { mimeType } = meta.data
    if (!mimeType.includes('document') && !mimeType.includes('spreadsheet')) {
      return res.status(400).json({ error: 'File must be a Google Doc or Sheet' })
    }
    const type = mimeType.includes('spreadsheet') ? 'sheet' : 'doc'
    const sources = readSources()
    if (sources.find(s => s.id === fileId)) return res.json({ ok: true, message: 'Already added' })
    sources.push({ id: fileId, name: name || meta.data.name, type, account: account || ACCOUNTS[0] })
    writeSources(sources)
    res.json({ ok: true, name: meta.data.name, type })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/drive-tasks/sources/:fileId — remove a source
router.delete('/sources/:fileId', (req, res) => {
  const sources = readSources().filter(s => s.id !== req.params.fileId)
  writeSources(sources)
  res.json({ ok: true })
})

// POST /api/drive-tasks/tasks — create a task by appending to TCF to-do List
router.post('/tasks', async (req, res) => {
  const { title, group } = req.body
  if (!title) return res.status(400).json({ error: 'title required' })

  const TODO_FILE_ID = '1ofvcpceHYsEt7I-dwZXA78YycDH0WsdhlbUVlI0lYJA'
  try {
    const auth = getAuth('design@thecosmeticformulary.com') || getFirstConnectedAuth()
    if (!auth) return res.status(400).json({ error: 'No connected Drive account' })

    const docs = google.docs({ version: 'v1', auth })
    const doc = await docs.documents.get({ documentId: TODO_FILE_ID })
    const endIndex = doc.data.body.content.slice(-1)[0]?.endIndex - 1 || 1

    const newLine = group ? `\n${group}\n* [ ] ${title}` : `\n* [ ] ${title}`
    await docs.documents.batchUpdate({
      documentId: TODO_FILE_ID,
      requestBody: {
        requests: [{ insertText: { location: { index: endIndex }, text: newLine } }],
      },
    })

    res.json({ ok: true, title, message: 'Added to TCF to-do List in Drive' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
