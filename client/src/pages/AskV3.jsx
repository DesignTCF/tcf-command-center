import { useState, useRef, useEffect, useMemo } from 'react'
import { useApp } from '../store/AppContext'
import api from '../lib/api'
import { timeAgo } from '../lib/utils'

// ── Drive Sources panel ───────────────────────────────────────────────────────
function DriveSources() {
  const [sources, setSources] = useState([])
  const [adding, setAdding] = useState(false)
  const [url, setUrl] = useState('')
  const [label, setLabel] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/sources').then(setSources).catch(() => {})
  }, [])

  async function addSource() {
    if (!url.trim()) return
    setLoading(true); setError('')
    try {
      const s = await api.post('/sources', { url: url.trim(), label: label.trim() || 'Untitled' })
      setSources(prev => [...prev, s])
      setUrl(''); setLabel(''); setAdding(false)
    } catch (err) {
      setError(err.message || 'Could not read file. Make sure it is set to "Anyone with the link can view".')
    } finally { setLoading(false) }
  }

  async function refresh(id) {
    await api.post(`/sources/${id}/refresh`, {})
    const updated = await api.get('/sources')
    setSources(updated)
  }

  async function remove(id) {
    await api.del(`/sources/${id}`)
    setSources(prev => prev.filter(s => s.id !== id))
  }

  return (
    <div className="border-t border-border pt-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <div className="section-title">Google Drive Files</div>
        <button onClick={() => setAdding(a => !a)} className="btn-ghost text-xs py-1">+ Add File</button>
      </div>

      {adding && (
        <div className="bg-surface rounded-lg p-3 mb-3 border border-border">
          <input className="input-field text-xs mb-2" placeholder="Paste Google Drive link…" value={url} onChange={e => setUrl(e.target.value)} />
          <input className="input-field text-xs mb-2" placeholder="Label (e.g. Client Tracker)" value={label} onChange={e => setLabel(e.target.value)} />
          {error && <div className="text-xs text-red mb-2">{error}</div>}
          <div className="flex gap-2">
            <button onClick={addSource} disabled={loading} className="btn-primary text-xs py-1 disabled:opacity-50">
              {loading ? 'Reading…' : 'Connect'}
            </button>
            <button onClick={() => { setAdding(false); setError('') }} className="btn-ghost text-xs py-1">Cancel</button>
          </div>
          <div className="text-[10px] text-ink-muted mt-2">Make sure the file is set to "Anyone with the link can view"</div>
        </div>
      )}

      {sources.length === 0 && !adding && (
        <div className="text-xs text-ink-muted py-2">No files connected yet</div>
      )}

      {sources.map(s => (
        <div key={s.id} className="flex items-center gap-2 py-1.5 group">
          <span className="w-2 h-2 rounded-full bg-green shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-ink truncate">{s.label}</div>
            <div className="text-[10px] text-ink-muted">{s.rowCount ? `${s.rowCount} rows · ` : ''}{s.type === 'sheet' ? 'Spreadsheet' : 'Document'}</div>
          </div>
          <button onClick={() => refresh(s.id)} className="btn-icon text-[10px] opacity-0 group-hover:opacity-100" title="Refresh">↻</button>
          <button onClick={() => remove(s.id)} className="btn-icon text-[10px] opacity-0 group-hover:opacity-100 hover:text-red" title="Remove">✕</button>
        </div>
      ))}
    </div>
  )
}

const SUGGESTIONS = {
  'About Brands': [
    "What's the current status of NeVoo?",
    "What's blocking Daily Rou's launch?",
    "Which client brand has the most open items?",
    "What products does Nitt Beauty have in progress?",
  ],
  'About Work': [
    "What are my most urgent Notion tasks right now?",
    "What decisions need to be made this week?",
    "Which projects are behind schedule?",
    "What's on my to-do list?",
  ],
  'About Products': [
    "What products are in stability testing?",
    "Which packaging items are still in sourcing?",
    "What's the status of the Nitt Beauty bottles?",
    "Which products are ready to launch?",
  ],
  'About Suppliers': [
    "Which Alibaba suppliers am I waiting on?",
    "What's the follow-up status with Chunbai?",
    "Which supplier follow-ups are overdue?",
  ],
}

const INTRO = `Hi Katherine — I'm connected to your Notion tasks, all your client products, packaging status, projects, decisions, supplier conversations, and intelligence notes.

Ask me anything about what's happening across TCF and your clients. I'll answer based on your real data.`

