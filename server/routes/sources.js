const express = require('express')
const router = express.Router()
const fs = require('fs')
const path = require('path')

const SOURCES_FILE = path.join(__dirname, '../../data/sources.json')

function readSources() {
  try { return JSON.parse(fs.readFileSync(SOURCES_FILE, 'utf8')) } catch { return [] }
}
function writeSources(data) {
  fs.writeFileSync(SOURCES_FILE, JSON.stringify(data, null, 2))
}

function extractFileId(url) {
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/)
  return match ? match[1] : null
}

function detectType(url) {
  if (url.includes('/spreadsheets/')) return 'sheet'
  if (url.includes('/document/')) return 'doc'
  if (url.includes('/presentation/')) return 'slides'
  return 'unknown'
}

async function fetchContent(fileId, type, sheetName) {
  const fetch = require('node-fetch')

  if (type === 'sheet') {
    // Try to get all sheets as CSV
    let url = `https://docs.google.com/spreadsheets/d/${fileId}/export?format=csv`
    if (sheetName) url += `&sheet=${encodeURIComponent(sheetName)}`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Could not access file (${res.status}). Make sure it's set to "Anyone with the link can view"`)
    const csv = await res.text()
    return { raw: csv, type: 'csv' }
  }

  if (type === 'doc') {
    const url = `https://docs.google.com/document/d/${fileId}/export?format=txt`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Could not access document (${res.status})`)
    const text = await res.text()
    return { raw: text, type: 'text' }
  }

  throw new Error('Unsupported file type')
}

function parseCSV(csv) {
  // Parse CSV into structured rows
  const lines = csv.split('\n').filter(l => l.trim())
  if (!lines.length) return { headers: [], rows: [], summary: '' }

  function parseLine(line) {
    const result = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') {
        inQuotes = !inQuotes
      } else if (line[i] === ',' && !inQuotes) {
        result.push(current.trim())
        current = ''
      } else {
        current += line[i]
      }
    }
    result.push(current.trim())
    return result
  }

  const headers = parseLine(lines[0])
  const rows = lines.slice(1).map(l => {
    const vals = parseLine(l)
    const obj = {}
    headers.forEach((h, i) => { if (h) obj[h] = vals[i] || '' })
    return obj
  }).filter(r => Object.values(r).some(v => v))

  return { headers, rows, rowCount: rows.length }
}

function buildSummary(source) {
  if (source.contentType === 'csv') {
    const { headers, rows, rowCount } = source.parsed || {}
    const sampleRows = (rows || []).slice(0, 5).map(r => {
      return Object.entries(r).filter(([k, v]) => v && k).slice(0, 4).map(([k, v]) => `${k}: ${v}`).join(' | ')
    }).join('\n')
    return `Spreadsheet: ${source.label}\nColumns: ${(headers || []).filter(h => h).join(', ')}\nRows: ${rowCount}\nSample:\n${sampleRows}`
  }
  if (source.contentType === 'text') {
    return `Document: ${source.label}\nContent preview:\n${source.rawContent?.slice(0, 800)}`
  }
  return ''
}

// GET /api/sources — list all sources
router.get('/', (req, res) => {
  const sources = readSources()
  // Return without full raw content (too large)
  res.json(sources.map(s => ({
    id: s.id,
    label: s.label,
    url: s.url,
    type: s.type,
    contentType: s.contentType,
    rowCount: s.parsed?.rowCount,
    headers: s.parsed?.headers?.filter(h => h).slice(0, 10),
    lastFetched: s.lastFetched,
    error: s.error,
  })))
})

// GET /api/sources/:id/data — get parsed data for a source
router.get('/:id/data', (req, res) => {
  const sources = readSources()
  const source = sources.find(s => s.id === req.params.id)
  if (!source) return res.status(404).json({ error: 'Not found' })
  res.json({ parsed: source.parsed, rawContent: source.rawContent?.slice(0, 5000) })
})

// POST /api/sources — add a new source
router.post('/', async (req, res) => {
  try {
    const { url, label } = req.body
    if (!url) return res.status(400).json({ error: 'URL required' })

    const fileId = extractFileId(url)
    if (!fileId) return res.status(400).json({ error: 'Could not extract file ID from URL. Make sure it is a Google Drive link.' })

    const type = detectType(url)
    if (type === 'unknown') return res.status(400).json({ error: 'Only Google Sheets and Google Docs are supported.' })

    const id = Date.now().toString(36)
    const source = {
      id,
      label: label || 'Untitled Source',
      url,
      fileId,
      type,
      createdAt: new Date().toISOString(),
      lastFetched: null,
      rawContent: null,
      parsed: null,
      error: null,
    }

    // Fetch content immediately
    const { raw, type: contentType } = await fetchContent(fileId, type)
    source.rawContent = raw
    source.contentType = contentType
    source.lastFetched = new Date().toISOString()

    if (contentType === 'csv') {
      source.parsed = parseCSV(raw)
    }

    source.summary = buildSummary(source)

    const sources = readSources()
    sources.push(source)
    writeSources(sources)

    res.json({
      id: source.id,
      label: source.label,
      type: source.type,
      contentType: source.contentType,
      rowCount: source.parsed?.rowCount,
      headers: source.parsed?.headers?.filter(h => h).slice(0, 10),
      lastFetched: source.lastFetched,
    })
  } catch (err) {
    console.error('Sources error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/sources/:id/refresh — re-fetch a source
router.post('/:id/refresh', async (req, res) => {
  try {
    const sources = readSources()
    const idx = sources.findIndex(s => s.id === req.params.id)
    if (idx === -1) return res.status(404).json({ error: 'Not found' })

    const source = sources[idx]
    const { raw, type: contentType } = await fetchContent(source.fileId, source.type)
    source.rawContent = raw
    source.contentType = contentType
    source.lastFetched = new Date().toISOString()
    source.error = null

    if (contentType === 'csv') {
      source.parsed = parseCSV(raw)
    }
    source.summary = buildSummary(source)

    sources[idx] = source
    writeSources(sources)

    res.json({ ok: true, lastFetched: source.lastFetched, rowCount: source.parsed?.rowCount })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/sources/:id
router.delete('/:id', (req, res) => {
  const sources = readSources().filter(s => s.id !== req.params.id)
  writeSources(sources)
  res.json({ ok: true })
})

// GET /api/sources/context — full text context for AI
router.get('/ai-context', (req, res) => {
  const sources = readSources()
  const context = sources.map(s => s.summary || '').filter(Boolean).join('\n\n---\n\n')
  res.json({ context, count: sources.length })
})

module.exports = router
