import { Icon } from '../ui/Icon.jsx'
import tanmiaMark from '../../assets/brand/tanmia-mark.png'
import { formatMoney, getCurrencyName } from '../../utils/currency.js'

const paymentTypeLabels = { DIRECT: 'بيع مباشر', WHOLESALE_CREDIT: 'بيع آجل لمكتبة', GIFT: 'هدية' }
const paymentMethodLabels = { CASH: 'نقدي', VISA: 'فيزا', COUPON: 'كوبون — يُحصّل آخر المعرض' }
const paymentStatusLabels = { PAID: 'مدفوعة', UNPAID: 'غير مدفوعة', PARTIALLY_PAID: 'مدفوعة جزئياً', NO_PAYMENT_REQUIRED: 'لا تتطلب دفع', REFUND: 'مرتجعة', ON_ACCOUNT: 'على الحساب' }

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
      {invoice.paymentMethod === 'COUPON' && <p className="receipt__note">كوبون صادر من المعرض — المستحق على إدارة المعرض، والتحصيل الفعلي موضح أدناه.</p>}
      <div className="receipt__meta">
        <span><b>نوع البيع:</b> {paymentTypeLabels[invoice.paymentType] || invoice.paymentType}</span>
        <span><b>الحالة:</b> {invoice.deleted ? 'ملغاة' : invoice.returnHistory?.length && invoice.paymentStatus !== 'REFUND' ? 'مرتجع جزئي' : isWholesale && invoice.paymentStatus !== 'REFUND' ? 'على حساب المكتبة' : paymentStatusLabels[invoice.paymentStatus] || invoice.paymentStatus}</span>
        {!isWholesale && invoice.paymentMethod && <span><b>الدفع:</b> {paymentMethodLabels[invoice.paymentMethod] || invoice.paymentMethod}</span>}
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
              <td data-label="سعر الوحدة" className="money--sale" dir="ltr">{formatMoney(item.unitPrice, invoice.currency, localCurrency)}</td>
              <td data-label="خصم الكتاب" className="money--discount"><span>{item.discountPercentage || 0}%</span><small>{formatMoney(item.fixedDiscountAmount, invoice.currency, localCurrency)}</small></td>
              <td data-label="الإجمالي" className={isGift ? 'money--gift' : 'money--sale'} dir="ltr"><strong>{formatMoney(item.totalAmountAfterDiscount, invoice.currency, localCurrency)}</strong></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div className="receipt__totals">
        <div className="money--sale"><span>الإجمالي قبل الخصم</span><strong dir="ltr">{formatMoney(invoice.totalAmountBeforeDiscount, invoice.currency, localCurrency)}</strong></div>
        <div><span>خصومات الكتب</span><strong className="money--discount" dir="ltr">-{formatMoney(invoice.booksDiscountAmount, invoice.currency, localCurrency)}</strong></div>
        <div className="money--sale"><span>بعد خصومات الكتب</span><strong dir="ltr">{formatMoney(invoice.subtotalAfterBookDiscounts, invoice.currency, localCurrency)}</strong></div>
        <div><span>خصم الفاتورة ({invoice.invoiceDiscountPercentage || 0}%)</span><strong className="money--discount" dir="ltr">-{formatMoney(invoice.invoicePercentageDiscountAmount, invoice.currency, localCurrency)}</strong></div>
        <div><span>خصم ثابت للفاتورة</span><strong className="money--discount" dir="ltr">-{formatMoney(invoice.invoiceFixedDiscountAmount, invoice.currency, localCurrency)}</strong></div>
        <div className={isGift ? 'money--gift' : 'money--sale'}><span>قيمة الكتب المحسوبة</span><strong dir="ltr">{formatMoney(invoice.totalAmountAfterDiscounts, invoice.currency, localCurrency)}</strong></div>
        <div className={`receipt__due money--${invoice.paymentStatus === 'REFUND' ? 'refund' : isGift ? 'gift' : isWholesale ? 'debt' : 'received'}`}><span>{isGift ? 'المطلوب للهدية' : isWholesale ? 'قيمة الفاتورة على الحساب' : 'المبلغ المطلوب'}</span><strong dir="ltr">{formatMoney(invoice.amountDue, invoice.currency, localCurrency)}</strong></div>
      </div>
      {isWholesale && <p className="receipt__account-note">الفاتورة مسجلة على حساب المكتبة. الدفعات والرصيد الحالي في كشف حساب المكتبة.</p>}
      {invoice.couponCollections?.length > 0 && <section className="library-payment-history"><h2>تحصيل الكوبون من إدارة المعرض</h2>{invoice.couponCollections.map(c => <p key={c.requestId}>{c.paidAt} · {c.paymentMethod === 'CASH' ? 'نقدي' : 'فيزا'} · <bdi>{formatMoney(c.amount, invoice.currency, localCurrency)}</bdi>{c.notes && <span> · {c.notes}</span>}</p>)}</section>}
      {isWholesale && invoice.libraryPayments?.length > 0 && <div className="library-payment-history"><h2>دفعات تاريخية مرتبطة بالفاتورة</h2><div className="table-wrap"><table className="receipt-table"><thead><tr><th>تاريخ الدفع</th><th>طريقة الدفع</th><th>قيمة الدفعة</th></tr></thead><tbody>{invoice.libraryPayments.map((payment, index) => <tr key={payment.id || `${payment.paidAt}-${index}`}><td data-label="تاريخ الدفع">{payment.paidAt || '—'}</td><td data-label="طريقة الدفع">{paymentMethodLabels[payment.paymentMethod] || payment.paymentMethod || '—'}</td><td data-label="قيمة الدفعة" className={payment.paymentMethod === 'VISA' ? 'money--visa' : 'money--received'} dir="ltr"><strong>{formatMoney(payment.amount, invoice.currency, localCurrency)}</strong></td></tr>)}</tbody></table></div></div>}
      {invoice.deleted && <p className="receipt__note">فاتورة ملغاة — محفوظة كمرجع لكشف الحساب، وليست مديونية جديدة.</p>}
      {invoice.returnHistory?.length > 0 && <div className="library-payment-history"><h2>سجل المرتجعات</h2>{invoice.returnHistory.map(operation => <div className="receipt__invoice-notes" key={operation.id}><strong>{operation.date}</strong><p>{operation.items.map(item => `${item.bookName} × ${item.quantity}`).join('، ')}</p><p className="money--refund">قيمة الكتب المرتجعة: {formatMoney(operation.value, invoice.currency, localCurrency)} · المردود فعلياً: {formatMoney(operation.cashAmount, invoice.currency, localCurrency)}</p>{isWholesale && <p className="money--received">خفض حساب المكتبة بسبب هذا المرتجع: {formatMoney(Number(operation.value) - Number(operation.cashAmount), invoice.currency, localCurrency)} — قيمة الكتب ناقص النقد الذي سلّمناه للمكتبة.</p>}{operation.notes && <div className="return-details-event__notes"><strong>ملاحظات المرتجع</strong><p>{operation.notes}</p></div>}</div>)}</div>}
      {invoice.notes && <div className="receipt__invoice-notes"><strong>ملاحظات الفاتورة</strong><p>{invoice.notes}</p></div>}
      {isGift && <p className="receipt__note">هذه هدية ولا تتطلب أي دفع. قيمة الكتب ظاهرة بشكل منفصل للمراجعة.</p>}
    </section>
  )
}
