import { calculateReportTotals, mergeReportInvoices } from '../utils/reportTotals.js'
import { getInvoicePaidAmount, getInvoiceRemainingAmount } from '../utils/invoicePayments.js'
import { libraryEntryLabels } from '../utils/libraryAccounts.js'
import { accountSummary, couponReceipts, invoiceSummary, periodRows, statement } from './accounts.js'
import { DemoError } from './errors.js'

const titles = { DASHBOARD: 'نظرة عامة', DAILY: 'التقرير اليومي', DIRECT_CASH: 'البيع النقدي', DIRECT_VISA: 'البيع بالفيزا', COUPONS: 'الكوبونات', GIFTS: 'الهدايا', REFUNDS: 'المرتجعات', LOCAL_CURRENCY: 'العملة المحلية', DOLLAR: 'الدولار' }
const methods = { CASH: 'نقدي', VISA: 'فيزا', COUPON: 'كوبون' }
const types = { DIRECT: 'مباشر', WHOLESALE_CREDIT: 'مكتبة', GIFT: 'هدية' }
const labels = { invoiceValue: 'قيمة الفواتير بيع وهدايا', sales: 'قيمة فواتير البيع فقط', collected: 'المحصل فعلياً', cashCollected: 'إجمالي الدفع النقدي', visaCollected: 'إجمالي الدفع بالفيزا', gifts: 'قيمة الهدايا', returnedValue: 'قيمة كتب البيع المرتجعة', returnedGifts: 'قيمة الهدايا المرتجعة', refunds: 'المبالغ المردودة فعلياً', netCollected: 'صافي التحصيل', couponPending: 'كوبونات مستحقة على المعرض' }
const tone = key => /refund|returned/i.test(key) ? 'FFB63B32' : /net|collected/i.test(key) ? 'FF287253' : /pending|balance/i.test(key) ? 'FF946600' : 'FF013660'

function addTable(workbook, name, headers, rows, widths = []) {
  const sheet = workbook.addWorksheet(name, { views: [{ rightToLeft: true, state: 'frozen', ySplit: 2 }] })
  sheet.mergeCells(1, 1, 1, headers.length)
  sheet.getCell(1, 1).value = name; sheet.getRow(1).height = 30
  sheet.getRow(2).values = headers
  sheet.columns.forEach((column, index) => { column.width = widths[index] || 24 })
  for (const values of rows) sheet.addRow(values)
  sheet.eachRow((row, index) => {
    row.height = index <= 2 ? 30 : Math.max(28, ...row.values.map(v => typeof v === 'string' ? Math.min(110, Math.ceil(v.length / 35) * 18) : 28))
    row.eachCell({ includeEmpty: true }, cell => {
      cell.font = { name: 'Arial', size: 11, color: { argb: index <= 2 ? 'FFFFFFFF' : 'FF273238' }, bold: index <= 2 }
      cell.alignment = { horizontal: 'right', vertical: 'middle', wrapText: true }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: index <= 2 ? 'FF013660' : index % 2 ? 'FFFFFFFF' : 'FFFAF9F6' } }
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFDEDBD3' } } }
      if (typeof cell.value === 'number') { cell.numFmt = '#,##0.00'; cell.font.color = { argb: cell.value === 0 ? 'FF667075' : 'FF013660' } }
    })
  })
  if (rows.length) sheet.autoFilter = { from: { row: 2, column: 1 }, to: { row: rows.length + 2, column: headers.length } }
  sheet.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
  return sheet
}
function invoiceRows(rows) {
  return rows.map(i => [i.invoiceNumber, i.businessDate, types[i.paymentType], methods[i.paymentMethod] || '—', i.currency,
    i.totalAmountAfterDiscounts, i.paymentType === 'WHOLESALE_CREDIT' ? 'على الحساب' : getInvoicePaidAmount(i),
    i.paymentType === 'WHOLESALE_CREDIT' ? 'راجع كشف حساب المكتبة' : getInvoiceRemainingAmount(i),
    i.items.map(item => `${item.bookName} × ${item.quantity}`).join('\n'), i.notes || '—'])
}
const invoiceHeaders = ['رقم الفاتورة', 'تاريخ الفاتورة', 'نوع البيع', 'طريقة الدفع', 'العملة', 'قيمة الفاتورة بعد الخصومات', 'المدفوع', 'المتبقي', 'الكتب والكميات', 'ملاحظات الفاتورة']

