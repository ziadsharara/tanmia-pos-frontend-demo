import { getInvoicePaidAmount, getInvoiceRemainingAmount, getInvoiceTotalAmount } from './invoicePayments.js'

export function calculateReportTotals(invoices) {
  const totalsByCurrency = new Map()

  invoices.forEach((invoice) => {
    const currency = invoice.currency || 'UNKNOWN'
    const totals = totalsByCurrency.get(currency) || {
      currency,
      sales: 0,
      collected: 0,
      cashCollected: 0,
      visaCollected: 0,
      remaining: 0,
      gifts: 0,
      refunds: 0,
      netCollected: 0,
      libraryBreakdownIncomplete: false,
    }
    const invoiceValue = getInvoiceTotalAmount(invoice)
    const collectedAmount = getInvoicePaidAmount(invoice)
    const cashCollectedAmount = Number(invoice.cashCollectedAmount ?? 0)
    const visaCollectedAmount = Number(invoice.visaCollectedAmount ?? 0)

    if (invoice.paymentType === 'WHOLESALE_CREDIT'
      && invoice.libraryPartialPaymentAmount == null
      && invoice.libraryRemainingPaymentAmount == null
      && (invoice.paymentStatus === 'PARTIALLY_PAID' || invoice.paymentStatus === 'REFUND')) {
      totals.libraryBreakdownIncomplete = true
    }

    if (invoice.paymentStatus === 'REFUND') {
      totals.refunds += collectedAmount
      totals.netCollected -= collectedAmount
    } else if (invoice.paymentType === 'GIFT') {
      totals.gifts += invoiceValue
    } else {
      totals.sales += invoiceValue
      totals.collected += collectedAmount
      totals.netCollected += collectedAmount

      if (invoice.paymentType === 'WHOLESALE_CREDIT') {
        totals.cashCollected += Number.isFinite(cashCollectedAmount) ? cashCollectedAmount : 0
        totals.visaCollected += Number.isFinite(visaCollectedAmount) ? visaCollectedAmount : 0
      } else if (invoice.paymentType === 'DIRECT' && invoice.paymentMethod === 'CASH') {
        totals.cashCollected += collectedAmount
      } else if (invoice.paymentType === 'DIRECT' && invoice.paymentMethod === 'VISA') {
        totals.visaCollected += collectedAmount
      }

      if (invoice.paymentType === 'WHOLESALE_CREDIT') {
        totals.remaining += getInvoiceRemainingAmount(invoice)
      }
    }

    totalsByCurrency.set(currency, totals)
  })

  return Array.from(totalsByCurrency.values())
}
