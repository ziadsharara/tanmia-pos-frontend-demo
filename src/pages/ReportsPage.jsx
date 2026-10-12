import { useEffect, useMemo, useState } from 'react'
import { recordLibraryPayment } from '../api/invoices.js'
import { exportReport, fetchReportInvoices, fetchReportRefundInvoices } from '../api/reports.js'
import { InvoiceDetailsOverlay } from '../components/invoices/InvoiceDetailsOverlay.jsx'
import { InvoicesTable } from '../components/invoices/InvoicesTable.jsx'
import { LibraryPaymentModal } from '../components/invoices/LibraryPaymentModal.jsx'
import { ReportTotals } from '../components/reports/ReportTotals.jsx'
import { DashboardOverview } from '../components/reports/DashboardOverview.jsx'
import { AppDropdown } from '../components/ui/AppDropdown.jsx'
import { Icon } from '../components/ui/Icon.jsx'
import { Notice } from '../components/ui/Notice.jsx'
import { Toast } from '../components/ui/Toast.jsx'
import { useInvoiceDetails } from '../hooks/useInvoiceDetails.js'
import { getLocalCurrencySalesReportName } from '../utils/currency.js'
import { toArabicToastMessage } from '../utils/messages.js'
import { calculateReportTotals } from '../utils/reportTotals.js'

const REPORT_PAGE_SIZE = 25
const exportTypes = {
  'reports-dashboard': 'DASHBOARD',
  'reports-daily': 'DAILY',
  'reports-libraries': 'LIBRARIES',
  'reports-gifts': 'GIFTS',
  'reports-refunds': 'REFUNDS',
  'reports-local-currency': 'LOCAL_CURRENCY',
  'reports-dollar': 'DOLLAR',
}

const reportNavigation = [
  ['reports-dashboard', 'نظرة عامة'],
  ['reports-daily', 'يومي'],
  ['reports-libraries', 'المكتبات'],
  ['reports-gifts', 'الهدايا'],
  ['reports-refunds', 'المرتجعات'],
  ['reports-local-currency', 'العملة المحلية'],
  ['reports-dollar', 'الدولار'],
]

