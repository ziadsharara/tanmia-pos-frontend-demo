const titles = {
  DASHBOARD: 'لوحة التقارير', DAILY: 'التقرير اليومي', LIBRARIES: 'مبيعات المكتبات',
  DIRECT_CASH: 'فواتير البيع المباشر النقدي', DIRECT_VISA: 'فواتير البيع المباشر بالفيزا',
  GIFTS: 'تقرير الهدايا', REFUNDS: 'تقرير المرتجعات',
  LOCAL_CURRENCY: 'المبيعات بالعملة المحلية', DOLLAR: 'المبيعات بالدولار',
}
const headers = [
  'رقم الفاتورة', 'أسماء الكتب', 'أكواد الكتب', 'الكمية', 'سعر الوحدة قبل الخصم',
  'إجمالي الكتاب قبل الخصم', 'تاريخ الفاتورة', 'تاريخ المرتجع', 'نوع البيع',
  'طريقة الدفع', 'حالة الدفع', 'المكتبة', 'العملة', 'إجمالي الفاتورة بعد الخصم', 'المدفوع', 'المتبقي',
]
const totalHeaders = [
  'العملة', 'إجمالي المبيعات', 'المحصل فعلياً', 'الدفع النقدي', 'الدفع بالفيزا',
  'المتبقي على المكتبات', 'قيمة الهدايا', 'المبالغ المرتجعة', 'صافي التحصيل',
]
const widths = [38, 36, 23, 12, 23, 27, 16, 16, 21, 18, 20, 24, 16, 30, 16, 16]
const currencies = {
  EGP: 'جنيه مصري', LYD: 'دينار ليبي', DZD: 'دينار جزائري', AED: 'درهم إماراتي',
  KWD: 'دينار كويتي', IQD: 'دينار عراقي', SAR: 'ريال سعودي', OMR: 'ريال عُماني',
  TND: 'دينار تونسي', MAD: 'درهم مغربي', QAR: 'ريال قطري', USD: 'دولار',
}
const types = { DIRECT: 'بيع مباشر', WHOLESALE_CREDIT: 'مبيعات المكتبات', GIFT: 'هدايا' }
const statuses = {
  PAID: 'مدفوعة', PARTIALLY_PAID: 'مدفوعة جزئياً', UNPAID: 'غير مدفوعة',
  NO_PAYMENT_REQUIRED: 'هدايا', REFUND: 'مرتجعة',
}
const colors = {
  dark: 'FF013660', white: 'FFFFFFFF', ink: 'FF263238', green: 'FF1CAC75',
  greenBg: 'FFE7F8EF', amber: 'FFF59E0B', amberBg: 'FFFFF6DC',
  red: 'FFEF4444', redBg: 'FFFFF5F4', giftBg: 'FFE5EBEF', border: 'FFD9D9D9',
}

const dateValue = (date) => date ? new Date(`${date}T12:00:00`) : null
const amount = (value) => Number(value ?? 0)
const spacedLines = (values) => values.map((value) => `\u2009${value}\u2009`).join('\n')
const paid = (invoice) => invoice.paymentType === 'GIFT' ? 0
  : invoice.paymentType === 'WHOLESALE_CREDIT' ? amount(invoice.libraryPartialPaymentAmount) : amount(invoice.amountDue)
const remaining = (invoice) => invoice.paymentType === 'WHOLESALE_CREDIT' ? amount(invoice.libraryRemainingPaymentAmount) : 0

function fill(argb) {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } }
}

function style(cell, { background = colors.white, foreground = colors.ink, size = 12, alignment = 'center', wrapText = false, format } = {}) {
  cell.fill = fill(background)
  cell.font = { name: 'Arial', size, bold: true, color: { argb: foreground } }
  cell.alignment = { horizontal: alignment, vertical: 'middle', wrapText }
  cell.border = {
    top: { style: 'thin', color: { argb: colors.border } },
    bottom: { style: 'thin', color: { argb: colors.border } },
    left: { style: 'thin', color: { argb: colors.border } },
    right: { style: 'thin', color: { argb: colors.border } },
  }
  if (format) cell.numFmt = format
}

