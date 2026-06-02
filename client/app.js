/* ── TCF Command Center — app.js ─────────────────────────────────────────── */

const API = 'http://localhost:3001/api';

// ── State ─────────────────────────────────────────────────────────────────────
const state = {
  tab: 'brand',
  products: [],
  packaging: [],
  formulas: [],
  manufacturing: [],
  content: [],
  decisions: [],
  intelligence: [],
  notionTasks: [],
  gmailThreads: [],
  driveFiles: [],
  brandHealth: { streak: 0, lastUpdated: null },
  notionFilter: 'all',
  packagingFilter: 'all',
  formulaFilter: 'all',
  contentFilter: 'all',
  filesFilter: 'all',
  intelCat: 'all',
  driveSearch: '',
  modal: { type: null, data: null, resolve: null },
};

// ── Fetch helpers ─────────────────────────────────────────────────────────────
async function api(path, opts = {}) {
  const res = await fetch(API + path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts.body && typeof opts.body === 'object' && !(opts.body instanceof FormData)
      ? JSON.stringify(opts.body)
      : opts.body,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

const get = (path) => api(path);
const post = (path, body) => api(path, { method: 'POST', body });
const patch = (path, body) => api(path, { method: 'PATCH', body });
const del = (path) => api(path, { method: 'DELETE' });

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initNav();
  initModal();
  initThreadPanel();
  initUpload();
  loadAll();
});

function initNav() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  document.getElementById('refresh-btn').addEventListener('click', loadAll);
}

function switchTab(tab) {
  state.tab = tab;
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `tab-${tab}`));
}

// ── Load All ──────────────────────────────────────────────────────────────────
async function loadAll() {
  setSyncStatus('Syncing…');
  const tasks = [
    loadLocalData(),
    loadNotionTasks(),
    loadGmailThreads(),
    loadDriveFiles(),
  ];
  await Promise.allSettled(tasks);
  setSyncStatus('Synced ' + timeStr());
  renderAll();
}

async function loadLocalData() {
  const [products, packaging, formulas, manufacturing, content, decisions, intelligence, brandHealth] = await Promise.all([
    get('/data/products').catch(() => []),
    get('/data/packaging').catch(() => []),
    get('/data/formulas').catch(() => []),
    get('/data/manufacturing').catch(() => []),
    get('/data/content').catch(() => []),
    get('/data/decisions').catch(() => []),
    get('/data/intelligence').catch(() => []),
    get('/data/brand-health').catch(() => ({ streak: 0, lastUpdated: null })),
  ]);
  state.products = products;
  state.packaging = packaging;
  state.formulas = formulas;
  state.manufacturing = manufacturing;
  state.content = content;
  state.decisions = decisions;
  state.intelligence = intelligence;
  state.brandHealth = brandHealth;
}

async function loadNotionTasks() {
  try {
    state.notionTasks = await get('/notion/tasks');
  } catch (e) {
    console.warn('Notion unavailable:', e.message);
  }
}

async function loadGmailThreads() {
  try {
    state.gmailThreads = await get('/gmail/threads?limit=40');
  } catch (e) {
    console.warn('Gmail unavailable:', e.message);
  }
}

async function loadDriveFiles() {
  try {
    state.driveFiles = await get('/drive/recent?limit=60');
  } catch (e) {
    console.warn('Drive unavailable:', e.message);
  }
}

function renderAll() {
  renderScorecard();
  renderProducts();
  renderDecisions();
  renderActionableEmail();
  renderPackaging();
  renderFormulas();
  renderManufacturing();
  renderContent();
  renderNotionTasks();
  renderGmailInbox();
  renderDriveFiles();
  renderIntelligence();
  bindFilterBars();
  bindTabButtons();
}

// ── Scorecard ─────────────────────────────────────────────────────────────────
function renderScorecard() {
  const launchStages = countBy(state.products, 'status');
  const launchTotal = state.products.length;

  const activeClients = state.formulas.filter(f =>
    f.brand === 'TCF Client' && ['In Development', 'Stability Testing'].includes(f.status)
  ).length;

  const pendingPkg = state.packaging.filter(p => p.status === 'Pending Approval').length;

  const openDecisions = state.decisions.filter(d => !d.resolved).length;

  const streak = state.brandHealth?.streak || 0;

  const cards = [
    { label: 'Product Launches', value: launchTotal, sub: formatStages(launchStages), cls: 'teal', action: () => switchTab('brand') },
    { label: 'Active Client Projects', value: activeClients, sub: 'In dev or testing', cls: activeClients > 0 ? 'green' : '', action: () => switchTab('formulas') },
    { label: 'Packaging Pending', value: pendingPkg, sub: 'Awaiting approval', cls: pendingPkg > 0 ? 'amber' : '', action: () => switchTab('packaging') },
    {
      label: 'Content Streak', value: streak, sub: 'Days posting',
      cls: streak >= 7 ? 'green' : streak > 0 ? 'teal' : '',
      action: null, isStreak: true
    },
    { label: 'Open Decisions', value: openDecisions, sub: 'Need resolution', cls: openDecisions > 0 ? 'red' : '', action: () => switchTab('brand') },
  ];

  const el = document.getElementById('scorecard');
  el.innerHTML = cards.map(c => `
    <div class="kpi-card" ${c.action ? 'style="cursor:pointer"' : ''}>
      <div class="kpi-label">${c.label}</div>
      <div class="kpi-value ${c.cls}">${c.value}</div>
      <div class="kpi-sub">${c.sub}</div>
      ${c.isStreak ? `<div class="streak-controls">
        <button class="streak-btn" id="streak-inc">+ Day</button>
        <button class="streak-btn" id="streak-reset">Reset</button>
      </div>` : ''}
    </div>
  `).join('');

  cards.forEach((c, i) => {
    if (c.action) el.children[i].addEventListener('click', c.action);
  });

  el.querySelector('#streak-inc')?.addEventListener('click', async (e) => {
    e.stopPropagation();
    state.brandHealth = await post('/data/brand-health/increment-streak', {});
    renderScorecard();
  });
  el.querySelector('#streak-reset')?.addEventListener('click', async (e) => {
    e.stopPropagation();
    state.brandHealth = await post('/data/brand-health/reset-streak', {});
    renderScorecard();
  });
}

