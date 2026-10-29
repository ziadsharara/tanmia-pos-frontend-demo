import { DemoError } from './errors.js'
import { upgradeState, invoiceSummary, postEntry, accountSummary, statement, periodRows, addPayment, couponReceipts, collectCoupons, returnItems } from './accounts.js'
import { businessToday } from '../utils/libraryAccounts.js'
import { createSeedData } from './seed.js'
import { rebuildImportPreview } from '../utils/importPreview.js'

const STORAGE_KEY = 'tanmia.pos.demo.data.v1'
const currencies = {
  EGYPT: ['EGP', 'جنيه مصري', 'ج.م'], LIBYA: ['LYD', 'دينار ليبي', 'د.ل'],
  ALGERIA: ['DZD', 'دينار جزائري', 'د.ج'], UAE: ['AED', 'درهم إماراتي', 'د.إ'],
  KUWAIT: ['KWD', 'دينار كويتي', 'د.ك'], IRAQ: ['IQD', 'دينار عراقي', 'د.ع'],
  SA: ['SAR', 'ريال سعودي', 'ر.س'], OMAN: ['OMR', 'ريال عُماني', 'ر.ع'],
  TUNISIA: ['TND', 'دينار تونسي', 'د.ت'], MOROCCO: ['MAD', 'درهم مغربي', 'د.م'],
  QATAR: ['QAR', 'ريال قطري', 'ر.ق'],
}

export { DemoError } from './errors.js'
export function resetDemoData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(upgradeState(createSeedData())))
  localStorage.removeItem('tanmia.activeBookFairId.v1')
}

function read() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
    if ([5, 6].includes(saved?.version) && Array.isArray(saved.fairs) && Array.isArray(saved.books) && Array.isArray(saved.invoices)) {
      const previousVersion = saved.version
      const upgraded = upgradeState(saved)
      if (previousVersion !== 6) localStorage.setItem(STORAGE_KEY, JSON.stringify(upgraded))
      return upgraded
    }
  } catch { /* Start with the seed if storage has been cleared or corrupted. */ }
  const seed = upgradeState(createSeedData())
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seed))
  return seed
}

function change(fn) {
  const state = structuredClone(read())
  const result = fn(state)
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) }
  catch { throw new DemoError('مساحة تخزين المتصفح ممتلئة. احذف بعض بيانات التجربة وحاول تاني.', 507) }
  return result
}

const ok = (data, message = 'تم بنجاح') => ({ status: true, data, message })
const fail = (message, status = 400, data = null) => { throw new DemoError(message, status, data) }
const number = (value) => Number(value)
const today = businessToday
const round = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100

function fair(state, id) {
  const found = state.fairs.find((entry) => entry.id === number(id))
  if (!found) fail('اختر معرض صحيح أولاً', 404)
  return found
}

function paged(items, page, size) {
  const index = Math.max(0, number(page) || 0)
  const limit = Math.max(1, number(size) || 25)
  const totalPages = Math.max(1, Math.ceil(items.length / limit))
  return { content: items.slice(index * limit, (index + 1) * limit), page: index, number: index,
    size: limit, totalElements: items.length, totalPages, hasNext: index + 1 < totalPages,
    last: index + 1 >= totalPages, first: index === 0 }
}

const summary = invoiceSummary
function dailyPayments(state, fairId, date) {
  return state.payments.filter(p => p.bookFairId === Number(fairId) && (!date || p.paidAt === date))
    .map(p => ({ ...p, libraryName: state.libraries.find(l => l.id === p.libraryId)?.name || '', books: [] }))
}

function findInvoice(state, id, fairId) {
  const invoice = state.invoices.find((entry) => entry.bookFairId === number(fairId) && (String(entry.id) === String(id) || entry.invoiceNumber === id))
  if (!invoice) fail('الفاتورة غير موجودة', 404)
  return invoice
}

function restoreStock(state, invoice) {
  if (invoice.paymentStatus === 'REFUND') return
  invoice.items.forEach((item) => {
    const book = state.books.find((entry) => entry.id === item.bookId && entry.bookFairId === invoice.bookFairId)
    if (book) book.quantity += item.quantity - (item.returnedQuantity || 0)
  })
}

