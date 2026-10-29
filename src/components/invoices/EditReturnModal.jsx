import { useEffect, useMemo, useState } from 'react'
import { fetchInvoiceById, editInvoiceReturn } from '../../api/invoices.js'
import { Icon } from '../ui/Icon.jsx'
import { useDialogA11y } from '../ui/useDialogA11y.js'
import { getReturnSelection } from '../../utils/returnSelection.js'
import { formatMoney } from '../../utils/currency.js'
import { businessToday } from '../../utils/libraryAccounts.js'

export function EditReturnModal({ invoiceId, returnId: initialReturnId, bookFairId, localCurrency, onClose, onSaved }) {
  const [invoice, setInvoice] = useState(null)
  const [returnId, setReturnId] = useState(initialReturnId || null)
  const [date, setDate] = useState('')
  const [quantities, setQuantities] = useState({})
  const [notes, setNotes] = useState('')
  const [cash, setCash] = useState('0')
  const [state, setState] = useState({ status: 'loading', error: '' })
  const [requestId, setRequestId] = useState(() => crypto.randomUUID())
  const ref = useDialogA11y(true, onClose, state.status !== 'saving')
  function selectOperation(operation) {
    setReturnId(operation.id); setDate(operation.date); setQuantities(Object.fromEntries(operation.items.map(i => [i.itemId, i.quantity])))
    setNotes(operation.notes || ''); setCash(String(operation.cashAmount)); setRequestId(crypto.randomUUID())
    setState({ status: 'ready', error: '' })
  }
  useEffect(() => {
    const controller = new AbortController()
    fetchInvoiceById(invoiceId, bookFairId, { signal: controller.signal }).then(response => {
      const data = response.data
      const operation = initialReturnId ? data.returnHistory?.find(r => r.id === initialReturnId) : [...(data.returnHistory || [])].reverse().sort((a, b) => String(b.date).localeCompare(String(a.date))).at(0)
      if (!operation) throw new Error('بيانات هذا المرتجع غير متاحة للتعديل. أعد تحميل الصفحة.')
      setInvoice(data); selectOperation(operation)
    }).catch(error => { if (error.name !== 'AbortError') setState({ status: 'error', error: error.message }) })
    return () => controller.abort()
  }, [invoiceId, initialReturnId, bookFairId])
  const operation = invoice?.returnHistory.find(r => r.id === returnId)
  const rows = useMemo(() => {
    if (!invoice) return []
    const other = {}; const preceding = {}
    let before = true
    for (const r of invoice.returnHistory) {
      if (r.id === returnId) { before = false; continue }
      for (const i of r.items) { other[i.itemId] = (other[i.itemId] || 0) + i.quantity; if (before) preceding[i.itemId] = (preceding[i.itemId] || 0) + i.quantity }
    }
    return getReturnSelection({ ...invoice, items: invoice.items.map(i => ({ ...i, returnedQuantity: preceding[i.id] || 0 })) }, quantities)
      .map(i => ({ ...i, available: i.quantity - (other[i.id] || 0) }))
  }, [invoice, quantities, returnId])
  const value = Math.round(rows.reduce((sum, r) => sum + r.returnValue, 0) * 100) / 100
  const library = invoice?.paymentType === 'WHOLESALE_CREDIT'
  const coupon = invoice?.paymentMethod === 'COUPON'
  const canEditCash = invoice?.paymentType !== 'GIFT'
  const cashValue = canEditCash ? Number(cash) : 0
  const valid = rows.some(r => r.selectedQuantity > 0) && rows.every(r => Number.isInteger(r.selectedQuantity) && r.selectedQuantity >= 0 && r.selectedQuantity <= r.available)
    && Number.isFinite(cashValue) && cashValue >= 0 && cashValue <= value && (!canEditCash || /^(?:\d+|\d*\.\d{1,2})$/.test(cash)) && date && date >= invoice.businessDate && date <= businessToday()
  async function save(event) {
    event.preventDefault()
    if (!valid || state.status === 'saving') return
    setState({ status: 'saving', error: '' })
    try {
      await editInvoiceReturn(invoiceId, returnId, bookFairId, { requestId, expectedRevision: operation.revision || 0, date, notes: notes.trim() || null,
        refundAmount: cashValue, items: rows.filter(r => r.selectedQuantity > 0).map(r => ({ itemId: r.id, quantity: r.selectedQuantity })) })
      onSaved()
    } catch (error) { setState({ status: 'ready', error: error.message }) }
  }
  return <div className="modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget && state.status !== 'saving') onClose() }}>
    <section ref={ref} className="book-modal return-edit-modal" role="dialog" aria-modal="true" aria-labelledby="return-edit-title" tabIndex="-1">
      <header className="book-modal__header"><div><h2 id="return-edit-title">تعديل المرتجع</h2><bdi>{invoice?.invoiceNumber}</bdi></div><button className="icon-button" type="button" aria-label="إغلاق" disabled={state.status === 'saving'} onClick={onClose}><Icon name="close" /></button></header>
      <form className="return-edit-modal__body" onSubmit={save}>
        {state.status === 'loading' && <p role="status">جاري تحميل تفاصيل المرتجع…</p>}
        {invoice && <>
          <p>عدّل تاريخ وكميات ومبلغ وملاحظات هذه العملية. يتحدث المخزون والحساب والتقارير تلقائياً.</p>
          {invoice.returnHistory.length > 1 && <label className="form-field"><span>عملية المرتجع المطلوب تعديلها</span><select aria-label="عملية المرتجع" value={returnId || ''} disabled={state.status === 'saving'} onChange={e => selectOperation(invoice.returnHistory.find(r => r.id === e.target.value))}>{invoice.returnHistory.map((r, index) => <option key={r.id} value={r.id}>مرتجع {index + 1} · {r.date} · {r.items.reduce((n, i) => n + i.quantity, 0)} نسخة</option>)}</select></label>}
          <label className="form-field"><span>تاريخ المرتجع</span><input aria-label="تاريخ المرتجع" type="date" min={invoice.businessDate} max={businessToday()} value={date} disabled={state.status === 'saving'} onChange={e => setDate(e.target.value)} required /></label>
          {rows.map(row => <label className="return-edit-item" key={row.id}><span>{row.bookName}<small>أقصى كمية لهذه العملية: {row.available}</small></span><input aria-label={`كمية مرتجع ${row.bookName}`} type="number" min="0" max={row.available} step="1" value={quantities[row.id] ?? 0} disabled={state.status === 'saving'} onChange={e => setQuantities(q => ({ ...q, [row.id]: e.target.value }))} /></label>)}
          <label className="form-field"><span>ملاحظات المرتجع (اختياري)</span><textarea aria-label="ملاحظات المرتجع" maxLength={1000} rows="3" value={notes} disabled={state.status === 'saving'} onChange={e => setNotes(e.target.value)} /></label>
          <div className="return-edit-total"><span>قيمة الكتب بعد الخصومات</span><strong>{formatMoney(value, invoice.currency, localCurrency)}</strong></div>
          {canEditCash && <label className="form-field"><span>المبلغ المردود فعلياً{library ? ' للمكتبة' : coupon ? ' من تحصيل الكوبون' : ''}</span><input type="number" min="0" max={value} step="0.01" value={cash} disabled={state.status === 'saving'} onChange={e => setCash(e.target.value)} /></label>}
          <div className="return-edit-total"><span>المبلغ المردود فعلياً</span><strong className="money--refund">{formatMoney(cashValue, invoice.currency, localCurrency)}</strong></div>
          {library && <div className="return-edit-total"><span>المخصوم من حساب المكتبة</span><strong className="money--received">{formatMoney(value - cashValue, invoice.currency, localCurrency)}</strong></div>}
        </>}
        {state.error && <p className="form-error" role="alert">{state.error}</p>}
        <footer className="return-edit-actions"><button className="button button--secondary" type="button" disabled={state.status === 'saving'} onClick={onClose}>إلغاء</button><button className="button button--primary" type="submit" disabled={!invoice || !valid || state.status === 'saving'}>{state.status === 'saving' ? 'جاري الحفظ…' : 'حفظ تعديل المرتجع'}</button></footer>
      </form>
    </section>
  </div>
}
