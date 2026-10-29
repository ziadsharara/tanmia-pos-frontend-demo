const paymentTypes = [
  { key: 'direct', label: 'بيع مباشر', color: 'var(--success)' },
  { key: 'libraries', label: 'مكتبات', color: 'var(--warning)' },
  { key: 'gifts', label: 'هدايا', color: 'var(--primary)' },
  { key: 'refunds', label: 'مرتجعات', color: 'var(--error)' },
]

const paymentStatuses = [
  { key: 'ON_ACCOUNT', label: 'على حساب مكتبة', tone: 'warning' },
  { key: 'PAID', label: 'مدفوعة', tone: 'success' },
  { key: 'PARTIALLY_PAID', label: 'مدفوعة جزئياً', tone: 'warning' },
  { key: 'UNPAID', label: 'غير مدفوعة', tone: 'error' },
  { key: 'NO_PAYMENT_REQUIRED', label: 'هدايا', tone: 'primary' },
  { key: 'PARTIAL_REFUND', label: 'مرتجع جزئي', tone: 'error' },
  { key: 'REFUND', label: 'مرتجعة', tone: 'error' },
]

function getPaymentTypeKey(invoice) {
  if (invoice.refundAt || invoice.paymentStatus === 'REFUND') return 'refunds'
  if (invoice.paymentType === 'WHOLESALE_CREDIT') return 'libraries'
  if (invoice.paymentType === 'GIFT') return 'gifts'
  return 'direct'
}

function getInvoiceDate(invoice) {
  return invoice.paymentStatus === 'REFUND'
    ? invoice.refundAt || invoice.businessDate
    : invoice.businessDate
}

function buildDashboardData(invoices) {
  const typeCounts = { direct: 0, libraries: 0, gifts: 0, refunds: 0 }
  const statusCounts = Object.fromEntries(paymentStatuses.map((status) => [status.key, 0]))
  const dailyCounts = new Map()

  invoices.forEach((invoice) => {
    typeCounts[getPaymentTypeKey(invoice)] += 1
    const status = invoice.refundAt && invoice.paymentStatus !== 'REFUND' ? 'PARTIAL_REFUND' : invoice.paymentType === 'WHOLESALE_CREDIT' && invoice.paymentStatus !== 'REFUND' ? 'ON_ACCOUNT' : invoice.paymentStatus
    statusCounts[status] = (statusCounts[status] || 0) + 1
    const date = getInvoiceDate(invoice)
    if (date) dailyCounts.set(date, (dailyCounts.get(date) || 0) + 1)
  })

  const availableDates = Array.from(dailyCounts.keys()).sort()
  const latestDate = availableDates.at(-1)
  const days = latestDate ? Array.from({ length: 10 }, (_, index) => {
    const date = new Date(`${latestDate}T00:00:00Z`)
    date.setUTCDate(date.getUTCDate() - (9 - index))
    const dateKey = date.toISOString().slice(0, 10)
    return { date: dateKey, count: dailyCounts.get(dateKey) || 0 }
  }) : []

  return { typeCounts, statusCounts, days }
}

function ActivityChart({ days }) {
  if (days.length === 0) return <div className="dashboard-chart__empty">مفيش حركة فواتير لعرضها.</div>

  const width = 680
  const height = 190
  const paddingX = 26
  const paddingTop = 18
  const chartBottom = 146
  const maximum = Math.max(...days.map((day) => day.count), 1)
  const step = days.length === 1 ? 0 : (width - paddingX * 2) / (days.length - 1)
  const points = days.map((day, index) => {
    const x = days.length === 1 ? width / 2 : paddingX + (index * step)
    const y = chartBottom - ((day.count / maximum) * (chartBottom - paddingTop))
    return { ...day, x, y }
  })
  const linePoints = points.map((point) => `${point.x},${point.y}`).join(' ')
  const areaPoints = `${points[0].x},${chartBottom} ${linePoints} ${points[points.length - 1].x},${chartBottom}`

  return (
    <svg className="dashboard-activity-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="عدد الفواتير حسب اليوم">
      <line x1={paddingX} y1={chartBottom} x2={width - paddingX} y2={chartBottom} className="dashboard-activity-chart__axis" />
      <polygon points={areaPoints} className="dashboard-activity-chart__area" />
      <polyline points={linePoints} className="dashboard-activity-chart__line" />
      {points.map((point) => (
        <g key={point.date}>
          <circle cx={point.x} cy={point.y} r="4" className="dashboard-activity-chart__point" />
          <text x={point.x} y={point.y - 10} textAnchor="middle" className="dashboard-activity-chart__count">{point.count}</text>
          <text x={point.x} y="170" textAnchor="middle" className="dashboard-activity-chart__date">{point.date.slice(5)}</text>
        </g>
      ))}
    </svg>
  )
}