export async function exportWorkbook(state, url, paginate) {
  const ExcelJS = await import('exceljs')
  const workbook = new (ExcelJS.default || ExcelJS).Workbook()
  workbook.creator = 'Tanmia POS Demo'
  const params = url.searchParams, fairId = Number(params.get('bookFairId'))
  const fair = state.fairs.find(f => f.id === fairId)
  if (!fair) throw new DemoError('المعرض غير موجود', 404)
  const libraryMatch = url.pathname.match(/^\/libraries\/(\d+)\/export$/)
  if (libraryMatch) {
    const library = state.libraries.find(l => l.id === Number(libraryMatch[1]) && l.bookFairId === fairId)
    if (!library) throw new DemoError('المكتبة غير موجودة', 404)
    const currency = params.get('currency'), type = params.get('exportType') || 'statement'
    const filter = new URLSearchParams(params)
    if (params.get('date')) { filter.set('from', params.get('date')); filter.set('to', params.get('date')) }
    filter.set('page', '0'); filter.set('size', String(Number.MAX_SAFE_INTEGER))
    const data = statement(state, library, fairId, currency, filter, paginate)
    addTable(workbook, 'نطاق التصدير', ['المكتبة', 'العملة', 'من تاريخ', 'إلى تاريخ', 'نوع السجلات'], [[library.name, currency, filter.get('from') || 'من بداية الحساب', filter.get('to') || 'حتى آخر حركة', { statement: 'كشف الحساب', invoices: 'الفواتير', payments: 'الدفعات' }[type]]])
    if (type === 'statement') {
      addTable(workbook, 'كشف الحساب', ['التاريخ', 'الحركة', 'مرجع الفاتورة', 'مدين', 'دائن', 'الرصيد بعد الحركة', 'تفاصيل الحركة'], data.entries.content.map(({entry:e,balance,invoiceNumber}) => [e.entryDate, libraryEntryLabels[e.entryType] || e.entryType, invoiceNumber || (e.paymentId ? `دفعة #${e.paymentId}` : 'على الحساب'), e.debit, e.credit, balance, e.description || '—']))
      addTable(workbook, 'ملخص الفترة', ['رصيد أول الفترة', 'إجمالي المدين', 'إجمالي الدائن', 'رصيد آخر الفترة'], [[data.openingBalance, data.totalDebit, data.totalCredit, data.closingBalance]])
    } else if (type === 'invoices') {
      const rows = periodRows(state.invoices.filter(i => i.libraryId === library.id && i.bookFairId === fairId && i.currency === currency && !i.deleted), 'businessDate', params)
      addTable(workbook, 'فواتير المكتبة', invoiceHeaders, invoiceRows(rows))
    } else if (type === 'payments') {
      const rows = periodRows(state.payments.filter(p => p.libraryId === library.id && p.bookFairId === fairId && p.currency === currency), 'paidAt', params)
      addTable(workbook, 'دفعات المكتبة', ['رقم الدفعة', 'تاريخ الدفع', 'طريقة الدفع', 'العملة', 'المبلغ', 'ملاحظات'], rows.map(p => [p.id, p.paidAt, methods[p.paymentMethod], p.currency, p.amount, p.notes || '—']))
    } else throw new DemoError('نوع التصدير غير صحيح')
    const summary = accountSummary(state, library.id, fairId, currency)
    addTable(workbook, 'ملخص الحساب الكامل', ['قيمة الفواتير', 'المدفوع', 'قيمة الكتب المرتجعة', 'النقد المردود', 'الرصيد الحالي'], [[summary.totalInvoices, summary.totalPaid, summary.totalReturns, summary.totalRefunded, summary.balance]])
  } else {
    const type = params.get('reportType'), date = type === 'DAILY' ? params.get('date') : null
    if (!titles[type]) throw new DemoError('صدّر بيانات المكتبات من حسابات المكتبات')
    const currency = params.get('currency') || (type === 'DOLLAR' ? 'USD' : type === 'LOCAL_CURRENCY' ? fair.primaryCurrency : null)
    const paymentType = type === 'GIFTS' ? 'GIFT' : ['DIRECT_CASH', 'DIRECT_VISA', 'COUPONS'].includes(type) ? 'DIRECT' : null
    const method = type === 'DIRECT_CASH' ? 'CASH' : type === 'DIRECT_VISA' ? 'VISA' : type === 'COUPONS' ? 'COUPON' : null
    const all = state.invoices.filter(i => i.bookFairId === fairId && !i.deleted && i.paymentType !== 'WHOLESALE_CREDIT').map(invoiceSummary)
    let invoices = mergeReportInvoices(all.filter(i => (!currency || i.currency === currency) && (!paymentType || i.paymentType === paymentType) && (!method || i.paymentMethod === method) && (!date || i.businessDate === date)), all.filter(i => i.refundAt), { currency, paymentType, paymentMethod: method, date })
    if (type === 'REFUNDS') invoices = invoices.filter(i => i.refundAt)
    const receipts = ['GIFTS', 'REFUNDS'].includes(type) ? [] : couponReceipts(state, fairId, date).filter(r => (!currency || r.currency === currency) && (!['CASH','VISA'].includes(method) || r.collection.paymentMethod === method))
    const totals = calculateReportTotals(invoices, [], null, { daily: type === 'DAILY', date, couponReceipts: receipts, paymentMethod: method })
    addTable(workbook, titles[type], invoiceHeaders, invoiceRows(invoices))
    const keys = Object.keys(labels)
    const totalsSheet = addTable(workbook, 'الإجماليات', ['العملة', ...keys.map(k => labels[k])], totals.map(t => [t.currency, ...keys.map(k => t[k])]))
    totalsSheet.eachRow((row,index) => { if (index > 2) keys.forEach((key,j) => { row.getCell(j+2).font.color = { argb: tone(key) } }) })
    addTable(workbook, 'تفاصيل المرتجعات', ['رقم الفاتورة', 'العملة', 'تاريخ المرتجع', 'الكتب والكميات', 'قيمة الكتب المرتجعة', 'المبلغ المردود فعلياً', 'ملاحظات المرتجع'], invoices.flatMap(i => (i.returnHistory || []).filter(r => !date || r.date === date).map(r => [i.invoiceNumber, i.currency, r.date, r.items.map(item => `${item.bookName} × ${item.quantity}`).join('\n'), r.value, r.cashAmount, r.notes || '—'])))
    addTable(workbook, 'تحصيل الكوبونات', ['رقم الفاتورة', 'رقم التحصيل', 'تاريخ التحصيل', 'طريقة الاستلام', 'العملة', 'المبلغ المحصل', 'ملاحظات'], receipts.map(r => [r.invoiceNumber, r.collection.requestId, r.collection.paidAt, methods[r.collection.paymentMethod], r.currency, r.collection.amount, r.collection.notes || '—']))
    addTable(workbook, 'طريقة الحساب', ['البند', 'التوضيح'], [
      ['نطاق الملف', 'يشمل البيع المباشر والهدايا ومرتجعاتها؛ بيانات المكتبات تصدر من حسابات المكتبات.'],
      ['قيمة فواتير البيع', 'قيمة البيع بعد الخصومات؛ الإجمالي يطرح قيمة الكتب المرتجعة، واليومي يسجل البيع في يوم الفاتورة.'],
      ['المحصل فعلياً', 'النقدي والفيزا المستلمان، بما فيهما تحصيل الكوبونات في يوم الاستلام؛ الكوبون غير المحصل ليس نقداً.'],
      ['صافي التحصيل', 'المحصل فعلياً ناقص النقد المردود. قيمة الهدية لا تدخل التحصيل.'],
      ['مستحق الكوبونات', 'قيمة الكوبونات ناقص الكتب المرتجعة والتحصيلات مع إضافة النقد المردود.'],
    ], [26, 85])
  }
  return new Blob([await workbook.xlsx.writeBuffer()], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
