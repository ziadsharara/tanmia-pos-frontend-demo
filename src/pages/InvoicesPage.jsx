import { CouponCollectionModal } from '../components/invoices/CouponCollectionModal.jsx'
import { InvoiceDeleteDescription } from '../components/invoices/InvoiceDeleteDescription.jsx'
import { useEffect, useState } from 'react'
import { deleteAllInvoices, deleteInvoice, fetchInvoices } from '../api/invoices.js'
import { InvoiceDetailsOverlay } from '../components/invoices/InvoiceDetailsOverlay.jsx'
import { EditInvoiceModal } from '../components/invoices/EditInvoiceModal.jsx'
import { InvoicesTable } from '../components/invoices/InvoicesTable.jsx'
import { DeleteDataConfirmModal } from '../components/ui/DeleteDataConfirmModal.jsx'
import { Icon } from '../components/ui/Icon.jsx'
import { Notice } from '../components/ui/Notice.jsx'
import { Toast } from '../components/ui/Toast.jsx'
import { useInvoiceDetails } from '../hooks/useInvoiceDetails.js'
import { toArabicToastMessage } from '../utils/messages.js'

export function InvoicesPage({ isActive, localCurrency, exhibitionName, activeBookFair, dataVersion, onDataChanged }) {
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  useEffect(() => {
    const timer = window.setTimeout(() => { setSearchTerm(search.trim()); setPage(0) }, 250)
    return () => window.clearTimeout(timer)
  }, [search])
  const [state, setState] = useState({ status: 'loading', data: null, error: '' })
  const [toast, setToast] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [editingInvoiceId, setEditingInvoiceId] = useState(null)
  const [couponsOpen, setCouponsOpen] = useState(false)
  const [couponInvoiceId, setCouponInvoiceId] = useState(null)
  useEffect(() => { if (!isActive) setCouponsOpen(false) }, [isActive])
  const { detail, openInvoice, closeInvoice } = useInvoiceDetails(activeBookFair?.id)

  useEffect(() => {
    if (!isActive) return undefined
    if (!activeBookFair?.id) {
      setState({ status: 'idle', data: null, error: '' })
      return undefined
    }
    const controller = new AbortController()
    setState({ status: 'loading', data: null, error: '' })
    fetchInvoices({ bookFairId: activeBookFair.id, page, size: 25, search: searchTerm, signal: controller.signal })
      .then((response) => setState({ status: 'ready', data: response.data, error: '' }))
      .catch((error) => { if (error.name !== 'AbortError') setState({ status: 'error', data: null, error: error.message }) })
    return () => controller.abort()
  }, [isActive, activeBookFair?.id, page, searchTerm, refreshKey, dataVersion])

  useEffect(() => {
    setPage(0)
    setSearch('')
    setSearchTerm('')
    setToast(null)
    setDeleteOpen(false)
    setDeleteTarget(null)
    setEditingInvoiceId(null)
    setCouponsOpen(false)
    setCouponInvoiceId(null)
  }, [activeBookFair?.id])

  const handleOpenInvoice = async (invoiceId) => {
    const error = await openInvoice(invoiceId)
    if (error) {
      const message = toArabicToastMessage(error instanceof Error ? error.message : '', 'تعذر فتح تفاصيل الفاتورة. حاول تاني.')
      setToast({ tone: 'error', message })
    }
  }

  const invoices = state.data?.content || []

  const handleDeleteAllInvoices = async () => {
    if (deleting) return
    setDeleting(true)
    try {
      const response = await deleteAllInvoices(activeBookFair.id)
      setPage(0)
      setDeleteOpen(false)
      setToast({ tone: 'success', message: toArabicToastMessage(response.message, 'تم حذف كل فواتير المعرض وإرجاع كميات الكتب للمخزون بنجاح') })
      onDataChanged()
    } catch (error) {
      setToast({ tone: 'error', message: toArabicToastMessage(error instanceof Error ? error.message : '', 'تعذر حذف الكل. احذف فواتير المكتبات واحدة واحدة لتحديث الرصيد بشكل صحيح.') })
    } finally {
      setDeleting(false)
    }
  }

  const handleDeleteInvoice = async () => {
    if (!deleteTarget || deleting) return
    setDeleting(true)
    try {
      const response = await deleteInvoice(deleteTarget.id, activeBookFair.id)
      setPage(0)
      setDeleteTarget(null)
      setToast({ tone: 'success', message: toArabicToastMessage(response.message, 'تم حذف الفاتورة وإرجاع كميات الكتب للمخزون بنجاح') })
      onDataChanged()
    } catch (error) {
      setToast({ tone: 'error', message: toArabicToastMessage(error instanceof Error ? error.message : '', 'تعذر حذف الفاتورة. حاول تاني.') })
    } finally {
      setDeleting(false)
    }
  }

  const handleInvoiceUpdated = () => {
    setEditingInvoiceId(null)
    setToast({ tone: 'success', message: 'تم تعديل الفاتورة وتحديث المخزون بنجاح' })
    onDataChanged()
  }

  if (!activeBookFair) {
    return <div className="page"><section className="page-heading"><div><h1>الفواتير</h1><p>اختار معرض علشان تشوف فواتيره.</p></div><div className="page-heading__icon"><Icon name="history" size={28} /></div></section><Notice tone="info" title="اختار معرض أولاً">كل معرض له سجل فواتير مستقل. اختار معرض محفوظ علشان تظهر فواتيره هنا.</Notice><a className="button button--primary empty-state-action" href="#settings"><Icon name="settings" size={18} />فتح إعدادات المعرض</a></div>
  }

  return (
    <div className="page invoices-page">
      {toast && <Toast tone={toast.tone} message={toast.message} onClose={() => setToast(null)} />}
      <section className="page-heading"><div><h1>الفواتير</h1><p>راجع الفواتير المحفوظة وافتح أي إيصال للطباعة. دفعات المكتبات في حساباتها.</p></div><div className="page-heading__actions"><button type="button" className="button button--secondary" onClick={() => { setCouponInvoiceId(null); setCouponsOpen(true) }}>تحصيل كوبونات المعرض</button><button className="button button--danger-soft" type="button" disabled={!state.data?.totalElements || deleting} onClick={() => setDeleteOpen(true)}><Icon name="trash" size={18} />حذف كل الفواتير</button><a className="button button--primary" href="#new-invoice"><Icon name="add" size={18} />فاتورة جديدة</a><div className="page-heading__icon"><Icon name="history" size={28} /></div></div></section>
      <section className="panel catalog-panel">
        <div className="catalog-toolbar"><div><h2>فواتير {activeBookFair.name}</h2></div><div className="catalog-count"><Icon name="invoice" size={17} /><span>الإجمالي</span><strong>{state.status === 'empty' ? 0 : state.data?.totalElements ?? '—'}</strong></div></div>
        <div className="catalog-search"><Icon name="search" size={19} /><input name="invoice-search" type="search" autoComplete="off" value={search} maxLength="255" onChange={(event) => setSearch(event.target.value)} placeholder="ابحث برقم الفاتورة أو اسم المكتبة..." aria-label="البحث برقم الفاتورة أو اسم المكتبة" />{state.status === 'loading' && <span className="spinner" aria-label="جاري البحث" />}</div>
        {state.status === 'error' && <div className="catalog-error"><Notice tone="error" title="تعذر تحميل الفواتير">حاول تحميل الفواتير مرة تانية.</Notice><button className="button button--secondary" onClick={() => setRefreshKey((current) => current + 1)}>إعادة المحاولة</button></div>}
        {state.status === 'loading' && !state.data && <div className="catalog-state"><span className="spinner spinner--large" /><strong>جاري تحميل الفواتير...</strong></div>}
        {(state.status === 'empty' || (state.status === 'ready' && invoices.length === 0)) && <div className="catalog-state"><span className="catalog-state__icon"><Icon name="invoice" size={28} /></span><strong>{searchTerm ? 'مفيش فواتير مطابقة للبحث' : 'مفيش فواتير محفوظة للمعرض ده'}</strong><p>{searchTerm ? 'جرّب جزء من رقم الفاتورة أو اسم المكتبة.' : `أول فاتورة بيع في ${activeBookFair.name} هتظهر هنا بعد حفظها.`}</p></div>}
        {state.data && invoices.length > 0 && <InvoicesTable onCollectCoupon={id => { setCouponInvoiceId(id); setCouponsOpen(true) }} isActive={isActive} invoices={invoices} pageData={state.data} loading={state.status === 'loading'} detailLoading={detail.status === 'loading'} editingInvoiceId={editingInvoiceId} deletingInvoiceId={deleting ? deleteTarget?.id : null} localCurrency={localCurrency} showBooks showNotes onOpenInvoice={handleOpenInvoice} onEditInvoice={setEditingInvoiceId} onDeleteInvoice={setDeleteTarget} onPreviousPage={() => setPage((current) => current - 1)} onNextPage={() => setPage((current) => current + 1)} />}
      </section>
      {couponsOpen && <CouponCollectionModal invoiceId={couponInvoiceId} bookFairId={activeBookFair.id} localCurrency={localCurrency} onClose={() => setCouponsOpen(false)} onSaved={() => { setCouponsOpen(false); setRefreshKey(k => k + 1); onDataChanged?.() }} />}
      <InvoiceDetailsOverlay detail={detail} localCurrency={localCurrency} exhibitionName={exhibitionName} onClose={closeInvoice} />
      {editingInvoiceId != null && <EditInvoiceModal invoiceId={editingInvoiceId} bookFairId={activeBookFair.id} localCurrency={localCurrency} onClose={() => setEditingInvoiceId(null)} onSaved={handleInvoiceUpdated} />}
      {deleteOpen && <DeleteDataConfirmModal title="حذف كل الفواتير" description={`هيتم حذف كل فواتير ${activeBookFair.name} وبنودها، وإرجاع كميات كتب الفواتير غير المرتجعة للمخزون.`} phrase="حذف كل الفواتير" confirmLabel="حذف كل الفواتير نهائياً" isBusy={deleting} onClose={() => setDeleteOpen(false)} onConfirm={handleDeleteAllInvoices} />}
      {deleteTarget && <DeleteDataConfirmModal title="حذف الفاتورة" warningTitle={deleteTarget.paymentType === 'WHOLESALE_CREDIT' ? 'تأثير حذف فاتورة المكتبة' : 'راجع قبل حذف الفاتورة'} description={<InvoiceDeleteDescription invoice={deleteTarget} />} phrase="حذف الفاتورة" confirmLabel="تأكيد حذف الفاتورة" isBusy={deleting} onClose={() => setDeleteTarget(null)} onConfirm={handleDeleteInvoice} />}
    </div>
  )
}
