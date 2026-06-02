import { useState, useRef, useEffect } from 'react'
import { useApp } from '../store/AppContext'
import api from '../lib/api'
import { timeAgo } from '../lib/utils'

const SUGGESTIONS = [
  "What are the highest-priority items this week?",
  "What supplier follow-ups are pending?",
  "What decisions need to be made?",
  "What's blocking the most projects?",
  "What product launches are coming up?",
  "Summarize the open items from my document.",
]

export default function AIChatPanel() {
  const { state, dispatch } = useApp()
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const messagesRef = useRef(null)
  const inputRef = useRef(null)

  const history = state.chatHistory || []

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight
    }
  }, [history, loading])

  async function send(text) {
    const msg = (text || input).trim()
    if (!msg || loading) return
    setInput('')
    setError(null)

    const userMsg = { role: 'user', content: msg, timestamp: new Date().toISOString() }
    dispatch({ type: 'CHAT_ADD', message: userMsg })
    setLoading(true)

    try {
      const context = {
        tasks: state.tasks?.slice(0, 20),
        projects: state.projects,
        decisions: state.decisions?.filter(d => !d.resolved),
        suppliers: state.suppliers,
        products: state.products?.slice(0, 20),
        docText: state.doc?.plainText?.slice(0, 4000),
        chatHistory: history.slice(-6).map(m => ({ role: m.role, content: m.content })),
      }

      const res = await api.post('/ai/chat', { message: msg, context })
      dispatch({
        type: 'CHAT_ADD',
        message: { role: 'assistant', content: res.reply, timestamp: new Date().toISOString() }
      })
    } catch (err) {
      const errMsg = err.message.includes('ANTHROPIC_API_KEY')
        ? 'Add ANTHROPIC_API_KEY to .env to enable AI chat.'
        : `Error: ${err.message}`
      setError(errMsg)
      dispatch({
        type: 'CHAT_ADD',
        message: { role: 'assistant', content: errMsg, timestamp: new Date().toISOString(), isError: true }
      })
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <>
      {/* Floating trigger */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm shadow-lg transition-all duration-200 ${open ? 'bg-surface2 text-teal border border-teal' : 'bg-teal text-black hover:bg-teal-dim'}`}
        title="AI Executive Assistant"
      >
        {open ? '✕' : '✦'}
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/20"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Panel */}
      <div className={`fixed right-0 top-[50px] bottom-0 z-50 w-[400px] bg-surface border-l border-border flex flex-col shadow-2xl transition-transform duration-250 ${open ? 'translate-x-0' : 'translate-x-full'}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div>
            <div className="text-sm font-semibold text-ink">AI Executive Assistant</div>
            <div className="text-[10px] text-ink-muted">Powered by Claude · Has access to all dashboard data</div>
          </div>
          <div className="flex items-center gap-2">
            {history.length > 0 && (
              <button
                className="text-[10.5px] text-ink-muted hover:text-red transition-colors"
                onClick={() => dispatch({ type: 'CHAT_CLEAR' })}
              >
                Clear
              </button>
            )}
            <button className="btn-icon" onClick={() => setOpen(false)}>✕</button>
          </div>
        </div>

        {/* Messages */}
        <div ref={messagesRef} className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
          {history.length === 0 ? (
            <div className="flex flex-col gap-2">
              <div className="text-[10.5px] text-ink-muted mb-2 text-center">Ask me anything about your dashboard or document</div>
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => send(s)}
                  className="text-left text-xs text-ink-dim bg-surface2 hover:bg-surface3 hover:text-ink border border-border hover:border-teal/30 rounded-lg px-3 py-2.5 transition-all"
                >
                  {s}
                </button>
              ))}
            </div>
          ) : (
            history.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-xl px-3.5 py-2.5 ${
                  msg.role === 'user'
                    ? 'bg-teal text-black text-sm font-medium'
                    : msg.isError
                    ? 'bg-red/10 border border-red/30 text-red text-sm'
                    : 'bg-surface2 text-ink text-sm leading-relaxed'
                }`}>
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                  <div className={`text-[9px] mt-1 ${msg.role === 'user' ? 'text-black/50' : 'text-ink-muted'}`}>
                    {timeAgo(msg.timestamp)}
                  </div>
                </div>
              </div>
            ))
          )}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-surface2 rounded-xl px-4 py-3 flex items-center gap-1">
                {[0,1,2].map(i => (
                  <span key={i} className="w-1.5 h-1.5 rounded-full bg-teal animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-border p-3 shrink-0">
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask me anything…"
              rows={2}
              className="input-field flex-1 text-sm resize-none"
              style={{ minHeight: '44px', maxHeight: '120px' }}
            />
            <button
              onClick={() => send()}
              disabled={!input.trim() || loading}
              className="btn-primary shrink-0 h-[44px] px-4 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ↑
            </button>
          </div>
          <div className="text-[9.5px] text-ink-muted mt-1.5 text-center">
            Enter to send · Shift+Enter for new line · Never modifies dashboard without your approval
          </div>
        </div>
      </div>
    </>
  )
}
