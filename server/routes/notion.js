const express = require('express')
const router = express.Router()
const { Client } = require('@notionhq/client')

function getClient() {
  return new Client({ auth: process.env.NOTION_TOKEN })
}

const TODO_DB_ID = process.env.NOTION_TODO_DB_ID || '33716212-4ddd-809c-9ca1-c6a649bca6e4'
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

// GET /api/notion/tasks/:id/blocks — fetch block children for a task
router.get('/tasks/:id/blocks', async (req, res) => {
  try {
    const notion = getClient()
    async function fetchBlocks(blockId, depth = 0) {
      if (depth > 2) return []
      const result = await notion.blocks.children.list({ block_id: blockId, page_size: 100 })
      return await Promise.all((result.results || []).map(async block => {
        const type = block.type
        const data = block[type] || {}
        const item = {
          id: block.id, type,
          text: (data.rich_text || []).map(t => t.plain_text).join(''),
          checked: data.checked || false,
          hasChildren: block.has_children || false,
          children: [],
        }
        if (block.has_children && depth < 2) {
          item.children = await fetchBlocks(block.id, depth + 1)
        }
        return item
      }))
    }
    const blocks = await fetchBlocks(req.params.id)
    res.json(blocks)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PATCH /api/notion/blocks/:id — toggle a to_do block checked state
router.patch('/blocks/:id', async (req, res) => {
  try {
    const notion = getClient()
    const { checked, type } = req.body
    const blockType = type || 'to_do'
    const block = await notion.blocks.update({
      block_id: req.params.id,
      [blockType]: { checked: !!checked },
    })
    res.json({ ok: true, block })
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
