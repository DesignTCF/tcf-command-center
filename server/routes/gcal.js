const express = require('express')
const router = express.Router()
const fs = require('fs')
const path = require('path')

const FEEDS_FILE = path.join(__dirname, '../../data/gcal-feeds.json')
const CACHE_FILE = path.join(__dirname, '../../data/gcal-cache.json')

function readFeeds() {
  try { return JSON.parse(fs.readFileSync(FEEDS_FILE, 'utf8')) } catch { return [] }
}

function readCache() {
  try { return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')) } catch { return {} }
}

function writeCache(data) {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2))
}

// Parse ICS date string → ISO string
function parseICSDate(str) {
  if (!str) return null
  str = str.trim()
  // All-day: 20260615
  if (/^\d{8}$/.test(str)) {
    return `${str.slice(0,4)}-${str.slice(4,6)}-${str.slice(6,8)}`
  }
  // Timed: 20260615T143000Z or 20260615T143000
  if (/^\d{8}T\d{6}/.test(str)) {
    const d = str.replace('Z','')
    return new Date(
      `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}T${d.slice(9,11)}:${d.slice(11,13)}:${d.slice(13,15)}${str.endsWith('Z') ? 'Z' : ''}`
    ).toISOString()
  }
  return str
}

// Unfold ICS lines (continuation lines start with space/tab)
function unfoldICS(text) {
  return text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '')
}

// Parse ICS text → array of events
function parseICS(text) {
  const unfolded = unfoldICS(text)
  const lines = unfolded.split(/\r\n|\n/)
  const events = []
  let current = null

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      current = {}
    } else if (line === 'END:VEVENT' && current) {
      events.push(current)
      current = null
    } else if (current) {
      const colonIdx = line.indexOf(':')
      if (colonIdx === -1) continue
      const key = line.slice(0, colonIdx).split(';')[0].trim()
      const val = line.slice(colonIdx + 1).trim()
        .replace(/\\n/g, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\')

      switch (key) {
        case 'SUMMARY':     current.title = val; break
        case 'DTSTART':     current.start = parseICSDate(line.slice(colonIdx + 1).trim()); break
        case 'DTEND':       current.end = parseICSDate(line.slice(colonIdx + 1).trim()); break
        case 'DESCRIPTION': current.description = val; break
        case 'LOCATION':    current.location = val; break
        case 'UID':         current.uid = val; break
        case 'STATUS':      current.status = val; break
        case 'URL':         current.url = val; break
      }
    }
  }

  return events
    .filter(e => e.title && e.start)
    .sort((a, b) => (a.start || '').localeCompare(b.start || ''))
}

// Fetch and parse a single feed
async function fetchFeed(feed) {
  const fetch = require('node-fetch')
  const res = await fetch(feed.url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const text = await res.text()
  const events = parseICS(text)
  return events.map(e => ({
    ...e,
    feedId: feed.id,
    feedName: feed.name,
    feedColor: feed.color,
    source: 'gcal',
  }))
}

// GET /api/gcal/events — all events from all feeds
router.get('/events', async (req, res) => {
  try {
    const feeds = readFeeds()
    const cache = readCache()
    const allEvents = []
    const updated = { ...cache }

    for (const feed of feeds) {
      try {
        const events = await fetchFeed(feed)
        updated[feed.id] = { events, lastFetched: new Date().toISOString() }
        allEvents.push(...events)
        console.log(`GCal: ${feed.name} — ${events.length} events`)
      } catch (err) {
        // Use cached data if fetch fails
        if (cache[feed.id]?.events) allEvents.push(...cache[feed.id].events)
        console.warn(`GCal fetch failed for ${feed.id}: ${err.message}`)
      }
    }

    writeCache(updated)
    res.json({ events: allEvents, feeds: feeds.length, lastFetched: new Date().toISOString() })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/gcal/feeds — list connected calendars
router.get('/feeds', (req, res) => {
  const feeds = readFeeds()
  const cache = readCache()
  res.json(feeds.map(f => ({
    ...f,
    lastFetched: cache[f.id]?.lastFetched || null,
    eventCount: cache[f.id]?.events?.length || 0,
  })))
})

// POST /api/gcal/feeds — add a new calendar
router.post('/feeds', async (req, res) => {
  try {
    const { url, name, color } = req.body
    if (!url) return res.status(400).json({ error: 'URL required' })

    const feeds = readFeeds()
    const id = 'gcal-' + Date.now().toString(36)
    const feed = { id, name: name || 'Calendar', url, color: color || '#0D9E9E' }

    // Test fetch
    const events = await fetchFeed(feed)
    const cache = readCache()
    cache[id] = { events, lastFetched: new Date().toISOString() }
    writeCache(cache)

    feeds.push(feed)
    fs.writeFileSync(FEEDS_FILE, JSON.stringify(feeds, null, 2))

    res.json({ ...feed, eventCount: events.length })
  } catch (err) {
    res.status(500).json({ error: `Could not read calendar: ${err.message}. Make sure it is shared publicly.` })
  }
})

// DELETE /api/gcal/feeds/:id
router.delete('/feeds/:id', (req, res) => {
  const feeds = readFeeds().filter(f => f.id !== req.params.id)
  fs.writeFileSync(FEEDS_FILE, JSON.stringify(feeds, null, 2))
  res.json({ ok: true })
})

module.exports = router
