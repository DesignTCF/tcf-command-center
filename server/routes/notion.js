const express = require('express')
const router = express.Router()
const { Client } = require('@notionhq/client')

function getClient() {
  return new Client({ auth: process.env.NOTION_TOKEN })
}

const TODO_DB_ID = process.env.NOTION_TODO_DB_ID || '337162124ddd80508602d598cd2896da'
const CONTENT_DB_ID = '34116212-4ddd-80a4-8b44-fe0a634c2ef2'

function getText(prop) {
  if (!prop) return ''
  if (prop.title) return prop.title.map(t => t.plain_text).join('')
  if (prop.rich_text) return prop.rich_text.map(t => t.plain_text).join('')
  return ''
}

function mapTask(page) {
  const props = page.properties || {}
  const titleProp = props['Task name'] || props['Name'] || props['Title'] || Object.values(props).find(p => p.type === 'title')
  const statusVal = props['Status']
  const statusName = statusVal?.status?.name || statusVal?.select?.name || ''
  return {
    id: page.id,
    title: getText(titleProp),
    status: statusName,
    dueDate: props['Due date']?.date?.start || props['Due Date']?.date?.start || null,
    assignee: (props['Assignee']?.people || []).map(p => p.name).join(', '),
    url: page.url,
    lastEdited: page.last_edited_time,
    done: statusName === 'Done',
    source: 'notion',
  }
}

function mapContent(page) {
  const props = page.properties || {}
  const titleProp = props['Content name'] || props['Name'] || Object.values(props).find(p => p.type === 'title')
  return {
    id: page.id,
    title: getText(titleProp),
    status: props['Status']?.select?.name || '',
    platform: (props['Platform']?.multi_select || []).map(s => s.name),
    contentType: props['Content type']?.select?.name || '',
    publishDate: props['Publish date']?.date?.start || null,
    filmDate: props['Film date']?.date?.start || null,
    postUrl: props['Post URL']?.url || '',
    owner: (props['Owner']?.people || []).map(p => p.name).join(', '),
    url: page.url,
    source: 'notion',
  }
}

// GET /api/notion/tasks
router.get('/tasks', async (req, res) => {
  try {
    const notion = getClient()
    const response = await notion.databases.query({
      database_id: TODO_DB_ID,
      sorts: [{ timestamp: 'last_edited_time', direction: 'descending' }],
      page_size: 100,
    })
    res.json(response.results.map(mapTask))
  } catch (err) {
    console.error('Notion tasks error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/notion/content
router.get('/content', async (req, res) => {
  try {
    const notion = getClient()
    const response = await notion.databases.query({
      database_id: CONTENT_DB_ID,
      page_size: 100,
    })
    res.json(response.results.map(mapContent))
  } catch (err) {
    console.error('Notion content error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/notion/databases
router.get('/databases', async (req, res) => {
  try {
    const notion = getClient()
    const response = await notion.search({ filter: { value: 'database', property: 'object' }, page_size: 50 })
    res.json(response.results.map(db => ({
      id: db.id,
      title: (db.title || []).map(t => t.plain_text).join(''),
      properties: Object.keys(db.properties || {}),
    })))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PATCH /api/notion/tasks/:id
router.patch('/tasks/:id', async (req, res) => {
  try {
    const notion = getClient()
    const { status } = req.body
    const properties = {}
    if (status) properties['Status'] = { status: { name: status } }
    const page = await notion.pages.update({ page_id: req.params.id, properties })
    res.json(mapTask(page))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/notion/tasks
router.post('/tasks', async (req, res) => {
  try {
    const notion = getClient()
    const { title, status } = req.body
    const page = await notion.pages.create({
      parent: { database_id: TODO_DB_ID },
      properties: {
        'Task name': { title: [{ text: { content: title || 'New Task' } }] },
        'Status': { status: { name: status || 'Not started' } },
      },
    })
    res.json(mapTask(page))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