function totalRows(invoices, reportType, dailyPayments) {
  const byCurrency = new Map()
  for (const invoice of invoices) {
    const row = byCurrency.get(invoice.currency) || {
      currency: invoice.currency, sales: 0, collected: 0, cash: 0, visa: 0,
      remaining: 0, gifts: 0, refunds: 0, net: 0,
    }
    const value = amount(invoice.totalAmountAfterDiscounts)
    const collected = reportType === 'DAILY' && invoice.paymentType === 'WHOLESALE_CREDIT' ? 0 : paid(invoice)
    if (invoice.paymentStatus === 'REFUND') {
      row.refunds += collected
      row.net -= collected
    } else if (invoice.paymentType === 'GIFT') {
      row.gifts += value
    } else {
      row.sales += value
      row.collected += collected
      row.net += collected
      if (invoice.paymentType === 'DIRECT') {
        if (invoice.paymentMethod === 'CASH') row.cash += collected
        if (invoice.paymentMethod === 'VISA') row.visa += collected
      } else if (invoice.paymentType === 'WHOLESALE_CREDIT') {
        row.remaining += remaining(invoice)
        for (const payment of reportType === 'DAILY' ? [] : invoice.libraryPayments || []) {
          if (payment.paymentMethod === 'CASH') row.cash += amount(payment.amount)
          if (payment.paymentMethod === 'VISA') row.visa += amount(payment.amount)
        }
      }
    }
    byCurrency.set(invoice.currency, row)
  }
  if (reportType === 'DAILY') for (const payment of dailyPayments) {
    const row = byCurrency.get(payment.currency) || {
      currency: payment.currency, sales: 0, collected: 0, cash: 0, visa: 0,
      remaining: 0, gifts: 0, refunds: 0, net: 0,
    }
    row.collected += amount(payment.amount)
    row.net += amount(payment.amount)
    if (payment.paymentMethod === 'CASH') row.cash += amount(payment.amount)
    if (payment.paymentMethod === 'VISA') row.visa += amount(payment.amount)
    byCurrency.set(payment.currency, row)
  }
  return [...byCurrency.values()].sort((a, b) => a.currency.localeCompare(b.currency))
}

