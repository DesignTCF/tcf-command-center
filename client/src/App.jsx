import React, { Suspense, lazy } from 'react'
import { Routes, Route } from 'react-router-dom'
import { AppProvider, useApp } from './store/AppContext'
import Nav from './components/Nav'
import AIChatPanel from './components/AIChatPanel'

const Dashboard   = lazy(() => import('./pages/Dashboard'))
const Projects    = lazy(() => import('./pages/Projects'))
const Products    = lazy(() => import('./pages/Products'))
const Creative    = lazy(() => import('./pages/Creative'))
const Operations  = lazy(() => import('./pages/Operations'))
const Files       = lazy(() => import('./pages/Files'))
const Intelligence = lazy(() => import('./pages/Intelligence'))
const Import      = lazy(() => import('./pages/Import'))
const CalendarPage = lazy(() => import('./pages/CalendarPage'))
const Alibaba     = lazy(() => import('./pages/Alibaba'))
const Links       = lazy(() => import('./pages/Links'))
const GitHub      = lazy(() => import('./pages/GitHub'))

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full text-ink-muted text-sm">
      Loading…
    </div>
  )
}

function AppInner() {
  const { reload } = useApp()
  return (
    <div className="h-full flex flex-col">
      <Nav onRefresh={reload} />
      <main className="flex-1 mt-[50px] overflow-hidden">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/"            element={<Dashboard />} />
            <Route path="/projects"    element={<Projects />} />
            <Route path="/products"    element={<Products />} />
            <Route path="/creative"    element={<Creative />} />
            <Route path="/operations"  element={<Operations />} />
            <Route path="/files"       element={<Files />} />
            <Route path="/intelligence" element={<Intelligence />} />
            <Route path="/import"      element={<Import />} />
            <Route path="/calendar"    element={<CalendarPage />} />
            <Route path="/alibaba"     element={<Alibaba />} />
            <Route path="/links"       element={<Links />} />
            <Route path="/github"      element={<GitHub />} />
          </Routes>
        </Suspense>
      </main>
      {/* Floating AI chat — appears on every page */}
      <AIChatPanel />
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