function validateBook(state, book, fairId, exceptId) {
  const code = String(book.code || '').trim()
  if (!code || !String(book.name || '').trim() || !String(book.author || '').trim()) fail('الكود واسم الكتاب والمؤلف مطلوبون')
  if (!Number.isInteger(Number(book.quantity)) || Number(book.quantity) < 0 || ![book.price, book.priceInUSD].every((value) => value !== '' && Number.isFinite(Number(value)) && Number(value) >= 0)) fail('راجع الكمية والأسعار')
  if (state.books.some((entry) => entry.bookFairId === number(fairId) && entry.code === code && entry.id !== exceptId)) fail('كود الكتاب موجود بالفعل', 409)
  return { code, name: String(book.name).trim(), author: String(book.author).trim(), quantity: Number(book.quantity), price: Number(book.price), priceInUSD: Number(book.priceInUSD) }
}

function createInvoice(state, payload, fairId) {
  fair(state, fairId)
  if (!Array.isArray(payload.items) || !payload.items.length) fail('ضيف كتاب واحد على الأقل للفاتورة')
  const items = payload.items.map((item) => {
    const book = state.books.find((entry) => entry.id === number(item.bookId) && entry.bookFairId === number(fairId))
    if (!book) fail('كتاب غير موجود في المعرض', 400)
    const quantity = Number(item.quantity)
    if (!Number.isInteger(quantity) || quantity <= 0 || quantity > book.quantity) fail(`الكمية المتاحة من ${book.name}: ${book.quantity}`, 409)
    const unitPrice = payload.currency === 'USD' ? book.priceInUSD : book.price
    const percentage = Number(item.discountPercentage || 0)
    const fixed = Number(item.fixedDiscountAmount || 0)
    if (percentage < 0 || percentage > 100 || fixed < 0) fail('خصم الكتاب غير صحيح')
    const discounted = round(round(unitPrice * quantity * (1 - percentage / 100)) - fixed)
    if (discounted < 0) fail('خصم الكتاب أكبر من السعر')
    return { id: state.nextInvoiceId * 100 + book.id, bookId: book.id, bookCode: book.code,
      bookName: book.name, bookAuthor: book.author, quantity, unitPrice,
      discountPercentage: percentage, fixedDiscountAmount: fixed, totalAmountAfterDiscount: discounted }
  })
  const before = round(items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0))
  const afterBooks = round(items.reduce((sum, item) => sum + item.totalAmountAfterDiscount, 0))
  const percent = Number(payload.billDiscountPercentage || 0)
  const fixed = Number(payload.billFixedDiscountAmount || 0)
  if (percent < 0 || percent > 100 || fixed < 0) fail('خصم الفاتورة غير صحيح')
  const total = round(round(afterBooks * (1 - percent / 100)) - fixed)
  if (total < 0) fail('خصم الفاتورة أكبر من السعر')
  const type = payload.paymentType
  if (!['DIRECT', 'WHOLESALE_CREDIT', 'GIFT'].includes(type)) fail('نوع البيع غير صحيح')
  if (type === 'DIRECT' && !['CASH', 'VISA', 'COUPON'].includes(payload.paymentMethod)) fail('اختر طريقة الدفع')
  if (type === 'WHOLESALE_CREDIT' && !String(payload.libraryName || '').trim()) fail('اسم المكتبة مطلوب')
  const paid = type === 'DIRECT' && payload.paymentMethod !== 'COUPON' ? total : 0
  if (!Number.isFinite(paid) || paid < 0 || paid > total) fail('المبلغ المدفوع غير صحيح')
  if (type === 'WHOLESALE_CREDIT' && paid > 0 && !['CASH', 'VISA', 'COUPON'].includes(payload.paymentMethod)) fail('اختر طريقة دفع المكتبة')
  const invoice = {
    id: state.nextInvoiceId++, bookFairId: number(fairId), invoiceNumber: crypto.randomUUID(), businessDate: today(),
    currency: payload.currency, paymentType: type, paymentMethod: type === 'DIRECT' ? payload.paymentMethod : null,
    paymentStatus: type === 'GIFT' ? 'NO_PAYMENT_REQUIRED' : type === 'WHOLESALE_CREDIT' ? 'ON_ACCOUNT' : payload.paymentMethod === 'COUPON' ? 'UNPAID' : 'PAID',
    libraryName: type === 'WHOLESALE_CREDIT' ? String(payload.libraryName).trim() : null,
    libraryId: null, libraryPartialPaymentAmount: type === 'WHOLESALE_CREDIT' ? paid : null,
    libraryRemainingPaymentAmount: type === 'WHOLESALE_CREDIT' ? round(total - paid) : null,
    totalAmountBeforeDiscount: before, booksDiscountAmount: round(before - afterBooks),
    invoiceDiscountPercentage: percent, invoiceFixedDiscountAmount: fixed,
    totalAmountAfterDiscounts: total, amountDue: type === 'GIFT' ? 0 : total,
    libraryPayments: [], couponCollections: [], notes: payload.notes?.trim() || null, deleted: false, items: items.map(i => ({ ...i, returnedQuantity: 0 })), refundAt: null,
  }
  if (type === 'WHOLESALE_CREDIT') {
    let library = state.libraries.find((entry) => entry.bookFairId === number(fairId) && entry.name === invoice.libraryName)
    if (!library) { library = { id: state.nextLibraryId++, bookFairId: number(fairId), name: invoice.libraryName, accountReady: true, accountOpenedAt: today() }; state.libraries.push(library) }
    invoice.libraryId = library.id
    if (paid) invoice.libraryPayments.push({ id: state.nextPaymentId++, amount: paid, paymentMethod: payload.paymentMethod, paidAt: today() })
  }
  items.forEach((item) => { state.books.find((entry) => entry.id === item.bookId && entry.bookFairId === Number(fairId)).quantity -= item.quantity })
  state.invoices.push(invoice)
  if (type === 'WHOLESALE_CREDIT') postEntry(state, invoice, 'INVOICE', total, 0, invoice.businessDate, `invoice:${invoice.id}`)
  return invoice
}