function countBy(arr, key) {
  return arr.reduce((acc, item) => {
    acc[item[key]] = (acc[item[key]] || 0) + 1;
    return acc;
  }, {});
}

function formatStages(stages) {
  return Object.entries(stages).map(([k, v]) => `${v} ${k}`).join(' · ') || 'None yet';
}

// ── Products ──────────────────────────────────────────────────────────────────
const PRODUCT_STATUSES = ['In Development', 'Stability Testing', 'Approved', 'Ready'];
const PRODUCT_BRANDS = ['TCF House Brand', 'TCF Client'];
const STATUS_CLASS = {
  'In Development': 'status-dev',
  'Stability Testing': 'status-testing',
  'Approved': 'status-approved',
  'Ready': 'status-ready',
};

function renderProducts() {
  const container = document.getElementById('product-cards');
  container.innerHTML = state.products.map(p => productCard(p)).join('') +
    `<div class="add-product-placeholder" id="add-product-inline">+ Add Product</div>`;

  container.querySelectorAll('[data-product-id]').forEach(card => {
    const id = card.dataset.productId;
    const nameEl = card.querySelector('.product-card-name');
    const brandSel = card.querySelector('[data-field="brand"]');
    const statusSel = card.querySelector('[data-field="status"]');
    const noteEl = card.querySelector('[data-field="notes"]');
    const delBtn = card.querySelector('.product-card-delete');

    nameEl.addEventListener('blur', () => saveProduct(id, { name: nameEl.textContent.trim() }));
    nameEl.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); nameEl.blur(); } });
    brandSel.addEventListener('change', () => saveProduct(id, { brand: brandSel.value }));
    statusSel.addEventListener('change', () => {
      saveProduct(id, { status: statusSel.value });
      card.className = `product-card ${STATUS_CLASS[statusSel.value] || ''}`;
    });
    if (noteEl) noteEl.addEventListener('blur', () => saveProduct(id, { notes: noteEl.textContent.trim() }));
    delBtn.addEventListener('click', () => deleteProduct(id));
  });

  container.querySelector('#add-product-inline')?.addEventListener('click', openAddProductModal);
  document.getElementById('add-product-btn').onclick = openAddProductModal;
}

function productCard(p) {
  const statusClass = STATUS_CLASS[p.status] || '';
  const brandClass = p.brand === 'TCF House Brand' ? 'brand-house' : 'brand-client';
  return `
    <div class="product-card ${statusClass}" data-product-id="${p.id}">
      <button class="btn-danger product-card-delete">✕</button>
      <div class="product-card-name" contenteditable="true" spellcheck="false">${esc(p.name || 'New Product')}</div>
      <select data-field="brand">
        ${PRODUCT_BRANDS.map(b => `<option ${p.brand === b ? 'selected' : ''}>${b}</option>`).join('')}
      </select>
      <select data-field="status" style="margin-top:0.5rem">
        ${PRODUCT_STATUSES.map(s => `<option ${p.status === s ? 'selected' : ''}>${s}</option>`).join('')}
      </select>
      ${p.notes !== undefined ? `<div data-field="notes" contenteditable="true" spellcheck="false" style="margin-top:0.5rem;font-size:11.5px;color:var(--text-muted);min-height:20px" placeholder="Notes…">${esc(p.notes || '')}</div>` : ''}
    </div>
  `;
}

async function saveProduct(id, changes) {
  try {
    const updated = await patch(`/data/products/${id}`, changes);
    const idx = state.products.findIndex(p => p.id === id);
    if (idx !== -1) state.products[idx] = updated;
    renderScorecard();
  } catch (e) { console.error(e); }
}

async function deleteProduct(id) {
  if (!confirm('Remove this product?')) return;
  await del(`/data/products/${id}`);
  state.products = state.products.filter(p => p.id !== id);
  renderProducts();
  renderScorecard();
}

async function openAddProductModal() {
  const data = await showModal('Add Product', [
    { id: 'name', label: 'Product Name', type: 'text', placeholder: 'e.g. Vitamin C Serum' },
    { id: 'brand', label: 'Brand', type: 'select', options: PRODUCT_BRANDS },
    { id: 'status', label: 'Status', type: 'select', options: PRODUCT_STATUSES },
    { id: 'notes', label: 'Notes', type: 'textarea' },
  ]);
  if (!data) return;
  const product = await post('/data/products', { ...data, status: data.status || 'In Development', brand: data.brand || 'TCF House Brand' });
  state.products.push(product);
  renderProducts();
  renderScorecard();
}

// ── Decisions ─────────────────────────────────────────────────────────────────
function renderDecisions() {
  const container = document.getElementById('decisions-list');
  const open = state.decisions.filter(d => !d.resolved);
  if (!open.length) {
    container.innerHTML = '<div class="empty-state">No open decisions</div>';
  } else {
    container.innerHTML = open.map(d => `
      <div class="decision-item" data-id="${d.id}">
        <div class="decision-dot"></div>
        <div style="flex:1;min-width:0">
          <div class="decision-title">${esc(d.title)}</div>
          ${d.context ? `<div class="decision-context">${esc(d.context)}</div>` : ''}
          ${d.dueDate ? `<div class="decision-context">Due: ${fmtDate(d.dueDate)}</div>` : ''}
        </div>
        <div style="display:flex;gap:4px;flex-shrink:0">
          <button class="streak-btn decision-resolve">✓</button>
          <button class="btn-danger decision-del">✕</button>
        </div>
      </div>
    `).join('');

    container.querySelectorAll('[data-id]').forEach(item => {
      const id = item.dataset.id;
      item.querySelector('.decision-resolve').addEventListener('click', () => resolveDecision(id));
      item.querySelector('.decision-del').addEventListener('click', () => deleteDecision(id));
    });
  }

  document.getElementById('add-decision-btn').onclick = openAddDecisionModal;
}

