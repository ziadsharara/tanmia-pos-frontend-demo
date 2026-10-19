import { useEffect, useMemo, useState } from 'react'
import { fetchBookById, fetchBooks } from '../../api/books.js'
import { fetchInvoiceById, updateInvoice } from '../../api/invoices.js'
import { formatMoney, getCurrencyName } from '../../utils/currency.js'
import { toArabicToastMessage } from '../../utils/messages.js'
import { Icon } from '../ui/Icon.jsx'
import { Notice } from '../ui/Notice.jsx'
import { useDialogA11y } from '../ui/useDialogA11y.js'
import { InvoiceCart } from './InvoiceCart.jsx'

const roundMoney = (value) => Math.round((value + Number.EPSILON) * 100) / 100

function calculateInvoice(currency, originalCurrency, cart, billPercentage, billFixed) {
  if (!cart.length) return null
  let totalBeforeDiscount = 0
  let subtotal = 0
  const items = []

  for (const line of cart) {
    const quantity = Number(line.quantity)
    const percentage = Number(line.discountPercentage || 0)
    const fixed = Number(line.fixedDiscountAmount || 0)
    const unitPrice = Number(line.savedUnitPrice != null && currency === originalCurrency
      ? line.savedUnitPrice : currency === 'USD' ? line.book.priceInUSD : line.book.price)
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > line.book.quantity
      || ![percentage, fixed, unitPrice].every(Number.isFinite)
      || percentage < 0 || percentage > 100 || fixed < 0 || unitPrice < 0) return null

    const gross = roundMoney(unitPrice * quantity)
    const afterPercentage = roundMoney(gross - roundMoney(gross * percentage / 100))
    if (fixed > afterPercentage) return null
    const lineTotal = roundMoney(afterPercentage - fixed)
    totalBeforeDiscount = roundMoney(totalBeforeDiscount + gross)
    subtotal = roundMoney(subtotal + lineTotal)
    items.push({ bookId: line.book.id, quantity, unitPrice, totalAfterItemDiscounts: lineTotal })
  }

  const percentage = Number(billPercentage || 0)
  const fixed = Number(billFixed || 0)
  if (![percentage, fixed].every(Number.isFinite) || percentage < 0 || percentage > 100 || fixed < 0) return null
  const afterBillPercentage = roundMoney(subtotal - roundMoney(subtotal * percentage / 100))
  if (fixed > afterBillPercentage) return null

  return {
    items,
    totalBeforeDiscount,
    booksDiscountAmount: roundMoney(totalBeforeDiscount - subtotal),
    subtotal,
    total: roundMoney(afterBillPercentage - fixed),
  }
}

