import { request, requestFile } from './http.js'

export function fetchReportInvoices({ bookFairId, date, paymentType, paymentMethod, currency, signal } = {}) {
  const params = new URLSearchParams({ bookFairId: String(bookFairId) })
  if (date) params.set('date', date)
  if (paymentType) params.set('paymentType', paymentType)
  if (paymentMethod) params.set('paymentMethod', paymentMethod)
  if (currency) params.set('currency', currency)
  return request(`/reports/invoices?${params}`, { signal })
}

export function fetchDailyLibraryPayments({ bookFairId, date, signal } = {}) {
  const params = new URLSearchParams({ bookFairId: String(bookFairId), date })
  return request(`/reports/library-payments?${params}`, { signal })
}

export async function fetchReportRefundInvoices({ bookFairId, signal } = {}) {
  const size = 500
  const invoices = []
  let page = 0
  let last = false

  while (!last) {
    const params = new URLSearchParams({ bookFairId: String(bookFairId), page: String(page), size: String(size) })
    const response = await request(`/invoices/refund/all?${params}`, { signal })
    const data = response.data

    if (Array.isArray(data)) {
      invoices.push(...data)
      last = true
    } else {
      invoices.push(...(data?.content || []))
      last = data?.last !== false
      page += 1
    }
  }

  return invoices
}

export function exportReport({ bookFairId, reportType, date, currency, signal } = {}) {
  const params = new URLSearchParams({
    bookFairId: String(bookFairId),
    reportType,
  })
  if (date) params.set('date', date)
  if (currency) params.set('currency', currency)
  return requestFile(`/reports/export?${params}`, { signal })
}