async function resolveDecision(id) {
  await patch(`/data/decisions/${id}`, { resolved: true });
  const d = state.decisions.find(d => d.id === id);
  if (d) d.resolved = true;
  renderDecisions();
  renderScorecard();
}

async function deleteDecision(id) {
  await del(`/data/decisions/${id}`);
  state.decisions = state.decisions.filter(d => d.id !== id);
  renderDecisions();
  renderScorecard();
}

async function openAddDecisionModal() {
  const data = await showModal('Add Decision', [
    { id: 'title', label: 'Decision Needed', type: 'text', placeholder: 'e.g. Choose bottle supplier for Serum B' },
    { id: 'context', label: 'Context', type: 'textarea' },
    { id: 'dueDate', label: 'Due By', type: 'date' },
  ]);
  if (!data) return;
  const item = await post('/data/decisions', data);
  state.decisions.push(item);
  renderDecisions();
  renderScorecard();
}

// ── Actionable Email (Brand tab) ──────────────────────────────────────────────
function renderActionableEmail() {
  const container = document.getElementById('actionable-email');
  const actionable = state.gmailThreads.filter(t => t.actionable || t.stale).slice(0, 12);

  if (!actionable.length) {
    container.innerHTML = '<div class="empty-state">No flagged emails — inbox clear</div>';
  } else {
    container.innerHTML = actionable.map(t => emailItem(t)).join('');
    container.querySelectorAll('.email-item').forEach(item => {
      item.addEventListener('click', () => openThread(item.dataset.id));
    });
  }

  document.getElementById('refresh-gmail-btn').onclick = async () => {
    document.getElementById('refresh-gmail-btn').textContent = '↻ Loading…';
    await loadGmailThreads();
    renderActionableEmail();
    renderGmailInbox();
    document.getElementById('refresh-gmail-btn').textContent = '↻ Refresh';
  };
}

// ── Packaging ─────────────────────────────────────────────────────────────────
const PKG_STATUSES = ['Sourcing', 'Sampling', 'Pending Approval', 'Approved', 'In Production', 'Received'];
const PKG_TYPES = ['Bottle', 'Pump', 'Cap', 'Label', 'Box', 'Tube', 'Jar', 'Dropper', 'Carton', 'Bag', 'Other'];

function renderPackaging() {
  const filter = state.packagingFilter;
  const items = filter === 'all' ? state.packaging : state.packaging.filter(p => p.status === filter);
  const tbody = document.getElementById('packaging-tbody');

  tbody.innerHTML = items.length
    ? items.map(p => packagingRow(p)).join('')
    : `<tr><td colspan="10" class="empty-state">No packaging items</td></tr>`;

  tbody.querySelectorAll('[data-pkg-id]').forEach(row => {
    const id = row.dataset.pkgId;
    row.querySelectorAll('[data-field]').forEach(cell => {
      const field = cell.dataset.field;
      const input = cell.querySelector('select, input');
      if (input) {
        const evt = input.tagName === 'SELECT' ? 'change' : 'blur';
        input.addEventListener(evt, () => savePkg(id, { [field]: input.value }));
      }
    });
    row.querySelector('.row-del')?.addEventListener('click', async () => {
      if (!confirm('Remove this item?')) return;
      await del(`/data/packaging/${id}`);
      state.packaging = state.packaging.filter(p => p.id !== id);
      renderPackaging();
      renderScorecard();
    });
  });

  document.getElementById('add-packaging-btn').onclick = openAddPackagingModal;
}

