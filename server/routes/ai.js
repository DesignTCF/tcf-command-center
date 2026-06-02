const express = require('express')
const router = express.Router()
const Anthropic = require('@anthropic-ai/sdk')

const CATEGORIES = ['Operations', 'Product Development', 'Creative', 'Website', 'Purchasing', 'Inventory', 'Supplier Management', 'Marketing', 'Research']
const PRIORITIES = ['Critical', 'High', 'Medium', 'Low']

function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set in .env')
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
}

const TCF_CONTEXT = `You are an AI executive assistant for Katherine Fox, Art Director and co-owner of The Cosmetic Formulary — a clinical skincare and cosmetic manufacturing company in Charleston, SC.

Katherine owns design, packaging, bottle sourcing across all brands and client projects. She leads on-camera content for the brand. She operates across three domains simultaneously: packaging and design, product development and manufacturing, and business operations.

Active clients: NeVoo (Molly Smith), Devoted Man (Josh Smith), Daily Rou (Meredith Baurband), Nitt Beauty (Gamze Gurlevik), Salt Spa Yoga (Andrew Moss).
Primary packaging supplier: Chunbai (Doria Wang). Print supplier: Your Box Solution.

Your role: analyze information, suggest organization, answer questions, and make recommendations. You NEVER create tasks, projects, or calendar events automatically. Katherine makes all decisions about what gets added to the dashboard.`

// POST /api/ai/analyze — analyze document and suggest items
router.post('/analyze', async (req, res) => {
  try {
    const client = getClient()
    const { text, sections } = req.body

    if (!text) return res.status(400).json({ error: 'No text provided' })

    const prompt = `${TCF_CONTEXT}

Analyze this document and identify actionable items. For each item, suggest a category and priority.

DOCUMENT CONTENT:
${text.slice(0, 12000)}

Return a JSON array of identified items. Each item:
{
  "id": "unique string",
  "text": "the item text",
  "context": "1-2 sentence context explaining why this is actionable",
  "suggestedCategory": one of ${JSON.stringify(CATEGORIES)},
  "suggestedPriority": one of ${JSON.stringify(PRIORITIES)},
  "suggestedType": one of ["Task", "Project", "Decision", "Research Item", "Supplier Follow-Up", "Calendar Event"],
  "reasoning": "brief explanation of the category/priority choice"
}

Focus on: action items, decisions needed, supplier follow-ups, deadlines, projects, research needs.
Ignore: general notes, descriptions of completed work, background context.
Return 5-25 items maximum. Return ONLY the JSON array, no other text.`

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = response.content[0]?.text?.trim() || '[]'
    // Extract JSON even if wrapped in markdown
    const jsonMatch = raw.match(/\[[\s\S]*\]/)
    const items = jsonMatch ? JSON.parse(jsonMatch[0]) : []

    res.json({ items, model: 'claude-sonnet-4-6' })
  } catch (err) {
    console.error('AI analyze error:', err.message)
    if (err.message.includes('ANTHROPIC_API_KEY')) {
      return res.status(401).json({ error: 'ANTHROPIC_API_KEY not configured. Add it to .env to enable AI features.' })
    }
    res.status(500).json({ error: err.message })
  }
})

// POST /api/ai/chat — conversational AI with dashboard context
router.post('/chat', async (req, res) => {
  try {
    const client = getClient()
    const { message, context } = req.body

    if (!message) return res.status(400).json({ error: 'No message provided' })

    const dashboardSummary = context ? `
CURRENT DASHBOARD DATA:
- Tasks: ${context.tasks?.length || 0} total, ${context.tasks?.filter(t => !t.done)?.length || 0} open
- Projects: ${context.projects?.length || 0} total (${context.projects?.filter(p => p.status === 'In Progress')?.length || 0} active)
- Products: ${context.products?.length || 0} total
- Open Decisions: ${context.decisions?.filter(d => !d.resolved)?.length || 0}
- Suppliers: ${context.suppliers?.length || 0} tracked
- Active Suppliers Waiting: ${context.suppliers?.filter(s => s.status === 'Waiting')?.length || 0}
${context.tasks?.length ? `\nRecent tasks: ${context.tasks.slice(0,5).map(t => t.title || t.name).join(', ')}` : ''}
${context.projects?.length ? `\nProjects: ${context.projects.map(p => `${p.name} (${p.status})`).join(', ')}` : ''}
${context.decisions?.filter(d => !d.resolved).length ? `\nOpen decisions: ${context.decisions.filter(d => !d.resolved).map(d => d.title).join(', ')}` : ''}
` : ''

    const docContent = context?.docText ? `\nGOOGLE DOCUMENT CONTENTS (summary):\n${context.docText.slice(0, 6000)}` : ''

    const systemPrompt = `${TCF_CONTEXT}
${dashboardSummary}
${docContent}

Answer questions concisely and directly. Make recommendations when asked. Never claim to have made changes to the dashboard — you can only suggest. Format responses with line breaks for readability. Use bullet points when listing items.`

    const history = (context?.chatHistory || []).slice(-8).map(m => ({
      role: m.role,
      content: m.content,
    }))

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [...history, { role: 'user', content: message }],
    })

    res.json({
      reply: response.content[0]?.text || 'No response generated.',
      model: 'claude-sonnet-4-6',
    })
  } catch (err) {
    console.error('AI chat error:', err.message)
    if (err.message.includes('ANTHROPIC_API_KEY')) {
      return res.status(401).json({ error: 'ANTHROPIC_API_KEY not configured in .env' })
    }
    res.status(500).json({ error: err.message })
  }
})

// POST /api/ai/categorize — quick single-item categorization
router.post('/categorize', async (req, res) => {
  try {
    const client = getClient()
    const { text } = req.body

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: `${TCF_CONTEXT}\n\nFor this item from Katherine's notes, suggest a category and priority.\nItem: "${text}"\n\nReturn JSON only: {"category": "...", "priority": "...", "type": "..."}\nCategory must be one of: ${CATEGORIES.join(', ')}\nPriority must be one of: ${PRIORITIES.join(', ')}\nType must be one of: Task, Project, Decision, Research Item, Supplier Follow-Up, Calendar Event`,
      }],
    })

    const raw = response.content[0]?.text?.trim() || '{}'
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    const result = jsonMatch ? JSON.parse(jsonMatch[0]) : {}
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
