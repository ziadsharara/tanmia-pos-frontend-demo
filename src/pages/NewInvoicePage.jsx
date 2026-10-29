import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchBookById, fetchBooks } from '../api/books.js'
import { createInvoice, fetchLibraries } from '../api/invoices.js'
import { ApiError } from '../api/http.js'
import { InvoiceCart } from '../components/invoices/InvoiceCart.jsx'
import { InvoiceReceipt } from '../components/invoices/InvoiceReceipt.jsx'
import { InvoiceSummary } from '../components/invoices/InvoiceSummary.jsx'
import { Icon } from '../components/ui/Icon.jsx'
import { Notice } from '../components/ui/Notice.jsx'
import { Toast } from '../components/ui/Toast.jsx'
import { toArabicToastMessage } from '../utils/messages.js'

const createInitialValues = (primaryCurrency = '') => ({
  currency: primaryCurrency, paymentType: 'DIRECT', paymentMethod: '', libraryName: '',
  selectedLibraryId: '', notes: '',
  invoiceDiscountPercentage: '0', invoiceFixedDiscountAmount: '0',
})

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function calculateInvoice(values, cart) {
  if (!cart.length) return null
  const calculatedItems = []
  let grossTotal = 0
  let subtotal = 0

  for (const item of cart) {
    const quantity = Number(item.quantity)
    const percentage = Number(item.discountPercentage || 0)
    const fixedDiscount = roundMoney(Number(item.fixedDiscountAmount || 0))
    const unitPrice = Number(values.currency === 'USD' ? item.book.priceInUSD : item.book.price)
    if (![quantity, percentage, fixedDiscount, unitPrice].every(Number.isFinite)
      || quantity <= 0 || quantity > Number(item.book.quantity)
      || percentage < 0 || percentage > 100 || fixedDiscount < 0 || unitPrice < 0) return null

    const grossAmount = roundMoney(unitPrice * quantity)
    const percentageDiscountAmount = roundMoney(grossAmount * percentage / 100)
    const afterPercentage = roundMoney(grossAmount - percentageDiscountAmount)
    if (fixedDiscount > afterPercentage) return null
    const totalAfterItemDiscounts = roundMoney(afterPercentage - fixedDiscount)
    grossTotal = roundMoney(grossTotal + grossAmount)
    subtotal = roundMoney(subtotal + totalAfterItemDiscounts)
    calculatedItems.push({
      bookId: item.book.id, quantity, unitPrice, grossAmount,
      discountPercentage: percentage, percentageDiscountAmount,
      fixedDiscountAmount: fixedDiscount, totalAfterItemDiscounts,
    })
  }

  const invoicePercentage = Number(values.invoiceDiscountPercentage || 0)
  const invoiceFixedDiscount = roundMoney(Number(values.invoiceFixedDiscountAmount || 0))
  if (![invoicePercentage, invoiceFixedDiscount].every(Number.isFinite)
    || invoicePercentage < 0 || invoicePercentage > 100 || invoiceFixedDiscount < 0) return null
  const invoicePercentageDiscountAmount = roundMoney(subtotal * invoicePercentage / 100)
  const afterPercentage = roundMoney(subtotal - invoicePercentageDiscountAmount)
  if (invoiceFixedDiscount > afterPercentage) return null
  const totalAmountAfterDiscounts = roundMoney(afterPercentage - invoiceFixedDiscount)

  return {
    calculation: {
      items: calculatedItems,
      totalAmountBeforeDiscount: grossTotal,
      booksDiscountAmount: roundMoney(grossTotal - subtotal),
      subtotalAfterBookDiscounts: subtotal,
      invoiceDiscountPercentage: invoicePercentage,
      invoicePercentageDiscountAmount,
      invoiceFixedDiscountAmount: invoiceFixedDiscount,
      totalAmountAfterDiscounts,
    },
    amountDue: values.paymentType === 'GIFT' ? 0 : totalAmountAfterDiscounts,
  }
}

