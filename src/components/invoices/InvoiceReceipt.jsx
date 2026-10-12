import { Icon } from '../ui/Icon.jsx'
import tanmiaMark from '../../assets/brand/tanmia-mark.png'
import { formatMoney, getCurrencyName } from '../../utils/currency.js'

const paymentTypeLabels = { DIRECT: 'بيع مباشر', WHOLESALE_CREDIT: 'بيع آجل لمكتبة', GIFT: 'هدية' }
const paymentMethodLabels = { CASH: 'نقدي', VISA: 'فيزا' }
const paymentStatusLabels = { PAID: 'مدفوعة', UNPAID: 'غير مدفوعة', PARTIALLY_PAID: 'مدفوعة جزئياً', NO_PAYMENT_REQUIRED: 'لا تتطلب دفع', REFUND: 'مرتجعة' }

function printReceipt() {
  document.body.classList.add('printing-receipt')
  window.addEventListener('afterprint', () => {
    document.body.classList.remove('printing-receipt')
  }, { once: true })
  window.print()
}

export function InvoiceReceipt({ invoice, onClose, onBack, localCurrency, exhibitionName }) {
  if (!invoice) return null
  const isGift = invoice.paymentType === 'GIFT'
  const isWholesale = invoice.paymentType === 'WHOLESALE_CREDIT'

  return (
    <section className="receipt panel" aria-labelledby="receipt-title">
      <div className="receipt__actions no-print">
        {onBack && <button className="button button--secondary receipt__back" type="button" onClick={onBack}><span className="receipt__back-content"><span dir="rtl">رجوع</span><i className="receipt__back-arrow" aria-hidden="true" /></span></button>}
        {onClose && <button className="button button--secondary" type="button" onClick={onClose}>إغلاق</button>}
        <button className="button button--primary" type="button" onClick={printReceipt}><Icon name="print" size={18} />طباعة الفاتورة</button>
      </div>
      <header className="receipt__header">
        <div className="receipt__brand"><img src={tanmiaMark} alt="شعار تنمية" width="58" height="58" /><div><span className="eyebrow">دار تنمية للنشر والتوزيع</span><h1 id="receipt-title">فاتورة بيع</h1><p>{exhibitionName || 'نظام المعارض'} | نقطة البيع</p></div></div>
        <div className="receipt__number"><span>رقم الفاتورة</span><strong dir="ltr">{invoice.invoiceNumber}</strong><small>{invoice.businessDate}</small></div>
      </header>
      <div className="receipt__meta">
        <span><b>نوع البيع:</b> {paymentTypeLabels[invoice.paymentType] || invoice.paymentType}</span>
        <span><b>الحالة:</b> {paymentStatusLabels[invoice.paymentStatus] || invoice.paymentStatus}</span>
        {invoice.paymentMethod && <span><b>الدفع:</b> {paymentMethodLabels[invoice.paymentMethod] || invoice.paymentMethod}</span>}
        {invoice.libraryName && <span><b>المكتبة:</b> {invoice.libraryName}</span>}
        <span><b>العملة:</b> {getCurrencyName(invoice.currency, localCurrency)}</span>
      </div>
      <div className="table-wrap">
        <table className="receipt-table">
          <thead><tr><th>الكتاب</th><th>الكود</th><th>الكمية</th><th>سعر الوحدة</th><th>خصم الكتاب</th><th>الإجمالي</th></tr></thead>
          <tbody>{(invoice.items || []).map((item) => (
            <tr key={item.id || item.bookId}>
              <td data-label="الكتاب"><strong>{item.bookName}</strong><small>{item.bookAuthor}</small></td>
              <td data-label="الكود" className="code-cell" dir="ltr">{item.bookCode}</td>
              <td data-label="الكمية">{item.quantity}</td>
              <td data-label="سعر الوحدة" dir="ltr">{formatMoney(item.unitPrice, invoice.currency, localCurrency)}</td>
              <td data-label="خصم الكتاب"><span>{item.discountPercentage || 0}%</span><small>{formatMoney(item.fixedDiscountAmount, invoice.currency, localCurrency)}</small></td>
              <td data-label="الإجمالي" dir="ltr"><strong>{formatMoney(item.totalAmountAfterDiscount, invoice.currency, localCurrency)}</strong></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div className="receipt__totals">
        <div><span>الإجمالي قبل الخصم</span><strong dir="ltr">{formatMoney(invoice.totalAmountBeforeDiscount, invoice.currency, localCurrency)}</strong></div>
        <div><span>خصومات الكتب</span><strong dir="ltr">-{formatMoney(invoice.booksDiscountAmount, invoice.currency, localCurrency)}</strong></div>
        <div><span>بعد خصومات الكتب</span><strong dir="ltr">{formatMoney(invoice.subtotalAfterBookDiscounts, invoice.currency, localCurrency)}</strong></div>
        <div><span>خصم الفاتورة ({invoice.invoiceDiscountPercentage || 0}%)</span><strong dir="ltr">-{formatMoney(invoice.invoicePercentageDiscountAmount, invoice.currency, localCurrency)}</strong></div>
        <div><span>خصم ثابت للفاتورة</span><strong dir="ltr">-{formatMoney(invoice.invoiceFixedDiscountAmount, invoice.currency, localCurrency)}</strong></div>
        <div><span>قيمة الكتب المحسوبة</span><strong dir="ltr">{formatMoney(invoice.totalAmountAfterDiscounts, invoice.currency, localCurrency)}</strong></div>
        {isWholesale && <div><span>إجمالي المدفوع</span><strong dir="ltr">{formatMoney(invoice.libraryPartialPaymentAmount, invoice.currency, localCurrency)}</strong></div>}
        {isWholesale && <div><span>المتبقي على المكتبة</span><strong dir="ltr">{formatMoney(invoice.libraryRemainingPaymentAmount, invoice.currency, localCurrency)}</strong></div>}
        <div className="receipt__due"><span>{isGift ? 'المطلوب دفعه — هدية' : 'المبلغ المطلوب'}</span><strong dir="ltr">{formatMoney(invoice.amountDue, invoice.currency, localCurrency)}</strong></div>
      </div>
      {isWholesale && invoice.libraryPayments?.length > 0 && <div className="library-payment-history"><h2>سجل دفعات المكتبة</h2><div className="table-wrap"><table className="receipt-table"><thead><tr><th>تاريخ الدفع</th><th>طريقة الدفع</th><th>قيمة الدفعة</th></tr></thead><tbody>{invoice.libraryPayments.map((payment, index) => <tr key={payment.id || `${payment.paidAt}-${index}`}><td data-label="تاريخ الدفع">{payment.paidAt || '—'}</td><td data-label="طريقة الدفع">{paymentMethodLabels[payment.paymentMethod] || payment.paymentMethod || '—'}</td><td data-label="قيمة الدفعة" dir="ltr"><strong>{formatMoney(payment.amount, invoice.currency, localCurrency)}</strong></td></tr>)}</tbody></table></div></div>}
      {isGift && <p className="receipt__note">هذه هدية ولا تتطلب أي دفع. قيمة الكتب ظاهرة بشكل منفصل للمراجعة.</p>}
    </section>
  )
}
