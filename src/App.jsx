import { lazy, Suspense, useEffect, useState } from 'react'
import { fetchAllBookFairs } from './api/bookFairs.js'
import { AppShell } from './components/layout/AppShell.jsx'
import { ACTIVE_BOOK_FAIR_KEY, normalizeBookFair } from './data/bookFairs.js'

const loadBooksPage = () => import('./pages/BooksPage.jsx')
const loadInvoicesPage = () => import('./pages/InvoicesPage.jsx')
const loadLibrariesPage = () => import('./pages/LibrariesPage.jsx')
const loadReturnsPage = () => import('./pages/ReturnsPage.jsx')
const loadReportsPage = () => import('./pages/ReportsPage.jsx')
const loadNewInvoicePage = () => import('./pages/NewInvoicePage.jsx')
const loadExhibitionSettingsPage = () => import('./pages/ExhibitionSettingsPage.jsx')
const BooksPage = lazy(() => loadBooksPage().then((module) => ({ default: module.BooksPage })))
const InvoicesPage = lazy(() => loadInvoicesPage().then((module) => ({ default: module.InvoicesPage })))
const LibrariesPage = lazy(() => loadLibrariesPage().then((module) => ({ default: module.LibrariesPage })))
const ReturnsPage = lazy(() => loadReturnsPage().then((module) => ({ default: module.ReturnsPage })))
const ReportsPage = lazy(() => loadReportsPage().then((module) => ({ default: module.ReportsPage })))
const NewInvoicePage = lazy(() => loadNewInvoicePage().then((module) => ({ default: module.NewInvoicePage })))
const ExhibitionSettingsPage = lazy(() => loadExhibitionSettingsPage().then((module) => ({ default: module.ExhibitionSettingsPage })))

const reportPages = ['reports-dashboard', 'reports-daily', 'reports-cash', 'reports-visa', 'reports-libraries', 'reports-gifts', 'reports-coupons', 'reports-refunds', 'reports-local-currency', 'reports-dollar']

function pageFromHash() {
  const page = window.location.hash.replace('#', '').split('?')[0]
  return ['books', 'new-invoice', 'invoices', 'libraries', 'returns', 'settings', ...reportPages].includes(page) ? page : 'new-invoice'
}