function packagingRow(p) {
  return `
    <tr data-pkg-id="${p.id}">
      <td data-field="item"><input value="${esc(p.item || '')}" placeholder="Item name" style="min-width:120px" /></td>
      <td data-field="brand"><input value="${esc(p.brand || '')}" placeholder="Brand/Client" /></td>
      <td data-field="type">
        <select>${PKG_TYPES.map(t => `<option ${p.type === t ? 'selected' : ''}>${t}</option>`).join('')}</select>
      </td>
      <td data-field="supplier"><input value="${esc(p.supplier || '')}" placeholder="Supplier" /></td>
      <td data-field="status">
        <select>${PKG_STATUSES.map(s => `<option ${p.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
      </td>
      <td data-field="moq"><input value="${esc(p.moq || '')}" placeholder="—" style="max-width:60px" /></td>
      <td data-field="leadTime"><input value="${esc(p.leadTime || '')}" placeholder="—" style="max-width:80px" /></td>
      <td data-field="dueDate"><input type="date" value="${p.dueDate || ''}" /></td>
      <td data-field="notes"><input value="${esc(p.notes || '')}" placeholder="Notes" /></td>
      <td class="td-actions"><button class="btn-danger row-del">✕</button></td>
    </tr>
  `;
}

async function savePkg(id, changes) {
  try {
    const updated = await patch(`/data/packaging/${id}`, changes);
    const idx = state.packaging.findIndex(p => p.id === id);
    if (idx !== -1) state.packaging[idx] = updated;
    renderScorecard();
  } catch (e) { console.error(e); }
}

async function openAddPackagingModal() {
  const data = await showModal('Add Packaging Item', [
    { id: 'item', label: 'Item Name', type: 'text', placeholder: 'e.g. 30ml Frosted Glass Dropper' },
    { id: 'brand', label: 'Brand / Client', type: 'text' },
    { id: 'type', label: 'Type', type: 'select', options: PKG_TYPES },
    { id: 'supplier', label: 'Supplier', type: 'text' },
    { id: 'status', label: 'Status', type: 'select', options: PKG_STATUSES },
    { id: 'moq', label: 'MOQ', type: 'text' },
    { id: 'leadTime', label: 'Lead Time', type: 'text', placeholder: 'e.g. 8 weeks' },
    { id: 'dueDate', label: 'Due Date', type: 'date' },
    { id: 'notes', label: 'Notes', type: 'textarea' },
  ]);
  if (!data) return;
  const item = await post('/data/packaging', { ...data, status: data.status || 'Sourcing' });
  state.packaging.push(item);
  renderPackaging();
  renderScorecard();
}

// ── Formulas ──────────────────────────────────────────────────────────────────
const FORMULA_STATUSES = ['Concept', 'In Development', 'Stability Testing', 'Approved', 'Production'];
const FORMULA_CATEGORIES = ['Serum', 'Moisturizer', 'Cleanser', 'Toner', 'SPF', 'Mask', 'Eye Care', 'Body', 'Lip', 'Hair', 'Fragrance', 'Other'];

function renderFormulas() {
  const filter = state.formulaFilter;
  const items = filter === 'all' ? state.formulas : state.formulas.filter(f => f.status === filter);
  const tbody = document.getElementById('formulas-tbody');

  tbody.innerHTML = items.length
    ? items.map(f => formulaRow(f)).join('')
    : `<tr><td colspan="9" class="empty-state">No formulas yet</td></tr>`;

  tbody.querySelectorAll('[data-formula-id]').forEach(row => {
    const id = row.dataset.formulaId;
    row.querySelectorAll('[data-field]').forEach(cell => {
      const field = cell.dataset.field;
      const input = cell.querySelector('select, input');
      if (input) {
        const evt = input.tagName === 'SELECT' ? 'change' : 'blur';
        input.addEventListener(evt, () => saveFormula(id, { [field]: input.value }));
      }
    });
    row.querySelector('.row-del')?.addEventListener('click', async () => {
      if (!confirm('Remove this formula?')) return;
      await del(`/data/formulas/${id}`);
      state.formulas = state.formulas.filter(f => f.id !== id);
      renderFormulas();
      renderScorecard();
    });
  });

  document.getElementById('add-formula-btn').onclick = openAddFormulaModal;
}

function formulaRow(f) {
  return `
    <tr data-formula-id="${f.id}">
      <td data-field="name"><input value="${esc(f.name || '')}" placeholder="Formula name" style="min-width:160px" /></td>
      <td data-field="brand"><input value="${esc(f.brand || '')}" placeholder="Brand/Client" /></td>
      <td data-field="category">
        <select>${FORMULA_CATEGORIES.map(c => `<option ${f.category === c ? 'selected' : ''}>${c}</option>`).join('')}</select>
      </td>
      <td data-field="status">
        <select>${FORMULA_STATUSES.map(s => `<option ${f.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
      </td>
      <td data-field="chemist"><input value="${esc(f.chemist || '')}" placeholder="Chemist" /></td>
      <td data-field="batch"><input value="${esc(f.batch || '')}" placeholder="Batch #" style="max-width:90px" /></td>
      <td data-field="targetDate"><input type="date" value="${f.targetDate || ''}" /></td>
      <td data-field="notes"><input value="${esc(f.notes || '')}" placeholder="Notes" /></td>
      <td class="td-actions"><button class="btn-danger row-del">✕</button></td>
    </tr>
  `;
}

async function saveFormula(id, changes) {
  try {
    const updated = await patch(`/data/formulas/${id}`, changes);
    const idx = state.formulas.findIndex(f => f.id === id);
    if (idx !== -1) state.formulas[idx] = updated;
    renderScorecard();
  } catch (e) { console.error(e); }
}

async function openAddFormulaModal() {
  const data = await showModal('Add Formula', [
    { id: 'name', label: 'Formula Name', type: 'text', placeholder: 'e.g. Barrier Repair Moisturizer v2' },
    { id: 'brand', label: 'Brand / Client', type: 'text' },
    { id: 'category', label: 'Category', type: 'select', options: FORMULA_CATEGORIES },
    { id: 'status', label: 'Status', type: 'select', options: FORMULA_STATUSES },
    { id: 'chemist', label: 'Chemist', type: 'text' },
    { id: 'batch', label: 'Batch #', type: 'text' },
    { id: 'targetDate', label: 'Target Date', type: 'date' },
    { id: 'notes', label: 'Notes', type: 'textarea' },
  ]);
  if (!data) return;
  const item = await post('/data/formulas', { ...data, status: data.status || 'In Development' });
  state.formulas.push(item);
  renderFormulas();
  renderScorecard();
}

// ── Manufacturing ─────────────────────────────────────────────────────────────
const MFG_STAGES = ['Scheduled', 'In Progress', 'QC Review', 'Filling', 'Complete'];
const MFG_IDS = { 'Scheduled': 'mfg-scheduled', 'In Progress': 'mfg-inprogress', 'QC Review': 'mfg-qc', 'Filling': 'mfg-filling', 'Complete': 'mfg-complete' };

function renderManufacturing() {
  MFG_STAGES.forEach(stage => {
    const col = document.getElementById(MFG_IDS[stage]);
    const items = state.manufacturing.filter(m => m.stage === stage);
    col.innerHTML = items.length
      ? items.map(m => mfgCard(m)).join('')
      : `<div style="padding:8px;color:var(--text-muted);font-size:11px">Empty</div>`;

    col.querySelectorAll('[data-mfg-id]').forEach(card => {
      card.addEventListener('click', () => openEditMfgModal(card.dataset.mfgId));
    });
  });

  document.getElementById('add-mfg-btn').onclick = openAddMfgModal;
}

function mfgCard(m) {
  return `
    <div class="pipeline-card" data-mfg-id="${m.id}">
      <div class="pipeline-card-title">${esc(m.name || 'Run')}</div>
      <div class="pipeline-card-meta">
        ${m.formula ? `<div>${esc(m.formula)}</div>` : ''}
        ${m.batchSize ? `<div>Batch: ${esc(m.batchSize)}</div>` : ''}
        ${m.runDate ? `<div>${fmtDate(m.runDate)}</div>` : ''}
        ${m.notes ? `<div style="margin-top:4px;color:var(--text-muted)">${esc(m.notes)}</div>` : ''}
      </div>
    </div>
  `;
}

async function openAddMfgModal() {
  const data = await showModal('Add Manufacturing Run', [
    { id: 'name', label: 'Run Name', type: 'text', placeholder: 'e.g. Vitamin C Serum — Run 3' },
    { id: 'formula', label: 'Formula', type: 'text' },
    { id: 'batchSize', label: 'Batch Size', type: 'text', placeholder: 'e.g. 500 units' },
    { id: 'stage', label: 'Stage', type: 'select', options: MFG_STAGES },
    { id: 'runDate', label: 'Run Date', type: 'date' },
    { id: 'notes', label: 'Notes', type: 'textarea' },
  ]);
  if (!data) return;
  const item = await post('/data/manufacturing', { ...data, stage: data.stage || 'Scheduled' });
  state.manufacturing.push(item);
  renderManufacturing();
}

async function openEditMfgModal(id) {
  const m = state.manufacturing.find(m => m.id === id);
  if (!m) return;
  const data = await showModal('Edit Manufacturing Run', [
    { id: 'name', label: 'Run Name', type: 'text', value: m.name },
    { id: 'formula', label: 'Formula', type: 'text', value: m.formula },
    { id: 'batchSize', label: 'Batch Size', type: 'text', value: m.batchSize },
    { id: 'stage', label: 'Stage', type: 'select', options: MFG_STAGES, value: m.stage },
    { id: 'runDate', label: 'Run Date', type: 'date', value: m.runDate },
    { id: 'notes', label: 'Notes', type: 'textarea', value: m.notes },
  ], { showDelete: true });
  if (data === 'DELETE') {
    await del(`/data/manufacturing/${id}`);
    state.manufacturing = state.manufacturing.filter(m => m.id !== id);
  } else if (data) {
    const updated = await patch(`/data/manufacturing/${id}`, data);
    const idx = state.manufacturing.findIndex(m => m.id === id);
    if (idx !== -1) state.manufacturing[idx] = updated;
  }
  renderManufacturing();
}

// ── Content ───────────────────────────────────────────────────────────────────
const CONTENT_STAGES = ['Idea', 'Scripted', 'Filmed', 'Editing', 'Scheduled', 'Published'];
const CONTENT_IDS = { 'Idea': 'content-idea', 'Scripted': 'content-scripted', 'Filmed': 'content-filmed', 'Editing': 'content-editing', 'Scheduled': 'content-scheduled', 'Published': 'content-published' };
const CONTENT_PLATFORMS = ['Instagram', 'TikTok', 'YouTube', 'LinkedIn', 'Pinterest', 'Email', 'Blog', 'Other'];

function renderContent() {
  CONTENT_STAGES.forEach(stage => {
    const col = document.getElementById(CONTENT_IDS[stage]);
    const items = state.content.filter(c => c.stage === stage);
    col.innerHTML = items.length
      ? items.map(c => contentCard(c)).join('')
      : `<div style="padding:8px;color:var(--text-muted);font-size:11px">Empty</div>`;

    col.querySelectorAll('[data-content-id]').forEach(card => {
      card.addEventListener('click', () => openEditContentModal(card.dataset.contentId));
    });
  });

  document.getElementById('add-content-btn').onclick = openAddContentModal;
}

function contentCard(c) {
  return `
    <div class="pipeline-card" data-content-id="${c.id}">
      <div class="pipeline-card-title">${esc(c.title || 'Untitled')}</div>
      <div class="pipeline-card-meta">
        ${c.platform ? `<span class="tag">${esc(c.platform)}</span> ` : ''}
        ${c.postDate ? `<div style="margin-top:4px">${fmtDate(c.postDate)}</div>` : ''}
        ${c.hook ? `<div style="margin-top:4px;color:var(--text-muted)">"${esc(c.hook.slice(0, 60))}…"</div>` : ''}
      </div>
    </div>
  `;
}

async function openAddContentModal() {
  const data = await showModal('Add Content', [
    { id: 'title', label: 'Title', type: 'text', placeholder: 'e.g. Behind the formula: Barrier Repair' },
    { id: 'platform', label: 'Platform', type: 'select', options: CONTENT_PLATFORMS },
    { id: 'stage', label: 'Stage', type: 'select', options: CONTENT_STAGES },
    { id: 'hook', label: 'Hook / Concept', type: 'textarea' },
    { id: 'postDate', label: 'Post Date', type: 'date' },
  ]);
  if (!data) return;
  const item = await post('/data/content', { ...data, stage: data.stage || 'Idea' });
  state.content.push(item);
  renderContent();
  renderScorecard();
}

async function openEditContentModal(id) {
  const c = state.content.find(c => c.id === id);
  if (!c) return;
  const data = await showModal('Edit Content', [
    { id: 'title', label: 'Title', type: 'text', value: c.title },
    { id: 'platform', label: 'Platform', type: 'select', options: CONTENT_PLATFORMS, value: c.platform },
    { id: 'stage', label: 'Stage', type: 'select', options: CONTENT_STAGES, value: c.stage },
    { id: 'hook', label: 'Hook / Concept', type: 'textarea', value: c.hook },
    { id: 'postDate', label: 'Post Date', type: 'date', value: c.postDate },
  ], { showDelete: true });
  if (data === 'DELETE') {
    await del(`/data/content/${id}`);
    state.content = state.content.filter(c => c.id !== id);
  } else if (data) {
    const updated = await patch(`/data/content/${id}`, data);
    const idx = state.content.findIndex(c => c.id === id);
    if (idx !== -1) state.content[idx] = updated;
  }
  renderContent();
}

// ── Notion Tasks ──────────────────────────────────────────────────────────────
function renderNotionTasks() {
  const container = document.getElementById('notion-tasks');
  const statusEl = document.getElementById('notion-status');
  const filter = state.notionFilter;

  let tasks = state.notionTasks;
  if (filter !== 'all') tasks = tasks.filter(t => t.category === filter || t.categories?.includes(filter));
  tasks = tasks.filter(t => !t.done).slice(0, 50);

  if (!state.notionTasks.length) {
    container.innerHTML = '<div class="empty-state">Notion not connected — add NOTION_TOKEN to .env</div>';
    return;
  }

  container.innerHTML = tasks.length
    ? tasks.map(t => notionTaskItem(t)).join('')
    : '<div class="empty-state">No open tasks matching filter</div>';

  container.querySelectorAll('[data-task-id]').forEach(item => {
    const id = item.dataset.taskId;
    item.querySelector('.notion-task-checkbox')?.addEventListener('click', () => toggleTask(id));
    item.querySelector('.notion-open-btn')?.addEventListener('click', () => window.open(`https://notion.so/${id.replace(/-/g, '')}`, '_blank'));
  });

  document.getElementById('add-task-btn').onclick = openAddTaskModal;
}

function notionTaskItem(t) {
  const priorityCls = t.priority === 'High' ? 'priority-high' : t.priority === 'Medium' ? 'priority-medium' : 'priority-low';
  return `
    <div class="notion-task" data-task-id="${t.id}">
      <div class="notion-task-checkbox ${t.done ? 'done' : ''}"></div>
      <div class="notion-task-body">
        <div class="notion-task-title ${t.done ? 'done' : ''}">${esc(t.title || 'Untitled')}</div>
        <div class="notion-task-meta">
          ${t.status ? `<span class="badge">${esc(t.status)}</span>` : ''}
          ${t.priority ? `<span class="badge ${priorityCls}">${esc(t.priority)}</span>` : ''}
          ${t.category ? `<span class="badge">${esc(t.category)}</span>` : ''}
          ${t.dueDate ? `<span class="badge ${isOverdue(t.dueDate) ? 'badge-red' : ''}">${fmtDate(t.dueDate)}</span>` : ''}
        </div>
      </div>
      <div style="display:flex;gap:4px;opacity:0;transition:opacity 0.15s" class="task-hover-actions">
        <button class="streak-btn notion-open-btn" title="Open in Notion">↗</button>
      </div>
    </div>
  `;
}

document.addEventListener('mouseover', e => {
  const task = e.target.closest('.notion-task');
  if (task) task.querySelector('.task-hover-actions')?.style.setProperty('opacity', '1');
});
document.addEventListener('mouseout', e => {
  const task = e.target.closest('.notion-task');
  if (task && !task.contains(e.relatedTarget)) task.querySelector('.task-hover-actions')?.style.setProperty('opacity', '0');
});

async function toggleTask(id) {
  const task = state.notionTasks.find(t => t.id === id);
  if (!task) return;
  try {
    await patch(`/notion/tasks/${id}`, { done: !task.done });
    task.done = !task.done;
    renderNotionTasks();
  } catch (e) { console.error(e); }
}

async function openAddTaskModal() {
  const data = await showModal('Add Notion Task', [
    { id: 'title', label: 'Task', type: 'text', placeholder: 'What needs to be done?' },
    { id: 'status', label: 'Status', type: 'select', options: ['Not Started', 'In Progress', 'Done'] },
    { id: 'priority', label: 'Priority', type: 'select', options: ['High', 'Medium', 'Low'] },
    { id: 'category', label: 'Category', type: 'select', options: ['Packaging', 'Design', 'Manufacturing', 'Content', 'Business', 'Other'] },
    { id: 'dueDate', label: 'Due Date', type: 'date' },
  ]);
  if (!data) return;
  try {
    const task = await post('/notion/tasks', data);
    state.notionTasks.unshift(task);
    renderNotionTasks();
  } catch (e) {
    alert('Could not create task in Notion: ' + e.message);
  }
}

// ── Gmail Inbox ───────────────────────────────────────────────────────────────
function renderGmailInbox() {
  const container = document.getElementById('gmail-threads');
  const countEl = document.getElementById('gmail-count');
  const unread = state.gmailThreads.filter(t => t.isUnread).length;
  if (countEl) countEl.textContent = unread ? `${unread} unread` : '';

  if (!state.gmailThreads.length) {
    container.innerHTML = '<div class="empty-state">Gmail not connected — add OAuth tokens to .env</div>';
    return;
  }

  container.innerHTML = state.gmailThreads.slice(0, 40).map(t => emailItem(t)).join('');
  container.querySelectorAll('.email-item').forEach(item => {
    item.addEventListener('click', () => openThread(item.dataset.id));
  });
}

function emailItem(t) {
  const cls = [
    'email-item',
    t.isUnread ? 'unread' : '',
    t.stale ? 'stale' : '',
    t.actionable ? 'actionable' : '',
  ].filter(Boolean).join(' ');

  const fromName = t.from ? t.from.replace(/<[^>]+>/, '').trim() : '—';
  return `
    <div class="${cls}" data-id="${t.id}">
      <div class="email-from">${esc(fromName)}</div>
      <div class="email-subject">${esc(t.subject)}</div>
      <div class="email-snippet">${esc(t.snippet)}</div>
      <div class="email-meta">
        <span class="email-date">${fmtDate(t.date)}</span>
        ${t.stale ? '<span class="badge badge-amber">Stale</span>' : ''}
        ${t.actionable ? '<span class="badge badge-teal">Action</span>' : ''}
      </div>
    </div>
  `;
}

// ── Thread Panel ──────────────────────────────────────────────────────────────
function initThreadPanel() {
  document.getElementById('thread-close').addEventListener('click', closeThread);
  document.getElementById('thread-overlay').addEventListener('click', closeThread);
}

async function openThread(id) {
  const thread = state.gmailThreads.find(t => t.id === id);
  document.getElementById('thread-subject').textContent = thread?.subject || 'Loading…';
  document.getElementById('thread-messages').innerHTML = '<div class="spinner"></div>';
  document.getElementById('thread-panel').classList.remove('hidden');
  document.getElementById('thread-overlay').classList.remove('hidden');

  try {
    const data = await get(`/gmail/thread/${id}`);
    document.getElementById('thread-subject').textContent = data.messages?.[0] ? data.messages[data.messages.length - 1].subject : thread?.subject;
    document.getElementById('thread-messages').innerHTML = data.messages.map(m => `
      <div class="thread-msg">
        <div class="thread-msg-from">${esc(m.from)}</div>
        <div class="thread-msg-date">${fmtDateFull(m.date)}</div>
        <div class="thread-msg-body">${esc(m.body)}</div>
      </div>
    `).join('');
  } catch (e) {
    document.getElementById('thread-messages').innerHTML = `<div class="empty-state">${e.message}</div>`;
  }
}

function closeThread() {
  document.getElementById('thread-panel').classList.add('hidden');
  document.getElementById('thread-overlay').classList.add('hidden');
}

// ── Drive Files ───────────────────────────────────────────────────────────────
const FILE_ICONS = {
  folder: '📁', image: '🖼️', pdf: '📄', document: '📝',
  spreadsheet: '📊', presentation: '📑', video: '🎬', archive: '🗜️', file: '📎',
};

function renderDriveFiles() {
  const filter = state.filesFilter;
  const search = state.driveSearch.toLowerCase();
  let files = state.driveFiles;
  if (filter !== 'all') files = files.filter(f => f.type === filter);
  if (search) files = files.filter(f => f.name.toLowerCase().includes(search));

  const container = document.getElementById('drive-files');
  if (!state.driveFiles.length) {
    container.innerHTML = '<div class="empty-state">Drive not connected — add OAuth tokens to .env</div>';
    return;
  }

  container.innerHTML = files.length
    ? files.map(f => fileCard(f)).join('')
    : '<div class="empty-state">No files match filter</div>';
}

function fileCard(f) {
  const icon = FILE_ICONS[f.type] || FILE_ICONS.file;
  const size = f.size ? fmtSize(f.size) : '';
  const date = f.modified ? fmtDate(f.modified) : '';
  return `
    <a class="file-card" href="${f.url || '#'}" target="_blank" rel="noopener">
      <div class="file-card-icon">${icon}</div>
      <div class="file-card-name">${esc(f.name)}</div>
      <div class="file-card-meta">${[size, date].filter(Boolean).join(' · ')}</div>
    </a>
  `;
}

function initUpload() {
  const zone = document.getElementById('upload-zone');
  const input = document.getElementById('file-input');

  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    uploadFiles(e.dataTransfer.files);
  });
  zone.addEventListener('click', e => { if (e.target !== input && !e.target.classList.contains('upload-label')) input.click(); });
  input.addEventListener('change', () => uploadFiles(input.files));

  document.getElementById('refresh-drive-btn').onclick = async () => {
    document.getElementById('refresh-drive-btn').textContent = '↻ Loading…';
    await loadDriveFiles();
    renderDriveFiles();
    document.getElementById('refresh-drive-btn').textContent = '↻ Refresh';
  };

  document.getElementById('drive-search').addEventListener('input', e => {
    state.driveSearch = e.target.value;
    renderDriveFiles();
  });
}

async function uploadFiles(files) {
  if (!files?.length) return;
  const zone = document.getElementById('upload-zone');
  zone.querySelector('.upload-inner').innerHTML = `<div class="spinner"></div> Uploading ${files.length} file(s)…`;

  for (const file of files) {
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`${API}/drive/upload`, { method: 'POST', body: fd });
      const data = await res.json();
      if (data.id) {
        state.driveFiles.unshift({ ...data, type: getFileType(data.mimeType, data.name) });
      }
    } catch (e) { console.error('Upload failed:', e); }
  }

  zone.querySelector('.upload-inner').innerHTML = `
    <div class="upload-icon">↑</div>
    <div>Drop files here or <label for="file-input" class="upload-label">browse</label></div>
    <div class="upload-hint">Files go to your Drive root or selected folder</div>
  `;
  renderDriveFiles();
}

