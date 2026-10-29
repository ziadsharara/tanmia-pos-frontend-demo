import { TablePagination } from '../ui/TablePagination.jsx'
import { Icon } from '../ui/Icon.jsx'
import { Notice } from '../ui/Notice.jsx'

function formatPrice(value) {
  if (value === null || value === undefined || value === '') return '—'
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value))
}

function StockBadge({ quantity }) {
  if (quantity === 0) return <span className="stock-badge stock-badge--empty">نفد الرصيد</span>
  if (quantity <= 2) return <span className="stock-badge stock-badge--critical">رصيد منخفض جداً: {quantity}</span>
  if (quantity <= 5) return <span className="stock-badge stock-badge--low">رصيد منخفض: {quantity}</span>
  return <span className="stock-badge stock-badge--available">{quantity} نسخة</span>
}

function CatalogEmpty({ hasSearch }) {
  return (
    <div className="catalog-state">
      <span className="catalog-state__icon"><Icon name={hasSearch ? 'search' : 'books'} size={28} /></span>
      <strong>{hasSearch ? 'مفيش كتب مطابقة للبحث' : 'قائمة الكتب فاضية'}</strong>
      <p>{hasSearch ? 'جرّب تكتب أي جزء من اسم الكتاب أو الكود أو رقمه.' : 'ضيف أول كتاب يدوي أو استورده من ملف Excel.'}</p>
    </div>
  )
}

export function BookCatalog({ search, onSearchChange, state, page, onPageChange, onRetry, onEdit, onDelete, onDeleteAll, deletingBookId, isDeletingAll, localCurrency }) {
  const data = state.data
  const books = data?.content || []
  const isLoading = state.status === 'loading'
  const hasSearch = search.trim().length > 0

  return (
    <section className="panel catalog-panel" aria-labelledby="catalog-title">
      <div className="catalog-toolbar">
        <div><h2 id="catalog-title">قائمة الكتب والأرصدة</h2></div>
        <div className="catalog-toolbar__actions">
          <div className="catalog-count"><Icon name="books" size={17} /><span>إجمالي الكتب</span><strong>{data?.totalElements ?? '—'}</strong></div>
          {books.length > 0 && (
            <button className="button button--danger-soft" type="button" disabled={isDeletingAll || deletingBookId !== null} onClick={onDeleteAll}>
              {isDeletingAll ? <span className="spinner" /> : <Icon name="trash" size={17} />}
              {isDeletingAll ? 'جاري حذف الكتب...' : 'حذف كل الكتب'}
            </button>
          )}
        </div>
      </div>

      <div className="catalog-search">
        <Icon name="search" size={19} />
        <input name="catalog-search" autoComplete="off" spellCheck="false" type="search" value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="ابحث بأي جزء من اسم الكتاب أو الكود أو رقمه…" aria-label="البحث في الكتب بالاسم أو الكود أو الرقم" />
        {isLoading && <span className="spinner" aria-label="جاري البحث" />}
      </div>

      {state.status === 'error' && <div className="catalog-error"><Notice tone="error" title="تعذر تحميل قائمة الكتب">{state.error}</Notice><button className="button button--secondary" type="button" onClick={onRetry}><Icon name="refresh" size={17} />حاول تاني</button></div>}
      {state.status !== 'error' && isLoading && !data && <div className="catalog-state"><span className="spinner spinner--large" /><strong>جاري تحميل الكتب...</strong></div>}
      {state.status !== 'error' && !isLoading && data && books.length === 0 && <CatalogEmpty hasSearch={hasSearch} />}

      {state.status !== 'error' && data && books.length > 0 && (
        <>
          <TablePagination page={data.page} totalPages={data.totalPages} hasNext={data.hasNext} loading={isLoading} onPrevious={() => onPageChange(page - 1)} onNext={() => onPageChange(page + 1)} ariaLabel="صفحات الكتب" />
          <div className={`table-wrap catalog-table-wrap ${isLoading ? 'catalog-table-wrap--loading' : ''}`}>
            <table className="catalog-table">
              <thead><tr><th>الكود</th><th>اسم الكتاب</th><th>المؤلف</th><th>السعر بـ{localCurrency.nameAr}</th><th>السعر بالدولار</th><th>الرصيد</th><th className="table-actions-cell">إجراء</th></tr></thead>
              <tbody>
                {books.map((book) => (
                  <tr key={book.id}>
                    <td className="code-cell" dir="ltr">{book.code}</td>
                    <td className="book-name-cell"><strong>{book.name}</strong></td>
                    <td className="author-cell">{book.author}</td>
                    <td className="price-cell" dir="ltr"><span className="table-price"><strong>{formatPrice(book.price)}</strong><small>{localCurrency.nameAr}</small></span></td>
                    <td className="price-cell" dir="ltr"><span className="table-price"><strong>{formatPrice(book.priceInUSD)}</strong><small>دولار</small></span></td>
                    <td><StockBadge quantity={book.quantity} /></td>
                    <td className="table-actions-cell">
                      <div className="table-actions" role="group" aria-label={`إجراءات الكتاب ${book.name}`}>
                        <button className="table-action" type="button" aria-label="تعديل" title="تعديل الكتاب" disabled={isDeletingAll || deletingBookId !== null} onClick={() => onEdit(book.id)}><Icon name="edit" size={17} /></button>
                        <button className="table-action table-action--danger" type="button" aria-label="حذف" title="حذف الكتاب" disabled={isDeletingAll || deletingBookId !== null} onClick={() => onDelete(book)}>
                          {deletingBookId === book.id ? <span className="spinner" /> : <Icon name="trash" size={16} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </>
      )}
    </section>
  )
}
