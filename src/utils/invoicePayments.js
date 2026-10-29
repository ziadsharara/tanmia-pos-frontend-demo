function toAmount(value) {
  const amount = Number(value ?? 0)
  return Number.isFinite(amount) ? amount : 0
}

export function getInvoicePaidAmount(invoice) {
  if (invoice.paymentType === 'GIFT') return 0
  if (invoice.paymentMethod === 'COUPON') return (invoice.couponCollections || []).reduce((sum, c) => sum + toAmount(c.amount), 0)

  if (invoice.paymentType === 'WHOLESALE_CREDIT') return 0

  return invoice.amountDue != null
    ? toAmount(invoice.amountDue)
    : toAmount(invoice.totalAmountAfterDiscounts)
}

// Library debt belongs to the account, never to an individual invoice.
export function getInvoiceRemainingAmount(invoice, through = null) {
  if (invoice?.paymentMethod === 'COUPON') {
    const eligibleReturns = (invoice.returnHistory || []).filter(r => !through || r.date <= through)
    const returned = invoice.returnHistory?.length ? eligibleReturns.reduce((sum, r) => sum + Number(r.value || 0), 0) : invoice.paymentStatus === 'REFUND' && (!through || invoice.refundAt <= through) ? getInvoiceTotalAmount(invoice) : 0
    const collected = (invoice.couponCollections || []).filter(c => !through || c.paidAt <= through).reduce((sum, c) => sum + toAmount(c.amount), 0)
    return Math.max(0, Math.round((getInvoiceTotalAmount(invoice) - returned - collected + eligibleReturns.reduce((sum, r) => sum + toAmount(r.cashAmount), 0)) * 100) / 100)
  }
  return 0
}

export function getInvoiceTotalAmount(invoice) {
  return toAmount(invoice.totalAmountAfterDiscounts)
}
