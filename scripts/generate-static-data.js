#!/usr/bin/env node
// Reads all data/*.json files and regenerates client/src/data/staticData.js
// Run after fetch-data.js, before the client build, so GitHub Pages has current data.

const fs = require('fs')
const path = require('path')

const DATA   = path.join(__dirname, '../data')
const OUTPUT = path.join(__dirname, '../client/src/data/staticData.js')

function read(file, fallback = []) {
  try { return JSON.parse(fs.readFileSync(path.join(DATA, file), 'utf8')) }
  catch { return fallback }
}

const formulas        = read('formulas.json')
const packaging       = read('packaging.json')
const manufacturing   = read('manufacturing.json')
const content         = read('content.json')
const decisions       = read('decisions.json')
const intelligence    = read('intelligence.json')
const contacts        = read('contacts.json')
const brandHealth     = read('brandHealth.json', { streak: 0, lastUpdated: null })
const projects        = read('projects.json')
const suppliers       = read('suppliers.json')
const purchasing      = read('purchasing.json')
const inventory       = read('inventory.json')
const websiteProjects = read('websiteProjects.json').length
  ? read('websiteProjects.json')
  : read('website-projects.json')
const calendar        = read('calendar.json')
const importItems     = read('import-items.json')
const alibabaCo       = read('alibaba-convos.json')
const links           = read('links.json')
const driveHub        = read('drive-hub.json')
const driveTasks      = read('drive-tasks.json')

