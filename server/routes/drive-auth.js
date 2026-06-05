const express = require('express')
const router = express.Router()
const { google } = require('googleapis')
const fs = require('fs')
const path = require('path')

const TOKENS_FILE = path.join(__dirname, '../../data/drive-tokens.json')
const SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/userinfo.email',
]

const ACCOUNTS = (process.env.GMAIL_ACCOUNTS || '').split(',').map(a => a.trim()).filter(Boolean)

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    process.env.DRIVE_REDIRECT_URI || 'http://localhost:3001/auth/drive/callback'
  )
}

function readTokens() {
  try { return JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf8')) } catch { return {} }
}

function writeTokens(data) {
  fs.writeFileSync(TOKENS_FILE, JSON.stringify(data, null, 2))
}

// GET /auth/drive — show authorization page
router.get('/', (req, res) => {
  const tokens = readTokens()
  const accounts = ACCOUNTS.map(email => ({
    email,
    authorized: !!tokens[email]?.refresh_token,
    connectedAt: tokens[email]?.connected_at || null,
  }))

  const nextUnauthorized = accounts.find(a => !a.authorized)

  res.send(`<!DOCTYPE html>
<html>
<head>
  <title>Connect Google Drive — TCF Dashboard</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, sans-serif; background: #f5f5f5; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .card { background: white; border-radius: 12px; padding: 2rem; width: 480px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    h1 { font-size: 18px; font-weight: 700; color: #1a1a1a; margin-bottom: 6px; }
    .sub { font-size: 13px; color: #58595b; margin-bottom: 1.5rem; }
    .account { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border: 1px solid #e0e0e0; border-radius: 8px; margin-bottom: 10px; }
    .dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
    .dot.ok { background: #157A50; }
    .dot.pending { background: #e0e0e0; }
    .email { flex: 1; font-size: 13px; color: #1a1a1a; font-weight: 500; }
    .status { font-size: 11px; font-weight: 600; }
    .status.ok { color: #157A50; }
    .status.pending { color: #A86200; }
    .btn { display: block; width: 100%; background: #0D9E9E; color: white; border: none; padding: 12px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; margin-top: 1.5rem; text-decoration: none; text-align: center; }
    .btn:hover { background: #0A7A7A; }
    .btn.done { background: #157A50; }
    .note { font-size: 11px; color: #58595b; margin-top: 12px; text-align: center; }
    .back { display: block; text-align: center; margin-top: 1rem; font-size: 13px; color: #0D9E9E; text-decoration: none; }
    .scope-note { background: #f0f9f9; border: 1px solid #b2e0e0; border-radius: 8px; padding: 10px 14px; margin-bottom: 1.5rem; font-size: 12px; color: #2a6b6b; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Connect Google Drive</h1>
    <p class="sub">Connect all 3 accounts to browse, search, and read Drive files in the dashboard.</p>

    <div class="scope-note">
      📁 Full access — the dashboard can view, search, create, edit, and move your files.
    </div>

    ${accounts.map(a => `
    <div class="account">
      <div class="dot ${a.authorized ? 'ok' : 'pending'}"></div>
      <div class="email">${a.email}</div>
      <div class="status ${a.authorized ? 'ok' : 'pending'}">${a.authorized ? '✓ Connected' : 'Pending'}</div>
    </div>`).join('')}

    ${nextUnauthorized
      ? `<a class="btn" href="/auth/drive/start?email=${encodeURIComponent(nextUnauthorized.email)}">
           Authorize ${nextUnauthorized.email} →
         </a>
         <p class="note">You'll be taken to Google to sign in. Click Allow and you'll return here automatically.</p>`
      : `<div class="btn done">✓ All accounts connected!</div>
         <p class="note">All 3 Drive accounts are now connected to your dashboard.</p>`
    }

    <a class="back" href="/">← Back to dashboard</a>
  </div>
</body>
</html>`)
})

// GET /auth/drive/start?email=xxx
router.get('/start', (req, res) => {
  const { email } = req.query
  if (!email || !ACCOUNTS.includes(email)) return res.status(400).send('Invalid account')

  const oauth2Client = getOAuth2Client()
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
    login_hint: email,
    state: Buffer.from(email).toString('base64'),
  })

  res.redirect(authUrl)
})

// GET /auth/drive/callback
router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query

  if (error) {
    return res.send(`<p style="color:red;font-family:sans-serif;padding:2rem">Error: ${error}. <a href="/auth/drive">Try again</a></p>`)
  }

  try {
    const email = Buffer.from(state, 'base64').toString('utf8')
    const oauth2Client = getOAuth2Client()
    const { tokens } = await oauth2Client.getToken(code)

    const allTokens = readTokens()
    allTokens[email] = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: tokens.expiry_date,
      connected_at: new Date().toISOString(),
    }
    writeTokens(allTokens)

    console.log(`Drive authorized: ${email}`)
    res.redirect('/auth/drive')
  } catch (err) {
    console.error('Drive auth callback error:', err.message)
    res.send(`<p style="color:red;font-family:sans-serif;padding:2rem">Error: ${err.message}. <a href="/auth/drive">Try again</a></p>`)
  }
})

// GET /auth/drive/status
router.get('/status', (req, res) => {
  const tokens = readTokens()
  res.json(ACCOUNTS.map(email => ({
    email,
    connected: !!tokens[email]?.refresh_token,
    connectedAt: tokens[email]?.connected_at || null,
  })))
})

module.exports = router