function getFileType(mimeType, name) {
  if (mimeType?.includes('image')) return 'image';
  if (mimeType?.includes('pdf')) return 'pdf';
  if (mimeType?.includes('spreadsheet') || name?.endsWith('.xlsx') || name?.endsWith('.csv')) return 'spreadsheet';
  if (mimeType?.includes('presentation') || name?.endsWith('.pptx')) return 'presentation';
  if (mimeType?.includes('document') || name?.endsWith('.docx')) return 'document';
  if (mimeType?.includes('video')) return 'video';
  if (mimeType?.includes('folder')) return 'folder';
  return 'file';
}

// ── Intelligence ──────────────────────────────────────────────────────────────
const INTEL_CATEGORIES = ['Supplier', 'Client', 'Market', 'Regulatory', 'Competitor', 'Opportunity', 'Reference'];

function renderIntelligence() {
  const cat = state.intelCat;
  const notes = cat === 'all' ? state.intelligence : state.intelligence.filter(n => n.category === cat);
  const container = document.getElementById('intel-notes');

  container.innerHTML = notes.length
    ? notes.map(n => intelNote(n)).join('')
    : '<div class="empty-state" style="grid-column:1/-1">No notes in this category</div>';

  container.querySelectorAll('[data-intel-id]').forEach(note => {
    note.querySelector('.intel-note-delete')?.addEventListener('click', () => deleteIntel(note.dataset.intelId));
  });

  document.getElementById('add-intel-btn').onclick = openAddIntelModal;

  document.querySelectorAll('.category-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.intelCat = btn.dataset.cat;
      document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderIntelligence();
    });
  });
}

