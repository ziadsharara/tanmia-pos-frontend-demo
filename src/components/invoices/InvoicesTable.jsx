import { useEffect, useState } from 'react'
import { InvoiceNotesModal } from './InvoiceNotesModal.jsx'
import { TablePagination } from '../ui/TablePagination.jsx'
import { formatMoney } from '../../utils/currency.js'
import { getInvoicePaidAmount, getInvoiceRemainingAmount } from '../../utils/invoicePayments.js'
import { Icon } from '../ui/Icon.jsx'
import { InvoiceBookAmounts, InvoiceBookCodes, InvoiceBookNames, InvoiceBookQuantities, ReportMoney } from './InvoiceBooks.jsx'

const typeLabels = { DIRECT: 'مباشر', WHOLESALE_CREDIT: 'آجل', GIFT: 'هدية' }
const methodLabels = { CASH: 'نقدي', VISA: 'فيزا', COUPON: 'كوبون — يُحصّل آخر المعرض' }
const statusLabels = { PAID: 'مدفوعة', UNPAID: 'غير مدفوعة', PARTIALLY_PAID: 'مدفوعة جزئياً', NO_PAYMENT_REQUIRED: 'بدون دفع', REFUND: 'مرتجعة', ON_ACCOUNT: 'على الحساب' }

function paymentMethodLabel(invoice) {
  if (invoice.paymentType !== 'DIRECT' || !invoice.paymentMethod) return '—'
  return methodLabels[invoice.paymentMethod] || invoice.paymentMethod
}

function libraryAccountLink(invoice) {
  const params = new URLSearchParams({ currency: invoice.currency })
  if (invoice.libraryId) params.set('libraryId', String(invoice.libraryId))
  else if (invoice.libraryName) params.set('libraryName', invoice.libraryName)
  return `#libraries?${params}`
}

