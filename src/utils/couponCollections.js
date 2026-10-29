import { getInvoiceRemainingAmount } from './invoicePayments.js'

// A backdated receipt must fit both the historical and the current balance.
export function collectibleCouponAmount(invoice, date) {
  if (invoice.paymentMethod !== 'COUPON' || !date || invoice.businessDate > date) return 0
  return Math.min(getInvoiceRemainingAmount(invoice), getInvoiceRemainingAmount(invoice, date))
}

export function couponCollectionScope(invoices, currency, date, invoiceId = null) {
  return invoices.filter(invoice => invoice.currency === currency && (invoiceId == null || String(invoice.id) === String(invoiceId)))
    .map(invoice => ({ ...invoice, collectible: collectibleCouponAmount(invoice, date) }))
    .filter(invoice => invoice.collectible > 0).sort((a, b) => a.id - b.id)
}