function intelNote(n) {
  return `
    <div class="intel-note" data-intel-id="${n.id}">
      <button class="btn-danger intel-note-delete" style="position:absolute;top:8px;right:8px;opacity:0;transition:opacity .15s">✕</button>
      <div class="intel-note-category">${esc(n.category || 'Note')}</div>
      <div class="intel-note-title">${esc(n.title)}</div>
      ${n.body ? `<div class="intel-note-body">${esc(n.body)}</div>` : ''}
      ${n.source ? `<div class="intel-note-date">Source: ${esc(n.source)}</div>` : ''}
      <div class="intel-note-date">${fmtDate(n.createdAt)}</div>
    </div>
  `;
}

document.addEventListener('mouseover', e => {
  const note = e.target.closest('.intel-note');
  if (note) note.querySelector('.intel-note-delete')?.style.setProperty('opacity', '1');
});
document.addEventListener('mouseout', e => {
  const note = e.target.closest('.intel-note');
  if (note && !note.contains(e.relatedTarget)) note.querySelector('.intel-note-delete')?.style.setProperty('opacity', '0');
});

async function deleteIntel(id) {
  if (!confirm('Delete this note?')) return;
  await del(`/data/intelligence/${id}`);
  state.intelligence = state.intelligence.filter(n => n.id !== id);
  renderIntelligence();
}

