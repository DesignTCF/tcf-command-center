import { useState, useMemo, useCallback } from 'react';
import { useApp } from '../store/AppContext';
import { timeAgo } from '../lib/utils';
import Modal from '../components/Modal';
import api from '../lib/api';

const CATEGORIES = [
  'Operations', 'Product Development', 'Creative', 'Website',
  'Purchasing', 'Inventory', 'Supplier Management', 'Marketing', 'Research'
];
const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'];

const PRIORITY_COLORS = {
  Critical: 'text-red border-red/40 bg-red/10',
  High: 'text-amber border-amber/40 bg-amber/10',
  Medium: 'text-teal border-teal/40 bg-teal/10',
  Low: 'text-ink-dim border-border bg-surface3',
};

const TYPE_COLORS = {
  Task: 'text-blue border-blue/40 bg-blue/10',
  Project: 'text-purple border-purple/40 bg-purple/10',
  Decision: 'text-gold border-gold/40 bg-gold/10',
  'Research Item': 'text-teal border-teal/40 bg-teal/10',
  'Supplier Follow-Up': 'text-amber border-amber/40 bg-amber/10',
  'Calendar Event': 'text-green border-green/40 bg-green/10',
};

function Badge({ label, colorClass }) {
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${colorClass}`}>
      {label}
    </span>
  );
}

function buildModalFields(type, suggestion) {
  const text = suggestion?.text || '';
  const reasoning = suggestion?.reasoning || '';

  if (type === 'Task') {
    return [
      { id: 'title', label: 'Title', type: 'text', defaultValue: text.slice(0, 120) },
      { id: 'priority', label: 'Priority', type: 'select', options: PRIORITIES, defaultValue: suggestion?.priority || 'Medium' },
      { id: 'category', label: 'Category', type: 'select', options: CATEGORIES, defaultValue: suggestion?.category || 'Operations' },
      { id: 'dueDate', label: 'Due Date', type: 'date', defaultValue: '' },
      { id: 'notes', label: 'Notes', type: 'textarea', defaultValue: reasoning },
    ];
  }
  if (type === 'Project') {
    return [
      { id: 'name', label: 'Project Name', type: 'text', defaultValue: text.slice(0, 120) },
      { id: 'department', label: 'Department', type: 'select', options: CATEGORIES, defaultValue: suggestion?.category || 'Operations' },
      { id: 'owner', label: 'Owner', type: 'text', defaultValue: 'Katherine Fox' },
      { id: 'priority', label: 'Priority', type: 'select', options: PRIORITIES, defaultValue: suggestion?.priority || 'Medium' },
      { id: 'status', label: 'Status', type: 'select', options: ['Planning', 'Active', 'On Hold', 'Complete'], defaultValue: 'Planning' },
      { id: 'dueDate', label: 'Due Date', type: 'date', defaultValue: '' },
      { id: 'notes', label: 'Notes', type: 'textarea', defaultValue: reasoning },
    ];
  }
  if (type === 'Decision') {
    return [
      { id: 'title', label: 'Title', type: 'text', defaultValue: text.slice(0, 120) },
      { id: 'context', label: 'Context', type: 'textarea', defaultValue: reasoning },
      { id: 'dueDate', label: 'Due Date', type: 'date', defaultValue: '' },
    ];
  }
  if (type === 'Research Item') {
    return [
      { id: 'category', label: 'Category', type: 'select', options: CATEGORIES, defaultValue: suggestion?.category || 'Research' },
      { id: 'title', label: 'Title', type: 'text', defaultValue: text.slice(0, 120) },
      { id: 'body', label: 'Body', type: 'textarea', defaultValue: text },
      { id: 'source', label: 'Source', type: 'text', defaultValue: "Katherine's Notes" },
    ];
  }
  if (type === 'Supplier Follow-Up') {
    return [
      { id: 'supplier', label: 'Supplier', type: 'text', defaultValue: '' },
      { id: 'project', label: 'Project', type: 'text', defaultValue: '' },
      { id: 'waitingOn', label: 'Waiting On', type: 'text', defaultValue: text.slice(0, 120) },
      { id: 'nextFollowUp', label: 'Next Follow-Up', type: 'date', defaultValue: '' },
      { id: 'status', label: 'Status', type: 'select', options: ['Waiting', 'Responded', 'Resolved'], defaultValue: 'Waiting' },
    ];
  }
  if (type === 'Calendar Event') {
    return [
      { id: 'title', label: 'Title', type: 'text', defaultValue: text.slice(0, 120) },
      { id: 'date', label: 'Date', type: 'date', defaultValue: '' },
      { id: 'time', label: 'Time', type: 'time', defaultValue: '' },
      { id: 'notes', label: 'Notes', type: 'textarea', defaultValue: reasoning },
    ];
  }
  return [];
}

function getEndpointAndKey(type) {
  if (type === 'Task') return { endpoint: '/api/data/tasks', key: 'tasks' };
  if (type === 'Project') return { endpoint: '/api/data/projects', key: 'projects' };
  if (type === 'Decision') return { endpoint: '/api/data/decisions', key: 'decisions' };
  if (type === 'Research Item') return { endpoint: '/api/data/decisions', key: 'decisions' };
  if (type === 'Supplier Follow-Up') return { endpoint: '/api/data/suppliers', key: 'suppliers' };
  if (type === 'Calendar Event') return { endpoint: '/api/data/calendar', key: 'calendar' };
  return { endpoint: '/api/data/tasks', key: 'tasks' };
}

export default function Import() {
  const { state, dispatch, loadDoc } = useApp();
  const [suggestions, setSuggestions] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState(null);
  const [queueItems, setQueueItems] = useState([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState(null);
  const [modalType, setModalType] = useState(null);
  const [modalSaving, setModalSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [docFetchTime, setDocFetchTime] = useState(null);
  const [loadingDoc, setLoadingDoc] = useState(false);

  const doc = state.doc;
  const docLoading = state.docLoading;
  const docError = state.docError;

  const handleLoadDoc = useCallback(async () => {
    setLoadingDoc(true);
    try {
      await loadDoc();
      setDocFetchTime(new Date());
    } finally {
      setLoadingDoc(false);
    }
  }, [loadDoc]);

  const filteredSections = useMemo(() => {
    if (!doc?.sections) return [];
    if (!searchQuery.trim()) return doc.sections;
    const q = searchQuery.toLowerCase();
    return doc.sections
      .map(sec => {
        if (sec.heading?.toLowerCase().includes(q)) return sec;
        const filteredItems = (sec.items || []).filter(item =>
          item.toLowerCase().includes(q)
        );
        if (filteredItems.length > 0) return { ...sec, items: filteredItems };
        return null;
      })
      .filter(Boolean);
  }, [doc, searchQuery]);

  const handleAddToQueue = useCallback((itemText) => {
    setSuggestions(prev => [
      {
        id: Date.now() + Math.random(),
        text: itemText,
        category: 'Operations',
        priority: 'Medium',
        type: 'Task',
        reasoning: 'Manually added from document',
        fromDoc: true,
      },
      ...prev,
    ]);
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!doc?.plainText) return;
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const result = await api.post('/api/ai/analyze', { text: doc.plainText });
      const rawItems = result.items || result.suggestions || (Array.isArray(result) ? result : []);
      const items = rawItems.map((item, i) => ({
        id: Date.now() + i,
        text: item.text || item.title || '',
        category: item.category || 'Operations',
        priority: item.priority || 'Medium',
        type: item.type || 'Task',
        reasoning: item.reasoning || item.reason || '',
      }));
      setSuggestions(items);
    } catch (err) {
      setAnalyzeError(err.message || 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  }, [doc]);

  const openModal = useCallback((suggestion, type) => {
    setSelectedSuggestion(suggestion);
    setModalType(type);
  }, []);

  const closeModal = useCallback(() => {
    setSelectedSuggestion(null);
    setModalType(null);
    setModalSaving(false);
  }, []);

  const handleModalSave = useCallback(async (data) => {
    if (!selectedSuggestion || !modalType) return;
    setModalSaving(true);
    try {
      const { endpoint, key } = getEndpointAndKey(modalType);
      const payload = { ...data, createdAt: new Date().toISOString() };
      const result = await api.post(endpoint, payload);
      dispatch({ type: 'ADD', key, value: result });

      const queueEntry = {
        id: Date.now(),
        title: data.title || data.name || data.waitingOn || selectedSuggestion.text.slice(0, 80),
        type: modalType,
        addedAt: new Date().toISOString(),
      };
      try {
        const qResult = await api.post('/api/data/import-items', queueEntry);
        dispatch({ type: 'ADD', key: 'importItems', value: qResult });
      } catch (_) {
        dispatch({ type: 'ADD', key: 'importItems', value: queueEntry });
      }
      setQueueItems(prev => [queueEntry, ...prev]);
      setSuggestions(prev => prev.filter(s => s.id !== selectedSuggestion.id));
      closeModal();
    } catch (err) {
      alert('Save failed: ' + (err.message || 'Unknown error'));
      setModalSaving(false);
    }
  }, [selectedSuggestion, modalType, dispatch, closeModal]);

  const handleDismiss = useCallback((id) => {
    setSuggestions(prev => prev.filter(s => s.id !== id));
  }, []);

  const modalFields = useMemo(() => {
    if (!selectedSuggestion || !modalType) return [];
    return buildModalFields(modalType, selectedSuggestion);
  }, [selectedSuggestion, modalType]);

  const queueByType = useMemo(() => {
    const groups = {};
    queueItems.forEach(item => {
      if (!groups[item.type]) groups[item.type] = [];
      groups[item.type].push(item);
    });
    return groups;
  }, [queueItems]);

  const isLoading = docLoading || loadingDoc;

  return (
    <div className="flex h-[calc(100vh-48px)] overflow-hidden">

      {/* PANEL 1 — DOCUMENT VIEW */}
      <div className="flex flex-col border-r border-border overflow-hidden" style={{ width: '40%' }}>
        <div className="flex-shrink-0 flex flex-wrap items-center gap-2 px-4 py-3 border-b border-border bg-surface">
          <span className="section-title flex-1">Katherine's Notes</span>
          {docFetchTime && (
            <span className="text-[10px] text-ink-dim">Fetched {timeAgo(docFetchTime.toISOString())}</span>
          )}
          <button
            className="btn-ghost text-[11px] px-2 py-1"
            onClick={handleLoadDoc}
            disabled={isLoading}
          >
            {isLoading ? '…' : '↻ Reload'}
          </button>
        </div>

        {doc && (
          <div className="px-4 py-2 flex-shrink-0 border-b border-border bg-surface">
            <input
              className="input-field w-full text-xs"
              placeholder="Search document…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        )}

        <div className="flex-1 overflow-y-auto page-scroll">
          {isLoading && (
            <div className="flex items-center justify-center h-40">
              <div className="w-6 h-6 border-2 border-teal border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!isLoading && docError && (
            <div className="flex flex-col items-center justify-center h-40 gap-3 px-6">
              <p className="text-red text-sm text-center">{docError}</p>
              <button className="btn-primary text-xs" onClick={handleLoadDoc}>Retry</button>
            </div>
          )}

          {!isLoading && !docError && !doc && (
            <div className="flex flex-col items-center justify-center h-full gap-4 px-6">
              <div className="text-3xl text-ink-muted select-none">📄</div>
              <p className="text-ink-dim text-sm text-center leading-relaxed">
                Connect Katherine's Google Doc to begin importing notes into the dashboard
              </p>
              <button className="btn-primary px-6 py-2.5 text-sm" onClick={handleLoadDoc}>
                Connect Document
              </button>
            </div>
          )}

          {!isLoading && doc && (
            <div className="px-4 py-4">
              <h2 className="text-gold text-sm font-semibold mb-4 tracking-wide">{doc.title}</h2>
              {filteredSections.length === 0 && (
                <p className="text-ink-dim text-xs italic">No results for "{searchQuery}"</p>
              )}
              {filteredSections.map((section, si) => (
                <div key={si} className="mb-5">
                  {section.heading && (
                    <div className="text-teal text-[10px] font-semibold tracking-[0.12em] uppercase mb-2">
                      {section.heading}
                    </div>
                  )}
                  <ul className="space-y-1.5">
                    {(section.items || []).map((item, ii) => (
                      <li key={ii} className="group flex items-start gap-2">
                        <span className="text-xs text-ink leading-relaxed flex-1">{item}</span>
                        <button
                          className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 text-[10px] text-teal border border-teal/30 rounded px-1.5 py-0.5 hover:bg-teal/10 mt-0.5"
                          onClick={() => handleAddToQueue(item)}
                        >
                          → Add
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* PANEL 2 — AI SUGGESTIONS */}
      <div className="flex flex-col border-r border-border overflow-hidden" style={{ width: '35%' }}>
        <div className="flex-shrink-0 flex items-center gap-2 px-4 py-3 border-b border-border bg-surface">
          <span className="section-title flex-1">AI Organization</span>
          <button
            className="btn-primary text-[11px] px-3 py-1.5 disabled:opacity-40"
            onClick={handleAnalyze}
            disabled={analyzing || !doc?.plainText}
          >
            {analyzing ? (
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin inline-block" />
                Analyzing…
              </span>
            ) : 'Analyze Document'}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto page-scroll px-3 py-3 space-y-3">
          {analyzeError && (
            <div className="text-red text-xs bg-red/10 border border-red/30 rounded px-3 py-2">
              {analyzeError}
            </div>
          )}

          {!analyzing && suggestions.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-4">
              <div className="text-2xl text-ink-muted select-none">✦</div>
              <p className="text-ink-dim text-xs leading-relaxed">
                Click <span className="text-teal font-medium">Analyze Document</span> to get AI suggestions for organizing Katherine's notes into tasks, projects, decisions, and more.
              </p>
            </div>
          )}

          {suggestions.map(sug => (
            <div key={sug.id} className="panel rounded-md px-3 py-3 space-y-2.5">
              <p className="text-xs text-ink leading-relaxed">{sug.text}</p>

              <div className="flex flex-wrap gap-1.5">
                <Badge label={sug.category} colorClass="text-teal border-teal/40 bg-teal/10" />
                <Badge label={sug.priority} colorClass={PRIORITY_COLORS[sug.priority] || PRIORITY_COLORS.Medium} />
                <Badge label={sug.type} colorClass={TYPE_COLORS[sug.type] || TYPE_COLORS.Task} />
              </div>

              {sug.reasoning && (
                <p className="text-[10px] text-ink-dim italic leading-relaxed">{sug.reasoning}</p>
              )}

              <div className="flex flex-wrap gap-1 pt-0.5">
                {[
                  { type: 'Task', label: 'Task' },
                  { type: 'Project', label: 'Project' },
                  { type: 'Decision', label: 'Decision' },
                  { type: 'Research Item', label: 'Research' },
                  { type: 'Supplier Follow-Up', label: 'Supplier' },
                  { type: 'Calendar Event', label: 'Calendar' },
                ].map(({ type, label }) => (
                  <button
                    key={type}
                    className="text-[10px] border border-border2 rounded px-1.5 py-0.5 text-ink-dim hover:text-ink hover:bg-surface3 transition-colors"
                    onClick={() => openModal(sug, type)}
                  >
                    → {label}
                  </button>
                ))}
                <button
                  className="text-[10px] border border-border rounded px-1.5 py-0.5 text-ink-muted hover:text-red hover:border-red/40 transition-colors ml-auto"
                  onClick={() => handleDismiss(sug.id)}
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* PANEL 3 — QUEUE */}
      <div className="flex flex-col overflow-hidden" style={{ width: '25%' }}>
        <div className="flex-shrink-0 flex items-center gap-2 px-4 py-3 border-b border-border bg-surface">
          <span className="section-title flex-1">Added to Dashboard</span>
          {queueItems.length > 0 && (
            <span className="text-[10px] bg-teal/20 text-teal border border-teal/30 rounded-full px-2 py-0.5 font-semibold">
              {queueItems.length}
            </span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto page-scroll px-3 py-3">
          {queueItems.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-4">
              <div className="text-xl text-ink-muted select-none">✓</div>
              <p className="text-ink-dim text-xs leading-relaxed">Items you approve will appear here grouped by type</p>
            </div>
          )}

          {Object.entries(queueByType).map(([type, items]) => (
            <div key={type} className="mb-4">
              <div className="text-[10px] font-semibold text-ink-dim tracking-[0.1em] uppercase mb-2 px-1">
                {type}
              </div>
              <div className="space-y-1.5">
                {items.map(item => (
                  <div key={item.id} className="panel rounded px-3 py-2 space-y-1.5">
                    <p className="text-xs text-ink leading-snug">{item.title}</p>
                    <div className="flex items-center gap-2">
                      <Badge label={item.type} colorClass={TYPE_COLORS[item.type] || TYPE_COLORS.Task} />
                      <span className="text-[10px] text-ink-dim">{timeAgo(item.addedAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CONFIRM MODAL */}
      <Modal
        open={!!selectedSuggestion && !!modalType}
        title={`Add as ${modalType}`}
        fields={modalFields}
        onSave={handleModalSave}
        onClose={closeModal}
        saveLabel={modalSaving ? 'Saving…' : `Add ${modalType || ''}`}
      />
    </div>
  );
}
