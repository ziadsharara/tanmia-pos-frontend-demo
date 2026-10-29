import test from 'node:test'
import assert from 'node:assert/strict'
import { collectibleCouponAmount, couponCollectionScope } from '../src/utils/couponCollections.js'

const coupon = { id: 1, businessDate: '2026-10-20', paymentMethod: 'COUPON', currency: 'LYD', totalAmountAfterDiscounts: 200 }
test('single collection targets only the chosen invoice, bulk scopes currency and excludes future or settled coupons', () => {
  const rows = [{ ...coupon, id: 8 }, { ...coupon, id: 2 }, { ...coupon, id: 3, currency: 'USD' }, { ...coupon, id: 4, paymentMethod: 'CASH' }, { ...coupon, id: 5, businessDate: '2026-10-26' }, { ...coupon, id: 6, couponCollections: [{ amount: 200, paidAt: '2026-10-21' }] }]
  assert.deepEqual(couponCollectionScope(rows, 'LYD', '2026-10-25').map(i => i.id), [2, 8])
  assert.deepEqual(couponCollectionScope(rows, 'LYD', '2026-10-25', '8').map(i => [i.id, i.collectible]), [[8, 200]])
  assert.deepEqual(couponCollectionScope(rows, 'LYD', '2026-10-25', '3'), [])
})
test('backdated collection never offers money already collected later', () => {
  assert.equal(collectibleCouponAmount({ ...coupon, couponCollections: [{ amount: 150, paidAt: '2026-10-25' }] }, '2026-10-21'), 50)
})
test('backdated collection is capped by historical balance even when a later cash refund increases current pending', () => {
  const invoice = { ...coupon, couponCollections: [{ amount: 150, paidAt: '2026-10-20' }], returnHistory: [{ date: '2026-10-22', value: 30, cashAmount: 50 }] }
  assert.equal(collectibleCouponAmount(invoice, '2026-10-21'), 50)
  assert.equal(collectibleCouponAmount(invoice, '2026-10-23'), 70)
  assert.equal(collectibleCouponAmount(invoice, '2026-10-19'), 0)
})
test('partial receipts and goods returns retain cents in the collectible balance', () => {
  assert.equal(collectibleCouponAmount({ ...coupon, totalAmountAfterDiscounts: 109.25, couponCollections: [{ amount: 50, paidAt: '2026-10-21' }], returnHistory: [{ value: 20.15, cashAmount: 0, date: '2026-10-22' }] }, '2026-10-25'), 39.1)
})
