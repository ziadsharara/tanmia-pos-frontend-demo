// Browser-only demo state. No HTTP requests or real customer database access.
import { DemoError } from './errors.js'
import { businessToday } from '../utils/libraryAccounts.js'
import { getReturnSelection } from '../utils/returnSelection.js'
import { getInvoiceRemainingAmount, getInvoicePaidAmount } from '../utils/invoicePayments.js'

export const money = value => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100
const fail = (message, status = 400) => { throw new DemoError(message, status) }
const total = (rows, field) => money(rows.reduce((sum, row) => sum + Number(row[field] || 0), 0))
const revisionSnapshot = (operation, requestId) => ({ revision: operation.revision || 0, requestId, editedAt: new Date().toISOString(), date: operation.date, value: operation.value, cashAmount: operation.cashAmount, items: structuredClone(operation.items), notes: operation.notes })
const inPeriod = (date, from, to) => (!from || date >= from) && (!to || date <= to)
export const periodRows = (rows, field, params) => rows.filter(r => inPeriod(r[field], params.get('date') || params.get('from'), params.get('date') || params.get('to')))

export function postEntry(state, invoice, entryType, debit, credit, entryDate, postingKey, description = '', paymentId = null) {
  if (state.entries.some(e => e.postingKey === postingKey)) return
  state.entries.push({ id: state.nextEntryId++, bookFairId: invoice.bookFairId, libraryId: invoice.libraryId,
    currency: invoice.currency, invoiceId: invoice.id || null, entryType, debit: money(debit), credit: money(credit),
    entryDate, postingKey, description, paymentId, createdAt: new Date().toISOString() })
}

export function upgradeState(state) {
  if (state.version === 6) return state
  state.entries = []; state.payments = []; state.nextEntryId = 1
  for (const library of state.libraries) { library.accountReady = true; library.accountOpenedAt = businessToday() }
  for (const invoice of state.invoices) {
    invoice.notes ??= null; invoice.deleted ??= false; invoice.couponCollections ??= []
    for (const item of invoice.items) item.returnedQuantity ??= invoice.paymentStatus === 'REFUND' ? item.quantity : 0
    if (invoice.paymentType !== 'WHOLESALE_CREDIT') continue
    const library = state.libraries.find(l => l.id === invoice.libraryId && l.bookFairId === invoice.bookFairId)
    if (library && invoice.businessDate < library.accountOpenedAt) library.accountOpenedAt = invoice.businessDate
    postEntry(state, invoice, 'INVOICE', invoice.totalAmountAfterDiscounts, 0, invoice.businessDate, `invoice:${invoice.id}`)
    for (const p of invoice.libraryPayments || []) {
      const payment = { ...p, bookFairId: invoice.bookFairId, libraryId: invoice.libraryId, invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber, currency: invoice.currency, notes: p.notes || '', requestId: `old-payment:${p.id}` }
      state.payments.push(payment)
      postEntry(state, invoice, 'PAYMENT', 0, p.amount, p.paidAt, `payment:${p.id}`, p.notes || 'دفعة مستلمة', p.id)
    }
    if (invoice.returnHistory?.length) {
      for (const operation of invoice.returnHistory) postReturn(state, invoice, operation)
    } else if (invoice.paymentStatus === 'REFUND') {
      postEntry(state, invoice, 'RETURN', 0, invoice.totalAmountAfterDiscounts, invoice.refundAt || invoice.businessDate, `legacy-return:${invoice.id}`, 'مرتجع سابق بدون تفاصيل نقد موثقة')
    }
    invoice.paymentMethod = null
    if (invoice.paymentStatus !== 'REFUND') invoice.paymentStatus = 'ON_ACCOUNT'
  }
  state.version = 6
  return state
}

