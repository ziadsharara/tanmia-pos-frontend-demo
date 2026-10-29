import { EditReturnModal } from '../components/invoices/EditReturnModal.jsx'
import { TablePagination } from '../components/ui/TablePagination.jsx'
import { useEffect, useRef, useState } from 'react'
import { fetchInvoiceForRefund, fetchRefundInvoices, refundInvoice } from '../api/invoices.js'
import { ReturnDetailsModal } from '../components/invoices/ReturnDetailsModal.jsx'
import { InvoiceDetailsOverlay } from '../components/invoices/InvoiceDetailsOverlay.jsx'
import { ReportMoney } from '../components/invoices/InvoiceBooks.jsx'
import { InvoiceReceipt } from '../components/invoices/InvoiceReceipt.jsx'
import { Icon } from '../components/ui/Icon.jsx'
import { Notice } from '../components/ui/Notice.jsx'
import { Toast } from '../components/ui/Toast.jsx'
import { useInvoiceDetails } from '../hooks/useInvoiceDetails.js'
import { formatMoney } from '../utils/currency.js'
import { getReturnSelection, supportsItemReturns, getReturnBreakdown } from '../utils/returnSelection.js'
import { prepareInvoiceDetails } from '../utils/invoiceDetails.js'
import { toArabicToastMessage } from '../utils/messages.js'

const typeLabels = { DIRECT: 'مباشر', WHOLESALE_CREDIT: 'مكتبة', GIFT: 'هدية' }
function returnedBooks(invoice) {
  if (!invoice.returnHistory?.length) return invoice.books || []
  const items = new Map()
  invoice.returnHistory.forEach(r => r.items.forEach(item => {
    const previous = items.get(item.itemId)
    items.set(item.itemId, { ...item, quantity: (previous?.quantity || 0) + item.quantity })
  }))
  return [...items.values()]
}

