function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function prepareInvoiceDetails(invoice) {
  const subtotalAfterBookDiscounts = roundMoney(
    Number(invoice.totalAmountBeforeDiscount || 0) - Number(invoice.booksDiscountAmount || 0),
  )
  const invoicePercentageDiscountAmount = roundMoney(Math.max(
    0,
    subtotalAfterBookDiscounts
      - Number(invoice.invoiceFixedDiscountAmount || 0)
      - Number(invoice.totalAmountAfterDiscounts || 0),
  ))

  return { ...invoice, subtotalAfterBookDiscounts, invoicePercentageDiscountAmount }
}
