import React, { Suspense, lazy } from 'react'
import { Routes, Route } from 'react-router-dom'
import { AppProvider, useApp } from './store/AppContext'
import NavV3 from './components/NavV3'
import AIChatPanel from './components/AIChatPanel'

// V3 pages
const HomeV3    = lazy(() => import('./pages/HomeV3'))
const BrandsV3  = lazy(() => import('./pages/BrandsV3'))
const WorkV3    = lazy(() => import('./pages/WorkV3'))
const CalendarPage = lazy(() => import('./pages/CalendarPage'))
const AskV3        = lazy(() => import('./pages/AskV3'))

// Legacy pages
const Files        = lazy(() => import('./pages/Files'))
const Intelligence = lazy(() => import('./pages/Intelligence'))
const Links        = lazy(() => import('./pages/Links'))
const Alibaba      = lazy(() => import('./pages/Alibaba'))
const ContentV3    = lazy(() => import('./pages/ContentV3'))

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full text-ink-muted text-sm gap-2">
      <span className="text-teal animate-pulse">↻</span> Loading…
    </div>
  )
}

function AppInner() {
  const { reload } = useApp()
  return (
    <div className="h-full flex flex-col bg-bg">
      <NavV3 onRefresh={reload} />
      <main className="flex-1 mt-[52px] overflow-hidden">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* V3 main routes */}
            <Route path="/"         element={<HomeV3 />} />
            <Route path="/brands"   element={<BrandsV3 />} />
            <Route path="/work"     element={<WorkV3 />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/ask"      element={<AskV3 />} />
            {/* Legacy */}
            <Route path="/content"  element={<ContentV3 />} />
            <Route path="/files"    element={<Files />} />
            <Route path="/intelligence" element={<Intelligence />} />
            <Route path="/links"    element={<Links />} />
            <Route path="/alibaba"  element={<Alibaba />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <AppInner />
    </AppProvider>
  )
}
