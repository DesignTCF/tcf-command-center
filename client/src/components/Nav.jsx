import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useApp } from '../store/AppContext'
import { fmtTime } from '../lib/utils'

const TABS = [
  { to: '/', label: 'Dashboard' },
  { to: '/projects', label: 'Projects' },
  { to: '/products', label: 'Products' },
  { to: '/creative', label: 'Creative' },
  { to: '/operations', label: 'Operations' },
  { to: '/files', label: 'Files' },
  { to: '/intelligence', label: 'Intelligence' },
  { to: '/alibaba', label: 'Alibaba', accent: true },
  { to: '/import', label: 'Import' },
  { to: '/calendar', label: 'Calendar' },
  { to: '/links', label: 'Links' },
  { to: '/github', label: 'GitHub' },
]

export default function Nav({ onRefresh }) {
  const { state } = useApp()
  const location = useLocation()

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-[50px] bg-bg border-b border-border flex items-center px-4 gap-6 select-none">
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-teal font-bold tracking-[0.14em] text-xs uppercase">TCF</span>
        <span className="text-ink-muted text-[10px] tracking-[0.06em] uppercase hidden lg:block">Command Center</span>
      </div>

      <nav className="flex items-center gap-0 flex-1 overflow-x-auto">
        {TABS.map(t => {
          const active = t.to === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(t.to)
          return (
            <NavLink
              key={t.to}
              to={t.to}
              className={[
                'relative px-3 h-[50px] flex items-center text-[11px] font-medium tracking-[0.06em] uppercase transition-colors duration-150 shrink-0',
                active
                  ? (t.accent ? 'text-gold' : 'text-ink')
                  : (t.accent ? 'text-gold/50 hover:text-gold' : 'text-ink-muted hover:text-ink'),
              ].join(' ')}
            >
              {t.label}
              {active && (
                <span className={`absolute bottom-0 left-2 right-2 h-[2px] rounded-t-sm ${t.accent ? 'bg-gold' : 'bg-teal'}`} />
              )}
            </NavLink>
          )
        })}
      </nav>

      <div className="flex items-center gap-2 shrink-0 ml-auto">
        <span className="text-[10px] text-ink-muted hidden md:block">
          {state.loading ? 'Syncing…' : state.syncedAt ? `Synced ${fmtTime(state.syncedAt)}` : '—'}
        </span>
        <button onClick={onRefresh} className="btn-icon text-base" title="Refresh all data">↻</button>
      </div>
    </header>
  )
}
