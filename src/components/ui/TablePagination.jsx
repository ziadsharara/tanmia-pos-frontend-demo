import { Icon } from './Icon.jsx'

export function TablePagination({ page, totalPages, hasNext = page + 1 < totalPages, loading = false, onPrevious, onNext, summary, ariaLabel = 'صفحات الجدول', className = '', hint }) {
  return (
    <nav className={`pagination table-pagination ${className}`} aria-label={ariaLabel}>
      <span className="table-pagination__summary">{summary || <>صفحة <strong>{page + 1}</strong> من <strong>{totalPages}</strong></>}</span>
      {hint && <span className="table-pagination__hint"><Icon name="info" size={14} />{hint}</span>}
      <div className="table-pagination__controls">
        <button className="button button--secondary" type="button" disabled={page === 0 || loading} onClick={onPrevious}><Icon name="next" size={16} />السابق</button>
        <span className="table-pagination__page" aria-current="page" dir="ltr">{page + 1} / {totalPages}</span>
        <button className="button button--secondary" type="button" disabled={!hasNext || loading} onClick={onNext}>التالي<Icon name="previous" size={16} /></button>
      </div>
    </nav>
  )
}
