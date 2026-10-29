import { CouponCollectionModal } from '../components/invoices/CouponCollectionModal.jsx'
import { fetchCouponReceipts } from '../api/invoices.js'
import { EditInvoiceModal } from '../components/invoices/EditInvoiceModal.jsx'
import { useEffect, useMemo, useState } from 'react'
import { fetchLibraryBalances } from '../api/libraries.js'
import { exportReport, fetchDailyLibraryPayments, fetchReportInvoices, fetchReportRefundInvoices } from '../api/reports.js'
import { ReportMoney } from '../components/invoices/InvoiceBooks.jsx'
import { InvoiceDetailsOverlay } from '../components/invoices/InvoiceDetailsOverlay.jsx'
import { InvoicesTable } from '../components/invoices/InvoicesTable.jsx'
import { ReportTotals } from '../components/reports/ReportTotals.jsx'
import { DashboardOverview } from '../components/reports/DashboardOverview.jsx'
import { AppDropdown } from '../components/ui/AppDropdown.jsx'
import { Icon } from '../components/ui/Icon.jsx'
import { Notice } from '../components/ui/Notice.jsx'
import { Toast } from '../components/ui/Toast.jsx'
import { TablePagination } from '../components/ui/TablePagination.jsx'
import { useInvoiceDetails } from '../hooks/useInvoiceDetails.js'
import { getLocalCurrencySalesReportName } from '../utils/currency.js'
import { toArabicToastMessage } from '../utils/messages.js'
import { calculateReportTotals, mergeReportInvoices } from '../utils/reportTotals.js'

const REPORT_PAGE_SIZE = 5
const PAYMENT_PAGE_SIZE = 5
const exportTypes = {
  'reports-dashboard': 'DASHBOARD',
  'reports-daily': 'DAILY',
  'reports-cash': 'DIRECT_CASH',
  'reports-visa': 'DIRECT_VISA',
  'reports-libraries': 'LIBRARIES',
  'reports-gifts': 'GIFTS',
  'reports-refunds': 'REFUNDS',
  'reports-local-currency': 'LOCAL_CURRENCY',
  'reports-dollar': 'DOLLAR',
  'reports-coupons': 'COUPONS',
}

const reportNavigation = [
  ['reports-dashboard', 'نظرة عامة'],
  ['reports-daily', 'يومي'],
  ['reports-cash', 'فواتير نقدي'],
  ['reports-visa', 'فواتير فيزا'],
  ['reports-libraries', 'المكتبات'],
  ['reports-gifts', 'الهدايا'],
  ['reports-coupons', 'الكوبونات'],
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
    'reports-daily': { title: 'التقارير اليومية', description: 'راجع مبيعات اليوم ودفعات المكتبات والمبالغ المردودة فيه. صافي التحصيل = المحصل فعلياً − المبالغ المرتجعة.', empty: 'مفيش فواتير أو مرتجعات في التاريخ المحدد.' },
    'reports-cash': { title: 'فواتير البيع المباشر النقدي', description: 'راجع فواتير البيع المباشر المدفوعة نقداً وإجمالياتها.', empty: 'مفيش فواتير بيع مباشر مدفوعة نقداً في المعرض ده.' },
    'reports-visa': { title: 'فواتير البيع المباشر بالفيزا', description: 'راجع فواتير البيع المباشر المدفوعة بالفيزا وإجمالياتها.', empty: 'مفيش فواتير بيع مباشر مدفوعة بالفيزا في المعرض ده.' },
    'reports-libraries': { title: 'مبيعات المكتبات', description: 'راجع مبيعات المكتبات ودفعاتها. تفاصيل الحساب والتحصيل في حسابات المكتبات.', empty: 'مفيش فواتير بيع آجل للمكتبات في المعرض ده.' },
    'reports-coupons': { title: 'تقارير الكوبونات', description: 'فواتير الكوبونات والمستحق على إدارة المعرض والتحصيلات والمرتجعات.', empty: 'مفيش فواتير كوبونات في المعرض ده.' },
    'reports-gifts': { title: 'تقارير الهدايا', description: 'راجع فواتير الهدايا وقيمتها بدون احتسابها كإيراد.', empty: 'مفيش فواتير هدايا في المعرض ده.' },
    'reports-refunds': { title: 'تقارير المرتجعات', description: 'راجع الفواتير المرتجعة وقيمة المبالغ المرتجعة.', empty: 'مفيش فواتير مرتجعة في المعرض ده.' },
    'reports-local-currency': { title: getLocalCurrencySalesReportName(localCurrency), description: 'راجع كل المبيعات المسجلة بالعملة المحلية.', empty: 'مفيش فواتير بالعملة المحلية في المعرض ده.' },
    'reports-dollar': { title: 'المبيعات بالدولار', description: 'راجع كل المبيعات المسجلة بالدولار.', empty: 'مفيش فواتير بالدولار في المعرض ده.' },
  }
  return reports[reportPage] || reports['reports-dashboard']
}

