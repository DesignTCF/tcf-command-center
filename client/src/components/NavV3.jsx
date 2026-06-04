import React, { useState, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useApp } from '../store/AppContext'
import DashboardSearch from './DashboardSearch'

const TABS = [
  { to: '/',         label: 'Home' },
  { to: '/brands',   label: 'Brands' },
  { to: '/work',     label: 'Work' },
  { to: '/calendar', label: 'Calendar' },
  { to: '/drive',    label: 'Drive' },
  { to: '/alibaba',  label: 'Alibaba' },
  { to: '/ask',      label: 'Ask AI', accent: true },
]

function timeAgo(iso) {
  if (!iso) return null
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000)
  if (diff < 60)   return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function SyncButton({ onSync, syncing, syncedAt, serverUp }) {
  const [label, setLabel] = useState(timeAgo(syncedAt))
  const [flash, setFlash] = useState(false) // brief "Synced!" flash

  useEffect(() => {
    setLabel(timeAgo(syncedAt))
    const t = setInterval(() => setLabel(timeAgo(syncedAt)), 30000)
    return () => clearInterval(t)
  }, [syncedAt])

  // Show a brief "Synced ✓" flash when syncedAt changes
  useEffect(() => {
    if (!syncedAt) return
    setFlash(true)
    const t = setTimeout(() => setFlash(false), 2500)
    return () => clearTimeout(t)
  }, [syncedAt])

  async function handleSync() {
    await onSync()
  }

  const tooltip = serverUp
    ? 'Re-fetch from Notion, Google Calendar, and Drive — updates dashboard immediately'
    : 'Reload latest data — dashboard auto-refreshes 4× per day from all sources'

  return (
    <div className="flex items-center gap-2 shrink-0">

      {/* Status */}
      <div className="flex items-center gap-1.5 text-[11px] text-ink-muted">
        {syncing ? (
          <>
            <span className="w-1.5 h-1.5 rounded-full bg-amber animate-pulse inline-block" />
            <span>Syncing…</span>
          </>
        ) : flash ? (
          <>
            <span className="w-1.5 h-1.5 rounded-full bg-green inline-block" />
            <span className="text-green font-medium">Synced ✓</span>
          </>
        ) : (
          <>
            <span className={`w-1.5 h-1.5 rounded-full inline-block ${serverUp ? 'bg-green' : 'bg-teal'}`} />
            <span>{serverUp ? 'Live' : 'Auto-sync'}</span>
            {label && <span className="text-ink-muted/60">· {label}</span>}
          </>
        )}
      </div>

      {/* Button */}
      <button
        onClick={handleSync}
        disabled={syncing}
        title={tooltip}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-semibold transition-all ${
          syncing
            ? 'bg-surface border-border text-ink-muted cursor-not-allowed'
            : 'bg-white border-border text-ink hover:border-teal/50 hover:text-teal hover:bg-teal/5'
        }`}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          className={syncing ? 'animate-spin' : ''}>
          <path d="M23 4v6h-6M1 20v-6h6"/>
          <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
        </svg>
        Sync All
      </button>
    </div>
  )
}

export default function NavV3() {
  const { state, syncAll } = useApp()
  const location = useLocation()

  const openTasks = (state.tasks || []).filter(t => !t.done && t.status !== 'Done').length

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-[52px] bg-white border-b border-border flex items-center px-6 gap-0 select-none">

      {/* Brand */}
      <div className="flex items-center gap-2.5 mr-5 shrink-0">
        <div className="w-7 h-7 rounded bg-teal flex items-center justify-center">
          <span className="text-white text-[10px] font-bold tracking-wider">TCF</span>
        </div>
        <span className="text-[12px] font-semibold text-ink tracking-wide">Command Center</span>
      </div>

      {/* Nav tabs */}
      <nav className="flex items-stretch h-[52px] shrink-0">
        {TABS.map(t => {
          const active = t.to === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(t.to)
          return (
            <NavLink key={t.to} to={t.to}
              className={[
                'relative flex items-center px-3 text-[12px] font-medium tracking-wide transition-colors duration-150',
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
              {t.to === '/ask' && <span className="ml-1 text-[9px]">✦</span>}
              {active && (
                <span className={`absolute bottom-0 left-2 right-2 h-[2px] rounded-t-sm ${t.accent ? 'bg-teal' : 'bg-ink'}`} />
              )}
            </NavLink>
          )
        })}
      </nav>

      {/* Search */}
      <DashboardSearch />

      {/* Sync */}
      <SyncButton
        onSync={syncAll}
        syncing={state.syncing}
        syncedAt={state.syncedAt}
        serverUp={state.serverUp}
      />
    </header>
  )
}
