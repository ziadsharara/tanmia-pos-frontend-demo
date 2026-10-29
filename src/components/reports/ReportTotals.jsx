import { formatMoney, getCurrencyName } from '../../utils/currency.js'

function TotalCard({ label, value, tone, currency, localCurrency, description }) {
  return (
    <div className={`report-total-card report-total-card--${tone} ${Number(value) === 0 ? 'report-total-card--zero' : ''}`}>
      <span>{label}</span>
      <strong dir="ltr">{value == null ? '—' : formatMoney(value, currency, localCurrency)}</strong>
      {description && <small className="report-total-card__description">{description}</small>}
    </div>
  )
}

const metricsByReport = {
  'reports-cash': ['sales', 'couponPending', 'collected', 'cashCollected', 'returnedValue', 'returnedGifts', 'libraryRefunds', 'refunds', 'netCollected'],
  'reports-visa': ['sales', 'couponPending', 'collected', 'visaCollected', 'returnedValue', 'returnedGifts', 'libraryRefunds', 'refunds', 'netCollected'],
  'reports-libraries': ['libraryInvoices', 'libraryPayments', 'sales', 'couponPending', 'collected', 'cashCollected', 'visaCollected', 'remaining', 'returnedValue', 'returnedGifts', 'libraryRefunds', 'refunds', 'netCollected'],
  'reports-coupons': ['sales', 'couponPending', 'collected', 'cashCollected', 'visaCollected', 'returnedValue', 'refunds', 'netCollected'],
  'reports-gifts': ['invoiceValue', 'gifts', 'returnedGifts', 'libraryRefunds'],
  'reports-refunds': ['returnedValue', 'returnedGifts', 'libraryRefunds', 'refunds'],
}

const metricDetails = {
  invoiceValue: { label: 'قيمة الفواتير (بيع وهدايا)', tone: 'primary' },
  sales: { label: 'قيمة فواتير البيع فقط', tone: 'primary' },
  couponPending: { label: 'كوبونات مستحقة على المعرض', tone: 'warning', description: 'بعد المرتجعات والتحصيلات. تحصيلها من إدارة المعرض يدخل النقدي أو الفيزا في تاريخ استلامه.' },
  collected: { label: 'المحصل فعلياً', tone: 'success' },
  cashCollected: { label: 'إجمالي الدفع النقدي', tone: 'success' },
  visaCollected: { label: 'إجمالي الدفع بالفيزا', tone: 'visa' },
  libraryInvoices: { label: 'قيمة فواتير المكتبات قبل المرتجعات', dailyLabel: 'قيمة فواتير المكتبات الصادرة اليوم', tone: 'primary', description: 'تضاف إلى حساب المكتبة، وتظهر الدفعات المستلمة في بطاقة المحصل من المكتبات.' },
  libraryPayments: { label: 'المحصل من المكتبات', dailyLabel: 'دفعات المكتبات المحصلة اليوم', tone: 'success', description: 'جزء من المحصل فعلياً، وموزع حسب طريقة الدفع النقدي أو الفيزا.' },
  remaining: { label: 'صافي المبلغ المتبقي على المكتبات', tone: 'warning', description: 'بعد الدفعات والمرتجعات والتسويات. السالب رصيد لصالح المكتبات.' },
  gifts: { label: 'قيمة الهدايا (بدون تحصيل)', tone: 'gift' },
  returnedGifts: { label: 'قيمة الهدايا المرتجعة', tone: 'gift', description: 'قيمة الكتب التي أعيدت من الهدايا، بدون رد مبالغ نقدية.' },
  returnedValue: { label: 'قيمة كتب البيع المرتجعة', tone: 'error' },
  libraryRefunds: { label: 'المبالغ المردودة للمكتبات', tone: 'error', description: 'جزء من إجمالي المبالغ المردودة فعلياً؛ يخصم مرة واحدة من صافي التحصيل.' },
  refunds: { label: 'المبالغ المردودة فعلياً', tone: 'error' },
  netCollected: { label: 'صافي التحصيل', tone: 'success' },
}

export function ReportTotals({ totals, localCurrency, reportPage }) {
  if (totals.length === 0) return null
  const metrics = metricsByReport[reportPage] || ['invoiceValue', 'sales', 'couponPending', 'collected', 'cashCollected', 'visaCollected', 'libraryInvoices', 'libraryPayments', 'remaining', 'gifts', 'returnedValue', 'returnedGifts', 'libraryRefunds', 'refunds', 'netCollected']

  const order = ['invoiceValue', 'sales', 'couponPending', 'libraryInvoices', 'gifts', 'collected', 'libraryPayments', 'cashCollected', 'visaCollected', 'remaining', 'returnedValue', 'returnedGifts', 'libraryRefunds', 'refunds', 'netCollected']
  const visibleMetrics = order.filter((metric) => metrics.includes(metric) && (reportPage !== 'reports-daily' || metric !== 'remaining'))

  return (
    <section className="report-totals" aria-label="ملخص إجماليات التقرير">
      {totals.map((currencyTotals) => (
        <div className="report-totals__currency" key={currencyTotals.currency}>
          <h3>إجماليات {getCurrencyName(currencyTotals.currency, localCurrency)}</h3>
          {currencyTotals.libraryBreakdownIncomplete && <p className="report-totals__warning">بيانات المدفوع والمتبقي للمبيعات الآجلة غير مكتملة في استجابة التقرير.</p>}
          <div className="report-totals__grid">
            {visibleMetrics.map((metric) => {
              const details = reportPage === 'reports-coupons' && metric === 'sales' ? { ...metricDetails.sales, label: 'قيمة الكوبونات بعد المرتجعات' } : metricDetails[metric]
              const needsLibraryBreakdown = ['collected', 'remaining', 'returnedValue', 'returnedGifts', 'libraryRefunds', 'refunds', 'netCollected'].includes(metric)
              const tone = metric === 'netCollected' && currencyTotals.netCollected < 0 ? 'error' : metric === 'remaining' && currencyTotals.remaining < 0 ? 'success' : details.tone
              return <TotalCard description={details.description} key={metric} label={reportPage === 'reports-daily' && details.dailyLabel ? details.dailyLabel : details.label} value={needsLibraryBreakdown && currencyTotals.libraryBreakdownIncomplete ? null : currencyTotals[metric]} tone={tone} currency={currencyTotals.currency} localCurrency={localCurrency} />
            })}
          </div>
        </div>
      ))}
    </section>
  )
}
