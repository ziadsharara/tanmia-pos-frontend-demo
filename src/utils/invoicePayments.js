function toAmount(value) {
  const amount = Number(value ?? 0)
  return Number.isFinite(amount) ? amount : 0
}

export function getInvoicePaidAmount(invoice) {
  if (invoice.paymentType === 'GIFT') return 0

  if (invoice.paymentType === 'WHOLESALE_CREDIT') {
    if (invoice.libraryPartialPaymentAmount != null) return toAmount(invoice.libraryPartialPaymentAmount)
    return invoice.paymentStatus === 'PAID' ? toAmount(invoice.totalAmountAfterDiscounts) : 0
  }

  return invoice.amountDue != null
    ? toAmount(invoice.amountDue)
    : toAmount(invoice.totalAmountAfterDiscounts)
}

export function getInvoiceRemainingAmount(invoice) {
  if (invoice.paymentType !== 'WHOLESALE_CREDIT') return 0
  if (invoice.libraryRemainingPaymentAmount != null) return toAmount(invoice.libraryRemainingPaymentAmount)
  return invoice.paymentStatus === 'UNPAID' ? toAmount(invoice.totalAmountAfterDiscounts) : 0
}

export function getInvoiceTotalAmount(invoice) {
  return toAmount(invoice.totalAmountAfterDiscounts)
}
