require('dotenv').config({ path: '../.env' })
const express = require('express')
const cors = require('cors')
const path = require('path')

const notionRoutes = require('./routes/notion')
const gmailRoutes = require('./routes/gmail')
const driveRoutes = require('./routes/drive')
const dataRoutes = require('./routes/data')
const docsRoutes = require('./routes/docs')
const aiRoutes = require('./routes/ai')
const githubRoutes = require('./routes/github')

const app = express()
const PORT = process.env.PORT || 3001
const CLIENT_DIST = path.join(__dirname, '../client-dist')

app.use(cors({ origin: '*' })) // Allow bookmarklet from any domain (alibaba.com, etc.)
app.use(express.json({ limit: '50mb' }))

app.use('/api/notion', notionRoutes)
app.use('/api/gmail', gmailRoutes)
app.use('/api/drive', driveRoutes)
app.use('/api/data', dataRoutes)
app.use('/api/docs', docsRoutes)
app.use('/api/ai', aiRoutes)
app.use('/api/github', githubRoutes)
app.use('/api/sources', require('./routes/sources'))
app.use('/auth/gmail', require('./routes/gmail-auth'))
app.use('/auth/drive', require('./routes/drive-auth'))
app.use('/api/alibaba-sync', require('./routes/alibaba-sync'))
app.use('/api/gcal', require('./routes/gcal'))
app.use('/alibaba-sync-setup', require('./routes/alibaba-bookmarklet'))

app.use('/api/sync', require('./routes/sync'))
app.use('/api/shopify', require('./routes/shopify'))
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }))

// Serve built React app
const fs = require('fs')
if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST))
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(CLIENT_DIST, 'index.html'))
    }
  })
}

app.listen(PORT, () => {
  console.log(`\n  TCF Command Center`)
  console.log(`  ─────────────────────────────────`)
  console.log(`  API:     http://localhost:${PORT}/api`)
  if (fs.existsSync(CLIENT_DIST)) {
    console.log(`  App:     http://localhost:${PORT}`)
  } else {
    console.log(`  Dev:     http://localhost:5173  (run: cd client && npm run dev)`)
  }
  console.log()
})
