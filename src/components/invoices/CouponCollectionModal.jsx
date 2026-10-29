import { useEffect, useRef, useState } from 'react'
import { fetchCouponInvoices, collectFairCoupons, collectInvoiceCoupon } from '../../api/invoices.js'
import { couponCollectionScope } from '../../utils/couponCollections.js'
import { formatMoney, getCurrencyName } from '../../utils/currency.js'
import { businessToday } from '../../utils/libraryAccounts.js'
import { useDialogA11y } from '../ui/useDialogA11y.js'
import { AppDropdown } from '../ui/AppDropdown.jsx'
import { Icon } from '../ui/Icon.jsx'

export function CouponCollectionModal({ bookFairId, localCurrency, invoiceId = null, onClose, onSaved }) {
  const [invoices, setInvoices] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [currency, setCurrency] = useState(localCurrency?.code || 'USD')
  const [mode, setMode] = useState(invoiceId == null ? 'all' : 'single')
  const [selectedId, setSelectedId] = useState(invoiceId == null ? '' : String(invoiceId))
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('CASH')
  const [date, setDate] = useState(businessToday())
  const [notes, setNotes] = useState('')
  const [query, setQuery] = useState('')
  const submission = useRef(null)
  const saving = status === 'saving'
  const ref = useDialogA11y(true, onClose, !saving)
  useEffect(() => {
    const controller = new AbortController()
    fetchCouponInvoices(bookFairId, { signal: controller.signal }).then(r => {
      const rows = r.data || []
      setInvoices(rows)
      const selected = rows.find(i => String(i.id) === String(invoiceId))
      if (selected) setCurrency(selected.currency)
      setStatus('ready')
    }).catch(e => { if (e.name !== 'AbortError') { setError(e.message); setStatus('error') } })
    return () => controller.abort()
  }, [bookFairId, invoiceId])
  const eligible = couponCollectionScope(invoices, currency, date)
  const matching = mode === 'all' ? eligible : eligible.filter(i => String(i.id) === selectedId)
  const total = Math.round(matching.reduce((sum, i) => sum + i.collectible, 0) * 100) / 100
  const valid = /^(?:\d+|\d*\.\d{1,2})$/.test(amount) && Number(amount) > 0 && Number(amount) <= total && date && date <= businessToday()
  const currencies = [...new Set([localCurrency?.code, 'USD', ...invoices.map(i => i.currency)].filter(Boolean))]
  function changeScope(update) { update(); setAmount(''); setError('') }
  async function save(event) {
    event.preventDefault()
    if (!valid || status !== 'ready') return
    setStatus('saving'); setError('')
    const data = { amount: Number(amount), paymentMethod: method, paidAt: date, notes: notes.trim() || null }
    const fingerprint = JSON.stringify([mode, selectedId, currency, data])
    if (submission.current?.fingerprint !== fingerprint) submission.current = { fingerprint, requestId: crypto.randomUUID() }
    data.requestId = submission.current.requestId
    try {
      if (mode === 'single') await collectInvoiceCoupon(selectedId, bookFairId, data)
      else await collectFairCoupons(bookFairId, currency, data)
      onSaved()
    } catch (e) { setError(e.message); setStatus('ready') }
  }
  return <div className="modal-backdrop" role="presentation"><section ref={ref} className="book-modal coupon-collection" role="dialog" aria-modal="true" aria-labelledby="coupon-title" tabIndex="-1">
    <header className="book-modal__header"><div><h2 id="coupon-title">تحصيل الكوبونات</h2><p className="coupon-collection__subtitle">سجّل المبلغ المستلم من إدارة المعرض</p></div><button type="button" className="icon-button" aria-label="إغلاق" disabled={saving} onClick={onClose}><Icon name="close" /></button></header>
    <form className="coupon-collection__form" onSubmit={save}>
      <fieldset className="coupon-collection__modes" disabled={saving}><legend className="visually-hidden">نطاق التحصيل</legend>{[['all', 'تحصيل جماعي'], ['single', 'كوبون محدد']].map(([value, label]) => <button key={value} type="button" aria-pressed={mode === value} className={mode === value ? 'is-selected' : ''} onClick={() => changeScope(() => setMode(value))}>{label}</button>)}</fieldset>
      <div className="coupon-collection__grid">
        <div className="form-field"><span>العملة</span><AppDropdown ariaLabel="عملة تحصيل الكوبونات" value={currency} disabled={saving} options={currencies.map(c => ({ value: c, label: `${getCurrencyName(c, localCurrency)} — ${c}` }))} onChange={value => changeScope(() => { setCurrency(value); setSelectedId('') })} /></div>
        <label className="form-field"><span>تاريخ التحصيل</span><input aria-label="تاريخ تحصيل الكوبونات" type="date" required max={businessToday()} value={date} disabled={saving} onChange={e => changeScope(() => setDate(e.target.value))} /></label>
      </div>
      {mode === 'single' && <div className="coupon-collection__picker"><label className="form-field"><span>اختر الكوبون حسب رقم الفاتورة</span><input type="search" placeholder="ابحث برقم الفاتورة…" aria-label="بحث الكوبونات" value={query} disabled={saving} onChange={e => setQuery(e.target.value)} /></label><div className="coupon-collection__list" role="group" aria-label="الكوبونات المستحقة">{eligible.filter(i => i.invoiceNumber.toLowerCase().includes(query.toLowerCase())).map(i => <label key={i.id} className={`coupon-collection__option ${selectedId === String(i.id) ? 'is-selected' : ''}`}><input type="radio" name="coupon" value={i.id} checked={selectedId === String(i.id)} disabled={saving} onChange={() => changeScope(() => setSelectedId(String(i.id)))} /><span><bdi>{i.invoiceNumber}</bdi><small>{i.businessDate}</small></span><strong>{formatMoney(i.collectible, currency, localCurrency)}</strong></label>)}{status === 'ready' && eligible.length === 0 && <p className="coupon-collection__empty">لا توجد كوبونات مستحقة بهذه العملة والتاريخ.</p>}{eligible.length > 0 && !eligible.some(i => i.invoiceNumber.toLowerCase().includes(query.toLowerCase())) && <p className="coupon-collection__empty">لا توجد فاتورة بهذا الرقم.</p>}</div></div>}
      <div className="coupon-collection__balance"><div><span>{mode === 'single' ? 'المتبقي على الكوبون المحدد' : 'إجمالي المستحق'}</span><strong className="money--debt">{formatMoney(total, currency, localCurrency)}</strong></div><button className="button button--secondary" type="button" disabled={status !== 'ready' || total <= 0} onClick={() => setAmount(total.toFixed(2))}>{mode === 'single' ? 'تحصيل المتبقي' : 'تحصيل الكل'}</button></div>
      <div className="coupon-collection__grid">
        <label className="form-field"><span>المبلغ المستلم</span><input aria-label="المبلغ المستلم من المعرض" type="number" required min="0.01" step="0.01" max={total} value={amount} placeholder="0.00" disabled={status !== 'ready'} onChange={e => setAmount(e.target.value)} /></label>
        <div className="form-field"><span>طريقة الاستلام</span><AppDropdown ariaLabel="طريقة تحصيل الكوبونات" value={method} disabled={saving} options={[{ value: 'CASH', label: 'نقدي' }, { value: 'VISA', label: 'فيزا' }]} onChange={setMethod} /></div>
      </div>
      {mode === 'all' && <p className="coupon-collection__hint">{eligible.length} كوبون مستحق · المبلغ يُوزّع على الأقدم أولاً. يمكنك تحصيل مبلغ جزئي.</p>}
      <label className="form-field"><span>ملاحظات <small>(اختياري)</small></span><textarea aria-label="ملاحظات التحصيل" rows="2" value={notes} maxLength={1000} disabled={saving} onChange={e => setNotes(e.target.value)} /></label>
      {status === 'loading' && <p role="status">جاري تحميل الكوبونات…</p>}
      {status === 'ready' && mode === 'all' && !total && <p role="status">لا توجد كوبونات مستحقة بهذه العملة والتاريخ.</p>}
      {error && <p className="coupon-collection__error" role="alert">{error}</p>}
      <footer className="coupon-collection__footer"><button className="button button--primary" type="submit" disabled={status !== 'ready' || !valid}>{saving ? 'جاري التسجيل…' : 'تأكيد التحصيل'}</button><button className="button button--secondary" type="button" disabled={saving} onClick={onClose}>إلغاء</button></footer>
    </form>
  </section></div>
}