export function invoiceSummary(invoice) {
  const rows = getReturnSelection({ ...invoice, items: invoice.items.map(item => ({ ...item, returnLineValue: undefined })) }, {})
  let assigned = 0, prefix = 0
  const subtotal = total(invoice.items, 'totalAmountAfterDiscount')
  const full = new Map()
  for (const i of [...invoice.items].sort((a, b) => a.id - b.id)) {
    prefix += Number(i.totalAmountAfterDiscount)
    const next = subtotal === 0 ? 0 : Math.round(Number(invoice.totalAmountAfterDiscounts) * 100 * prefix / subtotal)
    full.set(i.id, (next - assigned) / 100); assigned = next
  }
  return { ...invoice, items: rows.map(i => ({ ...i, returnLineValue: full.get(i.id) })),
    books: invoice.items.map(i => ({ ...i })), libraryRefundAmount: total(invoice.returnHistory || [], 'cashAmount'),
    cashCollectedAmount: 0, visaCollectedAmount: 0 }
}

export function libraryEntries(state, libraryId, fairId, currency) {
  return state.entries.filter(e => e.libraryId === Number(libraryId) && e.bookFairId === Number(fairId) && e.currency === currency)
    .sort((a, b) => a.entryDate.localeCompare(b.entryDate) || a.id - b.id)
}
export function accountSummary(state, libraryId, fairId, currency) {
  const entries = libraryEntries(state, libraryId, fairId, currency)
  const sumType = type => money(entries.filter(e => e.entryType === type).reduce((sum, e) => sum + e.debit - e.credit, 0))
  return { totalInvoices: money(sumType('INVOICE') + sumType('INVOICE_ADJUSTMENT')), totalPaid: money(-sumType('PAYMENT')),
    totalReturns: money(-sumType('RETURN')), totalRefunded: sumType('REFUND'), totalCancelled: money(-sumType('INVOICE_CANCELLATION')),
    historicalAdjustment: sumType('LEGACY_ADJUSTMENT'), currentBalance: money(total(entries, 'debit') - total(entries, 'credit')), balance: money(total(entries, 'debit') - total(entries, 'credit')), note: null }
}
export function statement(state, library, fairId, currency, params, paginate) {
  const entries = libraryEntries(state, library.id, fairId, currency)
  let balance = 0
  const rows = entries.map(entry => {
    balance = money(balance + entry.debit - entry.credit)
    return { entry, balance, invoiceNumber: state.invoices.find(i => i.id === entry.invoiceId)?.invoiceNumber || null }
  })
  const from = params.get('from'), to = params.get('to')
  const selected = rows.filter(r => inPeriod(r.entry.entryDate, from, to))
  const openingBalance = money(entries.filter(e => from && e.entryDate < from).reduce((sum, e) => sum + e.debit - e.credit, 0))
  const totalDebit = total(selected.map(r => r.entry), 'debit'), totalCredit = total(selected.map(r => r.entry), 'credit')
  const page = paginate([...selected].reverse(), params.get('page'), params.get('size'))
  const first = page.content[0]
  return { libraryId: library.id, libraryName: library.name, currency, accountOpenedAt: library.accountOpenedAt,
    from, to, openingBalance, totalDebit, totalCredit, closingBalance: money(openingBalance + totalDebit - totalCredit),
    pageOpeningBalance: first ? money(first.balance - first.entry.debit + first.entry.credit) : openingBalance,
    accountSummary: accountSummary(state, library.id, fairId, currency), entries: page }
}

