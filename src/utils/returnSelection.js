// Use stored invoice prices only, allocating invoice discounts in cents exactly as the server does.
export function getReturnSelection(invoice, quantities = {}) {
  const items = invoice?.items || []
  const subtotal = items.reduce((sum, item) => sum + Number(item.totalAmountAfterDiscount), 0)
  const total = Number(invoice?.totalAmountAfterDiscounts)
  let prefix = 0
  let allocated = 0
  const lineValues = new Map()
  for (const item of [...items].sort((a, b) => a.id - b.id)) {
    prefix += Number(item.totalAmountAfterDiscount)
    const cumulative = subtotal === 0 ? 0 : Math.round(total * 100 * prefix / subtotal)
    lineValues.set(item.id, (cumulative - allocated) / 100)
    allocated = cumulative
  }
  return items.map(item => {
    const sold = Number(item.quantity)
    const returned = Number(item.returnedQuantity || 0)
    const selectedQuantity = Number(quantities[item.id] || 0)
    const fullValue = item.returnLineValue == null ? lineValues.get(item.id) : Number(item.returnLineValue)
    const value = (Math.round(fullValue * 100 * (returned + selectedQuantity) / sold) - Math.round(fullValue * 100 * returned / sold)) / 100
    return { ...item, available: sold - returned, selectedQuantity, returnValue: Number.isFinite(value) ? value : null }
  })
}

export function supportsItemReturns(invoice) {
  return Boolean(invoice?.items?.length) && invoice.items.every(item => Number.isInteger(item.returnedQuantity) && item.returnLineValue != null)
}

export function getReturnBreakdown(invoice) {
  const history = invoice.returnHistory || []
  const value = history.length ? history.reduce((sum, r) => sum + Number(r.value), 0) : Number(invoice.totalAmountAfterDiscounts || 0)
  const library = invoice.paymentType === 'WHOLESALE_CREDIT'
  const documented = history.length > 0 || !library || Number(invoice.libraryRefundAmount) > 0
  const cash = history.length ? history.reduce((sum, r) => sum + Number(r.cashAmount), 0)
    : library ? documented ? Number(invoice.libraryRefundAmount) : null
    : invoice.paymentType === 'GIFT' || invoice.paymentMethod === 'COUPON' ? 0 : Number(invoice.amountDue ?? invoice.totalAmountAfterDiscounts ?? 0)
  return { value: Number(value.toFixed(2)), cash: cash == null ? null : Number(cash.toFixed(2)),
    accountReduction: library && cash != null ? Number((value - cash).toFixed(2)) : null }
}
