import { getCurrencyName } from '../../utils/currency.js'

const moneyFormatter = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function ReportMoney({ value, currency, localCurrency, tone = 'sale' }) {
  return (
    <span className={`report-money money--${tone} ${Number(value || 0) === 0 ? 'money--zero' : ''}`} dir="ltr">
      <span className="report-money__value">{moneyFormatter.format(Number(value ?? 0))}</span>
      <small className="report-money__currency" dir="rtl">{getCurrencyName(currency, localCurrency)}</small>
    </span>
  )
}

export function InvoiceBookNames({ books }) {
  if (!books?.length) return '—'

  return (
    <div className="invoice-book-values">
      {books.map((book, index) => (
        <div className="invoice-book-values__item" key={`${book.bookCode}-${index}`} title={book.bookName || ''}>{book.bookName || '—'}</div>
      ))}
    </div>
  )
}

export function InvoiceBookCodes({ books }) {
  if (!books?.length) return '—'

  return (
    <div className="invoice-book-values invoice-book-values--codes" dir="ltr">
      {books.map((book, index) => (
        <div className="invoice-book-values__item" key={`${book.bookCode}-${index}`}>{book.bookCode || '—'}</div>
      ))}
    </div>
  )
}

export function InvoiceBookQuantities({ books }) {
  if (!books?.length) return '—'

  return (
    <div className="invoice-book-values invoice-book-values--quantities" dir="ltr">
      {books.map((book, index) => (
        <div className="invoice-book-values__item" key={`${book.bookCode}-${index}`}>{book.quantity ?? '—'}</div>
      ))}
    </div>
  )
}

export function InvoiceBookAmounts({ books, currency, localCurrency, total = false }) {
  if (!books?.length) return '—'

  return (
    <div className="invoice-book-values" dir="ltr">
      {books.map((book, index) => {
        const amount = book.unitPrice == null
          ? null
          : Number(book.unitPrice) * (total ? Number(book.quantity ?? 0) : 1)
        return (
          <div className="invoice-book-values__item" key={`${book.bookCode}-${index}`}>
            {amount == null ? '—' : <ReportMoney value={amount} currency={currency} localCurrency={localCurrency} />}
          </div>
        )
      })}
    </div>
  )
}