async function openAddIntelModal() {
  const data = await showModal('Add Intelligence Note', [
    { id: 'category', label: 'Category', type: 'select', options: INTEL_CATEGORIES },
    { id: 'title', label: 'Title', type: 'text', placeholder: 'e.g. AHA regulations — EU update' },
    { id: 'body', label: 'Details', type: 'textarea' },
    { id: 'source', label: 'Source / Link', type: 'text' },
  ]);
  if (!data) return;
  const item = await post('/data/intelligence', data);
  state.intelligence.unshift(item);
  renderIntelligence();
}

// ── Filter Bars ───────────────────────────────────────────────────────────────
function bindFilterBars() {
  // Packaging
  document.querySelectorAll('#tab-packaging .filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.packagingFilter = btn.dataset.filter;
      document.querySelectorAll('#tab-packaging .filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderPackaging();
    });
  });

  // Formulas
  document.querySelectorAll('#tab-formulas .filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.formulaFilter = btn.dataset.filter;
      document.querySelectorAll('#tab-formulas .filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderFormulas();
    });
  });

  // Operations (Notion)
  document.querySelectorAll('#tab-operations .filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.notionFilter = btn.dataset.filter;
      document.querySelectorAll('#tab-operations .filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderNotionTasks();
    });
  });

  // Files
  document.querySelectorAll('#tab-files .filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.filesFilter = btn.dataset.filter;
      document.querySelectorAll('#tab-files .filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderDriveFiles();
    });
  });
}

