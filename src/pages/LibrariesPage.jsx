import { HistoricalAdjustmentsModal } from '../components/libraries/HistoricalAdjustmentsModal.jsx'
import { InvoiceDeleteDescription } from '../components/invoices/InvoiceDeleteDescription.jsx'
import { deleteInvoice } from '../api/invoices.js'
import { DeleteDataConfirmModal } from '../components/ui/DeleteDataConfirmModal.jsx'
import { useEffect, useState } from 'react'
import { fetchLibraries, fetchLibraryInvoices, fetchLibraryPayments, fetchLibraryStatement } from '../api/libraries.js'
import { LibraryAccountPaymentForm } from '../components/libraries/LibraryAccountPaymentForm.jsx'
import { LibraryDailyExport, LibraryRecordsExportButton } from '../components/libraries/LibraryDailyExport.jsx'
import { AccountPagination, LibraryInvoicesTable, LibraryPaymentsTable, StatementTable } from '../components/libraries/LibraryAccountTables.jsx'
import { InvoiceDetailsOverlay } from '../components/invoices/InvoiceDetailsOverlay.jsx'
import { AppDropdown } from '../components/ui/AppDropdown.jsx'
import { Icon } from '../components/ui/Icon.jsx'
import { Notice } from '../components/ui/Notice.jsx'
import { Toast } from '../components/ui/Toast.jsx'
import { useInvoiceDetails } from '../hooks/useInvoiceDetails.js'
import { formatMoney, getCurrencyName } from '../utils/currency.js'
import { businessToday, libraryAccountError, libraryBalanceLabel, libraryReturnEffect } from '../utils/libraryAccounts.js'

const views = [
  { value: 'statement', label: 'كشف الحساب', icon: 'history' },
  { value: 'invoices', label: 'الفواتير', icon: 'invoice' },
  { value: 'payments', label: 'الدفعات', icon: 'payment' },
]
const emptyPages = { statement: 0, invoices: 0, payments: 0 }

