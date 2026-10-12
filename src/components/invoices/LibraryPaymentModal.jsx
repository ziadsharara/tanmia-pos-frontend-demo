import { useEffect, useState } from 'react'
import { formatMoney, getCurrencyName } from '../../utils/currency.js'
import { getInvoicePaidAmount, getInvoiceRemainingAmount } from '../../utils/invoicePayments.js'
import { Icon } from '../ui/Icon.jsx'
import { useDialogA11y } from '../ui/useDialogA11y.js'

function today() {
  const date = new Date()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function LibraryPaymentModal({ invoice, localCurrency, isBusy, onClose, onConfirm }) {
  const [amount, setAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [paymentDate, setPaymentDate] = useState(today)
  const [error, setError] = useState('')
  const dialogRef = useDialogA11y(Boolean(invoice), onClose, !isBusy)
  const remaining = getInvoiceRemainingAmount(invoice)
  const paymentAmount = Number(amount)
  const canSubmit = amount !== ''
    && Number.isFinite(paymentAmount)
    && paymentAmount > 0
    && paymentAmount <= remaining
    && Boolean(paymentMethod)
    && Boolean(paymentDate)

  useEffect(() => {
    setAmount('')
    setPaymentMethod('')
    setPaymentDate(today())
    setError('')
  }, [invoice.id])

  const submit = (event) => {
    event.preventDefault()
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      setError('اكتب مبلغ دفع أكبر من صفر.')
      return
    }
    if (paymentAmount > remaining) {
      setError('المبلغ لا يمكن يكون أكبر من المتبقي على المكتبة.')
      return
    }
    if (!paymentMethod) {
      setError('اختار طريقة الدفع.')
      return
    }
    if (!paymentDate) {
      setError('اختار تاريخ الدفع.')
      return
    }
    setError('')
    onConfirm({
      amount: Math.round((paymentAmount + Number.EPSILON) * 100) / 100,
      paymentMethod,
      paymentDate,
    })
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !isBusy && onClose()}>
      <section ref={dialogRef} className="book-modal library-payment-modal" role="dialog" aria-modal="true" aria-labelledby="library-payment-modal-title" tabIndex="-1">
        <header className="book-modal__header">
          <div><span className="eyebrow">تحصيل مديونية مكتبة</span><h2 id="library-payment-modal-title">تسجيل دفعة جديدة</h2></div>
          <button className="icon-button" type="button" aria-label="إغلاق" disabled={isBusy} onClick={onClose}><Icon name="close" /></button>
        </header>
        <form className="book-form" onSubmit={submit}>
          <div className="library-payment-modal__invoice"><div><span>المكتبة</span><strong>{invoice.libraryName || '—'}</strong></div><div><span>رقم الفاتورة</span><strong dir="ltr">{invoice.invoiceNumber}</strong></div></div>
          <div className="library-payment-modal__totals">
            <div><span>قيمة الكتب</span><strong dir="ltr">{formatMoney(invoice.totalAmountAfterDiscounts, invoice.currency, localCurrency)}</strong></div>
            <div><span>المدفوع سابقاً</span><strong dir="ltr">{formatMoney(getInvoicePaidAmount(invoice), invoice.currency, localCurrency)}</strong></div>
            <div className="library-payment-modal__remaining"><span>المتبقي</span><strong dir="ltr">{formatMoney(remaining, invoice.currency, localCurrency)}</strong></div>
          </div>
          <div className="book-form__grid library-payment-modal__fields">
            <label className="form-field"><span>قيمة الدفعة ({getCurrencyName(invoice.currency, localCurrency)})</span><input autoFocus name="library-payment-amount" autoComplete="off" type="number" inputMode="decimal" dir="ltr" min="0.01" max={remaining} step="0.01" value={amount} disabled={isBusy} onChange={(event) => { setAmount(event.target.value); setError('') }} /></label>
            <label className="form-field"><span>تاريخ الدفع</span><input name="library-payment-date" autoComplete="off" type="date" dir="ltr" value={paymentDate} disabled={isBusy} onChange={(event) => { setPaymentDate(event.target.value); setError('') }} /></label>
          </div>
          <span className="library-payment-method-label">طريقة الدفع</span>
          <div className="payment-methods library-payment-modal__methods"><button type="button" disabled={isBusy} className={paymentMethod === 'CASH' ? 'is-active' : ''} onClick={() => { setPaymentMethod('CASH'); setError('') }}>نقدي</button><button type="button" disabled={isBusy} className={paymentMethod === 'VISA' ? 'is-active' : ''} onClick={() => { setPaymentMethod('VISA'); setError('') }}>فيزا</button></div>
          {error && <div className="library-payment-modal__error"><Icon name="alert" size={17} />{error}</div>}
          <footer className="book-modal__footer"><button className="button button--ghost" type="button" disabled={isBusy} onClick={onClose}>إلغاء</button><button className="button button--primary" type="submit" disabled={isBusy || !canSubmit}>{isBusy ? <span className="spinner spinner--light" /> : <Icon name="payment" size={17} />}{isBusy ? 'جاري تسجيل الدفعة...' : 'تسجيل الدفعة'}</button></footer>
        </form>
      </section>
    </div>
  )
}
