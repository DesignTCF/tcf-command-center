import React from 'react'

export default function EmptyState({ message = 'Nothing here yet', action, onAction }) {
  // Support both: action="text" + onAction=fn  OR  action={label, onClick}
  const label = action && typeof action === 'object' ? action.label : action
  const handler = action && typeof action === 'object' ? action.onClick : onAction

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
      <p className="text-ink-muted text-sm">{message}</p>
      {label && (
        <button className="btn-ghost text-xs mt-1" onClick={handler}>{label}</button>
      )}
    </div>
  )
}
