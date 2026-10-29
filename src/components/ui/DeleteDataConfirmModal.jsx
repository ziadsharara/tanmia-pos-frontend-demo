import { useState } from 'react'
import { Icon } from './Icon.jsx'
import { useDialogA11y } from './useDialogA11y.js'

export function DeleteDataConfirmModal({ warningTitle = 'العملية دي نهائية', title, description, phrase, confirmLabel, isBusy, onClose, onConfirm }) {
  const [confirmation, setConfirmation] = useState('')
  const phraseMatches = confirmation.trim() === phrase
  const dialogRef = useDialogA11y(true, onClose, !isBusy)

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !isBusy && onClose()}>
      <section ref={dialogRef} className="book-modal delete-modal" role="dialog" aria-modal="true" aria-labelledby="delete-data-modal-title" tabIndex="-1">
        <header className="book-modal__header delete-modal__header">
          <div><span className="eyebrow">تأكيد الحذف</span><h2 id="delete-data-modal-title">{title}</h2></div>
          <button className="icon-button" type="button" aria-label="إغلاق" disabled={isBusy} onClick={onClose}><Icon name="close" /></button>
        </header>
        <div className="delete-modal__body">
          <div className="delete-modal__warning-icon"><Icon name="trash" size={28} /></div>
          <strong className="delete-modal__title">{warningTitle}</strong>
          <div className="delete-modal__description">{description}</div>
          <div className="delete-modal__phrase" dir="rtl">{phrase}</div>
          <label className="form-field delete-modal__field">
            <span>للتأكيد، اكتب العبارة الظاهرة فوق</span>
            <input autoFocus name="delete-confirmation" autoComplete="off" type="text" value={confirmation} disabled={isBusy} onChange={(event) => setConfirmation(event.target.value)} />
          </label>
          <footer className="book-modal__footer">
            <button className="button button--ghost" type="button" disabled={isBusy} onClick={onClose}>إلغاء</button>
            <button className="button button--danger" type="button" disabled={isBusy || !phraseMatches} onClick={onConfirm}>
              {isBusy ? <span className="spinner spinner--light" /> : <Icon name="trash" size={17} />}
              {isBusy ? 'جاري الحذف...' : confirmLabel}
            </button>
          </footer>
        </div>
      </section>
    </div>
  )
}
