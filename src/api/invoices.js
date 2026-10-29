import { request } from './http.js'
import { invalidateBooksCache } from './books.js'

export async function createInvoice(invoice, bookFairId) {
  const params = new URLSearchParams({ bookFairId: String(bookFairId) })
  const response = await request(`/invoices/create?${params}`, { method: 'POST', body: JSON.stringify(invoice) })
  invalidateBooksCache()
  return response
}

export async function updateInvoice(invoiceId, bookFairId, invoice) {
  const params = new URLSearchParams({ bookFairId: String(bookFairId) })
  const response = await request(`/invoices/${invoiceId}/edit?${params}`, { method: 'PUT', body: JSON.stringify(invoice) })
  invalidateBooksCache()
  return response
}

export function fetchLibraries({ bookFairId, signal } = {}) {
  const params = new URLSearchParams({ bookFairId: String(bookFairId) })
  return request(`/libraries/fetchAll?${params}`, { signal })
}

export function fetchInvoices({ bookFairId, page = 0, size = 25, search = '', signal } = {}) {
  const params = new URLSearchParams({ bookFairId: String(bookFairId), page: String(page), size: String(size) })
  if (search.trim()) params.set('search', search.trim())
  return request(`/invoices/fetchAll?${params}`, { signal })
}

export async function deleteAllInvoices(bookFairId) {
  const params = new URLSearchParams({ bookFairId: String(bookFairId) })
  const response = await request(`/invoices/all?${params}`, { method: 'DELETE' })
  invalidateBooksCache()
  return response
}

export async function deleteInvoice(invoiceId, bookFairId) {
  const params = new URLSearchParams({ bookFairId: String(bookFairId) })
  const response = await request(`/invoices/${invoiceId}?${params}`, { method: 'DELETE' })
  invalidateBooksCache()
  return response
}

export function fetchInvoiceById(invoiceId, bookFairId, { signal } = {}) {
  const params = new URLSearchParams({ bookFairId: String(bookFairId) })
  return request(`/invoices/${invoiceId}?${params}`, { signal })
}

export async function refundInvoice(invoiceNumber, bookFairId, returnRequest) {
  const params = new URLSearchParams({ invoiceNumber, bookFairId: String(bookFairId) })
  const response = await request(`/invoices/refund?${params}`, { method: 'POST', body: JSON.stringify(returnRequest) })
  invalidateBooksCache()
  return response
}

export function fetchRefundInvoices({ bookFairId, page = 0, size = 25, paymentType, signal } = {}) {
  const params = new URLSearchParams({ bookFairId: String(bookFairId), page: String(page), size: String(size) })
  if (paymentType) params.set('paymentType', paymentType)
  return request(`/invoices/refund/all?${params}`, { signal })
}

export function fetchInvoiceForRefund(invoiceNumber, bookFairId, { signal } = {}) {
  const params = new URLSearchParams({ bookFairId: String(bookFairId) })
  return request(`/invoices/refund/${encodeURIComponent(invoiceNumber)}?${params}`, { signal })
}

export async function editInvoiceReturn(invoiceId, returnId, bookFairId, requestBody) {
  const params = new URLSearchParams({ bookFairId: String(bookFairId) })
  const response = await request(`/invoices/${invoiceId}/returns/${encodeURIComponent(returnId)}?${params}`, { method: 'PUT', body: JSON.stringify(requestBody) })
  invalidateBooksCache()
  return response
}

export function fetchCouponInvoices(bookFairId, { signal } = {}) {
  return request(`/invoices/coupons?bookFairId=${bookFairId}`, { signal })
}
export function fetchCouponReceipts({ bookFairId, date, signal } = {}) {
  const params = new URLSearchParams({ bookFairId: String(bookFairId) })
  if (date) params.set('date', date)
  return request(`/invoices/coupon-collections?${params}`, { signal })
}
export function collectFairCoupons(bookFairId, currency, data) {
  const params = new URLSearchParams({ bookFairId: String(bookFairId), currency })
  return request(`/invoices/coupon-collections?${params}`, { method: 'POST', body: JSON.stringify(data) })
}

export function collectInvoiceCoupon(invoiceId, bookFairId, data) {
  const params = new URLSearchParams({ bookFairId: String(bookFairId) })
  return request(`/invoices/${encodeURIComponent(invoiceId)}/coupon-collections?${params}`, { method: 'POST', body: JSON.stringify(data) })
}