export async function buildReportWorkbook(reportType, invoices, dailyPayments = []) {
  const { default: ExcelJS } = await import('exceljs/dist/exceljs.min.js')
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('التقرير', {
    views: [{ state: 'frozen', ySplit: 2, rightToLeft: true, zoomScale: 90 }],
  })
  widths.forEach((width, index) => { sheet.getColumn(index + 1).width = width })

  sheet.mergeCells('A1:P1')
  const title = sheet.getCell('A1')
  title.value = titles[reportType] || 'التقرير'
  style(title, { background: colors.dark, foreground: colors.white, size: 14 })
  sheet.getRow(1).height = 25

  const headerRow = sheet.getRow(2)
  headerRow.values = reportType === 'DAILY' ? headers.map((header, index) => index === 14 ? 'المحصل في هذا اليوم' : header) : headers
  headerRow.height = 26
  headerRow.eachCell((cell) => style(cell, { background: colors.dark, foreground: colors.white }))

  invoices.forEach((invoice, index) => {
    const row = sheet.getRow(index + 3)
    row.values = [
      invoice.invoiceNumber,
      spacedLines(invoice.items.map((item) => item.bookName)),
      spacedLines(invoice.items.map((item) => item.bookCode)),
      spacedLines(invoice.items.map((item) => item.quantity)),
      spacedLines(invoice.items.map((item) => amount(item.unitPrice).toFixed(2))),
      spacedLines(invoice.items.map((item) => (amount(item.unitPrice) * amount(item.quantity)).toFixed(2))),
      dateValue(invoice.businessDate), dateValue(invoice.refundAt),
      types[invoice.paymentType] || '—', invoice.paymentMethod === 'CASH' ? 'نقدي' : invoice.paymentMethod === 'VISA' ? 'فيزا' : '—',
      statuses[invoice.paymentStatus] || '—',
      invoice.libraryName || '—', currencies[invoice.currency] || invoice.currency || '—',
      amount(invoice.totalAmountAfterDiscounts), reportType === 'DAILY' && invoice.paymentType === 'WHOLESALE_CREDIT' ? 0 : paid(invoice), remaining(invoice),
    ]
    row.height = Math.max(28, invoice.items.length * 22)
    row.eachCell({ includeEmpty: true }, (cell, column) => {
      const status = invoice.paymentStatus
      const statusColor = status === 'REFUND' ? [colors.redBg, colors.red]
        : status === 'PAID' ? [colors.greenBg, colors.green]
          : status === 'NO_PAYMENT_REQUIRED' ? [colors.giftBg, colors.dark]
            : [colors.amberBg, colors.amber]
      style(cell, {
        background: column === 11 ? statusColor[0] : colors.white,
        foreground: column === 11 ? statusColor[1] : colors.ink,
        wrapText: column >= 2 && column <= 6,
        format: column === 7 || column === 8 ? 'yyyy-mm-dd' : column >= 14 ? '#,##0.00' : undefined,
      })
    })
  })

  let nextRow = invoices.length + 3
  if (invoices.length) sheet.autoFilter = `A2:P${invoices.length + 2}`
  else {
    sheet.mergeCells(`A${nextRow}:P${nextRow}`)
    const empty = sheet.getCell(`A${nextRow}`)
    empty.value = 'لا توجد فواتير في هذا التقرير'
    style(empty, { background: 'FFF6F6F6', foreground: 'FF858585' })
    sheet.getRow(nextRow).height = 28
    nextRow += 1
  }

  const totalsTitleRow = nextRow + 1
  sheet.mergeCells(`A${totalsTitleRow}:I${totalsTitleRow}`)
  const totalsTitle = sheet.getCell(`A${totalsTitleRow}`)
  totalsTitle.value = 'الإجماليات'
  style(totalsTitle, { foreground: colors.dark, size: 13, alignment: 'right' })

  const totalsHeader = sheet.getRow(totalsTitleRow + 1)
  totalsHeader.values = totalHeaders
  totalsHeader.height = 26
  totalsHeader.eachCell((cell) => style(cell, { background: colors.dark, foreground: colors.white }))

  totalRows(invoices, reportType, dailyPayments).forEach((total, index) => {
    const row = sheet.getRow(totalsTitleRow + 2 + index)
    row.values = [currencies[total.currency] || total.currency, total.sales, total.collected,
      total.cash, total.visa, total.remaining, total.gifts, total.refunds, total.net]
    row.height = 24
    row.eachCell((cell, column) => {
      const tone = column === 8 || column === 9 && total.net < 0 ? [colors.redBg, colors.red]
        : column === 6 ? [colors.amberBg, colors.amber]
          : column >= 3 && column <= 5 || column === 9 ? [colors.greenBg, colors.green]
            : [colors.white, colors.ink]
      style(cell, { background: tone[0], foreground: tone[1], format: column >= 2 ? '#,##0.00' : undefined })
    })
  })

  if (reportType === 'DAILY') {
    const paymentsSheet = workbook.addWorksheet('دفعات المكتبات', { views: [{ rightToLeft: true }] })
    const paymentHeaders = ['رقم الفاتورة', 'المكتبة', 'تاريخ الدفع', 'طريقة الدفع', 'العملة', 'المبلغ المحصل']
    paymentsSheet.getRow(1).values = paymentHeaders
    paymentsSheet.getRow(1).eachCell((cell) => style(cell, { background: colors.dark, foreground: colors.white }))
    paymentHeaders.forEach((_, index) => { paymentsSheet.getColumn(index + 1).width = 24 })
    dailyPayments.forEach((payment, index) => {
      const row = paymentsSheet.getRow(index + 2)
      row.values = [payment.invoiceNumber, payment.libraryName || '—', dateValue(payment.paidAt),
        payment.paymentMethod === 'CASH' ? 'نقدي' : 'فيزا', currencies[payment.currency] || payment.currency,
        amount(payment.amount)]
      row.eachCell((cell, column) => style(cell, {
        format: column === 3 ? 'yyyy-mm-dd' : column === 6 ? '#,##0.00' : undefined,
      }))
    })
  }

  const bytes = await workbook.xlsx.writeBuffer()
  return new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
