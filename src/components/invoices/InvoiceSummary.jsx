import { Icon } from '../ui/Icon.jsx'
import { AppDropdown } from '../ui/AppDropdown.jsx'
import { Notice } from '../ui/Notice.jsx'
import { formatMoney, getCurrencyName } from '../../utils/currency.js'

const paymentMethods = [
  ['CASH', 'نقدي'], ['VISA', 'فيزا'], ['COUPON', 'كوبون من المعرض'],
]

function SummaryRow({ label, value, strong, tone = 'sale' }) {
  const [amount, ...currency] = strong ? String(value || '—').split(' ') : []
  return <div className={strong ? 'invoice-summary__row invoice-summary__row--strong' : 'invoice-summary__row'}><span>{label}</span><b className={`money--${tone}`} dir="ltr" aria-live={strong ? 'polite' : undefined}>{strong ? <><bdi>{amount}</bdi>{currency.length > 0 && <small dir="rtl">{currency.join(' ')}</small>}</> : value}</b></div>
}

export function InvoiceSummary({ values, calculationState, librariesState, itemCount, disabled, onChange, onSelectLibrary, onConfirm, localCurrency }) {
  const calculation = calculationState.data?.calculation
  const amountDue = calculationState.data?.amountDue
  const isGift = values.paymentType === 'GIFT'
  const currencies = [localCurrency?.code, 'USD'].filter(Boolean)
  const libraryOptionLabel = librariesState.status === 'loading'
    ? 'جاري تحميل المكتبات…'
    : librariesState.status === 'ready' && librariesState.libraries.length === 0
      ? 'لا توجد مكتبات محفوظة، اكتب الاسم'
      : 'مكتبة جديدة، اكتب الاسم'
  const paymentDetailsReady = values.paymentType === 'DIRECT'
    ? Boolean(values.paymentMethod)
    : values.paymentType === 'WHOLESALE_CREDIT'
      ? Boolean(values.libraryName.trim())
      : values.paymentType === 'GIFT'

  return (
    <aside className="panel invoice-summary" id="invoice-summary" aria-label="الحساب والدفع">
      <div className="panel__heading"><div><span className="eyebrow">ملخص الفاتورة</span><h2>الحساب والدفع</h2></div></div>
      <div className="form-field invoice-summary__currency"><span>عملة الفاتورة</span><AppDropdown ariaLabel="عملة الفاتورة" disabled={disabled} value={values.currency} options={currencies.map((currency) => ({ value: currency, label: getCurrencyName(currency, localCurrency) }))} onChange={(currency) => onChange('currency', currency)} /></div>
      <div className="invoice-summary__totals">
        <SummaryRow label="الإجمالي" value={calculation ? formatMoney(calculation.totalAmountBeforeDiscount, values.currency, localCurrency) : '—'} />
        <SummaryRow tone="discount" label="خصومات الكتب" value={calculation ? `-${formatMoney(calculation.booksDiscountAmount, values.currency, localCurrency)}` : '—'} />
        <SummaryRow label="بعد خصومات الكتب" value={calculation ? formatMoney(calculation.subtotalAfterBookDiscounts, values.currency, localCurrency) : '—'} />
      </div>
      <div className="invoice-summary__discounts">
        <label className="form-field"><span>خصم الفاتورة %</span><input name="invoice-discount-percentage" autoComplete="off" type="number" dir="ltr" inputMode="decimal" min="0" max="100" step="0.01" disabled={disabled} value={values.invoiceDiscountPercentage} onChange={(event) => onChange('invoiceDiscountPercentage', event.target.value)} /></label>
        <label className="form-field"><span>خصم ثابت ({getCurrencyName(values.currency, localCurrency)})</span><input name="invoice-fixed-discount" autoComplete="off" type="number" dir="ltr" inputMode="decimal" min="0" step="0.01" disabled={disabled} value={values.invoiceFixedDiscountAmount} onChange={(event) => onChange('invoiceFixedDiscountAmount', event.target.value)} /></label>
      </div>
      <div className="invoice-summary__totals">
        <SummaryRow tone="discount" label="خصم نسبة الفاتورة" value={calculation ? `-${formatMoney(calculation.invoicePercentageDiscountAmount, values.currency, localCurrency)}` : '—'} />
        <SummaryRow label="قيمة الكتب المحسوبة" value={calculation ? formatMoney(calculation.totalAmountAfterDiscounts, values.currency, localCurrency) : '—'} />
        <SummaryRow strong tone={isGift ? 'gift' : 'debt'} label={isGift ? 'المطلوب للهدية' : values.paymentType === 'WHOLESALE_CREDIT' ? 'يضاف لحساب المكتبة' : 'المبلغ المطلوب'} value={calculationState.data ? formatMoney(amountDue, values.currency, localCurrency) : '—'} />
      </div>
      <div className="form-field invoice-summary__sale-type"><span>نوع البيع</span><AppDropdown ariaLabel="نوع البيع" disabled={disabled} value={values.paymentType} options={[{ value: 'DIRECT', label: 'بيع مباشر' }, { value: 'WHOLESALE_CREDIT', label: 'بيع آجل لمكتبة' }, { value: 'GIFT', label: 'هدية' }]} onChange={(paymentType) => onChange('paymentType', paymentType)} /></div>
      {values.paymentType === 'DIRECT' && <div className="form-field"><span>طريقة الدفع</span><AppDropdown ariaLabel="طريقة الدفع" disabled={disabled} value={values.paymentMethod} options={[{ value: '', label: 'اختار طريقة الدفع' }, ...paymentMethods.map(([value, label]) => ({ value, label }))]} onChange={(method) => onChange('paymentMethod', method)} /></div>}
      {values.paymentType === 'WHOLESALE_CREDIT' && <div className="library-payment-fields"><div className="form-field"><span>اختيار مكتبة محفوظة</span><AppDropdown ariaLabel="اختيار مكتبة محفوظة" disabled={disabled || librariesState.status === 'loading'} value={values.selectedLibraryId} options={[{ value: '', label: libraryOptionLabel }, ...librariesState.libraries.map((library) => ({ value: String(library.id), label: library.name }))]} onChange={onSelectLibrary} /></div><label className="form-field"><span>اسم المكتبة</span><input name="library-name" autoComplete="off" type="text" disabled={disabled || Boolean(values.selectedLibraryId)} value={values.libraryName} onChange={(event) => onChange('libraryName', event.target.value)} placeholder="اكتب اسم المكتبة…" /></label><Notice tone="info" title="الفاتورة على حساب المكتبة">قيمة الفاتورة بتضاف للحساب. سجل أي دفعة من <a href="#libraries">حسابات المكتبات</a>.</Notice></div>}
      {isGift && <Notice tone="info" title="هدية لا تحتاج دفع">المبلغ المطلوب صفر، وقيمة الكتب المحسوبة محفوظة في الفاتورة.</Notice>}
      <label className="form-field invoice-notes"><span>ملاحظات الفاتورة <small>(اختياري)</small></span><textarea name="invoice-notes" rows="3" maxLength="1000" value={values.notes || ''} disabled={disabled} placeholder="اكتب ملاحظة على الفاتورة..." onChange={(event) => onChange('notes', event.target.value)} /></label>
      {calculationState.status === 'error' && <Notice tone="error" title="راجع الحساب">{calculationState.error}</Notice>}
      <button className="button button--primary invoice-summary__submit" type="button" disabled={disabled || itemCount === 0 || calculationState.status !== 'ready' || !values.currency || !paymentDetailsReady} onClick={onConfirm}>{disabled ? <span className="spinner spinner--light" /> : <Icon name="check" size={18} />}{disabled ? 'جاري حفظ الفاتورة…' : 'تأكيد وحفظ الفاتورة'}</button>
    </aside>
  )
}
