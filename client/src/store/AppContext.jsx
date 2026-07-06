import { createContext, useContext, useMemo, useState, useCallback } from 'react'
import staticData from '../data/staticData.js'

const AppContext = createContext(null)
export const useApp = () => useContext(AppContext)

// GitHub config for the "Update Now" button (triggers the refresh workflow).
const GH = {
  owner: 'DesignTCF',
  repo: 'tcf-command-center',
  workflow: 'refresh-and-deploy.yml',
  token: import.meta.env.VITE_GH_TOKEN || '',
}

export function AppProvider({ children }) {
  const [refreshState, setRefreshState] = useState('idle') // idle | working | done | error | unavailable

  const data = useMemo(() => ({
    tasks: staticData.tasks || [],
    calendar: staticData.calendar || [],
    inventory: staticData.inventory || { tabs: [] },
    generatedAt: staticData.generatedAt || null,
  }), [])

  // Kick the GitHub Actions workflow that re-fetches data and redeploys.
  const updateNow = useCallback(async () => {
    if (!GH.token) { setRefreshState('unavailable'); return }
    setRefreshState('working')
    try {
      const res = await fetch(
        `https://api.github.com/repos/${GH.owner}/${GH.repo}/actions/workflows/${GH.workflow}/dispatches`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${GH.token}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
          body: JSON.stringify({ ref: 'main' }),
        },
      )
      if (res.status === 204) setRefreshState('done')
      else setRefreshState('error')
    } catch {
      setRefreshState('error')
    }
  }, [])

  const value = useMemo(() => ({ ...data, refreshState, updateNow }), [data, refreshState, updateNow])
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