export function EditInvoiceModal({ invoiceId, bookFairId, localCurrency, onClose, onSaved }) {
  const [state, setState] = useState({ status: 'loading', invoice: null, originalQuantities: {}, originalItems: {}, error: '' })
  const [cart, setCart] = useState([])
  const [currency, setCurrency] = useState('')
  const [businessDate, setBusinessDate] = useState('')
  const [paymentType, setPaymentType] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [libraryName, setLibraryName] = useState('')
  const [billPercentage, setBillPercentage] = useState('0')
  const [billFixed, setBillFixed] = useState('0')
  const [search, setSearch] = useState('')
  const [searchState, setSearchState] = useState({ status: 'idle', books: [] })
  const [saveState, setSaveState] = useState({ status: 'idle', error: '' })
  const isBusy = saveState.status === 'saving'
  const dialogRef = useDialogA11y(true, onClose, !isBusy)

  useEffect(() => {
    const controller = new AbortController()
    fetchInvoiceById(invoiceId, bookFairId, { signal: controller.signal })
      .then(async (response) => {
        const invoice = response.data
        const books = await Promise.all(invoice.items.map((item) => fetchBookById(item.bookId, bookFairId, { signal: controller.signal })))
        if (controller.signal.aborted) return
        const originalQuantities = Object.fromEntries(invoice.items.map((item) => [item.bookId, Number(item.quantity)]))
        const originalItems = Object.fromEntries(invoice.items.map((item) => [item.bookId, item]))
        setCart(invoice.items.map((item, index) => ({
          book: {
            ...books[index].data,
            name: item.bookName,
            author: item.bookAuthor,
            code: item.bookCode,
            quantity: Number(books[index].data.quantity) + Number(item.quantity),
          },
          savedUnitPrice: item.unitPrice,
          originalQuantity: Number(item.quantity),
          quantity: String(item.quantity),
          discountPercentage: String(item.discountPercentage ?? 0),
          fixedDiscountAmount: String(item.fixedDiscountAmount ?? 0),
        })))
        setCurrency(invoice.currency)
        setBusinessDate(invoice.businessDate || '')
        setPaymentType(invoice.paymentType)
        setPaymentMethod(invoice.paymentMethod || '')
        setLibraryName(invoice.libraryName || '')
        setBillPercentage(String(invoice.invoiceDiscountPercentage ?? 0))
        setBillFixed(String(invoice.invoiceFixedDiscountAmount ?? 0))
        setState({ status: 'ready', invoice, originalQuantities, originalItems, error: '' })
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setState({ status: 'error', invoice: null, originalQuantities: {}, originalItems: {}, error: toArabicToastMessage(error.message, 'تعذر تحميل الفاتورة أو أحد كتبها. حاول تاني.') })
      })
    return () => controller.abort()
  }, [invoiceId, bookFairId])

  useEffect(() => {
    const term = search.trim()
    if (!term || state.status !== 'ready') {
      setSearchState({ status: 'idle', books: [] })
      return undefined
    }
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => {
      setSearchState({ status: 'loading', books: [] })
      fetchBooks({ bookFairId, search: term, page: 0, size: 25, signal: controller.signal })
        .then((response) => setSearchState({ status: 'ready', books: response.data?.content || [] }))
        .catch((error) => { if (error.name !== 'AbortError') setSearchState({ status: 'error', books: [] }) })
    }, 180)
    return () => { window.clearTimeout(timeoutId); controller.abort() }
  }, [search, bookFairId, state.status])

  const calculation = useMemo(() => calculateInvoice(currency, state.invoice?.currency, cart, billPercentage, billFixed),
    [currency, state.invoice?.currency, cart, billPercentage, billFixed])
  const paidAmount = state.invoice?.paymentType === 'WHOLESALE_CREDIT'
    ? roundMoney((state.invoice.libraryPayments || []).reduce((total, payment) => total + Number(payment.amount || 0), 0))
    : 0
  const currencyOptions = [...new Set([state.invoice?.currency, localCurrency?.code, 'USD'].filter(Boolean))]
  const canSave = state.status === 'ready' && businessDate && calculation
    && (paymentType !== 'DIRECT' || Boolean(paymentMethod))
    && (paymentType !== 'WHOLESALE_CREDIT' || (libraryName.trim() && calculation.total >= paidAmount))

  const addBook = (book) => {
    const original = state.originalItems[book.id]
    const available = Number(book.quantity) + Number(state.originalQuantities[book.id] || 0)
    setCart((current) => {
      const existing = current.find((item) => item.book.id === book.id)
      if (existing) return Number(existing.quantity) >= available ? current
        : current.map((item) => item.book.id === book.id ? { ...item, quantity: String(Number(item.quantity) + 1) } : item)
      if (available < 1) return current
      return [...current, {
        book: { ...book, quantity: available, name: original?.bookName || book.name, author: original?.bookAuthor || book.author, code: original?.bookCode || book.code },
        savedUnitPrice: original?.unitPrice,
        originalQuantity: Number(state.originalQuantities[book.id] || 0),
        quantity: '1', discountPercentage: '0', fixedDiscountAmount: '0',
      }]
    })
    setSearch('')
    setSaveState({ status: 'idle', error: '' })
  }

  const submit = async (event) => {
    event.preventDefault()
    if (!canSave || isBusy) return
    setSaveState({ status: 'saving', error: '' })
    try {
      await updateInvoice(invoiceId, bookFairId, {
        currency,
        businessDate,
        paymentType,
        paymentMethod: paymentType === 'DIRECT' || (paymentType === 'WHOLESALE_CREDIT' && paidAmount > 0) ? paymentMethod || null : null,
        libraryName: paymentType === 'WHOLESALE_CREDIT' ? libraryName.trim() : null,
        billDiscountPercentage: Number(billPercentage || 0),
        billFixedDiscountAmount: Number(billFixed || 0),
        items: cart.map((line) => ({
          bookId: line.book.id,
          quantity: Number(line.quantity),
          discountPercentage: Number(line.discountPercentage || 0),
          fixedDiscountAmount: Number(line.fixedDiscountAmount || 0),
        })),
      })
      onSaved()
    } catch (error) {
      setSaveState({ status: 'error', error: toArabicToastMessage(error.message, 'تعذر تعديل الفاتورة. راجع المخزون والخصومات وحاول تاني.') })
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !isBusy && onClose()}>
      <section ref={dialogRef} className="book-modal invoice-edit-modal" role="dialog" aria-modal="true" aria-labelledby="invoice-edit-title" tabIndex="-1">
        <header className="book-modal__header"><div><span className="eyebrow">تعديل فاتورة محفوظة</span><h2 id="invoice-edit-title">تعديل الفاتورة</h2></div><button className="icon-button" type="button" aria-label="إغلاق" disabled={isBusy} onClick={onClose}><Icon name="close" /></button></header>
        {state.status === 'loading' && <div className="catalog-state"><span className="spinner spinner--large" /><strong>جاري تحميل الفاتورة...</strong></div>}
        {state.status === 'error' && <div className="book-form"><Notice tone="error" title="تعذر فتح التعديل">{state.error}</Notice><footer className="book-modal__footer"><button className="button button--secondary" type="button" onClick={onClose}>إغلاق</button></footer></div>}
        {state.status === 'ready' && <form className="book-form" onSubmit={submit}>
          <div className="invoice-edit-modal__meta"><span>رقم الفاتورة <bdi dir="ltr">{state.invoice.invoiceNumber}</bdi></span><span>نوع البيع: {state.invoice.paymentType === 'DIRECT' ? 'مباشر' : state.invoice.paymentType === 'GIFT' ? 'هدية' : 'آجل'}</span></div>
          <Notice tone="info" title="الدفعات المسجلة محفوظة">يمكن تعديل نوع البيع وطريقة الدفع قبل تسجيل دفعات للمكتبة. بعد تسجيل دفعة، تبقى بيانات البيع والدفع كما هي.</Notice>
          <label className="form-field invoice-edit-modal__date"><span>تاريخ الفاتورة التجاري</span><input name="invoice-business-date" type="date" dir="ltr" required value={businessDate} disabled={isBusy} onChange={(event) => { setBusinessDate(event.target.value); setSaveState({ status: 'idle', error: '' }) }} /></label>
          <div className="book-lookup invoice-edit-modal__search"><Icon name="search" size={20} /><input autoFocus type="search" value={search} disabled={isBusy} onChange={(event) => setSearch(event.target.value)} placeholder="ابحث بأي جزء من اسم الكتاب أو الكود أو الرقم…" aria-label="البحث عن كتاب لإضافته" /></div>
          {searchState.status === 'loading' && <span className="invoice-edit-modal__search-status">جاري البحث...</span>}
          {searchState.status === 'error' && <span className="invoice-edit-modal__search-status">تعذر البحث. حاول تاني.</span>}
          {searchState.status === 'ready' && <div className="book-suggestions invoice-edit-modal__suggestions">{searchState.books.length ? searchState.books.map((book) => {
            const available = Number(book.quantity) + Number(state.originalQuantities[book.id] || 0)
            const inCart = Number(cart.find((line) => line.book.id === book.id)?.quantity || 0)
            return <button type="button" key={book.id} disabled={isBusy || inCart >= available} onClick={() => addBook(book)}><span><strong>{book.name}</strong><small>{book.author} · <bdi dir="ltr">{book.code}</bdi></small></span><span className="suggestion-stock">المخزون {book.quantity} · يمكن إضافة {Math.max(0, available - inCart)}</span></button>
          }) : <div className="book-suggestions__empty">مفيش كتب مطابقة.</div>}</div>}
          <InvoiceCart items={cart} currency={currency} calculation={{ items: calculation?.items || [] }} disabled={isBusy} onChange={(bookId, field, value) => { setCart((current) => current.map((line) => line.book.id === bookId ? { ...line, [field]: value } : line)); setSaveState({ status: 'idle', error: '' }) }} onRemove={(bookId) => { setCart((current) => current.filter((line) => line.book.id !== bookId)); setSaveState({ status: 'idle', error: '' }) }} localCurrency={localCurrency} />
          <div className="book-form__grid invoice-edit-modal__fields">
            <label className="form-field"><span>عملة الفاتورة</span><select value={currency} disabled={isBusy || paidAmount > 0} onChange={(event) => { setCurrency(event.target.value); setSaveState({ status: 'idle', error: '' }) }}>{currencyOptions.map((code) => <option key={code} value={code}>{getCurrencyName(code, localCurrency)}</option>)}</select></label>
            <label className="form-field"><span>نوع البيع</span><select value={paymentType} disabled={isBusy || paidAmount > 0} onChange={(event) => { setPaymentType(event.target.value); setPaymentMethod(''); setSaveState({ status: 'idle', error: '' }) }}><option value="DIRECT">بيع مباشر</option><option value="WHOLESALE_CREDIT">بيع آجل لمكتبة</option><option value="GIFT">هدية</option></select></label>
            {paymentType === 'DIRECT' && <label className="form-field"><span>طريقة الدفع</span><select value={paymentMethod} disabled={isBusy} required onChange={(event) => { setPaymentMethod(event.target.value); setSaveState({ status: 'idle', error: '' }) }}><option value="">اختر طريقة الدفع</option><option value="CASH">نقدي</option><option value="VISA">فيزا</option></select></label>}
            {paymentType === 'WHOLESALE_CREDIT' && <label className="form-field"><span>اسم المكتبة</span><input type="text" value={libraryName} disabled={isBusy || paidAmount > 0} required onChange={(event) => { setLibraryName(event.target.value); setSaveState({ status: 'idle', error: '' }) }} /></label>}
            {paymentType === 'WHOLESALE_CREDIT' && paidAmount > 0 && <div className="form-field"><span>طريقة الدفع المسجلة</span><strong>{paymentMethod === 'CASH' ? 'نقدي' : paymentMethod === 'VISA' ? 'فيزا' : 'راجع سجل الدفعات'}</strong></div>}
            <label className="form-field"><span>خصم الفاتورة %</span><input type="number" dir="ltr" min="0" max="100" step="0.01" value={billPercentage} disabled={isBusy} onChange={(event) => { setBillPercentage(event.target.value); setSaveState({ status: 'idle', error: '' }) }} /></label>
            <label className="form-field"><span>خصم ثابت ({getCurrencyName(currency, localCurrency)})</span><input type="number" dir="ltr" min="0" step="0.01" value={billFixed} disabled={isBusy} onChange={(event) => { setBillFixed(event.target.value); setSaveState({ status: 'idle', error: '' }) }} /></label>
          </div>
          <div className="invoice-edit-modal__totals"><span>إجمالي الفاتورة <strong dir="ltr">{calculation ? formatMoney(calculation.total, currency, localCurrency) : '—'}</strong></span>{paymentType === 'WHOLESALE_CREDIT' && <><span>المدفوع سابقاً <strong dir="ltr">{formatMoney(paidAmount, currency, localCurrency)}</strong></span><span>المتبقي <strong dir="ltr">{calculation ? formatMoney(calculation.total - paidAmount, currency, localCurrency) : '—'}</strong></span></>}</div>
          {!calculation && <Notice tone="error" title="راجع الحساب">أضف كتاباً واحداً على الأقل وراجع الكميات والخصومات.</Notice>}
          {calculation && paymentType === 'WHOLESALE_CREDIT' && calculation.total < paidAmount && <Notice tone="error" title="المبلغ المدفوع أكبر من الإجمالي">ارفع إجمالي الفاتورة إلى قيمة المدفوع سابقاً على الأقل.</Notice>}
          {saveState.error && <Notice tone="error" title="تعذر الحفظ">{saveState.error}</Notice>}
          <footer className="book-modal__footer"><button className="button button--ghost" type="button" disabled={isBusy} onClick={onClose}>إلغاء</button><button className="button button--primary" type="submit" disabled={!canSave || isBusy}>{isBusy ? <span className="spinner spinner--light" /> : <Icon name="check" size={17} />}{isBusy ? 'جاري الحفظ...' : 'حفظ التعديلات'}</button></footer>
        </form>}
      </section>
    </div>
  )
}
