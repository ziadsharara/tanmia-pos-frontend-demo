import { useState } from 'react'
import { Icon } from '../ui/Icon.jsx'
import { useDialogA11y } from '../ui/useDialogA11y.js'

const DELETE_ALL_PHRASE = 'حذف كل الكتب'

export function DeleteBooksConfirmModal({ target, isBusy, onClose, onConfirm }) {
  const [step, setStep] = useState(1)
  const [confirmationPhrase, setConfirmationPhrase] = useState('')
  const dialogRef = useDialogA11y(Boolean(target), onClose, !isBusy)

  if (!target) return null

  const isDeleteAll = target.kind === 'all'
  const phraseMatches = confirmationPhrase.trim() === DELETE_ALL_PHRASE

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !isBusy && onClose()}>
      <section ref={dialogRef} className="book-modal delete-modal" role="dialog" aria-modal="true" aria-labelledby="delete-modal-title" tabIndex="-1">
        <header className="book-modal__header delete-modal__header">
          <div><span className="eyebrow">تأكيد الحذف</span><h2 id="delete-modal-title">{isDeleteAll ? 'حذف كل الكتب' : 'حذف الكتاب'}</h2></div>
          <button className="icon-button" type="button" aria-label="إغلاق" disabled={isBusy} onClick={onClose}><Icon name="close" /></button>
        </header>

        <div className="delete-modal__body">
          <div className="delete-modal__warning-icon"><Icon name="trash" size={28} /></div>

          {!isDeleteAll && (
            <>
              <strong className="delete-modal__title">متأكد إنك عايز تحذف الكتاب ده؟</strong>
              <p>هيتم حذف <strong>{target.book.name}</strong> من قائمة الكتب.</p>
            </>
          )}

          {isDeleteAll && step === 1 && (
            <>
              <strong className="delete-modal__title">تحذير شديد: العملية دي هتحذف كل الكتب</strong>
              <p>كل الكتب الموجودة في الكتالوج هتتمسح. العملية دي نهائية ومش هتقدر ترجع عنها من الشاشة.</p>
              <div className="delete-modal__warning"><Icon name="alert" size={20} /><span>راجع قرارك كويس قبل ما تنتقل للتأكيد النهائي.</span></div>
            </>
          )}

          {isDeleteAll && step === 2 && (
            <>
              <strong className="delete-modal__title">التأكيد النهائي</strong>
              <p>اكتب العبارة التالية بالضبط علشان تفعّل زر الحذف النهائي:</p>
              <div className="delete-modal__phrase" dir="rtl">{DELETE_ALL_PHRASE}</div>
              <label className="form-field delete-modal__field">
                <span>عبارة التأكيد</span>
                <input autoFocus name="delete-books-confirmation" autoComplete="off" type="text" value={confirmationPhrase} disabled={isBusy} onChange={(event) => setConfirmationPhrase(event.target.value)} />
              </label>
            </>
          )}

          <footer className="book-modal__footer">
            <button className="button button--ghost" type="button" disabled={isBusy} onClick={onClose}>إلغاء</button>
            {isDeleteAll && step === 2 && <button className="button button--secondary" type="button" disabled={isBusy} onClick={() => { setStep(1); setConfirmationPhrase('') }}>رجوع</button>}
            {isDeleteAll && step === 1 ? (
              <button className="button button--danger" type="button" onClick={() => setStep(2)}>فاهم التحذير، كمل</button>
            ) : (
              <button className="button button--danger" type="button" disabled={isBusy || (isDeleteAll && !phraseMatches)} onClick={onConfirm}>
                {isBusy ? <span className="spinner spinner--light" /> : <Icon name="trash" size={17} />}
                {isBusy ? 'جاري الحذف...' : isDeleteAll ? 'حذف كل الكتب نهائياً' : 'تأكيد حذف الكتاب'}
              </button>
            )}
          </footer>
        </div>
      </section>
    </div>
  )
}
