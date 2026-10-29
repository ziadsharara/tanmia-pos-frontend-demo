import test from 'node:test'
import assert from 'node:assert/strict'
import { getReturnSelection, supportsItemReturns } from '../src/utils/returnSelection.js'

const invoice = { totalAmountAfterDiscounts: 600, items: [
  { id: 327, quantity: 1, totalAmountAfterDiscount: 260 },
  { id: 328, quantity: 1, totalAmountAfterDiscount: 200 },
  { id: 329, quantity: 1, totalAmountAfterDiscount: 140 },
] }
test('an invoice loaded before backend refresh shows original book value rather than a false zero', () => {
  const selected = getReturnSelection(invoice, { 327: 1 })
  assert.equal(selected[0].returnValue, 260)
  assert.equal(selected[1].returnValue, 0)
  assert.equal(supportsItemReturns(invoice), false)
})
test('invoice discounts apply to partial quantities and the exact remainder follows on the next return', () => {
  const discounted = { totalAmountAfterDiscounts: 10, items: [{ id: 1, quantity: 3, totalAmountAfterDiscount: 12, returnedQuantity: 0, returnLineValue: 10 }] }
  assert.equal(supportsItemReturns(discounted), true)
  assert.equal(getReturnSelection(discounted, { 1: 1 })[0].returnValue, 3.33)
  discounted.items[0].returnedQuantity = 1
  assert.equal(getReturnSelection(discounted, { 1: 2 })[0].returnValue, 6.67)
})
test('a genuinely free line remains zero and missing price data is unavailable rather than zero', () => {
  assert.equal(getReturnSelection({ totalAmountAfterDiscounts: 0, items: [{ id: 1, quantity: 1, totalAmountAfterDiscount: 0, returnLineValue: 0 }] }, { 1: 1 })[0].returnValue, 0)
  assert.equal(getReturnSelection({ items: [{ id: 1, quantity: 1 }] }, { 1: 1 })[0].returnValue, null)
})

test('the returns table displays library account reduction instead of a hard-coded zero', async () => {
  const { getReturnBreakdown } = await import('../src/utils/returnSelection.js')
  const library = { paymentType: 'WHOLESALE_CREDIT', returnHistory: [{ value: 109.25, cashAmount: 59 }] }
  assert.deepEqual(getReturnBreakdown(library), { value: 109.25, cash: 59, accountReduction: 50.25 })
  assert.equal(getReturnBreakdown({ ...library, returnHistory: [{ value: 100, cashAmount: 50 }] }).accountReduction, 50)
  assert.equal(getReturnBreakdown({ paymentType: 'DIRECT', returnHistory: [{ value: 100, cashAmount: 100 }] }).accountReduction, null)
  assert.equal(getReturnBreakdown({ paymentType: 'GIFT', totalAmountAfterDiscounts: 100 }).cash, 0)
  assert.equal(getReturnBreakdown({ paymentType: 'WHOLESALE_CREDIT', totalAmountAfterDiscounts: 110 }).accountReduction, null)
})
