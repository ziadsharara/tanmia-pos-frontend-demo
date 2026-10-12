import { formatMoney } from '../../utils/currency.js'
import { getInvoicePaidAmount, getInvoiceRemainingAmount } from '../../utils/invoicePayments.js'
import { Icon } from '../ui/Icon.jsx'
import { InvoiceBookCodes, InvoiceBookNames } from './InvoiceBooks.jsx'

const typeLabels = { DIRECT: 'مباشر', WHOLESALE_CREDIT: 'آجل', GIFT: 'هدية' }
const statusLabels = { PAID: 'مدفوعة', UNPAID: 'غير مدفوعة', PARTIALLY_PAID: 'مدفوعة جزئياً', NO_PAYMENT_REQUIRED: 'بدون دفع', REFUND: 'مرتجعة' }

export function InvoicesTable({ invoices, pageData, loading, detailLoading, deletingInvoiceId, recordingPaymentId, localCurrency, showBooks = false, dateField = 'businessDate', dateLabel = 'التاريخ', onOpenInvoice, onDeleteInvoice, onRecordPayment, onPreviousPage, onNextPage }) {
  return (
    <>
      <div className={`table-wrap catalog-table-wrap history-table-wrap ${loading ? 'catalog-table-wrap--loading' : ''}`}>
        <table className={`history-table ${showBooks ? 'history-table--with-books' : ''} ${onDeleteInvoice ? 'history-table--invoices' : 'history-table--reports'}`}>
          <thead><tr><th>رقم الفاتورة</th>{showBooks && <><th>أسماء الكتب</th><th>أكواد الكتب</th></>}<th>{dateLabel}</th><th>نوع البيع</th><th>الحالة</th><th>المكتبة</th><th>قيمة الكتب</th><th>المدفوع</th><th>المتبقي</th><th>إجراء</th></tr></thead>
          <tbody>{invoices.map((invoice) => {
            const remaining = getInvoiceRemainingAmount(invoice)
            const canRecordPayment = onRecordPayment && invoice.paymentType === 'WHOLESALE_CREDIT' && invoice.paymentStatus !== 'REFUND' && remaining > 0
            const actionBusy = detailLoading || deletingInvoiceId != null || recordingPaymentId != null
            return <tr key={invoice.id}><td data-label="رقم الفاتورة" className="code-cell invoice-number-cell" dir="ltr">{invoice.invoiceNumber}</td>{showBooks && <><td data-label="الكتب" className="invoice-book-names-cell"><InvoiceBookNames books={invoice.books} /></td><td data-label="الأكواد" className="invoice-book-codes-cell"><InvoiceBookCodes books={invoice.books} /></td></>}<td data-label={dateLabel}>{invoice[dateField] || '—'}</td><td data-label="نوع البيع">{typeLabels[invoice.paymentType] || invoice.paymentType}</td><td data-label="الحالة"><span className={`invoice-status invoice-status--${invoice.paymentStatus?.toLowerCase()}`}>{statusLabels[invoice.paymentStatus] || invoice.paymentStatus}</span></td><td data-label="المكتبة">{invoice.libraryName || '—'}</td><td data-label="قيمة الكتب" className="history-money-cell" dir="ltr">{formatMoney(invoice.totalAmountAfterDiscounts, invoice.currency, localCurrency)}</td><td data-label="المدفوع" className="history-money-cell" dir="ltr"><strong>{formatMoney(getInvoicePaidAmount(invoice), invoice.currency, localCurrency)}</strong></td><td data-label="المتبقي" className="history-money-cell" dir="ltr"><strong>{formatMoney(remaining, invoice.currency, localCurrency)}</strong></td><td data-label="الإجراء"><div className="catalog-row-actions"><button className="button button--table" type="button" disabled={actionBusy} onClick={() => onOpenInvoice(invoice.id)}><Icon name="eye" size={16} />فتح</button>{onDeleteInvoice && <button className="button button--table-danger" type="button" disabled={actionBusy} onClick={() => onDeleteInvoice(invoice)}>{deletingInvoiceId === invoice.id ? <span className="spinner" /> : <Icon name="trash" size={16} />}{deletingInvoiceId === invoice.id ? 'جاري الحذف...' : 'حذف'}</button>}{canRecordPayment && <button className="button button--table-payment" type="button" disabled={actionBusy} onClick={() => onRecordPayment(invoice)}>{recordingPaymentId === invoice.id ? <span className="spinner" /> : <Icon name="payment" size={16} />}{recordingPaymentId === invoice.id ? 'جاري...' : 'دفع'}</button>}</div></td></tr>
          })}</tbody>
        </table>
      </div>
      <div className="pagination"><span>صفحة <strong>{pageData.number + 1}</strong> من <strong>{pageData.totalPages}</strong></span><div><button className="button button--secondary" type="button" disabled={pageData.number === 0 || loading} onClick={onPreviousPage}><Icon name="next" size={16} />السابق</button><button className="button button--secondary" type="button" disabled={pageData.last || loading} onClick={onNextPage}>التالي<Icon name="previous" size={16} /></button></div></div>
    </>
  )
}