export default function App() {
  const [page, setPage] = useState(pageFromHash)
  const [visitedPages, setVisitedPages] = useState(() => new Set([pageFromHash()]))
  const [bookFairs, setBookFairs] = useState([])
  const [activeBookFair, setActiveBookFair] = useState(null)
  const [bookFairsState, setBookFairsState] = useState({ status: 'loading', error: '' })
  const [dataVersion, setDataVersion] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    fetchAllBookFairs({ signal: controller.signal })
      .then((response) => {
        const fairs = (response.data || []).map(normalizeBookFair)
        const savedId = Number(localStorage.getItem(ACTIVE_BOOK_FAIR_KEY))
        setBookFairs(fairs)
        setActiveBookFair(fairs.find((fair) => fair.id === savedId) || null)
        setBookFairsState({ status: 'ready', error: '' })
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setBookFairsState({ status: 'error', error: error.message })
      })
    return () => controller.abort()
  }, [])

  const selectBookFair = (bookFair) => {
    const normalized = normalizeBookFair(bookFair)
    setActiveBookFair(normalized)
    if (normalized) localStorage.setItem(ACTIVE_BOOK_FAIR_KEY, String(normalized.id))
    else localStorage.removeItem(ACTIVE_BOOK_FAIR_KEY)
  }

  const addBookFair = (bookFair) => {
    const normalized = normalizeBookFair(bookFair)
    setBookFairs((current) => [...current, normalized])
    selectBookFair(normalized)
  }

  const removeBookFair = (bookFairId) => {
    setBookFairs((current) => current.filter((bookFair) => bookFair.id !== bookFairId))
    if (activeBookFair?.id === bookFairId) selectBookFair(null)
  }

  const refreshData = () => setDataVersion((current) => current + 1)

  const openPage = (nextPage) => {
    window.location.hash = nextPage
    setPage(nextPage)
    setVisitedPages((current) => {
      if (current.has(nextPage)) return current
      const next = new Set(current)
      next.add(nextPage)
      return next
    })
  }

  useEffect(() => {
    const handleHashChange = () => {
      const nextPage = pageFromHash()
      setPage(nextPage)
      setVisitedPages((current) => {
        if (current.has(nextPage)) return current
        const next = new Set(current)
        next.add(nextPage)
        return next
      })
    }
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  useEffect(() => {
    const preloadPages = () => {
      loadBooksPage()
      loadInvoicesPage()
      loadReturnsPage()
      loadLibrariesPage()
      loadReportsPage()
      loadNewInvoicePage()
      loadExhibitionSettingsPage()
    }
    if ('requestIdleCallback' in window) {
      const idleId = window.requestIdleCallback(preloadPages, { timeout: 1200 })
      return () => window.cancelIdleCallback(idleId)
    }
    const timeoutId = window.setTimeout(preloadPages, 500)
    return () => window.clearTimeout(timeoutId)
  }, [])

  const reportsVisited = reportPages.some((reportPage) => visitedPages.has(reportPage))
  const reportsActive = reportPages.includes(page)

  return (
    <AppShell activePage={page} exhibitionName={activeBookFair?.name} localCurrency={activeBookFair?.localCurrency} onNavigate={openPage}>
      {visitedPages.has('new-invoice') && <div className="route-view" hidden={page !== 'new-invoice'}><Suspense fallback={<RouteLoading />}><NewInvoicePage isActive={page === 'new-invoice'} localCurrency={activeBookFair?.localCurrency} exhibitionName={activeBookFair?.name} activeBookFair={activeBookFair} onDataChanged={refreshData} /></Suspense></div>}
      {visitedPages.has('invoices') && <div className="route-view" hidden={page !== 'invoices'}><Suspense fallback={<RouteLoading />}><InvoicesPage isActive={page === 'invoices'} localCurrency={activeBookFair?.localCurrency} exhibitionName={activeBookFair?.name} activeBookFair={activeBookFair} dataVersion={dataVersion} onDataChanged={refreshData} /></Suspense></div>}
      {visitedPages.has('libraries') && <div className="route-view" hidden={page !== 'libraries'}><Suspense fallback={<RouteLoading />}><LibrariesPage key={activeBookFair?.id || 'none'} isActive={page === 'libraries'} activeBookFair={activeBookFair} localCurrency={activeBookFair?.localCurrency} dataVersion={dataVersion} onDataChanged={refreshData} /></Suspense></div>}
      {visitedPages.has('returns') && <div className="route-view" hidden={page !== 'returns'}><Suspense fallback={<RouteLoading />}><ReturnsPage isActive={page === 'returns'} localCurrency={activeBookFair?.localCurrency} activeBookFair={activeBookFair} dataVersion={dataVersion} onDataChanged={refreshData} /></Suspense></div>}
      {reportsVisited && <div className="route-view" hidden={!reportsActive}><Suspense fallback={<RouteLoading />}><ReportsPage reportPage={reportsActive ? page : null} localCurrency={activeBookFair?.localCurrency} activeBookFair={activeBookFair} dataVersion={dataVersion} onDataChanged={refreshData} /></Suspense></div>}
      {visitedPages.has('books') && <div className="route-view" hidden={page !== 'books'}><Suspense fallback={<RouteLoading />}><BooksPage isActive={page === 'books'} localCurrency={activeBookFair?.localCurrency} activeBookFair={activeBookFair} dataVersion={dataVersion} onDataChanged={refreshData} /></Suspense></div>}
      {visitedPages.has('settings') && <div className="route-view" hidden={page !== 'settings'}><Suspense fallback={<RouteLoading />}><ExhibitionSettingsPage isActive={page === 'settings'} bookFairs={bookFairs} activeBookFair={activeBookFair} bookFairsState={bookFairsState} onSelectBookFair={selectBookFair} onBookFairCreated={addBookFair} onBookFairDeleted={removeBookFair} /></Suspense></div>}
    </AppShell>
  )
}

function RouteLoading() {
  return <div className="route-loading"><span className="spinner spinner--large" /><strong>جاري فتح الصفحة...</strong></div>
}