function validateReceipt(request, max, dateFloor) {
  const amount = Number(request?.amount)
  if (!request?.requestId || !Number.isFinite(amount) || amount <= 0 || money(amount) !== amount || amount > max
    || !['CASH', 'VISA'].includes(request.paymentMethod) || !request.paidAt || request.paidAt > businessToday()
    || (dateFloor && request.paidAt < dateFloor)) fail('راجع المبلغ وطريقة الدفع وتاريخ التحصيل')
}
const sameReceipt = (a, b) => Number(a.amount) === Number(b.amount) && a.paymentMethod === b.paymentMethod && a.paidAt === b.paidAt && (a.notes || '').trim() === (b.notes || '').trim()
export function addPayment(state, library, fairId, request) {
  const prior = state.payments.find(p => p.libraryId === library.id && p.bookFairId === Number(fairId) && p.requestId === request.requestId)
  if (prior) { if (!sameReceipt(prior, request) || prior.currency !== request.currency) fail('رقم الدفعة مستخدم لبيانات مختلفة', 409); return prior }
  validateReceipt(request, Number.MAX_SAFE_INTEGER / 100, library.accountOpenedAt)
  const payment = { ...request, amount: money(request.amount), id: state.nextPaymentId++, libraryId: library.id, bookFairId: Number(fairId), invoiceId: null, currency: request.currency }
  if (![state.fairs.find(f => f.id === Number(fairId))?.primaryCurrency, 'USD'].includes(request.currency)) fail('العملة غير صحيحة')
  state.payments.push(payment)
  postEntry(state, { bookFairId: Number(fairId), libraryId: library.id, currency: request.currency }, 'PAYMENT', 0, payment.amount, request.paidAt, `payment:${payment.id}`, request.notes || 'دفعة مستلمة', payment.id)
  return payment
}
export function couponReceipts(state, fairId, date) {
  return state.invoices.filter(i => i.bookFairId === Number(fairId) && !i.deleted && i.paymentMethod === 'COUPON')
    .flatMap(i => (i.couponCollections || []).filter(c => !date || c.paidAt === date).map(collection => ({ invoiceId: i.id, invoiceNumber: i.invoiceNumber, currency: i.currency, collection })))
}
function updateCouponStatus(invoice) {
  if (invoice.paymentStatus !== 'REFUND') invoice.paymentStatus = getInvoiceRemainingAmount(invoice) === 0 ? 'PAID' : getInvoicePaidAmount(invoice) > 0 ? 'PARTIALLY_PAID' : 'UNPAID'
}
export function collectCoupons(state, fairId, currency, request, invoiceId = null) {
  const invoices = state.invoices.filter(i => i.bookFairId === Number(fairId) && !i.deleted && i.paymentMethod === 'COUPON' && (invoiceId == null ? i.currency === currency : i.id === Number(invoiceId))).sort((a, b) => a.id - b.id)
  if (invoiceId != null && !invoices.length) fail('فاتورة الكوبون غير موجودة', 404)
  const replay = invoices.flatMap(i => (i.couponCollections || []).filter(c => c.requestId === request.requestId))
  if (replay.length) {
    if (replay.some(c => !sameReceipt({ ...c, amount: c.batchTotal ?? c.amount }, request))) fail('رقم التحصيل مستخدم لبيانات مختلفة', 409)
    return couponReceipts(state, fairId).filter(r => r.collection.requestId === request.requestId)
  }
  const available = i => i.businessDate > request.paidAt ? 0 : Math.min(getInvoiceRemainingAmount(i), getInvoiceRemainingAmount(i, request.paidAt))
  validateReceipt(request, money(invoices.reduce((sum, i) => sum + available(i), 0)), invoiceId == null ? null : invoices[0].businessDate)
  let remaining = money(request.amount)
  for (const invoice of invoices) {
    const amount = Math.min(remaining, available(invoice))
    if (amount <= 0) continue
    invoice.couponCollections ||= []
    invoice.couponCollections.push({ ...request, amount, notes: request.notes?.trim() || null, ...(invoiceId == null ? { batchTotal: Number(request.amount) } : {}) })
    updateCouponStatus(invoice); remaining = money(remaining - amount)
    if (!remaining) break
  }
  return couponReceipts(state, fairId).filter(r => r.collection.requestId === request.requestId)
}

export function postReturn(state, invoice, operation, prefix = '') {
  postEntry(state, invoice, 'RETURN', 0, operation.value, operation.date, `${prefix}return-op:${invoice.id}:${operation.id}`, operation.items.map(i => `${i.bookName} × ${i.quantity}`).join('، '))
  if (operation.cashAmount) postEntry(state, invoice, 'REFUND', operation.cashAmount, 0, operation.date, `${prefix}refund-op:${invoice.id}:${operation.id}`, 'نقد سلّمناه للمكتبة')
}