function updateInvoice(state, invoiceId, fairId, payload) {
  const invoice = findInvoice(state, invoiceId, fairId)
  if (invoice.paymentStatus === 'REFUND' || invoice.refundAt || invoice.deleted || invoice.couponCollections?.length) fail('لا يمكن تعديل فاتورة لها مرتجعات أو تحصيلات', 409)
  const previousLibrary = invoice.libraryId
  const previousTotal = invoice.totalAmountAfterDiscounts
  if (previousLibrary && (payload.paymentType !== 'WHOLESALE_CREDIT' || payload.currency !== invoice.currency || String(payload.libraryName).trim() !== invoice.libraryName)) fail('لا يمكن تغيير حساب فاتورة مكتبة مسجلة', 409)
  if (!payload || !payload.businessDate || !payload.currency || !['DIRECT', 'WHOLESALE_CREDIT', 'GIFT'].includes(payload.paymentType)
    || !Array.isArray(payload.items) || !payload.items.length) fail('Invalid invoice details')
  const previous = new Map(invoice.items.map((item) => [item.bookId, item]))
  const seen = new Set()
  const items = payload.items.map((item, index) => {
    const bookId = number(item.bookId)
    const quantity = number(item.quantity)
    const book = state.books.find((entry) => entry.id === bookId && entry.bookFairId === number(fairId))
    if (!book || seen.has(bookId) || !Number.isInteger(quantity) || quantity < 1
      || quantity > book.quantity + (previous.get(bookId)?.quantity || 0)) fail('Invalid book quantity or duplicate book')
    seen.add(bookId)
    const old = previous.get(bookId)
    const unitPrice = old && invoice.currency === payload.currency ? old.unitPrice
      : payload.currency === 'USD' ? book.priceInUSD : book.price
    const percentage = number(item.discountPercentage ?? 0)
    const fixed = number(item.fixedDiscountAmount ?? 0)
    const gross = round(unitPrice * quantity)
    const afterPercentage = round(gross - round(gross * percentage / 100))
    if (![unitPrice, percentage, fixed].every(Number.isFinite) || percentage < 0 || percentage > 100
      || fixed < 0 || fixed > afterPercentage) fail('Invalid book discount or price')
    return { id: old?.id || invoice.id * 1000 + index + 1, bookId, bookCode: old?.bookCode || book.code,
      bookName: old?.bookName || book.name, bookAuthor: old?.bookAuthor || book.author,
      quantity, unitPrice, discountPercentage: percentage, fixedDiscountAmount: fixed,
      totalAmountAfterDiscount: round(afterPercentage - fixed) }
  })
  const billPercent = number(payload.billDiscountPercentage ?? 0)
  const billFixed = number(payload.billFixedDiscountAmount ?? 0)
  const before = round(items.reduce((sum, item) => sum + round(item.unitPrice * item.quantity), 0))
  const afterBooks = round(items.reduce((sum, item) => sum + item.totalAmountAfterDiscount, 0))
  const afterPercentage = round(afterBooks - round(afterBooks * billPercent / 100))
  if (!Number.isFinite(billPercent) || billPercent < 0 || billPercent > 100
    || !Number.isFinite(billFixed) || billFixed < 0 || billFixed > afterPercentage) fail('Invalid invoice discount')
  const total = round(afterPercentage - billFixed)
  const paid = 0
  if (paid > 0 && (payload.paymentType !== 'WHOLESALE_CREDIT' || payload.currency !== invoice.currency
    || payload.paymentMethod !== invoice.paymentMethod || String(payload.libraryName || '').trim() !== invoice.libraryName)) {
    fail('Sale type, payment method and library cannot change after a library payment', 409)
  }
  if (payload.paymentType === 'WHOLESALE_CREDIT' && paid > total) fail('Invoice total cannot be less than recorded payments')
  if (payload.paymentType === 'DIRECT' && !['CASH', 'VISA', 'COUPON'].includes(payload.paymentMethod)) fail('Payment method is required for a direct sale')
  if (payload.paymentType === 'GIFT' && payload.paymentMethod) fail('Gift invoices do not have a payment method')
  if (payload.paymentType === 'WHOLESALE_CREDIT' && (!String(payload.libraryName || '').trim()
    || (paid === 0 && payload.paymentMethod))) fail('Invalid library or payment method')

  for (const old of invoice.items) state.books.find((book) => book.id === old.bookId && book.bookFairId === Number(fairId)).quantity += old.quantity
  for (const item of items) state.books.find((book) => book.id === item.bookId && book.bookFairId === Number(fairId)).quantity -= item.quantity
  Object.assign(invoice, { businessDate: payload.businessDate, currency: payload.currency,
    paymentType: payload.paymentType, paymentMethod: payload.paymentType === 'GIFT' ? null : payload.paymentMethod || null,
    totalAmountBeforeDiscount: before, booksDiscountAmount: round(before - afterBooks),
    invoiceDiscountPercentage: billPercent, invoiceFixedDiscountAmount: billFixed,
    totalAmountAfterDiscounts: total, amountDue: payload.paymentType === 'GIFT' ? 0 : total, items })
  if (payload.paymentType === 'WHOLESALE_CREDIT') {
    const name = String(payload.libraryName).trim()
    let library = state.libraries.find((entry) => entry.bookFairId === number(fairId) && entry.name === name)
    if (!library) {
      library = { id: state.nextLibraryId++, bookFairId: number(fairId), name, accountReady: true, accountOpenedAt: today() }
      state.libraries.push(library)
    }
    invoice.libraryId = library.id
    invoice.libraryName = name
    invoice.libraryPartialPaymentAmount = paid
    invoice.libraryRemainingPaymentAmount = round(total - paid)
    invoice.paymentStatus = 'ON_ACCOUNT'
    postEntry(state, invoice, previousLibrary ? 'INVOICE_ADJUSTMENT' : 'INVOICE', previousLibrary ? Math.max(0, round(total - previousTotal)) : total, previousLibrary ? Math.max(0, round(previousTotal - total)) : 0, invoice.businessDate, `invoice-edit:${invoice.id}:${crypto.randomUUID()}`)
  } else {
    invoice.libraryId = null
    invoice.libraryName = null
    invoice.libraryPartialPaymentAmount = null
    invoice.libraryRemainingPaymentAmount = null
    invoice.paymentStatus = payload.paymentType === 'DIRECT' ? payload.paymentMethod === 'COUPON' ? 'UNPAID' : 'PAID' : 'NO_PAYMENT_REQUIRED'
  }
  invoice.notes = payload.notes?.trim() || null
  invoice.items.forEach(i => { i.returnedQuantity = 0 })
  return invoice
}

