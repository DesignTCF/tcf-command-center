import React, { createContext, useContext, useReducer, useEffect, useRef, useCallback } from 'react'
import api from '../lib/api'
import staticData from '../data/staticData'

const AppContext = createContext(null)

const initial = {
  tasks: [], projects: [], products: [], formulas: [], packaging: [],
  manufacturing: [], content: [], decisions: [], intelligence: [],
  suppliers: [], purchasing: [], inventory: [], websiteProjects: [],
  contacts: [], calendar: [], importItems: [], alibabaCo: [],
  gmailThreads: [], driveFiles: [], notionContent: [], notionPageTasks: [],
  brandHealth: { streak: 0, lastUpdated: null },
  doc: null, docLoading: false, docError: null,
  chatHistory: [],
  loading: true,
  syncing: false,
  syncedAt: null,
  syncError: null,
  serverUp: false,
}

function reducer(state, action) {
  switch (action.type) {
    case 'SET':        return { ...state, [action.key]: action.value }
    case 'SET_MANY':   return { ...state, ...action.payload }
    case 'ADD':        return { ...state, [action.key]: [...(state[action.key] || []), action.value] }
    case 'UPDATE':     return { ...state, [action.key]: (state[action.key] || []).map(i => i.id === action.id ? { ...i, ...action.value } : i) }
    case 'DELETE':     return { ...state, [action.key]: (state[action.key] || []).filter(i => i.id !== action.id) }
    case 'CHAT_ADD':   return { ...state, chatHistory: [...state.chatHistory, action.message] }
    case 'CHAT_CLEAR': return { ...state, chatHistory: [] }
    case 'LOADING':    return { ...state, loading: action.value }
    case 'SYNCING':    return { ...state, syncing: action.value }
    case 'SYNCED':     return { ...state, loading: false, syncing: false, syncedAt: new Date().toISOString(), syncError: null }
    case 'SYNC_ERROR': return { ...state, loading: false, syncing: false, syncError: action.error }
    case 'SERVER_UP':  return { ...state, serverUp: action.value }
    default:           return state
  }
}

const LOCAL_KEYS  = ['products','formulas','packaging','manufacturing','content','decisions','intelligence','contacts','brand-health','projects','suppliers','purchasing','inventory','website-projects','calendar','import-items','alibaba-convos','notion-page-tasks']
const STATE_KEYS  = ['products','formulas','packaging','manufacturing','content','decisions','intelligence','contacts','brandHealth','projects','suppliers','purchasing','inventory','websiteProjects','calendar','importItems','alibabaCo','notionPageTasks']

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initial)
  const pollRef = useRef(null)
  const serverUpRef = useRef(false)

  // ── Load all data from API ────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    dispatch({ type: 'LOADING', value: true })
    dispatch({ type: 'SET_MANY', payload: staticData })

    let serverUp = false
    try {
      await fetch('/api/health', { signal: AbortSignal.timeout(2000) })
      serverUp = true
    } catch {}

    serverUpRef.current = serverUp
    dispatch({ type: 'SERVER_UP', value: serverUp })

    if (!serverUp) {
      dispatch({ type: 'SYNCED' })
      return
    }

    const [localResults, gmailResult, notionTasksResult, notionContentResult, driveResult, gcalResult] = await Promise.allSettled([
      Promise.allSettled(LOCAL_KEYS.map(k => api.get(`/data/${k}`))),
      api.get('/gmail/threads?limit=40'),
      api.get('/notion/tasks'),
      api.get('/notion/content'),
      api.get('/drive/recent?limit=60'),
      api.get('/gcal/events'),
    ])

    if (localResults.status === 'fulfilled') {
      const payload = {}
      localResults.value.forEach((r, i) => {
        if (r.status === 'fulfilled') payload[STATE_KEYS[i]] = r.value
        else if (staticData[STATE_KEYS[i]]) payload[STATE_KEYS[i]] = staticData[STATE_KEYS[i]]
      })
      dispatch({ type: 'SET_MANY', payload })
    }

    if (gmailResult.status === 'fulfilled')
      dispatch({ type: 'SET', key: 'gmailThreads', value: gmailResult.value })
    if (notionTasksResult.status === 'fulfilled')
      dispatch({ type: 'SET', key: 'tasks', value: notionTasksResult.value })
    if (notionContentResult.status === 'fulfilled')
      dispatch({ type: 'SET', key: 'notionContent', value: notionContentResult.value })
    if (driveResult.status === 'fulfilled')
      dispatch({ type: 'SET', key: 'driveFiles', value: driveResult.value })
    if (gcalResult.status === 'fulfilled')
      dispatch({ type: 'SET', key: 'gcalEvents', value: gcalResult.value })

    dispatch({ type: 'SYNCED' })
  }, [])

  // ── Sync all live sources then reload state ───────────────────────────────
  const syncAll = useCallback(async () => {
    dispatch({ type: 'SYNCING', value: true })
    try {
      if (serverUpRef.current) {
        // Server is up — hit the sync endpoint which re-fetches Notion, GCal, Drive sources
        await api.post('/sync', {})
        // Then reload all state with fresh data
        await loadAll()
      } else {
        // GitHub Pages (no server) — trigger GitHub Actions workflow to rebuild with fresh data
        // Token is injected at build time via VITE_GH_TOKEN env var (never committed)
        const ghToken = import.meta.env.VITE_GH_TOKEN
        if (ghToken) {
          await fetch('https://api.github.com/repos/DesignTCF/tcf-command-center/actions/workflows/refresh-and-deploy.yml/dispatches', {
            method: 'POST',
            headers: { 'Authorization': `token ${ghToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ ref: 'main' }),
          })
        }
        dispatch({ type: 'SYNCED' })
      }
    } catch (err) {
      dispatch({ type: 'SYNC_ERROR', error: err.message })
    }
  }, [loadAll])

  // ── Auto-poll every 5 minutes when server is up ───────────────────────────
  useEffect(() => {
    loadAll()
  }, [])

  useEffect(() => {
    // Start polling after first load
    pollRef.current = setInterval(() => {
      if (serverUpRef.current) {
        loadAll()
      }
    }, 5 * 60 * 1000) // every 5 minutes

    return () => clearInterval(pollRef.current)
  }, [loadAll])

  // ── Load Google Doc ───────────────────────────────────────────────────────
  async function loadDoc() {
    dispatch({ type: 'SET', key: 'docLoading', value: true })
    dispatch({ type: 'SET', key: 'docError', value: null })
    try {
      const doc = await api.get('/docs/content')
      dispatch({ type: 'SET', key: 'doc', value: doc })
    } catch (err) {
      dispatch({ type: 'SET', key: 'docError', value: err.message })
    } finally {
      dispatch({ type: 'SET', key: 'docLoading', value: false })
    }
  }

  return (
    <AppContext.Provider value={{ state, dispatch, reload: loadAll, syncAll, loadDoc }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
