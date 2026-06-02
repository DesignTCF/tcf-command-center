const express = require('express')
const router = express.Router()
const { google } = require('googleapis')

const DOC_ID = process.env.GDOC_ID || '1hg66MmORP86JiuprbWGV0d3r480A31mCpm47GBYcnxM'

function getAuth() {
  const auth = new google.auth.OAuth2(
    process.env.GDRIVE_CLIENT_ID,
    process.env.GDRIVE_CLIENT_SECRET
  )
  auth.setCredentials({ refresh_token: process.env.GDRIVE_REFRESH_TOKEN })
  return auth
}

// Extract plain text + structure from Google Docs API response
function parseDocContent(doc) {
  const sections = []
  let currentSection = null
  let plainText = ''

  const body = doc.body?.content || []

  for (const elem of body) {
    if (!elem.paragraph) continue
    const para = elem.paragraph
    const style = para.paragraphStyle?.namedStyleType || 'NORMAL_TEXT'

    // Extract text from runs
    const text = (para.elements || [])
      .map(e => e.textRun?.content || '')
      .join('')
      .replace(/\n$/, '')

    if (!text.trim()) continue

    plainText += text + '\n'

    const isHeading = style.startsWith('HEADING_')
    const level = isHeading ? parseInt(style.split('_')[1]) : null

    // Detect bullet/list
    const isBullet = !!para.bullet

    if (isHeading && level <= 2) {
      currentSection = {
        id: `section-${sections.length}`,
        heading: text.trim(),
        level,
        items: [],
        rawText: text.trim(),
      }
      sections.push(currentSection)
    } else if (currentSection) {
      currentSection.items.push({
        id: `item-${sections.length}-${currentSection.items.length}`,
        text: text.trim(),
        isBullet,
        isSubItem: isBullet && (para.bullet?.nestingLevel || 0) > 0,
      })
      currentSection.rawText += '\n' + text.trim()
    } else {
      // Content before any heading
      if (!sections.length) {
        currentSection = {
          id: 'section-intro',
          heading: doc.title || 'Document',
          level: 0,
          items: [],
          rawText: '',
        }
        sections.push(currentSection)
      }
      sections[0].items.push({
        id: `item-intro-${sections[0].items.length}`,
        text: text.trim(),
        isBullet,
        isSubItem: false,
      })
    }
  }

  return { sections, plainText: plainText.trim(), title: doc.title }
}

// GET /api/docs/content
router.get('/content', async (req, res) => {
  try {
    if (!process.env.GDRIVE_REFRESH_TOKEN) {
      return res.status(401).json({ error: 'Google credentials not configured. Add GDRIVE_CLIENT_ID, GDRIVE_CLIENT_SECRET, GDRIVE_REFRESH_TOKEN to .env' })
    }

    const auth = getAuth()
    const docs = google.docs({ version: 'v1', auth })
    const doc = await docs.documents.get({ documentId: DOC_ID })

    const parsed = parseDocContent(doc.data)
    res.json({
      id: DOC_ID,
      title: parsed.title,
      sections: parsed.sections,
      plainText: parsed.plainText,
      lastFetched: new Date().toISOString(),
    })
  } catch (err) {
    console.error('Docs error:', err.message)
    // Return structured error so frontend can show helpful message
    if (err.code === 403) {
      return res.status(403).json({ error: 'Access denied. Make sure the Google Docs API is enabled and the document is shared with your account.' })
    }
    if (err.code === 404) {
      return res.status(404).json({ error: 'Document not found. Check GDOC_ID in .env.' })
    }
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
