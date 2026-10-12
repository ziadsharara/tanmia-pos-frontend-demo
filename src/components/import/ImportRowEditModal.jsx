import { Icon } from '../ui/Icon.jsx'
import { useDialogA11y } from '../ui/useDialogA11y.js'

export function ImportRowEditModal({ row, localCurrency, onChange, onClose, onSave }) {
  const dialogRef = useDialogA11y(Boolean(row), onClose)
  if (!row) return null

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section ref={dialogRef} className="book-modal" role="dialog" aria-modal="true" aria-labelledby="import-row-edit-title" tabIndex="-1">
        <div className="book-modal__header">
          <div><span className="eyebrow">تعديل صف من المعاينة</span><h2 id="import-row-edit-title">الصف رقم {row.rowNumber}</h2></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="إغلاق"><Icon name="close" /></button>
        </div>
        <form className="book-form" onSubmit={(event) => { event.preventDefault(); onSave() }}>
          <div className="book-form__grid">
            <label className="form-field"><span>الكود</span><input name="code" autoComplete="off" spellCheck="false" type="text" dir="ltr" value={row.code ?? ''} onChange={(event) => onChange('code', event.target.value)} /></label>
            <label className="form-field"><span>اسم الكتاب</span><input name="name" autoComplete="off" type="text" value={row.name ?? ''} onChange={(event) => onChange('name', event.target.value)} /></label>
            <label className="form-field"><span>المؤلف</span><input name="author" autoComplete="off" type="text" value={row.author ?? ''} onChange={(event) => onChange('author', event.target.value)} /></label>
            <label className="form-field"><span>الكمية</span><input name="quantity" autoComplete="off" type="number" dir="ltr" min="0" step="1" value={row.quantity ?? ''} onChange={(event) => onChange('quantity', event.target.value)} /></label>
            <label className="form-field"><span>السعر بـ{localCurrency.nameAr}</span><input name="price" autoComplete="off" type="number" dir="ltr" min="0" step="0.01" value={row.price ?? ''} onChange={(event) => onChange('price', event.target.value)} /></label>
            <label className="form-field"><span>السعر بالدولار</span><input name="priceInUSD" autoComplete="off" type="number" dir="ltr" min="0" step="0.01" value={row.priceInUSD ?? ''} onChange={(event) => onChange('priceInUSD', event.target.value)} /></label>
          </div>
          <div className="book-modal__footer"><button className="button button--ghost" type="button" onClick={onClose}>إلغاء</button><button className="button button--primary" type="submit"><Icon name="check" size={18} />حفظ تعديل الصف</button></div>
        </form>
      </section>
    </div>
  )
}
