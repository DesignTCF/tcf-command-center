export function fmtDate(d) {
  if (!d) return '—'
  const date = new Date(d)
  if (isNaN(date)) return d
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function fmtDateShort(d) {
  if (!d) return '—'
  const date = new Date(d)
  if (isNaN(date)) return d
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function fmtTime(d) {
  if (!d) return ''
  return new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export function fmtSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

export function isOverdue(dateStr) {
  if (!dateStr) return false
  return new Date(dateStr) < new Date()
}

export function daysUntil(dateStr) {
  if (!dateStr) return null
  const diff = new Date(dateStr) - new Date()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr)
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return fmtDate(dateStr)
}

export function fileIcon(type) {
  const icons = {
    folder: '📁', image: '🖼', pdf: '📄', document: '📝',
    spreadsheet: '📊', presentation: '📑', video: '🎬', archive: '🗜', file: '📎',
  }
  return icons[type] || icons.file
}

export function fileType(mimeType, name = '') {
  if (!mimeType) return 'file'
  if (mimeType.includes('folder')) return 'folder'
  if (mimeType.includes('image')) return 'image'
  if (mimeType.includes('pdf')) return 'pdf'
  if (mimeType.includes('spreadsheet') || name.endsWith('.xlsx') || name.endsWith('.csv')) return 'spreadsheet'
  if (mimeType.includes('presentation') || name.endsWith('.pptx')) return 'presentation'
  if (mimeType.includes('document') || name.endsWith('.docx')) return 'document'
  if (mimeType.includes('video')) return 'video'
  return 'file'
}

export function clsx(...args) {
  return args.filter(Boolean).join(' ')
}

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}
