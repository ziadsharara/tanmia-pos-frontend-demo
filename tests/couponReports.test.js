import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateReportTotals } from '../src/utils/reportTotals.js'
import { getInvoicePaidAmount, getInvoiceRemainingAmount } from '../src/utils/invoicePayments.js'
import { getReturnBreakdown } from '../src/utils/returnSelection.js'

const coupon = { id: 1, currency: 'LYD', paymentType: 'DIRECT', paymentMethod: 'COUPON', paymentStatus: 'UNPAID', businessDate: '2026-10-25', amountDue: 200, totalAmountAfterDiscounts: 200 }
test('coupon counts as sale but never cash, visa or collection; returns reduce outstanding coupon value', () => {
  const invoice = { ...coupon, returnHistory: [{ id: 'r', date: '2026-10-25', value: 50, cashAmount: 0 }] }
  const cash = { ...coupon, id: 2, paymentMethod: 'CASH', amountDue: 100, totalAmountAfterDiscounts: 100 }
  const payments = [{ amount: 30, currency: 'LYD', paymentMethod: 'CASH' }]
  const [all] = calculateReportTotals([invoice, cash], payments)
  assert.equal(all.sales, 250); assert.equal(all.couponPending, 150)
  assert.equal(all.collected, 130); assert.equal(all.cashCollected, 130); assert.equal(all.visaCollected, 0)
  assert.equal(all.refunds, 0); assert.equal(all.netCollected, 130)
  assert.equal(getInvoicePaidAmount(invoice), 0); assert.equal(getInvoiceRemainingAmount(invoice), 150)
  const [daily] = calculateReportTotals([invoice, cash], payments, null, { daily: true, date: '2026-10-25' })
  assert.equal(daily.sales, 300); assert.equal(daily.couponPending, 150); assert.equal(daily.collected, 130)
})
test('legacy coupon full return does not invent a cash payout', () => {
  const invoice = { ...coupon, paymentStatus: 'REFUND', refundAt: '2026-10-25' }
  assert.equal(getReturnBreakdown(invoice).cash, 0)
  const [totals] = calculateReportTotals([invoice])
  assert.equal(totals.collected, 0); assert.equal(totals.refunds, 0); assert.equal(totals.netCollected, 0); assert.equal(totals.couponPending, 0)
  assert.equal(getInvoiceRemainingAmount(invoice), 0)
})

test('fair redemption enters only its collection day/method, once, and reduces pending coupon obligation', () => {
  const receipt = { invoiceId: 1, currency: 'LYD', collection: { requestId: 'collect', amount: 80, paidAt: '2026-10-26', paymentMethod: 'VISA' } }
  const invoice = { ...coupon, couponCollections: [receipt.collection] }
  assert.equal(getInvoicePaidAmount(invoice), 80); assert.equal(getInvoiceRemainingAmount(invoice), 120)
  const [issue] = calculateReportTotals([invoice], [], null, { daily: true, date: '2026-10-25', couponReceipts: [] })
  assert.equal(issue.collected, 0); assert.equal(issue.netCollected, 0); assert.equal(issue.couponPending, 200)
  const [collectionDay] = calculateReportTotals([], [], null, { daily: true, date: '2026-10-26', couponReceipts: [receipt] })
  assert.equal(collectionDay.sales, 0); assert.equal(collectionDay.collected, 80); assert.equal(collectionDay.cashCollected, 0); assert.equal(collectionDay.visaCollected, 80); assert.equal(collectionDay.netCollected, 80)
  const [overall] = calculateReportTotals([invoice], [], null, { couponReceipts: [receipt] })
  assert.equal(overall.collected, 80); assert.equal(overall.netCollected, 80); assert.equal(overall.couponPending, 120)
})

test('cash report includes redeemed coupon payout without counting coupon invoice as a cash sale', () => {
  const invoice = { ...coupon, couponCollections: [{ amount: 50, paymentMethod: 'CASH', paidAt: '2026-10-25' }], returnHistory: [{ value: 100, cashAmount: 50, date: '2026-10-25' }] }
  const [totals] = calculateReportTotals([invoice], [], null, { paymentMethod: 'CASH', couponReceipts: [{ currency: 'LYD', collection: invoice.couponCollections[0] }] })
  assert.equal(totals.sales, 0); assert.equal(totals.collected, 50); assert.equal(totals.refunds, 50); assert.equal(totals.netCollected, 0)
})
