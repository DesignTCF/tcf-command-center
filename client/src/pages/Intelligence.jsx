import { useState, useMemo } from 'react';
import { useApp } from '../store/AppContext';
import api from '../lib/api';
import { fmtDateShort } from '../lib/utils';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';

const CATEGORIES = ['All Notes', 'Supplier', 'Client', 'Market', 'Regulatory', 'Competitor', 'Opportunity', 'Reference'];

const MODAL_FIELDS = [
  { id: 'category', label: 'Category', type: 'select', options: ['Supplier', 'Client', 'Market', 'Regulatory', 'Competitor', 'Opportunity', 'Reference'], value: 'Market' },
  { id: 'title', label: 'Title', type: 'text', value: '', placeholder: 'Note title' },
  { id: 'body', label: 'Body', type: 'textarea', value: '', placeholder: 'Enter your research notes here...' },
  { id: 'source', label: 'Source / Link', type: 'text', value: '', placeholder: 'https://... or publication name' },
];

function exportCSV(notes, category) {
  const filtered = category === 'All Notes' ? notes : notes.filter(n => n.category === category);
  const header = ['ID', 'Category', 'Title', 'Body', 'Source', 'Created'];
  const rows = filtered.map(n => [
    n.id,
    n.category || '',
    `"${(n.title || '').replace(/"/g, '""')}"`,
    `"${(n.body || '').replace(/"/g, '""')}"`,
    `"${(n.source || '').replace(/"/g, '""')}"`,
    n.createdAt || n.created_at || '',
  ]);
  const csv = [header.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'intelligence.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export default function Intelligence() {
  const { state, dispatch } = useApp();
  const notes = state.intelligence || [];

  const [activeCategory, setActiveCategory] = useState('All Notes');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editNote, setEditNote] = useState(null);
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [saving, setSaving] = useState(false);

  const categoryCounts = useMemo(() => {
    const counts = { 'All Notes': notes.length };
    CATEGORIES.slice(1).forEach(cat => {
      counts[cat] = notes.filter(n => n.category === cat).length;
    });
    return counts;
  }, [notes]);

  const filtered = useMemo(() => {
    let list = activeCategory === 'All Notes' ? notes : notes.filter(n => n.category === activeCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(n =>
        (n.title || '').toLowerCase().includes(q) ||
        (n.body || '').toLowerCase().includes(q) ||
        (n.source || '').toLowerCase().includes(q)
      );
    }
    return list.slice().sort((a, b) => new Date(b.createdAt || b.created_at || 0) - new Date(a.createdAt || a.created_at || 0));
  }, [notes, activeCategory, search]);

  function openAdd() {
    setEditNote(null);
    setModalOpen(true);
  }

  function openEdit(note) {
    setEditNote(note);
    setModalOpen(true);
  }

  function toggleExpand(id) {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleSave(fields) {
    setSaving(true);
    const payload = {
      category: fields.category,
      title: fields.title,
      body: fields.body,
      source: fields.source,
    };
    try {
      if (editNote) {
        const updated = await api.patch(`/api/data/intelligence/${editNote.id}`, payload);
        dispatch({ type: 'UPDATE', key: 'intelligence', id: editNote.id, value: updated });
      } else {
        const created = await api.post('/api/data/intelligence', payload);
        dispatch({ type: 'ADD', key: 'intelligence', value: created });
      }
      setModalOpen(false);
    } catch (err) {
      console.error('Failed to save note', err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(note, e) {
    e.stopPropagation();
    if (!window.confirm(`Delete "${note.title}"?`)) return;
    try {
      await api.del(`/api/data/intelligence/${note.id}`);
      dispatch({ type: 'DELETE', key: 'intelligence', id: note.id });
    } catch (err) {
      console.error('Failed to delete note', err);
    }
  }

  const modalFields = MODAL_FIELDS.map(f => {
    if (!editNote) return f;
    return { ...f, value: editNote[f.id] ?? f.value };
  });

  return (
    <div className="flex h-full overflow-hidden">
      {/* LEFT SIDEBAR */}
      <aside style={{ width: 160, minWidth: 160 }} className="flex flex-col border-r border-border bg-surface h-full py-4 px-2 gap-1">
        <div className="section-title px-2 mb-2">Categories</div>
        {CATEGORIES.map(cat => {
          const active = activeCategory === cat;
          const count = categoryCounts[cat] ?? 0;
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`flex items-center justify-between w-full px-3 py-2 rounded text-left text-sm transition-colors ${
                active
                  ? 'bg-teal text-bg font-semibold'
                  : 'text-ink-dim hover:text-ink hover:bg-surface2'
              }`}
            >
              <span className="truncate">{cat}</span>
              {count > 0 && (
                <span
                  className={`ml-1 text-xs rounded-full px-1.5 py-0.5 font-mono ${
                    active ? 'bg-bg text-teal' : 'bg-surface2 text-ink-muted'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </aside>

      {/* MAIN CONTENT */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* TOP BAR */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border bg-surface shrink-0">
          <h1 className="text-ink font-semibold text-base tracking-tight mr-2">Intelligence Board</h1>
          <button className="btn-primary text-sm py-1.5 px-3" onClick={openAdd}>
            + Add Note
          </button>
          <input
            type="text"
            className="input-field text-sm py-1.5 px-3 flex-1 max-w-xs"
            placeholder="Search notes..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className="ml-auto flex items-center gap-2">
            <button
              className="btn-ghost text-sm py-1.5 px-3"
              onClick={() => exportCSV(notes, activeCategory)}
              title="Download CSV"
            >
              ↓ CSV
            </button>
          </div>
        </div>

        {/* NOTES GRID */}
        <div className="page-scroll flex-1">
          {filtered.length === 0 ? (
            <EmptyState
              title="No notes found"
              description={search ? 'Try a different search.' : 'Add your first intelligence note.'}
              action={{ label: '+ Add Note', onClick: openAdd }}
            />
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '1rem',
              }}
            >
              {filtered.map(note => {
                const expanded = expandedIds.has(note.id);
                return (
                  <div
                    key={note.id}
                    className="panel relative group flex flex-col gap-2 p-4 cursor-pointer hover:border-border2 transition-colors"
                    onClick={() => openEdit(note)}
                  >
                    {/* Delete button */}
                    <button
                      className="absolute top-3 right-3 btn-icon opacity-0 group-hover:opacity-100 transition-opacity text-red hover:bg-red/10"
                      onClick={e => handleDelete(note, e)}
                      title="Delete note"
                    >
                      ✕
                    </button>

                    {/* Category */}
                    <div className="text-teal text-xs font-semibold uppercase tracking-widest">
                      {note.category || 'Uncategorized'}
                    </div>

                    {/* Title */}
                    <div className="text-ink font-semibold text-sm leading-snug pr-6">
                      {note.title || 'Untitled'}
                    </div>

                    {/* Body */}
                    {note.body && (
                      <div
                        className={`text-ink-dim text-xs leading-relaxed ${expanded ? '' : 'line-clamp-2'}`}
                        onClick={e => { e.stopPropagation(); toggleExpand(note.id); }}
                        title={expanded ? 'Collapse' : 'Expand'}
                      >
                        {note.body}
                      </div>
                    )}

                    {/* Source */}
                    {note.source && (
                      <div
                        className="text-ink-muted text-xs truncate"
                        title={note.source}
                        onClick={e => {
                          if (note.source.startsWith('http')) {
                            e.stopPropagation();
                            window.open(note.source, '_blank', 'noopener,noreferrer');
                          }
                        }}
                      >
                        {note.source.startsWith('http') ? (
                          <span className="hover:text-teal underline underline-offset-2 cursor-pointer">
                            {note.source}
                          </span>
                        ) : (
                          note.source
                        )}
                      </div>
                    )}

                    {/* Date */}
                    <div className="text-ink-muted text-xs mt-auto pt-1">
                      {fmtDateShort(note.createdAt || note.created_at)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* MODAL */}
      {modalOpen && (
        <Modal
          title={editNote ? 'Edit Note' : 'Add Note'}
          fields={modalFields}
          onSave={handleSave}
          onClose={() => setModalOpen(false)}
          saving={saving}
        />
      )}
    </div>
  );
}
