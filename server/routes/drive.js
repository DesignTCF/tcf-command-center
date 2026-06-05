const express = require('express')
const router = express.Router()
const { google } = require('googleapis')
const fs = require('fs')
const path = require('path')

const TOKENS_FILE = path.join(__dirname, '../../data/drive-tokens.json')
const ACCOUNTS = (process.env.GMAIL_ACCOUNTS || '').split(',').map(a => a.trim()).filter(Boolean)

function readTokens() {
  try { return JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf8')) } catch { return {} }
}

function getAuthForAccount(email) {
  const tokens = readTokens()
  const t = tokens[email]
  if (!t?.refresh_token) return null

  const auth = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    process.env.DRIVE_REDIRECT_URI || 'http://localhost:3001/auth/drive/callback'
  )
  auth.setCredentials({
    access_token: t.access_token,
    refresh_token: t.refresh_token,
    expiry_date: t.expiry_date,
  })
  return auth
}

function getFileType(mimeType, name) {
  if (mimeType === 'application/vnd.google-apps.folder') return 'folder'
  if (mimeType?.includes('image')) return 'image'
  if (mimeType?.includes('pdf')) return 'pdf'
  if (mimeType?.includes('spreadsheet') || name?.endsWith('.xlsx') || name?.endsWith('.csv')) return 'spreadsheet'
  if (mimeType?.includes('presentation') || name?.endsWith('.pptx')) return 'presentation'
  if (mimeType?.includes('document') || name?.endsWith('.docx')) return 'document'
  if (mimeType?.includes('video')) return 'video'
  if (mimeType?.includes('zip') || name?.endsWith('.zip')) return 'archive'
  return 'file'
}

// SAFETY: delete operations on Google Drive are permanently blocked at the route level.
// No file, folder, or Drive item may ever be deleted through this server.
router.delete('/files/*', (req, res) => res.status(403).json({ error: 'Delete operations are disabled. Files may not be deleted through this dashboard.' }))

// GET /api/drive/status — which accounts are connected
router.get('/status', (req, res) => {
  const tokens = readTokens()
  res.json(ACCOUNTS.map(email => ({
    email,
    connected: !!tokens[email]?.refresh_token,
    connectedAt: tokens[email]?.connected_at || null,
  })))
})