export default function AskV3() {
  const { state } = useApp()
  const [messages, setMessages] = useState([
    { role: 'assistant', content: INTRO, ts: new Date().toISOString() }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight
    }
  }, [messages, loading])

  const dataSources = useMemo(() => [
    { label: 'Notion Tasks', count: (state.tasks || []).length, connected: (state.tasks || []).length > 0 },
    { label: 'Notion Content Calendar', count: (state.notionContent || []).length, connected: (state.notionContent || []).length > 0 },
    { label: 'Products', count: (state.products || []).length, connected: (state.products || []).length > 0 },
    { label: 'Projects', count: (state.projects || []).length, connected: (state.projects || []).length > 0 },
    { label: 'Packaging', count: (state.packaging || []).length, connected: (state.packaging || []).length > 0 },
    { label: 'Suppliers', count: (state.suppliers || []).length, connected: (state.suppliers || []).length > 0 },
    { label: 'Decisions', count: (state.decisions || []).filter(d => !d.resolved).length, connected: true },
    { label: 'Intelligence Notes', count: (state.intelligence || []).length, connected: (state.intelligence || []).length > 0 },
    { label: 'Google Drive', count: 0, connected: false, setup: true },
    { label: 'Gmail', count: 0, connected: (state.gmailThreads || []).length > 0 },
  ], [state])

  async function send(text) {
    const msg = (text || input).trim()
    if (!msg || loading) return
    setInput('')

    const userMsg = { role: 'user', content: msg, ts: new Date().toISOString() }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    try {
      const context = {
        tasks: state.tasks?.slice(0, 30),
        notionContent: state.notionContent?.slice(0, 20),
        products: state.products,
        projects: state.projects,
        decisions: (state.decisions || []).filter(d => !d.resolved),
        suppliers: state.suppliers,
        packaging: state.packaging,
        alibabaCo: state.alibabaCo,
        intelligence: state.intelligence?.slice(0, 10),
        content: state.content?.slice(0, 10),
        chatHistory: messages.slice(-6).map(m => ({ role: m.role, content: m.content })),
      }
      const res = await api.post('/ai/chat', { message: msg, context })
      setMessages(prev => [...prev, { role: 'assistant', content: res.reply, ts: new Date().toISOString() }])
    } catch (err) {
      const errText = err.message?.includes('ANTHROPIC_API_KEY')
        ? 'Add your ANTHROPIC_API_KEY to .env to enable AI chat. Get a key at console.anthropic.com'
        : `Error: ${err.message}`
      setMessages(prev => [...prev, { role: 'assistant', content: errText, ts: new Date().toISOString(), isError: true }])
    } finally {
      setLoading(false)
    }
  }

  function renderMessage(content) {
    // Simple markdown: **bold**, bullet lists
    return content
      .split('\n')
      .map((line, i) => {
        if (line.startsWith('- ') || line.startsWith('• ')) {
          return <div key={i} className="flex gap-2 my-0.5"><span className="text-teal mt-0.5 shrink-0">•</span><span>{line.slice(2)}</span></div>
        }
        const parts = line.split(/\*\*([^*]+)\*\*/g)
        return (
          <div key={i} className={line === '' ? 'h-2' : ''}>
            {parts.map((p, j) => j % 2 === 1 ? <strong key={j}>{p}</strong> : p)}
          </div>
        )
      })
  }

  return (
    <div className="h-full flex overflow-hidden">
      {/* LEFT — Context panel */}
      <div className="w-[300px] border-r border-border flex flex-col shrink-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <div className="text-sm font-semibold text-ink">What I know</div>
          <div className="text-xs text-ink-muted mt-0.5">Data sources connected</div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="flex flex-col gap-2 mb-6">
            {dataSources.map(src => (
              <div key={src.label} className="flex items-center gap-2.5">
                <span className={`w-2 h-2 rounded-full shrink-0 ${src.connected ? 'bg-green' : 'bg-surface3'}`} />
                <span className="text-sm text-ink flex-1">{src.label}</span>
                {src.connected && src.count > 0 && (
                  <span className="text-[10.5px] text-ink-muted">{src.count}</span>
                )}
                {!src.connected && src.setup && (
                  <span className="text-[10px] text-amber">Setup →</span>
                )}
              </div>
            ))}
          </div>

          <DriveSources />

          <div className="section-title mb-3 mt-5">Suggested Questions</div>
          {Object.entries(SUGGESTIONS).map(([cat, qs]) => (
            <div key={cat} className="mb-4">
              <div className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider mb-2">{cat}</div>
              {qs.map(q => (
                <button key={q} onClick={() => send(q)}
                  className="w-full text-left text-[12px] text-ink-dim bg-surface hover:bg-surface2 hover:text-ink border border-border hover:border-teal/40 rounded-lg px-3 py-2 mb-1.5 transition-all">
                  {q}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT — Chat */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-3 border-b border-border shrink-0">
          <div>
            <div className="text-sm font-semibold text-ink">Ask Anything</div>
            <div className="text-xs text-ink-muted">Answers based on your real data — never makes changes unless you ask</div>
          </div>
          <button onClick={() => setMessages([{ role: 'assistant', content: INTRO, ts: new Date().toISOString() }])}
            className="btn-ghost text-xs">Clear</button>
        </div>

        {/* Messages */}
        <div ref={messagesRef} className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-teal text-white text-sm font-medium'
                  : msg.isError
                  ? 'bg-red/5 border border-red/30 text-red text-sm'
                  : 'bg-surface border border-border text-ink text-sm leading-relaxed'
              }`}>
                {msg.role === 'assistant'
                  ? <div className="flex flex-col gap-0.5">{renderMessage(msg.content)}</div>
                  : msg.content
                }
                <div className={`text-[9.5px] mt-2 ${msg.role === 'user' ? 'text-white/60' : 'text-ink-muted'}`}>
                  {timeAgo(msg.ts)}
                </div>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-surface border border-border rounded-xl px-4 py-3 flex items-center gap-1.5">
                {[0, 1, 2].map(i => (
                  <span key={i} className="w-1.5 h-1.5 rounded-full bg-teal animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-border px-6 py-4 shrink-0">
          <div className="flex gap-3 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              placeholder="Ask anything about your business, clients, products, or tasks…"
              rows={2}
              className="input-field flex-1 text-sm resize-none"
              style={{ minHeight: '52px', maxHeight: '120px' }}
            />
            <button onClick={() => send()} disabled={!input.trim() || loading}
              className="btn-primary px-4 py-3 disabled:opacity-40 disabled:cursor-not-allowed shrink-0">
              ↑
            </button>
          </div>
          <div className="text-[10px] text-ink-muted mt-2 text-center">
            Powered by Claude · Enter to send · Shift+Enter for new line
          </div>
        </div>
      </div>
    </div>
  )
}