// ── Parse Client Status Tracker → products ────────────────────────────────────
function parseClientStatusTracker(sources) {
  const tracker = sources.find(s => s.label === 'Client Status Tracker')
  if (!tracker?.rawContent) return null

  const lines = tracker.rawContent.split('\n').map(l => l.trim())
  if (lines.length < 3) return null

  const products = []
  let currentBrand = '', currentClient = '', idCounter = 0

  for (let i = 2; i < lines.length; i++) {  // skip 2-row header
    const line = lines[i]
    if (!line || line === ','.repeat(line.length)) continue

    // Simple CSV split (handles basic quoted fields)
    const cols = []
    let cur = '', inQ = false
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ }
      else if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = '' }
      else cur += ch
    }
    cols.push(cur.trim())

    const brand       = cols[0]?.replace(/"/g, '').trim()
    const client      = cols[1]?.replace(/"/g, '').trim()
    const productType = cols[2]?.replace(/"/g, '').trim()
    const productName = cols[3]?.replace(/"/g, '').trim()
    const sizeCategory= cols[4]?.replace(/"/g, '').trim()
    const sku         = cols[5]?.replace(/"/g, '').trim()
    const upc         = cols[6]?.replace(/"/g, '').trim()
    const formulaStatus = cols[7]?.replace(/"/g, '').trim()
    const formulaSKU  = cols[8]?.replace(/"/g, '').trim()
    const bottleStatus = cols[10]?.replace(/"/g, '').trim()
    const bottleType  = cols[11]?.replace(/"/g, '').trim()
    const artworkStatus = cols[21]?.replace(/"/g, '').trim()

    if (brand) currentBrand = brand
    if (client) currentClient = client

    const name = [productName || productType, sizeCategory].filter(Boolean).join(' — ')
    if (!name || name.length < 2) continue
    if (!currentBrand) continue

    // Map status to standard values
    const mapStatus = (s) => {
      if (!s) return 'Not Started'
      const sl = s.toLowerCase()
      if (sl.includes('complete') || sl.includes('approved') || sl.includes('delivered') || sl.includes('received')) return 'Ready'
      if (sl.includes('progress') || sl.includes('samples') || sl.includes('ordered') || sl.includes('print')) return 'In Development'
      if (sl.includes('testing') || sl.includes('stability')) return 'Stability Testing'
      if (sl.includes('decision') || sl.includes('sourcing') || sl.includes('concept')) return 'Formulating'
      return s
    }

    products.push({
      id: `cst-${++idCounter}`,
      name,
      marketingName: productName || productType,
      clientBrand: currentBrand,
      brand: currentBrand,
      client: currentClient,
      formulaNumber: formulaSKU || sku || '',
      upc,
      status: mapStatus(formulaStatus || bottleStatus),
      formulaStatus: mapStatus(formulaStatus),
      bottleStatus: mapStatus(bottleStatus),
      packagingStatus: mapStatus(bottleStatus),
      artworkStatus: mapStatus(artworkStatus),
      launchStatus: '',
      source: 'drive',
    })
  }

  return products.length > 0 ? products : null
}

// ── Parse Purchasing from Client Status Tracker ───────────────────────────────
function parsePurchasingFromTracker(sources) {
  const tracker = sources.find(s => s.label === 'Client Status Tracker')
  if (!tracker?.rawContent) return null

  const lines = tracker.rawContent.split('\n').map(l => l.trim())
  const items = []
  let currentBrand = '', idCounter = 0

  for (let i = 2; i < lines.length; i++) {
    const line = lines[i]
    if (!line || line === ','.repeat(line.length)) continue

    const cols = []
    let cur = '', inQ = false
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ }
      else if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = '' }
      else cur += ch
    }
    cols.push(cur.trim())

    const brand = cols[0]?.replace(/"/g, '').trim()
    const productType = cols[2]?.replace(/"/g, '').trim()
    const productName = cols[3]?.replace(/"/g, '').trim()
    const formulaSKU  = cols[8]?.replace(/"/g, '').trim()
    // Bottle print job (cols ~31-36): supplier, status, completion date
    const bottlePrintSupplier = cols[31]?.replace(/"/g, '').trim()
    const bottlePrintStatus   = cols[32]?.replace(/"/g, '').trim()
    const bottlePrintDate     = cols[33]?.replace(/"/g, '').trim()
    // Box print job (cols ~37-41)
    const boxPrintSupplier    = cols[37]?.replace(/"/g, '').trim()
    const boxPrintStatus      = cols[38]?.replace(/"/g, '').trim()
    const boxPrintDate        = cols[39]?.replace(/"/g, '').trim()

    if (brand) currentBrand = brand

    const itemName = [productName || productType, formulaSKU].filter(Boolean).join(' · ')
    if (!itemName || itemName.length < 2) continue

    if (bottlePrintStatus && !bottlePrintStatus.toLowerCase().includes('false') && bottlePrintSupplier) {
      items.push({
        id: `po-bottle-${++idCounter}`,
        name: itemName,
        brand: currentBrand,
        supplier: bottlePrintSupplier,
        type: bottlePrintStatus.toLowerCase().includes('received') || bottlePrintStatus.toLowerCase().includes('complete') ? 'PO' : 'Production Order',
        status: bottlePrintStatus,
        date: bottlePrintDate || null,
        source: 'drive',
      })
    }

    if (boxPrintStatus && !boxPrintStatus.toLowerCase().includes('false') && boxPrintSupplier) {
      items.push({
        id: `po-box-${++idCounter}`,
        name: `${itemName} (Box)`,
        brand: currentBrand,
        supplier: boxPrintSupplier,
        type: boxPrintStatus.toLowerCase().includes('received') || boxPrintStatus.toLowerCase().includes('complete') ? 'PO' : 'Production Order',
        status: boxPrintStatus,
        date: boxPrintDate || null,
        source: 'drive',
      })
    }
  }

  return items.length > 0 ? items : null
}

// ── Load data ─────────────────────────────────────────────────────────────────
const sources = read('sources.json')
const parsedProducts   = parseClientStatusTracker(sources)
const parsedPurchasing = parsePurchasingFromTracker(sources)

// Use Drive-parsed data when available, fall back to static JSON
const products  = parsedProducts   || read('products.json')
const purchasingData = parsedPurchasing && parsedPurchasing.length > 0
  ? parsedPurchasing
  : purchasing

// Google Calendar — pull from cache
const gcalCache  = read('gcal-cache.json', { events: [] })
const gcalEvents = (gcalCache.events || []).map(e => ({
  ...e,
  id:     e.uid || e.id || Math.random().toString(36),
  date:   (e.start || '').slice(0, 10),
  source: 'gcal',
  type:   'Google Calendar',
}))

const staticData = {
  generatedAt: new Date().toISOString(),
  products,
  formulas,
  packaging,
  manufacturing,
  content,
  decisions,
  intelligence,
  contacts,
  brandHealth,
  projects,
  suppliers,
  purchasing: purchasingData,
  inventory,
  websiteProjects,
  calendar,
  importItems,
  alibabaCo,
  links,
  gcalEvents,
  driveHub,
  tasks: driveTasks,
  gmailThreads: [],
  driveFiles:   [],
}

const output = `// AUTO-GENERATED by scripts/generate-static-data.js — do not edit manually
// Regenerated: ${new Date().toISOString()}
const staticData = ${JSON.stringify(staticData, null, 2)}

export default staticData
`

fs.writeFileSync(OUTPUT, output)
console.log(`[generate-static-data] Written ${OUTPUT}`)
console.log(`  products:     ${products.length} (${parsedProducts ? 'from Drive' : 'from JSON'})`)
console.log(`  purchasing:   ${purchasingData.length} (${parsedPurchasing?.length ? 'from Drive' : 'from JSON'})`)
console.log(`  calendar:     ${calendar.length} events`)
console.log(`  gcalEvents:   ${gcalEvents.length} events`)
console.log(`  projects:     ${projects.length}`)
console.log(`  tasks:        ${driveTasks.length} (from Drive)`)
console.log(`  decisions:    ${decisions.length}`)
console.log(`  suppliers:    ${suppliers.length}`)
