import { useState, useRef } from 'react';
import { useApp } from '../store/AppContext';
import api from '../lib/api';
import { fmtDate, fmtDateShort, isOverdue, daysUntil } from '../lib/utils';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';

const DEPARTMENTS = ['Design', 'Manufacturing', 'Operations', 'Business'];
const PRIORITIES = ['High', 'Medium', 'Low'];
const STATUSES = ['Not Started', 'In Progress', 'Complete', 'On Hold', 'Blocked'];
const FILTERS = ['All', 'Design', 'Manufacturing', 'Operations', 'Business', 'Not Started', 'In Progress', 'Complete', 'On Hold', 'Blocked'];

const SUB_TABS = ['Tasks', 'Contacts', 'Decisions', 'Notes'];

const modalFields = [
  { id: 'name', label: 'Project Name', type: 'text', value: '', placeholder: 'e.g. Q3 Packaging Refresh' },
  { id: 'department', label: 'Department', type: 'select', options: DEPARTMENTS, value: '' },
  { id: 'owner', label: 'Owner', type: 'text', value: '', placeholder: 'e.g. Katherine Fox' },
  { id: 'priority', label: 'Priority', type: 'select', options: PRIORITIES, value: '' },
  { id: 'status', label: 'Status', type: 'select', options: STATUSES, value: '' },
  { id: 'dueDate', label: 'Due Date', type: 'date', value: '' },
  { id: 'percentComplete', label: '% Complete', type: 'number', value: '', placeholder: '0' },
  { id: 'blockers', label: 'Blockers', type: 'textarea', value: '' },
  { id: 'notes', label: 'Notes', type: 'textarea', value: '' },
];

function ProgressBar({ value }) {
  const pct = Math.min(100, Math.max(0, Number(value) || 0));
  return (
    <div className="mt-1 w-full rounded-full overflow-hidden" style={{ height: 4, background: 'var(--color-surface2, #1a1a1a)' }}>
      <div
        style={{ width: `${pct}%`, height: '100%', background: 'var(--color-teal, #2ABFBF)', transition: 'width 0.3s' }}
      />
    </div>
  );
}

