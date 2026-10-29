import { TablePagination } from '../ui/TablePagination.jsx'
import { useEffect, useMemo, useState } from 'react'
import { Icon } from '../ui/Icon.jsx'

const PAGE_SIZE = 10

function errorsByRow(errors) {
  return errors.reduce((grouped, error) => {
    const rowErrors = grouped.get(error.rowNumber) || []
    rowErrors.push(error)
    grouped.set(error.rowNumber, rowErrors)
    return grouped
  }, new Map())
}

export function PreviewTable({ preview, localCurrency, onDeleteRow, onEditRow }) {
  const [page, setPage] = useState(0)
  const groupedErrors = useMemo(() => errorsByRow(preview.errors), [preview.errors])
  const sortedRows = useMemo(() => [...preview.rows].sort((first, second) => {
    const firstHasErrors = groupedErrors.has(first.rowNumber)
    const secondHasErrors = groupedErrors.has(second.rowNumber)
    if (firstHasErrors !== secondHasErrors) return firstHasErrors ? -1 : 1
    return first.rowNumber - second.rowNumber
  }), [groupedErrors, preview.rows])
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE))
  const visibleRows = sortedRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  useEffect(() => {
    if (page >= totalPages) setPage(totalPages - 1)
  }, [page, totalPages])

  useEffect(() => setPage(0), [preview.rows])

  if (!preview.rows.length) {
    return <div className="empty-inline">الملف مافيهوش صفوف كتب للعرض.</div>
  }

  return (
    <div className="preview-table-block">
      {totalPages > 1 && <TablePagination page={page} totalPages={totalPages} onPrevious={() => setPage((current) => current - 1)} onNext={() => setPage((current) => current + 1)} className="preview-pagination" ariaLabel="صفحات معاينة الاستيراد" />}
      <div className="table-wrap">
        <table className="preview-table">
          <thead><tr><th>#</th><th>الكود</th><th>الكتاب والمؤلف</th><th>العدد</th><th>السعر بالـ{localCurrency.nameAr}</th><th>السعر بالدولار</th><th>الحالة</th><th className="table-actions-cell">إجراء</th></tr></thead>
          <tbody>
          {visibleRows.map((row) => {
            const rowErrors = groupedErrors.get(row.rowNumber) || []
            return (
              <tr key={row.rowNumber} className={rowErrors.length ? 'preview-table__row--error' : ''}>
                <td className="numeric">{row.rowNumber}</td>
                <td className="numeric code-cell" dir="ltr">{row.code || '—'}</td>
                <td><strong>{row.name || 'بدون اسم'}</strong><small>{row.author || 'بدون مؤلف'}</small></td>
                <td className="numeric">{row.quantity || '—'}</td>
                <td className="numeric" dir="ltr"><span className="table-price">{row.price || '—'} <small>{localCurrency.nameAr}</small></span></td>
                <td className="numeric" dir="ltr"><span className="table-price">{row.priceInUSD || '—'} <small>دولار</small></span></td>
                <td>
                  {rowErrors.length ? (
                    <ul className="row-errors">{rowErrors.map((error, errorIndex) => <li key={`${error.column}-${errorIndex}`}><b>{error.column}:</b> {error.message}</li>)}</ul>
                  ) : <span className="status-pill status-pill--success">جاهز</span>}
                </td>
                <td className="table-actions-cell">{rowErrors.length ? <div className="table-actions" role="group" aria-label={`إجراءات الصف ${row.rowNumber}`}><button className="table-action" type="button" aria-label="تعديل" title="تعديل الصف" onClick={() => onEditRow(row)}><Icon name="edit" size={17} /></button><button className="table-action table-action--danger" type="button" aria-label="حذف الصف" title="حذف الصف" onClick={() => onDeleteRow(row.rowNumber)}><Icon name="trash" size={17} /></button></div> : '—'}</td>
              </tr>
            )
          })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
