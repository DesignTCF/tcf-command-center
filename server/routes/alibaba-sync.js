const express = require('express')
const router = express.Router()
const fs = require('fs')
const path = require('path')

const SYNC_FILE = path.join(__dirname, '../../data/alibaba-sync.json')

function readSync() {
  try { return JSON.parse(fs.readFileSync(SYNC_FILE, 'utf8')) } catch { return { conversations: [], lastSync: null } }
}

function writeSync(data) {
  fs.writeFileSync(SYNC_FILE, JSON.stringify(data, null, 2))
}

// POST /api/alibaba-sync — receive data from bookmarklet
router.post('/', (req, res) => {
  try {
    const { conversations = [], rawText = '', url = '', timestamp } = req.body

    const existing = readSync()

    // Merge new conversations with existing ones (by supplier name)
    const merged = [...existing.conversations]
    let added = 0
    let updated = 0

    conversations.forEach(convo => {
      const idx = merged.findIndex(c =>
        c.supplierName?.toLowerCase() === convo.supplierName?.toLowerCase()
      )
      if (idx >= 0) {
        // Update existing
        merged[idx] = {
          ...merged[idx],
          ...convo,
          lastSynced: timestamp || new Date().toISOString(),
          messageCount: Math.max(merged[idx].messageCount || 0, convo.messageCount || 0),
        }
        updated++
      } else {
        // Add new
        merged.push({
          id: Date.now().toString(36) + Math.random().toString(36).slice(2),
          ...convo,
          lastSynced: timestamp || new Date().toISOString(),
          needsReply: convo.lastMessageFrom === 'supplier',
          status: 'Active',
        })
        added++
      }
    })

    writeSync({
      conversations: merged,
      lastSync: timestamp || new Date().toISOString(),
      rawText: rawText.slice(0, 20000), // Store for AI queries
      sourceUrl: url,
    })

    console.log(`Alibaba sync: ${added} new, ${updated} updated, ${merged.length} total`)
    res.json({ ok: true, count: merged.length, added, updated })
  } catch (err) {
    console.error('Alibaba sync error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/alibaba-sync — get synced conversations
router.get('/', (req, res) => {
  res.json(readSync())
})

// GET /api/alibaba-sync/needs-reply — conversations that need a response
router.get('/needs-reply', (req, res) => {
  const data = readSync()
  const needReply = data.conversations.filter(c =>
    c.needsReply ||
    c.lastMessageFrom === 'supplier' ||
    c.status === 'Waiting Reply'
  )
  res.json(needReply)
})

module.exports = router
