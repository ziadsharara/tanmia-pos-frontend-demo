import { useEffect, useState } from 'react'
import { deleteAllInvoices, deleteInvoice, fetchInvoices, recordLibraryPayment } from '../api/invoices.js'
import { InvoiceDetailsOverlay } from '../components/invoices/InvoiceDetailsOverlay.jsx'
import { EditInvoiceModal } from '../components/invoices/EditInvoiceModal.jsx'
import { InvoicesTable } from '../components/invoices/InvoicesTable.jsx'
import { LibraryPaymentModal } from '../components/invoices/LibraryPaymentModal.jsx'
import { DeleteDataConfirmModal } from '../components/ui/DeleteDataConfirmModal.jsx'
import { Icon } from '../components/ui/Icon.jsx'
import { Notice } from '../components/ui/Notice.jsx'
import { Toast } from '../components/ui/Toast.jsx'
import { useInvoiceDetails } from '../hooks/useInvoiceDetails.js'
import { toArabicToastMessage } from '../utils/messages.js'

export function InvoicesPage({ isActive, localCurrency, exhibitionName, activeBookFair, dataVersion, onDataChanged }) {
  const [page, setPage] = useState(0)
  const [state, setState] = useState({ status: 'loading', data: null, error: '' })
  const [toast, setToast] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [paymentTarget, setPaymentTarget] = useState(null)
  const [editingInvoiceId, setEditingInvoiceId] = useState(null)
  const [recordingPayment, setRecordingPayment] = useState(false)
  const { detail, openInvoice, closeInvoice } = useInvoiceDetails(activeBookFair?.id)

  useEffect(() => {
    if (!isActive) return undefined
    if (!activeBookFair?.id) {
      setState({ status: 'idle', data: null, error: '' })
      return undefined
    }
    const controller = new AbortController()
    setState({ status: 'loading', data: null, error: '' })
    fetchInvoices({ bookFairId: activeBookFair.id, page, size: 25, signal: controller.signal })
      .then((response) => setState({ status: 'ready', data: response.data, error: '' }))
      .catch((error) => { if (error.name !== 'AbortError') setState({ status: 'empty', data: null, error: '' }) })
    return () => controller.abort()
  }, [isActive, activeBookFair?.id, page, refreshKey, dataVersion])

  useEffect(() => {
    setPage(0)
    setToast(null)
    setDeleteOpen(false)
    setDeleteTarget(null)
    setPaymentTarget(null)
    setEditingInvoiceId(null)
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
      setToast({ tone: 'error', message: toArabicToastMessage(error instanceof Error ? error.message : '', 'تعذر حذف الفواتير. حاول تاني.') })
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

  const handleRecordPayment = async (payment) => {
    if (!paymentTarget || recordingPayment) return
    setRecordingPayment(true)
    try {
      const response = await recordLibraryPayment(paymentTarget.invoiceNumber, activeBookFair.id, payment)
      setPaymentTarget(null)
      setToast({ tone: 'success', message: toArabicToastMessage(response.message, 'تم تسجيل دفعة المكتبة وتحديث المدفوع والمتبقي بنجاح') })
      onDataChanged()
    } catch (error) {
      setToast({ tone: 'error', message: toArabicToastMessage(error instanceof Error ? error.message : '', 'تعذر تسجيل الدفعة. تأكد من المبلغ وحاول تاني.') })
    } finally {
      setRecordingPayment(false)
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
      <section className="page-heading"><div><h1>الفواتير</h1><p>راجع الفواتير المحفوظة وسجل دفعات المكتبات وافتح أي إيصال للطباعة.</p></div><div className="page-heading__actions"><button className="button button--danger-soft" type="button" disabled={!state.data?.totalElements || deleting || recordingPayment} onClick={() => setDeleteOpen(true)}><Icon name="trash" size={18} />حذف كل الفواتير</button><a className="button button--primary" href="#new-invoice"><Icon name="add" size={18} />فاتورة جديدة</a><div className="page-heading__icon"><Icon name="history" size={28} /></div></div></section>
      <section className="panel catalog-panel">
        <div className="catalog-toolbar"><div><h2>فواتير {activeBookFair.name}</h2></div><div className="catalog-count"><Icon name="invoice" size={17} /><span>الإجمالي</span><strong>{state.status === 'empty' ? 0 : state.data?.totalElements ?? '—'}</strong></div></div>
        {state.status === 'loading' && !state.data && <div className="catalog-state"><span className="spinner spinner--large" /><strong>جاري تحميل الفواتير...</strong></div>}
        {(state.status === 'empty' || (state.status === 'ready' && invoices.length === 0)) && <div className="catalog-state"><span className="catalog-state__icon"><Icon name="invoice" size={28} /></span><strong>مفيش فواتير محفوظة للمعرض ده</strong><p>أول فاتورة بيع في {activeBookFair.name} هتظهر هنا بعد حفظها.</p></div>}
        {state.data && invoices.length > 0 && <InvoicesTable invoices={invoices} pageData={state.data} loading={state.status === 'loading'} detailLoading={detail.status === 'loading'} editingInvoiceId={editingInvoiceId} deletingInvoiceId={deleting ? deleteTarget?.id : null} recordingPaymentId={recordingPayment ? paymentTarget?.id : null} localCurrency={localCurrency} showBooks onOpenInvoice={handleOpenInvoice} onEditInvoice={setEditingInvoiceId} onDeleteInvoice={setDeleteTarget} onRecordPayment={setPaymentTarget} onPreviousPage={() => setPage((current) => current - 1)} onNextPage={() => setPage((current) => current + 1)} />}
      </section>
      <InvoiceDetailsOverlay detail={detail} localCurrency={localCurrency} exhibitionName={exhibitionName} onClose={closeInvoice} />
      {editingInvoiceId != null && <EditInvoiceModal invoiceId={editingInvoiceId} bookFairId={activeBookFair.id} localCurrency={localCurrency} onClose={() => setEditingInvoiceId(null)} onSaved={handleInvoiceUpdated} />}
      {paymentTarget && <LibraryPaymentModal invoice={paymentTarget} localCurrency={localCurrency} isBusy={recordingPayment} onClose={() => setPaymentTarget(null)} onConfirm={handleRecordPayment} />}
      {deleteOpen && <DeleteDataConfirmModal title="حذف كل الفواتير" description={`هيتم حذف كل فواتير ${activeBookFair.name} وبنودها، وإرجاع كميات كتب الفواتير غير المرتجعة للمخزون.`} phrase="حذف كل الفواتير" confirmLabel="حذف كل الفواتير نهائياً" isBusy={deleting} onClose={() => setDeleteOpen(false)} onConfirm={handleDeleteAllInvoices} />}
      {deleteTarget && <DeleteDataConfirmModal title="حذف الفاتورة" description={`هيتم حذف الفاتورة رقم ${deleteTarget.invoiceNumber} وبنودها نهائياً، وإرجاع كميات كتبها للمخزون لو مش مرتجعة.`} phrase="حذف الفاتورة" confirmLabel="حذف الفاتورة نهائياً" isBusy={deleting} onClose={() => setDeleteTarget(null)} onConfirm={handleDeleteInvoice} />}
    </div>
  )
}
