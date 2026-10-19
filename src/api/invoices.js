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
  return request(`/invoices/fetchLibraries?${params}`, { signal })
}

export function fetchInvoices({ bookFairId, page = 0, size = 25, signal } = {}) {
  const params = new URLSearchParams({ bookFairId: String(bookFairId), page: String(page), size: String(size) })
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

export function recordLibraryPayment(invoiceNumber, bookFairId, payment) {
  const params = new URLSearchParams({ bookFairId: String(bookFairId) })
  return request(`/invoices/${encodeURIComponent(invoiceNumber)}/payments?${params}`, {
    method: 'POST',
    body: JSON.stringify({ amount: payment.amount, paymentMethod: payment.paymentMethod, paidAt: payment.paymentDate }),
  })
}

export async function refundInvoice(invoiceNumber, bookFairId) {
  const params = new URLSearchParams({ invoiceNumber, bookFairId: String(bookFairId) })
  const response = await request(`/invoices/refund?${params}`, { method: 'POST' })
  invalidateBooksCache()
  return response
}

export function fetchRefundInvoices({ bookFairId, page = 0, size = 25, signal } = {}) {
  const params = new URLSearchParams({ bookFairId: String(bookFairId), page: String(page), size: String(size) })
  return request(`/invoices/refund/all?${params}`, { signal })
}

export function fetchInvoiceForRefund(invoiceNumber, bookFairId, { signal } = {}) {
  const params = new URLSearchParams({ bookFairId: String(bookFairId) })
  return request(`/invoices/refund/${encodeURIComponent(invoiceNumber)}?${params}`, { signal })
}
