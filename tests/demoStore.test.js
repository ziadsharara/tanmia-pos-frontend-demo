import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { webcrypto } from 'node:crypto'
import { demoRequest, resetDemoData, exportDemoReport } from '../src/demo/store.js'
import { upgradeState } from '../src/demo/accounts.js'
import { businessToday } from '../src/utils/libraryAccounts.js'

const saved = new Map()
globalThis.localStorage = { getItem: key => saved.get(key) ?? null, setItem: (key,value) => saved.set(key,String(value)), removeItem: key => saved.delete(key) }
if (!globalThis.crypto) globalThis.crypto = webcrypto
const key = 'tanmia.pos.demo.data.v1'
const api = (path, data, method = 'POST') => demoRequest(path, { method, ...(data ? { body: JSON.stringify(data) } : {}) }).data
const get = path => api(path, null, 'GET')
const state = () => JSON.parse(saved.get(key))
const create = (method = 'CASH', extra = {}) => {
  const book = state().books.find(b => b.bookFairId === 2 && b.quantity > 10)
  return api('/invoices/create?bookFairId=2', { currency: 'LYD', paymentType: 'DIRECT', paymentMethod: method, items: [{bookId: book.id, quantity: 3}], ...extra })
}
beforeEach(() => { saved.clear(); resetDemoData() })

test('fresh seed supports coupon screens and return details without a server', () => {
  assert.equal(state().version, 6)
  assert.ok(get('/invoices/coupons?bookFairId=2').length)
  const invoice = get('/invoices/refund/all?bookFairId=2').content[0]
  assert.ok(invoice.returnHistory.length)
  assert.ok(invoice.items.every(i => i.returnLineValue != null))
})
test('v5 storage upgrade preserves visitor records and creates account receipts exactly once', () => {
  const existing = state(); existing.version = 5; delete existing.entries; delete existing.payments; delete existing.nextEntryId
  existing.invoices[0].notes = 'visitor note'
  saved.set(key, JSON.stringify(existing))
  get('/libraries/fetchAll?bookFairId=2')
  assert.equal(state().invoices.length, existing.invoices.length)
  assert.equal(state().invoices[0].notes, 'visitor note')
  const upgraded = state(), twice = upgradeState(structuredClone(upgraded))
  assert.deepEqual(twice, upgraded)
  assert.equal(state().version, 6)
})
test('a library return separates returned cash and debt reduction; editing date preserves account total', () => {
  const invoice = create(null, {paymentType:'WHOLESALE_CREDIT', libraryName:'Test library', notes:'original'})
  const full = invoice.totalAmountAfterDiscounts
  const receipt = {requestId:'library-pay',amount:full,paymentMethod:'CASH',currency:'LYD',paidAt:businessToday(),notes:'received'}
  api(`/libraries/${invoice.libraryId}/payments?bookFairId=2`, receipt)
  api(`/libraries/${invoice.libraryId}/payments?bookFairId=2`, receipt)
  assert.equal(get(`/libraries/${invoice.libraryId}/payments?bookFairId=2&currency=LYD`).totalElements,1)
  const value = invoice.items[0].returnLineValue / 3
  const request={requestId:'return-one',items:[{itemId:invoice.items[0].id,quantity:1}],refundAmount:0,notes:'returned note'}
  const returned=api(`/invoices/refund?bookFairId=2&invoiceNumber=${invoice.invoiceNumber}`,request)
  assert.equal(returned.notes,'original')
  assert.equal(returned.returnHistory[0].notes,'returned note')
  const statement=get(`/libraries/${invoice.libraryId}/statement?bookFairId=2&currency=LYD`)
  assert.equal(statement.accountSummary.balance,-Math.round(value*100)/100)
  assert.equal(statement.accountSummary.totalRefunded,0)
  assert.ok(statement.entries.content.some(r=>r.entry.entryType==='RETURN'&&r.entry.credit>0))
  const changed=api(`/invoices/${invoice.id}/returns/return-one?bookFairId=2`,{...request,requestId:'edit-one',expectedRevision:0,date:businessToday(),items:[{itemId:invoice.items[0].id,quantity:2}],notes:'edited'},'PUT')
  assert.equal(changed.returnHistory[0].revision,1)
  assert.equal(changed.returnHistory[0].revisions[0].notes,'returned note')
  assert.equal(changed.items[0].returnedQuantity,2)
})
test('coupon single and bulk partial collection reconcile, retries do not double post or touch USD', () => {
  const first=create('COUPON'), second=create('COUPON'), usd=create('COUPON',{currency:'USD'})
  const due=second.totalAmountAfterDiscounts
  const request={requestId:'single',amount:Math.min(5,due),paymentMethod:'VISA',paidAt:businessToday(),notes:'coupon'}
  api(`/invoices/${second.id}/coupon-collections?bookFairId=2`,request)
  api(`/invoices/${second.id}/coupon-collections?bookFairId=2`,request)
  assert.equal(get(`/invoices/${second.id}?bookFairId=2`).couponCollections.length,1)
  assert.equal(get(`/invoices/${first.id}?bookFairId=2`).couponCollections.length,0)
  assert.equal(get(`/invoices/${usd.id}?bookFairId=2`).couponCollections.length,0)
  const receipts=get('/invoices/coupon-collections?bookFairId=2')
  assert.equal(receipts.filter(r=>r.collection.requestId==='single').length,1)
  assert.throws(()=>api(`/invoices/${second.id}/coupon-collections?bookFairId=2`,{...request,amount:due+1,requestId:'excess'}))
  const bulk={...request,requestId:'batch',amount:10}
  const result=api('/invoices/coupon-collections?bookFairId=2&currency=LYD',bulk)
  assert.equal(result.reduce((sum,r)=>sum+r.collection.amount,0),10)
  const before=JSON.stringify(state())
  api('/invoices/coupon-collections?bookFairId=2&currency=LYD',bulk)
  assert.equal(JSON.stringify(state()),before)
})
test('invalid returns roll back stock; partial return and edit only restore their quantities', () => {
  const invoice=create(), item=invoice.items[0]
  const before=state().books.find(b=>b.id===item.bookId).quantity
  assert.throws(()=>api(`/invoices/refund?bookFairId=2&invoiceNumber=${invoice.invoiceNumber}`,{requestId:'invalid',items:[{itemId:item.id,quantity:4}]}))
  assert.equal(state().books.find(b=>b.id===item.bookId).quantity,before)
  const request={requestId:'partial',items:[{itemId:item.id,quantity:1}],notes:'test'}
  api(`/invoices/refund?bookFairId=2&invoiceNumber=${invoice.invoiceNumber}`,request)
  assert.equal(state().books.find(b=>b.id===item.bookId).quantity,before+1)
  api(`/invoices/${invoice.id}/returns/partial?bookFairId=2`,{...request,requestId:'edit',expectedRevision:0,items:[{itemId:item.id,quantity:2}]},'PUT')
  assert.equal(state().books.find(b=>b.id===item.bookId).quantity,before+2)
  assert.throws(()=>api(`/invoices/${invoice.id}/returns/partial?bookFairId=2`,{...request,requestId:'stale',expectedRevision:0},'PUT'))
})
test('all three library exports and coupon export are real workbooks with filter metadata', async () => {
  const {default:ExcelJS}=await import('exceljs')
  for (const type of ['statement','invoices','payments']) {
    const blob=await exportDemoReport(`/libraries/1/export?bookFairId=2&currency=LYD&exportType=${type}&from=2000-01-01&to=${businessToday()}`)
    const wb=new ExcelJS.Workbook();await wb.xlsx.load(await blob.arrayBuffer())
    assert.equal(wb.getWorksheet('نطاق التصدير').getCell('A3').value,'مكتبة طرابلس')
    assert.equal(wb.getWorksheet('نطاق التصدير').getCell('C3').value,'2000-01-01')
    assert.ok(wb.getWorksheet('ملخص الحساب الكامل'))
  }
  const wb=new ExcelJS.Workbook(); await wb.xlsx.load(await (await exportDemoReport('/reports/export?bookFairId=2&reportType=COUPONS')).arrayBuffer())
  assert.ok(wb.getWorksheet('تحصيل الكوبونات'))
  assert.ok(wb.getWorksheet('تفاصيل المرتجعات'))
  assert.ok(wb.getWorksheet('طريقة الحساب'))
})

