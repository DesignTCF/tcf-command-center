const express = require('express')
const router = express.Router()
const fs = require('fs')
const path = require('path')

const DATA_DIR = path.join(__dirname, '../../data')
const SHOPIFY_STORE = process.env.SHOPIFY_STORE_URL      // e.g. your-store.myshopify.com
const SHOPIFY_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN    // Admin API access token

function readJSON(file, fallback = []) {
  try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8')) } catch { return fallback }
}
function writeJSON(file, data) {
  fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2))
}

async function shopifyFetch(endpoint, options = {}) {
  if (!SHOPIFY_STORE || !SHOPIFY_TOKEN) throw new Error('Shopify not configured — add SHOPIFY_STORE_URL and SHOPIFY_ADMIN_TOKEN to .env')
  const url = `https://${SHOPIFY_STORE}/admin/api/2024-01/${endpoint}`
  const res = await fetch(url, {
    ...options,
    headers: {
      'X-Shopify-Access-Token': SHOPIFY_TOKEN,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })
  if (!res.ok) throw new Error(`Shopify API ${res.status}: ${await res.text()}`)
  return res.json()
}

// ── GET /api/shopify/status ───────────────────────────────────────────────────
router.get('/status', (req, res) => {
  res.json({
    connected: !!(SHOPIFY_STORE && SHOPIFY_TOKEN),
    store: SHOPIFY_STORE || null,
  })
})

// ── GET /api/shopify/orders ───────────────────────────────────────────────────
router.get('/orders', async (req, res) => {
  try {
    const limit = req.query.limit || 25
    const status = req.query.status || 'any'
    const data = await shopifyFetch(`orders.json?limit=${limit}&status=${status}`)
    const orders = (data.orders || []).map(o => ({
      id: o.id,
      name: o.name,
      createdAt: o.created_at,
      customer: o.customer ? `${o.customer.first_name} ${o.customer.last_name}`.trim() : o.email || 'Guest',
      email: o.email,
      total: o.total_price,
      currency: o.currency,
      financialStatus: o.financial_status,
      fulfillmentStatus: o.fulfillment_status || 'unfulfilled',
      lineItems: (o.line_items || []).map(i => ({ name: i.name, qty: i.quantity, price: i.price })),
      tags: o.tags,
      note: o.note,
    }))
    res.json(orders)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/shopify/products ─────────────────────────────────────────────────
router.get('/products', async (req, res) => {
  try {
    const data = await shopifyFetch('products.json?limit=50')
    res.json(data.products || [])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/shopify/customers ────────────────────────────────────────────────
router.get('/customers', async (req, res) => {
  try {
    const data = await shopifyFetch('customers.json?limit=50')
    res.json(data.customers || [])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/shopify/sync ────────────────────────────────────────────────────
// Pulls latest orders, creates dashboard tasks for unfulfilled ones,
// flags low inventory, surfaces customer inquiries
router.post('/sync', async (req, res) => {
  try {
    const [ordersData, productsData] = await Promise.all([
      shopifyFetch('orders.json?limit=50&status=open&financial_status=paid'),
      shopifyFetch('products.json?limit=50'),
    ])

    const orders = ordersData.orders || []
    const products = productsData.products || []
    const actions = []

    // Unfulfilled paid orders → create tasks
    const unfulfilled = orders.filter(o => o.fulfillment_status !== 'fulfilled')
    unfulfilled.forEach(o => {
      actions.push({
        type: 'order',
        priority: 'High',
        title: `Fulfill order ${o.name} — ${o.customer?.first_name || o.email}`,
        notes: (o.line_items || []).map(i => `${i.quantity}× ${i.name}`).join(', '),
        url: `https://${SHOPIFY_STORE}/admin/orders/${o.id}`,
        createdAt: o.created_at,
      })
    })

    // Low inventory products (< 5 units)
    products.forEach(p => {
      const lowVariants = (p.variants || []).filter(v => v.inventory_quantity !== null && v.inventory_quantity < 5)
      if (lowVariants.length) {
        actions.push({
          type: 'inventory',
          priority: 'Medium',
          title: `Low inventory: ${p.title}`,
          notes: lowVariants.map(v => `${v.title}: ${v.inventory_quantity} left`).join(', '),
          url: `https://${SHOPIFY_STORE}/admin/products/${p.id}`,
        })
      }
    })

    // Save to dashboard
    const existing = readJSON('shopify-actions.json', [])
    const merged = [
      ...actions.map(a => ({ id: `shopify-${a.type}-${Date.now()}`, ...a })),
      ...existing.filter(e => e.resolved),
    ].slice(0, 50)
    writeJSON('shopify-actions.json', merged)

    res.json({ ok: true, orders: unfulfilled.length, actions: actions.length })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/shopify/actions ──────────────────────────────────────────────────
router.get('/actions', (req, res) => {
  res.json(readJSON('shopify-actions.json', []).filter(a => !a.resolved))
})

// ── POST /api/shopify/actions/:id/resolve ─────────────────────────────────────
router.post('/actions/:id/resolve', (req, res) => {
  const actions = readJSON('shopify-actions.json', [])
  const idx = actions.findIndex(a => a.id === req.params.id)
  if (idx > -1) { actions[idx].resolved = true; writeJSON('shopify-actions.json', actions) }
  res.json({ ok: true })
})

module.exports = router
