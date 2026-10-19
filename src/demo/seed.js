import catalog from './catalog.js'

const fairs = [
  { id: 2, name: 'معرض ليبيا', country: 'LIBYA', primaryCurrency: 'LYD', secondCurrency: 'USD', bookOffset: 0 },
  { id: 4, name: 'معرض الجزائر', country: 'ALGERIA', primaryCurrency: 'DZD', secondCurrency: 'USD', bookOffset: 643 },
  { id: 5, name: 'معرض الشارقه', country: 'UAE', primaryCurrency: 'AED', secondCurrency: 'USD', bookOffset: 1286 },
]
const libraryNames = {
  2: ['مكتبة طرابلس', 'مكتبة بنغازي'],
  4: ['مكتبة الجزائر', 'مكتبة وهران'],
  5: ['مكتبة الشارقة', 'مكتبة المعرفة'],
}

function daysAgo(days) {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function makeInvoice(id, fair, selection, number) {
  const kind = number % 7
  const paymentType = kind === 2 || kind === 5 ? 'WHOLESALE_CREDIT' : kind === 4 ? 'GIFT' : 'DIRECT'
  const currency = kind === 6 ? 'USD' : fair.primaryCurrency
  const paymentMethod = paymentType === 'GIFT' || kind === 5 ? null : kind % 2 ? 'VISA' : 'CASH'
  const businessDate = daysAgo(number % 16)
  const items = selection.map((book, index) => {
    const quantity = index + 1
    const unitPrice = currency === 'USD' ? book.priceInUSD : book.price
    return { id: id * 10 + index, bookId: book.id, bookCode: book.code, bookName: book.name,
      bookAuthor: book.author, quantity, unitPrice, discountPercentage: 0,
      fixedDiscountAmount: 0, totalAmountAfterDiscount: unitPrice * quantity }
  })
  const total = items.reduce((sum, item) => sum + item.totalAmountAfterDiscount, 0)
  const paid = paymentType === 'WHOLESALE_CREDIT' ? kind === 5 ? 0 : Math.round(total * 0.35 * 100) / 100
    : paymentType === 'GIFT' ? 0 : total
  const refunded = kind === 3 && number > 10
  const libraryIndex = number % 2
  const libraryId = fair.id === 2 ? libraryIndex + 1 : fair.id === 4 ? libraryIndex + 3 : libraryIndex + 5
  const libraryName = paymentType === 'WHOLESALE_CREDIT' ? libraryNames[fair.id][libraryIndex] : null
  return {
    id, bookFairId: fair.id,
    invoiceNumber: `4b5c${String(id).padStart(4, '0')}-8e7d-4c3b-9f10-${String(100000000000 + id)}`,
    businessDate, currency, paymentType, paymentMethod,
    paymentStatus: refunded ? 'REFUND' : paymentType === 'GIFT' ? 'NO_PAYMENT_REQUIRED'
      : paymentType === 'DIRECT' ? 'PAID' : paid ? 'PARTIALLY_PAID' : 'UNPAID',
    libraryId: libraryName ? libraryId : null, libraryName,
    libraryPartialPaymentAmount: paymentType === 'WHOLESALE_CREDIT' ? paid : null,
    libraryRemainingPaymentAmount: paymentType === 'WHOLESALE_CREDIT' ? total - paid : null,
    totalAmountBeforeDiscount: total, booksDiscountAmount: 0, invoiceDiscountPercentage: 0,
    invoiceFixedDiscountAmount: 0, totalAmountAfterDiscounts: total,
    amountDue: paymentType === 'GIFT' ? 0 : total,
    libraryPayments: paymentType === 'WHOLESALE_CREDIT' && paid > 0
      ? [{ id: id * 10, amount: paid, paymentMethod, paidAt: businessDate }] : [],
    items, refundAt: refunded ? daysAgo(number % 5) : null,
  }
}

export function createSeedData() {
  const books = fairs.flatMap((fair) => catalog.map((entry) => ({
    ...entry, id: entry.id + fair.bookOffset, bookFairId: fair.id,
  })))
  const invoices = []
  for (const fair of fairs) {
    const choices = books.filter((book) => book.bookFairId === fair.id && book.quantity >= 8).slice(100)
    for (let number = 0; number < 30; number += 1) {
      const selection = [choices[number * 2], choices[number * 2 + 1]]
      const invoice = makeInvoice(invoices.length + 1, fair, selection, number)
      if (number === 5) {
        const delayedPayment = Math.round(invoice.totalAmountAfterDiscounts * 0.4 * 100) / 100
        invoice.libraryPayments.push({ id: invoice.id * 10 + 1, amount: delayedPayment,
          paymentMethod: 'CASH', paidAt: daysAgo(2) })
        invoice.libraryPartialPaymentAmount = delayedPayment
        invoice.libraryRemainingPaymentAmount = Math.round((invoice.totalAmountAfterDiscounts - delayedPayment) * 100) / 100
        invoice.paymentMethod = 'CASH'
        invoice.paymentStatus = 'PARTIALLY_PAID'
      }
      invoices.push(invoice)
    }
  }
  const stock = books.map((book) => ({ ...book }))
  const stockById = new Map(stock.map((book) => [book.id, book]))
  invoices.filter((invoice) => invoice.paymentStatus !== 'REFUND').forEach((invoice) => {
    invoice.items.forEach((item) => { stockById.get(item.bookId).quantity -= item.quantity })
  })
  return {
    version: 5,
    nextBookId: Math.max(...stock.map((book) => book.id)) + 1,
    nextInvoiceId: invoices.length + 1, nextFairId: 6, nextLibraryId: 7, nextPaymentId: 1000,
    fairs: fairs.map(({ bookOffset, ...fair }) => fair),
    books: stock, invoices,
    libraries: fairs.flatMap((fair, fairIndex) => libraryNames[fair.id].map((name, index) => ({
      id: fairIndex * 2 + index + 1, bookFairId: fair.id, name,
    }))),
  }
}