function bindTabButtons() {
  // re-bind nav in case they got replaced
}

// ── Modal ─────────────────────────────────────────────────────────────────────
let _modalResolve = null;

function initModal() {
  document.getElementById('modal-close').addEventListener('click', () => resolveModal(null));
  document.getElementById('modal-cancel').addEventListener('click', () => resolveModal(null));
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) resolveModal(null);
  });
  document.getElementById('modal-save').addEventListener('click', () => {
    const data = collectModal();
    resolveModal(data);
  });
}

function showModal(title, fields, opts = {}) {
  return new Promise(resolve => {
    _modalResolve = resolve;
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = fields.map(f => fieldHTML(f)).join('');
    document.getElementById('modal-overlay').classList.remove('hidden');

    const footer = document.querySelector('.modal-footer');
    const existing = footer.querySelector('.btn-danger-del');
    if (existing) existing.remove();
    if (opts.showDelete) {
      const delBtn = document.createElement('button');
      delBtn.className = 'btn-danger btn-danger-del';
      delBtn.style.marginRight = 'auto';
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', () => resolveModal('DELETE'));
      footer.prepend(delBtn);
    }

    // Auto-focus first input
    setTimeout(() => document.querySelector('#modal-body input, #modal-body textarea, #modal-body select')?.focus(), 50);

    // Enter to save (not on textarea)
    const handler = (e) => {
      if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
        document.getElementById('modal-save').click();
        document.removeEventListener('keydown', handler);
      }
      if (e.key === 'Escape') {
        resolveModal(null);
        document.removeEventListener('keydown', handler);
      }
    };
    document.addEventListener('keydown', handler);
  });
}

function fieldHTML(f) {
  const val = f.value != null ? f.value : '';
  if (f.type === 'select') {
    const opts = f.options.map(o => `<option ${o === val ? 'selected' : ''}>${o}</option>`).join('');
    return `<div class="form-row"><label>${f.label}</label><select id="field-${f.id}">${opts}</select></div>`;
  }
  if (f.type === 'textarea') {
    return `<div class="form-row"><label>${f.label}</label><textarea id="field-${f.id}" placeholder="${f.placeholder || ''}">${esc(val)}</textarea></div>`;
  }
  return `<div class="form-row"><label>${f.label}</label><input id="field-${f.id}" type="${f.type || 'text'}" value="${esc(val)}" placeholder="${f.placeholder || ''}" /></div>`;
}

function collectModal() {
  const data = {};
  document.querySelectorAll('#modal-body [id^="field-"]').forEach(el => {
    const key = el.id.replace('field-', '');
    data[key] = el.value;
  });
  return data;
}

function resolveModal(data) {
  document.getElementById('modal-overlay').classList.add('hidden');
  if (_modalResolve) { _modalResolve(data); _modalResolve = null; }
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtDate(d) {
  if (!d) return '';
  const date = new Date(d);
  if (isNaN(date)) return d;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDateFull(d) {
  if (!d) return '';
  const date = new Date(d);
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function timeStr() {
  return new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function fmtSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function isOverdue(dateStr) {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

function setSyncStatus(msg) {
  document.getElementById('sync-status').textContent = msg;
}
