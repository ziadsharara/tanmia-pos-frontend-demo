import { request, requestFile } from './http.js'

export function exportDailyLibraryRecords({ libraryId, bookFairId, currency, date, from, to, exportType = 'statement', signal } = {}) {
  const params = new URLSearchParams({ bookFairId: String(bookFairId), currency, exportType })
  if (date) params.set('date', date)
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  return requestFile(`/libraries/${libraryId}/export?${params}`, { signal })
}

export function fetchLibraries({ bookFairId, signal } = {}) {
  const params = new URLSearchParams({ bookFairId: String(bookFairId) })
  return request(`/libraries/fetchAll?${params}`, { signal })
}

export function fetchLibraryBalances({ bookFairId, signal } = {}) {
  const params = new URLSearchParams({ bookFairId: String(bookFairId) })
  return request(`/libraries/balances?${params}`, { signal })
}

export function fetchLibraryStatement({ libraryId, bookFairId, currency, from, to, page = 0, size = 25, signal } = {}) {
  const params = new URLSearchParams({ bookFairId: String(bookFairId), currency, page: String(page), size: String(size) })
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  return request(`/libraries/${libraryId}/statement?${params}`, { signal })
}

export function recordLibraryPayment(libraryId, bookFairId, payment) {
  const params = new URLSearchParams({ bookFairId: String(bookFairId) })
  return request(`/libraries/${libraryId}/payments?${params}`, { method: 'POST', body: JSON.stringify(payment) })
}

export function fetchLibraryInvoices({ libraryId, bookFairId, currency, date, from, to, page = 0, size = 10, signal } = {}) {
  const params = new URLSearchParams({ bookFairId: String(bookFairId), currency, page: String(page), size: String(size) })
  if (date) params.set('date', date)
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  return request(`/libraries/${libraryId}/invoices?${params}`, { signal })
}

export function fetchLibraryPayments({ libraryId, bookFairId, currency, date, from, to, page = 0, size = 10, signal } = {}) {
  const params = new URLSearchParams({ bookFairId: String(bookFairId), currency, page: String(page), size: String(size) })
  if (date) params.set('date', date)
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  return request(`/libraries/${libraryId}/payments?${params}`, { signal })
}

export function fetchHistoricalAdjustments({ libraryId, bookFairId, currency, page = 0, size = 5, signal } = {}) {
  const params = new URLSearchParams({ bookFairId: String(bookFairId), currency, page: String(page), size: String(size) })
  return request(`/libraries/${libraryId}/historical-adjustments?${params}`, { signal })
}
