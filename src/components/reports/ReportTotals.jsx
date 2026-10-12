import { formatMoney, getCurrencyName } from '../../utils/currency.js'

function TotalCard({ label, value, tone, currency, localCurrency }) {
  return (
    <div className={`report-total-card report-total-card--${tone}`}>
      <span>{label}</span>
      <strong dir="ltr">{value == null ? '—' : formatMoney(value, currency, localCurrency)}</strong>
    </div>
  )
}

const metricsByReport = {
  'reports-libraries': ['sales', 'collected', 'cashCollected', 'visaCollected', 'remaining', 'netCollected'],
  'reports-gifts': ['gifts'],
  'reports-refunds': ['refunds'],
}

const metricDetails = {
  sales: { label: 'إجمالي المبيعات', tone: 'primary' },
  collected: { label: 'المحصل فعلياً', tone: 'success' },
  cashCollected: { label: 'إجمالي الدفع النقدي', tone: 'success' },
  visaCollected: { label: 'إجمالي الدفع بالفيزا', tone: 'success' },
  remaining: { label: 'المتبقي على المكتبات', tone: 'warning' },
  gifts: { label: 'قيمة الهدايا', tone: 'neutral' },
  refunds: { label: 'المبالغ المرتجعة', tone: 'error' },
  netCollected: { label: 'صافي التحصيل', tone: 'success' },
}

export function ReportTotals({ totals, localCurrency, reportPage }) {
  if (totals.length === 0) return null
  const visibleMetrics = metricsByReport[reportPage] || ['sales', 'collected', 'cashCollected', 'visaCollected', 'remaining', 'gifts', 'refunds', 'netCollected']

  return (
    <section className="report-totals" aria-label="ملخص إجماليات التقرير">
      {totals.map((currencyTotals) => (
        <div className="report-totals__currency" key={currencyTotals.currency}>
          <h3>إجماليات {getCurrencyName(currencyTotals.currency, localCurrency)}</h3>
          {currencyTotals.libraryBreakdownIncomplete && <p className="report-totals__warning">بيانات المدفوع والمتبقي للمبيعات الآجلة غير مكتملة في استجابة التقرير.</p>}
          <div className="report-totals__grid">
            {visibleMetrics.map((metric) => {
              const details = metricDetails[metric]
              const needsLibraryBreakdown = ['collected', 'remaining', 'netCollected'].includes(metric)
              const tone = metric === 'netCollected' && currencyTotals.netCollected < 0 ? 'error' : details.tone
              return <TotalCard key={metric} label={details.label} value={needsLibraryBreakdown && currencyTotals.libraryBreakdownIncomplete ? null : currencyTotals[metric]} tone={tone} currency={currencyTotals.currency} localCurrency={localCurrency} />
            })}
          </div>
        </div>
      ))}
    </section>
  )
}