export function ReturnsPage({ isActive, activeBookFair, localCurrency, dataVersion, onDataChanged }) {
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const [refundAmount, setRefundAmount] = useState('')
  const [returnNotes, setReturnNotes] = useState('')
  const [detailsInvoice, setDetailsInvoice] = useState(null)
  const [editingReturn, setEditingReturn] = useState(null)
  useEffect(() => { setEditingReturn(null) }, [activeBookFair?.id])
  const [quantities, setQuantities] = useState({})
  const requestIdentity = useRef(null)
  useEffect(() => { setQuantities({}); setReturnNotes(''); requestIdentity.current = null }, [invoiceNumber])
  useEffect(() => { if (!isActive) { setDetailsInvoice(null); setEditingReturn(null) } }, [isActive])
  const returnItems = getReturnSelection(selectedInvoice, quantities)
  const itemReturnsSupported = supportsItemReturns(selectedInvoice)
  const selectedValue = returnItems.some(item => item.selectedQuantity > 0 && item.returnValue == null) ? null : Math.round(returnItems.reduce((sum, item) => sum + (item.returnValue || 0), 0) * 100) / 100
  const selectedCount = returnItems.reduce((sum, item) => sum + item.selectedQuantity, 0)
  useEffect(() => { setRefundAmount('') }, [invoiceNumber])
  const [page, setPage] = useState(0)
  const [returnType, setReturnType] = useState('ALL')
  const [refreshKey, setRefreshKey] = useState(0)
  const [state, setState] = useState({ status: 'loading', data: null })
  const [lookupState, setLookupState] = useState({ status: 'idle', invoice: null, error: '' })
  const [isRefunding, setIsRefunding] = useState(false)
  const [toast, setToast] = useState(null)
  const { detail, openInvoice, closeInvoice } = useInvoiceDetails(activeBookFair?.id)

  useEffect(() => {
    if (!isActive) return undefined
    if (!activeBookFair?.id) {
      setState({ status: 'idle', data: null })
      return undefined
    }

    const controller = new AbortController()
    setState({ status: 'loading', data: null })
    fetchRefundInvoices({ bookFairId: activeBookFair.id, page, size: 25, paymentType: returnType === 'ALL' ? undefined : returnType, signal: controller.signal })
      .then((response) => setState({ status: 'ready', data: response.data }))
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setState({ status: 'error', data: null })
          setToast({ tone: 'error', message: toArabicToastMessage(error.message, 'تعذر تحميل الفواتير المرتجعة. حاول تاني.') })
        }
      })

    return () => controller.abort()
  }, [isActive, activeBookFair?.id, page, returnType, refreshKey, dataVersion])

  useEffect(() => {
    setInvoiceNumber('')
    setLookupState({ status: 'idle', invoice: null, error: '' })
    setSelectedInvoice(null)
    setDetailsInvoice(null)
    setPage(0)
    setToast(null)
  }, [activeBookFair?.id])

  useEffect(() => {
    const normalizedInvoiceNumber = invoiceNumber.trim()
    if (!isActive || !activeBookFair?.id || !normalizedInvoiceNumber || selectedInvoice) {
      if (!normalizedInvoiceNumber) setLookupState({ status: 'idle', invoice: null, error: '' })
      return undefined
    }

    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => {
      setLookupState({ status: 'loading', invoice: null, error: '' })
      fetchInvoiceForRefund(normalizedInvoiceNumber, activeBookFair.id, { signal: controller.signal })
        .then((response) => setLookupState({ status: 'ready', invoice: prepareInvoiceDetails(response.data), error: '' }))
        .catch((error) => {
          if (error.name === 'AbortError') return
          if (error.status === 404) {
            setLookupState({ status: 'empty', invoice: null, error: '' })
            return
          }
          setLookupState({
            status: 'error',
            invoice: null,
            error: toArabicToastMessage(error.message, 'تعذر البحث عن الفاتورة. حاول تاني.'),
          })
        })
    }, 250)

    return () => {
      window.clearTimeout(timeoutId)
      controller.abort()
    }
  }, [isActive, activeBookFair?.id, invoiceNumber, selectedInvoice])

  useEffect(() => {
    if (!isActive || !selectedInvoice || itemReturnsSupported || !activeBookFair?.id) return undefined
    const controller = new AbortController()
    fetchInvoiceForRefund(selectedInvoice.invoiceNumber, activeBookFair.id, { signal: controller.signal })
      .then(response => { if (supportsItemReturns(response.data)) setSelectedInvoice(prepareInvoiceDetails(response.data)) })
      .catch(error => { if (error.name !== 'AbortError') setToast({ tone: 'error', message: 'تعذر تحديث بيانات المرتجع. أعد البحث عن الفاتورة.' }) })
    return () => controller.abort()
  }, [isActive, selectedInvoice?.id, itemReturnsSupported, activeBookFair?.id])

  const handleInvoiceNumberChange = (event) => {
    setInvoiceNumber(event.target.value)
    setSelectedInvoice(null)
  }

  const handleRefund = async () => {
    if (!itemReturnsSupported || !selectedInvoice || selectedInvoice.paymentStatus === 'REFUND' || !activeBookFair?.id || isRefunding) return

    const libraryReturn = selectedInvoice.paymentType === 'WHOLESALE_CREDIT'
    if (libraryReturn && (!/^(?:\d+|\d*\.\d{1,2})$/.test(refundAmount)
      || Number(refundAmount) > selectedValue)) {
      setToast({ tone: 'error', message: 'اكتب المبلغ المردود فعلياً للمكتبة، أو صفر لو المرتجع هيخصم من المديونية فقط.' })
      return
    }
    if (!selectedCount || returnItems.some(i => !Number.isInteger(i.selectedQuantity) || i.selectedQuantity < 0 || i.selectedQuantity > i.available)) {
      setToast({ tone: 'error', message: 'اختار كتاباً واحداً على الأقل بكمية صحيحة لا تتجاوز المتاح.' })
      return
    }
    const payload = {
      notes: returnNotes.trim() || null,
      items: returnItems.filter(i => i.selectedQuantity > 0).map(i => ({ itemId: i.id, quantity: i.selectedQuantity })),
      ...(libraryReturn ? { refundAmount: Number(refundAmount) } : {}),
    }
    const fingerprint = JSON.stringify(payload)
    if (requestIdentity.current?.fingerprint !== fingerprint) requestIdentity.current = { fingerprint, id: crypto.randomUUID() }
    setIsRefunding(true)
    try {
      const response = await refundInvoice(selectedInvoice.invoiceNumber, activeBookFair.id, { ...payload, requestId: requestIdentity.current.id })
      if (returnType !== 'ALL') setReturnType(selectedInvoice.paymentType)
      setInvoiceNumber('')
      setLookupState({ status: 'idle', invoice: null, error: '' })
      setSelectedInvoice(null)
      setPage(0)
      onDataChanged()
      setToast({ tone: 'success', message: toArabicToastMessage(response?.message, 'تم تسجيل الفاتورة كمرتجع بنجاح.') })
    } catch (error) {
      const isAlreadyRefunded = error?.message === 'Invoice already refunded'
      if (isAlreadyRefunded) {
        setSelectedInvoice((current) => current ? { ...current, paymentStatus: 'REFUND' } : current)
      }
      setToast({
        tone: 'error',
        message: isAlreadyRefunded
          ? 'الفاتورة دي مسجلة كمرتجع بالفعل.'
          : toArabicToastMessage(error instanceof Error ? error.message : '', 'تعذر تسجيل الفاتورة كمرتجع. راجع رقم الفاتورة وحاول تاني.'),
      })
    } finally {
      setIsRefunding(false)
    }
  }

  const handleOpenInvoice = async (invoiceId) => {
    const error = await openInvoice(invoiceId)
    if (error) {
      setToast({ tone: 'error', message: toArabicToastMessage(error instanceof Error ? error.message : '', 'تعذر فتح تفاصيل الفاتورة. حاول تاني.') })
    }
  }

  if (!activeBookFair) {
    return <div className="page"><section className="page-heading"><div><h1>المرتجعات</h1><p>اختار معرض علشان تبحث في فواتيره ومرتجعاته.</p></div><div className="page-heading__icon"><Icon name="refund" size={28} /></div></section><Notice tone="info" title="اختار معرض أولاً">كل مرتجع لازم يكون مرتبط بفاتورة من المعرض المختار.</Notice><a className="button button--primary empty-state-action" href="#settings"><Icon name="settings" size={18} />فتح إعدادات المعرض</a></div>
  }

  const invoices = state.data?.content || []
  const lookupInvoice = lookupState.invoice
  const lookupIsRefunded = lookupInvoice?.paymentStatus === 'REFUND'
  const selectedIsRefunded = selectedInvoice?.paymentStatus === 'REFUND'

  return (
    <div className="page returns-page">
      {toast && <Toast tone={toast.tone} message={toast.message} onClose={() => setToast(null)} />}
      <section className="page-heading"><div><h1>المرتجعات</h1><p>اختار الكتب والكميات من الفاتورة، وراجع المرتجعات الجزئية والكاملة.</p></div><div className="page-heading__icon"><Icon name="refund" size={28} /></div></section>

      <section className="panel returns-search-panel">
        <div className="panel__heading"><div><h2>تسجيل مرتجع برقم الفاتورة</h2></div></div>
        <span className="refund-lookup__label">رقم الفاتورة</span>
        <div className="refund-lookup">
          <Icon name="search" size={20} />
          <input name="refund-invoice-number" autoComplete="off" spellCheck="false" type="search" dir="ltr" value={invoiceNumber} disabled={isRefunding} onChange={handleInvoiceNumberChange} placeholder="اكتب أو امسح رقم الفاتورة…" aria-label="البحث عن فاتورة برقمها" />
          {lookupState.status === 'loading' && <span className="spinner" />}
          {invoiceNumber.trim() && !selectedInvoice && ['ready', 'empty'].includes(lookupState.status) && <div className="refund-suggestions">
            {lookupInvoice ? <button type="button" disabled={lookupIsRefunded} onClick={() => setSelectedInvoice(lookupInvoice)}><span><strong dir="ltr">{lookupInvoice.invoiceNumber}</strong><small>{lookupInvoice.businessDate} · {typeLabels[lookupInvoice.paymentType] || lookupInvoice.paymentType}</small></span><span className={lookupIsRefunded ? 'suggestion-stock suggestion-stock--empty' : 'suggestion-stock'}>{lookupIsRefunded ? 'مرتجعة بالفعل' : 'عرض التفاصيل'}</span></button> : <div className="book-suggestions__empty">الفاتورة مش موجودة في المعرض ده.</div>}
          </div>}
        </div>
        {lookupState.status === 'error' && <Notice tone="error" title="تعذر البحث عن الفاتورة">{lookupState.error}</Notice>}
      </section>

      {selectedInvoice && <section className="refund-preview"><div className="refund-selection panel">
        <div className="panel__heading"><h2>الكتب والكميات المطلوب إرجاعها</h2><button className="button button--secondary" type="button" disabled={isRefunding || selectedIsRefunded} onClick={() => setQuantities(Object.fromEntries(returnItems.map(i => [i.id, i.available])))}>اختيار كل المتبقي</button></div>
        <p>القيمة محسوبة بعد خصومات الكتاب والفاتورة. الكميات المرتجعة سابقاً لا يمكن اختيارها مرة أخرى.</p>
        {!itemReturnsSupported && <Notice tone="info" title="بيانات المرتجع تحتاج تحديث">القيمة معروضة من الفاتورة الأصلية. أعد فتح الفاتورة بعد تشغيل الباك إند المحدث قبل تأكيد مرتجع جزئي.</Notice>}
        <div className="refund-selection__items">{returnItems.map(item => <label className="refund-selection__item" key={item.id}>
          <span><strong>{item.bookName}</strong><small>المباع: {item.quantity} · المرتجع سابقاً: {item.returnedQuantity || 0} · المتاح: {item.available}</small></span>
          <span className="form-field"><span>كمية المرتجع</span><input aria-label={`كمية مرتجع ${item.bookName}`} type="number" min="0" max={item.available} step="1" value={quantities[item.id] ?? 0} disabled={isRefunding || !item.available || selectedIsRefunded} onChange={e => setQuantities(current => ({ ...current, [item.id]: e.target.value }))} /></span>
          <strong className="money--refund">{item.returnValue == null ? 'غير متاح' : formatMoney(item.returnValue, selectedInvoice.currency, localCurrency)}</strong>
        </label>)}</div>
        <div className="refund-selection__total"><span>قيمة الكتب المختارة بعد الخصومات ({selectedCount} نسخة)</span><strong>{selectedValue == null ? 'غير متاح' : formatMoney(selectedValue, selectedInvoice.currency, localCurrency)}</strong></div>
        {selectedInvoice.paymentMethod === 'COUPON' && <p>إرجاع الكوبون يقلل مستحقاتنا لدى المعرض؛ لا نرد نقداً إلا في حدود قيمة سبق تحصيلها من المعرض.</p>}
        {selectedInvoice.paymentType === 'GIFT' && <p>مرتجع الهدية يعيد الكمية للمخزون فقط؛ لا توجد فلوس مردودة.</p>}
        <label className="form-field return-notes-field"><span>ملاحظات المرتجع <small>(اختياري)</small></span><textarea aria-label="ملاحظات المرتجع" name="return-notes" rows="3" maxLength={1000} value={returnNotes} disabled={isRefunding || selectedIsRefunded} onChange={event => setReturnNotes(event.target.value)} placeholder="اكتب سبب المرتجع أو أي تفاصيل إضافية…" /><small>{returnNotes.length} / 1000 حرف · الملاحظة خاصة بهذه العملية، وليست ملاحظات الفاتورة.</small></label>
        </div><div className="refund-preview__action">{selectedInvoice.paymentType === 'WHOLESALE_CREDIT' && !selectedIsRefunded && <label className="form-field"><span>المبلغ المردود فعلياً للمكتبة</span><input type="number" inputMode="decimal" min="0" step="0.01" max={selectedValue} value={refundAmount} onChange={(event) => setRefundAmount(event.target.value)} disabled={isRefunding} placeholder="0.00" dir="ltr" /><small>اكتب الفلوس التي سلّمتها للمكتبة. صفر لو المرتجع لتقليل المديونية فقط.</small></label>}{selectedInvoice.paymentType === 'WHOLESALE_CREDIT' && /^(?:\d+|\d*\.\d{1,2})$/.test(refundAmount) && selectedValue != null && Number(refundAmount) <= selectedValue && <div className="refund-account-effect" role="status"><span>سيُخصم من حساب المكتبة</span><strong className="money--received">{formatMoney(selectedValue - Number(refundAmount), selectedInvoice.currency, localCurrency)}</strong><small>يقلل المديونية، أو يصبح رصيداً لصالح المكتبة عندنا.</small></div>}<button className="button button--danger" type="button" disabled={isRefunding || selectedIsRefunded || !selectedCount || !itemReturnsSupported || selectedValue == null} onClick={handleRefund}>{isRefunding ? <span className="spinner" /> : <Icon name="refund" size={18} />}{isRefunding ? 'جاري تسجيل المرتجع...' : selectedIsRefunded ? 'مرتجعة بالفعل' : 'تأكيد إرجاع الكميات المختارة'}</button><span>{selectedIsRefunded ? 'الفاتورة دي مسجلة كمرتجع ومينفعش ترجع مرة تانية.' : 'راجع تفاصيل الفاتورة والكتب قبل تسجيل المرتجع.'}</span></div><details className="panel refund-original"><summary>عرض الفاتورة الأصلية وسجل المرتجعات</summary><InvoiceReceipt invoice={selectedInvoice} localCurrency={localCurrency} exhibitionName={activeBookFair.name} onClose={() => { setSelectedInvoice(null); setInvoiceNumber('') }} /></details></section>}

      <section className="panel catalog-panel">
        <div className="catalog-toolbar"><div><h2>الفواتير المرتجعة</h2></div><div className="catalog-count"><Icon name="refund" size={17} /><span>الإجمالي</span><strong>{state.data?.totalElements ?? 0}</strong></div></div>

        <nav className="account-tabs returns-filters" aria-label="نوع المرتجعات المعروضة">{[['ALL', 'كل المرتجعات'], ['DIRECT', 'بيع مباشر'], ['WHOLESALE_CREDIT', 'مرتجعات المكتبات'], ['GIFT', 'هدايا']].map(([type, label]) => <button type="button" key={type} aria-pressed={returnType === type} className={returnType === type ? 'is-active' : ''} onClick={() => { setReturnType(type); setPage(0) }}>{label}</button>)}</nav>
        <p className="returns-account-hint">المخصوم من حساب المكتبة = قيمة الكتب المرتجعة − المبلغ المردود نقداً. يقلل المديونية أو يصبح رصيداً لصالح المكتبة. الرصيد النهائي في كشف حسابها.</p>
        {state.status === 'loading' && <div className="catalog-state"><span className="spinner spinner--large" /><strong>جاري تحميل الفواتير المرتجعة...</strong></div>}
        {state.status === 'error' && <div className="catalog-state"><span className="catalog-state__icon"><Icon name="refund" size={28} /></span><strong>تعذر تحميل الفواتير المرتجعة</strong><p>حاول تحميل القائمة مرة تانية.</p><button className="button button--secondary" type="button" onClick={() => setRefreshKey((current) => current + 1)}>حاول تاني</button></div>}
        {state.status === 'ready' && invoices.length === 0 && <div className="catalog-state"><span className="catalog-state__icon"><Icon name="refund" size={28} /></span><strong>مفيش فواتير مرتجعة للمعرض ده</strong><p>الفواتير اللي يتم تسجيلها كمرتجع هتظهر هنا.</p></div>}

        {state.status === 'ready' && invoices.length > 0 && <><TablePagination page={state.data.number} totalPages={state.data.totalPages} hasNext={!state.data.last} onPrevious={() => setPage((current) => current - 1)} onNext={() => setPage((current) => current + 1)} ariaLabel="صفحات المرتجعات" /><div className="table-wrap catalog-table-wrap history-table-wrap"><table className="history-table history-table--with-books returns-table"><thead><tr><th>رقم الفاتورة</th><th>الكتب المرتجعة</th><th>تاريخ الفاتورة</th><th>نوع البيع</th><th>المكتبة</th><th>قيمة الكتب المرتجعة</th><th>المبلغ المردود</th><th>المخصوم من حساب المكتبة</th><th>تاريخ المرتجع</th><th>الحالة</th><th className="return-details-heading">تفاصيل المرتجع</th><th className="table-actions-cell">إجراء</th></tr></thead><tbody>{invoices.map((invoice) => {
          const breakdown = getReturnBreakdown(invoice)
          const libraryReturn = invoice.paymentType === 'WHOLESALE_CREDIT'
          const params = new URLSearchParams({ currency: invoice.currency })
          if (invoice.libraryId) params.set('libraryId', String(invoice.libraryId))
          else params.set('libraryName', invoice.libraryName || '')
          return <tr key={invoice.id}>
            <td data-label="رقم الفاتورة" className="code-cell invoice-number-cell" dir="ltr">{invoice.invoiceNumber}</td>
            <td data-label="الكتب المرتجعة" className="return-books-cell"><div className="return-books-list">{returnedBooks(invoice).map((book, index) => <div key={book.itemId || book.bookCode || index}><span>{book.bookName}</span><small><bdi dir="ltr">× {book.quantity}</bdi></small></div>)}</div></td>
            <td data-label="تاريخ الفاتورة" className="return-date-cell"><bdi dir="ltr">{invoice.businessDate || '—'}</bdi></td>
            <td data-label="نوع البيع">{typeLabels[invoice.paymentType] || invoice.paymentType}</td>
            <td data-label="المكتبة">{invoice.libraryName || '—'}</td>
            <td data-label="قيمة الكتب المرتجعة" className={`history-money-cell money--${invoice.paymentType === 'GIFT' ? 'gift' : 'sale'}`}><strong>{formatMoney(breakdown.value, invoice.currency, localCurrency)}</strong></td>
            <td data-label="المبلغ المردود" className="history-money-cell money--refund"><strong>{breakdown.cash == null ? <span>راجع كشف الحساب</span> : <ReportMoney tone="refund" value={breakdown.cash} currency={invoice.currency} localCurrency={localCurrency} />}</strong></td>
            <td data-label="المخصوم من حساب المكتبة" className={libraryReturn ? 'history-money-cell money--received return-account-effect' : 'history-money-cell money--zero'}>
              {libraryReturn ? <><strong>{breakdown.accountReduction == null ? 'راجع كشف الحساب' : formatMoney(breakdown.accountReduction, invoice.currency, localCurrency)}</strong><small>خفض للحساب، وليس مبلغاً مطلوب تحصيله</small></> : '—'}
            </td>
            <td data-label="تاريخ المرتجع" className="return-date-cell"><bdi dir="ltr">{invoice.refundAt || '—'}</bdi></td>
            <td data-label="الحالة"><span className="invoice-status invoice-status--refund">{invoice.paymentStatus === 'REFUND' ? 'مرتجعة بالكامل' : 'مرتجع جزئي'}</span></td>
            <td data-label="تفاصيل المرتجع" className="return-details-cell"><button className="button button--table" type="button" onClick={() => setDetailsInvoice(invoice)}>عرض التفاصيل</button></td>
            <td data-label="الإجراء" className="table-actions-cell"><div className="table-actions" role="group" aria-label={`إجراءات الفاتورة ${invoice.invoiceNumber}`}>
              <button className="table-action" type="button" aria-label="تعديل المرتجع" title={invoice.returnHistory?.length ? 'تعديل تاريخ وكميات ومبلغ وملاحظات المرتجع' : 'مرتجع قديم بدون تفاصيل كميات موثقة'} disabled={!invoice.returnHistory?.length || invoice.deleted} onClick={() => setEditingReturn({ invoiceId: invoice.id })}><Icon name="edit" size={17} /></button>
              <button className="table-action" type="button" aria-label="فتح" title="عرض الفاتورة المرتجعة" disabled={detail.status === 'loading'} onClick={() => handleOpenInvoice(invoice.id)}><Icon name="eye" size={17} /></button>
              {libraryReturn && <a className="table-action" href={`#libraries?${params}`} aria-label={`كشف حساب ${invoice.libraryName}`} title="فتح كشف حساب المكتبة"><Icon name="history" size={17} /></a>}
            </div></td>
          </tr>
        })}</tbody></table></div></>}
      </section>

      {detailsInvoice && isActive && <ReturnDetailsModal invoice={detailsInvoice} localCurrency={localCurrency} onClose={() => setDetailsInvoice(null)} />}
      {editingReturn && isActive && <EditReturnModal {...editingReturn} bookFairId={activeBookFair.id} localCurrency={localCurrency} onClose={() => setEditingReturn(null)} onSaved={() => { setEditingReturn(null); setRefreshKey(key => key + 1); setSelectedInvoice(null); setInvoiceNumber(''); onDataChanged?.() }} />}
      <InvoiceDetailsOverlay detail={detail} localCurrency={localCurrency} exhibitionName={activeBookFair.name} onClose={closeInvoice} />
    </div>
  )
}
