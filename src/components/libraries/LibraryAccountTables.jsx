import { TablePagination } from '../ui/TablePagination.jsx'
import { Icon } from '../ui/Icon.jsx'
import { libraryEntryLabels, libraryBalanceLabel } from '../../utils/libraryAccounts.js'

export function accountNumber(value) {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value || 0))
}

function Money({ value, balance = false, tone = 'sale' }) {
  const amount = Number(value || 0)
  return <span className={`account-table-money money--${balance ? amount < 0 ? 'received' : 'debt' : tone} ${amount === 0 ? 'is-zero money--zero' : ''} ${balance ? 'is-balance' : ''} ${amount < 0 ? 'is-credit' : ''}`}><bdi dir="ltr">{accountNumber(balance ? Math.abs(amount) : amount)}</bdi>{balance && <small>{libraryBalanceLabel(amount)}</small>}</span>
}

function InvoiceLink({ invoiceId, invoiceNumber, onOpen, disabled }) {
  return <button className="account-table-link" type="button" disabled={disabled} onClick={() => onOpen(invoiceId)} aria-label={`عرض الفاتورة رقم ${invoiceNumber || "غير متاح"}`}>فاتورة <bdi>{invoiceNumber || "غير متاح"}</bdi><Icon name="eye" size={14} /></button>
}

export function StatementTable({ rows, onOpen, busy }) {
  return <table className="account-table account-table--statement"><caption className="account-sr-only">حركات حساب المكتبة مرتبة من الأحدث إلى الأقدم</caption><thead><tr><th>التاريخ</th><th>الحركة</th><th>المرجع</th><th className="account-table__number">مدين</th><th className="account-table__number">دائن</th><th className="account-table__number">الرصيد الكلي بعد الحركة</th></tr></thead><tbody>{rows.map(({ entry, balance, invoiceNumber }) => <tr key={entry.id}>
    <td className="account-table__date"><bdi>{entry.entryDate}</bdi></td>
    <td><span className={`account-entry-type ${['PAYMENT', 'LEGACY_PAYMENT'].includes(entry.entryType) ? 'account-entry-type--payment' : ''}`}>{entry.postingKey?.startsWith('refund-op:') ? 'نقد سلّمناه للمكتبة' : entry.postingKey?.startsWith('refund-reclassification:') ? 'إلغاء تسوية سابقة' : libraryEntryLabels[entry.entryType] || 'حركة حساب'}</span>{['PAYMENT', 'RETURN', 'REFUND'].includes(entry.entryType) && entry.description && entry.description !== 'Library payment' && <small className="account-table-note">{entry.description}</small>}{entry.postingKey?.startsWith('refund-op:') && <small className="account-table-note">مبلغ خرج من عندنا للمكتبة؛ خفض الحساب الناتج عن المرتجع يظهر بعد جمع حركة الكتب مع النقد.</small>}</td>
    <td>{entry.paymentId ? <span className="account-reference">دفعة <bdi>#{entry.paymentId}</bdi></span> : entry.invoiceId ? <InvoiceLink invoiceId={entry.invoiceId} invoiceNumber={invoiceNumber} onOpen={onOpen} disabled={busy} /> : entry.entryType === 'LEGACY_ADJUSTMENT' ? 'تسوية بيانات قديمة' : 'افتتاح الحساب'}</td>
    <td className="account-table__number"><Money value={entry.debit} tone={entry.entryType === 'REFUND' ? 'refund' : 'debt'} /></td><td className="account-table__number"><Money value={entry.credit} tone={['PAYMENT', 'LEGACY_PAYMENT'].includes(entry.entryType) ? 'received' : 'refund'} /></td><td className="account-table__number"><Money value={balance} balance /></td>
  </tr>)}</tbody></table>
}

export function LibraryInvoicesTable({ rows, onOpen, onDelete, busy }) {
  return <table className="account-table"><caption className="account-sr-only">فواتير المكتبة من الأحدث إلى الأقدم</caption><thead><tr><th>الفاتورة</th><th>التاريخ</th><th className="account-table__number">قيمة الفاتورة</th><th>الحالة</th><th className="table-actions-cell">إجراء</th></tr></thead><tbody>{rows.map((invoice) => <tr key={invoice.id}><td title={invoice.invoiceNumber}><strong className="account-reference"><bdi>{invoice.invoiceNumber}</bdi></strong></td><td className="account-table__date"><bdi>{invoice.businessDate}</bdi></td><td className="account-table__number"><Money value={invoice.totalAmountAfterDiscounts} /></td><td><span className={`account-document-status ${invoice.refundAt || invoice.paymentStatus === 'REFUND' ? 'is-returned' : ''}`}>{invoice.paymentStatus === 'REFUND' ? 'مرتجعة بالكامل' : invoice.refundAt ? 'مرتجع جزئي' : 'على الحساب'}</span></td><td className="table-actions-cell"><div className="table-actions" role="group" aria-label={`إجراءات الفاتورة ${invoice.invoiceNumber}`}><button className="table-action" type="button" aria-label="عرض وطباعة" title="عرض وطباعة الفاتورة" disabled={busy} onClick={() => onOpen(invoice.id)}><Icon name="eye" size={17} /></button><button className="table-action table-action--danger" type="button" aria-label="حذف" title="حذف الفاتورة وتحديث رصيد المكتبة" disabled={busy} onClick={() => onDelete(invoice)}><Icon name="trash" size={17} /></button></div></td></tr>)}</tbody></table>
}

export function LibraryPaymentsTable({ rows, onOpen, busy }) {
  return <table className="account-table"><caption className="account-sr-only">دفعات المكتبة من الأحدث إلى الأقدم</caption><thead><tr><th>الدفعة</th><th>تاريخ الدفع</th><th>طريقة الدفع</th><th className="account-table__number">المبلغ المدفوع</th><th>ملاحظات</th><th>مرجع سابق</th></tr></thead><tbody>{rows.map((payment) => <tr key={payment.id}><td><strong className="account-reference">دفعة <bdi>#{payment.id}</bdi></strong></td><td className="account-table__date"><bdi>{payment.paidAt}</bdi></td><td>{payment.paymentMethod === 'CASH' ? 'نقدي' : 'فيزا'}</td><td className="account-table__number"><Money value={payment.amount} tone={payment.paymentMethod === 'VISA' ? 'visa' : 'received'} /></td><td className="account-table-note">{payment.notes || 'بدون ملاحظات'}</td><td>{payment.invoiceId ? <InvoiceLink invoiceId={payment.invoiceId} invoiceNumber={payment.invoiceNumber} onOpen={onOpen} disabled={busy} /> : <span className="account-reference">على الحساب</span>}</td></tr>)}</tbody></table>
}

export function AccountPagination({ data, onChange, loading }) {
  if (!data || data.totalElements === 0) return null
  const first = data.number * data.size + 1
  const last = Math.min((data.number + 1) * data.size, data.totalElements)
  return <TablePagination page={data.number} totalPages={data.totalPages} hasNext={!data.last} loading={loading} onPrevious={() => onChange(data.number - 1)} onNext={() => onChange(data.number + 1)} className="account-pagination" ariaLabel="صفحات حساب المكتبة" summary={<>عرض <bdi>{first}–{last}</bdi> من <bdi>{data.totalElements}</bdi></>} />
}
