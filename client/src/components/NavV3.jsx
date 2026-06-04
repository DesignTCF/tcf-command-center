import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useApp } from '../store/AppContext'
import { fmtTime } from '../lib/utils'

const TABS = [
  { to: '/', label: 'Home' },
  { to: '/brands', label: 'Brands' },
  { to: '/work', label: 'Work' },
  { to: '/calendar', label: 'Calendar' },
  { to: '/alibaba', label: 'Alibaba' },
  { to: '/ask', label: 'Ask AI', accent: true },
]

export default function NavV3({ onRefresh }) {
  const { state } = useApp()
  const location = useLocation()

  // Count open/active items for badges
  const openTasks = (state.tasks || []).filter(t => !t.done && t.status !== 'Done').length
  const openDecisions = (state.decisions || []).filter(d => !d.resolved).length

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-[52px] bg-white border-b border-border flex items-center px-6 gap-0 select-none">
      {/* Brand */}
      <div className="flex items-center gap-2.5 mr-8 shrink-0">
        <div className="w-7 h-7 rounded bg-teal flex items-center justify-center">
          <span className="text-white text-[10px] font-bold tracking-wider">TCF</span>
        </div>
        <span className="text-[12px] font-semibold text-ink tracking-wide">Command Center</span>
      </div>

      {/* Nav tabs */}
      <nav className="flex items-stretch h-[52px] flex-1">
        {TABS.map(t => {
          const active = t.to === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(t.to)
          return (
            <NavLink
              key={t.to}
              to={t.to}
              className={[
                'relative flex items-center px-4 text-[12.5px] font-medium tracking-wide transition-colors duration-150',
                active
                  ? t.accent ? 'text-teal' : 'text-ink'
                  : t.accent ? 'text-teal/60 hover:text-teal' : 'text-ink-muted hover:text-ink',
              ].join(' ')}
            >
              {t.label}
              {t.to === '/work' && openTasks > 0 && (
                <span className="ml-1.5 text-[9px] font-bold bg-amber text-white px-1.5 py-0.5 rounded-full">
                  {openTasks}
                </span>
              )}
              {t.to === '/ask' && (
                <span className="ml-1.5 text-[9px]">✦</span>
              )}
              {active && (
                <span className={`absolute bottom-0 left-3 right-3 h-[2px] rounded-t-sm ${t.accent ? 'bg-teal' : 'bg-ink'}`} />
              )}
            </NavLink>
          )
        })}
      </nav>

      {/* Right side */}
      <div className="flex items-center gap-3 shrink-0 ml-auto">
        {/* Notion connection status */}
        <div className="flex items-center gap-1.5 text-[11px] text-ink-muted">
          <span className="w-1.5 h-1.5 rounded-full bg-green inline-block"></span>
          Notion
        </div>
        <span className="text-[11px] text-ink-muted">
          {state.loading ? 'Syncing…' : state.syncedAt ? `Synced ${fmtTime(state.syncedAt)}` : '—'}
        </span>
        <button onClick={onRefresh} className="btn-icon text-base" title="Refresh">↻</button>
      </div>
    </header>
  )
}
