import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateReportTotals, mergeReportInvoices } from '../src/utils/reportTotals.js'
import { getInvoicePaidAmount, getInvoiceRemainingAmount } from '../src/utils/invoicePayments.js'
import { businessToday, validateLibraryPayment } from '../src/utils/libraryAccounts.js'

const wholesale = { currency: 'EGP', paymentType: 'WHOLESALE_CREDIT', paymentStatus: 'ON_ACCOUNT', totalAmountAfterDiscounts: 1000 }
const payment = { currency: 'EGP', amount: 900, paymentMethod: 'CASH' }

test('receipts reduce account debt without allocating payment to invoices', () => {
  const [totals] = calculateReportTotals([wholesale, { ...wholesale, totalAmountAfterDiscounts: 600 }], [payment])
  assert.equal(totals.sales, 1600)
  assert.equal(totals.collected, 900)
  assert.equal(totals.remaining, 700)
})

test('historical invoice paid fields never double count receipts', () => {
  const invoice = { ...wholesale, paymentStatus: 'PAID', libraryPartialPaymentAmount: 1000, libraryRemainingPaymentAmount: 0 }
  assert.equal(getInvoicePaidAmount(invoice), 0)
  assert.equal(getInvoiceRemainingAmount(invoice), 0)
  const [totals] = calculateReportTotals([invoice], [{ ...payment, amount: 1000 }])
  assert.equal(totals.collected, 1000)
  assert.equal(totals.remaining, 0)
})

test('reviewed ledger balance overrides imperfect historical data', () => {
  const [totals] = calculateReportTotals([wholesale], [payment], [{ currency: 'EGP', balance: -50 }])
  assert.equal(totals.remaining, -50)
  assert.equal(totals.collected, 900)
})

test('returned invoice records the actual cash refund separately from receipts', () => {
  const [totals] = calculateReportTotals([{ ...wholesale, paymentStatus: 'REFUND', libraryRefundAmount: 900 }], [payment])
  assert.equal(totals.sales, 0)
  assert.equal(totals.collected, 900)
  assert.equal(totals.refunds, 900)
  assert.equal(totals.netCollected, 0)
  assert.equal(totals.remaining, 0)
})

test('payments on days without sales still appear in collection totals', () => {
  const [totals] = calculateReportTotals([], [payment])
  assert.equal(totals.cashCollected, 900)
  assert.equal(totals.netCollected, 900)
})

test('currency totals stay separate', () => {
  const totals = calculateReportTotals([wholesale, { ...wholesale, currency: 'USD', totalAmountAfterDiscounts: 100 }], [payment])
  assert.equal(totals.find((total) => total.currency === 'EGP').remaining, 100)
  assert.equal(totals.find((total) => total.currency === 'USD').remaining, 100)
})

test('payments allow credit and enforce amount, method and date boundaries', () => {
  const request = { amount: '900.50', paymentMethod: 'CASH', paidAt: businessToday(), notes: '' }
  assert.equal(validateLibraryPayment(request, businessToday()), '')
  for (const amount of ['0', '-1', '1.001', 'NaN', 'Infinity', '100000000000000000']) {
    assert.ok(validateLibraryPayment({ ...request, amount }, businessToday()))
  }
  assert.ok(validateLibraryPayment({ ...request, paidAt: '2000-01-01' }, businessToday()))
  assert.ok(validateLibraryPayment({ ...request, paidAt: '2999-01-01' }, businessToday()))
  assert.ok(validateLibraryPayment({ ...request, paymentMethod: '' }, businessToday()))
})


test('return day reduces account debt by returned goods minus actual cash handed back', () => {
  const [totals] = calculateReportTotals([{ ...wholesale, paymentStatus: 'REFUND', libraryRefundAmount: 300 }], [], null, { daily: true })
  assert.equal(totals.remaining, -700)
  assert.equal(totals.refunds, 300)
  assert.equal(totals.netCollected, -300)
})


test('daily refunds retain the original sale and reduce collection only on the return day', () => {
  for (const paymentMethod of ['CASH', 'VISA']) {
    const returned = { currency: 'EGP', paymentType: 'DIRECT', paymentMethod, paymentStatus: 'REFUND', amountDue: 80, totalAmountAfterDiscounts: 100, businessDate: '2026-10-10', refundAt: '2026-10-11' }
    const [saleDay] = calculateReportTotals([returned], [], null, { daily: true, date: '2026-10-10' })
    assert.equal(saleDay.sales, 100)
    assert.equal(saleDay.netCollected, 80)
    assert.equal(saleDay.refunds, 0)
    const [returnDay] = calculateReportTotals([returned], [], null, { daily: true, date: '2026-10-11' })
    assert.equal(returnDay.sales, 0)
    assert.equal(returnDay.refunds, 80)
    assert.equal(returnDay.netCollected, -80)
    const [sameDay] = calculateReportTotals([{ ...returned, refundAt: returned.businessDate }], [], null, { daily: true, date: returned.businessDate })
    assert.equal(sameDay.collected, 80)
    assert.equal(sameDay.refunds, 80)
    assert.equal(sameDay.netCollected, 0)
  }
})