function getReportFilters(reportPage, activeBookFair, date) {
  if (reportPage === 'reports-daily') return { date }
  if (reportPage === 'reports-cash') return { paymentType: 'DIRECT', paymentMethod: 'CASH' }
  if (reportPage === 'reports-visa') return { paymentType: 'DIRECT', paymentMethod: 'VISA' }
  if (reportPage === 'reports-coupons') return { paymentType: 'DIRECT', paymentMethod: 'COUPON' }
  if (reportPage === 'reports-libraries') return { paymentType: 'WHOLESALE_CREDIT' }
  if (reportPage === 'reports-gifts') return { paymentType: 'GIFT' }
  if (reportPage === 'reports-local-currency') return { currency: activeBookFair.primaryCurrency || activeBookFair.localCurrency?.code }
  if (reportPage === 'reports-dollar') return { currency: 'USD' }
  return {}
}

export function ReportsPage({ reportPage, activeBookFair, localCurrency, dataVersion, onDataChanged }) {
  const [date, setDate] = useState(getToday)
  const [page, setPage] = useState(0)
  const [paymentPage, setPaymentPage] = useState(0)
  const [refreshKey, setRefreshKey] = useState(0)
  const [state, setState] = useState({ status: 'loading', data: null })
  const [toast, setToast] = useState(null)
  const [exporting, setExporting] = useState(false)
  const [couponsOpen, setCouponsOpen] = useState(false)
  const [couponInvoiceId, setCouponInvoiceId] = useState(null)
  const [editingInvoiceId, setEditingInvoiceId] = useState(null)
  const { detail, openInvoice, closeInvoice } = useInvoiceDetails(activeBookFair?.id)
  const report = getReportDetails(reportPage, localCurrency)
  const navigation = reportNavigation.map(([route, label]) => [route, route === 'reports-local-currency' ? localCurrency?.nameAr || label : label])

  useEffect(() => {
    setPage(0)
    setEditingInvoiceId(null)
    setCouponsOpen(false)
    setPaymentPage(0)
    setToast(null)
    closeInvoice()
  }, [activeBookFair?.id, reportPage, date])

  useEffect(() => {
    if (!reportPage || !activeBookFair?.id || (reportPage === 'reports-daily' && !date)) {
      setState({ status: 'idle', data: null })
      return undefined
    }

    const controller = new AbortController()
    const filters = getReportFilters(reportPage, activeBookFair, date)
    setState({ status: 'loading', data: null })
    const includesAccounts = ['reports-dashboard', 'reports-daily', 'reports-libraries', 'reports-local-currency', 'reports-dollar'].includes(reportPage)
    const invoiceRequest = reportPage === 'reports-refunds'
      ? fetchReportRefundInvoices({ bookFairId: activeBookFair.id, signal: controller.signal })
      : Promise.all([
          fetchReportInvoices({ bookFairId: activeBookFair.id, ...filters, signal: controller.signal }).then((response) => response.data || []),
          fetchReportRefundInvoices({ bookFairId: activeBookFair.id, signal: controller.signal }),
        ]).then(([sales, refunds]) => mergeReportInvoices(sales, refunds, filters))
    const reportRequest = Promise.all([
      invoiceRequest,
      !['reports-libraries', 'reports-gifts', 'reports-refunds'].includes(reportPage)
        ? fetchCouponReceipts({ bookFairId: activeBookFair.id, date: reportPage === 'reports-daily' ? date : undefined, signal: controller.signal }).then(response => response.data || []) : [],
      includesAccounts ? fetchDailyLibraryPayments({ bookFairId: activeBookFair.id,
        date: reportPage === 'reports-daily' ? date : undefined, signal: controller.signal }).then((response) => response.data || []) : [],
      includesAccounts && reportPage !== 'reports-daily'
        ? fetchLibraryBalances({ bookFairId: activeBookFair.id, signal: controller.signal }).then((response) => response.data || []) : null,
    ]).then(([invoices, couponReceipts, payments, balances]) => ({
      couponReceipts,
      invoices,
      payments: filters.currency ? payments.filter((payment) => payment.currency === filters.currency) : payments,
      balances: filters.currency && balances ? balances.filter((balance) => balance.currency === filters.currency) : balances,
    }))

    reportRequest
      .then((data) => setState({ status: 'ready', data }))
      .catch((error) => {
        if (error.name === 'AbortError') return
        setState({ status: 'error', data: null })
        setToast({ tone: 'error', message: toArabicToastMessage(error.message, 'تعذر تحميل بيانات التقرير. حاول تاني.') })
      })

    return () => controller.abort()
  }, [activeBookFair?.id, activeBookFair?.primaryCurrency, reportPage, date, refreshKey, dataVersion])

  const dailyPayments = useMemo(() => {
    if (state.status !== 'ready') return []
    return [...(state.data?.payments || [])].sort((first, second) =>
      String(second.paidAt || '').localeCompare(String(first.paidAt || ''))
      || Number(second.id || 0) - Number(first.id || 0))
  }, [state])
  const paymentTotalPages = Math.ceil(dailyPayments.length / PAYMENT_PAGE_SIZE)
  const currentPaymentPage = Math.min(paymentPage, Math.max(0, paymentTotalPages - 1))
  const visiblePayments = dailyPayments.slice(currentPaymentPage * PAYMENT_PAGE_SIZE, (currentPaymentPage + 1) * PAYMENT_PAGE_SIZE)
  const accountBalances = state.status === 'ready' ? state.data?.balances : null
  const invoices = useMemo(() => {
    const data = Array.isArray(state.data) ? state.data : state.data?.invoices
    if (!Array.isArray(data)) return []
    const paymentMethod = reportPage === 'reports-cash' ? 'CASH' : reportPage === 'reports-visa' ? 'VISA' : null
    const matchingInvoices = paymentMethod
      ? data.filter((invoice) => invoice.paymentType === 'DIRECT' && (invoice.paymentMethod === paymentMethod || paymentMethod === 'CASH' && invoice.paymentMethod === 'COUPON' && (invoice.returnHistory || []).some(r => Number(r.cashAmount) > 0)))
      : data
    return [...matchingInvoices].sort((first, second) => {
      const dateField = reportPage === 'reports-refunds' ? 'refundAt' : 'businessDate'
      const dateOrder = String(second[dateField] || '').localeCompare(String(first[dateField] || ''))
      return dateOrder || Number(second.id || 0) - Number(first.id || 0)
    })
  }, [state.data, reportPage])
  const totalPages = Math.ceil(invoices.length / REPORT_PAGE_SIZE)
  const couponReceipts = useMemo(() => (state.data?.couponReceipts || []).filter(receipt =>
    (!['reports-local-currency', 'reports-dollar'].includes(reportPage) || receipt.currency === (reportPage === 'reports-dollar' ? 'USD' : activeBookFair?.primaryCurrency))
    && (reportPage !== 'reports-cash' || receipt.collection.paymentMethod === 'CASH')
    && (reportPage !== 'reports-visa' || receipt.collection.paymentMethod === 'VISA')), [state.data, reportPage, activeBookFair?.primaryCurrency])
  const reportTotals = useMemo(() => calculateReportTotals(invoices, dailyPayments, accountBalances, { daily: reportPage === 'reports-daily', date, couponReceipts, paymentMethod: reportPage === 'reports-cash' ? 'CASH' : reportPage === 'reports-visa' ? 'VISA' : null }), [invoices, dailyPayments, accountBalances, reportPage, date, couponReceipts])
  const visibleInvoices = invoices.slice(page * REPORT_PAGE_SIZE, (page + 1) * REPORT_PAGE_SIZE)
  const pageData = {
    number: page,
    size: REPORT_PAGE_SIZE,
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

  if (!activeBookFair) {
    return <div className="page"><section className="page-heading"><div><h1>{report.title}</h1><p>{report.description}</p></div><div className="page-heading__icon"><Icon name="reports" size={28} /></div></section><Notice tone="info" title="اختار معرض أولاً">كل تقرير مرتبط ببيانات معرض محدد.</Notice><a className="button button--primary empty-state-action" href="#settings"><Icon name="settings" size={18} />فتح إعدادات المعرض</a></div>
  }

  return (
    <div className="page reports-page">
      {toast && <Toast tone={toast.tone} message={toast.message} onClose={() => setToast(null)} />}
      <section className="page-heading"><div><h1>{report.title}</h1><p>{report.description}</p></div><div className="page-heading__actions">{reportPage === 'reports-coupons' && <button className="button button--secondary" type="button" onClick={() => { setCouponInvoiceId(null); setCouponsOpen(true) }}>تحصيل كوبونات المعرض</button>}{reportPage === 'reports-libraries' ? <a className="button button--primary" href="#libraries"><Icon name="download" size={18} />تصدير حسابات المكتبات</a> : <button className="button button--primary" type="button" disabled={exporting} onClick={handleExport}>{exporting ? <span className="spinner" /> : <Icon name="download" size={18} />}{exporting ? 'جاري التصدير…' : 'تصدير Excel'}</button>}<div className="page-heading__icon"><Icon name="reports" size={28} /></div></div></section>

      <Notice tone="info" title="نطاق تصدير Excel">الملفات المصدرة من التقارير تشمل البيع المباشر والهدايا ومرتجعاتهما فقط. فواتير المكتبات ودفعاتها ومرتجعاتها تصدر من حسابات المكتبات. إجماليات الشاشة تشمل كل الحركات حسب نوع التقرير.</Notice>

      <nav className="report-switcher" aria-label="أنواع التقارير">
        <div className="report-switcher__links">
          {navigation.map(([route, label]) => <a className={reportPage === route ? 'is-active' : ''} href={`#${route}`} key={route}>{label}</a>)}
        </div>
        <div className="report-switcher__select"><span>نوع التقرير</span><AppDropdown ariaLabel="نوع التقرير" value={reportPage || 'reports-dashboard'} options={navigation.map(([route, label]) => ({ value: route, label }))} onChange={(route) => { window.location.hash = route }} /></div>
      </nav>

      {reportPage === 'reports-daily' && <section className="panel report-filters"><label className="form-field"><span>تاريخ التقرير</span><input name="report-date" autoComplete="off" type="date" dir="ltr" value={date} onChange={(event) => { setDate(event.target.value); setPage(0) }} /></label></section>}


      {reportPage === 'reports-dashboard' && state.status === 'ready' && invoices.length > 0 && <DashboardOverview invoices={invoices} />}
      {state.status === 'ready' && (reportTotals.length > 0) && <ReportTotals totals={reportTotals} localCurrency={localCurrency} reportPage={reportPage} />}

      {state.status === 'ready' && dailyPayments.length > 0 && (
        <section className="panel catalog-panel">
          <div className="catalog-toolbar"><div><h2>{reportPage === 'reports-daily' ? `دفعات المكتبات المحصلة يوم ${date}` : 'دفعات حسابات المكتبات'}</h2><p>دفعات مستقلة عن الفواتير.</p></div><div className="catalog-toolbar__actions report-payments-actions"><a className="button button--secondary" href="#libraries"><Icon name="books" size={17} />فتح حسابات المكتبات</a><div className="catalog-count"><span>الدفعات</span><strong>{dailyPayments.length}</strong></div></div></div>
          <TablePagination page={currentPaymentPage} totalPages={paymentTotalPages} onPrevious={() => setPaymentPage(currentPaymentPage - 1)} onNext={() => setPaymentPage(currentPaymentPage + 1)} ariaLabel="صفحات دفعات حسابات المكتبات" />
          <div className="table-wrap history-table-wrap"><table className="history-table"><thead><tr><th>رقم الدفعة</th><th>المكتبة</th><th>تاريخ الدفع</th><th>طريقة الدفع</th><th>المبلغ المحصل</th><th>مرجع تاريخي</th></tr></thead><tbody>{visiblePayments.map((payment) => <tr key={payment.id}><td data-label="رقم الدفعة"><bdi>#{payment.id}</bdi></td><td data-label="المكتبة">{payment.libraryName}</td><td data-label="تاريخ الدفع"><bdi>{payment.paidAt}</bdi></td><td data-label="طريقة الدفع">{payment.paymentMethod === 'CASH' ? 'نقدي' : 'فيزا'}</td><td data-label="المبلغ المحصل"><ReportMoney tone={payment.paymentMethod === 'VISA' ? 'visa' : 'received'} value={payment.amount} currency={payment.currency} localCurrency={localCurrency} /></td><td data-label="مرجع تاريخي">{payment.invoiceId ? <button className="button button--table" type="button" disabled={detail.status === 'loading'} onClick={() => handleOpenInvoice(payment.invoiceId)}>فاتورة <bdi>{payment.invoiceNumber || "غير متاح"}</bdi></button> : 'على الحساب'}</td></tr>)}</tbody></table></div>
        </section>
      )}

      <section className="panel catalog-panel">
        <div className="catalog-toolbar"><div><h2>{report.title}</h2><p>{activeBookFair.name}</p></div><div className="catalog-count"><Icon name="invoice" size={17} /><span>الإجمالي</span><strong>{invoices.length}</strong></div></div>
        {state.status === 'loading' && <div className="catalog-state"><span className="spinner spinner--large" /><strong>جاري تحميل التقرير...</strong></div>}
        {state.status === 'error' && <div className="catalog-state"><span className="catalog-state__icon"><Icon name="reports" size={28} /></span><strong>تعذر تحميل التقرير</strong><p>حاول تحميل البيانات مرة تانية.</p><button className="button button--secondary" type="button" onClick={() => setRefreshKey((current) => current + 1)}>حاول تاني</button></div>}
        {state.status === 'ready' && invoices.length === 0 && <div className="catalog-state"><span className="catalog-state__icon"><Icon name="reports" size={28} /></span><strong>{report.empty}</strong></div>}
        {state.status === 'ready' && invoices.length > 0 && <InvoicesTable onCollectCoupon={reportPage === 'reports-coupons' ? id => { setCouponInvoiceId(id); setCouponsOpen(true) } : undefined} invoices={visibleInvoices} pageData={pageData} loading={false} detailLoading={detail.status === 'loading'} editingInvoiceId={editingInvoiceId} onEditInvoice={setEditingInvoiceId} localCurrency={localCurrency} showBooks showBookAmounts dailyReport={reportPage === 'reports-daily'} reportDate={date} dateField={reportPage === 'reports-refunds' ? 'refundAt' : 'businessDate'} dateLabel={reportPage === 'reports-refunds' ? 'تاريخ المرتجع' : 'التاريخ'} onOpenInvoice={handleOpenInvoice} onPreviousPage={() => setPage((current) => current - 1)} onNextPage={() => setPage((current) => current + 1)} />}
      </section>

      {editingInvoiceId != null && <EditInvoiceModal invoiceId={editingInvoiceId} bookFairId={activeBookFair.id} localCurrency={localCurrency} onClose={() => setEditingInvoiceId(null)} onSaved={() => { setEditingInvoiceId(null); closeInvoice(); setRefreshKey((current) => current + 1); onDataChanged(); setToast({ tone: 'success', message: 'تم تعديل الفاتورة وتحديث التقرير.' }) }} />}
      {couponReceipts.length > 0 && <section className="panel"><div className="panel__heading"><h2>تحصيل الكوبونات من إدارة المعرض</h2><p>هذه المبالغ داخلة بالفعل في المحصل والنقدي أو الفيزا؛ لا تُضاف مرة ثانية.</p></div><div className="table-wrap"><table className="history-table"><thead><tr><th>الفاتورة</th><th>تاريخ التحصيل</th><th>طريقة التحصيل</th><th>المبلغ</th></tr></thead><tbody>{couponReceipts.map(r => <tr key={`${r.invoiceId}-${r.collection.requestId}`}><td data-label="الفاتورة"><button className="button button--table" onClick={() => handleOpenInvoice(r.invoiceId)}>{r.invoiceNumber}</button></td><td data-label="تاريخ التحصيل">{r.collection.paidAt}</td><td data-label="طريقة التحصيل">{r.collection.paymentMethod === 'CASH' ? 'نقدي' : 'فيزا'}</td><td data-label="المبلغ"><ReportMoney tone="received" value={r.collection.amount} currency={r.currency} localCurrency={localCurrency} /></td></tr>)}</tbody></table></div></section>}
      {couponsOpen && <CouponCollectionModal invoiceId={couponInvoiceId} bookFairId={activeBookFair.id} localCurrency={localCurrency} onClose={() => setCouponsOpen(false)} onSaved={() => { setCouponsOpen(false); setRefreshKey(k => k + 1); onDataChanged?.() }} />}
      <InvoiceDetailsOverlay detail={detail} localCurrency={localCurrency} exhibitionName={activeBookFair.name} onClose={closeInvoice} />
    </div>
  )
}
