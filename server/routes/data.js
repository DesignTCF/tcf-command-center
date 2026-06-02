const express = require('express')
const router = express.Router()
const fs = require('fs')
const path = require('path')

const DATA_DIR = path.join(__dirname, '../../data')

function readJSON(filename, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, filename), 'utf8'))
  } catch {
    return fallback
  }
}

function writeJSON(filename, data) {
  fs.writeFileSync(path.join(DATA_DIR, filename), JSON.stringify(data, null, 2))
}

function makeCRUD(filename, fallback = []) {
  const base = filename.replace('.json', '')

  router.get(`/${base}`, (req, res) => {
    res.json(readJSON(filename, fallback))
  })

  router.post(`/${base}`, (req, res) => {
    const items = readJSON(filename, fallback)
    const newItem = { id: Date.now().toString(36) + Math.random().toString(36).slice(2), ...req.body, createdAt: new Date().toISOString() }
    if (Array.isArray(items)) {
      items.push(newItem)
      writeJSON(filename, items)
      res.json(newItem)
    } else {
      const merged = { ...items, ...req.body }
      writeJSON(filename, merged)
      res.json(merged)
    }
  })

  router.patch(`/${base}/:id`, (req, res) => {
    const items = readJSON(filename, fallback)
    if (!Array.isArray(items)) {
      const merged = { ...items, ...req.body }
      writeJSON(filename, merged)
      return res.json(merged)
    }
    const idx = items.findIndex(p => p.id === req.params.id)
    if (idx === -1) return res.status(404).json({ error: 'Not found' })
    items[idx] = { ...items[idx], ...req.body }
    writeJSON(filename, items)
    res.json(items[idx])
  })

  router.delete(`/${base}/:id`, (req, res) => {
    const items = readJSON(filename, fallback)
    if (!Array.isArray(items)) return res.json({ ok: true })
    writeJSON(filename, items.filter(p => p.id !== req.params.id))
    res.json({ ok: true })
  })
}

// All data collections
makeCRUD('products.json')
makeCRUD('formulas.json')
makeCRUD('packaging.json')
makeCRUD('manufacturing.json')
makeCRUD('content.json')
makeCRUD('decisions.json')
makeCRUD('intelligence.json')
makeCRUD('contacts.json')
makeCRUD('projects.json')
makeCRUD('suppliers.json')
makeCRUD('purchasing.json')
makeCRUD('inventory.json')
makeCRUD('website-projects.json')
makeCRUD('calendar.json')
makeCRUD('import-items.json')
makeCRUD('alibaba-convos.json')
makeCRUD('links.json')

// Brand health (singleton object)
router.get('/brand-health', (req, res) => {
  res.json(readJSON('brandHealth.json', { streak: 0, lastUpdated: null }))
})
router.patch('/brand-health', (req, res) => {
  const data = { ...readJSON('brandHealth.json', { streak: 0 }), ...req.body }
  writeJSON('brandHealth.json', data)
  res.json(data)
})
router.post('/brand-health/increment-streak', (req, res) => {
  const data = readJSON('brandHealth.json', { streak: 0, lastUpdated: null })
  const today = new Date().toDateString()
  if (data.lastUpdated !== today) {
    data.streak = (data.streak || 0) + 1
    data.lastUpdated = today
    writeJSON('brandHealth.json', data)
  }
  res.json(data)
})
router.post('/brand-health/reset-streak', (req, res) => {
  const data = { streak: 0, lastUpdated: new Date().toDateString() }
  writeJSON('brandHealth.json', data)
  res.json(data)
})

module.exports = router
