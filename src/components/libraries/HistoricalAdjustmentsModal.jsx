import { useEffect, useState } from 'react'
import { fetchHistoricalAdjustments } from '../../api/libraries.js'
import { formatMoney } from '../../utils/currency.js'
import { libraryAccountError } from '../../utils/libraryAccounts.js'
import { Icon } from '../ui/Icon.jsx'
import { Notice } from '../ui/Notice.jsx'
import { TablePagination } from '../ui/TablePagination.jsx'
import { useDialogA11y } from '../ui/useDialogA11y.js'

export function HistoricalAdjustmentsModal({ library, bookFairId, currency, localCurrency, total, onClose, onOpenInvoice }) {
  const [page, setPage] = useState(0)
  const [state, setState] = useState({ status: 'loading', data: null })
  const dialogRef = useDialogA11y(true, onClose)
  useEffect(() => {
    const controller = new AbortController()
    setState({ status: 'loading', data: null })
    fetchHistoricalAdjustments({ libraryId: library.id, bookFairId, currency, page, signal: controller.signal })
      .then((response) => setState({ status: 'ready', data: response.data }))
      .catch((error) => { if (error.name !== 'AbortError') setState({ status: 'error', error: libraryAccountError(error, 'تعذر تحميل التسويات.') }) })
    return () => controller.abort()
  }, [library.id, bookFairId, currency, page])
  const groups = []
  for (const entry of state.data?.content || []) {
    const key = entry.invoiceId || `entry-${entry.id}`
    let group = groups.find((item) => item.key === key)
    if (!group) { group = { key, invoice: entry, entries: [] }; groups.push(group) }
    group.entries.push(entry)
  }
  const money = (value) => value == null ? 'غير مسجل' : formatMoney(value, currency, localCurrency)
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section ref={dialogRef} className="book-modal historical-adjustments-modal" role="dialog" aria-modal="true" aria-labelledby="historical-adjustments-title" tabIndex="-1">
      <header className="book-modal__header"><div><span className="eyebrow">{library.name}</span><h2 id="historical-adjustments-title">تسويات الرصيد</h2></div><button className="icon-button" type="button" aria-label="إغلاق" onClick={onClose}><Icon name="close" /></button></header>
      <div className="historical-adjustments__body">
        <div className="adjustments-net"><span>إجمالي أثر التسويات</span><strong className={Number(total) < 0 ? 'money--received' : 'money--debt'}>{Number(total) < 0 ? 'خفض ' : 'زيادة '}{money(Math.abs(Number(total)))}</strong></div>
        {state.status === 'loading' && <p role="status">جاري التحميل...</p>}
        {state.status === 'error' && <Notice tone="error" title="تعذر تحميل التسويات">{state.error}</Notice>}
        {state.data?.totalPages > 1 && <TablePagination page={page} totalPages={state.data.totalPages} loading={state.status === 'loading'} onPrevious={() => setPage(page - 1)} onNext={() => setPage(page + 1)} ariaLabel="صفحات التسويات" />}
        {state.status === 'ready' && !state.data?.content.length && <p>لا توجد تسويات بهذه العملة.</p>}
        {groups.map(({ key, invoice, entries }) => <article className="historical-adjustment" key={key}>
          <header><span>الفاتورة</span><bdi>{invoice.invoiceNumber || 'غير متاحة'}</bdi></header>
          <dl className="adjustment-source">
            <div><dt>قيمة الفاتورة</dt><dd className="money--sale">{money(invoice.invoiceValue)}</dd></div>
            <div><dt>المدفوع القديم</dt><dd className="money--received">{money(invoice.recordedPaid)}</dd></div>
            <div><dt>المردود المسجل</dt><dd className="money--refund">{money(invoice.recordedRefund)}</dd></div>
          </dl>
          <details className="adjustment-explanation"><summary>سجل التسويات ({entries.length})</summary>
            {entries.map((entry) => {
              const change = Number(entry.debit) - Number(entry.credit)
              return <section className="adjustment-event" key={entry.id}>
                <header><time>{entry.date}</time><strong className={change < 0 ? 'money--received' : 'money--debt'}>{change < 0 ? 'خفض ' : 'زيادة '}{money(Math.abs(change))}</strong></header>
                <p>{entry.reason}</p>
                {entry.automaticRefundCorrection && <p className="adjustment-verification">المردود يتضمن ترحيلاً آلياً؛ طابقه مع مستند الرد الفعلي.</p>}
                <dl><div><dt>الرصيد قبل القيد</dt><dd>{money(entry.balanceBefore)}</dd></div><div><dt>الرصيد بعد القيد</dt><dd>{money(entry.balanceAfter)}</dd></div></dl>
              </section>
            })}
          </details>
          {invoice.invoiceId && <button className="button button--secondary" type="button" onClick={() => onOpenInvoice(invoice.invoiceId)}><Icon name="eye" size={16} />عرض الفاتورة</button>}
        </article>)}
      </div>
    </section>
  </div>
}