// GET /api/drive/files?account=&q=&pageToken=
// account: specific email, or omit for all connected accounts
router.get('/files', async (req, res) => {
  try {
    const { account, q, pageToken } = req.query
    const tokens = readTokens()

    const targetAccounts = account
      ? [account]
      : ACCOUNTS.filter(e => !!tokens[e]?.refresh_token)

    if (targetAccounts.length === 0) {
      return res.json({ files: [], accounts: [] })
    }

    const results = await Promise.all(targetAccounts.map(async email => {
      const auth = getAuthForAccount(email)
      if (!auth) return { email, files: [], error: 'Not connected' }

      try {
        const drive = google.drive({ version: 'v3', auth })

        let queryStr = 'trashed = false'
        if (q) {
          queryStr += ` and name contains '${q.replace(/'/g, "\\'")}'`
        }

        const response = await drive.files.list({
          pageSize: 50,
          orderBy: q ? 'modifiedTime desc' : 'modifiedTime desc',
          fields: 'nextPageToken,files(id,name,mimeType,modifiedTime,size,webViewLink,iconLink,parents)',
          q: queryStr,
          ...(pageToken ? { pageToken } : {}),
        })

        const files = (response.data.files || []).map(f => ({
          id: f.id,
          name: f.name,
          mimeType: f.mimeType,
          modified: f.modifiedTime,
          size: f.size ? parseInt(f.size) : null,
          url: f.webViewLink,
          isFolder: f.mimeType === 'application/vnd.google-apps.folder',
          type: getFileType(f.mimeType, f.name),
          account: email,
        }))

        return { email, files, nextPageToken: response.data.nextPageToken || null }
      } catch (err) {
        return { email, files: [], error: err.message }
      }
    }))

    // Merge and sort by modified date
    const allFiles = results.flatMap(r => r.files)
    allFiles.sort((a, b) => new Date(b.modified) - new Date(a.modified))

    res.json({
      files: allFiles,
      accounts: results.map(r => ({ email: r.email, count: r.files.length, error: r.error || null })),
    })
  } catch (err) {
    console.error('Drive files error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/drive/file/:fileId/content?account=
router.get('/file/:fileId/content', async (req, res) => {
  const { fileId } = req.params
  const { account } = req.query
  const tokens = readTokens()

  // Try specified account first, then all connected accounts
  const tryAccounts = account
    ? [account]
    : ACCOUNTS.filter(e => !!tokens[e]?.refresh_token)

  for (const email of tryAccounts) {
    const auth = getAuthForAccount(email)
    if (!auth) continue

    try {
      const drive = google.drive({ version: 'v3', auth })

      // Get file metadata first
      const meta = await drive.files.get({
        fileId,
        fields: 'id,name,mimeType,modifiedTime,webViewLink',
      })

      const { mimeType, name } = meta.data

      let content = null
      let contentType = 'unknown'

      if (mimeType === 'application/vnd.google-apps.spreadsheet') {
        const export_ = await drive.files.export({ fileId, mimeType: 'text/csv' }, { responseType: 'text' })
        content = export_.data
        contentType = 'csv'
      } else if (mimeType === 'application/vnd.google-apps.document') {
        const export_ = await drive.files.export({ fileId, mimeType: 'text/plain' }, { responseType: 'text' })
        content = export_.data
        contentType = 'text'
      } else if (mimeType === 'application/vnd.google-apps.presentation') {
        const export_ = await drive.files.export({ fileId, mimeType: 'text/plain' }, { responseType: 'text' })
        content = export_.data
        contentType = 'text'
      } else if (mimeType?.includes('text/') || mimeType?.includes('json')) {
        const download = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'text' })
        content = download.data
        contentType = 'text'
      } else {
        return res.json({
          id: fileId,
          name,
          mimeType,
          url: meta.data.webViewLink,
          account: email,
          content: null,
          contentType: 'binary',
          message: 'This file type cannot be read as text.',
        })
      }

      return res.json({
        id: fileId,
        name,
        mimeType,
        url: meta.data.webViewLink,
        modified: meta.data.modifiedTime,
        account: email,
        content: content?.slice(0, 50000) || '',
        contentType,
      })
    } catch (err) {
      if (err.code === 404 || err.message?.includes('not found')) continue
      console.error(`Drive content error (${email}):`, err.message)
    }
  }

  res.status(404).json({ error: 'File not found or not accessible with connected accounts.' })
})

// GET /api/drive/search?q= — search across all connected accounts
router.get('/search', async (req, res) => {
  const { q } = req.query
  if (!q?.trim()) return res.json({ files: [] })

  try {
    const tokens = readTokens()
    const connectedAccounts = ACCOUNTS.filter(e => !!tokens[e]?.refresh_token)

    const results = await Promise.all(connectedAccounts.map(async email => {
      const auth = getAuthForAccount(email)
      if (!auth) return []

      try {
        const drive = google.drive({ version: 'v3', auth })
        const response = await drive.files.list({
          pageSize: 20,
          orderBy: 'modifiedTime desc',
          fields: 'files(id,name,mimeType,modifiedTime,webViewLink)',
          q: `name contains '${q.replace(/'/g, "\\'")}' and trashed = false`,
        })

        return (response.data.files || []).map(f => ({
          id: f.id,
          name: f.name,
          mimeType: f.mimeType,
          modified: f.modifiedTime,
          url: f.webViewLink,
          type: getFileType(f.mimeType, f.name),
          account: email,
        }))
      } catch { return [] }
    }))

    const files = results.flat()
    files.sort((a, b) => new Date(b.modified) - new Date(a.modified))
    res.json({ files })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/drive/pinned — list pinned files (stored in data/drive-pinned.json)
const PINNED_FILE = path.join(__dirname, '../../data/drive-pinned.json')
function readPinned() {
  try { return JSON.parse(fs.readFileSync(PINNED_FILE, 'utf8')) } catch { return [] }
}
function writePinned(data) {
  fs.writeFileSync(PINNED_FILE, JSON.stringify(data, null, 2))
}

router.get('/pinned', (req, res) => {
  res.json(readPinned())
})

router.post('/pinned', (req, res) => {
  const { id, name, mimeType, url, account } = req.body
  if (!id || !name) return res.status(400).json({ error: 'id and name required' })
  const pinned = readPinned()
  if (pinned.find(p => p.id === id)) return res.json({ ok: true, already: true })
  pinned.push({ id, name, mimeType, url, account, pinnedAt: new Date().toISOString(), type: getFileType(mimeType, name) })
  writePinned(pinned)
  res.json({ ok: true })
})

router.delete('/pinned/:id', (req, res) => {
  writePinned(readPinned().filter(p => p.id !== req.params.id))
  res.json({ ok: true })
})

module.exports = router
