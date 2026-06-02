const express = require('express');
const router = express.Router();
const { Client } = require('@notionhq/client');

function getClient() {
  return new Client({ auth: process.env.NOTION_TOKEN });
}

const TODO_DB_ID = process.env.NOTION_TODO_DB_ID || '337162124ddd80508602d598cd2896da';

function mapPage(page) {
  const props = page.properties || {};
  const getText = (p) => p?.title?.[0]?.plain_text || p?.rich_text?.[0]?.plain_text || '';
  const getSelect = (p) => p?.select?.name || '';
  const getMultiSelect = (p) => p?.multi_select?.map(s => s.name) || [];
  const getDate = (p) => p?.date?.start || null;
  const getCheckbox = (p) => p?.checkbox || false;

  return {
    id: page.id,
    title: getText(props['Name'] || props['Task'] || props['Title'] || Object.values(props).find(p => p.type === 'title')),
    status: getSelect(props['Status']),
    priority: getSelect(props['Priority']),
    category: getSelect(props['Category']) || getMultiSelect(props['Category'])?.[0] || '',
    categories: getMultiSelect(props['Category']),
    dueDate: getDate(props['Due Date'] || props['Due'] || props['Deadline']),
    done: getCheckbox(props['Done'] || props['Completed'] || props['Checkbox']),
    url: page.url,
    lastEdited: page.last_edited_time,
  };
}

// GET /api/notion/tasks
router.get('/tasks', async (req, res) => {
  try {
    const notion = getClient();
    const response = await notion.databases.query({
      database_id: TODO_DB_ID,
      sorts: [{ timestamp: 'last_edited_time', direction: 'descending' }],
      page_size: 100,
    });
    res.json(response.results.map(mapPage));
  } catch (err) {
    console.error('Notion tasks error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/notion/tasks/:id — update status or done
router.patch('/tasks/:id', async (req, res) => {
  try {
    const notion = getClient();
    const { status, done, priority, dueDate } = req.body;
    const properties = {};
    if (status !== undefined) properties['Status'] = { select: { name: status } };
    if (done !== undefined) properties['Done'] = { checkbox: done };
    if (priority !== undefined) properties['Priority'] = { select: { name: priority } };
    if (dueDate !== undefined) properties['Due Date'] = dueDate ? { date: { start: dueDate } } : { date: null };

    const page = await notion.pages.update({ page_id: req.params.id, properties });
    res.json(mapPage(page));
  } catch (err) {
    console.error('Notion patch error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notion/tasks — create new task
router.post('/tasks', async (req, res) => {
  try {
    const notion = getClient();
    const { title, status, priority, category, dueDate } = req.body;
    const properties = {
      Name: { title: [{ text: { content: title || 'New Task' } }] },
    };
    if (status) properties['Status'] = { select: { name: status } };
    if (priority) properties['Priority'] = { select: { name: priority } };
    if (category) properties['Category'] = { select: { name: category } };
    if (dueDate) properties['Due Date'] = { date: { start: dueDate } };

    const page = await notion.pages.create({ parent: { database_id: TODO_DB_ID }, properties });
    res.json(mapPage(page));
  } catch (err) {
    console.error('Notion create error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/notion/schema — discover database properties
router.get('/schema', async (req, res) => {
  try {
    const notion = getClient();
    const db = await notion.databases.retrieve({ database_id: TODO_DB_ID });
    res.json({ properties: Object.keys(db.properties), full: db.properties });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
