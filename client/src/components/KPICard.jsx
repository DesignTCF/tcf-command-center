import React from 'react'

const VALUE_COLORS = {
  teal: 'text-teal',
  gold: 'text-gold',
  green: 'text-green',
  amber: 'text-amber',
  red: 'text-red',
  default: 'text-ink',
}

export default function KPICard({ label, value, sub, color = 'default', onClick, children }) {
  return (
    <div
      className={`flex-1 bg-surface border-r border-border last:border-r-0 px-5 py-4 transition-colors duration-150 ${onClick ? 'cursor-pointer hover:bg-surface2' : ''}`}
      onClick={onClick}
    >
      <div className="text-[10px] font-700 tracking-[0.1em] uppercase text-ink-muted mb-2">{label}</div>
      <div className={`text-3xl font-light tabular-nums leading-none ${VALUE_COLORS[color] || VALUE_COLORS.default}`}>
        {value ?? '—'}
      </div>
      {sub && <div className="text-[10.5px] text-ink-muted mt-1.5">{sub}</div>}
      {children}
    </div>
  )
}

export function KPIStrip({ children }) {
  return (
    <div className="flex bg-surface border border-border rounded-lg overflow-hidden mb-7">
      {children}
    </div>
  )
}
