import { postMultipart, request } from './http.js'

const SEARCH_CACHE_TTL = 15_000
const SEARCH_CACHE_LIMIT = 50
const searchCache = new Map()

export function invalidateBooksCache() {
  searchCache.clear()
}

export const previewBooksImport = (file, { signal } = {}) => postMultipart('/books/imports/preview', file, { signal })

export async function confirmBooksImport(rows, bookFairId) {
  const params = new URLSearchParams({ bookFairId: String(bookFairId) })
  const response = await request(`/books/imports/rows?${params}`, { method: 'POST', body: JSON.stringify(rows) })
  invalidateBooksCache()
  return response
}

export async function fetchBooks({ bookFairId, search = '', page = 0, size = 25, signal } = {}) {
  const params = new URLSearchParams({ bookFairId: String(bookFairId), search, page: String(page), size: String(size) })
  const cacheKey = params.toString()
  const cached = searchCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return cached.response

  const response = await request(`/books?${params}`, { signal })
  for (const [key, value] of searchCache) {
    if (value.expiresAt <= Date.now()) searchCache.delete(key)
  }
  if (searchCache.size >= SEARCH_CACHE_LIMIT) searchCache.delete(searchCache.keys().next().value)
  searchCache.set(cacheKey, { response, expiresAt: Date.now() + SEARCH_CACHE_TTL })
  return response
}

export function fetchBookById(bookId, bookFairId, { signal } = {}) {
  const params = new URLSearchParams({ bookFairId: String(bookFairId) })
  return request(`/books/${bookId}?${params}`, { signal })
}

export async function createBook(book, bookFairId) {
  const params = new URLSearchParams({ bookFairId: String(bookFairId) })
  const response = await request(`/books?${params}`, { method: 'POST', body: JSON.stringify(book) })
  invalidateBooksCache()
  return response
}

export async function updateBook(bookId, bookFairId, book) {
  const params = new URLSearchParams({ bookId: String(bookId), bookFairId: String(bookFairId) })
  const response = await request(`/books?${params}`, { method: 'PUT', body: JSON.stringify(book) })
  invalidateBooksCache()
  return response
}

export async function deleteBook(bookId, bookFairId) {
  const params = new URLSearchParams({ bookId: String(bookId), bookFairId: String(bookFairId) })
  const response = await request(`/books?${params}`, { method: 'DELETE' })
  invalidateBooksCache()
  return response
}

export async function deleteAllBooks(bookFairId) {
  const params = new URLSearchParams({ bookFairId: String(bookFairId) })
  const response = await request(`/books/all?${params}`, { method: 'DELETE' })
  invalidateBooksCache()
  return response
}
