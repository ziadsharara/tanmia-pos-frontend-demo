import { useEffect, useState } from 'react'
import { fetchInvoiceForRefund, fetchRefundInvoices, refundInvoice } from '../api/invoices.js'
import { InvoiceDetailsOverlay } from '../components/invoices/InvoiceDetailsOverlay.jsx'
import { InvoiceBookCodes, InvoiceBookNames } from '../components/invoices/InvoiceBooks.jsx'
import { InvoiceReceipt } from '../components/invoices/InvoiceReceipt.jsx'
import { Icon } from '../components/ui/Icon.jsx'
import { Notice } from '../components/ui/Notice.jsx'
import { Toast } from '../components/ui/Toast.jsx'
import { useInvoiceDetails } from '../hooks/useInvoiceDetails.js'
import { formatMoney } from '../utils/currency.js'
import { prepareInvoiceDetails } from '../utils/invoiceDetails.js'
import { getInvoicePaidAmount, getInvoiceRemainingAmount } from '../utils/invoicePayments.js'
import { toArabicToastMessage } from '../utils/messages.js'

const typeLabels = { DIRECT: 'مباشر', WHOLESALE_CREDIT: 'آجل', GIFT: 'هدية' }
const statusLabels = { REFUND: 'مرتجعة' }

export function ReturnsPage({ isActive, activeBookFair, localCurrency, dataVersion, onDataChanged }) {
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [page, setPage] = useState(0)
  const [refreshKey, setRefreshKey] = useState(0)
  const [state, setState] = useState({ status: 'loading', data: null })
  const [lookupState, setLookupState] = useState({ status: 'idle', invoice: null, error: '' })
  const [selectedInvoice, setSelectedInvoice] = useState(null)
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
    fetchRefundInvoices({ bookFairId: activeBookFair.id, page, size: 25, signal: controller.signal })
      .then((response) => setState({ status: 'ready', data: response.data }))
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setState({ status: 'error', data: null })
          setToast({ tone: 'error', message: toArabicToastMessage(error.message, 'تعذر تحميل الفواتير المرتجعة. حاول تاني.') })
        }
      })

    return () => controller.abort()
  }, [isActive, activeBookFair?.id, page, refreshKey, dataVersion])

  useEffect(() => {
    setInvoiceNumber('')
    setLookupState({ status: 'idle', invoice: null, error: '' })
    setSelectedInvoice(null)
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

  const handleInvoiceNumberChange = (event) => {
    setInvoiceNumber(event.target.value)
    setSelectedInvoice(null)
  }

  const handleRefund = async () => {
    if (!selectedInvoice || selectedInvoice.paymentStatus === 'REFUND' || !activeBookFair?.id || isRefunding) return

    setIsRefunding(true)
    try {
      const response = await refundInvoice(selectedInvoice.invoiceNumber, activeBookFair.id)
      setInvoiceNumber('')
      setLookupState({ status: 'idle', invoice: null, error: '' })
      setSelectedInvoice(null)
      setPage(0)
      onDataChanged()
      setToast({ tone: 'success', message: toArabicToastMessage(response?.message, 'تم تسجيل الفاتورة كمرتجع بنجاح.') })
    } catch (error) {
      const isAlreadyRefunded = error?.status === 409 || error?.message === 'Invoice already refunded'
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
      <section className="page-heading"><div><h1>المرتجعات</h1><p>سجل الفاتورة كمرتجع برقمها، وراجع الفواتير المرتجعة للمعرض.</p></div><div className="page-heading__icon"><Icon name="refund" size={28} /></div></section>

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

      {selectedInvoice && <section className="refund-preview"><InvoiceReceipt invoice={selectedInvoice} localCurrency={localCurrency} exhibitionName={activeBookFair.name} onClose={() => { setSelectedInvoice(null); setInvoiceNumber('') }} /><div className="refund-preview__action"><button className="button button--danger" type="button" disabled={isRefunding || selectedIsRefunded} onClick={handleRefund}>{isRefunding ? <span className="spinner" /> : <Icon name="refund" size={18} />}{isRefunding ? 'جاري تسجيل المرتجع...' : selectedIsRefunded ? 'مرتجعة بالفعل' : 'تسجيل الفاتورة كمرتجع'}</button><span>{selectedIsRefunded ? 'الفاتورة دي مسجلة كمرتجع ومينفعش ترجع مرة تانية.' : 'راجع تفاصيل الفاتورة والكتب قبل تسجيل المرتجع.'}</span></div></section>}

      <section className="panel catalog-panel">
        <div className="catalog-toolbar"><div><h2>الفواتير المرتجعة</h2></div><div className="catalog-count"><Icon name="refund" size={17} /><span>الإجمالي</span><strong>{state.data?.totalElements ?? 0}</strong></div></div>

        {state.status === 'loading' && <div className="catalog-state"><span className="spinner spinner--large" /><strong>جاري تحميل الفواتير المرتجعة...</strong></div>}
        {state.status === 'error' && <div className="catalog-state"><span className="catalog-state__icon"><Icon name="refund" size={28} /></span><strong>تعذر تحميل الفواتير المرتجعة</strong><p>حاول تحميل القائمة مرة تانية.</p><button className="button button--secondary" type="button" onClick={() => setRefreshKey((current) => current + 1)}>حاول تاني</button></div>}
        {state.status === 'ready' && invoices.length === 0 && <div className="catalog-state"><span className="catalog-state__icon"><Icon name="refund" size={28} /></span><strong>مفيش فواتير مرتجعة للمعرض ده</strong><p>الفواتير اللي يتم تسجيلها كمرتجع هتظهر هنا.</p></div>}

        {state.status === 'ready' && invoices.length > 0 && <><div className="table-wrap catalog-table-wrap history-table-wrap"><table className="history-table history-table--with-books returns-table"><thead><tr><th>رقم الفاتورة</th><th>أسماء الكتب</th><th>أكواد الكتب</th><th>تاريخ الفاتورة</th><th>نوع البيع</th><th>المكتبة</th><th>قيمة الكتب</th><th>المدفوع</th><th>المتبقي</th><th>تاريخ المرتجع</th><th>الحالة</th><th>إجراء</th></tr></thead><tbody>{invoices.map((invoice) => <tr key={invoice.id}><td data-label="رقم الفاتورة" className="code-cell invoice-number-cell" dir="ltr">{invoice.invoiceNumber}</td><td data-label="الكتب" className="invoice-book-names-cell"><InvoiceBookNames books={invoice.books} /></td><td data-label="الأكواد" className="invoice-book-codes-cell"><InvoiceBookCodes books={invoice.books} /></td><td data-label="تاريخ الفاتورة">{invoice.businessDate}</td><td data-label="نوع البيع">{typeLabels[invoice.paymentType] || invoice.paymentType}</td><td data-label="المكتبة">{invoice.libraryName || '—'}</td><td data-label="قيمة الكتب" className="history-money-cell" dir="ltr"><strong>{formatMoney(invoice.totalAmountAfterDiscounts, invoice.currency, localCurrency)}</strong></td><td data-label="المدفوع" className="history-money-cell" dir="ltr"><strong>{formatMoney(getInvoicePaidAmount(invoice), invoice.currency, localCurrency)}</strong></td><td data-label="المتبقي" className="history-money-cell" dir="ltr"><strong>{formatMoney(getInvoiceRemainingAmount(invoice), invoice.currency, localCurrency)}</strong></td><td data-label="تاريخ المرتجع">{invoice.refundAt || '—'}</td><td data-label="الحالة"><span className="invoice-status invoice-status--refund">{statusLabels[invoice.paymentStatus] || invoice.paymentStatus}</span></td><td data-label="الإجراء"><button className="button button--table" type="button" disabled={detail.status === 'loading'} onClick={() => handleOpenInvoice(invoice.id)}><Icon name="eye" size={16} />فتح</button></td></tr>)}</tbody></table></div><div className="pagination"><span>صفحة <strong>{state.data.number + 1}</strong> من <strong>{state.data.totalPages}</strong></span><div><button className="button button--secondary" type="button" disabled={page === 0} onClick={() => setPage((current) => current - 1)}><Icon name="next" size={16} />السابق</button><button className="button button--secondary" type="button" disabled={state.data.last} onClick={() => setPage((current) => current + 1)}>التالي<Icon name="previous" size={16} /></button></div></div></>}
      </section>

      <InvoiceDetailsOverlay detail={detail} localCurrency={localCurrency} exhibitionName={activeBookFair.name} onClose={closeInvoice} />
    </div>
  )
}
