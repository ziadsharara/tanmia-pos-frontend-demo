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