function buildRequest(values, cart, invoiceCalculation) {
  const calculation = invoiceCalculation.calculation
  const calculatedItems = new Map(calculation.items.map((item) => [item.bookId, item]))

  return {
    currency: values.currency,
    notes: values.notes.trim() || null,
    totalAmountBeforeBooksDiscount: calculation.totalAmountBeforeDiscount,
    booksDiscountAmount: calculation.booksDiscountAmount,
    totalAmountAfterBooksDiscount: calculation.subtotalAfterBookDiscounts,
    billDiscountPercentage: calculation.invoiceDiscountPercentage,
    billFixedDiscountAmount: calculation.invoiceFixedDiscountAmount,
    totalAmountAfterBillDiscount: calculation.totalAmountAfterDiscounts,
    dueAmount: invoiceCalculation.amountDue,
    paymentType: values.paymentType,
    paymentMethod: values.paymentType === 'DIRECT'
      ? values.paymentMethod || null
      : null,
    libraryName: values.paymentType === 'WHOLESALE_CREDIT' ? values.libraryName.trim() || null : null,
    items: cart.map((item) => {
      const calculated = calculatedItems.get(item.book.id)
      return {
        bookId: item.book.id,
        bookCode: item.book.code,
        bookName: item.book.name,
        bookAuthor: item.book.author,
        unitPrice: calculated.unitPrice,
        quantity: Number(item.quantity),
        discountPercentage: calculated.discountPercentage,
        fixedDiscountAmount: calculated.fixedDiscountAmount,
        totalAmount: calculated.totalAfterItemDiscounts,
      }
    }),
  }
}

function validateSale(values, cart) {
  if (!cart.length) return 'ضيف كتاب واحد على الأقل للفاتورة.'
  if (cart.some((item) => !Number.isInteger(Number(item.quantity)) || Number(item.quantity) <= 0)) return 'راجع كميات الكتب.'
  if (cart.some((item) => Number(item.quantity) > Number(item.book.quantity))) return 'كمية كتاب في الفاتورة أكبر من المخزون الحالي.'
  if (values.paymentType === 'DIRECT' && !values.paymentMethod) return 'اختار طريقة الدفع للبيع المباشر.'
  if (values.paymentType === 'WHOLESALE_CREDIT' && !values.libraryName.trim()) return 'اكتب اسم المكتبة للفاتورة الآجلة.'
  return ''
}

