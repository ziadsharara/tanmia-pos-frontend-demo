import { Icon } from '../ui/Icon.jsx'
import { useDialogA11y } from '../ui/useDialogA11y.js'
import { formatMoney } from '../../utils/currency.js'
import { getReturnBreakdown } from '../../utils/returnSelection.js'

export function ReturnDetailsModal({ invoice, localCurrency, onClose }) {
  const dialogRef = useDialogA11y(true, onClose)
  const legacy = !invoice.returnHistory?.length
  const breakdown = getReturnBreakdown(invoice)
  const operations = legacy ? [{ id: 'legacy', date: invoice.refundAt, value: breakdown.value, cashAmount: breakdown.cash, items: invoice.books || [], notes: null }] : invoice.returnHistory
  const library = invoice.paymentType === 'WHOLESALE_CREDIT'
  return <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section ref={dialogRef} className="book-modal invoice-notes-modal return-details-modal" role="dialog" aria-modal="true" aria-labelledby="return-details-title" tabIndex="-1">
      <header className="book-modal__header"><div><h2 id="return-details-title">تفاصيل المرتجع</h2><bdi dir="ltr">{invoice.invoiceNumber}</bdi></div><button className="icon-button" type="button" aria-label="إغلاق" onClick={onClose}><Icon name="close" /></button></header>
      <div className="return-details-modal__body">
        {legacy && <p>مرتجع كامل من النسخة القديمة. التفاصيل أدناه من السجل الأصلي؛ لم تكن هناك ملاحظات مستقلة للمرتجع.</p>}
        {operations.map((operation, index) => <article className="return-details-event" key={operation.id}>
          <h3>عملية مرتجع {index + 1} <bdi dir="ltr">{operation.date || '—'}</bdi></h3>
          {operation.revision > 0 && <small>تم التعديل {operation.revision} مرة.</small>}
          <ul>{operation.items.map((item, itemIndex) => <li key={item.itemId || itemIndex}><strong>{item.bookName}</strong><span>الكمية المرتجعة: {item.quantity}</span>{item.bookCode && <bdi dir="ltr">{item.bookCode}</bdi>}</li>)}</ul>
          <dl><div><dt>قيمة الكتب بعد الخصومات</dt><dd>{formatMoney(operation.value, invoice.currency, localCurrency)}</dd></div><div><dt>{library ? 'نقد سلّمناه للمكتبة' : 'المبلغ المردود فعلياً'}</dt><dd className={Number(operation.cashAmount) === 0 ? 'money--zero' : 'money--refund'}>{operation.cashAmount == null ? 'غير موثّق في السجل القديم' : formatMoney(operation.cashAmount, invoice.currency, localCurrency)}</dd></div>{library && operation.cashAmount != null && <div><dt>المخصوم من حساب المكتبة</dt><dd className="money--received">{formatMoney(Number(operation.value) - Number(operation.cashAmount), invoice.currency, localCurrency)}</dd></div>}</dl>
          {operation.revisions?.length > 0 && <details className="return-details-audit"><summary>سجل تعديلات المرتجع ({operation.revisions.length})</summary>{operation.revisions.map((revision, ri) => <div key={ri}><strong>قبل التعديل {ri + 1}</strong><small>تم التعديل: {revision.editedAt?.slice(0, 10)} · تاريخ المرتجع السابق: {revision.date || '—'}</small><p>{revision.items.map(i => `${i.bookName} × ${i.quantity}`).join('، ')}</p><p>قيمة الكتب: {formatMoney(revision.value, invoice.currency, localCurrency)} · المبلغ المردود: {formatMoney(revision.cashAmount, invoice.currency, localCurrency)}</p>{revision.notes && <p>{revision.notes}</p>}</div>)}</details>}
          <div className="return-details-event__notes"><strong>ملاحظات المرتجع</strong><p>{operation.notes || 'لا توجد ملاحظة مسجلة لهذه العملية.'}</p></div>
        </article>)}
      </div>
    </section>
  </div>
}