test('daily library refunds reverse debt and actual cash separately without duplicating receipts', () => {
  const returned = { ...wholesale, businessDate: '2026-10-10', refundAt: '2026-10-11', paymentStatus: 'REFUND', libraryRefundAmount: 300 }
  const [saleDay] = calculateReportTotals([returned], [ { ...payment, amount: 300 } ], null, { daily: true, date: '2026-10-10' })
  assert.equal(saleDay.sales, 1000)
  assert.equal(saleDay.remaining, 700)
  assert.equal(saleDay.netCollected, 300)
  const [returnDay] = calculateReportTotals([returned], [], null, { daily: true, date: '2026-10-11' })
  assert.equal(returnDay.remaining, -700)
  assert.equal(returnDay.netCollected, -300)
})


test('whole-fair totals deduct direct refunds exactly once, including full-refund and mixed-currency cases', () => {
  for (const paymentMethod of ['CASH', 'VISA']) {
    const sale = { currency: 'EGP', paymentType: 'DIRECT', paymentMethod, paymentStatus: 'PAID', totalAmountAfterDiscounts: 100, amountDue: 100 }
    const returned = { ...sale, paymentStatus: 'REFUND' }
    const [totals] = calculateReportTotals([sale, returned])
    assert.equal(totals.sales, 100)
    assert.equal(totals.collected, 200)
    assert.equal(totals.refunds, 100)
    assert.equal(totals.netCollected, 100)
    assert.equal(totals[paymentMethod === 'CASH' ? 'cashCollected' : 'visaCollected'], 200)
    const [fullyReturned] = calculateReportTotals([returned])
    assert.equal(fullyReturned.collected, 100)
    assert.equal(fullyReturned.refunds, 100)
    assert.equal(fullyReturned.netCollected, 0)
    const currencies = calculateReportTotals([sale, returned, { ...returned, currency: 'USD', amountDue: 10 }])
    assert.equal(currencies.find(total => total.currency === 'EGP').netCollected, 100)
    assert.equal(currencies.find(total => total.currency === 'USD').netCollected, 0)
  }
})


test('report loading retains returns from older servers without duplicating returns from updated servers', () => {
  const returned = { id: 2, paymentStatus: 'REFUND', paymentType: 'DIRECT', paymentMethod: 'CASH', currency: 'EGP', businessDate: '2026-10-10', refundAt: '2026-10-11' }
  const sale = { id: 1, paymentStatus: 'PAID' }
  assert.equal(mergeReportInvoices([sale], [returned]).length, 2)
  assert.equal(mergeReportInvoices([sale, returned], [returned]).length, 2)
  assert.equal(mergeReportInvoices([], [returned], { date: '2026-10-10' }).length, 1)
  assert.equal(mergeReportInvoices([], [returned], { date: '2026-10-11' }).length, 1)
  assert.equal(mergeReportInvoices([], [returned], { date: '2026-10-12' }).length, 0)
  assert.equal(mergeReportInvoices([], [returned], { currency: 'USD' }).length, 0)
  assert.equal(mergeReportInvoices([], [returned], { paymentMethod: 'VISA' }).length, 0)
  assert.equal(mergeReportInvoices([], [returned], { paymentType: 'WHOLESALE_CREDIT' }).length, 0)
})


test('an unpaid library return shows returned goods value without inventing a cash refund', () => {
  const invoice = { ...wholesale, totalAmountAfterDiscounts: 110, paymentStatus: 'REFUND', libraryRefundAmount: 0, businessDate: '2026-10-12', refundAt: '2026-10-12' }
  const [daily] = calculateReportTotals([invoice], [], null, { daily: true, date: '2026-10-12' })
  assert.equal(daily.sales, 110)
  assert.equal(daily.returnedValue, 110)
  assert.equal(daily.refunds, 0)
  assert.equal(daily.netCollected, 0)
  assert.equal(daily.remaining, 0)
  const [overview] = calculateReportTotals([invoice])
  assert.equal(overview.returnedValue, 110)
  assert.equal(overview.refunds, 0)
})


test('gift-only day has invoice value but no sale revenue or collection', () => {
  const [totals] = calculateReportTotals([{ currency: 'USD', paymentType: 'GIFT', paymentStatus: 'NO_PAYMENT_REQUIRED', totalAmountAfterDiscounts: 192.30, amountDue: 0 }], [], null, { daily: true, date: '2026-10-07' })
  assert.equal(totals.invoiceValue, 192.30)
  assert.equal(totals.gifts, 192.30)
  assert.equal(totals.sales, 0)
  assert.equal(totals.collected, 0)
  assert.equal(totals.netCollected, 0)
})


