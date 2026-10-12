import { request } from './http.js'

export function fetchAllCountries({ signal } = {}) {
  return request('/settings/fetchAllCountries', { signal })
}

export function fetchCurrencies(country, { signal } = {}) {
  const params = new URLSearchParams({ country })
  return request(`/settings/fetchCurrencies?${params}`, { signal })
}

export function fetchAllBookFairs({ signal } = {}) {
  return request('/settings/fetchAllBookFairs', { signal })
}

export function createBookFair(bookFair) {
  return request('/settings/create', {
    method: 'POST',
    body: JSON.stringify(bookFair),
  })
}

export function deleteBookFair(bookFairId) {
  const params = new URLSearchParams({ bookFairId: String(bookFairId) })
  return request(`/settings/delete?${params}`, { method: 'DELETE' })
}
