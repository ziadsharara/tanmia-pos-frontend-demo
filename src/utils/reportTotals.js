import { getInvoicePaidAmount, getInvoiceTotalAmount, getInvoiceRemainingAmount } from './invoicePayments.js'

export function mergeReportInvoices(sales, refunds, filters = {}) {
  const invoices = new Map(sales.map((invoice) => [invoice.id, invoice]))
  refunds.forEach((invoice) => {
    if (filters.paymentType && invoice.paymentType !== filters.paymentType) return
    if (filters.paymentMethod && invoice.paymentMethod !== filters.paymentMethod && !(filters.paymentMethod === 'CASH' && invoice.paymentMethod === 'COUPON' && (invoice.returnHistory || []).some(r => Number(r.cashAmount) > 0))) return
    if (filters.currency && invoice.currency !== filters.currency) return
    if (filters.date && invoice.businessDate !== filters.date && invoice.refundAt !== filters.date && !(invoice.returnHistory || []).some(r => r.date === filters.date)) return
    invoices.set(invoice.id, invoice)
  })
  return [...invoices.values()]
}

export function calculateReportTotals(invoices, payments = [], accountBalances = null, { daily = false, date = null, couponReceipts = [], paymentMethod = null } = {}) {
  const totalsByCurrency = new Map()
  const getTotals = (currency) => {
    if (!totalsByCurrency.has(currency)) totalsByCurrency.set(currency, {
      currency, sales: 0, collected: 0, cashCollected: 0, visaCollected: 0,
      couponPending: 0, remaining: 0, libraryInvoices: 0, libraryPayments: 0, gifts: 0, returnedValue: 0, returnedGifts: 0, libraryRefunds: 0, refunds: 0, netCollected: 0, libraryBreakdownIncomplete: false,
    })
    return totalsByCurrency.get(currency)
  }

  invoices.forEach((invoice) => {
    const totals = getTotals(invoice.currency || 'UNKNOWN')
    const value = getInvoiceTotalAmount(invoice)
    const collected = invoice.paymentMethod === 'COUPON' ? 0 : getInvoicePaidAmount(invoice)
    const history = invoice.returnHistory?.length ? invoice.returnHistory : invoice.paymentStatus === 'REFUND'
      ? [{ date: invoice.refundAt, value, cashAmount: invoice.paymentType === 'WHOLESALE_CREDIT' ? Number(invoice.libraryRefundAmount || 0) : collected }] : []
    const selectedReturns = daily && date ? history.filter(r => r.date === date) : history
    const returnedValue = selectedReturns.reduce((sum, r) => sum + Number(r.value || 0), 0)
    const refunded = selectedReturns.reduce((sum, r) => sum + Number(r.cashAmount || 0), 0)
    const saleOnDate = !daily || (date && invoice.businessDate ? invoice.businessDate === date : history.length === 0)
    if (saleOnDate && !invoice.deleted && !(paymentMethod === 'CASH' && invoice.paymentMethod === 'COUPON')) {
      const salesValue = daily ? value : Math.max(0, value - returnedValue)
      if (invoice.paymentType === 'GIFT') totals.gifts += salesValue
      else totals.sales += salesValue
      if (invoice.paymentMethod === 'COUPON') totals.couponPending += getInvoiceRemainingAmount(invoice, daily ? date : null)
      if (invoice.paymentType === 'WHOLESALE_CREDIT') {
        totals.libraryInvoices += value
        totals.remaining += value
      }
      totals.collected += collected
      totals.netCollected += collected
      if (invoice.paymentType === 'DIRECT' && invoice.paymentMethod === 'CASH') totals.cashCollected += collected
      if (invoice.paymentType === 'DIRECT' && invoice.paymentMethod === 'VISA') totals.visaCollected += collected
    }
    if (invoice.paymentType === 'GIFT') totals.returnedGifts += returnedValue
    else totals.returnedValue += returnedValue
    if (invoice.paymentType === 'WHOLESALE_CREDIT') {
      totals.libraryRefunds += refunded
      totals.remaining += refunded - (invoice.deleted ? 0 : returnedValue)
    }
    totals.refunds += refunded
    totals.netCollected -= refunded
  })

  ;(payments || []).forEach((payment) => {
    const amount = Number(payment.amount)
    if (!Number.isFinite(amount)) return
    const totals = getTotals(payment.currency || 'UNKNOWN')
    totals.libraryPayments += amount
    totals.remaining -= amount
    totals.collected += amount
    totals.netCollected += amount
    if (payment.paymentMethod === 'CASH') totals.cashCollected += amount
    if (payment.paymentMethod === 'VISA') totals.visaCollected += amount
  })

  couponReceipts.forEach(receipt => {
    const collection = receipt.collection || receipt
    const amount = Number(collection.amount)
    if (!Number.isFinite(amount)) return
    const totals = getTotals(receipt.currency || 'UNKNOWN')
    totals.collected += amount; totals.netCollected += amount
    if (collection.paymentMethod === 'CASH') totals.cashCollected += amount
    if (collection.paymentMethod === 'VISA') totals.visaCollected += amount
  })

  // A reviewed opening balance may differ from the legacy invoice/payment fields.
  if (accountBalances) accountBalances.forEach(({ currency, balance }) => {
    getTotals(currency).remaining = Number(balance)
  })
  return Array.from(totalsByCurrency.values(), (totals) => Object.fromEntries(Object.entries({ ...totals, invoiceValue: totals.sales + totals.gifts }).map(([key, value]) => [key, typeof value === 'number' ? Number(value.toFixed(2)) : value])))
}