function getToday() {
  const today = new Date()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${today.getFullYear()}-${month}-${day}`
}

function getReportDetails(reportPage, localCurrency) {
  const reports = {
    'reports-dashboard': { title: 'لوحة التقارير', description: 'ملخص حركة المبيعات والدفع والمرتجعات في المعرض.', empty: 'مفيش فواتير محفوظة في المعرض ده.' },
    'reports-daily': { title: 'التقارير اليومية', description: 'راجع فواتير يوم محدد وإجمالياتها.', empty: 'مفيش فواتير محفوظة في التاريخ المحدد.' },
    'reports-libraries': { title: 'مبيعات المكتبات', description: 'راجع المبيعات الآجلة والمحصل والمتبقي وسجل دفعات المكتبات.', empty: 'مفيش فواتير بيع آجل للمكتبات في المعرض ده.' },
    'reports-gifts': { title: 'تقارير الهدايا', description: 'راجع فواتير الهدايا وقيمتها بدون احتسابها كإيراد.', empty: 'مفيش فواتير هدايا في المعرض ده.' },
    'reports-refunds': { title: 'تقارير المرتجعات', description: 'راجع الفواتير المرتجعة وقيمة المبالغ المرتجعة.', empty: 'مفيش فواتير مرتجعة في المعرض ده.' },
    'reports-local-currency': { title: getLocalCurrencySalesReportName(localCurrency), description: 'راجع كل المبيعات المسجلة بالعملة المحلية.', empty: 'مفيش فواتير بالعملة المحلية في المعرض ده.' },
    'reports-dollar': { title: 'المبيعات بالدولار', description: 'راجع كل المبيعات المسجلة بالدولار.', empty: 'مفيش فواتير بالدولار في المعرض ده.' },
  }
  return reports[reportPage] || reports['reports-dashboard']
}

function getReportFilters(reportPage, activeBookFair, date) {
  if (reportPage === 'reports-daily') return { date }
  if (reportPage === 'reports-libraries') return { paymentType: 'WHOLESALE_CREDIT' }
  if (reportPage === 'reports-gifts') return { paymentType: 'GIFT' }
  if (reportPage === 'reports-local-currency') return { currency: activeBookFair.primaryCurrency || activeBookFair.localCurrency?.code }
  if (reportPage === 'reports-dollar') return { currency: 'USD' }
  return {}
}

export function ReportsPage({ reportPage, activeBookFair, localCurrency, dataVersion, onDataChanged }) {
  const [date, setDate] = useState(getToday)
  const [page, setPage] = useState(0)
  const [refreshKey, setRefreshKey] = useState(0)
  const [state, setState] = useState({ status: 'loading', data: null })
  const [toast, setToast] = useState(null)
  const [exporting, setExporting] = useState(false)
  const [paymentTarget, setPaymentTarget] = useState(null)
  const [recordingPayment, setRecordingPayment] = useState(false)
  const { detail, openInvoice, closeInvoice } = useInvoiceDetails(activeBookFair?.id)
  const report = getReportDetails(reportPage, localCurrency)
  const navigation = reportNavigation.map(([route, label]) => [route, route === 'reports-local-currency' ? localCurrency?.nameAr || label : label])

  useEffect(() => {
    setPage(0)
    setToast(null)
    setPaymentTarget(null)
    closeInvoice()
  }, [activeBookFair?.id, reportPage])

  useEffect(() => {
    if (!reportPage || !activeBookFair?.id || (reportPage === 'reports-daily' && !date)) {
      setState({ status: 'idle', data: null })
      return undefined
    }

    const controller = new AbortController()
    const filters = getReportFilters(reportPage, activeBookFair, date)
    setState({ status: 'loading', data: null })
    const reportRequest = reportPage === 'reports-refunds'
      ? fetchReportRefundInvoices({ bookFairId: activeBookFair.id, signal: controller.signal })
      : reportPage === 'reports-dashboard'
        ? Promise.all([
            fetchReportInvoices({ bookFairId: activeBookFair.id, signal: controller.signal }).then((response) => response.data || []),
            fetchReportRefundInvoices({ bookFairId: activeBookFair.id, signal: controller.signal }),
          ]).then(([sales, refunds]) => [...sales, ...refunds])
        : fetchReportInvoices({ bookFairId: activeBookFair.id, ...filters, signal: controller.signal }).then((response) => response.data)

    reportRequest
      .then((data) => setState({ status: 'ready', data }))
      .catch((error) => {
        if (error.name === 'AbortError') return
        setState({ status: 'error', data: null })
        setToast({ tone: 'error', message: toArabicToastMessage(error.message, 'تعذر تحميل بيانات التقرير. حاول تاني.') })
      })

    return () => controller.abort()
  }, [activeBookFair?.id, activeBookFair?.primaryCurrency, reportPage, date, refreshKey, dataVersion])

  const invoices = useMemo(() => {
    if (!Array.isArray(state.data)) return []
    return [...state.data].sort((first, second) => {
      const dateField = reportPage === 'reports-refunds' ? 'refundAt' : 'businessDate'
      const dateOrder = String(second[dateField] || '').localeCompare(String(first[dateField] || ''))
      return dateOrder || Number(second.id || 0) - Number(first.id || 0)
    })
  }, [state.data, reportPage])
  const totalPages = Math.ceil(invoices.length / REPORT_PAGE_SIZE)
  const reportTotals = useMemo(() => calculateReportTotals(invoices), [invoices])
  const visibleInvoices = invoices.slice(page * REPORT_PAGE_SIZE, (page + 1) * REPORT_PAGE_SIZE)
  const pageData = {
    number: page,
    totalPages,
    totalElements: invoices.length,
    last: page + 1 >= totalPages,
  }

  useEffect(() => {
    if (totalPages > 0 && page >= totalPages) setPage(totalPages - 1)
  }, [page, totalPages])

  const handleOpenInvoice = async (invoiceId) => {
    const error = await openInvoice(invoiceId)
    if (error) {
      setToast({ tone: 'error', message: toArabicToastMessage(error instanceof Error ? error.message : '', 'تعذر فتح تفاصيل الفاتورة. حاول تاني.') })
    }
  }

  const handleExport = async () => {
    if (exporting || !activeBookFair?.id) return
    setExporting(true)
    try {
      const file = await exportReport({
        bookFairId: activeBookFair.id,
        reportType: exportTypes[reportPage],
        date: reportPage === 'reports-daily' ? date : undefined,
        currency: reportPage === 'reports-local-currency'
          ? activeBookFair.primaryCurrency || activeBookFair.localCurrency?.code
          : undefined,
      })
      const downloadUrl = URL.createObjectURL(file)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = `${report.title}-${activeBookFair.name}-${getToday()}.xlsx`.replace(/[\\/:*?"<>|]/g, '-')
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 0)
      setToast({ tone: 'success', message: 'تم تصدير التقرير إلى Excel بنجاح.' })
    } catch (error) {
      setToast({ tone: 'error', message: toArabicToastMessage(error instanceof Error ? error.message : '', 'تعذر تصدير التقرير. حاول تاني.') })
    } finally {
      setExporting(false)
    }
  }

  const handleRecordPayment = async (payment) => {
    if (!paymentTarget || recordingPayment) return
    setRecordingPayment(true)
    try {
      const response = await recordLibraryPayment(paymentTarget.invoiceNumber, activeBookFair.id, payment)
      setPaymentTarget(null)
      setToast({ tone: 'success', message: toArabicToastMessage(response.message, 'تم تسجيل دفعة المكتبة وتحديث التقرير بنجاح') })
      onDataChanged()
    } catch (error) {
      setToast({ tone: 'error', message: toArabicToastMessage(error instanceof Error ? error.message : '', 'تعذر تسجيل الدفعة. تأكد من المبلغ وحاول تاني.') })
    } finally {
      setRecordingPayment(false)
    }
  }

  if (!activeBookFair) {
    return <div className="page"><section className="page-heading"><div><h1>{report.title}</h1><p>{report.description}</p></div><div className="page-heading__icon"><Icon name="reports" size={28} /></div></section><Notice tone="info" title="اختار معرض أولاً">كل تقرير مرتبط ببيانات معرض محدد.</Notice><a className="button button--primary empty-state-action" href="#settings"><Icon name="settings" size={18} />فتح إعدادات المعرض</a></div>
  }

  return (
    <div className="page reports-page">
      {toast && <Toast tone={toast.tone} message={toast.message} onClose={() => setToast(null)} />}
      <section className="page-heading"><div><h1>{report.title}</h1><p>{report.description}</p></div><div className="page-heading__actions"><button className="button button--primary" type="button" disabled={exporting} onClick={handleExport}>{exporting ? <span className="spinner" /> : <Icon name="download" size={18} />}{exporting ? 'جاري التصدير…' : 'تصدير Excel'}</button><div className="page-heading__icon"><Icon name="reports" size={28} /></div></div></section>

      <nav className="report-switcher" aria-label="أنواع التقارير">
        <div className="report-switcher__links">
          {navigation.map(([route, label]) => <a className={reportPage === route ? 'is-active' : ''} href={`#${route}`} key={route}>{label}</a>)}
        </div>
        <div className="report-switcher__select"><span>نوع التقرير</span><AppDropdown ariaLabel="نوع التقرير" value={reportPage || 'reports-dashboard'} options={navigation.map(([route, label]) => ({ value: route, label }))} onChange={(route) => { window.location.hash = route }} /></div>
      </nav>

      {reportPage === 'reports-daily' && <section className="panel report-filters"><label className="form-field"><span>تاريخ التقرير</span><input name="report-date" autoComplete="off" type="date" dir="ltr" value={date} onChange={(event) => { setDate(event.target.value); setPage(0) }} /></label></section>}

      {reportPage === 'reports-dashboard' && state.status === 'ready' && invoices.length > 0 && <DashboardOverview invoices={invoices} />}
      {state.status === 'ready' && invoices.length > 0 && <ReportTotals totals={reportTotals} localCurrency={localCurrency} reportPage={reportPage} />}

      <section className="panel catalog-panel">
        <div className="catalog-toolbar"><div><h2>{report.title}</h2><p>{activeBookFair.name}</p></div><div className="catalog-count"><Icon name="invoice" size={17} /><span>الإجمالي</span><strong>{invoices.length}</strong></div></div>
        {state.status === 'loading' && <div className="catalog-state"><span className="spinner spinner--large" /><strong>جاري تحميل التقرير...</strong></div>}
        {state.status === 'error' && <div className="catalog-state"><span className="catalog-state__icon"><Icon name="reports" size={28} /></span><strong>تعذر تحميل التقرير</strong><p>حاول تحميل البيانات مرة تانية.</p><button className="button button--secondary" type="button" onClick={() => setRefreshKey((current) => current + 1)}>حاول تاني</button></div>}
        {state.status === 'ready' && invoices.length === 0 && <div className="catalog-state"><span className="catalog-state__icon"><Icon name="reports" size={28} /></span><strong>{report.empty}</strong></div>}
        {state.status === 'ready' && invoices.length > 0 && <InvoicesTable invoices={visibleInvoices} pageData={pageData} loading={false} detailLoading={detail.status === 'loading'} recordingPaymentId={recordingPayment ? paymentTarget?.id : null} localCurrency={localCurrency} showBooks dateField={reportPage === 'reports-refunds' ? 'refundAt' : 'businessDate'} dateLabel={reportPage === 'reports-refunds' ? 'تاريخ المرتجع' : 'التاريخ'} onOpenInvoice={handleOpenInvoice} onRecordPayment={reportPage === 'reports-libraries' ? setPaymentTarget : undefined} onPreviousPage={() => setPage((current) => current - 1)} onNextPage={() => setPage((current) => current + 1)} />}
      </section>

      <InvoiceDetailsOverlay detail={detail} localCurrency={localCurrency} exhibitionName={activeBookFair.name} onClose={closeInvoice} />
      {paymentTarget && <LibraryPaymentModal invoice={paymentTarget} localCurrency={localCurrency} isBusy={recordingPayment} onClose={() => setPaymentTarget(null)} onConfirm={handleRecordPayment} />}
    </div>
  )
}
