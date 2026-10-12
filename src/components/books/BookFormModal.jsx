import { Icon } from '../ui/Icon.jsx'
import { Notice } from '../ui/Notice.jsx'
import { useDialogA11y } from '../ui/useDialogA11y.js'

function getFields(localCurrency) {
  return [
  { name: 'code', label: 'كود الكتاب', type: 'text', placeholder: 'مثال: 9780000000000', direction: 'ltr' },
  { name: 'name', label: 'اسم الكتاب', type: 'text' },
  { name: 'author', label: 'اسم المؤلف', type: 'text' },
  { name: 'quantity', label: 'الكمية', type: 'number', step: '1', min: '0', direction: 'ltr' },
  { name: 'price', label: `السعر بـ${localCurrency.nameAr}`, type: 'number', step: 'any', min: '1', direction: 'ltr' },
  { name: 'priceInUSD', label: 'السعر بالدولار', type: 'number', step: 'any', min: '1', direction: 'ltr' },
  ]
}

export function BookFormModal({ editor, onChange, onClose, onSubmit, onRetry, localCurrency }) {
  const isBusy = editor.status === 'loading' || editor.status === 'submitting'
  const dialogRef = useDialogA11y(editor.open, onClose, !isBusy)
  if (!editor.open) return null

  const isEdit = editor.mode === 'edit'

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !isBusy && onClose()}>
      <section ref={dialogRef} className="book-modal" role="dialog" aria-modal="true" aria-labelledby="book-modal-title" tabIndex="-1">
        <header className="book-modal__header">
          <div><span className="eyebrow">{isEdit ? 'بيانات الكتاب' : 'إضافة يدوية'}</span><h2 id="book-modal-title">{isEdit ? 'تعديل كتاب' : 'إضافة كتاب'}</h2></div>
          <button className="icon-button" type="button" aria-label="إغلاق" disabled={isBusy} onClick={onClose}><Icon name="close" /></button>
        </header>

        {editor.status === 'loading' && <div className="catalog-state"><span className="spinner spinner--large" /><strong>جاري تحميل بيانات الكتاب...</strong></div>}
        {editor.status === 'load-error' && <div className="modal-error"><Notice tone="error" title="تعذر تحميل الكتاب">{editor.error}</Notice><button className="button button--secondary" type="button" onClick={onRetry}><Icon name="refresh" size={17} />حاول تاني</button></div>}

        {(editor.status === 'ready' || editor.status === 'submitting' || editor.status === 'submit-error') && (
          <form className="book-form" onSubmit={onSubmit}>
            <div className="book-form__grid">
              {getFields(localCurrency).map((field) => (
                <label className={field.name === 'name' || field.name === 'author' ? 'form-field form-field--wide' : 'form-field'} key={field.name}>
                  <span>{field.label}</span>
                  <input name={field.name} autoComplete="off" spellCheck={field.name === 'code' ? false : undefined} type={field.type} step={field.step} min={field.min} value={editor.values[field.name]} placeholder={field.placeholder} dir={field.direction} required disabled={editor.status === 'submitting'} onChange={(event) => {
                    const value = event.target.value
                    if (field.name === 'quantity' && value !== '' && Number(value) < 0) return
                    if ((field.name === 'price' || field.name === 'priceInUSD') && value !== '' && Number(value) < 1) return
                    onChange(field.name, value)
                  }} />
                </label>
              ))}
            </div>
            {editor.status === 'submit-error' && <Notice tone="error" title="ماقدرناش نحفظ التعديل">{editor.error}</Notice>}
            <footer className="book-modal__footer">
              <button className="button button--ghost" type="button" disabled={editor.status === 'submitting'} onClick={onClose}>إلغاء</button>
              <button className="button button--primary" type="submit" disabled={editor.status === 'submitting'}>{editor.status === 'submitting' ? <span className="spinner spinner--light" /> : <Icon name={isEdit ? 'edit' : 'add'} size={18} />}{editor.status === 'submitting' ? 'جاري الحفظ...' : isEdit ? 'حفظ التعديلات' : 'إضافة الكتاب'}</button>
            </footer>
          </form>
        )}
      </section>
    </div>
  )
}
