import { InvoiceReceipt } from './InvoiceReceipt.jsx'
import { useDialogA11y } from '../ui/useDialogA11y.js'

export function InvoiceDetailsOverlay({ detail, localCurrency, exhibitionName, onClose }) {
  const dialogRef = useDialogA11y(detail.status !== 'idle', onClose, detail.status !== 'loading')
  if (detail.status === 'idle') return null

  return (
    <div ref={dialogRef} className="receipt-overlay" role="dialog" aria-modal="true" aria-label="تفاصيل الفاتورة" tabIndex="-1">
      <div className="receipt-overlay__body">
        {detail.status === 'loading' && <div className="receipt-loading"><span className="spinner spinner--large" /><strong>جاري فتح الفاتورة...</strong></div>}
        {detail.invoice && <InvoiceReceipt invoice={detail.invoice} localCurrency={localCurrency} exhibitionName={exhibitionName} onClose={onClose} />}
      </div>
    </div>
  )
}
