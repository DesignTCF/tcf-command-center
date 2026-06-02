import React, { createContext, useContext, useReducer, useEffect } from 'react'
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
  // Doc import state
  doc: null,         // { title, sections, plainText, lastFetched }
  docLoading: false,
  docError: null,
  // AI chat state
  chatHistory: [],
  // UI
  loading: true, syncedAt: null,
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
    case 'SYNCED':     return { ...state, loading: false, syncedAt: new Date().toISOString() }
    default:           return state
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initial)

  async function loadAll() {
    dispatch({ type: 'LOADING', value: true })

    // Always load static baked-in data first — instant, works everywhere
    dispatch({ type: 'SET_MANY', payload: staticData })

    // Then try live API — if server is running, it overwrites with fresh data
    let serverUp = false
    try {
      await fetch('/api/health', { signal: AbortSignal.timeout(1500) })
      serverUp = true
    } catch { /* no server — static data is good */ }

    if (!serverUp) {
      dispatch({ type: 'SYNCED' })
      return
    }

    const localKeys = [
      'products', 'formulas', 'packaging', 'manufacturing', 'content',
      'decisions', 'intelligence', 'contacts', 'brand-health',
      'projects', 'suppliers', 'purchasing', 'inventory', 'website-projects',
      'calendar', 'import-items', 'alibaba-convos', 'notion-page-tasks',
    ]
    const stateKeys = [
      'products', 'formulas', 'packaging', 'manufacturing', 'content',
      'decisions', 'intelligence', 'contacts', 'brandHealth',
      'projects', 'suppliers', 'purchasing', 'inventory', 'websiteProjects',
      'calendar', 'importItems', 'alibabaCo', 'notionPageTasks',
    ]

    const [localResults, gmailResult, notionTasksResult, notionContentResult, driveResult] = await Promise.allSettled([
      Promise.allSettled(localKeys.map(k => api.get(`/data/${k}`))),
      api.get('/gmail/threads?limit=40'),
      api.get('/notion/tasks'),
      api.get('/notion/content'),
      api.get('/drive/recent?limit=60'),
    ])

    if (localResults.status === 'fulfilled') {
      const payload = {}
      localResults.value.forEach((r, i) => {
        if (r.status === 'fulfilled') payload[stateKeys[i]] = r.value
        else if (staticData[stateKeys[i]]) payload[stateKeys[i]] = staticData[stateKeys[i]]
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

    dispatch({ type: 'SYNCED' })
  }

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

  useEffect(() => { loadAll() }, [])

  return (
    <AppContext.Provider value={{ state, dispatch, reload: loadAll, loadDoc }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