export function returnItems(state, invoice, request, operationId = null) {
  if (invoice.deleted) fail('الفاتورة ملغاة', 409)
  const history = invoice.returnHistory || []
  const old = operationId && history.find(r => r.id === operationId)
  if (operationId && !old) fail('تفاصيل المرتجع القديمة غير متاحة للتعديل', 409)
  if (!request?.requestId || !request.items?.length) fail('اختار الكتب والكميات')
  const normalized = { ...request, notes: request.notes?.trim() || null, date: operationId ? request.date || old.date : businessToday() }
  if (normalized.date < invoice.businessDate || normalized.date > businessToday()) fail('راجع تاريخ المرتجع')
  const fingerprint = JSON.stringify({ items: [...request.items].sort((a,b) => a.itemId-b.itemId), cash: request.refundAmount ?? null, notes: normalized.notes, date: normalized.date })
  const prior = operationId ? history.find(r => r.lastEditRequestId === request.requestId) : history.find(r => r.id === request.requestId)
  if (prior) { if (prior.requestFingerprint !== fingerprint) fail('رقم العملية مستخدم لبيانات مختلفة', 409); return invoice }
  if (old && Number(request.expectedRevision) !== Number(old.revision || 0)) fail('تم تعديل المرتجع؛ أعد تحميل البيانات', 409)
  if (!old && invoice.paymentStatus === 'REFUND') fail('الفاتورة مرتجعة بالكامل', 409)
  const revised = structuredClone(history)
  const targetIndex = old ? revised.findIndex(r => r.id === old.id) : revised.length
  if (!old) revised.push({ id: request.requestId, revisions: [], revision: 0 })
  revised[targetIndex] = { ...revised[targetIndex], date: normalized.date, notes: normalized.notes, choices: request.items }
  const counts = new Map()
  const base = invoiceSummary(invoice)
  for (let index = 0; index < revised.length; index++) {
    const operation = revised[index]
    const choices = operation.choices || operation.items.map(i => ({ itemId: i.itemId, quantity: i.quantity }))
    const seen = new Set()
    const quantities = Object.fromEntries(choices.map(i => [i.itemId, i.quantity]))
    for (const choice of choices) {
      const line = invoice.items.find(i => i.id === Number(choice.itemId))
      if (!line || seen.has(line.id) || !Number.isInteger(choice.quantity) || choice.quantity <= 0 || choice.quantity + (counts.get(line.id) || 0) > line.quantity) fail('كمية المرتجع تتجاوز المتاح من الفاتورة')
      seen.add(line.id)
    }
    const selected = getReturnSelection({ ...base, items: base.items.map(i => ({ ...i, returnedQuantity: counts.get(i.id) || 0 })) }, quantities).filter(i => i.selectedQuantity > 0)
    operation.items = selected.map(i => ({ itemId: i.id, bookName: i.bookName, bookCode: i.bookCode, quantity: i.selectedQuantity, value: i.returnValue }))
    operation.value = total(operation.items, 'value'); delete operation.choices
    selected.forEach(i => counts.set(i.id, (counts.get(i.id) || 0) + i.selectedQuantity))
    if (index === targetIndex) {
      const otherCash = total(history.filter(r => r !== old), 'cashAmount')
      const couponPaidAtDate = (invoice.couponCollections || []).filter(c => c.paidAt <= operation.date).reduce((s,c) => s + c.amount, 0)
      const maxCash = invoice.paymentType === 'GIFT' ? 0 : invoice.paymentMethod === 'COUPON' ? Math.max(0, Math.min(getInvoicePaidAmount(invoice) - otherCash, couponPaidAtDate - total(history.filter(r => r !== old && r.date <= operation.date), 'cashAmount'))) : invoice.paymentType === 'DIRECT' ? Math.max(0, getInvoicePaidAmount(invoice) - otherCash) : operation.value
      operation.cashAmount = Number(request.refundAmount ?? (old ? Math.min(old.cashAmount, operation.value) : Math.min(operation.value, maxCash)))
      if (!Number.isFinite(operation.cashAmount) || operation.cashAmount < 0 || operation.cashAmount > Math.min(operation.value, maxCash) || money(operation.cashAmount) !== operation.cashAmount) fail('راجع المبلغ المردود فعلياً')
      operation.requestFingerprint = fingerprint
      if (old) { operation.revisions = [...(old.revisions || []), revisionSnapshot(old, request.requestId)]; operation.revision = (old.revision || 0) + 1; operation.lastEditRequestId = request.requestId }
    } else {
      if (operation.cashAmount > operation.value) fail('التعديل يتعارض مع مبلغ مردود في عملية أخرى')
      if (old && operation.value !== history[index].value) { operation.revisions = [...(operation.revisions || []), revisionSnapshot(history[index], request.requestId)]; operation.revision = (operation.revision || 0) + 1; operation.lastEditRequestId = request.requestId }
    }
  }
  if (invoice.paymentType === 'WHOLESALE_CREDIT') {
    const account = accountSummary(state, invoice.libraryId, invoice.bookFairId, invoice.currency)
    if (total(revised, 'cashAmount') - total(history, 'cashAmount') > account.totalPaid - account.totalRefunded) fail('المردود يتجاوز الدفعات المستلمة من المكتبة')
    if (old && old.date !== normalized.date) {
      const atDate = libraryEntries(state, invoice.libraryId, invoice.bookFairId, invoice.currency).filter(e => e.entryDate <= normalized.date)
      const received = atDate.filter(e => e.entryType === 'PAYMENT').reduce((sum,e) => sum + e.credit - e.debit, 0)
      const refunded = atDate.filter(e => e.entryType === 'REFUND').reduce((sum,e) => sum + e.debit - e.credit, 0) - (old.date <= normalized.date ? old.cashAmount : 0)
      if (revised[targetIndex].cashAmount > money(received-refunded)) fail('تاريخ رد النقد يسبق الدفعات المتاحة من المكتبة')
    }
  }
  for (const item of invoice.items) {
    const delta = (counts.get(item.id) || 0) - (item.returnedQuantity || 0)
    const book = state.books.find(b => b.id === item.bookId && b.bookFairId === invoice.bookFairId)
    if (!book || book.quantity + delta < 0) fail('المخزون لا يكفي لتعديل المرتجع', 409)
    book.quantity += delta; item.returnedQuantity = counts.get(item.id) || 0
  }
  if (invoice.paymentType === 'WHOLESALE_CREDIT') {
    if (old) for (let index = 0; index < revised.length; index++) {
      const before = history[index], after = revised[index]
      if (before.date !== after.date) {
        postEntry(state, invoice, 'RETURN', before.value, 0, before.date, `return-fix:${request.requestId}:${index}:reverse`, 'عكس أثر المرتجع لتصحيح التاريخ')
        if (before.cashAmount) postEntry(state, invoice, 'REFUND', 0, before.cashAmount, before.date, `refund-fix:${request.requestId}:${index}:reverse`, 'عكس النقد لتصحيح التاريخ')
        postReturn(state, invoice, after, `fix:${request.requestId}:${index}:`)
      } else {
        const goods = money(after.value - before.value), cash = money(after.cashAmount - before.cashAmount)
        if (goods) postEntry(state, invoice, 'RETURN', goods < 0 ? -goods : 0, goods > 0 ? goods : 0, after.date, `return-fix:${request.requestId}:${index}`, 'تعديل قيمة الكتب المرتجعة')
        if (cash) postEntry(state, invoice, 'REFUND', cash > 0 ? cash : 0, cash < 0 ? -cash : 0, after.date, `refund-fix:${request.requestId}:${index}`, 'تعديل النقد المردود')
      }
    } else postReturn(state, invoice, revised[targetIndex])
  }
  invoice.returnHistory = revised; invoice.refundAt = [...revised].map(r => r.date).sort().at(-1)
  invoice.paymentStatus = invoice.items.every(i => i.returnedQuantity === i.quantity) ? 'REFUND' : invoice.paymentType === 'GIFT' ? 'NO_PAYMENT_REQUIRED' : invoice.paymentType === 'WHOLESALE_CREDIT' ? 'ON_ACCOUNT' : 'PAID'
  if (invoice.paymentMethod === 'COUPON') updateCouponStatus(invoice)
  return invoice
}