test('invoice stock changes remain scoped to the chosen fair even when catalog IDs overlap', () => {
  const before=state()
  create()
  assert.deepEqual(state().books.filter(b=>b.bookFairId!==2),before.books.filter(b=>b.bookFairId!==2))
})
test('library statement period has a real opening balance and consistent pagination', () => {
  const all=get('/libraries/1/statement?bookFairId=2&currency=LYD&size=100')
  const first=get('/libraries/1/statement?bookFairId=2&currency=LYD&size=1&page=0')
  const second=get('/libraries/1/statement?bookFairId=2&currency=LYD&size=1&page=1')
  assert.equal(first.entries.content[0].balance,all.entries.content[0].balance)
  assert.equal(second.entries.content[0].balance,all.entries.content[1].balance)
  const filtered=get(`/libraries/1/statement?bookFairId=2&currency=LYD&from=${businessToday()}&to=${businessToday()}`)
  assert.equal(filtered.closingBalance,Math.round((filtered.openingBalance+filtered.totalDebit-filtered.totalCredit)*100)/100)
})
test('a return date correction records old-day reversal and new-day postings without changing overall library balance', () => {
  const invoice=create(null,{paymentType:'WHOLESALE_CREDIT',libraryName:'Date library'})
  const data=state();const stored=data.invoices.find(i=>i.id===invoice.id);stored.businessDate='2026-01-01'
  data.libraries.find(l=>l.id===invoice.libraryId).accountOpenedAt='2026-01-01'
  data.entries.find(e=>e.invoiceId===invoice.id).entryDate='2026-01-01';saved.set(key,JSON.stringify(data))
  const request={requestId:'dated-return',items:[{itemId:invoice.items[0].id,quantity:1}],refundAmount:0,notes:'before'}
  api(`/invoices/refund?bookFairId=2&invoiceNumber=${invoice.invoiceNumber}`,request)
  const before=get(`/libraries/${invoice.libraryId}/statement?bookFairId=2&currency=LYD`).closingBalance
  const changed=api(`/invoices/${invoice.id}/returns/dated-return?bookFairId=2`,{...request,requestId:'move-date',expectedRevision:0,date:'2026-01-02'},'PUT')
  const after=get(`/libraries/${invoice.libraryId}/statement?bookFairId=2&currency=LYD`)
  assert.equal(after.closingBalance,before)
  assert.equal(changed.returnHistory[0].date,'2026-01-02')
  assert.equal(changed.returnHistory[0].revisions[0].date,businessToday())
  const oldDay=get(`/libraries/${invoice.libraryId}/statement?bookFairId=2&currency=LYD&from=${businessToday()}&to=${businessToday()}`)
  assert.equal(oldDay.totalDebit,oldDay.totalCredit)
})
