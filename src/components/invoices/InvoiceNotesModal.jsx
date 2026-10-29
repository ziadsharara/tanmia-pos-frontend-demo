import { Icon } from '../ui/Icon.jsx'
import { useDialogA11y } from '../ui/useDialogA11y.js'

export function InvoiceNotesModal({ invoice, onClose }) {
  const dialogRef = useDialogA11y(true, onClose)
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section ref={dialogRef} className="book-modal invoice-notes-modal" role="dialog" aria-modal="true" aria-labelledby="invoice-notes-title" tabIndex="-1">
      <header className="book-modal__header"><div><h2 id="invoice-notes-title">ملاحظات الفاتورة</h2><bdi>{invoice.invoiceNumber}</bdi></div><button className="icon-button" type="button" aria-label="إغلاق" onClick={onClose}><Icon name="close" /></button></header>
      <p className="invoice-notes-modal__text">{invoice.notes}</p>
    </section>
  </div>
}
