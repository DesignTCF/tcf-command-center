import { useState, useRef, useCallback } from 'react'
import { useApp } from '../store/AppContext'
import { fmtDate, fmtSize, fileIcon, fileType } from '../lib/utils'
import EmptyState from '../components/EmptyState'
import api from '../lib/api'

const CATEGORIES = ['All', 'Formula', 'Packaging', 'Artwork', 'Photography', 'Contract', 'Regulatory', 'Marketing', 'Operations']

const CAT_PATTERNS = {
  Formula: /formula|fml|inci|batch/i,
  Packaging: /packag|bottle|label|box|dieline|closure/i,
  Artwork: /artwork|art|design|mockup|proof/i,
  Photography: /photo|image|img|jpg|jpeg|png|webp|shoot/i,
  Contract: /contract|agreement|nda|terms/i,
  Regulatory: /regulatory|compliance|fda|eu|sds|msds/i,
  Marketing: /marketing|campaign|social|ad|promo/i,
}

function getCategory(file) {
  if (file.category) return file.category
  const name = file.name || ''
  for (const [cat, re] of Object.entries(CAT_PATTERNS)) {
    if (re.test(name)) return cat
  }
  return 'Operations'
}

export default function Files() {
  const { state, reload } = useApp()
  const [category, setCategory] = useState('All')
  const [search, setSearch] = useState('')
  const [dragging, setDragging] = useState(false)
  const [uploads, setUploads] = useState([])
  const fileInputRef = useRef(null)

  const files = (state.driveFiles || []).filter(f => {
    if (category !== 'All' && getCategory(f) !== category) return false
    if (search && !f.name?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const handleDragOver = useCallback((e) => { e.preventDefault(); setDragging(true) }, [])
  const handleDragLeave = useCallback(() => setDragging(false), [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
    uploadFiles(e.dataTransfer.files)
  }, [])

  async function uploadFiles(fileList) {
    if (!fileList?.length) return
    for (const file of fileList) {
      const id = Date.now() + file.name
      setUploads(u => [...u, { id, name: file.name, progress: 'Uploading…' }])
      try {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('category', category !== 'All' ? category : 'Operations')
        await api.upload('/drive/upload', fd)
        setUploads(u => u.map(up => up.id === id ? { ...up, progress: 'Done' } : up))
        setTimeout(() => setUploads(u => u.filter(up => up.id !== id)), 2000)
      } catch (err) {
        setUploads(u => u.map(up => up.id === id ? { ...up, progress: 'Failed' } : up))
        setTimeout(() => setUploads(u => u.filter(up => up.id !== id)), 3000)
      }
    }
    reload()
  }

  return (
    <div className="page-scroll">
      {/* Upload Zone */}
      <div
        className={`border-[1.5px] border-dashed rounded-lg p-6 text-center mb-5 transition-colors cursor-pointer ${dragging ? 'border-teal bg-teal/5' : 'border-border2 hover:border-teal/50'}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="text-2xl mb-2 text-ink-muted">↑</div>
        <div className="text-sm text-ink-dim">Drop files here or <span className="text-teal cursor-pointer">browse</span></div>
        <div className="text-xs text-ink-muted mt-1">Files upload directly to Google Drive</div>
        <input ref={fileInputRef} type="file" multiple hidden onChange={e => uploadFiles(e.target.files)} />
      </div>

      {/* Upload progress */}
      {uploads.length > 0 && (
        <div className="mb-4 flex flex-col gap-1">
          {uploads.map(u => (
            <div key={u.id} className="flex items-center gap-2 text-xs text-ink-dim">
              <span className={u.progress === 'Done' ? 'text-green' : u.progress === 'Failed' ? 'text-red' : 'text-teal'}>
                {u.progress === 'Done' ? '✓' : u.progress === 'Failed' ? '✕' : '↑'}
              </span>
              <span className="truncate">{u.name}</span>
              <span className="text-ink-muted">{u.progress}</span>
            </div>
          ))}
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex gap-1.5 flex-wrap flex-1">
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setCategory(c)}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${category === c ? 'bg-teal/10 border-teal/40 text-teal' : 'bg-surface border-border text-ink-muted hover:border-teal/50 hover:text-teal'}`}>
              {c}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <input
            type="text" placeholder="Search files…" value={search}
            onChange={e => setSearch(e.target.value)}
            className="input-field w-44 text-xs"
          />
          <button className="btn-ghost text-xs" onClick={reload}>↻ Sync</button>
        </div>
      </div>

      {/* Drive not connected notice */}
      {!state.driveFiles?.length && (
        <div className="panel p-4 mb-4 text-sm text-ink-muted">
          Google Drive not connected — add GDRIVE_CLIENT_ID, GDRIVE_CLIENT_SECRET, and GDRIVE_REFRESH_TOKEN to .env to enable file sync.
        </div>
      )}

      {/* File Grid */}
      {files.length === 0 && state.driveFiles?.length > 0 ? (
        <EmptyState message="No files match this filter" />
      ) : (
        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
          {files.map(f => (
            <a key={f.id} href={f.url || f.webViewLink || '#'} target="_blank" rel="noopener"
              className="panel p-3.5 cursor-pointer hover:border-teal/40 hover:bg-surface2 transition-colors block no-underline">
              <div className="text-2xl mb-2 leading-none">{fileIcon(f.type || fileType(f.mimeType, f.name))}</div>
              <div className="text-xs text-ink font-medium leading-snug mb-1 line-clamp-2">{f.name}</div>
              <div className="text-[10.5px] text-ink-muted">
                {[fmtSize(f.size), fmtDate(f.modified || f.modifiedTime)].filter(Boolean).join(' · ')}
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