export function NewInvoicePage({ isActive, localCurrency, exhibitionName, activeBookFair, onDataChanged }) {
  const [drafts, setDrafts] = useState([{ id: 1, itemCount: 0, dirty: false, receipt: false, saving: false }])
  const [activeDraftId, setActiveDraftId] = useState(1)
  const [stockVersion, setStockVersion] = useState(0)
  const nextDraftId = useRef(2)

  useEffect(() => {
    setDrafts([{ id: 1, itemCount: 0, dirty: false, receipt: false, saving: false }])
    setActiveDraftId(1)
    setStockVersion(0)
    nextDraftId.current = 2
  }, [activeBookFair?.id])

  const updateDraftStatus = useCallback((draftId, status) => {
    setDrafts((current) => current.map((draft) => {
      if (draft.id !== draftId) return draft
      if (draft.itemCount === status.itemCount && draft.dirty === status.dirty
        && draft.receipt === status.receipt && draft.saving === status.saving) return draft
      return { ...draft, ...status }
    }))
  }, [])

  const addDraft = () => {
    const id = nextDraftId.current++
    setDrafts((current) => [...current, { id, itemCount: 0, dirty: false, receipt: false, saving: false }])
    setActiveDraftId(id)
  }

  const closeDraft = (draftId) => {
    if (drafts.length === 1) return
    const draft = drafts.find((item) => item.id === draftId)
    if (!draft || draft.saving) return
    if (draft.dirty && !draft.receipt && !window.confirm('الفاتورة دي لسه ما اتحفظتش. تقفلها وتفقد بياناتها؟')) return
    const index = drafts.findIndex((item) => item.id === draftId)
    const remaining = drafts.filter((item) => item.id !== draftId)
    setDrafts(remaining)
    if (activeDraftId === draftId) setActiveDraftId(remaining[Math.min(index, remaining.length - 1)].id)
  }

  const handleSaved = useCallback(() => {
    setStockVersion((current) => current + 1)
    onDataChanged()
  }, [onDataChanged])

  const handleTabKeyDown = (event, index) => {
    let nextIndex
    if (event.key === 'ArrowLeft') nextIndex = (index + 1) % drafts.length
    else if (event.key === 'ArrowRight') nextIndex = (index - 1 + drafts.length) % drafts.length
    else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = drafts.length - 1
    else return
    event.preventDefault()
    setActiveDraftId(drafts[nextIndex].id)
    document.getElementById(`invoice-draft-tab-${drafts[nextIndex].id}`)?.focus()
  }

  if (!activeBookFair) {
    return <div className="page"><section className="page-heading"><div><h1>فاتورة جديدة</h1><p>اختار معرض قبل البحث في كتبه.</p></div><div className="page-heading__icon"><Icon name="invoice" size={28} /></div></section><Notice tone="info" title="اختار معرض أولاً">كل فاتورة لازم تبدأ من معرض محدد علشان تظهر كتب المعرض الصحيح.</Notice><a className="button button--primary empty-state-action" href="#settings"><Icon name="settings" size={18} />فتح إعدادات المعرض</a></div>
  }

  return (
    <div className="page invoice-tabs-page">
      <section className="page-heading"><div><h1>فاتورة جديدة</h1><p>افتح أكتر من فاتورة وارجع لأي واحدة لما العميل يبقى جاهز.</p></div><div className="page-heading__icon"><Icon name="invoice" size={28} /></div></section>
      <div className="invoice-draft-tabs no-print"><div className="invoice-draft-tabs__list" role="tablist" aria-label="فواتير قيد التحضير">{drafts.map((draft, index) => <div className={`invoice-draft-tabs__item${activeDraftId === draft.id ? ' is-active' : ''}`} key={draft.id}><button id={`invoice-draft-tab-${draft.id}`} type="button" role="tab" aria-selected={activeDraftId === draft.id} aria-controls={`invoice-draft-panel-${draft.id}`} tabIndex={activeDraftId === draft.id ? 0 : -1} onClick={() => setActiveDraftId(draft.id)} onKeyDown={(event) => handleTabKeyDown(event, index)}><Icon name="invoice" size={16} /><span>فاتورة {index + 1}</span><small>{draft.receipt ? 'محفوظة' : draft.itemCount ? `${draft.itemCount} كتاب` : 'فارغة'}</small></button>{drafts.length > 1 && <button className="invoice-draft-tabs__close" type="button" disabled={draft.saving} aria-label={`إغلاق فاتورة ${index + 1}`} onClick={() => closeDraft(draft.id)}><Icon name="close" size={14} /></button>}</div>)}</div><button className="button button--secondary invoice-draft-tabs__add" type="button" onClick={addDraft}><Icon name="add" size={17} />فاتورة جديدة</button></div>
      {drafts.map((draft) => <div key={`${activeBookFair.id}-${draft.id}`} id={`invoice-draft-panel-${draft.id}`} className={`invoice-draft-panel${activeDraftId === draft.id ? ' invoice-draft-panel--active' : ''}`} role="tabpanel" aria-labelledby={`invoice-draft-tab-${draft.id}`} hidden={activeDraftId !== draft.id}><InvoiceDraft draftId={draft.id} isActive={isActive && activeDraftId === draft.id} localCurrency={localCurrency} exhibitionName={exhibitionName} activeBookFair={activeBookFair} stockVersion={stockVersion} onStatusChange={updateDraftStatus} onSaved={handleSaved} onNewTab={addDraft} /></div>)}
    </div>
  )
}

