import React, { useEffect, useRef } from 'react'

// open defaults to true when not passed (so inline usage like <Modal ...> without open prop works)
export default function Modal({ open = true, title, fields = [], onSave, onClose, onDelete, children, saveLabel = 'Save' }) {
  const firstRef = useRef(null)

  useEffect(() => {
    if (open) setTimeout(() => firstRef.current?.focus(), 50)
  }, [open])

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    if (open) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  function handleSave() {
    if (!fields.length) { onSave?.({}); return }
    const data = {}
    fields.forEach(f => {
      const el = document.getElementById(`modal-field-${f.id}`)
      if (el) data[f.id] = el.value
    })
    onSave?.(data)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') handleSave()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div className="bg-surface border border-border2 rounded-lg w-[480px] max-w-[95vw] shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold tracking-[0.04em]">{title}</h3>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-3.5" onKeyDown={handleKeyDown}>
          {fields.map((f, i) => (
            <ModalField key={f.id} field={f} inputRef={i === 0 ? firstRef : null} />
          ))}
          {children}
        </div>

        <div className="flex items-center justify-between px-5 py-3.5 border-t border-border">
          <div>
            {onDelete && (
              <button className="text-[11.5px] text-ink-muted hover:text-red transition-colors" onClick={onDelete}>
                Delete
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn-primary" onClick={handleSave}>{saveLabel}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ModalField({ field, inputRef }) {
  const { id, label, type = 'text', options = [], value = '', placeholder = '', rows = 3 } = field
  const cls = 'input-field text-sm'

  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10.5px] font-semibold tracking-[0.07em] uppercase text-ink-muted">{label}</label>
      {type === 'select' ? (
        <select id={`modal-field-${id}`} defaultValue={value} className={cls} ref={inputRef}>
          {options.map(o => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      ) : type === 'textarea' ? (
        <textarea id={`modal-field-${id}`} defaultValue={value} placeholder={placeholder} rows={rows} className={cls} ref={inputRef} />
      ) : (
        <input id={`modal-field-${id}`} type={type} defaultValue={value} placeholder={placeholder} className={cls} ref={inputRef} />
      )}
    </div>
  )
}
