import { useEffect, useRef, useState } from 'react'
import { fetchLibraryStatement, recordLibraryPayment } from '../../api/libraries.js'
import { formatMoney, getCurrencyName } from '../../utils/currency.js'
import { businessToday, libraryAccountError, validateLibraryPayment, libraryBalanceLabel } from '../../utils/libraryAccounts.js'
import { Icon } from '../ui/Icon.jsx'
import { AppDropdown } from '../ui/AppDropdown.jsx'
import { Notice } from '../ui/Notice.jsx'

export function LibraryAccountPaymentForm(props) {
  const [paymentCurrency, setPaymentCurrency] = useState(props.currency)
  useEffect(() => { setPaymentCurrency(props.currency) }, [props.currency])
  return <LibraryAccountPaymentFields {...props} key={paymentCurrency} currency={paymentCurrency} onCurrencyChange={setPaymentCurrency} />
}

function LibraryAccountPaymentFields({ library, bookFairId, currency, currencyOptions, onCurrencyChange, localCurrency, dataVersion, onSaved }) {
  const storageKey = `tanmia.pending-library-payment.v1:${bookFairId}:${library.id}:${currency}`
  const [pending, setPending] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem(storageKey)) } catch { return null }
  })
  const [values, setValues] = useState(() => pending || { amount: '', paymentMethod: '', paidAt: businessToday(), notes: '' })
  const [account, setAccount] = useState({ status: 'loading', data: null, error: '' })
  const [saveState, setSaveState] = useState({ status: 'idle', error: '' })
  const submitting = useRef(false)
  const isBusy = saveState.status === 'saving'
  const locked = Boolean(pending) || isBusy

  useEffect(() => {
    const controller = new AbortController()
    fetchLibraryStatement({ libraryId: library.id, bookFairId, currency, size: 1, signal: controller.signal })
      .then((response) => setAccount({ status: 'ready', data: response.data, error: '' }))
      .catch((error) => { if (error.name !== 'AbortError') setAccount({ status: 'error', data: null, error: libraryAccountError(error, 'تعذر تحميل رصيد الحساب. حدّث الصفحة وحاول تاني.') }) })
    return () => controller.abort()
  }, [library.id, bookFairId, currency, dataVersion])

  const change = (field, value) => {
    setValues((current) => ({ ...current, [field]: value }))
    setSaveState({ status: 'idle', error: '' })
  }

  const submit = async (event) => {
    event.preventDefault()
    if (submitting.current || account.status !== 'ready') return
    const validation = validateLibraryPayment(values, account.data.accountOpenedAt)
    if (validation) { setSaveState({ status: 'error', error: validation }); return }
    const payload = pending || { ...values, amount: Number(values.amount), currency, requestId: crypto.randomUUID() }
    // Keep the same request after a lost response, modal close, or browser refresh.
    try { sessionStorage.setItem(storageKey, JSON.stringify(payload)) } catch {
      setSaveState({ status: 'error', error: 'تعذر حفظ بيانات الدفعة بأمان في المتصفح. فعّل تخزين الجلسة وحاول تاني.' })
      return
    }
    setPending(payload)
    submitting.current = true
    setSaveState({ status: 'saving', error: '' })
    try {
      await recordLibraryPayment(library.id, bookFairId, payload)
      sessionStorage.removeItem(storageKey)
      setPending(null)
      setValues({ amount: '', paymentMethod: '', paidAt: businessToday(), notes: '' })
      onSaved(currency)
    } catch (error) {
      if ([400, 404, 503].includes(error.status)) {
        sessionStorage.removeItem(storageKey)
        setPending(null)
      }
      setSaveState({ status: 'error', error: libraryAccountError(error,
        'تعذر تأكيد تسجيل الدفعة. أعد المحاولة بنفس البيانات؛ لن يتم تسجيلها مرتين.') })
    } finally {
      submitting.current = false
      setSaveState((current) => current.status === 'saving' ? { status: 'idle', error: '' } : current)
    }
  }

  const balance = Number(account.data?.closingBalance || 0)
  const afterPayment = balance - Number(values.amount || 0)

  return (
    <section className="panel account-payment" aria-labelledby="account-payment-title">
      <header className="account-payment__heading"><h2 id="account-payment-title"><Icon name="payment" size={18} />تسجيل دفعة</h2><span>تخصم من إجمالي مديونية المكتبة</span></header>
      <form onSubmit={submit}>
        <div className="account-payment__fields">
          <div className="form-field"><span>عملة الدفعة</span><AppDropdown ariaLabel="عملة الدفعة" value={currency} options={currencyOptions} onChange={onCurrencyChange} disabled={locked} /></div>
          <label className="form-field"><span>المبلغ ({getCurrencyName(currency, localCurrency)})</span><input required name="account-payment-amount" type="number" inputMode="decimal" dir="ltr" placeholder="0.00" min="0.01" step="0.01" value={values.amount} disabled={locked || account.status !== 'ready'} onChange={(event) => change('amount', event.target.value)} /></label>
          <div className="form-field"><span>طريقة الدفع</span><AppDropdown ariaLabel="طريقة دفع المكتبة" value={values.paymentMethod} disabled={locked || account.status !== 'ready'} options={[{ value: '', label: 'اختار طريقة الدفع' }, { value: 'CASH', label: 'نقدي' }, { value: 'VISA', label: 'فيزا' }]} onChange={(value) => change('paymentMethod', value)} /></div>
          <label className="form-field"><span>تاريخ الدفع</span><input required name="account-payment-date" type="date" dir="ltr" min={account.data?.accountOpenedAt} max={businessToday()} value={values.paidAt} disabled={locked || account.status !== 'ready'} onChange={(event) => change('paidAt', event.target.value)} /></label>

        </div>
        <div className="account-payment__extras"><label className="form-field account-payment__notes"><span>ملاحظات الدفعة <small>(اختياري)</small></span><textarea name="account-payment-notes" rows="2" maxLength="500" value={values.notes || ''} disabled={locked || account.status !== 'ready'} placeholder="اكتب ملاحظة عن الدفعة..." onChange={(event) => change('notes', event.target.value)} /></label>
        </div>
        <footer className="account-payment__footer">
          <p role="status">{account.status !== 'ready' ? 'جاري تحميل رصيد عملة الدفعة...' : <>{libraryBalanceLabel(Number(values.amount) > 0 ? afterPayment : balance)}{Number(values.amount) > 0 ? ' بعد الدفعة' : ' حالياً'}<strong className={`money--${(Number(values.amount) > 0 ? afterPayment : balance) < 0 ? 'received' : (Number(values.amount) > 0 ? afterPayment : balance) === 0 ? 'zero' : 'debt'}`}><bdi>{formatMoney(Math.abs(Number(values.amount) > 0 ? afterPayment : balance), currency, localCurrency)}</bdi></strong></>}</p>
          <button className="button button--primary account-payment__submit" type="submit" disabled={isBusy || account.status !== 'ready' || Boolean(validateLibraryPayment(values, account.data?.accountOpenedAt))}>{isBusy ? <span className="spinner spinner--light" /> : <Icon name="check" size={17} />}{isBusy ? 'جاري التسجيل...' : pending ? 'إعادة تأكيد الدفعة' : 'تسجيل الدفعة'}</button>
        </footer>
        {account.error && <Notice tone="error" title="تعذر تحميل الرصيد">{account.error}</Notice>}
        {pending && !isBusy && <Notice tone="info" title="تأكيد دفعة سابقة">أعد المحاولة بنفس البيانات لتأكيدها بدون تكرار.</Notice>}
        {saveState.error && <Notice tone="error" title="لم يتم تأكيد الدفعة">{saveState.error}</Notice>}
      </form>
    </section>
  )
}