function InvoiceDraft({ draftId, isActive, localCurrency, exhibitionName, activeBookFair, stockVersion, onStatusChange, onSaved, onNewTab }) {
  const [values, setValues] = useState(() => createInitialValues(activeBookFair?.primaryCurrency))
  const [cart, setCart] = useState([])
  const [search, setSearch] = useState('')
  const [searchState, setSearchState] = useState({ status: 'idle', books: [], error: '' })
  const [librariesState, setLibrariesState] = useState({ status: 'idle', libraries: [], error: '' })
  const [saveState, setSaveState] = useState({ status: 'idle', error: '' })
  const [receipt, setReceipt] = useState(null)
  const [toast, setToast] = useState(null)
  const searchInputRef = useRef(null)
  const hasReceipt = Boolean(receipt)
  const isDirty = cart.length > 0 || Object.entries(createInitialValues(activeBookFair?.primaryCurrency))
    .some(([field, initial]) => values[field] !== initial)

  useEffect(() => {
    onStatusChange(draftId, { itemCount: cart.length, dirty: isDirty, receipt: hasReceipt, saving: saveState.status === 'saving' })
  }, [draftId, cart.length, isDirty, hasReceipt, saveState.status, onStatusChange])

  useEffect(() => {
    if (!isActive || !activeBookFair?.id || receipt || !window.matchMedia('(min-width: 801px) and (pointer: fine)').matches) return undefined
    const frameId = window.requestAnimationFrame(() => searchInputRef.current?.focus())
    return () => window.cancelAnimationFrame(frameId)
  }, [isActive, activeBookFair?.id, receipt])

  useEffect(() => {
    const primaryCurrency = activeBookFair?.primaryCurrency
    if (!primaryCurrency) return

    setValues(createInitialValues(primaryCurrency))
    setCart([])
    setSearch('')
    setSearchState({ status: 'idle', books: [], error: '' })
    setLibrariesState({ status: 'idle', libraries: [], error: '' })
    setSaveState({ status: 'idle', error: '' })
    setReceipt(null)
    setToast(null)
  }, [activeBookFair?.id, activeBookFair?.primaryCurrency])

  useEffect(() => {
    if (!isActive || !cart.length || receipt) return undefined
    const controller = new AbortController()
    Promise.allSettled(cart.map((item) => fetchBookById(item.book.id, activeBookFair.id, { signal: controller.signal })))
      .then((results) => {
        if (controller.signal.aborted) return
        const freshBooks = new Map()
        results.forEach((result) => { if (result.status === 'fulfilled') freshBooks.set(result.value.data.id, result.value.data) })
        if (freshBooks.size) setCart((current) => current.map((item) => freshBooks.has(item.book.id) ? { ...item, book: freshBooks.get(item.book.id) } : item))
      })
    return () => controller.abort()
  }, [isActive, stockVersion, activeBookFair?.id])

  const invoiceCalculation = useMemo(() => calculateInvoice(values, cart), [values, cart])
  const calculationState = {
    status: invoiceCalculation ? 'ready' : cart.length ? 'error' : 'idle',
    data: invoiceCalculation,
    error: cart.length && !invoiceCalculation ? 'راجع الكميات والخصومات قبل حفظ الفاتورة.' : '',
  }

  useEffect(() => {
    const term = search.trim()
    if (!isActive || !activeBookFair?.id || !term || receipt) {
      setSearchState({ status: 'idle', books: [], error: '' })
      return undefined
    }
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => {
      setSearchState({ status: 'loading', books: [], error: '' })
      fetchBooks({ bookFairId: activeBookFair.id, search: term, page: 0, size: 25, signal: controller.signal })
        .then((response) => setSearchState({ status: 'ready', books: response.data?.content || [], error: '' }))
        .catch((error) => {
          if (error.name !== 'AbortError') setSearchState({ status: 'error', books: [], error: error.message })
        })
    }, 180)
    return () => { window.clearTimeout(timeoutId); controller.abort() }
  }, [isActive, activeBookFair?.id, search, receipt])

  useEffect(() => {
    if (!isActive || values.paymentType !== 'WHOLESALE_CREDIT' || !activeBookFair?.id) return undefined

    const controller = new AbortController()
    setLibrariesState((current) => ({ status: 'loading', libraries: current.libraries, error: '' }))
    fetchLibraries({ bookFairId: activeBookFair.id, signal: controller.signal })
      .then((response) => setLibrariesState({ status: 'ready', libraries: response.data || [], error: '' }))
      .catch((error) => {
        if (error.name === 'AbortError') return
        const message = toArabicToastMessage(error instanceof Error ? error.message : '', 'تعذر تحميل المكتبات المحفوظة. يمكنك كتابة اسم المكتبة يدوياً.')
        setLibrariesState({ status: 'error', libraries: [], error: message })
        setToast({ tone: 'error', message })
      })

    return () => controller.abort()
  }, [isActive, values.paymentType, activeBookFair?.id])

  const addBook = (book) => {
    setCart((current) => {
      const found = current.find((item) => item.book.id === book.id)
      if (found) {
        if (Number(found.quantity) >= Number(book.quantity)) return current
        return current.map((item) => item.book.id === book.id ? { ...item, quantity: String(Number(item.quantity) + 1) } : item)
      }
      if (Number(book.quantity) <= 0) return current
      return [...current, { book, quantity: '1', discountPercentage: '0', fixedDiscountAmount: '0' }]
    })
    setSearch('')
    setSearchState({ status: 'idle', books: [], error: '' })
    window.setTimeout(() => searchInputRef.current?.focus(), 0)
  }

  const handleSearchKeyDown = async (event) => {
    if (!activeBookFair?.id || event.key !== 'Enter' || !search.trim()) return
    event.preventDefault()
    const exact = searchState.books.find((book) => String(book.code).toLowerCase() === search.trim().toLowerCase())
    if (exact) {
      addBook(exact)
      return
    }
    if (searchState.status === 'ready' && searchState.books.length === 1) {
      addBook(searchState.books[0])
      return
    }
    setSearchState({ status: 'loading', books: [], error: '' })
    try {
      const response = await fetchBooks({ bookFairId: activeBookFair.id, search: search.trim(), page: 0, size: 25 })
      const books = response.data?.content || []
      const scannedBook = books.find((book) => String(book.code).toLowerCase() === search.trim().toLowerCase())
      if (scannedBook) addBook(scannedBook)
      else setSearchState({ status: 'ready', books, error: '' })
    } catch (error) {
      setSearchState({ status: 'error', books: [], error: error.message })
    }
  }

  const changeLine = (bookId, field, value) => setCart((current) => current.map((item) => item.book.id === bookId ? { ...item, [field]: value } : item))
  const removeLine = (bookId) => setCart((current) => current.filter((item) => item.book.id !== bookId))

  const changeValue = (field, value) => {
    setValues((current) => {
      const next = { ...current, [field]: value }
      if (field === 'paymentType') {
        next.paymentMethod = ''
        next.libraryName = ''
        next.selectedLibraryId = ''
      }
      return next
    })
    setSaveState({ status: 'idle', error: '' })
  }

  const selectLibrary = (libraryId) => {
    const library = librariesState.libraries.find((item) => String(item.id) === String(libraryId))
    setValues((current) => ({
      ...current,
      selectedLibraryId: library ? String(library.id) : '',
      libraryName: library?.name || '',
    }))
    setSaveState({ status: 'idle', error: '' })
  }

  const refreshCartBooks = async (request) => {
    const results = await Promise.allSettled(request.items.map((item) => fetchBookById(item.bookId, activeBookFair.id)))
    const freshBooks = new Map()
    results.forEach((result) => { if (result.status === 'fulfilled') freshBooks.set(result.value.data.id, result.value.data) })
    setCart((current) => current.map((item) => freshBooks.has(item.book.id) ? { ...item, book: freshBooks.get(item.book.id) } : item))
  }

  const saveInvoice = async (request, calculatedInvoice) => {
    if (saveState.status === 'saving') return
    setSaveState({ status: 'saving', error: '' })
    try {
      const response = await createInvoice(request, activeBookFair.id)
      setReceipt({
        ...response.data,
        subtotalAfterBookDiscounts: request.totalAmountAfterBooksDiscount,
        invoicePercentageDiscountAmount: calculatedInvoice.calculation.invoicePercentageDiscountAmount,
        items: request.items.map((item) => ({ ...item, totalAmountAfterDiscount: item.totalAmount })),
      })
      setSaveState({ status: 'success', error: '' })
      setToast({ tone: 'success', message: toArabicToastMessage(response.message, 'تم حفظ الفاتورة بنجاح') })
      onSaved()
    } catch (error) {
      const message = toArabicToastMessage(error instanceof Error ? error.message : '', 'تعذر حفظ الفاتورة. حاول تاني.')
      setSaveState({ status: 'error', error: message })
      setToast({ tone: 'error', message })
      if (error instanceof ApiError && error.status > 0) await refreshCartBooks(request)
    }
  }

  const confirmSale = () => {
    if (saveState.status === 'saving') return
    const validationError = validateSale(values, cart)
    if (validationError) {
      setSaveState({ status: 'error', error: validationError })
      setToast({ tone: 'error', message: validationError })
      return
    }
    if (!invoiceCalculation) return
    const request = buildRequest(values, cart, invoiceCalculation)
    saveInvoice(request, invoiceCalculation)
  }

  const startNewSale = () => {
    setReceipt(null)
    setValues(createInitialValues(activeBookFair.primaryCurrency))
    setCart([])
    setSearch('')
    setSaveState({ status: 'idle', error: '' })
  }

  if (receipt) {
    return <div className="invoice-draft-receipt">{toast && <Toast tone={toast.tone} message={toast.message} onClose={() => setToast(null)} />}<InvoiceReceipt invoice={receipt} localCurrency={localCurrency} exhibitionName={exhibitionName} onBack={startNewSale} /><div className="receipt-next no-print"><button className="button button--primary" type="button" onClick={onNewTab}><Icon name="add" size={18} />فاتورة جديدة</button><a className="button button--secondary" href="#invoices">عرض كل الفواتير</a></div></div>
  }

  return (
    <div className={`invoice-page${cart.length === 0 ? ' invoice-page--empty' : ''}`}>
      {toast && <Toast tone={toast.tone} message={toast.message} onClose={() => setToast(null)} />}
      <div className="invoice-layout">
        <section className="panel invoice-builder">
          <div className="panel__heading"><div><span className="eyebrow">الكتب</span><h2>تفاصيل الفاتورة</h2></div><span className="format-badge">{cart.length} عنصر</span></div>
          <div className="book-lookup">
            <Icon name="search" size={20} />
            <input ref={searchInputRef} name="book-search" autoComplete="off" spellCheck="false" type="search" value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={handleSearchKeyDown} placeholder="امسح الكود أو اكتب أي جزء من الاسم أو الرقم…" aria-label="البحث عن كتاب بالكود أو الاسم أو الرقم" aria-describedby="book-lookup-hint" aria-controls="book-suggestions" aria-expanded={Boolean(search.trim() && searchState.status === 'ready')} />
            {searchState.status === 'loading' && <span className="spinner" />}
            {search.trim() && searchState.status === 'ready' && <div className="book-suggestions" id="book-suggestions" aria-live="polite">{searchState.books.length ? searchState.books.map((book) => {
              const cartQuantity = Number(cart.find((item) => item.book.id === book.id)?.quantity || 0)
              const remainingQuantity = Math.max(0, Number(book.quantity) - cartQuantity)
              return <button type="button" key={book.id} onClick={() => addBook(book)} disabled={remainingQuantity <= 0}><span><strong>{book.name}</strong><small>{book.author} · <bdi dir="ltr">{book.code}</bdi></small></span><span className={remainingQuantity > 0 ? 'suggestion-stock' : 'suggestion-stock suggestion-stock--empty'}>{remainingQuantity > 0 ? `${remainingQuantity} متاح` : Number(book.quantity) <= 0 ? 'نفد الرصيد' : 'تمت إضافة كل الرصيد'}</span></button>
            }) : <div className="book-suggestions__empty">الكتاب مش موجود. راجع الكود أو الاسم.</div>}</div>}
          </div>
          <div className="book-lookup__hint" id="book-lookup-hint"><kbd>Enter</kbd><span>لإضافة الكود المطابق مباشرة</span></div>
          {searchState.status === 'error' && <Notice tone="error" title="تعذر البحث عن الكتب">{searchState.error}</Notice>}
          <InvoiceCart items={cart} currency={values.currency} calculation={calculationState.data?.calculation} disabled={saveState.status === 'saving'} onChange={changeLine} onRemove={removeLine} localCurrency={localCurrency} />
        </section>
        <InvoiceSummary values={values} calculationState={calculationState} librariesState={librariesState} itemCount={cart.length} disabled={saveState.status === 'saving'} onChange={changeValue} onSelectLibrary={selectLibrary} onConfirm={confirmSale} localCurrency={localCurrency} />
      </div>
    </div>
  )
}