test('library invoice value and received payments stay separate and feed collection totals exactly once', () => {
  const invoice = { ...wholesale, businessDate: '2026-10-10' }
  const receipts = [{ ...payment, amount: 300 }, { ...payment, amount: 200, paymentMethod: 'VISA' }]
  const [totals] = calculateReportTotals([invoice], receipts, [{ currency: 'EGP', balance: 500 }])
  assert.equal(totals.libraryInvoices, 1000)
  assert.equal(totals.libraryPayments, 500)
  assert.equal(totals.collected, 500)
  assert.equal(totals.cashCollected, 300)
  assert.equal(totals.visaCollected, 200)
  assert.equal(totals.netCollected, 500)
  assert.equal(totals.remaining, 500)
  const [later] = calculateReportTotals([], receipts, null, { daily: true, date: '2026-10-11' })
  assert.equal(later.libraryInvoices, 0)
  assert.equal(later.libraryPayments, 500)
  assert.equal(later.collected, 500)
  const [returnDay] = calculateReportTotals([{ ...invoice, paymentStatus: 'REFUND', refundAt: '2026-10-12', libraryRefundAmount: 150 }], [], null, { daily: true, date: '2026-10-12' })
  assert.equal(returnDay.libraryInvoices, 0)
  assert.equal(returnDay.libraryPayments, 0)
  assert.equal(returnDay.refunds, 150)
  assert.equal(returnDay.libraryRefunds, 150)
  assert.equal(returnDay.netCollected, -150)
})


test('returned gifts have their own value card and never create cash refunds', () => {
  const gift = { currency: 'USD', paymentType: 'GIFT', paymentStatus: 'REFUND', totalAmountAfterDiscounts: 192.30, amountDue: 0, businessDate: '2026-10-07', refundAt: '2026-10-08' }
  const [totals] = calculateReportTotals([gift], [], null, { daily: true, date: '2026-10-08' })
  assert.equal(totals.returnedGifts, 192.30)
  assert.equal(totals.returnedValue, 0)
  assert.equal(totals.refunds, 0)
  assert.equal(totals.collected, 0)
  assert.equal(totals.netCollected, 0)
})


test('partial returns retain original receipts and use the amount and date of each operation', () => {
  const invoice = { id: 99, currency: 'EGP', paymentType: 'DIRECT', paymentMethod: 'VISA', paymentStatus: 'PAID',
    businessDate: '2026-10-01', refundAt: '2026-10-03', totalAmountAfterDiscounts: 500, amountDue: 500,
    returnHistory: [{ date: '2026-10-02', value: 100, cashAmount: 100 }, { date: '2026-10-03', value: 200, cashAmount: 200 }] }
  const [all] = calculateReportTotals([invoice])
  assert.equal(all.sales, 200)
  assert.equal(all.collected, 500)
  assert.equal(all.visaCollected, 500)
  assert.equal(all.refunds, 300)
  assert.equal(all.netCollected, 200)
  const [first] = calculateReportTotals([invoice], [], null, { daily: true, date: '2026-10-02' })
  assert.equal(first.sales, 0)
  assert.equal(first.returnedValue, 100)
  assert.equal(first.netCollected, -100)
  const [sale] = calculateReportTotals([invoice], [], null, { daily: true, date: '2026-10-01' })
  assert.equal(sale.sales, 500)
  assert.equal(sale.netCollected, 500)
  assert.equal(mergeReportInvoices([], [invoice], { date: '2026-10-02' }).length, 1)
})

test('partial library returns reduce debt separately from entered cash and gifts never refund cash', () => {
  const library = { currency: 'EGP', paymentType: 'WHOLESALE_CREDIT', paymentStatus: 'ON_ACCOUNT', totalAmountAfterDiscounts: 500,
    businessDate: '2026-10-01', refundAt: '2026-10-02', returnHistory: [{ date: '2026-10-02', value: 200, cashAmount: 50 }] }
  const [all] = calculateReportTotals([library], [{ currency: 'EGP', amount: 200, paymentMethod: 'CASH' }])
  assert.equal(all.libraryInvoices, 500)
  assert.equal(all.sales, 300)
  assert.equal(all.libraryPayments, 200)
  assert.equal(all.libraryRefunds, 50)
  assert.equal(all.remaining, 150)
  assert.equal(all.netCollected, 150)
  const [day] = calculateReportTotals([library], [], null, { daily: true, date: '2026-10-02' })
  assert.equal(day.remaining, -150)
  const [gift] = calculateReportTotals([{ ...library, paymentType: 'GIFT', returnHistory: [{ date: '2026-10-02', value: 200, cashAmount: 0 }] }])
  assert.equal(gift.gifts, 300)
  assert.equal(gift.returnedGifts, 200)
  assert.equal(gift.refunds, 0)
})

test('return differences reduce debt or create library credit, never a new collectible amount', async () => {
  const { libraryBalanceLabel, libraryReturnEffect } = await import('../src/utils/libraryAccounts.js')
  assert.equal(libraryReturnEffect(200, 50), 150)
  assert.equal(libraryBalanceLabel(300 - 150), 'مطلوب تحصيله من المكتبة')
  assert.equal(libraryBalanceLabel(0 - 150), 'رصيد لصالح المكتبة عندنا')
  assert.equal(libraryBalanceLabel(0), 'الحساب متعادل')
})