export async function exportDemoReport(path) {
  const { exportWorkbook } = await import('./reportWorkbook.js')
  return exportWorkbook(read(), new URL(path, globalThis.location?.origin || 'https://demo.invalid'), paged)
}

export function demoRequest(path, { method = 'GET', body, signal } = {}) {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
  const url = new URL(path, globalThis.location?.origin || 'https://demo.invalid')
  const route = url.pathname
  const params = url.searchParams
  const fairId = params.get('bookFairId')
  const payload = body && typeof body === 'string' ? JSON.parse(body) : null
  const state = read()

  if (route === '/settings/fetchAllCountries') return ok(Object.keys(currencies))
  if (route === '/settings/fetchCurrencies') {
    const currency = currencies[params.get('country')]
    if (!currency) fail('الدولة غير موجودة', 404)
    return ok({ currencyCode: currency[0], currencyName: currency[1], currencySymbol: currency[2] })
  }
  if (route === '/settings/fetchAllBookFairs') return ok(state.fairs)
  if (route === '/settings/create' && method === 'POST') return change((next) => {
    const name = String(payload.name || '').trim()
    if (!name || !currencies[payload.country]) fail('راجع اسم المعرض والدولة')
    const created = { id: next.nextFairId++, name, country: payload.country, primaryCurrency: currencies[payload.country][0], secondCurrency: 'USD' }
    next.fairs.push(created)
    return ok(created)
  })
  if (route === '/settings/delete' && method === 'DELETE') return change((next) => {
    const id = number(params.get('bookFairId'))
    fair(next, id)
    next.fairs = next.fairs.filter((entry) => entry.id !== id)
    next.books = next.books.filter((entry) => entry.bookFairId !== id)
    next.invoices = next.invoices.filter((entry) => entry.bookFairId !== id)
    next.libraries = next.libraries.filter((entry) => entry.bookFairId !== id)
    return ok(null)
  })

  if (route === '/books' && method === 'GET') {
    fair(state, fairId)
    const search = String(params.get('search') || '').trim().toLocaleLowerCase()
    const list = state.books.filter((book) => book.bookFairId === number(fairId) && (!search || book.code.toLowerCase().includes(search) || book.name.toLocaleLowerCase().includes(search) || book.author.toLocaleLowerCase().includes(search)))
    return ok(paged(list, params.get('page'), params.get('size')))
  }
  if (route.startsWith('/books/') && method === 'GET' && !route.includes('imports')) {
    const book = state.books.find((entry) => entry.id === number(route.split('/')[2]) && entry.bookFairId === number(fairId))
    if (!book) fail('الكتاب غير موجود', 404)
    return ok(book)
  }
  if (route === '/books' && method === 'POST') return change((next) => {
    fair(next, fairId)
    const book = { id: next.nextBookId++, bookFairId: number(fairId), ...validateBook(next, payload, fairId) }
    next.books.push(book)
    return ok(book)
  })
  if (route === '/books' && method === 'PUT') return change((next) => {
    const book = next.books.find((entry) => entry.id === number(params.get('bookId')) && entry.bookFairId === number(fairId))
    if (!book) fail('الكتاب غير موجود', 404)
    Object.assign(book, validateBook(next, payload, fairId, book.id))
    return ok(book)
  })
  if (route === '/books' && method === 'DELETE') return change((next) => {
    const id = number(params.get('bookId'))
    if (!next.books.some((entry) => entry.id === id && entry.bookFairId === number(fairId))) fail('الكتاب غير موجود', 404)
    next.books = next.books.filter((entry) => !(entry.id === id && entry.bookFairId === number(fairId)))
    return ok(null)
  })
  if (route === '/books/all' && method === 'DELETE') return change((next) => {
    fair(next, fairId)
    next.books = next.books.filter((entry) => entry.bookFairId !== number(fairId))
    return ok(null)
  })
  if (route === '/books/imports/rows' && method === 'POST') return change((next) => {
    fair(next, fairId)
    const preview = rebuildImportPreview(payload)
    const duplicate = payload.find((row) => next.books.some((book) => book.bookFairId === number(fairId) && book.code === String(row.code).trim()))
    if (!preview.valid || duplicate) fail(duplicate ? `كود ${duplicate.code} موجود بالفعل` : 'راجع الصفوف التي تحتوي على أخطاء', 422, preview)
    payload.forEach((row) => next.books.push({ id: next.nextBookId++, bookFairId: number(fairId), ...validateBook(next, row, fairId) }))
    return ok({ imported: payload.length })
  })

  fair(state, fairId)
  const libraryMatch = route.match(/^\/libraries\/(\d+)\/(statement|payments|invoices|historical-adjustments)$/)
  if (route === '/libraries/fetchAll' || route === '/invoices/fetchLibraries') return ok(state.libraries.filter(l => l.bookFairId === Number(fairId)))
  if (route === '/libraries/balances') return ok([...new Set([fair(state, fairId).primaryCurrency, 'USD'])].map(currency => ({ currency, balance: round(state.libraries.filter(l => l.bookFairId === Number(fairId)).reduce((sum, l) => sum + accountSummary(state, l.id, fairId, currency).balance, 0)) })))
  if (libraryMatch) {
    const library = state.libraries.find(l => l.id === Number(libraryMatch[1]) && l.bookFairId === Number(fairId))
    if (!library) fail('المكتبة غير موجودة', 404)
    const currency = params.get('currency')
    const view = libraryMatch[2]
    if (view === 'payments' && method === 'POST') return change(next => ok(addPayment(next, library, fairId, payload)))
    if (view === 'statement') return ok(statement(state, library, fairId, currency, params, paged))
    if (view === 'historical-adjustments') return ok(paged([], params.get('page'), params.get('size')))
    const rows = view === 'payments' ? state.payments.filter(p => p.libraryId === library.id && p.bookFairId === Number(fairId) && p.currency === currency)
      : state.invoices.filter(i => i.libraryId === library.id && i.bookFairId === Number(fairId) && !i.deleted && i.currency === currency).map(summary)
    return ok(paged(periodRows(rows, view === 'payments' ? 'paidAt' : 'businessDate', params).sort((a,b) => (b.paidAt || b.businessDate).localeCompare(a.paidAt || a.businessDate) || b.id - a.id), params.get('page'), params.get('size')))
  }
  if (route === '/invoices/coupons') return ok(state.invoices.filter(i => i.bookFairId === Number(fairId) && !i.deleted && i.paymentMethod === 'COUPON').map(summary))
  if (route === '/invoices/coupon-collections' && method === 'GET') return ok(couponReceipts(state, fairId, params.get('date')))
  const singleCoupon = route.match(/^\/invoices\/(\d+)\/coupon-collections$/)
  if (method === 'POST' && (singleCoupon || route === '/invoices/coupon-collections')) return change(next => {
    collectCoupons(next, fairId, params.get('currency'), payload, singleCoupon?.[1])
    return ok(singleCoupon ? summary(findInvoice(next, singleCoupon[1], fairId)) : couponReceipts(next, fairId).filter(r => r.collection.requestId === payload.requestId))
  })
  if (route === '/invoices/create' && method === 'POST') return change(next => ok(summary(createInvoice(next, payload, fairId))))
  if (route.endsWith('/edit') && method === 'PUT') return change(next => ok(summary(updateInvoice(next, route.split('/')[2], fairId, payload))))
  if (route === '/invoices/fetchAll') {
    const search = (params.get('search') || '').toLocaleLowerCase()
    return ok(paged(state.invoices.filter(i => i.bookFairId === Number(fairId) && !i.deleted && (!search || `${i.invoiceNumber} ${i.libraryName || ''}`.toLocaleLowerCase().includes(search))).sort((a,b) => b.id-a.id).map(summary), params.get('page'), params.get('size')))
  }
  const editReturn = route.match(/^\/invoices\/(\d+)\/returns\/(.+)$/)
  if (editReturn && method === 'PUT') return change(next => ok(summary(returnItems(next, findInvoice(next, editReturn[1], fairId), payload, decodeURIComponent(editReturn[2])))))
  if (route === '/invoices/refund/all') return ok(paged(state.invoices.filter(i => i.bookFairId === Number(fairId) && !i.deleted && i.refundAt && (!params.get('paymentType') || i.paymentType === params.get('paymentType'))).sort((a,b) => b.refundAt.localeCompare(a.refundAt) || b.id-a.id).map(summary), params.get('page'), params.get('size')))
  if (route === '/invoices/refund' && method === 'POST') return change(next => {
    const invoice = findInvoice(next, params.get('invoiceNumber'), fairId)
    const request = payload || { requestId: crypto.randomUUID(), items: invoice.items.filter(i => i.quantity > (i.returnedQuantity || 0)).map(i => ({ itemId: i.id, quantity: i.quantity - (i.returnedQuantity || 0) })), refundAmount: params.has('refundAmount') ? Number(params.get('refundAmount')) : undefined }
    return ok(summary(returnItems(next, invoice, request)))
  })
  if (route.startsWith('/invoices/refund/') && method === 'GET') return ok(summary(findInvoice(state, decodeURIComponent(route.split('/')[3]), fairId)))
  function removeInvoice(next, invoice) {
    if (invoice.couponCollections?.length || (invoice.returnHistory?.length && invoice.paymentType !== 'WHOLESALE_CREDIT')) fail('لا يمكن حذف سجل له تحصيلات أو مرتجعات موثقة', 409)
    restoreStock(next, invoice)
    if (invoice.paymentType === 'WHOLESALE_CREDIT') {
      const returned = (invoice.returnHistory || []).reduce((sum,r) => sum + r.value, 0)
      postEntry(next, invoice, 'INVOICE_CANCELLATION', 0, Math.max(0, round(invoice.totalAmountAfterDiscounts-returned)), today(), `cancel:${invoice.id}`, 'إلغاء المتبقي من قيمة الفاتورة')
      invoice.deleted = true
    } else next.invoices = next.invoices.filter(i => i.id !== invoice.id)
  }
  if (route === '/invoices/all' && method === 'DELETE') return change(next => {
    const rows = next.invoices.filter(i => i.bookFairId === Number(fairId) && !i.deleted)
    if (rows.some(i => i.paymentType === 'WHOLESALE_CREDIT')) fail('احذف فواتير المكتبات واحدة واحدة لتحديث الحساب', 409)
    rows.forEach(i => removeInvoice(next, i)); return ok(null)
  })
  if (/^\/invoices\/\d+$/.test(route) && method === 'DELETE') return change(next => { removeInvoice(next, findInvoice(next, route.split('/')[2], fairId)); return ok(null) })
  if (/^\/invoices\/\d+$/.test(route) && method === 'GET') return ok(summary(findInvoice(state, route.split('/')[2], fairId)))
  if (route === '/reports/invoices') return ok(state.invoices.filter(i => i.bookFairId === Number(fairId) && !i.deleted
    && (!params.get('date') || i.businessDate === params.get('date') || i.returnHistory?.some(r => r.date === params.get('date')))
    && (!params.get('paymentType') || i.paymentType === params.get('paymentType'))
    && (!params.get('paymentMethod') || i.paymentMethod === params.get('paymentMethod'))
    && (!params.get('currency') || i.currency === params.get('currency'))).sort((a,b) => b.id-a.id).map(summary))
  if (route === '/reports/library-payments') return ok(dailyPayments(state, fairId, params.get('date')))
  fail('العملية غير متاحة في نسخة العرض', 404)
}
