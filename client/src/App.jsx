import { useState } from 'react'
import { LayoutDashboard, CheckSquare, CalendarDays, Package, RefreshCw, Check, AlertCircle } from 'lucide-react'
import { useApp } from './store/AppContext.jsx'
import { relativeTime } from './lib/utils.js'
import Overview from './views/Overview.jsx'
import Tasks from './views/Tasks.jsx'
import Calendar from './views/Calendar.jsx'
import Inventory from './views/Inventory.jsx'

const TABS = [
  { id: 'overview',  label: 'Overview',              icon: LayoutDashboard, Comp: Overview },
  { id: 'tasks',     label: 'Tasks & To-Dos',        icon: CheckSquare,     Comp: Tasks },
  { id: 'calendar',  label: 'Calendar',              icon: CalendarDays,    Comp: Calendar },
  { id: 'inventory', label: 'Sourcing',                icon: Package,        Comp: Inventory },
]

function UpdateButton() {
  const { updateNow, refreshState } = useApp()
  const map = {
    idle:        { label: 'Update Now', icon: RefreshCw, cls: 'btn-primary', spin: false },
    working:     { label: 'Refreshing…', icon: RefreshCw, cls: 'btn-primary opacity-90', spin: true },
    done:        { label: 'Refresh started', icon: Check, cls: 'btn bg-green text-white', spin: false },
    error:       { label: 'Try again', icon: AlertCircle, cls: 'btn bg-red text-white', spin: false },
    unavailable: { label: 'Update Now', icon: RefreshCw, cls: 'btn-primary', spin: false },
  }
  const s = map[refreshState] || map.idle
  const Icon = s.icon
  return (
    <div className="flex flex-col items-end">
      <button className={s.cls} onClick={updateNow} disabled={refreshState === 'working'}>
        <Icon size={15} className={s.spin ? 'animate-spin' : ''} />
        {s.label}
      </button>
      {refreshState === 'done' && (
        <span className="mt-1 text-2xs text-ink-muted">Live data updates in ~2 min</span>
      )}
      {refreshState === 'unavailable' && (
        <span className="mt-1 text-2xs text-amber">Auto-refresh runs on schedule</span>
      )}
    </div>
  )
}

export default function App() {
  const [tab, setTab] = useState('overview')
  const { generatedAt } = useApp()
  const Active = TABS.find(t => t.id === tab).Comp

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-surface/90 backdrop-blur border-b border-border">
        <div className="max-w-7xl mx-auto px-5 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal text-white grid place-items-center text-lg">🧭</div>
            <div>
              <h1 className="text-lg font-bold leading-tight text-ink">TCF Command Center</h1>
              <p className="text-2xs text-ink-muted">
                Operations overview · updated {relativeTime(generatedAt)}
              </p>
            </div>
          </div>
          <UpdateButton />
        </div>
        {/* Tabs */}
        <nav className="max-w-7xl mx-auto px-5 flex gap-1 overflow-x-auto">
          {TABS.map(t => {
            const Icon = t.icon
            const active = t.id === tab
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
                  active ? 'border-teal text-teal-dim' : 'border-transparent text-ink-muted hover:text-ink'
                }`}
              >
                <Icon size={15} />
                {t.label}
              </button>
            )
          })}
        </nav>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-5 py-6">
        <Active onNavigate={setTab} />
      </main>
    </div>
  )
}