function InlineSelect({ value, options, onChange }) {
  return (
    <select
      className="input-field text-xs py-0.5 px-1"
      style={{ minWidth: 100 }}
      value={value}
      onChange={e => onChange(e.target.value)}
      onClick={e => e.stopPropagation()}
    >
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function InlineText({ value, onChange }) {
  return (
    <input
      className="input-field text-xs py-0.5 px-1 w-full"
      value={value}
      onChange={e => onChange(e.target.value)}
      onClick={e => e.stopPropagation()}
    />
  );
}

function SubPanel({ project, state }) {
  const [activeTab, setActiveTab] = useState('Tasks');

  const tasks = (state.tasks || []).filter(t => t.projectId === project.id || t.project === project.name);
  const contacts = (state.contacts || []).filter(c => c.projectId === project.id || c.project === project.name);
  const decisions = (state.decisions || []).filter(d => d.projectId === project.id || d.project === project.name);

  const renderTabContent = () => {
    if (activeTab === 'Tasks') {
      if (!tasks.length) return <div className="text-ink-muted text-xs py-4 text-center">No tasks linked to this project. Link items here.</div>;
      return (
        <table className="table-base w-full text-xs mt-2">
          <thead><tr><th>Task</th><th>Owner</th><th>Status</th><th>Due</th></tr></thead>
          <tbody>
            {tasks.map(t => (
              <tr key={t.id}>
                <td>{t.title || t.name}</td>
                <td className="text-ink-dim">{t.owner || t.assignee || '—'}</td>
                <td><StatusBadge status={t.status} /></td>
                <td className="text-ink-dim">{t.dueDate ? fmtDateShort(t.dueDate) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
    if (activeTab === 'Contacts') {
      if (!contacts.length) return <div className="text-ink-muted text-xs py-4 text-center">No contacts linked to this project. Link items here.</div>;
      return (
        <table className="table-base w-full text-xs mt-2">
          <thead><tr><th>Name</th><th>Role</th><th>Company</th><th>Email</th></tr></thead>
          <tbody>
            {contacts.map(c => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td className="text-ink-dim">{c.role || '—'}</td>
                <td className="text-ink-dim">{c.company || '—'}</td>
                <td className="text-ink-dim">{c.email || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
    if (activeTab === 'Decisions') {
      if (!decisions.length) return <div className="text-ink-muted text-xs py-4 text-center">No decisions linked to this project. Link items here.</div>;
      return (
        <table className="table-base w-full text-xs mt-2">
          <thead><tr><th>Decision</th><th>Made By</th><th>Date</th><th>Status</th></tr></thead>
          <tbody>
            {decisions.map(d => (
              <tr key={d.id}>
                <td>{d.title || d.name}</td>
                <td className="text-ink-dim">{d.madeBy || d.owner || '—'}</td>
                <td className="text-ink-dim">{d.date ? fmtDateShort(d.date) : '—'}</td>
                <td><StatusBadge status={d.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
    if (activeTab === 'Notes') {
      const notes = project.notes;
      if (!notes) return <div className="text-ink-muted text-xs py-4 text-center">No notes for this project.</div>;
      return <div className="text-ink-dim text-xs whitespace-pre-wrap mt-2 leading-relaxed">{notes}</div>;
    }
    return null;
  };

  return (
    <div className="panel mt-0 rounded-t-none border-t-0" style={{ borderTop: 'none' }}>
      <div className="flex gap-1 border-b" style={{ borderColor: 'var(--color-border, #222)' }}>
        {SUB_TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-xs font-medium transition-colors ${activeTab === tab ? 'text-teal border-b-2 border-teal' : 'text-ink-dim hover:text-ink'}`}
            style={activeTab === tab ? { borderBottomColor: 'var(--color-teal, #2ABFBF)' } : {}}
          >
            {tab}
          </button>
        ))}
      </div>
      <div className="p-4">
        {renderTabContent()}
      </div>
    </div>
  );
}

export default function Projects() {
  const { state, dispatch } = useApp();
  const projects = state.projects || [];

  const [filter, setFilter] = useState('All');
  const [expandedId, setExpandedId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [inlineEdits, setInlineEdits] = useState({});
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const filteredProjects = projects.filter(p => {
    if (filter === 'All') return true;
    if (DEPARTMENTS.includes(filter)) return p.department === filter;
    if (STATUSES.includes(filter)) return p.status === filter;
    return true;
  });

  const handleAdd = async (fields) => {
    const data = {};
    fields.forEach(f => { data[f.id] = f.value; });
    data.percentComplete = Number(data.percentComplete) || 0;
    try {
      const res = await api.post('/projects', data);
      dispatch({ type: 'ADD', key: 'projects', value: res });
    } catch {
      const newItem = { ...data, id: Date.now().toString() };
      dispatch({ type: 'ADD', key: 'projects', value: newItem });
    }
    setShowModal(false);
  };

  const handleEdit = async (fields) => {
    if (!editingProject) return;
    const data = {};
    fields.forEach(f => { data[f.id] = f.value; });
    data.percentComplete = Number(data.percentComplete) || 0;
    try {
      const res = await api.patch(`/projects/${editingProject.id}`, data);
      dispatch({ type: 'UPDATE', key: 'projects', id: editingProject.id, value: res });
    } catch {
      dispatch({ type: 'UPDATE', key: 'projects', id: editingProject.id, value: data });
    }
    setEditingProject(null);
  };

  const handleDelete = async (project) => {
    try {
      await api.del(`/projects/${project.id}`);
    } catch {}
    dispatch({ type: 'DELETE', key: 'projects', id: project.id });
    if (expandedId === project.id) setExpandedId(null);
    setDeleteConfirm(null);
  };

  const handleInlineChange = (projectId, field, value) => {
    setInlineEdits(prev => ({ ...prev, [projectId]: { ...(prev[projectId] || {}), [field]: value } }));
  };

  const saveInline = async (project) => {
    const edits = inlineEdits[project.id];
    if (!edits || !Object.keys(edits).length) return;
    const updated = { ...project, ...edits };
    try {
      const res = await api.patch(`/projects/${project.id}`, edits);
      dispatch({ type: 'UPDATE', key: 'projects', id: project.id, value: res });
    } catch {
      dispatch({ type: 'UPDATE', key: 'projects', id: project.id, value: edits });
    }
    setInlineEdits(prev => { const n = { ...prev }; delete n[project.id]; return n; });
  };

  const getEditModalFields = (project) => modalFields.map(f => ({
    ...f,
    value: project[f.id] !== undefined ? String(project[f.id]) : f.value,
  }));

  const getInlineVal = (project, field) => {
    return (inlineEdits[project.id] && inlineEdits[project.id][field] !== undefined)
      ? inlineEdits[project.id][field]
      : (project[field] !== undefined ? project[field] : '');
  };

  const dueDateColor = (project) => {
    if (!project.dueDate) return 'text-ink-dim';
    if (isOverdue(project.dueDate) && project.status !== 'Complete') return 'text-red';
    const d = daysUntil(project.dueDate);
    if (d <= 7) return 'text-amber';
    return 'text-ink-dim';
  };

  return (
    <div className="page-scroll">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--color-ink, #F0EDE8)' }}>Projects</h1>
        <button className="btn-primary text-sm" onClick={() => setShowModal(true)}>+ Add Project</button>
      </div>

      {/* Filter bar */}
      <div className="flex gap-1 flex-wrap mb-5">
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors border ${filter === f ? 'border-teal text-teal' : 'border-border text-ink-dim hover:text-ink hover:border-border2'}`}
            style={filter === f ? { borderColor: 'var(--color-teal, #2ABFBF)', color: 'var(--color-teal, #2ABFBF)' } : {}}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Table */}
      {filteredProjects.length === 0 ? (
        <EmptyState
          title="No projects found"
          description={filter !== 'All' ? `No projects matching "${filter}".` : 'Add your first project to get started.'}
          action={{ label: '+ Add Project', onClick: () => setShowModal(true) }}
        />
      ) : (
        <div className="panel p-0 overflow-hidden">
          <table className="table-base w-full">
            <thead>
              <tr>
                <th style={{ minWidth: 200 }}>Project Name</th>
                <th>Department</th>
                <th>Owner</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Due Date</th>
                <th>% Done</th>
                <th style={{ minWidth: 160 }}>Blockers</th>
                <th style={{ minWidth: 160 }}>Notes</th>
                <th style={{ width: 90 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProjects.map(project => {
                const isExpanded = expandedId === project.id;
                const hasEdits = inlineEdits[project.id] && Object.keys(inlineEdits[project.id]).length > 0;
                return [
                  <tr
                    key={project.id}
                    className="cursor-pointer transition-colors"
                    style={{ background: isExpanded ? 'var(--color-surface2, #1a1a1a)' : undefined }}
                    onClick={() => setExpandedId(isExpanded ? null : project.id)}
                  >
                    {/* Project Name + Progress Bar */}
                    <td onClick={e => e.stopPropagation()}>
                      <div
                        className="font-medium text-sm cursor-pointer"
                        style={{ color: 'var(--color-ink, #F0EDE8)' }}
                        onClick={() => setExpandedId(isExpanded ? null : project.id)}
                      >
                        {project.name || '—'}
                      </div>
                      <ProgressBar value={getInlineVal(project, 'percentComplete')} />
                    </td>

                    {/* Department */}
                    <td onClick={e => e.stopPropagation()}>
                      <InlineSelect
                        value={getInlineVal(project, 'department') || 'Design'}
                        options={DEPARTMENTS}
                        onChange={v => handleInlineChange(project.id, 'department', v)}
                      />
                    </td>

                    {/* Owner */}
                    <td onClick={e => e.stopPropagation()}>
                      <InlineText
                        value={getInlineVal(project, 'owner')}
                        onChange={v => handleInlineChange(project.id, 'owner', v)}
                      />
                    </td>

                    {/* Priority */}
                    <td onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={getInlineVal(project, 'priority') || project.priority} />
                        <select
                          className="text-xs bg-transparent border-0 outline-none cursor-pointer"
                          style={{ color: 'transparent', width: 12 }}
                          value={getInlineVal(project, 'priority') || project.priority || ''}
                          onChange={e => handleInlineChange(project.id, 'priority', e.target.value)}
                        >
                          {PRIORITIES.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                    </td>

                    {/* Status */}
                    <td onClick={e => e.stopPropagation()}>
                      <InlineSelect
                        value={getInlineVal(project, 'status') || 'Not Started'}
                        options={STATUSES}
                        onChange={v => handleInlineChange(project.id, 'status', v)}
                      />
                    </td>

                    {/* Due Date */}
                    <td onClick={e => e.stopPropagation()}>
                      <input
                        type="date"
                        className="input-field text-xs py-0.5 px-1"
                        value={getInlineVal(project, 'dueDate')}
                        onChange={e => handleInlineChange(project.id, 'dueDate', e.target.value)}
                      />
                      {project.dueDate && (
                        <div className={`text-xs mt-0.5 ${dueDateColor(project)}`}>
                          {isOverdue(project.dueDate) && project.status !== 'Complete' ? 'Overdue' : `${daysUntil(project.dueDate)}d`}
                        </div>
                      )}
                    </td>

                    {/* % Done */}
                    <td onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          className="input-field text-xs py-0.5 px-1"
                          style={{ width: 56 }}
                          value={getInlineVal(project, 'percentComplete')}
                          onChange={e => handleInlineChange(project.id, 'percentComplete', e.target.value)}
                        />
                        <span className="text-ink-muted text-xs">%</span>
                      </div>
                    </td>

                    {/* Blockers */}
                    <td onClick={e => e.stopPropagation()}>
                      <div
                        className="text-xs text-ink-dim truncate max-w-xs"
                        style={{ maxWidth: 160 }}
                        title={project.blockers}
                      >
                        {project.blockers || <span className="text-ink-muted">—</span>}
                      </div>
                    </td>

                    {/* Notes */}
                    <td onClick={e => e.stopPropagation()}>
                      <div
                        className="text-xs text-ink-dim truncate"
                        style={{ maxWidth: 160 }}
                        title={project.notes}
                      >
                        {project.notes || <span className="text-ink-muted">—</span>}
                      </div>
                    </td>

                    {/* Actions */}
                    <td onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        {hasEdits && (
                          <button
                            className="btn-primary text-xs px-2 py-0.5"
                            onClick={() => saveInline(project)}
                            title="Save changes"
                          >
                            Save
                          </button>
                        )}
                        <button
                          className="btn-ghost text-xs px-2 py-0.5"
                          onClick={() => setEditingProject(project)}
                          title="Edit"
                        >
                          Edit
                        </button>
                        <button
                          className="btn-icon text-xs"
                          style={{ color: 'var(--color-red, #e05252)' }}
                          onClick={() => setDeleteConfirm(project)}
                          title="Delete"
                        >
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>,

                  isExpanded && (
                    <tr key={`${project.id}-expanded`}>
                      <td colSpan={10} style={{ padding: 0 }}>
                        <SubPanel project={project} state={state} />
                      </td>
                    </tr>
                  )
                ];
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Modal */}
      {showModal && (
        <Modal
          title="New Project"
          fields={modalFields}
          onSubmit={handleAdd}
          onClose={() => setShowModal(false)}
        />
      )}

      {/* Edit Modal */}
      {editingProject && (
        <Modal
          title={`Edit: ${editingProject.name}`}
          fields={getEditModalFields(editingProject)}
          onSubmit={handleEdit}
          onClose={() => setEditingProject(null)}
        />
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={() => setDeleteConfirm(null)}
        >
          <div
            className="panel p-6 max-w-sm w-full"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold mb-2" style={{ color: 'var(--color-ink, #F0EDE8)' }}>Delete Project</h2>
            <p className="text-sm mb-5" style={{ color: 'var(--color-ink-dim, #888)' }}>
              Are you sure you want to delete <strong style={{ color: 'var(--color-ink)' }}>{deleteConfirm.name}</strong>? This cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button className="btn-ghost text-sm" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button
                className="btn-primary text-sm"
                style={{ background: 'var(--color-red, #e05252)', borderColor: 'var(--color-red, #e05252)' }}
                onClick={() => handleDelete(deleteConfirm)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
