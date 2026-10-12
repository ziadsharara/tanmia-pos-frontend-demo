import { Icon } from '../ui/Icon.jsx'
import { AppDropdown } from '../ui/AppDropdown.jsx'
import { Notice } from '../ui/Notice.jsx'
import { formatMoney, getCurrencyName } from '../../utils/currency.js'

const paymentMethods = [
  ['CASH', 'نقدي'], ['VISA', 'فيزا'],
]

function SummaryRow({ label, value, strong }) {
  return <div className={strong ? 'invoice-summary__row invoice-summary__row--strong' : 'invoice-summary__row'}><span>{label}</span><b dir="ltr" aria-live={strong ? 'polite' : undefined}>{value}</b></div>
}

export function InvoiceSummary({ values, calculationState, librariesState, itemCount, disabled, onChange, onSelectLibrary, onConfirm, localCurrency }) {
  const calculation = calculationState.data?.calculation
  const amountDue = calculationState.data?.amountDue
  const isGift = values.paymentType === 'GIFT'
  const currencies = [localCurrency?.code, 'USD'].filter(Boolean)
  const libraryPayment = Number(values.libraryPartialPaymentAmount || 0)
  const invoiceTotal = Number(calculation?.totalAmountAfterDiscounts || 0)
  const libraryRemaining = Math.round(Math.max(0, invoiceTotal - libraryPayment) * 100) / 100
  const libraryOptionLabel = librariesState.status === 'loading'
    ? 'جاري تحميل المكتبات…'
    : librariesState.status === 'ready' && librariesState.libraries.length === 0
      ? 'لا توجد مكتبات محفوظة — اكتب الاسم'
      : 'مكتبة جديدة — اكتب الاسم'
  const paymentDetailsReady = values.paymentType === 'DIRECT'
    ? Boolean(values.paymentMethod)
    : values.paymentType === 'WHOLESALE_CREDIT'
      ? Boolean(values.libraryName.trim()) && Number.isFinite(libraryPayment) && libraryPayment >= 0 && libraryPayment <= invoiceTotal && (libraryPayment === 0 || Boolean(values.paymentMethod))
      : values.paymentType === 'GIFT'

  return (
    <aside className="panel invoice-summary" id="invoice-summary" aria-label="الحساب والدفع">
      <div className="panel__heading"><div><span className="eyebrow">ملخص الفاتورة</span><h2>الحساب والدفع</h2></div></div>
      <div className="form-field invoice-summary__currency"><span>عملة الفاتورة</span><AppDropdown ariaLabel="عملة الفاتورة" disabled={disabled} value={values.currency} options={currencies.map((currency) => ({ value: currency, label: getCurrencyName(currency, localCurrency) }))} onChange={(currency) => onChange('currency', currency)} /></div>
      <div className="invoice-summary__totals">
        <SummaryRow label="الإجمالي" value={calculation ? formatMoney(calculation.totalAmountBeforeDiscount, values.currency, localCurrency) : '—'} />
        <SummaryRow label="خصومات الكتب" value={calculation ? `-${formatMoney(calculation.booksDiscountAmount, values.currency, localCurrency)}` : '—'} />
        <SummaryRow label="بعد خصومات الكتب" value={calculation ? formatMoney(calculation.subtotalAfterBookDiscounts, values.currency, localCurrency) : '—'} />
      </div>
      <div className="invoice-summary__discounts">
        <label className="form-field"><span>خصم الفاتورة %</span><input name="invoice-discount-percentage" autoComplete="off" type="number" dir="ltr" inputMode="decimal" min="0" max="100" step="0.01" disabled={disabled} value={values.invoiceDiscountPercentage} onChange={(event) => onChange('invoiceDiscountPercentage', event.target.value)} /></label>
        <label className="form-field"><span>خصم ثابت ({getCurrencyName(values.currency, localCurrency)})</span><input name="invoice-fixed-discount" autoComplete="off" type="number" dir="ltr" inputMode="decimal" min="0" step="0.01" disabled={disabled} value={values.invoiceFixedDiscountAmount} onChange={(event) => onChange('invoiceFixedDiscountAmount', event.target.value)} /></label>
      </div>
      <div className="invoice-summary__totals">
        <SummaryRow label="خصم نسبة الفاتورة" value={calculation ? `-${formatMoney(calculation.invoicePercentageDiscountAmount, values.currency, localCurrency)}` : '—'} />
        <SummaryRow label="قيمة الكتب المحسوبة" value={calculation ? formatMoney(calculation.totalAmountAfterDiscounts, values.currency, localCurrency) : '—'} />
        <SummaryRow strong label={isGift ? 'المطلوب — هدية' : 'المبلغ المطلوب'} value={calculationState.data ? formatMoney(amountDue, values.currency, localCurrency) : '—'} />
      </div>
      <div className="form-field invoice-summary__sale-type"><span>نوع البيع</span><AppDropdown ariaLabel="نوع البيع" disabled={disabled} value={values.paymentType} options={[{ value: 'DIRECT', label: 'بيع مباشر' }, { value: 'WHOLESALE_CREDIT', label: 'بيع آجل لمكتبة' }, { value: 'GIFT', label: 'هدية' }]} onChange={(paymentType) => onChange('paymentType', paymentType)} /></div>
      {values.paymentType === 'DIRECT' && <div className="payment-methods" aria-label="طريقة الدفع">{paymentMethods.map(([value, label]) => <button type="button" key={value} disabled={disabled} className={values.paymentMethod === value ? 'is-active' : ''} aria-pressed={values.paymentMethod === value} onClick={() => onChange('paymentMethod', value)}>{label}</button>)}</div>}
      {values.paymentType === 'WHOLESALE_CREDIT' && <div className="library-payment-fields"><div className="form-field"><span>اختيار مكتبة محفوظة</span><AppDropdown ariaLabel="اختيار مكتبة محفوظة" disabled={disabled || librariesState.status === 'loading'} value={values.selectedLibraryId} options={[{ value: '', label: libraryOptionLabel }, ...librariesState.libraries.map((library) => ({ value: String(library.id), label: library.name }))]} onChange={onSelectLibrary} /></div><label className="form-field"><span>اسم المكتبة</span><input name="library-name" autoComplete="off" type="text" disabled={disabled || Boolean(values.selectedLibraryId)} value={values.libraryName} onChange={(event) => onChange('libraryName', event.target.value)} placeholder="اكتب اسم المكتبة…" /></label><label className="form-field"><span>المبلغ المدفوع الآن ({getCurrencyName(values.currency, localCurrency)})</span><input name="library-partial-payment" autoComplete="off" type="number" dir="ltr" inputMode="decimal" min="0" max={calculation?.totalAmountAfterDiscounts} step="0.01" disabled={disabled} value={values.libraryPartialPaymentAmount ?? '0'} onChange={(event) => { const value = event.target.value; if (value !== '' && (Number(value) < 0 || (calculation && Number(value) > invoiceTotal))) return; onChange('libraryPartialPaymentAmount', value) }} placeholder="0.00" /></label>{libraryPayment > 0 && <div><span className="library-payment-method-label">طريقة دفع المبلغ الحالي</span><div className="payment-methods payment-methods--library" aria-label="طريقة دفع المبلغ الحالي">{paymentMethods.map(([value, label]) => <button type="button" key={value} disabled={disabled} className={values.paymentMethod === value ? 'is-active' : ''} aria-pressed={values.paymentMethod === value} onClick={() => onChange('paymentMethod', value)}>{label}</button>)}</div></div>}<div className="library-payment-remaining"><span>المتبقي على المكتبة</span><strong dir="ltr">{calculation ? formatMoney(libraryRemaining, values.currency, localCurrency) : '—'}</strong></div><span className="invoice-summary__hint">اكتب 0 لو المكتبة مش هتدفع جزء دلوقتي.</span></div>}
      {isGift && <Notice tone="info" title="هدية لا تحتاج دفع">المبلغ المطلوب صفر، وقيمة الكتب المحسوبة محفوظة في الفاتورة.</Notice>}
      {calculationState.status === 'error' && <Notice tone="error" title="راجع الحساب">{calculationState.error}</Notice>}
      <button className="button button--primary invoice-summary__submit" type="button" disabled={disabled || itemCount === 0 || calculationState.status !== 'ready' || !values.currency || !paymentDetailsReady} onClick={onConfirm}>{disabled ? <span className="spinner spinner--light" /> : <Icon name="check" size={18} />}{disabled ? 'جاري حفظ الفاتورة…' : 'تأكيد وحفظ الفاتورة'}</button>
    </aside>
  )
}
