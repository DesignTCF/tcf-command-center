// Shared helpers for formatting and status coloring.

export function relativeTime(iso) {
  if (!iso) return '—'
  const then = new Date(iso).getTime()
  const diff = Date.now() - then
  const min = Math.round(diff / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min} min ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr} hr ago`
  const day = Math.round(hr / 24)
  return `${day} day${day > 1 ? 's' : ''} ago`
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Parse a date-ish value (YYYY-MM-DD, ISO, or Excel-ish string) → Date at local noon.
export function toDate(v) {
  if (!v) return null
  if (v instanceof Date) return v
  const s = String(v).trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const [y, m, d] = s.slice(0, 10).split('-').map(Number)
    return new Date(y, m - 1, d, 12)
  }
  const parsed = new Date(s)
  return isNaN(parsed) ? null : parsed
}

export function fmtDate(v, { weekday = false } = {}) {
  const d = toDate(v)
  if (!d) return String(v || '')
  const base = `${MONTHS[d.getMonth()]} ${d.getDate()}`
  return weekday ? `${DAYS[d.getDay()]}, ${base}` : base
}

export function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export function daysUntil(v) {
  const d = toDate(v)
  if (!d) return null
  return Math.round((d.setHours(0, 0, 0, 0) - startOfToday().getTime()) / 86400000)
}

// Map a free-text status to a semantic color family used across the app.
export function statusTone(status) {
  const s = (status || '').toLowerCase()
  if (!s) return 'neutral'
  if (/(deliver|received|complete|done|approved|resolved|paid\b)/.test(s)) return 'green'
  if (/(issue|follow.?up|delay|problem|overdue|not paid|urgent)/.test(s)) return 'red'
  if (/(shipped|transit|production|in progress|ordered|requested|planned|incoming)/.test(s)) return 'amber'
  if (/(conversation|sourcing|sample|planned|pending|waiting|deposit)/.test(s)) return 'blue'
  if (/(not moving forward|archived|cancel)/.test(s)) return 'neutral'
  return 'neutral'
}

export const TONE_CLASS = {
  green:   'bg-green-soft text-green',
  red:     'bg-red-soft text-red',
  amber:   'bg-amber-soft text-amber',
  blue:    'bg-blue-soft text-blue',
  teal:    'bg-teal-soft text-teal-dim',
  neutral: 'bg-surface3 text-ink-muted',
}

export function priorityTone(p) {
  const s = (p || '').toLowerCase()
  if (s.includes('high')) return 'red'
  if (s.includes('med')) return 'amber'
  if (s.includes('low')) return 'blue'
  return 'neutral'
}