function PaymentDonut({ typeCounts, total }) {
  const circumference = 100
  let offset = 0
  const segments = paymentTypes.map((type) => {
    const length = total === 0 ? 0 : (typeCounts[type.key] / total) * circumference
    const segment = { ...type, length, offset }
    offset += length
    return segment
  })

  return (
    <div className="dashboard-donut-wrap">
      <div className="dashboard-donut">
        <svg viewBox="0 0 42 42" aria-hidden="true">
          <circle className="dashboard-donut__track" cx="21" cy="21" r="15.9155" />
          {segments.map((segment) => segment.length > 0 && <circle key={segment.key} className="dashboard-donut__segment" cx="21" cy="21" r="15.9155" pathLength="100" stroke={segment.color} strokeDasharray={`${segment.length} ${circumference - segment.length}`} strokeDashoffset={-segment.offset} />)}
        </svg>
        <div><strong>{total}</strong><span>فاتورة</span></div>
      </div>
      <div className="dashboard-legend">
        {paymentTypes.map((type) => <div key={type.key}><span className="dashboard-legend__dot" style={{ background: type.color }} /><span>{type.label}</span><strong>{typeCounts[type.key]}</strong></div>)}
      </div>
    </div>
  )
}

export function DashboardOverview({ invoices }) {
  const { typeCounts, statusCounts, days } = buildDashboardData(invoices)
  const total = invoices.length
  const maximumStatus = Math.max(...paymentStatuses.map((status) => statusCounts[status.key] || 0), 1)

  return (
    <section className="dashboard-overview" aria-label="نظرة عامة على المعرض">
      <div className="dashboard-kpis">
        <div className="dashboard-kpi dashboard-kpi--primary"><span>إجمالي الفواتير</span><strong>{total}</strong><small>كل العمليات المسجلة</small></div>
        <div className="dashboard-kpi dashboard-kpi--success"><span>البيع المباشر</span><strong>{typeCounts.direct}</strong><small>فواتير مدفوعة مباشرة</small></div>
        <div className="dashboard-kpi dashboard-kpi--warning"><span>مبيعات المكتبات</span><strong>{typeCounts.libraries}</strong><small>فواتير البيع الآجل</small></div>
        <div className="dashboard-kpi dashboard-kpi--error"><span>المرتجعات</span><strong>{typeCounts.refunds}</strong><small>فواتير لها مرتجعات جزئية أو كاملة</small></div>
      </div>

      <div className="dashboard-visuals">
        <article className="panel dashboard-widget dashboard-widget--activity"><header><div><span>حركة المعرض</span><h2>الفواتير حسب اليوم</h2></div><small>آخر 10 أيام</small></header><ActivityChart days={days} /></article>
        <article className="panel dashboard-widget"><header><div><span>أنواع العمليات</span><h2>توزيع الفواتير</h2></div></header><PaymentDonut typeCounts={typeCounts} total={total} /></article>
        <article className="panel dashboard-widget"><header><div><span>حالة الدفع</span><h2>تفاصيل التحصيل</h2></div></header><div className="dashboard-statuses">{paymentStatuses.map((status) => { const count = statusCounts[status.key] || 0; return <div className="dashboard-status" key={status.key}><div><span>{status.label}</span><strong>{count}</strong></div><div className="dashboard-status__track"><span className={`dashboard-status__bar dashboard-status__bar--${status.tone}`} style={{ width: `${(count / maximumStatus) * 100}%` }} /></div></div> })}</div></article>
      </div>
    </section>
  )
}