export function LibrariesPage({ isActive, activeBookFair, localCurrency, dataVersion, onDataChanged }) {
  const [librariesState, setLibrariesState] = useState({ status: 'loading', libraries: [], error: '' })
  const [selectedId, setSelectedId] = useState('')
  const [currency, setCurrency] = useState(activeBookFair?.primaryCurrency || localCurrency?.code || 'USD')
  const [view, setView] = useState('statement')
  const [pages, setPages] = useState(emptyPages)
  const [date, setDate] = useState('')
  const [periodMode, setPeriodMode] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [summaryState, setSummaryState] = useState({ status: 'idle', data: null, error: '' })
  const [viewState, setViewState] = useState({ status: 'idle', data: null, error: '' })
  const [refreshKey, setRefreshKey] = useState(0)
  const [toast, setToast] = useState(null)
  const [showAdjustments, setShowAdjustments] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const { detail, openInvoice, closeInvoice } = useInvoiceDetails(activeBookFair?.id)
  const page = pages[view]
  const summaryKey = JSON.stringify([activeBookFair?.id, selectedId, currency, dataVersion, refreshKey])
  const viewKey = JSON.stringify([activeBookFair?.id, selectedId, currency, view, page, periodMode, date, from, to, dataVersion, refreshKey])
  const library = librariesState.libraries.find((item) => String(item.id) === selectedId)
  const periodFrom = periodMode === 'day' ? date : periodMode === 'range' ? from : undefined
  const periodTo = periodMode === 'day' ? date : periodMode === 'range' ? to : undefined
  const validPeriod = periodMode === 'all' || Boolean(periodFrom && periodTo && periodFrom <= periodTo)
  const periodLabel = periodMode === 'all' ? 'كل الحركات' : periodMode === 'day' ? `يوم ${date}` : `من ${from} إلى ${to}`
  const currencyOptions = [...new Set([activeBookFair?.primaryCurrency || localCurrency?.code, 'USD'].filter(Boolean))]
    .map((code) => ({ value: code, label: getCurrencyName(code, localCurrency) }))

  useEffect(() => {
    if (!isActive || !activeBookFair?.id) return undefined
    const controller = new AbortController()
    setLibrariesState((current) => ({ ...current, status: 'loading', error: '' }))
    fetchLibraries({ bookFairId: activeBookFair.id, signal: controller.signal })
      .then((response) => {
        const libraries = [...(response.data || [])].sort((a, b) => a.name.localeCompare(b.name, 'ar'))
        setLibrariesState({ status: 'ready', libraries, error: '' })
        setSelectedId((current) => libraries.some((item) => String(item.id) === current) ? current : String(libraries[0]?.id || ''))
      })
      .catch((error) => { if (error.name !== 'AbortError') setLibrariesState({ status: 'error', libraries: [], error: 'تعذر تحميل المكتبات. حاول تاني.' }) })
    return () => controller.abort()
  }, [isActive, activeBookFair?.id, dataVersion, refreshKey])

  useEffect(() => {
    if (!isActive || librariesState.status !== 'ready') return undefined
    const applyAccountLink = () => {
      const params = new URLSearchParams(window.location.hash.split('?')[1] || '')
      const target = librariesState.libraries.find((item) => String(item.id) === params.get('libraryId')
        || (!params.has('libraryId') && item.name === params.get('libraryName')))
      if (!target) return
      setSelectedId(String(target.id))
      const code = params.get('currency')
      if ([activeBookFair?.primaryCurrency || localCurrency?.code, 'USD'].includes(code)) setCurrency(code)
      const linkedDate = params.get('date')
      if (/^\d{4}-\d{2}-\d{2}$/.test(linkedDate || '')) { setDate(linkedDate); setPeriodMode('day') } else setPeriodMode('all')
      setView('statement')
      setPages(emptyPages)
      setShowAdjustments(false)
    }
    applyAccountLink()
    window.addEventListener('hashchange', applyAccountLink)
    return () => window.removeEventListener('hashchange', applyAccountLink)
  }, [isActive, librariesState.status, librariesState.libraries, activeBookFair?.primaryCurrency, localCurrency?.code])

  useEffect(() => {
    if (!isActive || !selectedId || !activeBookFair?.id) return undefined
    const controller = new AbortController()
    setSummaryState({ status: 'loading', data: null, error: '', key: summaryKey })
    fetchLibraryStatement({ libraryId: selectedId, bookFairId: activeBookFair.id, currency, size: 1, signal: controller.signal })
      .then((response) => setSummaryState({ status: 'ready', data: response.data, error: '', key: summaryKey }))
      .catch((error) => { if (error.name !== 'AbortError') setSummaryState({ status: 'error', data: null, error: libraryAccountError(error, 'تعذر تحميل رصيد المكتبة. حاول تاني.'), key: summaryKey }) })
    return () => controller.abort()
  }, [isActive, selectedId, activeBookFair?.id, currency, dataVersion, refreshKey])

  useEffect(() => {
    if (!isActive || !selectedId || !activeBookFair?.id) return undefined
    const controller = new AbortController()
    setViewState({ status: 'loading', data: null, error: '', key: viewKey })
    if (!validPeriod) return undefined
    const options = { libraryId: selectedId, bookFairId: activeBookFair.id, currency, date: periodMode === 'day' ? date : undefined, from: periodMode === 'range' ? from : undefined, to: periodMode === 'range' ? to : undefined, page, size: 10, signal: controller.signal }
    const request = view === 'statement' ? fetchLibraryStatement({ ...options, from: periodFrom, to: periodTo })
      : view === 'invoices' ? fetchLibraryInvoices(options) : fetchLibraryPayments(options)
    request.then((response) => setViewState({ status: 'ready', data: response.data, error: '', key: viewKey }))
      .catch((error) => { if (error.name !== 'AbortError') setViewState({ status: 'error', data: null, error: libraryAccountError(error, 'تعذر تحميل السجل. حاول تاني.'), key: viewKey }) })
    return () => controller.abort()
  }, [isActive, selectedId, activeBookFair?.id, currency, view, page, periodMode, date, from, to, validPeriod, dataVersion, refreshKey])

  useEffect(() => { if (!isActive) closeInvoice() }, [isActive])

  const selectLibrary = (id) => {
    window.history.replaceState(null, '', '#libraries')
    setSelectedId(String(id))
    setPages(emptyPages)
    closeInvoice()
  }
  const selectCurrency = (code) => { window.history.replaceState(null, '', '#libraries'); setCurrency(code); setPages(emptyPages) }
  const selectDate = (nextDate) => {
    window.history.replaceState(null, '', '#libraries')
    setDate(nextDate)
    setPages(emptyPages)
  }
  const handleOpenInvoice = async (id) => {
    const error = await openInvoice(id)
    if (error) setToast({ tone: 'error', message: 'تعذر فتح الفاتورة. حاول تاني.' })
  }
  const handleDeleteInvoice = async () => {
    if (!deleteTarget || deleting) return
    setDeleting(true)
    try {
      await deleteInvoice(deleteTarget.id, activeBookFair.id)
      setDeleteTarget(null)
      closeInvoice()
      setPages(emptyPages)
      setRefreshKey((current) => current + 1)
      onDataChanged()
      setToast({ tone: 'success', message: 'تم إلغاء الفاتورة وتحديث رصيد المكتبة والمخزون.' })
    } catch (error) {
      setToast({ tone: 'error', message: 'تعذر حذف الفاتورة. حاول تاني.' })
    } finally { setDeleting(false) }
  }

  const paymentSaved = (paymentCurrency) => {
    setCurrency(paymentCurrency)
    setView('payments')
    setPages((current) => ({ ...current, statement: 0, payments: 0 }))
    setToast({ tone: 'success', message: 'تم تسجيل دفعة المكتبة وتحديث رصيد الحساب.' })
    onDataChanged()
  }

  const currentSummary = summaryState.key === summaryKey ? summaryState : { status: 'loading', data: null, error: '' }
  const summary = currentSummary.data?.accountSummary
  const balance = Number(summary?.currentBalance || 0)
  const currentView = !validPeriod ? { status: 'idle', data: null, error: '' } : viewState.key === viewKey ? viewState : { status: 'loading', data: null, error: '' }
  const pageData = view === 'statement' ? currentView.data?.entries : currentView.data
  const rows = pageData?.content || []

  return (
    <div className="page libraries-page">
      {toast && <Toast tone={toast.tone} message={toast.message} onClose={() => setToast(null)} />}
      <section className="page-heading"><div><h1>حسابات المكتبات</h1><p>{activeBookFair ? `${activeBookFair.name} · الفواتير والدفعات ورصيد كل مكتبة` : 'اختار المعرض لعرض حسابات المكتبات.'}</p></div><button className="button button--secondary" type="button" disabled={!activeBookFair || currentSummary.status === 'loading'} onClick={() => setRefreshKey((current) => current + 1)}><Icon name="refresh" size={17} />تحديث</button></section>
      {!activeBookFair && <><Notice tone="info" title="اختار معرض أولاً">كل معرض له حسابات مكتبات مستقلة.</Notice><a className="button button--primary empty-state-action" href="#settings">فتح إعدادات المعرض</a></>}
      {activeBookFair && <>
        {librariesState.error && <Notice tone="error" title="تعذر تحميل المكتبات">{librariesState.error}</Notice>}
        {librariesState.status === 'ready' && !librariesState.libraries.length && <section className="panel catalog-state"><Icon name="books" size={28} /><strong>مفيش مكتبات مسجلة في المعرض</strong><p>فاتورة البيع الأولى للمكتبة بتفتح لها حساب تلقائياً.</p><a className="button button--primary" href="#new-invoice">فاتورة جديدة</a></section>}
        {(library || librariesState.status === 'loading') && <section className="panel account-selector" aria-label="اختيار المكتبة وعملة عرض الحساب">
          <div className="form-field account-selector__library"><div className="account-selector__label"><span>المكتبة</span><small>{librariesState.libraries.length} مكتبات في المعرض</small></div><AppDropdown ariaLabel="اختيار مكتبة" disabled={librariesState.status === 'loading'} value={selectedId} placeholder="جاري تحميل المكتبات..." options={librariesState.libraries.map((item) => ({ value: String(item.id), label: item.name }))} onChange={selectLibrary} /></div>
          <div className="account-selector__currency"><span className="account-selector__currency-label">عرض الحساب بعملة</span><div className="account-currency-options" role="group" aria-label="عملة عرض الحساب">{currencyOptions.map((option) => <button type="button" key={option.value} aria-pressed={currency === option.value} className={currency === option.value ? 'is-active' : ''} onClick={() => selectCurrency(option.value)}>{option.label}<small>{option.value}</small></button>)}</div><p>كل عملة لها رصيد مستقل</p></div>
        </section>}

        {library && <>
          {currentSummary.status === 'loading' && <div className="panel account-summary-loading" role="status"><span className="spinner" />جاري تحميل رصيد المكتبة...</div>}
          {currentSummary.error && <Notice tone="error" title="تعذر تحميل الحساب">{currentSummary.error}</Notice>}
          {summary && <section className="panel account-summary" aria-label={`ملخص حساب ${library.name}`}><dl className="account-summary__values"><div><dt>إجمالي قيمة الفواتير</dt><dd className={Number(summary.totalInvoices) === 0 ? 'money--zero' : 'money--sale'}><bdi>{formatMoney(summary.totalInvoices, currency, localCurrency)}</bdi></dd></div><div><dt>إجمالي المدفوع</dt><dd className={Number(summary.totalPaid) === 0 ? 'money--zero' : 'money--received'}><bdi>{formatMoney(summary.totalPaid, currency, localCurrency)}</bdi></dd></div><div className={`account-summary__balance money--${balance < 0 ? 'received' : balance === 0 ? 'zero' : 'debt'} ${balance < 0 ? 'is-credit' : ''}`}><dt>{libraryBalanceLabel(balance)}</dt><dd><bdi>{formatMoney(Math.abs(balance), currency, localCurrency)}</bdi></dd></div></dl>
            <section className="account-reconciliation" aria-label="تفاصيل المرتجعات والمبالغ المردودة">
              <h3 className="account-reconciliation__heading"><Icon name="refund" size={16} />تفاصيل المرتجعات والمبالغ المردودة</h3>
              <div className="account-reconciliation__content">
                <dl className="account-reconciliation__metrics">
                  <div><dt><span className="account-reconciliation__icon"><Icon name="refund" size={19} /></span>إجمالي المرتجعات</dt><dd className={Number(summary.totalReturns) === 0 ? 'money--zero' : 'money--refund'}><bdi>{formatMoney(summary.totalReturns, currency, localCurrency)}</bdi></dd><dd className="account-reconciliation__caption">قيمة الكتب والكميات المرتجعة بعد الخصومات، سواء كان المرتجع جزئياً أو كاملاً.</dd></div>
                  <div><dt><span className="account-reconciliation__icon"><Icon name="refund" size={19} /></span>المبالغ المردودة للمكتبة</dt><dd className={Number(summary.totalRefunded) === 0 ? 'money--zero' : 'money--refund'}><bdi>{formatMoney(summary.totalRefunded, currency, localCurrency)}</bdi></dd><dd className="account-reconciliation__caption">فلوس رجعت للمكتبة عند تسجيل المرتجعات.</dd></div>
                  <div><dt><span className="account-reconciliation__icon"><Icon name="history" size={19} /></span>صافي أثر المرتجعات على الحساب</dt><dd className="money--received"><bdi>{formatMoney(libraryReturnEffect(summary.totalReturns, summary.totalRefunded), currency, localCurrency)}</bdi></dd><dd className="account-reconciliation__caption">قيمة الكتب المرتجعة − الفلوس المردودة. الفرق يقلل المطلوب تحصيله، أو يصبح رصيداً لصالح المكتبة عندنا. التسويات القديمة منفصلة.</dd></div>
                  {Number(summary.totalCancelled) !== 0 && <div><dt><span className="account-reconciliation__icon"><Icon name="trash" size={19} /></span>قيمة الإلغاءات</dt><dd className="money--discount"><bdi>{formatMoney(summary.totalCancelled, currency, localCurrency)}</bdi></dd><dd className="account-reconciliation__caption">قيمة ألغيت من الحساب عند حذف الفواتير، مع الاحتفاظ بالدفعات.</dd></div>}

                </dl>
                {Number(summary.historicalAdjustment) !== 0 && <div className="account-adjustment-strip"><div><strong>تسويات سابقة</strong><span className={Number(summary.historicalAdjustment) < 0 ? 'money--received' : 'money--debt'}>{Number(summary.historicalAdjustment) < 0 ? 'خفضت المستحق بـ ' : 'زادت المستحق بـ '}<bdi>{formatMoney(Math.abs(Number(summary.historicalAdjustment)), currency, localCurrency)}</bdi></span></div><button className="button button--secondary" type="button" onClick={() => setShowAdjustments(true)}><Icon name="history" size={17} />عرض التفاصيل</button></div>}
                {summary.note && !summary.note.startsWith('توجد فروق بين رصيد الفاتورة') && !summary.note.startsWith('تم الاحتفاظ بالرصيد السابق') && <aside className="account-reconciliation__note"><Icon name="info" size={19} /><p>{summary.note}</p></aside>}
              </div>
            </section>
          </section>}
          {library.accountReady && <LibraryAccountPaymentForm key={`${library.id}:${currency}`} library={library} bookFairId={activeBookFair.id} currency={currency} currencyOptions={currencyOptions} localCurrency={localCurrency} dataVersion={dataVersion} onSaved={paymentSaved} />}
          {library.accountReady && <LibraryDailyExport key={`${activeBookFair.id}:${library.id}:${currency}`} library={library} currency={currency} localCurrency={localCurrency} mode={periodMode} onModeChange={(mode) => { window.history.replaceState(null, '', '#libraries'); setPeriodMode(mode); if (mode === 'day' && !date) setDate(businessToday()); setPages(emptyPages) }} date={date} onDateChange={selectDate} from={from} to={to} onFromChange={(value) => { setFrom(value); setPages(emptyPages) }} onToChange={(value) => { setTo(value); setPages(emptyPages) }} />}
          <section className="panel account-records">
            <nav className="account-tabs" aria-label="سجلات حساب المكتبة">{views.map((item) => <button key={item.value} type="button" aria-pressed={view === item.value} className={view === item.value ? 'is-active' : ''} onClick={() => setView(item.value)}><Icon name={item.icon} size={17} />{item.label}</button>)}</nav>
            <header className="account-records__header"><div><h2>{views.find((item) => item.value === view).label}</h2></div><div className="account-records__actions">{library.accountReady && <LibraryRecordsExportButton key={`${activeBookFair.id}:${library.id}:${currency}:${view}:${periodMode}:${date}:${from}:${to}`} library={library} bookFair={activeBookFair} currency={currency} date={periodMode === 'day' ? date : undefined} from={periodMode === 'range' ? from : undefined} to={periodMode === 'range' ? to : undefined} canExport={validPeriod} exportType={view} label={views.find((item) => item.value === view).label} isActive={isActive} onNotice={setToast} />}{pageData && <span className="account-record-count">{pageData.totalElements} {view === 'invoices' ? 'فاتورة' : view === 'payments' ? 'دفعة' : 'حركة'}</span>}</div></header>
            {!validPeriod && <Notice tone="info" title="حدد فترة صحيحة">اختار تاريخ البداية والنهاية، بحيث تكون النهاية بعد البداية أو في نفس اليوم.</Notice>}
            {view === 'statement' && validPeriod && currentView.data && <p className="returns-account-hint">الرصيد في كل صف هو إجمالي حساب المكتبة بعد الحركة، وليس المتبقي من مرتجع الفاتورة وحده. قيمة الكتب تخفض الحساب، والنقد الذي سلّمناه للمكتبة يقلل هذا الخفض. صافي الفرق يخصم من المديونية أو يصبح رصيداً لصالحها.</p>}
            {view === 'statement' && validPeriod && currentView.data && <div className="account-period-summary"><span><bdi>{periodLabel}</bdi></span><span>رصيد أول الفترة: <bdi className={Number(currentView.data.openingBalance) === 0 ? 'money--zero' : Number(currentView.data.openingBalance) < 0 ? 'money--received' : 'money--debt'}>{formatMoney(Math.abs(Number(currentView.data.openingBalance)), currency, localCurrency)}</bdi> — {libraryBalanceLabel(currentView.data.openingBalance)}</span><span>رصيد نهاية الفترة: <bdi className={Number(currentView.data.closingBalance) === 0 ? 'money--zero' : Number(currentView.data.closingBalance) < 0 ? 'money--received' : 'money--debt'}>{formatMoney(Math.abs(Number(currentView.data.closingBalance)), currency, localCurrency)}</bdi> — {libraryBalanceLabel(currentView.data.closingBalance)}</span></div>}
            {currentView.status === 'loading' && <div className="catalog-state account-table-state" role="status"><span className="spinner" /><strong>جاري تحميل السجل...</strong></div>}
            {currentView.error && <div className="account-table-state"><Notice tone="error" title="تعذر تحميل السجل">{currentView.error}</Notice><button className="button button--secondary" type="button" onClick={() => setRefreshKey((current) => current + 1)}>حاول تاني</button></div>}
            {currentView.status === 'ready' && !rows.length && <div className="catalog-state account-table-state"><Icon name={views.find((item) => item.value === view).icon} size={26} /><strong>{view === 'invoices' ? `لا توجد فواتير للمكتبة «${library.name}» في ${periodLabel} بعملة ${getCurrencyName(currency, localCurrency)}` : view === 'payments' ? 'لا توجد دفعات للفترة والعملة المحددتين' : 'لا توجد حركات للفترة المحددة'}</strong><p>{view === 'payments' ? 'غيّر الفترة أو سجل دفعة من النموذج الموجود بالأعلى.' : 'جرّب فترة أو عملة مختلفة.'}</p></div>}
            {currentView.status === 'ready' && rows.length > 0 && <><AccountPagination data={pageData} loading={currentView.status === 'loading'} onChange={(nextPage) => setPages((current) => ({ ...current, [view]: nextPage }))} /><p className="account-table-scroll-hint">مرّر الجدول أفقياً لعرض كل الأعمدة</p><div className="account-table-scroll" tabIndex="0" role="region" aria-label={views.find((item) => item.value === view).label}>{view === 'statement' ? <StatementTable rows={rows} onOpen={handleOpenInvoice} busy={detail.status === 'loading'} /> : view === 'invoices' ? <LibraryInvoicesTable rows={rows} onOpen={handleOpenInvoice} onDelete={setDeleteTarget} busy={deleting || detail.status === 'loading'} /> : <LibraryPaymentsTable rows={rows} onOpen={handleOpenInvoice} busy={detail.status === 'loading'} />}</div></>}
          </section>
        </>}
      </>}
      {showAdjustments && isActive && library && <HistoricalAdjustmentsModal key={`${library.id}:${currency}`} library={library} bookFairId={activeBookFair.id} currency={currency} localCurrency={localCurrency} total={summary?.historicalAdjustment || 0} onClose={() => setShowAdjustments(false)} onOpenInvoice={(id) => { setShowAdjustments(false); handleOpenInvoice(id) }} />}
      {deleteTarget && <DeleteDataConfirmModal title="حذف فاتورة المكتبة" warningTitle="تأثير حذف فاتورة المكتبة" description={<InvoiceDeleteDescription invoice={deleteTarget} />} phrase="حذف الفاتورة" confirmLabel="تأكيد حذف الفاتورة" isBusy={deleting} onClose={() => setDeleteTarget(null)} onConfirm={handleDeleteInvoice} />}
      <InvoiceDetailsOverlay detail={detail} localCurrency={localCurrency} exhibitionName={activeBookFair?.name} onClose={closeInvoice} />
    </div>
  )
}