export function InvoicesTable({ isActive = true, invoices, pageData, loading, detailLoading, editingInvoiceId, deletingInvoiceId, localCurrency, showBooks = false, showNotes = false, showBookAmounts = false, dailyReport = false, reportDate, dateField = 'businessDate', dateLabel = 'التاريخ', onOpenInvoice, onCollectCoupon, onEditInvoice, onDeleteInvoice, onPreviousPage, onNextPage }) {
  const [notesInvoice, setNotesInvoice] = useState(null)
  useEffect(() => { if (!isActive) setNotesInvoice(null) }, [isActive])
  return (
    <>
      {notesInvoice && isActive && <InvoiceNotesModal invoice={notesInvoice} onClose={() => setNotesInvoice(null)} />}
      <TablePagination page={pageData.number} totalPages={pageData.totalPages} hasNext={!pageData.last} loading={loading} onPrevious={onPreviousPage} onNext={onNextPage} ariaLabel="صفحات الفواتير" summary={showBookAmounts ? <>عرض <strong><bdi dir="ltr">{pageData.number * pageData.size + 1}–{pageData.number * pageData.size + invoices.length}</bdi></strong> من <strong>{pageData.totalElements}</strong> فاتورة</> : undefined} hint={showBookAmounts ? 'مرّر أفقياً لباقي الأعمدة' : undefined} />
      <div className={`table-wrap catalog-table-wrap history-table-wrap ${showBookAmounts ? 'report-table-wrap' : ''} ${loading ? 'catalog-table-wrap--loading' : ''}`}>
        <table className={`history-table ${showBooks ? 'history-table--with-books' : ''} ${onDeleteInvoice ? 'history-table--invoices' : 'history-table--reports'}`}>
          {showNotes && showBooks && !showBookAmounts && <colgroup><col style={{ width: '10%' }} /><col style={{ width: '11%' }} /><col style={{ width: '9%' }} /><col style={{ width: '7%' }} /><col style={{ width: '4%' }} /><col style={{ width: '4%' }} /><col style={{ width: '6%' }} /><col style={{ width: '7%' }} /><col /><col /><col /><col style={{ width: '8%' }} /><col style={{ width: 132 }} /></colgroup>}
          <thead><tr><th>رقم الفاتورة</th>{showBooks && <><th>أسماء الكتب</th><th>أكواد الكتب</th>{showBookAmounts && <><th>الكمية</th><th>سعر الوحدة قبل الخصم</th><th>إجمالي الكتاب قبل الخصم</th></>}</>}<th>{dateLabel}</th><th>نوع البيع</th><th>طريقة الدفع</th><th>الحالة</th><th>المكتبة</th><th>{showBookAmounts ? 'إجمالي الفاتورة بعد الخصم' : 'قيمة الكتب'}</th><th>{dailyReport ? 'صافي التحصيل في اليوم' : 'المدفوع'}</th><th>المتبقي</th>{showNotes && <th>ملاحظات الفاتورة</th>}<th className="table-actions-cell">إجراء</th></tr></thead>
          <tbody>{invoices.map((invoice) => {
            const remaining = getInvoiceRemainingAmount(invoice)
            const history = invoice.returnHistory?.length ? invoice.returnHistory : invoice.paymentStatus === 'REFUND'
              ? [{ date: invoice.refundAt, cashAmount: invoice.paymentType === 'WHOLESALE_CREDIT' ? Number(invoice.libraryRefundAmount || 0) : getInvoicePaidAmount(invoice) }] : []
            const dailyRefund = history.filter(r => r.date === reportDate).reduce((sum, r) => sum + Number(r.cashAmount), 0)
            const paid = dailyReport ? (invoice.paymentMethod === 'COUPON' ? (invoice.couponCollections || []).filter(c => c.paidAt === reportDate).reduce((sum, c) => sum + Number(c.amount), 0) : invoice.businessDate === reportDate ? getInvoicePaidAmount(invoice) : 0) - dailyRefund : getInvoicePaidAmount(invoice)
            const actionBusy = detailLoading || editingInvoiceId != null || deletingInvoiceId != null
            return <tr key={invoice.id}><td data-label="رقم الفاتورة" className="code-cell invoice-number-cell" dir="ltr">{invoice.invoiceNumber}</td>{showBooks && <><td data-label="الكتب" className="invoice-book-names-cell"><InvoiceBookNames books={invoice.books} /></td><td data-label="الأكواد" className="invoice-book-codes-cell"><InvoiceBookCodes books={invoice.books} /></td>{showBookAmounts && <><td data-label="الكمية" className="invoice-book-quantities-cell"><InvoiceBookQuantities books={invoice.books} /></td><td data-label="سعر الوحدة قبل الخصم" className="history-money-cell invoice-book-amounts-cell"><InvoiceBookAmounts books={invoice.books} currency={invoice.currency} localCurrency={localCurrency} /></td><td data-label="إجمالي الكتاب قبل الخصم" className="history-money-cell invoice-book-amounts-cell"><InvoiceBookAmounts books={invoice.books} currency={invoice.currency} localCurrency={localCurrency} total /></td></>}</>}<td data-label={dateLabel}>{dailyReport && invoice.refundAt ? <><span>{invoice.businessDate || '—'}</span><small className="invoice-return-date">المرتجع: {invoice.refundAt || '—'}</small></> : invoice[dateField] || '—'}</td><td data-label="نوع البيع">{typeLabels[invoice.paymentType] || invoice.paymentType}</td><td data-label="طريقة الدفع">{paymentMethodLabel(invoice)}</td><td data-label="الحالة"><span className={`invoice-status invoice-status--${invoice.refundAt ? 'refund' : invoice.paymentStatus?.toLowerCase()}`}>{invoice.refundAt && invoice.paymentStatus !== 'REFUND' ? 'مرتجع جزئي' : invoice.paymentType === 'WHOLESALE_CREDIT' && invoice.paymentStatus !== 'REFUND' ? 'على الحساب' : statusLabels[invoice.paymentStatus] || invoice.paymentStatus}</span></td><td data-label="المكتبة" className="invoice-library-cell">{invoice.libraryName || '—'}</td><td data-label={showBookAmounts ? "إجمالي الفاتورة بعد الخصم" : "قيمة الكتب"} className={`history-money-cell money--${invoice.paymentType === 'GIFT' ? 'gift' : 'sale'}`} dir="ltr">{showBookAmounts ? <ReportMoney tone={invoice.paymentType === 'GIFT' ? 'gift' : 'sale'} value={invoice.totalAmountAfterDiscounts} currency={invoice.currency} localCurrency={localCurrency} /> : formatMoney(invoice.totalAmountAfterDiscounts, invoice.currency, localCurrency)}</td><td data-label={dailyReport ? "صافي التحصيل في اليوم" : "المدفوع"} className={`history-money-cell money--${paid < 0 ? 'refund' : paid === 0 ? 'zero' : invoice.paymentMethod === 'VISA' ? 'visa' : 'received'}`} dir="ltr"><strong>{invoice.paymentType === 'WHOLESALE_CREDIT' && !(dailyReport && invoice.refundAt) ? <span dir="rtl">على الحساب</span> : showBookAmounts ? <ReportMoney tone={paid < 0 ? 'refund' : invoice.paymentMethod === 'VISA' ? 'visa' : 'received'} value={paid} currency={invoice.currency} localCurrency={localCurrency} /> : formatMoney(paid, invoice.currency, localCurrency)}</strong></td><td data-label="المتبقي" className={`history-money-cell money--${remaining < 0 ? 'received' : remaining === 0 ? 'zero' : 'debt'}`} dir="ltr"><strong>{invoice.paymentType === 'WHOLESALE_CREDIT' ? <a className="button button--table" href={libraryAccountLink(invoice)} aria-label={`كشف حساب ${invoice.libraryName || 'المكتبة'}`} dir="rtl"><Icon name="history" size={15} />كشف الحساب</a> : showBookAmounts ? <ReportMoney tone={remaining < 0 ? 'received' : 'debt'} value={remaining} currency={invoice.currency} localCurrency={localCurrency} /> : formatMoney(remaining, invoice.currency, localCurrency)}</strong>{invoice.paymentMethod === 'COUPON' && <><small>مستحق على إدارة المعرض</small>{onCollectCoupon && remaining > 0 && <button type="button" className="invoice-note-button coupon-collect-row" disabled={actionBusy} onClick={() => onCollectCoupon(invoice.id)} aria-label={`تحصيل كوبون ${invoice.invoiceNumber}`}>تحصيل الكوبون</button>}</>}</td><>{showNotes && <td data-label="ملاحظات الفاتورة" className="invoice-notes-cell">{invoice.notes ? <button className="invoice-note-button" type="button" aria-label={`عرض ملاحظة الفاتورة ${invoice.invoiceNumber}`} onClick={() => setNotesInvoice(invoice)}>عرض الملاحظة</button> : '—'}</td>}</><td data-label="الإجراء" className="table-actions-cell"><div className="table-actions" role="group" aria-label={`إجراءات الفاتورة ${invoice.invoiceNumber}`}>
              <button className="table-action" type="button" aria-label="فتح" title="عرض الفاتورة" disabled={actionBusy} onClick={() => onOpenInvoice(invoice.id)}><Icon name="eye" size={17} /></button>
              {onEditInvoice && <button className="table-action" type="button" aria-label="تعديل" title={invoice.paymentStatus === 'REFUND' ? 'الفاتورة المرتجعة لا يمكن تعديلها' : 'تعديل الفاتورة'} disabled={actionBusy || Boolean(invoice.refundAt) || invoice.paymentStatus === 'REFUND'} onClick={() => onEditInvoice(invoice.id)}><Icon name="edit" size={17} /></button>}
              {onDeleteInvoice && <button className="table-action table-action--danger" type="button" aria-label="حذف" title={invoice.returnHistory?.length && invoice.paymentType !== 'WHOLESALE_CREDIT' ? 'الفاتورة لها سجل مرتجعات محفوظ ولا يمكن حذفها' : 'حذف الفاتورة'} disabled={actionBusy || (invoice.paymentType !== 'WHOLESALE_CREDIT' && Boolean(invoice.returnHistory?.length))} onClick={() => onDeleteInvoice(invoice)}>{deletingInvoiceId === invoice.id ? <span className="spinner" /> : <Icon name="trash" size={17} />}</button>}
            </div></td></tr>
          })}</tbody>
        </table>
      </div>
    </>
  )
}
